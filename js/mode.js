// Day / Night mode. Follows the phone until you pick one; your pick is kept on this device.
const KEY = 'packlist.mode';
const sys = () => window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches;

export function getMode() {
  const m = localStorage.getItem(KEY);
  return m === 'dark' || m === 'light' ? m : (sys() ? 'dark' : 'light');
}
export const isDark = () => getMode() === 'dark';

export function applyMode() {
  const m = getMode();
  document.documentElement.dataset.theme = m;
  document.querySelectorAll('meta[name="theme-color"]').forEach((el) => el.setAttribute('content', m === 'dark' ? '#141a26' : '#f2ede2'));
}
export function setMode(m) { localStorage.setItem(KEY, m); applyMode(); }

if (window.matchMedia) matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', () => { if (!localStorage.getItem(KEY)) applyMode(); });
