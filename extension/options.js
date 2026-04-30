// extension/options.js
const DEFAULT_URL = 'https://stack-sport.vercel.app';

async function load() {
  const { appUrl } = await chrome.storage.sync.get('appUrl');
  document.getElementById('app-url').value = appUrl || '';
}

document.getElementById('save-btn').addEventListener('click', async () => {
  const raw = document.getElementById('app-url').value.trim();
  const url = raw || DEFAULT_URL;

  try { new URL(url); } catch {
    document.getElementById('status').textContent = 'Invalid URL';
    return;
  }

  await chrome.storage.sync.set({ appUrl: raw || null });
  document.getElementById('status').textContent = 'Saved!';
  setTimeout(() => { document.getElementById('status').textContent = ''; }, 2000);
});

document.getElementById('reset-btn').addEventListener('click', async () => {
  await chrome.storage.sync.remove('appUrl');
  document.getElementById('app-url').value = '';
  document.getElementById('status').textContent = 'Reset to default';
  setTimeout(() => { document.getElementById('status').textContent = ''; }, 2000);
});

load();
