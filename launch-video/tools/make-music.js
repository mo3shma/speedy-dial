// Synthesizes the launch video's music: an original 110 BPM loop in C major (C - G - Am - F), written as a 16-bit stereo WAV.
// No samples and no third-party material, so the result carries no licence. Run from launch-video:  node tools/make-music.js
const fs = require('fs'), path = require('path');
const SR = 44100, DUR = 49.75, N = Math.round(SR * DUR), BPM = 110, SPB = 60 / BPM;
const OUT = path.join(__dirname, '..', 'assets', 'audio', 'speedy-dial-theme.wav');
fs.mkdirSync(path.dirname(OUT), { recursive: true });

// scene starts in the video (seconds), taken from build.js
const SCENES = [4.25, 10.1, 17.15, 24.8, 33.45, 41.7, 45.95];
const DRUMS = [SCENES[0], SCENES[6]];  // drums play from the dial-grid scene to the outro

const buf = () => new Float32Array(N);
const dryL = buf(), dryR = buf(), pkL = buf(), pkR = buf(), send = buf();
const hz = m => 440 * 2 ** ((m - 69) / 12);
const gains = pan => [Math.cos((pan + 1) * Math.PI / 4), Math.sin((pan + 1) * Math.PI / 4)];
const TAU = Math.PI * 2;
let seed = 7; const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296) * 2 - 1;

const CHORDS = [
  { root: 36, pad: [60, 64, 67], arp: [72, 76, 79] }, // C
  { root: 43, pad: [59, 62, 67], arp: [71, 74, 79] }, // G
  { root: 45, pad: [60, 64, 69], arp: [72, 76, 81] }, // Am
  { root: 41, pad: [60, 65, 69], arp: [72, 77, 81] }, // F
];
const chordAt = t => CHORDS[Math.floor(t / (4 * SPB)) % 4];

// write a rendered voice into a stereo bus (and optionally the reverb send)
function voice(L, R, t0, len, pan, sendAmt, fn) {
  const i0 = Math.floor(t0 * SR), n = Math.min(Math.floor(len * SR), N - i0), [gl, gr] = gains(pan);
  for (let k = 0; k < n; k++) {
    const v = fn(k / SR, k);
    L[i0 + k] += v * gl; R[i0 + k] += v * gr;
    if (sendAmt) send[i0 + k] += v * sendAmt;
  }
}

// pad: three detuned saws per note through a gentle low-pass, slow attack and release
function pad(notes, t0, len) {
  for (const m of notes) {
    const f = hz(m), dets = [-6, 0, 6].map(c => f * 2 ** (c / 1200)), ph = [0, .33, .66];
    let lp = 0;
    voice(dryL, dryR, t0, len + .8, (m % 3 - 1) * .45, .5, t => {
      const att = Math.min(1, t / .7), rel = t > len ? Math.max(0, 1 - (t - len) / .8) : 1;
      let s = 0;
      dets.forEach((d, j) => { s += 2 * ((d * t + ph[j]) % 1) - 1; });
      lp += (s / 3 - lp) * .07;
      return lp * att * rel * .05;
    });
  }
}
function pluck(m, t0, vel, pan) {
  const f = hz(m);
  voice(pkL, pkR, t0, 1.1, pan, .35, t => {
    const env = Math.min(1, t / .003) * Math.exp(-t * 6.5);
    const tri = (2 / Math.PI) * Math.asin(Math.sin(TAU * f * t));
    return (tri + .3 * Math.sin(TAU * 2 * f * t) + .12 * Math.sin(TAU * 3 * f * t)) * env * vel * .21;
  });
}
function bass(m, t0, len, vel) {
  const f = hz(m);
  voice(dryL, dryR, t0, len, 0, 0, t => {
    const env = Math.min(1, t / .006) * Math.exp(-t * 3.2) * (t > len - .05 ? Math.max(0, (len - t) / .05) : 1);
    return (Math.sin(TAU * f * t) + .28 * Math.sin(TAU * 2 * f * t)) * env * vel * .36;
  });
}
function kick(t0, vel) {
  voice(dryL, dryR, t0, .4, 0, 0, t => Math.sin(TAU * (45 * t + 75 * (1 - Math.exp(-t * 28)) / 28)) * Math.exp(-t * 15) * vel * .3);
}
function hat(t0, vel, pan) {
  let prev = 0;
  voice(dryL, dryR, t0, .08, pan, 0, t => { const n = rnd(), hp = n - prev; prev = n; return hp * Math.exp(-t * 70) * vel * .03; });
}
function chime(m, t0, vel) {
  const f = hz(m);
  voice(dryL, dryR, t0, 2.6, .25, .9, t => Math.sin(TAU * f * t + 1.6 * Math.sin(TAU * f * 3.5 * t) * Math.exp(-t * 4)) * Math.min(1, t / .004) * Math.exp(-t * 2.1) * vel * .12);
}

