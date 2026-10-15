// Minimal MP4 header read: duration, frame size, codec, sample count (no ffprobe on this machine).
const fs = require('fs');
const b = fs.readFileSync(process.argv[2]);
const find = (type, from = 0) => b.indexOf(type, from, 'latin1');
console.log('brand:', b.toString('latin1', 8, 12));
let i = find('mvhd');
const ver = b[i + 4], ts = b.readUInt32BE(i + (ver ? 24 : 16)), dur = ver ? Number(b.readBigUInt64BE(i + 28)) : b.readUInt32BE(i + 20);
console.log('duration:', (dur / ts).toFixed(2), 's');
const v = find('avc1') > 0 ? 'avc1' : find('hvc1') > 0 ? 'hvc1' : null;
if (v) { const p = find(v, find('stsd')); console.log('codec:', v, 'size:', b.readUInt16BE(p + 28) + 'x' + b.readUInt16BE(p + 30)); }
const s = find('stts'); if (s > 0) { const n = b.readUInt32BE(s + 8); let frames = 0, d0 = 0; for (let k = 0; k < n; k++) { frames += b.readUInt32BE(s + 12 + k * 8); d0 = b.readUInt32BE(s + 16 + k * 8); } console.log('video samples:', frames); }
console.log('has audio track:', find('soun') > 0);
