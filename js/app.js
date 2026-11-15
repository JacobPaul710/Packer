// Starts the app: loads data, picks the screen from the address (#/...), redraws on changes.
import * as store from './store.js';
import * as sync from './sync.js';
import { applyMode } from './mode.js';
import { homeScreen, tripScreen, signInScreen, notesScreen } from './ui.js';

const root = document.getElementById('app');
const state = { route: '' };
let current = null;

const go = (hash) => { if (location.hash !== hash) location.hash = hash; else render(); };

function render() {
  const hash = location.hash || '#/';
  const sameRoute = hash === state.route;
  const scroll = sameRoute ? window.scrollY : 0;
  state.route = hash;

  let screen;
  const m = hash.match(/^#\/trip\/(.+)$/);
  if (sync.getStatus().state === 'signedOut') screen = signInScreen({ render });
  else if (hash === '#/notes') screen = notesScreen({ go });
  else if (m) screen = tripScreen({ tripId: decodeURIComponent(m[1]), go, render });
  else screen = homeScreen({ go });

  if (current && current.cleanup) current.cleanup();
  current = screen;
  root.replaceChildren(screen);
  window.scrollTo(0, scroll);
  markStuck();
}

applyMode();
store.load();
store.subscribe((d, what) => { if (what !== 'notes') render(); });
let lastState = null;
let lastEmail = null;
sync.onStatus((st) => {
  const gate = st.state === 'signedOut';
  if (gate !== lastState) { lastState = gate; render(); }
  else if ((st.email || '') !== lastEmail && !location.hash.startsWith('#/notes')) render(); // show who is signed in
  lastEmail = st.email || '';
});
window.addEventListener('hashchange', render);
// Progress bar gets a solid background only while it is stuck under the top bar.
function markStuck() {
  const bar = document.querySelector('.progress'), top = document.querySelector('.bar');
  if (bar && top) bar.classList.toggle('stuck', window.scrollY > 0 && bar.getBoundingClientRect().top <= top.getBoundingClientRect().bottom + 1);
}
window.addEventListener('scroll', markStuck, { passive: true });
let resizeTimer;
window.addEventListener('resize', () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(() => { if (location.hash.startsWith('#/trip/')) render(); }, 250); });
render();

// Ask the browser to keep our data (helps on Android; iPhone keeps it once installed).
if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
}

sync.init();
