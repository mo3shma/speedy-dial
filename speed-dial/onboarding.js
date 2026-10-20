// First-run welcome tour: spotlights the real interface, one feature at a time, and ends with a link to the creator on X.
// Runs once on a fresh install (app.js sets S.tour = 'pending'); Settings > Support the creator can replay it.
// Shares globals with app.js and extras.js: S, save, openHist, closeHist, applyStyle, renderWidgets, openW, closeW.
const TOUR = $('#tour');
const X_URL = 'https://x.com/3shmaaa';
const X_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>';

const asRect = (left, top, width, height) => ({ left, top, width, height, right: left + width, bottom: top + height });
const rectOf = el => { const r = el?.getBoundingClientRect(); return r && r.width ? asRect(r.left, r.top, r.width, r.height) : null; };
const make = (tag, cls, html = '') => Object.assign(document.createElement(tag), { className: cls, innerHTML: html });

let tourAt = 0, tourHole, tourCard, widgetsOn = false;

const STEPS = [
  { title: 'Welcome to Speedy Dial', logo: true, next: 'Start the tour',
    body: 'Your new tab, at full speed. A quick tour shows what is inside. It takes about half a minute.' },
  { title: 'Your dials',
    body: 'Click a dial to open the site. Drag to reorder, or right-click for Edit, Change icon and Delete. The grid always fits your screen, with no scrolling.',
    rect: () => rectOf(document.querySelector('.dial') || $('#addBtn')) },
  { title: 'History, one hover away',
    body: 'Move your pointer to the right edge of the screen and your history slides in. Pin it there to keep it open.',
    enter: () => openHist(), leave: () => closeHist(),
    rect: () => { const w = $('#hist').offsetWidth; return asRect(innerWidth - w, 0, w, innerHeight); } },
  { title: 'Widgets, only if you want them',
    get body() { return widgetsOn ? 'They are on. Move to the left edge any time to open them, and turn each one on or off in Settings.' : 'A clock, calendar, notes and a to-do list live in a sidebar on the left edge. They are off until you want them.'; },
    enter: () => { if (widgetsOn) openW(); }, leave: () => closeW(),
    rect: () => (widgetsOn ? asRect(0, 0, $('#wside').offsetWidth, innerHeight) : rectOf($('#setBtn'))),
    extra(box) {
      const b = make('button', 'btn', widgetsOn ? 'Widgets are on' : 'Turn on clock, calendar and to-do');
      b.type = 'button'; b.disabled = widgetsOn;
      b.onclick = () => { widgetsOn = true; S.widgets = { ...S.widgets, clock: true, calendar: true, todo: true }; save(); renderWidgets(); openW(); showStep(tourAt); };
      box.append(b);
    } },
  { title: 'Pick your look', bottom: true,
    body: 'Speedy Dial has two styles. Try them: the page changes live. You can switch any time in Settings.',
    rect: () => rectOf($('#grid')),
    extra(box) {
      const row = make('div', 'tour-choices'), current = () => (S.style === 'm3' ? 'm3' : 'glass');
      [['glass', 'Liquid glass', 'Frosted, light and airy'], ['m3', 'Material 3', 'Bold shapes, springy motion']].forEach(([v, name, hint]) => {
        const b = make('button', 'tour-choice', `<strong>${name}</strong><span>${hint}</span>`);
        b.type = 'button'; b.dataset.v = v; b.setAttribute('aria-pressed', current() === v);
        b.onclick = () => { S.style = v; save(); applyStyle(); row.querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', current() === x.dataset.v)); };
        row.append(b);
      });
      box.append(row);
    } },
  { title: 'Sharp icons', bottom: true,
    body: 'To fetch full-size icons from the sites you add, Chrome needs your OK. Speedy Dial uses it only for icons and never reads the pages you visit. Without it you get Chrome\'s small favicons. Change this any time in Settings.',
    rect: () => rectOf($('#grid')),
    extra(box) {
      const b = make('button', 'btn', 'Allow sharp icons');
      b.type = 'button';
      hasSharp().then(v => { if (v) { b.textContent = 'Sharp icons are on'; b.disabled = true; } });
      b.onclick = async () => { if (await askSharp()) { b.textContent = 'Sharp icons are on'; b.disabled = true; } };
      box.append(b);
    } },
  { title: 'Add any site',
    body: 'Use the + button, or add the page you are on with the toolbar button, Alt+Shift+D, or by right-clicking a page or link. Tip: pin Speedy Dial from Chrome\'s puzzle-piece menu to keep the button handy. Choose Folder to group sites together.',
    rect: () => rectOf($('#addBtn')) },
  { title: 'You are all set', logo: true, next: 'Get started', last: true,
    body: 'Speedy Dial is made by one person. If it makes your tabs better, follow @3shmaaa on X for updates and new features.',
    extra(box) { const a = make('a', 'btn primary xbtn', `${X_ICON} Follow @3shmaaa on X`); a.href = X_URL; a.target = '_blank'; a.rel = 'noopener noreferrer'; box.append(a); } },
];

function moveHole(s) {
  const r = s.rect?.();
  tourHole.classList.toggle('none', !r);
  if (!r) { Object.assign(tourHole.style, { left: innerWidth / 2 + 'px', top: innerHeight / 2 + 'px', width: '0px', height: '0px' }); return; }
  const pad = 10;
  Object.assign(tourHole.style, { left: r.left - pad + 'px', top: r.top - pad + 'px', width: r.width + pad * 2 + 'px', height: r.height + pad * 2 + 'px' });
}

// put the card beside the spotlight where there is room: right, left, below, above; else centred at the bottom
function placeCard(s) {
  const r = s.rect?.(), cw = tourCard.offsetWidth, ch = tourCard.offsetHeight, m = 24, g = 34;
  let x = (innerWidth - cw) / 2, y = (innerHeight - ch) / 2;
  if (r) {
    const spots = s.bottom ? [[x, innerHeight - ch - m]] : [
      [r.right + g, r.top + r.height / 2 - ch / 2], [r.left - cw - g, r.top + r.height / 2 - ch / 2],
      [r.left + r.width / 2 - cw / 2, r.bottom + g], [r.left + r.width / 2 - cw / 2, r.top - ch - g]];
    [x, y] = spots.find(([sx, sy]) => sx >= m && sy >= m && sx + cw <= innerWidth - m && sy + ch <= innerHeight - m) || [x, innerHeight - ch - m];
  }
  tourCard.style.transform = `translate(${Math.round(Math.max(m, Math.min(x, innerWidth - cw - m)))}px, ${Math.round(Math.max(m, Math.min(y, innerHeight - ch - m)))}px)`;
}

function showStep(i, leaving = true) {
  if (leaving) STEPS[tourAt]?.leave?.();
  tourAt = i;
  const s = STEPS[i];
  s.enter?.();
  tourCard.innerHTML = `
    <div class="tour-top"><span>${i + 1} of ${STEPS.length}</span>${s.last ? '' : '<button type="button" class="tour-skip">Skip tour</button>'}</div>
    ${s.logo ? '<img class="tour-logo" src="icons/icon128.png" alt="">' : ''}
    <h2 id="tour-title"></h2><p class="tour-body"></p><div class="tour-extra"></div>
    <div class="tour-foot"><div class="tour-dots" aria-hidden="true">${STEPS.map((_, k) => `<i class="${k === i ? 'on' : ''}"></i>`).join('')}</div>
      <div class="pair">${i ? '<button type="button" class="btn tour-back">Back</button>' : ''}<button type="button" class="btn primary tour-next"></button></div></div>`;
  tourCard.querySelector('h2').textContent = s.title;
  tourCard.querySelector('.tour-body').textContent = s.body;
  tourCard.querySelector('.tour-next').textContent = s.next || 'Next';
  const extra = tourCard.querySelector('.tour-extra');
  if (s.extra) s.extra(extra); else extra.remove();
  tourCard.querySelector('.tour-next').onclick = () => (i === STEPS.length - 1 ? finishTour() : showStep(i + 1));
  tourCard.querySelector('.tour-back')?.addEventListener('click', () => showStep(i - 1));
  tourCard.querySelector('.tour-skip')?.addEventListener('click', finishTour);
  moveHole(s);
  requestAnimationFrame(() => { placeCard(s); tourCard.querySelector('.tour-next').focus({ preventScroll: true }); });
}

function finishTour() {
  STEPS[tourAt]?.leave?.();
  S.tour = 'done';
  save();
  TOUR.close();
}

function startTour() {
  if (TOUR.open) return;
  widgetsOn = false;
  tourHole = make('div', 'tour-hole none');
  tourCard = make('section', 'tour-card');
  TOUR.replaceChildren(tourHole, tourCard);
  TOUR.showModal();
  tourAt = 0;
  Object.assign(tourHole.style, { left: innerWidth / 2 + 'px', top: innerHeight / 2 + 'px', width: '0px', height: '0px' });
  showStep(0, false);
}

TOUR.addEventListener('cancel', e => { e.preventDefault(); finishTour(); }); // Esc skips the tour
TOUR.addEventListener('keydown', e => {
  if (e.key === 'ArrowRight' && tourAt < STEPS.length - 1) showStep(tourAt + 1);
  if (e.key === 'ArrowLeft' && tourAt > 0) showStep(tourAt - 1);
});
addEventListener('resize', () => { if (TOUR.open) { moveHole(STEPS[tourAt]); placeCard(STEPS[tourAt]); } });
$('#replayTour').onclick = () => { $('#sdlg').close(); startTour(); };
