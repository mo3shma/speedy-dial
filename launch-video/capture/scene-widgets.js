async (page) => {
  // Scene: the cursor reaches the left edge, the widgets sidebar slides in, a to-do is typed and ticked off.
  const REPO = 'C:\\path\\to\\speedy-dial\\'; // set this to the folder you cloned the repository into
  const NAME = 'widgets', FPS = 24, SECONDS = 8.0, BASE = 'http://localhost:4173/';
  const DIR = `${REPO}launch-video\\capture\\frames\\${NAME}\\`;
  const where = (sel, dx = 0, dy = 0) => page.evaluate(([s, dx, dy]) => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); return [r.left + r.width / 2 + dx, r.top + r.height / 2 + dy]; }, [sel, dx, dy]);
  const resolve = async wp => Array.isArray(wp) && typeof wp[0] === 'number' ? wp : typeof wp === 'string' ? where(wp) : where(...wp);
  await page.goto(BASE + '?fresh&widgets');
  await page.waitForFunction(() => typeof S !== 'undefined' && S.dials.length && S.dials.every(d => d.img && d.h != null), null, { timeout: 90000 });
  await page.waitForTimeout(800);
  const INPUT = '.wcard input[aria-label="New task"]';
  const path = [[0, [980, 560]], [0.8, [980, 560]], [1.9, [6, 520]], [3.0, [6, 520]], [3.9, [INPUT, -40, 0]], [4.6, [INPUT, -40, 0]],
    [6.4, ['.wtl li:nth-child(3) input']], [6.9, ['.wtl li:nth-child(3) input']], [8.0, [1000, 700]]];
  const events = [{ t: 4.1, fn: () => page.mouse.down() }, { t: 4.2, fn: () => page.mouse.up() }];
  [...'Book flights'].forEach((ch, i) => events.push({ t: 4.7 + i * 0.085, fn: () => page.keyboard.type(ch) }));
  events.push({ t: 5.9, fn: () => page.keyboard.press('Enter') });
  events.push({ t: 6.75, fn: () => page.mouse.down() }, { t: 6.85, fn: () => page.mouse.up() });
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
