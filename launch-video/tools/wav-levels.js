// Prints the loudness of a 16-bit stereo WAV second by second, as a quick text view of its shape.
const fs = require('fs');
const b = fs.readFileSync(process.argv[2]), sr = b.readUInt32LE(24), n = (b.length - 44) / 4;
const out = [];
for (let s = 0; s < n / sr; s++) {
  let sq = 0, c = 0;
  for (let i = s * sr; i < Math.min(n, (s + 1) * sr); i++) { const l = b.readInt16LE(44 + i * 4) / 32768, r = b.readInt16LE(46 + i * 4) / 32768; sq += l * l + r * r; c += 2; }
  const db = 20 * Math.log10(Math.sqrt(sq / c) + 1e-9);
  out.push(`${String(s).padStart(2)}s ${db.toFixed(1).padStart(6)} dB ${'#'.repeat(Math.max(0, Math.round((db + 45) / 1.5)))}`);
}
console.log(out.join('\n'));
