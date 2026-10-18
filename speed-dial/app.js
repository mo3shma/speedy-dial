const $ = s => document.querySelector(s);
const uid = () => crypto.randomUUID();
const favUrl = (u, size = 64) => `${chrome.runtime.getURL('/_favicon/')}?pageUrl=${encodeURIComponent(u)}&size=${size}`;
const host = u => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return u; } };
const fixUrl = v => (/^[a-z][a-z0-9+.-]*:/i.test(v) ? v : 'https://' + v);
const hashHue = s => [...s].reduce((a, c) => a * 31 + c.charCodeAt(0), 7) % 360;

let S;          // { cols, rows, pinned, dials: [{ id, title, url, h?, s? }] }
let editing;    // dial being edited, null when adding
let dragId;
const justAdded = new Set(); // dials added a moment ago pop in instead of just appearing
const save = () => chrome.storage.local.set({ S });

// favicon with a coloured letter tile as fallback
function icon(url, title, cls = 'ico', src) {
  const img = new Image();
  img.className = cls;
  img.alt = '';
  img.src = src || favUrl(url);
  img.onerror = () => {
    const h = host(url), l = document.createElement('div');
    l.className = 'ltr';
    l.textContent = (title || h)[0].toUpperCase();
    l.style.background = `hsl(${hashHue(h)} 45% 42%)`;
    img.replaceWith(l);
  };
  return img;
}

// Reading each site's own icon files needs access to all sites. It is optional: asked for once, from a button, never at install.
// Without it, icons come from the public icon services and Chrome's favicon cache.
const SHARP = { origins: ['<all_urls>'] };
const hasSharp = async () => !chrome.permissions || chrome.permissions.contains(SHARP);
const askSharp = async () => { try { return !chrome.permissions || await chrome.permissions.request(SHARP); } catch { return false; } }; // call straight from a click
// once granted, re-fetch every icon the user did not pick themselves
chrome.permissions?.onAdded.addListener(p => {
  if (!p.origins?.includes('<all_urls>') || !S) return;
  for (const d of S.dials) if (!d.custom) for (const k of ['img', 'v', 'tried', 'h', 's']) delete d[k];
  save(); render();
});

