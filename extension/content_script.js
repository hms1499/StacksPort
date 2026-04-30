// extension/content_script.js
const WALLET_KEY = 'stacks-wallet';
const NOTIFS_KEY = 'notifications-storage';
const ALERTS_KEY = 'price-alerts-storage';

function syncData() {
  try {
    const walletRaw = localStorage.getItem(WALLET_KEY);
    const notifsRaw = localStorage.getItem(NOTIFS_KEY);
    const alertsRaw = localStorage.getItem(ALERTS_KEY);

    const wallet = walletRaw ? JSON.parse(walletRaw) : null;
    const notifs = notifsRaw ? JSON.parse(notifsRaw) : null;
    const alerts = alertsRaw ? JSON.parse(alertsRaw) : null;

    const stxAddress = wallet?.state?.stxAddress ?? null;
    const notifications = (notifs?.state?.notifications ?? [])
      .slice(0, 3)
      .map(({ id, message, type, category, timestamp, isRead }) => ({
        id, message, type, category, timestamp, isRead,
      }));
    const priceAlerts = (alerts?.state?.alerts ?? [])
      .filter((a) => a.isActive)
      .map(({ id, tokenSymbol, geckoId, condition, targetPrice }) => ({
        id, tokenSymbol, geckoId, condition, targetPrice,
      }));

    chrome.runtime.sendMessage({
      type: 'SYNC_DATA',
      stxAddress,
      notifications,
      priceAlerts,
    });
  } catch {
    // Best-effort — never throw from content script
  }
}

// Sync on page load
syncData();

// Re-sync when localStorage changes (wallet connect/disconnect in another tab or frame)
window.addEventListener('storage', (e) => {
  if ([WALLET_KEY, NOTIFS_KEY, ALERTS_KEY].includes(e.key)) {
    syncData();
  }
});
