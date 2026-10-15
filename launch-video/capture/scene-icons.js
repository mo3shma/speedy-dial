async (page) => {
  // Scene: right-click a dial, Change icon, the search results arrive, scroll to a colour brand logo and pick it.
  const REPO = 'C:\\path\\to\\speedy-dial\\'; // set this to the folder you cloned the repository into
  const NAME = 'icons', FPS = 24, SECONDS = 9.0, BASE = 'http://localhost:4173/';
  const DIR = `${REPO}launch-video\\capture\\frames\\${NAME}\\`;
  const where = (sel, dx = 0, dy = 0) => page.evaluate(([s, dx, dy]) => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); return [r.left + r.width / 2 + dx, r.top + r.height / 2 + dy]; }, [sel, dx, dy]);
  const LOGO_TILE = () => { const all = [...document.querySelectorAll('#picks .pick')].filter(p => /Icon set · logos/.test(p.textContent)); const el = all[1] || all[0] || document.querySelector('#picks .pick:nth-child(5)'); const r = el.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; };
  const resolve = async wp => (wp && wp.js ? page.evaluate(wp.js) : Array.isArray(wp) && typeof wp[0] === 'number' ? wp : typeof wp === 'string' ? where(wp) : where(...wp));
  await page.goto(BASE + '?fresh');
  await page.waitForFunction(() => typeof S !== 'undefined' && S.dials.length && S.dials.every(d => d.img && d.h != null), null, { timeout: 90000 });
  await page.waitForTimeout(800);
  const path = [[0, [900, 480]], [0.8, [900, 480]], [1.9, ['.dial:nth-child(5)', 30, -30]], [2.6, ['.dial:nth-child(5)', 30, -30]], [3.5, ['.cmenu button:nth-child(2)']], [3.9, ['.cmenu button:nth-child(2)']],
    [4.6, ['#picks', 0, -40]], [6.0, ['#picks', 0, -40]],
    [6.6,{ js: `(${LOGO_TILE.toString()})()` }], [7.2, { js: `(${LOGO_TILE.toString()})()` }], [9.0, [1500, 700]]];
  let clockHeld = 0;
  const events = [
    { t: 2.3, fn: async () => { await page.mouse.down({ button: 'right' }); await page.mouse.up({ button: 'right' }); } },
    { t: 3.7, fn: async () => {
      await page.mouse.down(); await page.mouse.up();
      // the picker searches the real network; hold the footage clock until the results are in
      const t0 = Date.now();
      await page.waitForFunction(() => document.querySelectorAll('#picks .pick').length >= 40 && /icons found/.test(document.querySelector('#pstatus').textContent), null, { timeout: 60000 });
      clockHeld = Date.now() - t0;
    } },
    { t: 7.0, fn: async () => { await page.mouse.down(); await page.mouse.up(); await page.waitForFunction(() => S.dials[4].custom === true, null, { timeout: 10000 }); await page.waitForTimeout(1500); } },
  ];
  const pts = [];
  const at = async (t) => {
    let i = path.findIndex(p => t <= p[0]); if (i < 0) i = path.length - 1; if (i === 0) i = 1;
    const a = pts[i - 1] || pts[i], b = pts[i] || a, t0 = path[i - 1][0], t1 = path[i][0], u = Math.min(1, Math.max(0, (t - t0) / (t1 - t0))), s = u * u * (3 - 2 * u);
    return [a[0] + (b[0] - a[0]) * s, a[1] + (b[1] - a[1]) * s];
  };
  // from 4.4 s to 6.0 s the result list scrolls smoothly to the colour logos
  let scrollTarget = null;
  const scrollHook = async (t) => {
    if (t < 4.4 || t > 6.0) return;
    if (scrollTarget == null) scrollTarget = await page.evaluate(() => { const box = document.querySelector('#picks'), el = [...box.querySelectorAll('.pick')].find(p => /Icon set · logos/.test(p.textContent)); return el ? Math.max(0, el.offsetTop - box.offsetTop - 20) : 0; });
    const u = Math.min(1, (t - 4.4) / 1.6), s = u * u * (3 - 2 * u);
    await page.evaluate(y => { document.querySelector('#picks').scrollTop = y; }, scrollTarget * s);
  };
  await page.mouse.move(...(await resolve(path[0][1])));
  await page.evaluate(() => __rec.begin());
  const n = Math.round(SECONDS * FPS);
  for (let k = 0; k < n; k++) {
    const t = (k / FPS) * 1000;
    for (const e of events) if (!e.done && t / 1000 >= e.t) { e.done = true; await e.fn(); }
    for (let i = 0; i < path.length; i++) if (pts[i] == null && t / 1000 >= (path[i - 1]?.[0] ?? 0)) pts[i] = await resolve(path[i][1]);
    await scrollHook(t / 1000);
    await page.mouse.move(...(await at(t / 1000)));
    await page.evaluate(ms => __rec.frame(ms), t);
    await page.screenshot({ path: DIR + 'f' + String(k).padStart(4, '0') + '.jpg', type: 'jpeg', quality: 93 });
  }
  return `${NAME}: ${n} frames (network wait ${clockHeld} ms)`;
}
