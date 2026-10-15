// Measures where Instrument Sans caps sit inside a top-aligned text box, so centred labels can be placed exactly.
const fs = require('fs'), path = require('path'), zlib = require('zlib'), { spawnSync } = require('child_process');
const ROOT = path.join(__dirname, '..'), WORK = path.join(ROOT, '.tesseract-work');
fs.mkdirSync(WORK, { recursive: true });
const T = path.join(process.env.LOCALAPPDATA, 'Tesseract', 'bin', 'tsrct.cmd');
const run = (...a) => { const r = spawnSync(`"${T}"`, a, { cwd: ROOT, shell: true, encoding: 'utf8' }); if (r.status !== 0) throw new Error(r.stdout + r.stderr); return r.stdout; };
const proj = '.tesseract-work/calib.tsrct';
fs.rmSync(path.join(ROOT, proj), { force: true });
run('project', 'create', '--project', proj);
run('project', 'checkout', '--project', proj, '--output', '.tesseract-work/calib-doc.json');
const doc = JSON.parse(fs.readFileSync(path.join(WORK, 'calib-doc.json'), 'utf8').replace(/^ï»¿/, ''));
doc.dimensions = { width: 900, height: 500 }; doc.duration = 1;
fs.writeFileSync(path.join(WORK, 'calib-doc.json'), JSON.stringify(doc));
run('project', 'commit', '--project', proj, '--file', '.tesseract-work/calib-doc.json');
for (const f of ['InstrumentSans-Bold.ttf', 'InstrumentSans-Regular.ttf']) run('project', 'import-font', '--project', proj, '--file', `assets/fonts/${f}`);
const SIZE = 200;
const txt = (id, x, style) => ({
  type: 'animatorAddTextLayer', compositionId: 'main', layerId: id, name: 't' + id, insertIndex: 0,
  transform: { anchorPoint: [0, 0], opacity: 100, position: [x, 100], rotation: 0, scale: [100, 100] },
  sourceText: { text: 'H', fontFamily: 'Instrument Sans', fontStyle: style, fontSize: SIZE, fillColor: [0, 0, 0, 1], strokeWidth: 0, justification: 'left', boxText: true, boxSize: [300, 300], boxPosition: [0, 0], verticalAlign: 'top' },
  projectActiveRange: { start: 0, end: 1000 },
});
const actions = [
  { type: 'animatorAddRectLayer', compositionId: 'main', layerId: 1, name: 'bg', transform: { anchorPoint: [0, 0], opacity: 100, position: [0, 0], rotation: 0, scale: [100, 100] }, rect: { fillColor: [1, 1, 1, 1], size: [900, 500], position: [0, 0] }, projectActiveRange: { start: 0, end: 1000 } },
  txt(2, 50, 'Bold'), txt(3, 450, 'Regular'),
];
fs.writeFileSync(path.join(WORK, 'calib-actions.json'), JSON.stringify(actions));
run('project', 'apply', '--project', proj, '--actions', '.tesseract-work/calib-actions.json');
run('preview', '--project', proj, '--time', '0.2', '--output', '.tesseract-work/calib.png');

// decode the PNG and find the dark rows of each H
const b = fs.readFileSync(path.join(WORK, 'calib.png'));
let o = 8, idat = [], w, h, ct;
while (o < b.length) { const l = b.readUInt32BE(o), t = b.toString('ascii', o + 4, o + 8); if (t === 'IHDR') { w = b.readUInt32BE(o + 8); h = b.readUInt32BE(o + 12); ct = b[o + 17]; } if (t === 'IDAT') idat.push(b.subarray(o + 8, o + 8 + l)); o += 12 + l; }
const raw = zlib.inflateSync(Buffer.concat(idat)), bpp = ct === 6 ? 4 : 3, st = w * bpp + 1, rows = []; let prev = Buffer.alloc(w * bpp);
for (let y = 0; y < h; y++) { const f = raw[y * st], line = Buffer.from(raw.subarray(y * st + 1, (y + 1) * st)); for (let i = 0; i < line.length; i++) { const a = i >= bpp ? line[i - bpp] : 0, u = prev[i], c = i >= bpp ? prev[i - bpp] : 0; let v = line[i]; if (f === 1) v += a; else if (f === 2) v += u; else if (f === 3) v += Math.floor((a + u) / 2); else if (f === 4) { const p = a + u - c, pa = Math.abs(p - a), pb = Math.abs(p - u), pc = Math.abs(p - c); v += (pa <= pb && pa <= pc) ? a : (pb <= pc ? u : c); } line[i] = v & 255; } rows.push(line); prev = line; }
const span = (x0, x1) => { let top = -1, bot = -1; for (let y = 0; y < h; y++) { let dark = false; for (let x = x0; x < x1; x++) if (rows[y][x * bpp] < 100) { dark = true; break; } if (dark) { if (top < 0) top = y; bot = y; } } return [top, bot]; };
for (const [name, x0, x1] of [['Bold', 50, 350], ['Regular', 450, 750]]) {
  const [t, bt] = span(x0, x1);
  console.log(`${name}: cap top ${((t - 100) / SIZE).toFixed(3)} em, cap bottom ${((bt + 1 - 100) / SIZE).toFixed(3)} em below box top (box top = y 100, size ${SIZE})`);
}

