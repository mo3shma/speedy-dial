async (page) => {
  // Scene: five dials and an empty slot; a site is added with the toolbar button (queued like the extension's background script does) and pops into the grid.
  const REPO = 'C:\\path\\to\\speedy-dial\\'; // set this to the folder you cloned the repository into
  const NAME = 'quickadd', FPS = 24, SECONDS = 4.6, BASE = 'http://localhost:4173/';
  const DIR = `${REPO}launch-video\\capture\\frames\\${NAME}\\`;
  await page.goto(BASE + '?fresh&five');
  await page.waitForFunction(() => typeof S !== 'undefined' && S.dials.length === 5 && S.dials.every(d => d.img && d.h != null), null, { timeout: 90000 });
  await page.waitForTimeout(800);
  const events = [{ t: 1.3, fn: async () => {
    await page.evaluate(() => __demo.quickAdd('https://stackoverflow.com', 'Stack Overflow – Where developers learn, share, & build careers'));
    // the new dial fetches its high-resolution icon over the real network; hold the footage clock until it has it
    await page.waitForFunction(() => S.dials.length === 6 && S.dials[5].img && S.dials[5].h != null, null, { timeout: 60000 });
    await page.waitForTimeout(300);
  } }];
  await page.evaluate(() => __rec.begin());
  const n = Math.round(SECONDS * FPS);
  for (let k = 0; k < n; k++) {
    const t = (k / FPS) * 1000;
    for (const e of events) if (!e.done && t / 1000 >= e.t) { e.done = true; await e.fn(); }
    await page.evaluate(ms => __rec.frame(ms), t);
    await page.screenshot({ path: DIR + 'f' + String(k).padStart(4, '0') + '.jpg', type: 'jpeg', quality: 93 });
  }
  return `${NAME}: ${n} frames`;
}