// --- high-resolution icons: the site's own largest icon (SVG > manifest > apple-touch > favicon), cached as a PNG data URL ---
const sizeOf = s => +(/(\d+)x\d+/.exec(s || '')?.[1] ?? 0);
const grab = async (u, as) => {
  const r = await fetch(u, { credentials: 'omit', signal: AbortSignal.timeout(6000) });
  if (!r.ok) throw 0;
  return r[as]();
};
// unsharp-style kernel restores edges that smooth upscaling softens
function sharpen(cv) {
  const x = cv.getContext('2d'), { width: w, height: h } = cv, s = x.getImageData(0, 0, w, h), o = x.createImageData(w, h), k = .4;
  for (let y = 0; y < h; y++) for (let i = 0; i < w; i++) {
    const p = (y * w + i) * 4, l = (y * w + Math.max(0, i - 1)) * 4, r = (y * w + Math.min(w - 1, i + 1)) * 4,
      u = (Math.max(0, y - 1) * w + i) * 4, d = (Math.min(h - 1, y + 1) * w + i) * 4;
    for (let c = 0; c < 3; c++) o.data[p + c] = (1 + 4 * k) * s.data[p + c] - k * (s.data[l + c] + s.data[r + c] + s.data[u + c] + s.data[d + c]);
    o.data[p + 3] = s.data[p + 3];
  }
  x.putImageData(o, 0, 0);
}
async function toPng(blob) {
  const u = URL.createObjectURL(blob), img = new Image(), svg = /svg/.test(blob.type);
  try { img.src = u; await img.decode(); } finally { URL.revokeObjectURL(u); }
  const nw = img.naturalWidth || 512, nh = img.naturalHeight || 512, k = 512 / Math.max(nw, nh);
  const W = Math.round(nw * k), H = Math.round(nh * k);
  const mk = (w, h) => { const c = Object.assign(document.createElement('canvas'), { width: w, height: h }), x = c.getContext('2d', { willReadFrequently: true }); x.imageSmoothingQuality = 'high'; return [c, x]; };
  let [cv, x] = mk(svg || k < 1 ? W : nw, svg || k < 1 ? H : nh);
  x.drawImage(img, 0, 0, cv.width, cv.height); // SVG renders crisp straight at 512; big bitmaps are scaled down once
  while (!svg && cv.width < W) { // small bitmaps: double step by step, much smoother than one big jump
    const w2 = Math.min(W, cv.width * 2), [n, nx] = mk(w2, Math.round(H * w2 / W));
    nx.drawImage(cv, 0, 0, n.width, n.height);
    cv = n;
  }
  if (!svg && k > 1) sharpen(cv);
  // reshape to a 512px rounded square: full-bleed icons fill it, logos and wide images sit on white with padding
  const S = 512, [out, ox] = mk(S, S), g = cv.getContext('2d');
  const bleed = Math.abs(cv.width / cv.height - 1) < .25
    && [[0, 0], [cv.width - 1, 0], [0, cv.height - 1], [cv.width - 1, cv.height - 1]].every(([px, py]) => g.getImageData(px, py, 1, 1).data[3] > 230);
  ox.beginPath();
  ox.roundRect(0, 0, S, S, S * .225);
  ox.clip();
  if (!bleed) { ox.fillStyle = '#fff'; ox.fillRect(0, 0, S, S); }
  const fit = (bleed ? Math.max : Math.min)(S * (bleed ? 1 : .72) / cv.width, S * (bleed ? 1 : .72) / cv.height);
  ox.drawImage(cv, (S - cv.width * fit) / 2, (S - cv.height * fit) / 2, cv.width * fit, cv.height * fit);
  // a candidate that came out all white (a white glyph on a white tile) is useless: let the next source win
  const [, probe] = mk(16, 16);
  probe.drawImage(out, 0, 0, 16, 16);
  if (!probe.getImageData(0, 0, 16, 16).data.some((v, i) => i % 4 < 3 && v < 235)) throw new Error('blank icon');
  return { data: out.toDataURL('image/png'), w: svg ? 1024 : nw };
}
async function iconSources(url) {
  const origin = new URL(url).origin, c = [];
  const add = (u, n, label) => { const svg = /\.svg(\?|$)/i.test(u); if (!c.some(x => x.u === u)) c.push({ u, n: svg ? 1024 : n, label: svg ? 'SVG' : label }); };
  try {
    const doc = new DOMParser().parseFromString(await grab(origin, 'text'), 'text/html');
    for (const l of doc.querySelectorAll('link[rel~=icon],link[rel~=apple-touch-icon],link[rel~=apple-touch-icon-precomposed]'))
      add(new URL(l.getAttribute('href'), origin).href, sizeOf(l.getAttribute('sizes')) || (/apple/.test(l.rel) ? 180 : 0), /apple/.test(l.rel) ? 'Apple touch icon' : 'Site icon');
    const m = doc.querySelector('link[rel=manifest]');
    if (m) {
      const mu = new URL(m.getAttribute('href'), origin).href;
      // monochrome icons are white-on-transparent glyphs meant for themed UIs: invisible on our light tile
      for (const i of (await grab(mu, 'json')).icons ?? []) if (!/monochrome/.test(i.purpose ?? '')) add(new URL(i.src, mu).href, sizeOf(i.sizes), 'Web app manifest');
    }
  } catch { /* site blocked or offline: fall through to the guesses below */ }
  add(origin + '/apple-touch-icon.png', 180, 'Apple touch icon');
  c.sort((a, b) => b.n - a.n);
  return [...c.slice(0, 8),
    { u: `https://t2.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=${encodeURIComponent(origin)}&size=256`, label: 'Google' },
    { u: `https://icon.horse/icon/${host(url)}`, label: 'icon.horse' },
    { u: `https://www.google.com/s2/favicons?domain=${host(url)}&sz=256`, label: 'Google (classic)' },
    { u: favUrl(url, 256), label: 'Chrome' }];
}
async function findIcon(url) {
  let best = null;
  for (const { u } of await iconSources(url)) {
    try {
      const r = await toPng(await grab(u, 'blob'));
      if (!best || r.w > best.w) best = r;
      if (best.w >= 500) break;
    } catch { /* not an image or unreachable: try next */ }
  }
  return best?.data;
}

