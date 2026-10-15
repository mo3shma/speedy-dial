// Builds the Speedy Dial launch video as an editable Tesseract project (project.tsrct).
// The feature scenes use real screen recordings of the extension (assets/footage/*.mp4, made by capture/); the intro and outro are native Tesseract graphics.
// Run from this folder:  node build.js        then:  node build.js export   to render renders/speedy-dial-launch.mp4
const fs = require('fs'), path = require('path'), { spawnSync } = require('child_process');
const ROOT = __dirname;
const TSRCT = path.join(process.env.LOCALAPPDATA, 'Tesseract', 'bin', 'tsrct.cmd');
const WORK = path.join(ROOT, '.tesseract-work');
const W = 1920, H = 1080;
const MUSIC_VOLUME = 0.9; // linear gain; the track is already mixed to sit under the visuals

function tsrct(...args) {
  const r = spawnSync(`"${TSRCT}"`, args, { cwd: ROOT, shell: true, encoding: 'utf8' });
  if (r.status !== 0) { console.error(r.stdout, r.stderr); throw new Error('tsrct ' + args.join(' ')); }
  return r.stdout;
}
const readJson = f => JSON.parse(fs.readFileSync(f, 'utf8').replace(/^﻿/, ''));

if (process.argv[2] === 'export') {
  fs.mkdirSync(path.join(ROOT, 'renders'), { recursive: true });
  console.log(tsrct('export', '--project', 'project.tsrct', '--output', 'renders/speedy-dial-launch.mp4'));
  process.exit(0);
}

// ---------- the story: timings in ms. Scenes overlap by 350 ms so each one fades over the next. ----------
const FOOTAGE = [
  { key: 'grid', ms: 6200, head: 'Everything you open daily, one glance away.', sub: 'A grid that always fits your screen. No scrolling.' },
  { key: 'history', ms: 7400, head: 'Your history is one hover away.', sub: 'Move to the edge, and pin it to keep it open.' },
  { key: 'widgets', ms: 8000, head: 'Widgets, only when you want them.', sub: 'Clock, calendar, notes and to-do in a sidebar.' },
  { key: 'icons', ms: 9000, head: 'Crisp icons, found for you.', sub: 'Right-click, search by name, pick the one you like.' },
  { key: 'styles', ms: 8600, head: 'Two looks. One switch.', sub: 'Liquid glass or Material 3, live.' },
  { key: 'quickadd', ms: 4600, head: 'Add any site in one click.', sub: 'Toolbar button, a shortcut, or right-click.', toolbar: true },
];
const INTRO_END = 4600, OVERLAP = 350, WINDOW_DELAY = 150, OUTRO_LEN = 3800;
let cursor = INTRO_END - OVERLAP;
for (const f of FOOTAGE) { f.S = cursor; f.E = cursor + f.ms; cursor = f.E - OVERLAP; }
const OUTRO_S = cursor, DUR = OUTRO_S + OUTRO_LEN; // keep tools/make-music.js SCENES and DUR in step with these

// ---------- palette and easing ----------
const hex = (h, a = 1) => { const n = parseInt(h.slice(1), 16); return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255, a]; };
const INK = hex('#151821'), INK2 = hex('#566074'), WHITE = hex('#ffffff'), TEAL = hex('#0A8F7E');
const EASE = {
  out: { type: 'cubicBezier', x1: .16, y1: 1, x2: .3, y2: 1 },
  inout: { type: 'cubicBezier', x1: .65, y1: 0, x2: .35, y2: 1 },
  spring: { type: 'cubicBezier', x1: .34, y1: 1.56, x2: .64, y2: 1 },
  lin: { type: 'linear' },
};

// ---------- action builders ----------
let nextId = 1, kn = 0;
const id = () => nextId++;
const A = [], K = [], IMAGES = [], VIDEOS = [];
const parentOf = o => (o.parent ? { parentLayerId: o.parent } : {});
const range = o => ({ start: Math.round(o.start), end: Math.round(o.end) });

// keyframes: frames are [timeMs relative to the layer's own start, value, optional easing into this key]
function key(layerId, prop, frames, ease = EASE.out) {
  K.push({
    type: 'setFxPropertyKeyframes', compositionId: 'main', property: { layerId, propertyType: prop },
    keyframes: frames.map(([t, v, e]) => ({
      id: 'k' + (++kn), layerTime: Math.round(t),
      value: typeof v === 'string' ? { type: 'string', value: v } : { type: 'float', value: v }, easing: e || ease,
    })),
  });
}

