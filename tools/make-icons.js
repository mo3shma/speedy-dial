// Renders the Speedy Dial icon (a gauge with a needle pointing to "fast") with signed-distance shapes, no dependencies.
// Writes PNG icons for the extension and SVG logos for branding. Run: node tools/make-icons.js
const fs = require('fs'), path = require('path'), zlib = require('zlib');
const root = path.join(__dirname, '..');
const iconDir = path.join(root, 'speed-dial', 'icons'), brandDir = path.join(root, 'branding');
fs.mkdirSync(iconDir, { recursive: true });
fs.mkdirSync(brandDir, { recursive: true });

// design, in unit-square coordinates
const TEAL = [24, 199, 168], BLUE = [37, 99, 235], DOT = [31, 149, 201];
const CX = .5, CY = .54, R = .3, NEEDLE = .25, NEEDLE_ANGLE = -50, CORNER = .22;
const rad = a => a * Math.PI / 180;
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);

const sdRound = (x, y, r) => {
  const qx = Math.abs(x - .5) - (.5 - r), qy = Math.abs(y - .5) - (.5 - r);
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - r;
};
const sdSeg = (x, y, ax, ay, bx, by) => {
  const px = x - ax, py = y - ay, bx_ = bx - ax, by_ = by - ay;
  const h = Math.min(1, Math.max(0, (px * bx_ + py * by_) / (bx_ * bx_ + by_ * by_)));
  return Math.hypot(px - bx_ * h, py - by_ * h);
};

// colour at a point, or null outside the tile; "bold" thickens the strokes for tiny sizes
function sample(x, y, bold) {
  const t = bold ? .11 : .08, nw = bold ? .1 : .068, hub = bold ? .11 : .09;
  if (sdRound(x, y, CORNER) > 0) return null;
  let col = mix(TEAL, BLUE, (x + y) / 2);
  const paint = (rgb, a) => { col = mix(col, rgb, a); };
  const dx = x - CX, dy = y - CY, d = Math.hypot(dx, dy), ang = (Math.atan2(dy, dx) * 180 / Math.PI + 360) % 360;
  const inGap = ang > 45 && ang < 135; // the gauge is open at the bottom
  const ring = Math.abs(d - R) - t / 2;
  const cap = Math.min(...[135, 45].map(a => Math.hypot(x - (CX + R * Math.cos(rad(a))), y - (CY + R * Math.sin(rad(a)))) - t / 2));
  if (inGap && ring < 0 && cap > 0) paint([255, 255, 255], .22); // faint track across the gap
  if ((inGap ? cap : Math.min(ring, cap)) < 0) paint([255, 255, 255], .97);
  const tx = CX + NEEDLE * Math.cos(rad(NEEDLE_ANGLE)), ty = CY + NEEDLE * Math.sin(rad(NEEDLE_ANGLE));
  if (sdSeg(x, y, CX, CY, tx, ty) - nw / 2 < 0) paint([255, 255, 255], 1);
  if (d < hub) paint([255, 255, 255], 1);
  if (d < hub * .42) paint(DOT, 1);
  return col;
}

function render(size, ss = 4) {
  const bold = size <= 32, px = Buffer.alloc(size * size * 4);
  for (let j = 0; j < size; j++) for (let i = 0; i < size; i++) {
    let r = 0, g = 0, b = 0, a = 0;
    for (let sy = 0; sy < ss; sy++) for (let sx = 0; sx < ss; sx++) {
      const c = sample((i + (sx + .5) / ss) / size, (j + (sy + .5) / ss) / size, bold);
      if (c) { r += c[0]; g += c[1]; b += c[2]; a++; }
    }
    const o = (j * size + i) * 4;
    if (a) { px[o] = r / a; px[o + 1] = g / a; px[o + 2] = b / a; px[o + 3] = Math.round(255 * a / (ss * ss)); }
  }
  return px;
}

function png(w, h, rgba) {
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) rgba.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4);
  const chunk = (type, data) => {
    const len = Buffer.alloc(4), crc = Buffer.alloc(4), body = Buffer.concat([Buffer.from(type), data]);
    len.writeUInt32BE(data.length);
    crc.writeUInt32BE(zlib.crc32(body) >>> 0);
    return Buffer.concat([len, body, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6; // 8-bit RGBA
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

for (const s of [16, 32, 48, 128]) fs.writeFileSync(path.join(iconDir, `icon${s}.png`), png(s, s, render(s)));
fs.writeFileSync(path.join(brandDir, 'speedy-dial-512.png'), png(512, 512, render(512)));

// the same drawing as vector shapes, for the logo files
const U = 128, f = n => +(n * U).toFixed(2);
const pt = a => [f(CX + R * Math.cos(rad(a))), f(CY + R * Math.sin(rad(a)))];
const [sx, sy] = pt(135), [ex, ey] = pt(45);
const tip = [f(CX + NEEDLE * Math.cos(rad(NEEDLE_ANGLE))), f(CY + NEEDLE * Math.sin(rad(NEEDLE_ANGLE)))];
const mark = `<rect width="128" height="128" rx="${f(CORNER)}" fill="url(#g)"/>
  <path d="M${sx} ${sy}A${f(R)} ${f(R)} 0 0 0 ${ex} ${ey}" fill="none" stroke="#fff" stroke-opacity=".22" stroke-width="${f(.08)}" stroke-linecap="round"/>
  <path d="M${sx} ${sy}A${f(R)} ${f(R)} 0 1 1 ${ex} ${ey}" fill="none" stroke="#fff" stroke-opacity=".97" stroke-width="${f(.08)}" stroke-linecap="round"/>
  <path d="M${f(CX)} ${f(CY)}L${tip[0]} ${tip[1]}" stroke="#fff" stroke-width="${f(.068)}" stroke-linecap="round"/>
  <circle cx="${f(CX)}" cy="${f(CY)}" r="${f(.09)}" fill="#fff"/>
  <circle cx="${f(CX)}" cy="${f(CY)}" r="${f(.038)}" fill="#1f95c9"/>`;
const defs = `<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="rgb(${TEAL})"/><stop offset="1" stop-color="rgb(${BLUE})"/></linearGradient></defs>`;
fs.writeFileSync(path.join(brandDir, 'logo.svg'), `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" role="img" aria-label="Speedy Dial">\n  ${defs}\n  ${mark}\n</svg>\n`);
fs.writeFileSync(path.join(brandDir, 'logo-wordmark.svg'), `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 560 128" role="img" aria-label="Speedy Dial">
  ${defs}
  <g>${mark}</g>
  <text x="156" y="84" font-family="'Segoe UI Variable Display','Segoe UI',system-ui,sans-serif" font-size="64" font-weight="700" letter-spacing="-1.5" fill="#151821">Speedy <tspan fill="#0a8f7e">Dial</tspan></text>
</svg>
`);
console.log('icons and logos written');
