// "Import from another speed dial". Another extension's storage is off limits to us, so the user exports a file there
// and picks it here. We have no sample of every extension's format, so the parser accepts the common shapes by content:
// Netscape bookmarks HTML, any JSON holding url/title objects (optionally grouped), or a plain list of URLs.
// Shares globals with app.js and extras.js: $, uid, host, fixUrl, allDials, justAdded, S, save, render, sdlg, el.

const WRAPPERS = /^(bookmarks bar|favorites bar|other bookmarks|bookmarks menu|bookmarks toolbar|mobile bookmarks|speed dial)$/i;
const URL_KEYS = ['url', 'href', 'link', 'uri', 'address', 'site'], TITLE_KEYS = ['title', 'name', 'label', 'text'];
// same site regardless of www, trailing slash or case: used to dedupe and to spot sites already on the grid
const siteKey = u => { try { const x = new URL(u); return (x.host.replace(/^www\./, '') + x.pathname.replace(/\/+$/, '') + x.search).toLowerCase(); } catch { return u; } };

// http(s) only; a bare 'example.com' is fixed, anything with another scheme (javascript:, data:, place:, chrome:) is dropped
function cleanUrl(v) {
  if (typeof v !== 'string') return null;
  v = v.trim();
  if (!/^https?:\/\//i.test(v)) {
    if (!/^[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}(:\d+)?([/?#]\S*)?$/i.test(v)) return null;
    v = fixUrl(v);
  }
  try { const u = new URL(v); return /^https?:$/.test(u.protocol) && u.hostname ? u.href : null; } catch { return null; }
}
const clip = (t, alt) => (typeof t === 'string' && t.replace(/\s+/g, ' ').trim().slice(0, 80)) || alt;

function parseImport(text, name) { // name is only a hint for the reader: detection is by content
  const items = [], seen = new Set(), folders = new Map();
  let dials = 0, nodes = 0;
  const add = (url, title, group) => { // group: { key, title } of the depth-1 folder, or null for the grid
    url = cleanUrl(url);
    if (!url || dials >= 1000 || seen.has(siteKey(url))) return;
    seen.add(siteKey(url));
    dials++;
    const d = { title: clip(title, host(url)), url };
    if (!group) return items.push(d);
    let f = folders.get(group.key);
    if (!f) { f = { type: 'folder', title: clip(group.title, 'Folder'), dials: [] }; folders.set(group.key, f); items.push(f); }
    f.dials.push(d);
  };

  const fromHtml = () => {
    const doc = new DOMParser().parseFromString(text, 'text/html');
    // a link's folder is the outermost non-wrapper <H3> above it; links in deeper subfolders flatten into that one
    for (const a of doc.querySelectorAll('a[href]')) {
      if (++nodes > 1e5) break;
      let top = null;
      for (let dl = a.closest('dl'); dl; dl = dl.parentElement?.closest('dl')) {
        const h = dl.parentElement?.querySelector(':scope > h3') ?? (dl.previousElementSibling?.tagName === 'H3' ? dl.previousElementSibling : null);
        if (h && !(h.hasAttribute('personal_toolbar_folder') || WRAPPERS.test(h.textContent.trim()))) top = h;
      }
      add(a.getAttribute('href'), a.textContent, top && { key: top, title: top.textContent });
    }
  };

  const linkOf = o => { for (const k of URL_KEYS) if (cleanUrl(o[k])) return o[k]; };
  const titleOf = o => { for (const k of TITLE_KEYS) if (typeof o[k] === 'string' && o[k].trim()) return o[k]; };
  const kids = o => (Array.isArray(o) ? o : Object.values(o)).filter(v => v && typeof v === 'object');
  const walk = (v, depth, group) => {
    if (++nodes > 1e5 || depth > 12 || !v || typeof v !== 'object') return;
    if (!Array.isArray(v)) {
      const u = linkOf(v);
      if (u) return add(u, titleOf(v), group);
      // a named object holding links itself is a folder (wrappers like 'Bookmarks bar' excepted); the root never is
      const t = titleOf(v);
      if (!group && depth && t && !WRAPPERS.test(t.trim()) && kids(v).some(k => kids(k).some(x => !Array.isArray(x) && linkOf(x)) || (!Array.isArray(k) && linkOf(k))))
        group = { key: v, title: t };
    }
    for (const k of kids(v)) walk(k, depth + 1, group);
  };

  const fromText = () => {
    for (const line of text.split(/\r?\n/)) {
      const m = /^\s*(https?:\/\/[^\s|]+)\s*\|?\s*(.*)$/i.exec(line);
      if (m) add(m[1], m[2]);
    }
  };

  try {
    if (typeof text !== 'string') text = '';
    if (/^\s*[[{]/.test(text)) { try { walk(JSON.parse(text), 0, null); } catch { /* not JSON after all */ } }
    if (!items.length && /<a\s[^>]*href/i.test(text)) fromHtml();
    if (!items.length) fromText();
  } catch { /* hostile or broken input: report what was found so far */ }
  const out = items.filter(x => x.type !== 'folder' || x.dials.length);
  return { items: out, dials, folders: out.filter(x => x.type === 'folder').length };
}

// ---- UI: Settings > Backup and tips > Import from another speed dial ----
const idlg = $('#idlg');
let found;
const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
function showImport(title, help, res) {
  found = res;
  $('#ihead').textContent = title;
  $('#ihelp').textContent = help;
  for (const x of ['#ichips', '#iskipRow', '#iok']) $(x).hidden = !res;
  $('#icancel').textContent = res ? 'Cancel' : 'Close';
  if (res) {
    const chips = res.items.slice(0, 8).map(x => { const li = document.createElement('li'); li.textContent = x.type === 'folder' ? `${x.title} (${x.dials.length})` : x.title; return li; });
    if (res.items.length > 8) chips.push(Object.assign(document.createElement('li'), { className: 'more', textContent: `+${res.items.length - 8} more` }));
    $('#ichips').replaceChildren(...chips);
    const have = new Set(allDials().map(d => siteKey(d.url)));
    const dup = res.items.flatMap(x => (x.type === 'folder' ? x.dials : [x])).filter(d => have.has(siteKey(d.url))).length;
    $('#idup').textContent = dup ? ` (${dup})` : '';
    $('#iskip').checked = true;
  }
  idlg.showModal();
}
$('#impOther').onchange = async e => {
  const file = e.target.files[0];
  e.target.value = '';
  if (!file) return;
  if (file.size > 5 * 1024 * 1024) return showImport('That file is too big', 'Choose a file under 5 MB.');
  const res = parseImport(await file.text().catch(() => ''), file.name);
  if (!res.dials) return showImport('No sites found', 'We could not find any sites in that file. Try exporting your bookmarks as an HTML file.');
  showImport(`Found ${plural(res.dials, 'dial')}${res.folders ? ` in ${plural(res.folders, 'folder')}` : ''}`,
    'Export a backup or bookmarks file from the other extension, then choose it here. Nothing is deleted from your current grid.', res);
};
idlg.onclose = () => {
  const res = found;
  found = null;
  if (idlg.returnValue !== 'ok' || !res) return;
  idlg.returnValue = '';
  const have = new Set($('#iskip').checked ? allDials().map(d => siteKey(d.url)) : []);
  const fresh = d => !have.has(siteKey(d.url));
  const mk = x => { const id = uid(); justAdded.add(id); return { ...x, id }; };
  let n = 0;
  for (const x of res.items) {
    if (x.type !== 'folder') { if (fresh(x)) { S.dials.push(mk(x)); n++; } continue; }
    const ds = x.dials.filter(fresh).map(mk);
    if (ds.length) { S.dials.push(mk({ ...x, dials: ds })); n += ds.length; }
  }
  save(); render();
  sdlg.close();
  toast(n ? `Added ${plural(n, 'dial')}` : 'Nothing new to add: you already have these sites');
};
let toastT;
function toast(msg) {
  let t = $('#itoast');
  if (!t) { t = el('div', 'pbar toast'); t.id = 'itoast'; t.setAttribute('role', 'status'); document.body.append(t); }
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(toastT);
  toastT = setTimeout(() => { t.hidden = true; }, 4000);
}
