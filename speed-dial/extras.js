// Optional extras on top of app.js (shares its globals: S, render, openDial, editing, pdlg, searchIcons, save).
// Theme, background, the widgets sidebar, the dial context menu and the drag animation.

const el = (tag, cls, html = '') => Object.assign(document.createElement(tag), { className: cls, innerHTML: html });
const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
let W = { notes: '', todos: [] };   // widget data lives apart from S so typing never rewrites the dial icons
const saveW = () => chrome.storage.local.set({ W });

// ---- style: liquid glass or Material 3 Expressive (its palette is built from one seed colour) ----
function hueOf(hex) {
  const n = parseInt(hex.slice(1), 16), r = (n >> 16) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
  const mx = Math.max(r, g, b), c = mx - Math.min(r, g, b);
  if (!c) return 170;
  return Math.round(60 * (mx === r ? ((g - b) / c + 6) % 6 : mx === g ? (b - r) / c + 2 : (r - g) / c + 4));
}
function applyStyle() {
  document.documentElement.dataset.style = S.style === 'm3' ? 'm3' : 'glass';
  document.documentElement.style.setProperty('--sh', hueOf(S.seed || '#0a8f7e'));
  $('#seedRow').hidden = S.style !== 'm3';
}

// ---- theme and background ----
const applyTheme = () => { document.documentElement.dataset.theme = S.theme || 'auto'; };
async function applyBg() {
  const a = $('#ambient'), { BG } = await chrome.storage.local.get('BG');
  const photo = S.bg === 'photo' && BG;
  a.dataset.bg = S.bg || 'mist';
  a.classList.toggle('photo', !!photo);
  a.style.backgroundImage = photo ? `url(${BG})` : '';
}

// ---- widgets sidebar (left edge) ----
const wd = $('#wside'), we = $('#wedge');
const GREETING = h => (h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening');
function tick() {
  const d = new Date();
  document.querySelectorAll('.wtime').forEach(t => { t.textContent = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); });
  document.querySelectorAll('.wdate').forEach(t => { t.textContent = `${GREETING(d.getHours())} · ${d.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })}`; });
}
setInterval(tick, 10000);

const BUILD = {
  clock: () => el('section', 'wcard', '<div class="wtime"></div><div class="wdate"></div>'),
  calendar: () => {
    const d = new Date(), first = new Date(d.getFullYear(), d.getMonth(), 1).getDay(), days = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    return el('section', 'wcard', `<h3>${d.toLocaleDateString([], { month: 'long', year: 'numeric' })}</h3><div class="cal">${
      ['S', 'M', 'T', 'W', 'T', 'F', 'S'].map(x => `<b>${x}</b>`).join('')}${'<i></i>'.repeat(first)}${
      Array.from({ length: days }, (_, i) => `<span class="${i + 1 === d.getDate() ? 'today' : ''}">${i + 1}</span>`).join('')}</div>`);
  },
  notes: () => {
    const s = el('section', 'wcard', '<h3>Notes</h3><textarea aria-label="Notes" placeholder="Jot something down"></textarea>');
    const t = s.querySelector('textarea');
    let timer;
    t.value = W.notes;
    t.oninput = () => { clearTimeout(timer); timer = setTimeout(() => { W.notes = t.value; saveW(); }, 400); };
    return s;
  },
  todo: () => {
    const s = el('section', 'wcard', '<h3>To-do</h3><form><input aria-label="New task" placeholder="Add a task" autocomplete="off"></form><ul class="wtl"></ul>');
    const ul = s.querySelector('ul');
    const draw = () => ul.replaceChildren(...W.todos.map((t, i) => {
      const li = el('li', t.done ? 'done' : '', '<label><input type="checkbox"><span></span></label><button type="button" aria-label="Remove task">×</button>');
      const cb = li.querySelector('input');
      cb.checked = t.done;
      li.querySelector('span').textContent = t.t;
      cb.onchange = () => { t.done = cb.checked; saveW(); draw(); };
      li.querySelector('button').onclick = () => { W.todos.splice(i, 1); saveW(); draw(); };
      return li;
    }));
    s.querySelector('form').onsubmit = e => {
      e.preventDefault();
      const inp = e.target.firstElementChild, v = inp.value.trim();
      if (!v) return;
      W.todos.push({ t: v, done: false });
      inp.value = '';
      saveW(); draw();
    };
    draw();
    return s;
  },
};

