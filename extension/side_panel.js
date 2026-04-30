// extension/side_panel.js
const DEFAULT_URL = 'https://stack-sport.vercel.app';

async function init() {
  const { appUrl } = await chrome.storage.sync.get('appUrl');
  const frame = document.getElementById('app-frame');
  const loading = document.getElementById('loading');

  frame.addEventListener('load', () => {
    loading.style.display = 'none';
    frame.style.display = 'block';
  });

  frame.src = appUrl || DEFAULT_URL;
}

init();
