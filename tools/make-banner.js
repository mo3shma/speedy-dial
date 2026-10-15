// Renders docs/banner.png (1280x640, also the GitHub social preview) with Tesseract, from a real screenshot of the extension.
// Run from the repository root:  node tools/make-banner.js        (needs Tesseract 0.4.0 at %LOCALAPPDATA%\Tesseract)
const fs = require('fs'), path = require('path'), { spawnSync } = require('child_process');
const ROOT = path.join(__dirname, '..'), WORK = path.join(ROOT, '.banner-work');
const T = path.join(process.env.LOCALAPPDATA, 'Tesseract', 'bin', 'tsrct.cmd');
const run = (...a) => { const r = spawnSync(`"${T}"`, a, { cwd: ROOT, shell: true, encoding: 'utf8' }); if (r.status !== 0) throw new Error(r.stdout + r.stderr); return r.stdout; };
const rel = p => path.relative(ROOT, p);
const read = f => JSON.parse(fs.readFileSync(f, 'utf8').replace(/^﻿/, ''));
const W = 1280, H = 640, P = '.banner-work/banner.tsrct';
const hex = (h, a = 1) => { const n = parseInt(h.slice(1), 16); return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255, a]; };
const INK = hex('#151821'), INK2 = hex('#566074');
const R = { start: 0, end: 1000 };

fs.rmSync(WORK, { recursive: true, force: true });
fs.mkdirSync(WORK, { recursive: true });
run('project', 'create', '--project', P);
const doc = path.join(WORK, 'doc.json');
run('project', 'checkout', '--project', P, '--output', rel(doc));
let d = read(doc); d.dimensions = { width: W, height: H }; d.duration = 1;
fs.writeFileSync(doc, JSON.stringify(d)); run('project', 'commit', '--project', P, '--file', rel(doc));
for (const f of ['InstrumentSans-Bold.ttf', 'InstrumentSans-Regular.ttf']) run('project', 'import-font', '--project', P, '--file', `launch-video/assets/fonts/${f}`);
run('project', 'import-asset', '--project', P, '--file', 'branding/speedy-dial-512.png', '--asset-id', 'logo', '--kind', 'image');
run('project', 'import-asset', '--project', P, '--file', 'docs/screenshots/01-dial-grid.jpg', '--asset-id', 'shot', '--kind', 'image');

let id = 1;
const actions = [];
const rect = (o) => { const lid = id++; actions.push({ type: 'animatorAddRectLayer', compositionId: 'main', layerId: lid, name: o.name, insertIndex: 0,
  transform: { anchorPoint: [o.w / 2, o.h / 2], opacity: 100, position: [o.x + o.w / 2, o.y + o.h / 2], rotation: 0, scale: [100, 100] },
  rect: { fillColor: o.fill || [1, 1, 1, 1], size: [o.w, o.h], position: [0, 0], roundness: o.round || 0, ...(o.paint ? { fillPaint: o.paint } : {}), ...(o.stroke ? { strokeEnabled: true, strokeColor: o.stroke, strokeWidth: o.sw || 2 } : {}) },
  projectActiveRange: R });
  if (o.shadow) actions.push({ type: 'animatorSetDropShadow', compositionId: 'main', layerId: lid, amount: o.shadow }); return lid; };
const text = (o) => { const lid = id++; actions.push({ type: 'animatorAddTextLayer', compositionId: 'main', layerId: lid, name: o.name, insertIndex: 0,
  transform: { anchorPoint: [0, 0], opacity: 100, position: [o.x, o.y], rotation: 0, scale: [100, 100] },
  sourceText: { text: o.str, fontFamily: 'Instrument Sans', fontStyle: o.reg ? 'Regular' : 'Bold', fontSize: o.size, fillColor: o.color || INK, strokeWidth: 0, justification: 'left', boxText: true, boxSize: [o.w, o.h], boxPosition: [0, 0], verticalAlign: 'top', ...(o.leading ? { leading: o.leading } : {}) },
  projectActiveRange: R }); return lid; };

rect({ name: 'Background', x: 0, y: 0, w: W, h: H, fill: hex('#F7FAFE') });
const blob = (name, x, y, s, c) => rect({ name, x, y, w: s, h: s, paint: { type: 'gradient', gradientType: 'radial', start: [s / 2, s / 2], end: [s / 2, 0], stops: [{ offset: 0, color: hex(c, .55) }, { offset: 1, color: hex(c, 0) }] } });
blob('Mint cloud', -260, -300, 900, '#18C7A8'); blob('Blue cloud', 640, 160, 900, '#6FA0FF'); blob('Peach cloud', 120, 330, 720, '#FFC7A8');
text({ name: 'Title', str: 'Speedy Dial', x: 80, y: 238, w: 600, h: 120, size: 96 });
text({ name: 'Tagline', str: 'Your new tab, at full speed.', x: 84, y: 360, w: 560, h: 48, size: 34, reg: true, color: INK2 });
text({ name: 'Features', str: 'History · Widgets · Hi-res icons · Two looks', x: 84, y: 428, w: 580, h: 80, size: 24, reg: true, color: INK2, leading: 34 });
text({ name: 'Credit', str: 'by @3shmaaa', x: 84, y: 548, w: 400, h: 32, size: 22, color: INK });
const SC = 520, SH = SC * 9 / 16, CARD = { x: 680, w: SC + 40, h: SH + 40 + 36 }; CARD.y = (H - CARD.h) / 2;
rect({ name: 'Window', x: CARD.x, y: CARD.y, w: CARD.w, h: CARD.h, round: 30, fill: [1, 1, 1, .55], stroke: [1, 1, 1, .95], sw: 3, shadow: .3 });
['#FF6B5F', '#FFC247', '#34C759'].forEach((c, i) => rect({ name: 'Window button', x: CARD.x + 24 + i * 22, y: CARD.y + 16, w: 12, h: 12, round: 6, fill: hex(c) }));
fs.writeFileSync(path.join(WORK, 'actions.json'), JSON.stringify(actions));
run('project', 'apply', '--project', P, '--actions', rel(path.join(WORK, 'actions.json')));

run('project', 'checkout', '--project', P, '--output', rel(doc));
d = read(doc);
const image = (name, asset, w, h, cx, cy, scale, radius) => d.composition.layers.unshift({
  id: id++, name, type: 'Image', blendMode: 'normal', ...(radius ? { cornerRadius: radius } : {}), activeRange: { start: 0, duration: 1000 }, source: { assetId: asset, fit: 'stretch' },
  transform: { anchorPoint: [w / 2, h / 2], opacity: 100, position: [cx, cy], rotation: 0, scale: [scale, scale] } });
image('Screenshot', 'shot', 1920, 1080, CARD.x + CARD.w / 2, CARD.y + 36 + 20 + SH / 2, SC / 1920 * 100, 0.03);
image('Logo', 'logo', 512, 512, 80 + 60, 96 + 60, 120 / 512 * 100);
fs.writeFileSync(doc, JSON.stringify(d)); run('project', 'commit', '--project', P, '--file', rel(doc));
fs.mkdirSync(path.join(ROOT, 'docs'), { recursive: true });
run('preview', '--project', P, '--time', '0', '--output', 'docs/banner.png');
fs.rmSync(WORK, { recursive: true, force: true });
console.log('wrote docs/banner.png');
