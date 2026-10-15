async (page) => {
  // Scene: open Settings, switch Style to Material 3 and watch the page restyle live, close, then hover a dial.
  const REPO = 'C:\\path\\to\\speedy-dial\\'; // set this to the folder you cloned the repository into
  const NAME = 'styles', FPS = 24, SECONDS = 8.6, BASE = 'http://localhost:4173/';
  const DIR = `${REPO}launch-video\\capture\\frames\\${NAME}\\`;
  const where = (sel, dx = 0, dy = 0) => page.evaluate(([s, dx, dy]) => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); return [r.left + r.width / 2 + dx, r.top + r.height / 2 + dy]; }, [sel, dx, dy]);
  const resolve = async wp => (wp && wp.js ? page.evaluate(wp.js) : Array.isArray(wp) && typeof wp[0] === 'number' ? wp : typeof wp === 'string' ? where(wp) : where(...wp));
  await page.goto(BASE + '?fresh');
  await page.waitForFunction(() => typeof S !== 'undefined' && S.dials.length && S.dials.every(d => d.img && d.h != null), null, { timeout: 90000 });
  await page.waitForTimeout(800);
  const M3 = 'input[name=style][value=m3] + span';
  const path = [[0, [1000, 620]], [0.7, [1000, 620]], [1.5, ['#setBtn']], [2.0, ['#setBtn']], [2.9, [M3]], [3.3, [M3]], [4.6, ['#seed']], [5.6, ['#seed']],
    [6.4, ['.sfoot .btn']], [6.7, ['.sfoot .btn']], [7.5, ['.dial:nth-child(2)', 20, 30]], [8.6, ['.dial:nth-child(2)', 60, 70]]];
  const click = async () => { await page.mouse.down(); await page.mouse.up(); };
  const events = [{ t: 2.1, fn: click }, { t: 3.4, fn: click }, { t: 6.75, fn: click }];
  const pts = [];
  const at = async (t) => {
    let i = path.findIndex(p => t <= p[0]); if (i < 0) i = path.length - 1; if (i === 0) i = 1;
    const a = pts[i - 1] || pts[i], b = pts[i] || a, t0 = path[i - 1][0], t1 = path[i][0], u = Math.min(1, Math.max(0, (t - t0) / (t1 - t0))), s = u * u * (3 - 2 * u);
    return [a[0] + (b[0] - a[0]) * s, a[1] + (b[1] - a[1]) * s];
  };
  await page.mouse.move(...(await resolve(path[0][1])));
  await page.evaluate(() => __rec.begin());
  const n = Math.round(SECONDS * FPS);
  for (let k = 0; k < n; k++) {
    const t = (k / FPS) * 1000;
    for (const e of events) if (!e.done && t / 1000 >= e.t) { e.done = true; await e.fn(); }
    for (let i = 0; i < path.length; i++) if (pts[i] == null && t / 1000 >= (path[i - 1]?.[0] ?? 0)) pts[i] = await resolve(path[i][1]);
    await page.mouse.move(...(await at(t / 1000)));
    await page.evaluate(ms => __rec.frame(ms), t);
    await page.screenshot({ path: DIR + 'f' + String(k).padStart(4, '0') + '.jpg', type: 'jpeg', quality: 93 });
  }
  return `${NAME}: ${n} frames`;
}