// accent colour = most saturated pixel of the icon
const colourOf = src => new Promise(res => {
  const img = new Image();
  img.onerror = () => res(null);
  img.onload = () => {
    try {
      const x = Object.assign(document.createElement('canvas'), { width: 24, height: 24 }).getContext('2d', { willReadFrequently: true });
      x.drawImage(img, 0, 0, 24, 24);
      const px = x.getImageData(0, 0, 24, 24).data;
      let best = 0, hsl = null;
      for (let i = 0; i < px.length; i += 4) {
        const [r, g, b] = [px[i] / 255, px[i + 1] / 255, px[i + 2] / 255], a = px[i + 3];
        const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, c = mx - mn;
        if (a < 128 || l < .12 || l > .92 || c < .15 || c * (a / 255) <= best) continue;
        best = c * (a / 255);
        const h = mx === r ? ((g - b) / c + 6) % 6 : mx === g ? (b - r) / c + 2 : (r - g) / c + 4;
        hsl = [Math.round(h * 60), Math.round(Math.min(90, Math.max(50, (c / (1 - Math.abs(2 * l - 1))) * 100)))];
      }
      res(hsl);
    } catch { res(null); }
  };
  img.src = src;
});

// fill a card's icon art and accent; fetches the hi-res icon once per dial (retry after a day if none found)
const inflight = new Set();
async function hydrate(d, a) {
  const apply = (h, s) => { a.style.setProperty('--h', h); a.style.setProperty('--s', s + '%'); };
  apply(d.h ?? hashHue(host(d.url)), d.s ?? 60);
  if (inflight.has(d.id)) return;
  inflight.add(d.id);
  try {
    if ((!d.img || d.v !== 4) && !(d.tried > Date.now() - 864e5)) {
      const data = await findIcon(d.url).catch(() => null);
      if (data) {
        d.img = data; d.v = 4; delete d.h; delete d.s; delete d.tried;
        a.querySelector('.plate').replaceChildren(icon(d.url, d.title, 'ico', d.img));
        a.querySelector('.art')?.remove();
        a.prepend(icon(d.url, d.title, 'art', d.img));
      } else d.tried = Date.now();
      save();
    }
    if (d.h == null) {
      const c = await colourOf(d.img || favUrl(d.url));
      d.h = c?.[0] ?? hashHue(host(d.url)); d.s = c?.[1] ?? 55;
      save();
    }
    apply(d.h, d.s);
  } finally { inflight.delete(d.id); }
}

function edgeFit() {
  let right = 0;
  for (const d of $('#grid').children) right = Math.max(right, d.getBoundingClientRect().right);
  $('#edge').style.width = Math.max(24, innerWidth - right) + 'px';
}

// fixed grid that always fits the screen: S.cols x S.rows, growing by rows when full
function layout() {
  if (!S) return;
  const c = innerWidth < 640 ? Math.min(S.cols, 2) : S.cols;
  const r = Math.ceil(Math.max(S.cols * S.rows, S.dials.length) / c);
  const g = $('#grid');
  g.style.setProperty('--c', c);
  g.style.setProperty('--r', r);
  // fill the screen by default; with 'Square dials' use the largest square that fits c x r
  let track = 'minmax(0, 1fr)';
  if (S.square) {
    const gap = parseFloat(getComputedStyle(g).columnGap) || 0;
    const cell = Math.floor(Math.min((g.clientWidth - gap * (c - 1)) / c, (g.clientHeight - gap * (r - 1)) / r));
    if (cell > 0) track = cell + 'px';
  }
  g.style.setProperty('--track', track);
  g.querySelectorAll('.ghost').forEach(x => x.remove());
  g.append(...ghosts());
  edgeFit();
}

