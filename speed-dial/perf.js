// Lite mode (Settings > Graphics): flat surfaces and no motion. Without GPU acceleration the glass blur and the
// drifting background are painted on the CPU every frame, which makes the whole page crawl.
// Shares globals with app.js and extras.js: S, save, $, el.
const perf = { soft: null, slow: false, probed: false };

// software rendering: WebGL refuses a "major performance caveat" context, or the renderer is a CPU rasteriser
function softGpu() {
  const ok = document.createElement('canvas').getContext('webgl', { failIfMajorPerformanceCaveat: true });
  ok?.getExtension('WEBGL_lose_context')?.loseContext();
  if (!ok) return true;
  const g = document.createElement('canvas').getContext('webgl'), x = g?.getExtension('WEBGL_debug_renderer_info');
  const soft = !!x && /swiftshader|llvmpipe|software|basic render|microsoft basic/i.test(g.getParameter(x.UNMASKED_RENDERER_WEBGL));
  g?.getExtension('WEBGL_lose_context')?.loseContext();
  return soft;
}

function applyPerf() {
  if (perf.soft === null) perf.soft = softGpu();
  const m = S.perf || 'auto', auto = m === 'auto' && (perf.soft || perf.slow);
  if (m === 'lite' || auto) document.documentElement.dataset.lite = '1';
  else delete document.documentElement.dataset.lite;
  perfBanner(auto && !S.perfDismissed);
  probe();
}

// a GPU that says it is fine can still be slow: time ~1s of frames once the boot animation is over
function probe() {
  if (perf.probed || perf.soft || (S.perf || 'auto') !== 'auto') return;
  if (document.visibilityState !== 'visible') return document.addEventListener('visibilitychange', probe, { once: true });
  if (document.body.classList.contains('boot')) return setTimeout(probe, 300);
  perf.probed = true;
  const d = [];
  let last, end;
  const step = t => {
    if (document.visibilityState !== 'visible') { perf.probed = false; return probe(); } // hidden tabs throttle frames: discard
    if (last !== undefined) d.push(t - last); else end = t + 1000;
    last = t;
    if (t < end) return requestAnimationFrame(step);
    d.sort((a, b) => a - b);
    perf.slow = document.hasFocus() && d[d.length >> 1] > 40; // an unfocused or covered window gets throttled frames: not a slow GPU
    if (perf.slow) applyPerf();
  };
  requestAnimationFrame(step);
}

function perfBanner(show) {
  let b = $('#pbar');
  if (!show) { if (b) b.hidden = true; return; }
  if (!b) {
    b = el('div', 'pbar', '<span></span><button type="button" class="btn">Turn it on</button><button type="button" class="btn">Dismiss</button>');
    b.id = 'pbar';
    b.setAttribute('role', 'status');
    const [on, x] = b.querySelectorAll('button');
    on.onclick = () => {
      chrome.tabs.create({ url: navigator.userAgent.includes('Edg/') ? 'edge://settings/system' : 'chrome://settings/system' });
      b.firstChild.textContent = "Turn on 'Use graphics acceleration when available', then restart the browser.";
    };
    x.onclick = () => { S.perfDismissed = true; save(); b.hidden = true; };
    document.body.append(b);
  }
  b.hidden = false;
  b.firstChild.textContent = perf.soft ? 'Graphics are reduced because hardware acceleration looks turned off.' : 'Speedy Dial seems slow on this computer, so effects are reduced.';
  b.children[1].hidden = !perf.soft; // acceleration is on when only the frame rate is low, so there is nothing to turn on
}

// decide once the first render is in (S is loaded by then)
new MutationObserver((_, o) => { o.disconnect(); applyPerf(); }).observe($('#grid'), { childList: true });