function rectL(o) { // x,y,w,h in canvas pixels; centred anchor so scale and rotate pivot on the middle
  const lid = id(), { w, h } = o;
  A.push({
    type: 'animatorAddRectLayer', compositionId: 'main', layerId: lid, name: o.name || 'Rect', insertIndex: 0, ...parentOf(o),
    transform: { anchorPoint: [w / 2, h / 2], opacity: o.opacity ?? 100, position: [o.x + w / 2, o.y + h / 2], rotation: 0, scale: [100, 100] },
    rect: {
      fillColor: o.fill || [1, 1, 1, 1], size: [w, h], position: [0, 0], roundness: o.round || 0,
      ...(o.paint ? { fillPaint: o.paint } : {}),
      ...(o.stroke ? { strokeEnabled: true, strokeColor: o.stroke, strokeWidth: o.sw || 2 } : {}),
    },
    projectActiveRange: range(o),
  });
  if (o.shadow) A.push({ type: 'animatorSetDropShadow', compositionId: 'main', layerId: lid, amount: o.shadow });
  return { id: lid, px: o.x + w / 2, py: o.y + h / 2, w, h };
}

// Instrument Sans: capitals start 0.28 em and end 1.00 em below the top of a text box (measured with tools/calib.js),
// so their centre is 0.64 em down. valign 'center' places that centre on the middle of the o.x/y/w/h box; the engine's own
// vertical centring sits visibly high for this font.
const CAP_CENTRE = 0.64;
function textL(o) { // box text: the layer origin is the top-left of the box
  const lid = id(), mid = o.valign === 'center';
  const y = mid ? o.y + o.h / 2 - CAP_CENTRE * o.size : o.y, h = mid ? Math.ceil(o.size * 1.4) : o.h;
  A.push({
    type: 'animatorAddTextLayer', compositionId: 'main', layerId: lid, name: o.name || o.str.slice(0, 24), insertIndex: 0, ...parentOf(o),
    transform: { anchorPoint: [0, 0], opacity: 100, position: [o.x, y], rotation: 0, scale: [100, 100] },
    sourceText: {
      text: o.str, fontFamily: 'Instrument Sans', fontStyle: o.reg ? 'Regular' : 'Bold', fontSize: o.size, fillColor: o.color || INK,
      strokeWidth: 0, justification: o.align || 'left', boxText: true, boxSize: [o.w, h], boxPosition: [0, 0],
      verticalAlign: 'top', tracking: o.tracking || 0, ...(o.leading ? { leading: o.leading } : {}),
    },
    projectActiveRange: range(o),
  });
  return { id: lid, px: o.x, py: y };
}

function groupL(o) { // anchor and position at the same point, so scaling a group pivots on that point
  const lid = id(), [cx, cy] = o.at || [0, 0];
  A.push({
    type: 'animatorAddGroupLayer', compositionId: 'main', layerId: lid, name: o.name || 'Group', insertIndex: 0, ...parentOf(o),
    transform: { anchorPoint: [cx, cy], opacity: 100, position: [cx, cy], rotation: 0, scale: [100, 100] },
    projectActiveRange: range(o),
  });
  return { id: lid, px: cx, py: cy };
}

// reusable motion
const rise = (l, delay = 0, dur = 700, d = 44) => { key(l.id, 'positionY', [[delay, l.py + d], [delay + dur, l.py]]); key(l.id, 'opacity', [[delay, 0], [delay + dur * .6, 100]], EASE.out); };
const fadeIn = (l, delay = 0, dur = 500) => key(l.id, 'opacity', [[delay, 0], [delay + dur, 100]], EASE.out);
const pop = (l, delay = 0, dur = 560, from = 55) => {
  key(l.id, 'scaleX', [[delay, from], [delay + dur, 100, EASE.spring]]);
  key(l.id, 'scaleY', [[delay, from], [delay + dur, 100, EASE.spring]]);
  key(l.id, 'opacity', [[delay, 0], [delay + 220, 100]]);
};