// empty slots up to the grid's capacity, so it reads as a designed grid; click one to add a dial there
function ghosts() {
  const g = $('#grid'), free = Math.max(0, g.style.getPropertyValue('--c') * g.style.getPropertyValue('--r') - S.dials.length);
  return Array.from({ length: free }, () => {
    const b = document.createElement('button');
    b.className = 'ghost';
    b.tabIndex = -1; // the + button already covers keyboard users
    b.setAttribute('aria-label', 'Add dial');
    b.textContent = '+';
    b.onclick = () => openDial(null);
    return b;
  });
}

function render() {
  $('#grid').replaceChildren(...S.dials.map(dialEl));
  layout();
}

function dialEl(d, i) {
  const a = document.createElement('a');
  a.className = 'dial';
  a.href = d.url;
  a.draggable = true;
  a.style.setProperty('--i', i);
  a.dataset.id = d.id;
  if (justAdded.has(d.id)) { a.classList.add('pop-in'); setTimeout(() => justAdded.delete(d.id), 1200); }
  const art = icon(d.url, d.title, 'art', d.img);
  art.onerror = () => art.remove();
  const plate = document.createElement('div');
  plate.className = 'plate';
  plate.append(icon(d.url, d.title, 'ico', d.img));
  const meta = document.createElement('div');
  meta.className = 'meta';
  meta.innerHTML = '<span class="name"></span>';
  meta.firstChild.textContent = d.title;
  a.append(art, plate, meta);
  hydrate(d, a);

  a.onmousemove = e => {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const b = a.getBoundingClientRect(), x = (e.clientX - b.left) / b.width, y = (e.clientY - b.top) / b.height;
    a.style.setProperty('--rx', (.5 - y) * 6 + 'deg');
    a.style.setProperty('--ry', (x - .5) * 7 + 'deg');
    a.style.setProperty('--tx', (x - .5) * 10 + 'px');
    a.style.setProperty('--ty', (y - .5) * 10 + 'px');
    a.style.setProperty('--mx', x * 100 + '%');
    a.style.setProperty('--my', y * 100 + '%');
  };
  a.onmouseleave = () => { for (const k of ['--rx', '--ry']) a.style.setProperty(k, '0deg'); for (const k of ['--tx', '--ty']) a.style.setProperty(k, '0px'); };
  a.oncontextmenu = e => showMenu(e, d, a);
  a.ondragstart = () => { dragId = d.id; a.classList.add('drag'); };
  a.ondragend = () => a.classList.remove('drag');
  a.ondragover = e => e.preventDefault();
  a.ondrop = e => {
    e.preventDefault();
    const from = S.dials.findIndex(x => x.id === dragId), to = S.dials.findIndex(x => x.id === d.id);
    if (from < 0 || from === to) return;
    const before = new Map([...$('#grid').children].map(c => [c.dataset.id, c.getBoundingClientRect()]));
    S.dials.splice(to, 0, S.dials.splice(from, 1)[0]);
    save(); render(); flip(before);
  };
  return a;
}

