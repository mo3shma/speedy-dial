// Stand-in for the chrome.* APIs the extension uses, so its real code runs in an ordinary browser tab for screen recording.
// Storage lives in localStorage; history and top sites are sample data; cross-site fetches go through the local proxy,
// which mirrors what the extension's host permission allows. Open /?fresh to start from the curated demo state.
(() => {
  const KEY = 'stub-storage';
  // ?fresh starts from the curated demo state, ?install starts empty like a brand-new install (the extension then seeds itself)
  const wantsReset = /[?&](fresh|install)(&|$)/.test(location.search);
  if (wantsReset) localStorage.removeItem(KEY);
  const store = JSON.parse(localStorage.getItem(KEY) || 'null') || {};
  const listeners = [];
  const persist = () => localStorage.setItem(KEY, JSON.stringify(store));
  const clone = v => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)));

  const uid = () => crypto.randomUUID();
  if (!store.S && !location.search.includes('install')) {
    const d = (title, url) => ({ id: uid(), title, url });
    store.S = { cols: 3, rows: 2, pinned: false, dials: [d('GitHub', 'https://github.com'), d('YouTube', 'https://www.youtube.com'), d('Wikipedia', 'https://www.wikipedia.org'),
      d('Figma', 'https://www.figma.com'), d('Spotify', 'https://www.spotify.com'), d('Notion', 'https://www.notion.so')] };
    persist();
  }

  const minutesAgo = m => Date.now() - m * 60000;
  const H = (title, url, m) => ({ title, url, lastVisitTime: minutesAgo(m) });
  const HISTORY = [
    H('Pull requests · speedy-dial', 'https://github.com/pulls', 3), H('Lo-fi beats to focus', 'https://www.youtube.com/watch?v=jfKfPfyJRdk', 9),
    H('Design systems · Figma', 'https://www.figma.com/community', 21), H('Spotify – Discover Weekly', 'https://open.spotify.com/playlist/discover', 34),
    H('Sourdough bread: a beginner guide', 'https://www.seriouseats.com/sourdough', 52), H('Wikipedia, the free encyclopedia', 'https://www.wikipedia.org', 77),
    H('Weekly planning – Notion', 'https://www.notion.so/planning', 104), H('Flights to Lisbon', 'https://www.kayak.com/flights/lisbon', 140),
    H('Stack Overflow – Where developers learn', 'https://stackoverflow.com', 190), H('Inbox (12) – Mail', 'https://mail.google.com', 260),
    H('The Verge', 'https://www.theverge.com', 330), H('Hacker News', 'https://news.ycombinator.com', 400),
  ];
  const TOP = [H('GitHub', 'https://github.com', 0), H('YouTube', 'https://www.youtube.com', 0), H('Wikipedia', 'https://www.wikipedia.org', 0),
    H('Figma', 'https://www.figma.com', 0), H('Spotify', 'https://www.spotify.com', 0), H('Notion', 'https://www.notion.so', 0), H('Stack Overflow', 'https://stackoverflow.com', 0)];

  const pick = (keys) => {
    if (keys == null) return clone(store);
    const list = typeof keys === 'string' ? [keys] : Array.isArray(keys) ? keys : Object.keys(keys);
    return Object.fromEntries(list.filter(k => k in store).map(k => [k, clone(store[k])]));
  };
  const fire = changes => listeners.forEach(fn => fn(changes, 'local'));
  window.chrome = Object.assign(window.chrome || {}, {
    runtime: { id: 'stub', getURL: p => new URL(p, location.origin).href },
    storage: {
      local: {
        // real storage answers over IPC, never before every script on the page has loaded
        get: async keys => { if (document.readyState !== 'complete') await new Promise(r => addEventListener('load', r)); return pick(keys); },
        set: async obj => { const ch = {}; for (const [k, v] of Object.entries(obj)) { ch[k] = { oldValue: clone(store[k]), newValue: clone(v) }; store[k] = clone(v); } persist(); fire(ch); },
        remove: async keys => { const ch = {}; for (const k of [].concat(keys)) { ch[k] = { oldValue: clone(store[k]) }; delete store[k]; } persist(); fire(ch); },
      },
      onChanged: { addListener: fn => listeners.push(fn) },
    },
    topSites: { get: async () => clone(TOP) },
    history: { search: async ({ text = '', maxResults = 100 }) => HISTORY.filter(h => !text || (h.title + h.url).toLowerCase().includes(text.toLowerCase())).slice(0, maxResults).map(clone) },
    search: { query: () => {} },
  });

  // cross-site requests go through the local proxy, like the extension's host permission lets them through
  const realFetch = window.fetch.bind(window);
  window.fetch = (input, init) => {
    const u = new URL(typeof input === 'string' ? input : input.url, location.href);
    return u.origin === location.origin ? realFetch(input, init) : realFetch('/proxy?u=' + encodeURIComponent(u.href), init);
  };

  // state presets for the recording scripts: /?fresh&widgets&m3&five&pinned
  const q = new URLSearchParams(location.search);
  if (q.has('fresh')) {
    if (q.has('widgets')) store.S.widgets = { clock: true, calendar: true, notes: true, todo: true };
    if (q.has('m3')) store.S.style = 'm3';
    if (q.has('five')) store.S.dials.pop();
    if (q.has('dark')) store.S.theme = 'dark';
    if (store.S.widgets) store.W = { notes: '', todos: [{ t: 'Ship the release', done: true }, { t: 'Reply to Sam', done: false }] };
    persist();
  }

  // helpers for the recording scripts
  window.__demo = {
    // what the toolbar button / Alt+Shift+D does: queue a site, which the page then merges into the grid
    quickAdd: (url, title) => { const inbox = [...(store.inbox || []), { url, title }]; return chrome.storage.local.set({ inbox }); },
  };

  // ---- screen-recording support ----
  // A cursor drawn on top of the page (a real screen recorder shows the OS cursor), kept above dialogs by living in the top layer.
  addEventListener('DOMContentLoaded', () => {
    const c = document.createElement('div');
    c.id = '__cursor';
    c.setAttribute('popover', 'manual');
    c.style.cssText = 'position:fixed;inset:auto;left:0;top:0;margin:0;padding:0;border:0;background:none;overflow:visible;pointer-events:none;width:0;height:0;opacity:0';
    c.innerHTML = '<svg width="34" height="40" viewBox="0 0 34 40" style="position:absolute;left:-2px;top:-2px;filter:drop-shadow(0 3px 5px rgba(0,0,0,.35))"><path d="M3 2v26l7.2-6.6 4.6 10.4 4.4-2-4.5-10.2H25z" fill="#fff" stroke="#151821" stroke-width="2" stroke-linejoin="round"/></svg>';
    document.body.append(c);
    c.showPopover();
    addEventListener('mousemove', e => { c.style.opacity = 1; c.style.transform = `translate(${e.clientX}px,${e.clientY}px)`; }, true);
    addEventListener('mousedown', e => {
      const r = document.createElement('div');
      r.style.cssText = `position:absolute;left:${-28}px;top:${-28}px;width:56px;height:56px;border-radius:50%;border:4px solid rgba(10,143,126,.9);`;
      c.append(r);
      r.animate([{ transform: 'scale(.3)', opacity: 1 }, { transform: 'scale(1.5)', opacity: 0 }], { duration: 520, easing: 'ease-out' }).onfinish = () => r.remove();
    }, true);
  });

  // Deterministic animation clock. Every CSS transition/animation that starts is paused and driven by the frame time, so footage is
  // perfectly smooth no matter how long each screenshot takes. frame(t) advances everything to t milliseconds.
  window.__rec = (() => {
    const start = new Map(); // animation -> time (ms) it began, or null when it must stay finished
    const base = new Map();  // infinite animations -> their position when recording began
    return {
      begin() {
        for (const a of document.getAnimations()) {
          if (a.effect.getComputedTiming().endTime === Infinity) { base.set(a, a.currentTime); start.set(a, 0); a.pause(); } else { a.finish(); start.set(a, null); }
        }
      },
      async frame(t) {
        for (const a of document.getAnimations()) {
          if (!start.has(a)) { start.set(a, t); a.pause(); a.currentTime = 0; }
          const s = start.get(a);
          if (s === null) continue;
          a.currentTime = (base.get(a) || 0) + Math.max(0, t - s);
        }
        const c = document.getElementById('__cursor');
        if (c) { c.hidePopover(); c.showPopover(); } // stay above any dialog opened since the last frame
        await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
      },
    };
  })();
})();