// a scene is a group that fades in and out; children use absolute project times
function scene(name, S, E, { first = false, last = false } = {}) {
  const g = groupL({ name, start: S, end: E });
  const d = E - S;
  const frames = [];
  if (first) frames.push([0, 100]); else frames.push([0, 0], [OVERLAP, 100, EASE.lin]);
  if (!last) frames.push([d - OVERLAP, 100, EASE.lin], [d, 0, EASE.lin]);
  key(g.id, 'opacity', frames, EASE.lin);
  return { g: g.id, S, E, at: (delay = 0) => ({ parent: g.id, start: S + delay, end: E }) };
}

// ---------- background (whole video) ----------
{
  const t = { start: 0, end: DUR };
  rectL({ ...t, name: 'Background', x: 0, y: 0, w: W, h: H, fill: hex('#F7FAFE') });
  const blob = (name, x, y, s, c, drift) => {
    const b = rectL({ ...t, name, x, y, w: s, h: s, paint: { type: 'gradient', gradientType: 'radial', start: [s / 2, s / 2], end: [s / 2, 0], stops: [{ offset: 0, color: hex(c, .5) }, { offset: 1, color: hex(c, 0) }] } });
    key(b.id, 'positionX', [[0, b.px], [DUR, b.px + drift]], EASE.lin);
    key(b.id, 'positionY', [[0, b.py], [DUR, b.py - drift * .6]], EASE.lin);
  };
  blob('Mint cloud', -350, -450, 1500, '#18C7A8', 260);
  blob('Blue cloud', 950, 250, 1500, '#6FA0FF', -300);
  blob('Peach cloud', 300, 600, 1200, '#FFC7A8', 220);
}

// ---------- intro ----------
{
  const s = scene('Intro', 0, INTRO_END, { first: true });
  const logo = id(); IMAGES.push({ id: logo, parent: s.g, startRel: 100, durRel: INTRO_END - 100, cx: 960, cy: 360, size: 300 });
  const base = 300 / 512 * 100;
  key(logo, 'scaleX', [[0, base * .4], [750, base, EASE.spring]]); key(logo, 'scaleY', [[0, base * .4], [750, base, EASE.spring]]);
  key(logo, 'opacity', [[0, 0], [300, 100]]);
  rise(textL({ ...s.at(450), name: 'Title', str: 'Speedy Dial', x: 210, y: 560, w: 1500, h: 190, size: 150, align: 'center' }), 0, 800);
  rise(textL({ ...s.at(900), name: 'Tagline', str: 'Your new tab, at full speed.', x: 210, y: 770, w: 1500, h: 80, size: 52, reg: true, color: INK2, align: 'center' }), 0, 800);
}