// add / edit dial
const dlg = $('#dlg'), f = $('#f');
function openDial(d) {
  editing = d;
  $('#dt').textContent = d ? 'Edit dial' : 'Add dial';
  f.title.value = d?.title ?? '';
  f.url.value = d?.url ?? '';
  $('#del').hidden = !d;
  $('#iconRow').hidden = !d;
  dlg.showModal();
  f.url.focus();
}
dlg.onclose = () => {
  if (dlg.returnValue !== 'ok') return;
  const url = fixUrl(f.url.value.trim());
  const title = f.title.value.trim() || host(url);
  if (editing) {
    if (editing.url !== url && !editing.custom) for (const k of ['h', 's', 'img', 'v', 'tried']) delete editing[k];
    Object.assign(editing, { title, url });
  } else { const nd = { id: uid(), title, url }; justAdded.add(nd.id); S.dials.push(nd); }
  dlg.returnValue = '';
  save(); render();
};
$('#del').onclick = () => {
  S.dials = S.dials.filter(x => x !== editing);
  dlg.close('deleted');
  save(); render();
};
$('#refIcon').onclick = async () => {
  await askSharp();
  for (const k of ['h', 's', 'img', 'v', 'tried', 'custom']) delete editing[k];
  dlg.close('refresh');
  save(); render();
};
const pdlg = $('#pdlg');
let searchId = 0;
// high-res image search. Google Images needs the user's own API key (Programmable Search); Wikimedia Commons needs none.
async function imageSources(q) {
  const out = [], jobs = [], enc = encodeURIComponent;
  if (S.gkey && S.gcx) for (const size of ['huge', 'xlarge'])
    jobs.push(grab(`https://www.googleapis.com/customsearch/v1?key=${enc(S.gkey)}&cx=${enc(S.gcx)}&q=${enc(q + ' logo')}&searchType=image&imgSize=${size}&num=10`, 'json')
      .then(r => (r.items ?? []).forEach(i => out.push({ u: i.link, label: 'Google Images' })), () => {}));
  jobs.push(grab(`https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch=${enc(q + ' logo')}&gsrnamespace=6&gsrlimit=15&prop=imageinfo&iiprop=url%7Csize&format=json&origin=*`, 'json')
    .then(r => Object.values(r.query?.pages ?? {}).forEach(p => {
      const i = p.imageinfo?.[0];
      if (i && (i.width >= 500 || /\.svg$/i.test(i.url))) out.push({ u: i.url, label: 'Wikimedia Commons' });
    }), () => {}));
  await Promise.all(jobs);
  return out;
}

// words -> icons: Iconify's brand and icon sets, plus the icons of the most likely site (<words>.com)
async function wordSources(q) {
  const out = [];
  try {
    const r = await grab(`https://api.iconify.design/search?query=${encodeURIComponent(q)}&limit=40`, 'json');
    for (const n of r.icons ?? []) { const [p, name] = n.split(':'); out.push({ u: `https://api.iconify.design/${p}/${name}.svg`, label: `Icon set · ${p}` }); }
  } catch { /* offline or service down: other sources still run */ }
  out.push(...await imageSources(q));
  const slug = q.toLowerCase().replace(/[^a-z0-9]+/g, '');
  if (slug) {
    const guess = await iconSources(`https://${slug}.com`).catch(() => []);
    // drop the generic fallbacks at the end: they answer with a globe for sites that do not exist
    out.push(...guess.slice(0, -4).slice(0, 4).map(s => ({ ...s, label: `${slug}.com · ${s.label}` })));
  }
  return out;
}
const looksLikeDomain = q => /^[^\s]+\.[a-z]{2,}(\/\S*)?$/i.test(q);

