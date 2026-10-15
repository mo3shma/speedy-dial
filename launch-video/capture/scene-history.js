async (page) => {
  // Scene: the cursor reaches the right edge, the history sidebar slides in, a row is hovered, then the pin is clicked.
  const REPO = 'C:\\path\\to\\speedy-dial\\'; // set this to the folder you cloned the repository into
  const NAME = 'history', FPS = 24, SECONDS = 7.4, BASE = 'http://localhost:4173/';
  const DIR = `${REPO}launch-video\\capture\\frames\\${NAME}\\`;
  const where = (sel, dx = 0, dy = 0) => page.evaluate(([s, dx, dy]) => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); return [r.left + r.width / 2 + dx, r.top + r.height / 2 + dy]; }, [sel, dx, dy]);
  const resolve = async wp => Array.isArray(wp) && typeof wp[0] === 'number' ? wp : typeof wp === 'string' ? where(wp) : where(...wp);
  await page.goto(BASE + '?fresh');
  await page.waitForFunction(() => typeof S !== 'undefined' && S.dials.length && S.dials.every(d => d.img && d.h != null), null, { timeout: 90000 });
  await page.waitForTimeout(800);
  // [time s, target]: target is [x,y], a selector, or [selector, dx, dy]; the cursor eases between targets
  const path = [[0, [900, 520]], [0.9, [900, 520]], [2.0, [1908, 560]], [3.4, [1908, 560]], [4.0, ['.hlist li:nth-child(4) a', -40, 0]], [5.0, ['.hlist li:nth-child(4) a', -40, 0]],
    [5.7, ['#pin']], [6.2, ['#pin']], [7.4, [1000, 600]]];
  const events = [
    { t: 6.0, fn: () => page.mouse.down() }, { t: 6.1, fn: () => page.mouse.up() },
  ];
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
    // targets inside the drawer exist only once it is open, so resolve them when the segment starts
    for (let i = 0; i < path.length; i++) if (pts[i] == null && t / 1000 >= (path[i - 1]?.[0] ?? 0)) pts[i] = await resolve(path[i][1]);
    await page.mouse.move(...(await at(t / 1000)));
    await page.evaluate(ms => __rec.frame(ms), t);
    await page.screenshot({ path: DIR + 'f' + String(k).padStart(4, '0') + '.jpg', type: 'jpeg', quality: 93 });
  }
  return `${NAME}: ${n} frames`;
}
