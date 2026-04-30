// extension/popup.js
const DEFAULT_URL = 'https://stack-sport.vercel.app';

function fmtUsd(v) {
  if (v == null) return '—';
  if (v >= 10_000) return '$' + Math.round(v).toLocaleString('en-US');
  if (v >= 1) return '$' + v.toFixed(2);
  return '$' + v.toFixed(4);
}

function fmtPct(pct) {
  if (pct == null) return { text: '—', cls: 'neutral' };
  const sign = pct >= 0 ? '▲' : '▼';
  return {
    text: `${sign} ${Math.abs(pct).toFixed(1)}%`,
    cls: pct >= 0 ? 'positive' : 'negative',
  };
}

function fmtAddr(addr) {
  if (!addr) return '—';
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

function timeAgo(ms) {
  const diff = Date.now() - ms;
  const m = Math.floor(diff / 60_000);
  if (m < 1) return 'Just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function escHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function renderPrices(prices) {
  if (!prices) return;
  document.getElementById('stx-price').textContent = fmtUsd(prices.stx);
  document.getElementById('sbtc-price').textContent = fmtUsd(prices.btc);
  document.getElementById('btc-price').textContent = fmtUsd(prices.btc);

  const stxChg = fmtPct(prices.stxChange24h);
  const stxEl = document.getElementById('stx-change');
  stxEl.textContent = stxChg.text;
  stxEl.className = `change ${stxChg.cls}`;

  const btcChg = fmtPct(prices.btcChange24h);
  ['sbtc-change', 'btc-change'].forEach((id) => {
    const el = document.getElementById(id);
    el.textContent = btcChg.text;
    el.className = `change ${btcChg.cls}`;
  });
}

function renderPortfolio(portfolio, stxAddress) {
  const connected = document.getElementById('portfolio-connected');
  const disconnected = document.getElementById('portfolio-disconnected');

  if (!stxAddress) {
    connected.style.display = 'none';
    disconnected.style.display = 'block';
    return;
  }

  connected.style.display = 'block';
  disconnected.style.display = 'none';

  if (!portfolio) return;
  document.getElementById('portfolio-total').textContent = fmtUsd(portfolio.totalUSD);
}

function renderNotifications(notifs) {
  const list = document.getElementById('notif-list');
  if (!notifs || !notifs.length) {
    list.innerHTML = '<li class="notif-empty">No notifications yet</li>';
    return;
  }
  list.innerHTML = notifs
    .slice(0, 3)
    .map(
      (n) => `<li class="notif-item">
        <span class="dot ${n.isRead ? 'read' : ''}"></span>
        <div>
          <div class="notif-msg">${escHtml(n.message ?? '')}</div>
          <div class="notif-time">${timeAgo(n.timestamp ?? 0)}</div>
        </div>
      </li>`
    )
    .join('');
}

async function getAppUrl() {
  const { appUrl } = await chrome.storage.sync.get('appUrl');
  return appUrl || DEFAULT_URL;
}

async function loadCachedData() {
  const { cachedPrices, cachedPortfolio, notifications, lastFetchAt } =
    await chrome.storage.local.get([
      'cachedPrices', 'cachedPortfolio', 'notifications', 'lastFetchAt',
    ]);
  const { stxAddress } = await chrome.storage.sync.get('stxAddress');

  renderPrices(cachedPrices);
  renderPortfolio(cachedPortfolio, stxAddress);
  renderNotifications(notifications);

  document.getElementById('wallet-addr').textContent = fmtAddr(stxAddress);
  if (lastFetchAt) {
    document.getElementById('updated-at').textContent = timeAgo(lastFetchAt);
  }
}

async function fetchFreshData() {
  try {
    const appUrl = await getAppUrl();
    const { stxAddress } = await chrome.storage.sync.get('stxAddress');
    const qs = stxAddress ? `?address=${stxAddress}` : '';

    const res = await fetch(`${appUrl}/api/extension/summary${qs}`);
    if (!res.ok) return;
    const data = await res.json();

    await chrome.storage.local.set({
      cachedPrices: data.prices,
      cachedPortfolio: data.portfolio,
      lastFetchAt: Date.now(),
    });

    renderPrices(data.prices);
    renderPortfolio(data.portfolio, stxAddress);
    document.getElementById('updated-at').textContent = 'Just now';
  } catch {
    const el = document.getElementById('updated-at');
    if (el.textContent && el.textContent !== '—') {
      el.textContent += ' (stale)';
    }
  }
}

async function init() {
  await loadCachedData();
  fetchFreshData();

  document.getElementById('open-app').addEventListener('click', async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    await chrome.sidePanel.open({ tabId: tab.id });
    window.close();
  });
}

init();