// ---------- feature scenes: real recordings of the extension in a browser window ----------
const WIN = { x: 216, y: 132, w: 1488, h: 893 };          // the window card
const SHOT = { scale: 76, cx: 960, cy: 190 + 1080 * .76 / 2 }; // the 1920x1080 recording at 76%, under a 58 px toolbar
for (const f of FOOTAGE) {
  const s = scene(f.key, f.S, f.E);
  rise(textL({ ...s.at(100), name: 'Headline', str: f.head, x: 160, y: 14, w: 1600, h: 76, size: 56, align: 'center' }), 0, 650, 30);
  rise(textL({ ...s.at(300), name: 'Subhead', str: f.sub, x: 160, y: 82, w: 1600, h: 44, size: 28, reg: true, color: INK2, align: 'center' }), 0, 650, 24);

  const t = s.at(WINDOW_DELAY), g = groupL({ name: 'Browser window', at: [960, WIN.y + WIN.h / 2], ...t });
  rectL({ ...t, parent: g.id, name: 'Window', ...WIN, round: 34, fill: [1, 1, 1, .55], stroke: [1, 1, 1, .95], sw: 3, shadow: .3 });
  ['#FF6B5F', '#FFC247', '#34C759'].forEach((c, i) => rectL({ ...t, parent: g.id, name: 'Window button', x: WIN.x + 30 + i * 26, y: WIN.y + 22, w: 14, h: 14, round: 7, fill: hex(c) }));
  rectL({ ...t, parent: g.id, name: 'Address bar', x: 520, y: WIN.y + 12, w: 800, h: 34, round: 17, fill: [.08, .1, .13, .07] });
  textL({ ...t, parent: g.id, name: 'Address', str: 'New Tab', x: 520, y: WIN.y + 12, w: 800, h: 34, size: 18, reg: true, color: INK2, align: 'center', valign: 'center' });
  pop(g, 0, 650, 94);

  const vid = id(); VIDEOS.push({ id: vid, parent: g.id, key: f.key, ms: f.ms - WINDOW_DELAY });

  if (f.toolbar) { // the extension's toolbar button: clicked, then "Added" (in step with the add in the recording)
    const ic = id(), size = 34, cx = WIN.x + WIN.w - 62, cy = WIN.y + 29;
    IMAGES.push({ id: ic, parent: g.id, startRel: 0, durRel: f.ms - WINDOW_DELAY, cx, cy, size });
    const base = size / 512 * 100, click = 1150;
    key(ic, 'scaleX', [[0, base], [click, base], [click + 90, base * .82], [click + 330, base, EASE.spring]]);
    key(ic, 'scaleY', [[0, base], [click, base], [click + 90, base * .82], [click + 330, base, EASE.spring]]);
    const rt = s.at(WINDOW_DELAY + click), ripple = rectL({ ...rt, parent: g.id, name: 'Click ripple', x: cx - size / 2, y: cy - size / 2, w: size, h: size, round: size / 2, fill: [1, 1, 1, 0], stroke: TEAL, sw: 4 });
    key(ripple.id, 'scaleX', [[0, 100], [650, 330]]); key(ripple.id, 'scaleY', [[0, 100], [650, 330]]); key(ripple.id, 'opacity', [[0, 100], [650, 0]], EASE.lin);
    const at = s.at(WINDOW_DELAY + click + 120), pill = rectL({ ...at, parent: g.id, name: 'Added pill', x: cx - 150, y: cy - 16, w: 104, h: 32, round: 16, fill: TEAL });
    const pt = textL({ ...at, parent: g.id, name: 'Added text', str: 'Added', x: cx - 150, y: cy - 16, w: 104, h: 32, size: 18, color: WHITE, align: 'center', valign: 'center' });
    pop(pill, 0, 420, 60); fadeIn(pt, 80, 250);
  }
}

// ---------- outro ----------
{
  const s = scene('Outro', OUTRO_S, DUR, { last: true });
  const logo = id(); IMAGES.push({ id: logo, parent: s.g, startRel: 100, durRel: DUR - OUTRO_S - 100, cx: 960, cy: 340, size: 260 });
  const base = 260 / 512 * 100;
  key(logo, 'scaleX', [[0, base * .4], [750, base, EASE.spring]]); key(logo, 'scaleY', [[0, base * .4], [750, base, EASE.spring]]); key(logo, 'opacity', [[0, 0], [300, 100]]);
  key(logo, 'rotation', [[0, -25], [900, 0]]);
  rise(textL({ ...s.at(450), name: 'Title', str: 'Speedy Dial', x: 210, y: 520, w: 1500, h: 190, size: 150, align: 'center' }), 0, 800);
  rise(textL({ ...s.at(900), name: 'Tagline', str: 'Your new tab, at full speed.', x: 210, y: 730, w: 1500, h: 80, size: 52, reg: true, color: INK2, align: 'center' }), 0, 800);
}

// ---------- assemble the project ----------
function chunks(arr, n) { const out = []; for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n)); return out; }
function applyAll(list, label) {
  chunks(list, 60).forEach((c, i) => {
    const f = path.join(WORK, `${label}-${i}.json`);
    fs.writeFileSync(f, JSON.stringify(c));
    tsrct('project', 'apply', '--project', 'project.tsrct', '--actions', path.relative(ROOT, f));
  });
}
const findLayer = (list, lid) => { for (const l of list) { if (l.id === lid) return l; const r = l.layers && findLayer(l.layers, lid); if (r) return r; } return null; };

fs.mkdirSync(WORK, { recursive: true });
fs.rmSync(path.join(ROOT, 'project.tsrct'), { force: true });
tsrct('project', 'create', '--project', 'project.tsrct');
const doc = path.join(WORK, 'editable.json');
tsrct('project', 'checkout', '--project', 'project.tsrct', '--output', path.relative(ROOT, doc));
let d = readJson(doc); d.dimensions = { width: W, height: H }; d.duration = DUR / 1000;
fs.writeFileSync(doc, JSON.stringify(d)); tsrct('project', 'commit', '--project', 'project.tsrct', '--file', path.relative(ROOT, doc));

