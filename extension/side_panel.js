// extension/side_panel.js
const DEFAULT_URL = 'https://stack-sport.vercel.app';

async function init() {
  const { appUrl } = await chrome.storage.sync.get('appUrl');
  const url = appUrl || DEFAULT_URL;

  const frame = document.getElementById('app-frame');
  const loading = document.getElementById('loading');
  const banner = document.getElementById('banner');
  const openTabBtn = document.getElementById('open-tab-btn');

  frame.addEventListener('load', () => {
    loading.style.display = 'none';
  });

  // Show the wallet banner only when no wallet is connected.
  // Wallets like Leather/Xverse only inject providers into top frames, so
  // connecting from inside an iframe will fail — user must open in a tab.
  const { stxAddress } = await chrome.storage.sync.get('stxAddress');
  if (!stxAddress) banner.classList.add('show');

  // When the wallet is connected (via the new tab + content_script sync),
  // hide the banner and reload the iframe so the app picks up the connection.
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'sync' || !changes.stxAddress) return;
    const newAddr = changes.stxAddress.newValue;
    if (newAddr) {
      banner.classList.remove('show');
      try { frame.contentWindow.location.reload(); } catch { frame.src = url; }
    } else {
      banner.classList.add('show');
    }
  });

  openTabBtn.addEventListener('click', () => {
    chrome.tabs.create({ url });
  });

  frame.src = url;
}

init();
