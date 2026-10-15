async (page) => {
  // Takes the README screenshots from the real extension (see capture/server.js). Output: docs/screenshots/*.jpg
  const REPO = 'C:\\path\\to\\speedy-dial\\'; // set this to the folder you cloned the repository into
  const BASE = 'http://localhost:4173/', DIR = REPO + 'docs\\screenshots\\';
  await page.setViewportSize({ width: 1920, height: 1080 });
  const ready = () => page.waitForFunction(() => typeof S !== 'undefined' && S.dials.length && S.dials.every(d => d.img && d.h != null), null, { timeout: 90000 });
  const load = async q => { await page.goto(BASE + q); await ready(); await page.waitForTimeout(2200); };
  const shot = n => page.screenshot({ path: DIR + n + '.jpg', type: 'jpeg', quality: 90 });
  const center = sel => page.evaluate(s => { const r = document.querySelector(s).getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; }, sel);
  const done = [];

  await load('?fresh');                                                         // 1: the grid, one card hovered
  let [x, y] = await center('.dial:nth-child(5)');
  await page.mouse.move(x - 120, y + 160); await page.mouse.move(x + 40, y + 50, { steps: 8 }); await page.waitForTimeout(900);
  await shot('01-dial-grid'); done.push('grid');

  await load('?fresh');                                                         // 2: history sidebar
  await page.mouse.move(1000, 560); await page.mouse.move(1908, 560, { steps: 10 }); await page.waitForTimeout(1800);
  await shot('02-history'); done.push('history');

  await load('?fresh&widgets');                                                 // 3: widgets sidebar with a to-do typed
  await page.mouse.move(1000, 560); await page.mouse.move(6, 520, { steps: 10 }); await page.waitForTimeout(1600);
  await page.click('.wcard input[aria-label="New task"]'); await page.keyboard.type('Book flights', { delay: 30 }); await page.keyboard.press('Enter');
  await page.mouse.move(900, 800, { steps: 6 }); await page.waitForTimeout(500);
  await shot('03-widgets'); done.push('widgets');

  await load('?fresh');                                                         // 4: the icon picker
  [x, y] = await center('.dial:nth-child(5)');
  await page.mouse.click(x, y, { button: 'right' }); await page.waitForTimeout(500);
  await page.click('.cmenu button:nth-child(2)');
  await page.waitForFunction(() => document.querySelectorAll('#picks .pick').length >= 30 && /icons found/.test(document.querySelector('#pstatus').textContent), null, { timeout: 60000 });
  await page.waitForTimeout(1500);
  await shot('04-find-icon'); done.push('icons');

  await load('?fresh&m3');                                                      // 5: Material 3 Expressive
  [x, y] = await center('.dial:nth-child(2)');
  await page.mouse.move(x - 100, y + 150); await page.mouse.move(x + 30, y + 40, { steps: 8 }); await page.waitForTimeout(1000);
  await shot('05-material-3'); done.push('m3');

  await load('?fresh&dark');                                                    // 6: dark theme
  await page.mouse.move(1300, 900); await page.waitForTimeout(600);
  await shot('06-dark'); done.push('dark');

  await load('?fresh');                                                         // 7: settings
  await page.click('#setBtn'); await page.waitForTimeout(1300);
  await shot('07-settings'); done.push('settings');

  await page.goto(BASE + '?install');                                           // 8: the welcome tour
  await page.waitForSelector('#tour[open]', { timeout: 60000 });
  await page.waitForTimeout(1500);
  await page.click('.tour-next'); await page.waitForTimeout(1500);
  await shot('08-welcome-tour'); done.push('tour');
  return done.join(', ');
}
