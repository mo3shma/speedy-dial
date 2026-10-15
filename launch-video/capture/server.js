// Serves the real Speedy Dial extension files so the page can be screen-recorded in a normal browser.
// Nothing in speed-dial/ is modified: this server injects stub.js (a stand-in for the chrome.* APIs) in front of app.js,
// answers /_favicon/ like Chrome does, and proxies cross-site requests the way the extension's host permission does.
// Run:  node capture/server.js   (listens on http://localhost:4173)
const http = require('http'), fs = require('fs'), path = require('path');
const EXT = path.join(__dirname, '..', '..', 'speed-dial');
const PORT = 4173;
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.json': 'application/json', '.svg': 'image/svg+xml' };
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';
const iconCache = new Map();

async function remote(u, res, extraHeaders = {}) {
  try {
    const r = await fetch(u, { headers: { 'user-agent': UA, accept: '*/*' }, redirect: 'follow', signal: AbortSignal.timeout(8000) });
    const body = Buffer.from(await r.arrayBuffer());
    res.writeHead(r.status, { 'content-type': r.headers.get('content-type') || 'application/octet-stream', 'access-control-allow-origin': '*', ...extraHeaders });
    res.end(body);
  } catch (e) { res.writeHead(502, { 'access-control-allow-origin': '*' }); res.end(String(e)); }
}

http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  if (url.pathname === '/proxy') return remote(url.searchParams.get('u'), res);
  if (url.pathname === '/_favicon/' || url.pathname === '/_favicon') {
    const host = new URL(url.searchParams.get('pageUrl')).hostname;
    if (!iconCache.has(host)) {
      try {
        const r = await fetch(`https://www.google.com/s2/favicons?domain=${host}&sz=64`, { headers: { 'user-agent': UA }, signal: AbortSignal.timeout(8000) });
        iconCache.set(host, { type: r.headers.get('content-type'), body: Buffer.from(await r.arrayBuffer()) });
      } catch { res.writeHead(404); return res.end(); }
    }
    const c = iconCache.get(host);
    res.writeHead(200, { 'content-type': c.type || 'image/png' });
    return res.end(c.body);
  }
  if (url.pathname === '/__stub.js') { res.writeHead(200, { 'content-type': TYPES['.js'], 'cache-control': 'no-store' }); return res.end(fs.readFileSync(path.join(__dirname, 'stub.js'))); }
  const rel = url.pathname === '/' ? '/newtab.html' : url.pathname;
  const file = path.normalize(path.join(EXT, rel));
  if (!file.startsWith(EXT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); return res.end('not found'); }
  let body = fs.readFileSync(file);
  if (rel === '/newtab.html') body = Buffer.from(body.toString('utf8').replace('<script src="app.js"></script>', '<script src="/__stub.js"></script><script src="app.js"></script>'));
  res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream', 'cache-control': 'no-store' });
  res.end(body);
}).listen(PORT, () => console.log(`Speedy Dial demo on http://localhost:${PORT}`));