function renderWidgets() {
  const on = Object.keys(BUILD).filter(k => S.widgets?.[k]);
  we.hidden = wd.hidden = !on.length;
  if (!on.length) { wd.classList.remove('open'); document.body.classList.remove('wpinned'); return; }
  const head = el('div', 'drawer-head', '<strong>Widgets</strong><button type="button" id="wpin" class="orb sm" aria-label="Pin widgets" title="Pin widgets" aria-pressed="false"><svg viewBox="0 0 24 24"><path d="M9 3h6l-1 6 3 3v2H7v-2l3-3-1-6zM12 14v7"/></svg></button>');
  wd.replaceChildren(head, el('div', 'wbody'));
  wd.lastChild.append(...on.map(k => BUILD[k]()));
  $('#wpin').onclick = () => { S.wpinned = !S.wpinned; save(); applyWPin(); };
  applyWPin();
  tick();
}
function applyWPin() {
  const pinned = !!S.wpinned && !we.hidden;
  document.body.classList.toggle('wpinned', pinned);
  const p = $('#wpin');
  if (p) { p.setAttribute('aria-pressed', pinned); p.title = pinned ? 'Unpin widgets' : 'Pin widgets'; }
  if (pinned) wd.classList.add('open');
}
const openW = () => wd.classList.add('open');
const closeW = () => { if (!S.wpinned) wd.classList.remove('open'); };
we.onmouseenter = we.onclick = openW;
we.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openW(); wd.querySelector('input,textarea,button')?.focus(); } };
wd.onmouseleave = closeW;
wd.addEventListener('focusout', e => { if (!wd.contains(e.relatedTarget)) closeW(); });
addEventListener('keydown', e => { if (e.key === 'Escape') closeW(); });

// ---- right-click menu ----
let menu;
const closeMenu = () => { menu?.remove(); menu = null; };
function showMenu(e, d, card, box) {
  e.preventDefault();
  closeMenu();
  menu = el('div', 'cmenu');
  menu.setAttribute('role', 'menu');
  menu.popover = 'manual'; // top layer, so it also shows above a modal folder popup
  const item = (label, fn, cls = '') => {
    const b = el('button', cls);
    b.type = 'button';
    b.setAttribute('role', 'menuitem');
    b.textContent = label;
    b.onclick = () => { closeMenu(); fn(); };
    menu.append(b);
  };
  if (isFolder(d)) {
    item('Rename', () => openFolder(d, true));
    item('Ungroup', () => { S.dials.splice(S.dials.indexOf(d), 1, ...d.dials); save(); render(); });
    item('Delete folder', () => { if (confirm(`Delete "${d.title}" and its ${d.dials.length} dials?`)) { drop(d); save(); render(); } }, 'danger');
  } else {
    item('Edit', () => openDial(d, box));
    item('Change icon', () => { editing = d; $('#pq').value = d.title; pdlg.showModal(); searchIcons(d.title, d.url); });
    item('Refresh icon', () => { for (const k of ['h', 's', 'img', 'v', 'tried', 'custom']) delete d[k]; save(); render(); });
    if (!box) for (const f of S.dials.filter(isFolder).slice(0, 6)) item(`Move to ${f.title}`, () => moveInto(d, f));
    if (box) item('Move out of folder', () => { drop(d); S.dials.push(d); save(); render(); });
    item('Delete', () => { if (confirm(`Delete "${d.title}"?`)) { drop(d); save(); render(); } }, 'danger');
  }
  (box ? fdlg : document.body).append(menu); // inside the modal, or it would be inert
  menu.showPopover();
  const r = card.getBoundingClientRect(), x = e.clientX || r.left + 24, y = e.clientY || r.top + 24; // keyboard Menu key reports 0,0
  menu.style.left = Math.max(8, Math.min(x, innerWidth - menu.offsetWidth - 8)) + 'px';
  menu.style.top = Math.max(8, Math.min(y, innerHeight - menu.offsetHeight - 8)) + 'px';
  menu.firstChild.focus();
}
document.addEventListener('pointerdown', e => { if (menu && !menu.contains(e.target)) closeMenu(); });
addEventListener('blur', closeMenu);
document.addEventListener('keydown', e => {
  if (!menu) return;
  const items = [...menu.children], i = items.indexOf(document.activeElement);
  if (e.key === 'Escape') { e.preventDefault(); closeMenu(); } // not the folder popup too
  else if (e.key === 'ArrowDown') { e.preventDefault(); items[(i + 1) % items.length].focus(); }
  else if (e.key === 'ArrowUp') { e.preventDefault(); items[(i - 1 + items.length) % items.length].focus(); }
});

