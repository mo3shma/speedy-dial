// node tools/schema-variant.js <document.schema.json> <typeTag> [depth]  -> compact tree of the layer variant whose "type" is typeTag
const fs = require('fs');
const s = JSON.parse(fs.readFileSync(process.argv[2], 'utf8').replace(/^﻿/, ''));
const defs = s.$defs || s.definitions || {};
const res = n => (n && n.$ref ? defs[n.$ref.split('/').pop()] || n : n);
const want = process.argv[3], maxDepth = +(process.argv[4] || 3);
let hit = null;
(function find(o) {
  if (hit || !o || typeof o !== 'object') return;
  const p = o.properties;
  if (p && p.type && (p.type.const === want || (p.type.enum && p.type.enum[0] === want))) { hit = o; return; }
  for (const v of Object.values(o)) find(v);
})(s);
if (!hit) { console.log('no variant for', want); process.exit(1); }
const walk = (n, name, depth, req) => {
  n = res(n) || {};
  const pad = '  '.repeat(depth);
  const t = n.const !== undefined ? 'const ' + JSON.stringify(n.const) : n.enum ? 'enum ' + n.enum.join('|') : Array.isArray(n.type) ? n.type.join('|') : n.type || '';
  console.log(`${pad}${name}${req ? '*' : ''}: ${t}${n.description ? ' // ' + String(n.description).slice(0, 100).replace(/\s+/g, ' ') : ''}`);
  if (depth >= maxDepth) return;
  if (n.properties) for (const [k, v] of Object.entries(n.properties)) walk(v, k, depth + 1, (n.required || []).includes(k));
  if (n.items) walk(n.items, '[item]', depth + 1);
  (n.oneOf || n.anyOf || []).slice(0, 8).forEach((a, i) => walk(a, `<alt${i}>`, depth + 1));
};
walk(hit, want, 0, false);
