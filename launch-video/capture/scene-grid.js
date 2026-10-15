async (page) => {
  // Scene: the dial grid loads in, then the cursor rests on a card (tilt, glare and icon lift).
  const REPO = 'C:\\path\\to\\speedy-dial\\'; // set this to the folder you cloned the repository into
  const NAME = 'grid', FPS = 24, SECONDS = 6.2, BASE = 'http://localhost:4173/';
  const DIR = `${REPO}launch-video\\capture\\frames\\${NAME}\\`;
  await page.goto(BASE + '?fresh');
  await page.waitForFunction(() => typeof S !== 'undefined' && S.dials.length && S.dials.every(d => d.img && d.h != null), null, { timeout: 90000 });
  await page.waitForTimeout(600);
  // [time s, x, y]: the cursor path, eased between points
  const path = [[0, 1700, 1010], [1.7, 1700, 1010], [2.9, 980, 780], [3.6, 940, 760], [4.4, 1030, 830], [5.0, 1030, 830], [6.2, 400, 330]];
  const at = (t) => {
    if (t <= path[0][0]) return path[0].slice(1);
    for (let i = 1; i < path.length; i++) if (t <= path[i][0]) {
      const [t0, x0, y0] = path[i - 1], [t1, x1, y1] = path[i], u = (t - t0) / (t1 - t0), s = u * u * (3 - 2 * u);
      return [x0 + (x1 - x0) * s, y0 + (y1 - y0) * s];
    }
    return path[path.length - 1].slice(1);
  };
  await page.mouse.move(...at(0));
  await page.evaluate(() => { __rec.begin(); document.body.classList.add('boot'); });
  const n = Math.round(SECONDS * FPS);
  for (let k = 0; k < n; k++) {
    const t = (k / FPS) * 1000;
    await page.mouse.move(...at(t / 1000));
    await page.evaluate(ms => __rec.frame(ms), t);
    await page.screenshot({ path: DIR + 'f' + String(k).padStart(4, '0') + '.jpg', type: 'jpeg', quality: 93 });
  }
  return `${NAME}: ${n} frames`;
}