// ---- drag: the other dials slide into place (FLIP) ----
function flip(before, root = $('#grid')) {
  if (reduced() || document.documentElement.dataset.lite) return;
  for (const card of root.children) {
    const o = before.get(card.dataset.id);
    if (!o) continue;
    const n = card.getBoundingClientRect(), dx = o.left - n.left, dy = o.top - n.top;
    if (dx || dy) card.animate([{ translate: `${dx}px ${dy}px` }, { translate: '0 0' }], { duration: 380, easing: 'cubic-bezier(.2,.8,.2,1)' });
  }
}

// ---- settings controls for the extras ----
// radio groups (segmented controls and swatches): returns a function that shows the current value
function bindRadios(name, get, set) {
  const all = () => document.querySelectorAll(`input[name=${name}]`);
  all().forEach(r => { r.onchange = () => { if (r.checked) set(r.value); }; });
  return () => { const v = get(); all().forEach(r => { r.checked = r.value === v; }); };
}
const radios = [
  bindRadios('style', () => (S.style === 'm3' ? 'm3' : 'glass'), v => { S.style = v; save(); applyStyle(); }),
  bindRadios('theme', () => S.theme || 'auto', v => { S.theme = v; save(); applyTheme(); }),
  bindRadios('bg', () => S.bg || 'mist', v => { S.bg = v; save(); applyBg(); }),
  bindRadios('perf', () => S.perf || 'auto', v => { S.perf = v; save(); applyPerf(); }), // applyPerf: perf.js
];

// small picture of the grid in settings: filled tiles are dials, faint ones are empty slots
function drawPreview() {
  const c = S.cols, r = Math.max(S.rows, Math.ceil(S.dials.length / c)), p = $('#gprev');
  p.style.gridTemplateColumns = `repeat(${c}, 1fr)`;
  p.style.gridTemplateRows = `repeat(${r}, 1fr)`;
  p.replaceChildren(...Array.from({ length: c * r }, (_, i) => el('i', i < S.dials.length ? '' : 'e')));
}
$('#cols').addEventListener('input', drawPreview);
$('#rows').addEventListener('input', drawPreview);

function syncExtras() {
  document.querySelectorAll('[data-w]').forEach(c => { c.checked = !!S.widgets?.[c.dataset.w]; });
  radios.forEach(show => show());
  $('#seed').value = S.seed || '#0a8f7e';
  $('#seedRow').hidden = S.style !== 'm3';
  drawPreview();
}
$('#setBtn').addEventListener('click', syncExtras);
document.querySelectorAll('[data-w]').forEach(c => {
  c.onchange = () => { S.widgets = { ...S.widgets, [c.dataset.w]: c.checked }; save(); renderWidgets(); };
});
$('#seed').oninput = e => { S.seed = e.target.value; applyStyle(); }; // live preview while dragging
$('#seed').onchange = () => save();                                    // save once, not on every drag step
$('#bgclear').onclick = async () => {
  await chrome.storage.local.remove('BG');
  if (S.bg === 'photo') S.bg = 'mist';
  save(); applyBg(); syncExtras();
};
$('#bgimg').onchange = async e => {
  const file = e.target.files[0];
  e.target.value = '';
  if (!file) return;
  try {
    const bmp = await createImageBitmap(file), k = Math.min(1, 2000 / Math.max(bmp.width, bmp.height));
    const cv = Object.assign(document.createElement('canvas'), { width: Math.round(bmp.width * k), height: Math.round(bmp.height * k) });
    cv.getContext('2d').drawImage(bmp, 0, 0, cv.width, cv.height);
    await chrome.storage.local.set({ BG: cv.toDataURL('image/jpeg', .85) });
    S.bg = 'photo';
    save(); applyBg(); syncExtras();
  } catch { alert('Could not read that image.'); }
};

async function initExtras() {
  const { W: stored } = await chrome.storage.local.get('W');
  if (stored) W = { notes: '', todos: [], ...stored };
  applyTheme();
  applyStyle();
  applyBg();
  renderWidgets();
}