async function searchIcons(q, url) {
  const id = ++searchId, box = $('#picks'), status = $('#pstatus'), found = [];
  box.replaceChildren();
  status.textContent = 'Searching…';
  let list;
  try {
    list = looksLikeDomain(q) ? await iconSources(fixUrl(q)) : [...(url ? await iconSources(url) : []), ...await wordSources(q)];
    list = list.filter((s, i) => list.findIndex(x => x.u === s.u) === i);
  } catch { status.textContent = 'Could not search for that.'; return; }
  await Promise.all(list.map(async s => {
    try {
      const r = await toPng(await grab(s.u, 'blob'));
      if (id !== searchId || found.some(x => x.data === r.data)) return;
      found.push({ ...r, label: s.label });
      // the site's own icons first (largest first), then generic icon sets and Commons logos
      const generic = f => /^(Icon set|Wikimedia|Google Images)/.test(f.label) ? 1 : 0;
      found.sort((x, y) => generic(x) - generic(y) || y.w - x.w);
      box.replaceChildren(...found.map(f => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'pick';
        const img = Object.assign(new Image(), { alt: '', src: f.data }), label = document.createElement('span');
        label.textContent = `${f.w >= 1024 ? 'Vector' : f.w + ' px'} · ${f.label}`;
        b.append(img, label);
        b.onclick = () => {
          for (const k of ['h', 's', 'tried']) delete editing[k];
          Object.assign(editing, { img: f.data, v: 4, custom: true });
          pdlg.close('picked');
          save(); render();
        };
        return b;
      }));
    } catch { /* source has no usable image */ }
  }));
  if (id === searchId) status.textContent = found.length ? `${found.length} icons found. Pick one.${S.gkey ? '' : ' Add a Google API key in settings to include Google Images.'}` : 'No icons found. Try other words or upload your own.';
}
$('#findIcon').onclick = async () => {
  await askSharp();
  dlg.close('pick');
  $('#pq').value = editing.title;
  pdlg.showModal();
  searchIcons(editing.title, editing.url); // the dial's own site first, then icons matching its name
};
$('#pq').onkeydown = e => {
  if (e.key !== 'Enter') return;
  e.preventDefault();
  const v = $('#pq').value.trim();
  if (v) searchIcons(v);
};
$('#upIcon').onchange = async e => {
  const file = e.target.files[0];
  e.target.value = '';
  if (!file) return;
  try {
    const { data } = await toPng(file);
    for (const k of ['h', 's', 'tried']) delete editing[k];
    Object.assign(editing, { img: data, v: 4, custom: true });
    pdlg.close('upload');
    save(); render();
  } catch { alert('Could not read that image.'); }
};
$('#addBtn').onclick = () => openDial(null);

// history sidebar
const hist = $('#hist');
let histMode = 'recent';
async function loadHist() {
  const text = $('#hq').value.trim();
  const items = histMode === 'top' && !text
    ? await chrome.topSites.get()
    : await chrome.history.search({ text, maxResults: 100, startTime: 0 });
  $('#hlist').replaceChildren(...items.map((h, i) => {
    const li = document.createElement('li');
    li.style.setProperty('--i', Math.min(i, 14));
    const a = document.createElement('a');
    a.href = h.url;
    const t = document.createElement('div');
    t.className = 't';
    t.innerHTML = '<b></b><span></span>';
    t.firstChild.textContent = h.title || host(h.url);
    t.lastChild.textContent = host(h.url);
    a.append(icon(h.url, h.title, ''), t);
    if (h.lastVisitTime) {
      const d = new Date(h.lastVisitTime), tm = document.createElement('time');
      tm.textContent = d.toDateString() === new Date().toDateString()
        ? d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        : d.toLocaleDateString([], { month: 'short', day: 'numeric' });
      a.append(tm);
    }
    li.append(a);
    return li;
  }));
}
function openHist() { if (hist.classList.contains('open')) return; hist.classList.add('open'); loadHist(); }
function closeHist() { if (!S.pinned) hist.classList.remove('open'); }
function setMode(m) {
  histMode = m;
  $('#tRecent').classList.toggle('on', m === 'recent');
  $('#tTop').classList.toggle('on', m === 'top');
  loadHist();
}
function applyPin() {
  document.body.classList.toggle('pinned', S.pinned);
  $('#pin').setAttribute('aria-pressed', S.pinned);
  $('#pin').title = S.pinned ? 'Unpin history' : 'Pin history';
  if (S.pinned) openHist();
}
$('#edge').onmouseenter = openHist;
$('#edge').onclick = openHist; // touch
$('#edge').onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openHist(); $('#hq').focus(); } };
hist.addEventListener('focusout', e => { if (!hist.contains(e.relatedTarget)) closeHist(); });
hist.onmouseleave = closeHist;
$('#pin').onclick = () => { S.pinned = !S.pinned; save(); applyPin(); };
$('#tRecent').onclick = () => setMode('recent');
$('#tTop').onclick = () => setMode('top');
$('#hq').oninput = loadHist;
addEventListener('keydown', e => { if (e.key === 'Escape' && hist.contains(document.activeElement)) $('#edge').focus(); if (e.key === 'Escape') closeHist(); });
new ResizeObserver(layout).observe($('#grid')); // also fires when the pinned sidebar shifts the stage

