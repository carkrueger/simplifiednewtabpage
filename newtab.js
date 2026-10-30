// Standalone port of Cromite's Android "Simplified NTP"
// (build/patches/Restore-Simplified-NTP-launch.patch).
'use strict';

// MostVisitedTilesGridLayout: never more than 4 columns. Unlike Android (fixed
// 4 rows), rows are added until the viewport is filled with whole rows.
const MAX_COLUMNS = 4;
const MAX_TILES = 100;
const HISTORY_SEARCH_SIZE = 1000;
const SNACKBAR_DURATION_MS = 5000;
const BLOCKED_KEY = 'blockedUrls';

const contentEl = document.getElementById('content');
const tilesEl = document.getElementById('tiles');
const placeholderEl = document.getElementById('placeholder');
const menuEl = document.getElementById('context-menu');
const snackbarEl = document.getElementById('snackbar');
const tileTemplate = document.getElementById('tile-template');

let blockedUrls = [];
let menuTarget = null;
let snackbarTimer = 0;
let lastRemovedUrl = null;
let layoutFrame = 0;
let defaultFaviconKey = null;
const faviconCache = new Map();

function applyI18n() {
  for (const el of document.querySelectorAll('[data-i18n]')) {
    const message = chrome.i18n.getMessage(el.dataset.i18n);
    if (message) {
      el.textContent = message;
    }
  }
}

function faviconUrl(pageUrl) {
  const url = new URL(chrome.runtime.getURL('/_favicon/'));
  url.searchParams.set('pageUrl', pageUrl);
  url.searchParams.set('size', '64');
  return url.toString();
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

// Returns a comparable fingerprint of an image, so the browser's generic
// favicon can be told apart from a real one.
function imageKey(img) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 16;
  canvas.getContext('2d').drawImage(img, 0, 0, 16, 16);
  return canvas.toDataURL();
}

async function getDefaultFaviconKey() {
  if (defaultFaviconKey === null) {
    try {
      const img = await loadImage(faviconUrl('https://default-favicon.invalid/'));
      defaultFaviconKey = imageKey(img);
    } catch {
      defaultFaviconKey = '';
    }
  }
  return defaultFaviconKey;
}

// Resolves to the favicon URL, or null when only the generic icon is known.
async function resolveFavicon(pageUrl) {
  if (faviconCache.has(pageUrl)) {
    return faviconCache.get(pageUrl);
  }
  let result = null;
  try {
    const src = faviconUrl(pageUrl);
    const [img, defaultKey] = await Promise.all([loadImage(src), getDefaultFaviconKey()]);
    if (imageKey(img) !== defaultKey) {
      result = src;
    }
  } catch {
    // Keep the fallback icon.
  }
  faviconCache.set(pageUrl, result);
  return result;
}

