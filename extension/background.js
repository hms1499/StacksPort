// extension/background.js
const DEFAULT_APP_URL = 'https://stack-sport.vercel.app';

// ─── Setup on install ─────────────────────────────────────────────────────────

chrome.runtime.onInstalled.addListener(() => {
  chrome.alarms.create('pollPrice', { periodInMinutes: 5 });
  chrome.alarms.create('checkAlerts', { periodInMinutes: 5 });
});

// ─── Message handler (content script → background) ────────────────────────────

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type !== 'SYNC_DATA') return;
  if (msg.stxAddress) {
    chrome.storage.sync.set({ stxAddress: msg.stxAddress });
  }
  chrome.storage.local.set({
    notifications: msg.notifications ?? [],
    priceAlerts: msg.priceAlerts ?? [],
  });
});

// ─── Alarms ───────────────────────────────────────────────────────────────────

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'pollPrice') pollPrice();
  if (alarm.name === 'checkAlerts') checkAlerts();
});

// ─── Price polling — notify on >5% swing (requires 2 consecutive confirmations) ──

async function pollPrice() {
  try {
    const appUrl = await getAppUrl();
    const res = await fetch(
      `${appUrl}/api/coingecko/simple/price?ids=blockstack,bitcoin&vs_currencies=usd&include_24hr_change=true`
    );
    if (!res.ok) return;
    const data = await res.json();

    const stxPrice = data?.blockstack?.usd;
    if (!stxPrice) return;

    const { prevStxPrice, confirmCount = 0 } = await chrome.storage.local.get([
      'prevStxPrice',
      'confirmCount',
    ]);

    if (prevStxPrice) {
      const changePct = Math.abs((stxPrice - prevStxPrice) / prevStxPrice);
      if (changePct > 0.05) {
        if (confirmCount + 1 >= 2) {
          const direction = stxPrice > prevStxPrice ? 'up' : 'down';
          chrome.notifications.create(`price-swing-${Date.now()}`, {
            type: 'basic',
            iconUrl: 'icons/48.png',
            title: 'STX Price Movement',
            message: `STX is ${direction} ${(changePct * 100).toFixed(1)}% to $${stxPrice.toFixed(3)}`,
          });
          await chrome.storage.local.set({ confirmCount: 0 });
        } else {
          await chrome.storage.local.set({ confirmCount: confirmCount + 1 });
        }
      } else {
        await chrome.storage.local.set({ confirmCount: 0 });
      }
    }

    await chrome.storage.local.set({ prevStxPrice: stxPrice, lastPollAt: Date.now() });
  } catch {
    // Network error — retry next alarm cycle
  }
}

// ─── Alert checking — fire once per alert trigger ────────────────────────────

async function checkAlerts() {
  try {
    const { stxAddress } = await chrome.storage.sync.get('stxAddress');
    if (!stxAddress) return;

    const appUrl = await getAppUrl();
    const res = await fetch(`${appUrl}/api/extension/summary?address=${stxAddress}`);
    if (!res.ok) return;
    const { prices } = await res.json();

    const { priceAlerts = [], firedAlertIds = [] } = await chrome.storage.local.get([
      'priceAlerts',
      'firedAlertIds',
    ]);

    const newlyFired = [];
    for (const alert of priceAlerts) {
      if (firedAlertIds.includes(alert.id)) continue;

      const currentPrice =
        alert.tokenSymbol === 'STX' ? prices?.stx :
        alert.tokenSymbol === 'BTC' ? prices?.btc :
        null;

      if (currentPrice === null) continue;

      const triggered =
        (alert.condition === 'above' && currentPrice >= alert.targetPrice) ||
        (alert.condition === 'below' && currentPrice <= alert.targetPrice);

      if (triggered) {
        chrome.notifications.create(`alert-${alert.id}`, {
          type: 'basic',
          iconUrl: 'icons/48.png',
          title: `${alert.tokenSymbol} Price Alert`,
          message: `${alert.tokenSymbol} is ${alert.condition} $${alert.targetPrice.toLocaleString()} (now $${currentPrice.toLocaleString()})`,
        });
        newlyFired.push(alert.id);
      }
    }

    if (newlyFired.length) {
      await chrome.storage.local.set({ firedAlertIds: [...firedAlertIds, ...newlyFired] });
    }
  } catch {
    // Network error — retry next alarm cycle
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function getAppUrl() {
  const { appUrl } = await chrome.storage.sync.get('appUrl');
  return appUrl || DEFAULT_APP_URL;
}