// arrangement
for (let bar = 0; bar * 4 * SPB < DUR; bar++) {
  const t = bar * 4 * SPB, c = chordAt(t);
  const intro = t < DRUMS[0] - 2 * SPB, outro = t >= DRUMS[1] - 2 * SPB;
  pad(c.pad, t, 4 * SPB);
  if (!intro) {
    bass(c.root, t, SPB * 1.4, 1); bass(c.root, t + SPB * 2.5, SPB * 1.2, .8); bass(c.root + (bar % 2 ? 7 : 0), t + SPB * 3.5, SPB * .6, .6);
  }
  const pattern = intro || outro ? [0, 2, 4, 6] : [0, 1, 2, 3, 4, 5, 6, 7];
  for (const e of pattern) {
    const step = [0, 1, 2, 1, 0, 1, 2, 1][e];
    pluck(c.arp[step] + (e === 7 ? 12 : 0), t + e * SPB / 2, e % 2 ? .65 : 1, (e % 4 - 1.5) * .3);
  }
}
for (let b = 0; b * SPB < DUR; b++) {
  const t = b * SPB;
  if (t < DRUMS[0] || t >= DRUMS[1]) continue;
  kick(t, b % 4 === 0 ? 1 : .8);
  hat(t + SPB / 2, .9, b % 2 ? .3 : -.3);
  if (b % 2) hat(t, .45, -.2);
}
SCENES.forEach((t, i) => { const c = chordAt(t); chime(c.arp[(i + 1) % 3] + 12, t, i === SCENES.length - 1 ? 1.1 : .9); });

// ping-pong echo on the plucks (dotted eighth), then a small stereo reverb on the send bus
const echo = Math.round(SPB * .75 * SR), eL = buf(), eR = buf();
for (let i = 0; i < N; i++) {
  const l = pkL[i] + (i >= echo ? eR[i - echo] * .38 : 0), r = pkR[i] + (i >= echo ? eL[i - echo] * .38 : 0);
  eL[i] = l; eR[i] = r;
}
function reverb(src, offset) {
  const out = buf(), combs = [1557, 1617, 1491, 1422, 1277].map(d => d + offset), fb = .82;
  for (const d of combs) {
    const line = new Float32Array(d); let idx = 0, lp = 0;
    for (let i = 0; i < N; i++) {
      const y = line[idx]; lp += (y - lp) * .35;
      line[idx] = src[i] + lp * fb; idx = (idx + 1) % d; out[i] += y * .2;
    }
  }
  for (const d of [225 + offset / 4, 556 + offset / 4]) { // allpass diffusion
    const line = new Float32Array(Math.round(d)); let idx = 0;
    for (let i = 0; i < N; i++) { const y = line[idx], x = out[i]; line[idx] = x + y * .5; out[i] = y - x * .5; idx = (idx + 1) % line.length; }
  }
  return out;
}
const wetL = reverb(send, 0), wetR = reverb(send, 23);

// master: sum, fades, soft clip, level
const L = buf(), R = buf();
for (let i = 0; i < N; i++) {
  const t = i / SR, fin = Math.min(1, t / 1.2), fout = t > DUR - 3.2 ? .5 + .5 * Math.cos(Math.PI * (t - (DUR - 3.2)) / 3.2) : 1, g = (fin * fin * (3 - 2 * fin)) * fout;
  L[i] = Math.tanh((dryL[i] + eL[i] + wetL[i] * .55) * g * 1.3);
  R[i] = Math.tanh((dryR[i] + eR[i] + wetR[i] * .55) * g * 1.3);
}
let peak = 0; for (let i = 0; i < N; i++) peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]));
const norm = .8 / peak;
const pcm = Buffer.alloc(44 + N * 4);
pcm.write('RIFF', 0); pcm.writeUInt32LE(36 + N * 4, 4); pcm.write('WAVEfmt ', 8); pcm.writeUInt32LE(16, 16); pcm.writeUInt16LE(1, 20); pcm.writeUInt16LE(2, 22);
pcm.writeUInt32LE(SR, 24); pcm.writeUInt32LE(SR * 4, 28); pcm.writeUInt16LE(4, 32); pcm.writeUInt16LE(16, 34); pcm.write('data', 36); pcm.writeUInt32LE(N * 4, 40);
let sumSq = 0, bad = 0;
for (let i = 0; i < N; i++) {
  const l = L[i] * norm, r = R[i] * norm;
  if (!Number.isFinite(l) || !Number.isFinite(r)) bad++;
  sumSq += l * l + r * r;
  pcm.writeInt16LE(Math.round(Math.max(-1, Math.min(1, l)) * 32767), 44 + i * 4);
  pcm.writeInt16LE(Math.round(Math.max(-1, Math.min(1, r)) * 32767), 46 + i * 4);
}
fs.writeFileSync(OUT, pcm);
const rms = Math.sqrt(sumSq / (2 * N));
console.log(`wrote ${path.relative(process.cwd(), OUT)}: ${DUR}s, peak ${(20 * Math.log10(.8)).toFixed(1)} dBFS, RMS ${(20 * Math.log10(rms)).toFixed(1)} dBFS, bad samples ${bad}`);