function displayHost(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

function isWebUrl(url) {
  return /^(https?|ftp|file):/i.test(url);
}

function createTile(site) {
  const tile = tileTemplate.content.firstElementChild.cloneNode(true);
  const title = site.title || displayHost(site.url);
  tile.href = site.url;
  tile.title = `${title}\n${site.url}`;
  tile.dataset.url = site.url;
  tile.querySelector('.tile-title').textContent = title;

  const iconEl = tile.querySelector('.tile-icon');
  const img = iconEl.querySelector('img');
  iconEl.classList.add('fallback');
  iconEl.append(displayHost(site.url).charAt(0) || '?');
  resolveFavicon(site.url).then((src) => {
    if (src) {
      img.src = src;
      iconEl.classList.remove('fallback');
      iconEl.lastChild.remove();
    }
  });
  return tile;
}

// chrome.topSites never returns more than 10 sites (history::kTopSitesNumber),
// so the rest of the grid comes from the history: one URL per site, most
// visited first, skipping the sites of excludedUrls.
async function getHistorySites(excludedUrls) {
  let items;
  try {
    items = await chrome.history.search(
        {text: '', startTime: 0, maxResults: HISTORY_SEARCH_SIZE});
  } catch {
    // Not every browser provides chrome.history. Keep the top sites only.
    return [];
  }
  const seenHosts = new Set(excludedUrls.map(displayHost));
  items.sort((a, b) => b.visitCount - a.visitCount);
  return items.filter((item) => {
    const host = displayHost(item.url);
    if (!isWebUrl(item.url) || seenHosts.has(host)) {
      return false;
    }
    seenHosts.add(host);
    return true;
  });
}

async function render() {
  const sites = await chrome.topSites.get();
  const blocked = new Set(blockedUrls);
  const historySites =
      await getHistorySites([...sites.map((site) => site.url), ...blockedUrls]);
  const visible = [...sites.filter((site) => !blocked.has(site.url)), ...historySites]
      .slice(0, MAX_TILES);

  tilesEl.replaceChildren(...visible.map(createTile));
  tilesEl.hidden = visible.length === 0;
  placeholderEl.hidden = visible.length !== 0;
  layout();
}

function cssPx(style, name) {
  return parseFloat(style.getPropertyValue(name)) || 0;
}

// Port of MostVisitedTilesGridLayout.onMeasure(), with the row limit derived
// from the viewport height instead of a fixed mMaxRows.
function layout() {
  const tiles = tilesEl.children;
  if (tiles.length === 0) {
    return;
  }
  const rootStyle = getComputedStyle(document.documentElement);
  const tileWidth = cssPx(rootStyle, '--tile-width');
  const minHorizontalSpacing = cssPx(rootStyle, '--tile-min-horizontal-spacing');
  const verticalSpacing = cssPx(rootStyle, '--tile-vertical-spacing');

  const totalWidth = tilesEl.clientWidth;
  const numColumns = Math.min(
      Math.max(Math.floor((totalWidth + minHorizontalSpacing) /
                          (tileWidth + minHorizontalSpacing)), 1),
      MAX_COLUMNS);
  tilesEl.style.setProperty('--columns', numColumns);

  tiles[0].hidden = false;
  const tileHeight = tiles[0].offsetHeight;
  const gridTop = tilesEl.getBoundingClientRect().top + window.scrollY;
  const paddingBottom = parseFloat(getComputedStyle(contentEl).paddingBottom) || 0;
  const availableHeight = window.innerHeight - gridTop - paddingBottom;
  const numRows = Math.max(
      Math.floor((availableHeight + verticalSpacing) / (tileHeight + verticalSpacing)), 1);

  const visibleCount = Math.min(tiles.length, numRows * numColumns);
  for (let i = 0; i < tiles.length; i++) {
    tiles[i].hidden = i >= visibleCount;
  }
}

function scheduleLayout() {
  cancelAnimationFrame(layoutFrame);
  layoutFrame = requestAnimationFrame(layout);
}

async function saveBlockedUrls() {
  await chrome.storage.local.set({[BLOCKED_KEY]: blockedUrls});
}

async function removeTile(url) {
  if (!blockedUrls.includes(url)) {
    blockedUrls.push(url);
  }
  await saveBlockedUrls();
  await render();
  showSnackbar(url);
}

async function undoRemove() {
  hideSnackbar();
  if (lastRemovedUrl === null) {
    return;
  }
  blockedUrls = blockedUrls.filter((url) => url !== lastRemovedUrl);
  lastRemovedUrl = null;
  await saveBlockedUrls();
  await render();
}

function showSnackbar(url) {
  lastRemovedUrl = url;
  snackbarEl.hidden = false;
  clearTimeout(snackbarTimer);
  snackbarTimer = setTimeout(hideSnackbar, SNACKBAR_DURATION_MS);
}

function hideSnackbar() {
  clearTimeout(snackbarTimer);
  snackbarEl.hidden = true;
}

async function openInCurrentTab(url) {
  const tab = await chrome.tabs.getCurrent();
  await chrome.tabs.update(tab?.id, {url});
}

function openInBackgroundTab(url) {
  return chrome.tabs.create({url, active: false});
}

function showMenu(tile, x, y) {
  menuTarget = tile;
  menuEl.hidden = false;
  const maxX = window.innerWidth - menuEl.offsetWidth - 4;
  const maxY = window.innerHeight - menuEl.offsetHeight - 4;
  menuEl.style.left = `${Math.max(4, Math.min(x, maxX))}px`;
  menuEl.style.top = `${Math.max(4, Math.min(y, maxY))}px`;
  menuEl.querySelector('button').focus();
}

function hideMenu(restoreFocus) {
  if (menuEl.hidden) {
    return;
  }
  menuEl.hidden = true;
  if (restoreFocus && menuTarget?.isConnected) {
    menuTarget.focus();
  }
  menuTarget = null;
}

async function onMenuAction(action) {
  const url = menuTarget?.dataset.url;
  hideMenu(false);
  if (!url) {
    return;
  }
  switch (action) {
    case 'new-tab':
      await chrome.tabs.create({url});
      break;
    case 'new-window':
      await chrome.windows.create({url});
      break;
    case 'remove':
      await removeTile(url);
      break;
  }
}

function setUpShortcut(id, url) {
  const button = document.getElementById(id);
  button.addEventListener('click', (e) => {
    if (e.ctrlKey || e.metaKey) {
      openInBackgroundTab(url);
    } else {
      openInCurrentTab(url);
    }
  });
  button.addEventListener('auxclick', (e) => {
    if (e.button === 1) {
      openInBackgroundTab(url);
    }
  });
}

function setUpEvents() {
  setUpShortcut('bookmarks-button', 'chrome://bookmarks/');
  setUpShortcut('downloads-button', 'chrome://downloads/');

  // Pages with non-web schemes cannot be opened through a link.
  tilesEl.addEventListener('click', (e) => {
    const tile = e.target.closest('.tile');
    if (tile && !isWebUrl(tile.dataset.url)) {
      e.preventDefault();
      openInCurrentTab(tile.dataset.url);
    }
  });

  tilesEl.addEventListener('contextmenu', (e) => {
    const tile = e.target.closest('.tile');
    if (!tile) {
      return;
    }
    e.preventDefault();
    let {clientX: x, clientY: y} = e;
    if (x === 0 && y === 0) {
      const rect = tile.getBoundingClientRect();
      x = rect.left + rect.width / 2;
      y = rect.top + rect.height / 2;
    }
    showMenu(tile, x, y);
  });

  menuEl.addEventListener('click', (e) => {
    const item = e.target.closest('[data-action]');
    if (item) {
      onMenuAction(item.dataset.action);
    }
  });

  menuEl.addEventListener('keydown', (e) => {
    const items = [...menuEl.querySelectorAll('button')];
    const index = items.indexOf(document.activeElement);
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const step = e.key === 'ArrowDown' ? 1 : -1;
      items[(index + step + items.length) % items.length].focus();
    } else if (e.key === 'Tab') {
      e.preventDefault();
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      hideMenu(true);
    }
  });
  document.addEventListener('pointerdown', (e) => {
    if (!menuEl.contains(e.target)) {
      hideMenu(false);
    }
  });
  window.addEventListener('blur', () => hideMenu(false));
  window.addEventListener('scroll', () => hideMenu(false), {passive: true});

  document.getElementById('snackbar-undo').addEventListener('click', undoRemove);

  window.addEventListener('resize', scheduleLayout);
  new ResizeObserver(scheduleLayout).observe(tilesEl);

  // Keep other open new tab pages in sync.
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && BLOCKED_KEY in changes) {
      const newValue = changes[BLOCKED_KEY].newValue || [];
      if (JSON.stringify(newValue) !== JSON.stringify(blockedUrls)) {
        blockedUrls = newValue;
        render();
      }
    }
  });
}

async function init() {
  applyI18n();
  document.title = chrome.i18n.getMessage('page_title') || document.title;
  setUpEvents();
  const stored = await chrome.storage.local.get(BLOCKED_KEY);
  blockedUrls = stored[BLOCKED_KEY] || [];
  await render();
}

init();
