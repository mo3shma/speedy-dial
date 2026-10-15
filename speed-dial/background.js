// Queues sites for the new tab page, which owns the dial list and merges the queue (see drain() in app.js).
const flash = text => {
  chrome.action.setBadgeBackgroundColor({ color: '#0a8f7e' });
  chrome.action.setBadgeText({ text });
  setTimeout(() => chrome.action.setBadgeText({ text: '' }), 1800);
};

async function add(url, title) {
  if (!/^https?:/.test(url ?? '')) return flash('!');
  const { inbox = [] } = await chrome.storage.local.get('inbox');
  inbox.push({ url, title });
  await chrome.storage.local.set({ inbox });
  flash('✓');
}

chrome.action.onClicked.addListener(tab => add(tab.url, tab.title));
chrome.runtime.onInstalled.addListener(() =>
  chrome.contextMenus.create({ id: 'add', title: 'Add to Speedy Dial', contexts: ['page', 'link'] }));
chrome.contextMenus.onClicked.addListener((info, tab) => add(info.linkUrl ?? info.pageUrl, info.linkUrl ? '' : tab?.title));