for (const f of ['InstrumentSans-Bold.ttf', 'InstrumentSans-Regular.ttf']) tsrct('project', 'import-font', '--project', 'project.tsrct', '--file', `assets/fonts/${f}`);
tsrct('project', 'import-asset', '--project', 'project.tsrct', '--file', 'assets/brand/speedy-dial-512.png', '--asset-id', 'logo512', '--kind', 'image');
// music: synthesized by tools/make-music.js (run it first if assets/audio is missing)
if (!fs.existsSync(path.join(ROOT, 'assets/audio/speedy-dial-theme.wav'))) throw new Error('Missing assets/audio/speedy-dial-theme.wav: run node tools/make-music.js first');
tsrct('project', 'import-asset', '--project', 'project.tsrct', '--file', 'assets/audio/speedy-dial-theme.wav', '--asset-id', 'music', '--kind', 'audio');
// screen recordings of the real extension
const footageMs = {};
for (const f of FOOTAGE) {
  const file = `assets/footage/${f.key}.mp4`;
  if (!fs.existsSync(path.join(ROOT, file))) throw new Error(`Missing ${file}: record it with capture/ first`);
  footageMs[f.key] = JSON.parse(tsrct('project', 'import-video', '--project', 'project.tsrct', '--file', file, '--asset-id', 'footage-' + f.key)).durationMs;
}

applyAll(A, 'layers');

// Image, Video and Audio layers are introduced through the document JSON; times inside a group are relative to the group
tsrct('project', 'checkout', '--project', 'project.tsrct', '--output', path.relative(ROOT, doc));
d = readJson(doc);
d.composition.layers.push({
  id: id(), name: 'Music', type: 'Audio', source: { assetId: 'music' }, volume: MUSIC_VOLUME,
  sourceIntrinsicDuration: DUR, sourceRange: { start: 0, duration: DUR },
  playback: {
    type: 'windowed', inputOffsetMs: 0, inputRange: { start: 0, duration: DUR },
    mapping: { type: 'linear', input: { start: 0, duration: DUR }, output: { start: 0, duration: DUR } },
  },
  metadata: { modality: 'music', source: 'generated', sourceName: 'Speedy Dial theme (synthesized by tools/make-music.js)' },
});
for (const v of VIDEOS) {
  const ms = Math.min(v.ms, footageMs[v.key]);
  findLayer(d.composition.layers, v.parent).layers.unshift({
    id: v.id, name: 'Recording: ' + v.key, type: 'Video', blendMode: 'normal', cornerRadius: 0.02, // a fraction of the layer size, not pixels (values above 0.5 become an oval)
    source: { assetId: 'footage-' + v.key, fit: 'stretch' },
    sourceIntrinsicDuration: footageMs[v.key], sourceRange: { start: 0, duration: ms },
    playback: { type: 'windowed', inputOffsetMs: 0, inputRange: { start: 0, duration: ms }, mapping: { type: 'linear', input: { start: 0, duration: ms }, output: { start: 0, duration: ms } } },
    transform: { anchorPoint: [960, 540], opacity: 100, position: [SHOT.cx, SHOT.cy], rotation: 0, scale: [SHOT.scale, SHOT.scale] },
  });
}
for (const im of IMAGES) {
  findLayer(d.composition.layers, im.parent).layers.unshift({
    id: im.id, name: 'Logo', type: 'Image', blendMode: 'normal',
    activeRange: { start: im.startRel, duration: im.durRel },
    source: { assetId: 'logo512', fit: 'stretch' },
    transform: { anchorPoint: [256, 256], opacity: 100, position: [im.cx, im.cy], rotation: 0, scale: [im.size / 512 * 100, im.size / 512 * 100] },
  });
}
fs.writeFileSync(doc, JSON.stringify(d)); tsrct('project', 'commit', '--project', 'project.tsrct', '--file', path.relative(ROOT, doc));

applyAll(K, 'keys');
console.log(`built: ${A.length} layer actions, ${K.length} animation actions, ${VIDEOS.length} recordings, ${IMAGES.length} logo layers, ${(DUR / 1000).toFixed(2)}s`);
console.log('scene starts (s):', [0, ...FOOTAGE.map(f => f.S), OUTRO_S].map(x => +(x / 1000).toFixed(2)).join(', '));
