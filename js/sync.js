// Sync between your own devices using Firebase (email + password sign-in, Firestore database).
// The app works fully without this. If Firebase is not set up, sync stays off.
import * as store from './store.js';
import { firebaseConfig } from './firebase-config.js';

const V = '10.14.1';
const CDN = `https://www.gstatic.com/firebasejs/${V}`;

let fb = null;          // loaded Firebase functions
let auth = null, db = null, user = null;
let unlisten = null, timer = null, pushing = false, again = false;
let status = { state: 'off', email: '', message: '' };
const watchers = new Set();

function setStatus(patch) {
  status = { ...status, ...patch };
  watchers.forEach((fn) => fn(status));
}
export function onStatus(fn) { watchers.add(fn); fn(status); return () => watchers.delete(fn); }
export function getStatus() { return status; }
export const isConfigured = () => !!(firebaseConfig && firebaseConfig.apiKey);

export async function init() {
  if (!isConfigured()) return setStatus({ state: 'off' });
  setStatus({ state: 'loading' });
  try {
    const [app, a, f] = await Promise.all([
      import(`${CDN}/firebase-app.js`),
      import(`${CDN}/firebase-auth.js`),
      import(`${CDN}/firebase-firestore.js`),
    ]);
    fb = { ...a, ...f };
    const fapp = app.initializeApp(firebaseConfig);
    auth = a.getAuth(fapp);
    db = f.getFirestore(fapp);
  } catch (e) {
    // Usually: first launch with no signal. Try again when back online.
    setStatus({ state: 'offline', message: 'Sync will start when you have signal.' });
    window.addEventListener('online', init, { once: true });
    return;
  }
  fb.onAuthStateChanged(auth, (u) => {
    user = u;
    if (unlisten) { unlisten(); unlisten = null; }
    if (!u) return setStatus({ state: 'signedOut', email: '' });
    setStatus({ state: 'syncing', email: u.email });
    listen();
  });
  store.subscribe(() => schedulePush());
  window.addEventListener('online', () => schedulePush(0));
  window.addEventListener('offline', () => user && setStatus({ state: 'offline', message: 'Changes will sync when you have signal.' }));
}

const ref = () => fb.doc(db, 'users', user.uid);
const parse = (snap) => (snap.exists() ? JSON.parse(snap.data().data) : null);

function listen() {
  unlisten = fb.onSnapshot(ref(), (snap) => {
    const remote = parse(snap);
    const merged = store.merge(store.getData(), remote);
    store.replaceAll(merged);
    if (!remote || store.stable(merged) !== store.stable(remote)) schedulePush(0);
    else setStatus({ state: 'synced', message: '' });
  }, (err) => setStatus({ state: 'error', message: friendly(err) }));
}

function schedulePush(delay = 800) {
  if (!user) return;
  clearTimeout(timer);
  timer = setTimeout(push, delay);
}

async function push() {
  if (!user) return;
  if (pushing) { again = true; return; }
  pushing = true;
  setStatus({ state: 'syncing' });
  try {
    await fb.runTransaction(db, async (tx) => {
      const remote = parse(await tx.get(ref()));
      const merged = store.merge(store.getData(), remote);
      if (!remote || store.stable(merged) !== store.stable(remote)) {
        tx.set(ref(), { data: JSON.stringify(merged), updatedAt: Date.now() });
      }
      store.replaceAll(merged);
    });
    setStatus({ state: 'synced', message: '' });
  } catch (err) {
    setStatus(navigator.onLine
      ? { state: 'error', message: friendly(err) }
      : { state: 'offline', message: 'Changes will sync when you have signal.' });
  } finally {
    pushing = false;
    if (again) { again = false; schedulePush(0); }
  }
}

function ready() { if (!auth) throw { code: 'auth/network-request-failed' }; }
export async function signIn(email, password) {
  ready();
  await fb.signInWithEmailAndPassword(auth, email.trim(), password);
}
export async function createAccount(email, password) {
  ready();
  await fb.createUserWithEmailAndPassword(auth, email.trim(), password);
}
export async function signOut() { await fb.signOut(auth); }

export function friendly(err) {
  const code = (err && err.code) || '';
  const map = {
    'auth/invalid-credential': 'Wrong email or password.',
    'auth/wrong-password': 'Wrong email or password.',
    'auth/user-not-found': 'No account with that email.',
    'auth/invalid-email': 'That email does not look right.',
    'auth/email-already-in-use': 'That email already has an account. Sign in instead.',
    'auth/weak-password': 'Password must be at least 6 characters.',
    'auth/network-request-failed': 'No signal. Try again when you are online.',
    'auth/too-many-requests': 'Too many tries. Wait a minute and try again.',
    'permission-denied': 'The database refused access. Check the Firebase rules step.',
  };
  return map[code] || (err && err.message) || 'Something went wrong.';
}