// settings
const sdlg = $('#sdlg');
function syncSize() {
  $('#cols').value = S.cols; $('#colsOut').textContent = S.cols;
  $('#sq').checked = !!S.square; $('#gkey').value = S.gkey ?? ''; $('#gcx').value = S.gcx ?? ''; $('#rows').value = S.rows; $('#rowsOut').textContent = S.rows;
}
$('#setBtn').onclick = () => { syncSize(); hasSharp().then(v => { $('#sharp').checked = v; }); sdlg.showModal(); };
$('#sharp').onchange = async e => {
  if (e.target.checked) $('#sharp').checked = await askSharp();
  else { await chrome.permissions.remove(SHARP); $('#sharp').checked = false; }
};
$('#cols').oninput = e => { S.cols = +e.target.value; syncSize(); save(); layout(); };
$('#rows').oninput = e => { S.rows = +e.target.value; syncSize(); save(); layout(); };
$('#gkey').onchange = e => { S.gkey = e.target.value.trim(); save(); };
$('#gcx').onchange = e => { S.gcx = e.target.value.trim(); save(); };
$('#sq').onchange = e => { S.square = e.target.checked; save(); layout(); };
$('#exp').onclick = () => {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([JSON.stringify({ ...S, gkey: undefined, gcx: undefined }, null, 2)], { type: 'application/json' }));
  a.download = 'speedy-dial-backup.json';
  a.click();
};
$('#imp').onchange = async e => {
  try {
    const data = JSON.parse(await e.target.files[0].text());
    const dials = data.dials ?? data.groups?.flatMap(g => g.dials);
    if (!Array.isArray(dials)) throw 0;
    S = { cols: 3, rows: 2, pinned: false, ...data, dials };
    delete S.groups;
    save(); render(); applyPin();
  } catch { alert('Not a valid Speedy Dial backup file.'); }
};

async function drain() {
  const { inbox = [] } = await chrome.storage.local.get('inbox');
  if (!inbox.length || !S) return;
  await chrome.storage.local.set({ inbox: [] });
  for (const { url, title } of inbox)
    if (!S.dials.some(d => d.url === url)) { const nd = { id: uid(), title: (title || '').split(/ [-|·–—] /)[0].trim() || host(url), url }; justAdded.add(nd.id); S.dials.push(nd); }
  save(); render();
}
chrome.storage.onChanged.addListener(c => c.inbox?.newValue?.length && drain());

(async function init() {
  // every script on the page must have run before the first render uses what they define (extras.js, onboarding.js)
  if (document.readyState !== 'complete') await new Promise(r => addEventListener('load', r));
  ({ S } = await chrome.storage.local.get('S'));
  if (!S) { // first run: seed from the sites you visit most, and show the welcome tour once
    const top = await chrome.topSites.get();
    const shortTitle = t => (t.title || '').split(/ [-|·–—] |: /)[0].trim() || host(t.url);
    S = { cols: 3, rows: 2, pinned: false, tour: 'pending', dials: top.slice(0, 6).map(t => ({ id: uid(), title: shortTitle(t), url: t.url })) };
    save();
  } else if (S.groups) { // migrate from the grouped version
    S = { cols: 3, rows: 2, pinned: false, dials: S.groups.flatMap(g => g.dials) };
    save();
  }
  await initExtras();
  render();
  applyPin();
  drain();
  setTimeout(() => document.body.classList.remove('boot'), 1500);
  if (S.tour === 'pending') setTimeout(startTour, 1100); // after the dials have finished arriving
})();
