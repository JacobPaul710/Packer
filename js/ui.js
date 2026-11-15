// Screens and popups. Reads and changes data only through store.js and sync.js.
import * as store from './store.js';
import * as sync from './sync.js';
import { getMode, setMode } from './mode.js';
import { APP_VERSION } from './version.js';
import { sceneURL, isPixel, patternURL, wallpaperURL, wallpaperIsPixel } from './themes.js';

// ---------- tiny helpers ----------
export function h(tag, props = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v === undefined || v === null || v === false) continue;
    if (k.startsWith('on')) el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'class') el.className = v;
    else if (k === 'text') el.textContent = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const kid of kids.flat()) if (kid !== null && kid !== undefined && kid !== false) el.append(kid);
  return el;
}

const icon = {
  back: '‹',
  check: '✓',
  pencil: '✎',
};

function header({ back, title, action }) {
  return h('header', { class: 'bar' },
    back ? h('button', { class: 'btn ghost bar-left', onclick: back.onClick, 'aria-label': back.label }, h('span', { class: 'chev', text: icon.back }), back.label) : h('span', { class: 'bar-left' }),
    h('h1', { class: 'bar-title', text: title }),
    action ? h('button', { class: 'btn ghost bar-right', onclick: action.onClick, 'aria-label': action.aria || action.label }, action.label) : h('span', { class: 'bar-right' }),
  );
}

// ---------- popups (one style for all) ----------
function openSheet(build) {
  return new Promise((resolve) => {
    const overlay = h('div', { class: 'overlay' });
    const sheet = h('div', { class: 'sheet', role: 'dialog', 'aria-modal': 'true' });
    const close = (value) => { overlay.remove(); document.body.classList.remove('locked'); resolve(value); };
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(null); });
    build(sheet, close);
    overlay.append(sheet);
    document.body.append(overlay);
    document.body.classList.add('locked');
    const first = sheet.querySelector('input[type=text], input[type=email]');
    if (first) setTimeout(() => first.focus(), 50);
  });
}

export function confirmBox({ title, message, ok = 'OK', danger = false }) {
  return openSheet((s, close) => {
    s.append(
      h('h2', { class: 'sheet-title', text: title }),
      message ? h('p', { class: 'sheet-text', text: message }) : null,
      h('div', { class: 'actions' },
        h('button', { class: 'btn', onclick: () => close(false) }, 'Cancel'),
        h('button', { class: 'btn ' + (danger ? 'danger' : 'primary'), onclick: () => close(true) }, ok)),
    );
  }).then((v) => v === true);
}

/** Add or edit an item. tripId is the trip you are looking at. */
export function itemPopup(tripId, itemId = null, headingId = null) {
  const existing = itemId ? store.item(itemId) : null;
  return openSheet((s, close) => {
    const name = h('input', { type: 'text', class: 'field', value: existing ? existing.name : '', 'aria-label': 'Item name', enterkeyhint: 'done' });

    const NEW = '__new__';
    const heads = store.headings();
    const select = h('select', { class: 'field', 'aria-label': 'Heading' },
      heads.map((hd) => h('option', { value: hd.id, text: hd.name })),
      h('option', { value: NEW, text: 'New heading…' }));
    if (existing) select.value = existing.headingId;
    else if (headingId) select.value = headingId;
    else if (!heads.length) select.value = NEW;
    const newHead = h('input', { type: 'text', class: 'field', placeholder: 'New heading name', 'aria-label': 'New heading name' });
    const newWrap = h('div', { class: 'label' + (select.value === NEW ? '' : ' hidden') }, newHead);
    select.addEventListener('change', () => { newWrap.classList.toggle('hidden', select.value !== NEW); if (select.value === NEW) newHead.focus(); });

    const chosen = new Set(existing ? existing.trips : [tripId]);
    const tripRows = store.trips().map((t) => {
      const row = h('button', { class: 'check-row' + (chosen.has(t.id) ? ' on' : ''), type: 'button', 'aria-pressed': String(chosen.has(t.id)) },
        h('span', { class: 'box', text: icon.check }), h('span', { text: t.name }));
      row.addEventListener('click', () => {
        chosen.has(t.id) ? chosen.delete(t.id) : chosen.add(t.id);
        row.classList.toggle('on', chosen.has(t.id));
        row.setAttribute('aria-pressed', String(chosen.has(t.id)));
      });
      return row;
    });

    const error = h('p', { class: 'error hidden' });
    const save = () => {
      const n = name.value.trim();
      if (!n) { error.textContent = 'Type a name for the item.'; error.classList.remove('hidden'); return name.focus(); }
      let headingId = select.value;
      if (headingId === NEW) {
        if (!newHead.value.trim()) { error.textContent = 'Type a name for the new heading.'; error.classList.remove('hidden'); return newHead.focus(); }
        headingId = store.addHeading(newHead.value);
      }
      const payload = { name: n, headingId, trips: [...chosen] };
      existing ? store.updateItem(existing.id, payload) : store.addItem(payload);
      close(true);
    };
    name.addEventListener('keydown', (e) => { if (e.key === 'Enter') save(); });

    s.append(
      h('h2', { class: 'sheet-title', text: existing ? 'Edit item' : 'Add item' }),
      h('label', { class: 'label' }, 'Name', name),
      h('label', { class: 'label' }, 'Heading', select),
      newWrap,
      h('div', { class: 'label' }, 'Trip types', h('div', { class: 'check-list' }, tripRows)),
      error,
      h('div', { class: 'actions' },
        h('button', { class: 'btn', onclick: () => close(null) }, 'Cancel'),
        h('button', { class: 'btn primary', onclick: save }, 'Save')),
    );

    if (existing) {
      s.append(h('button', {
        class: 'btn danger-text wide',
        onclick: async () => {
          close(null);
          const ok = await confirmBox({
            title: `Remove “${existing.name}”?`,
            message: `It comes off ${store.trip(tripId).name} only. If it is on no other trip, it goes to Removed items, where you can bring it back.`,
            ok: 'Remove', danger: true,
          });
          if (ok) store.removeItemFromTrip(existing.id, tripId);
        },
      }, 'Remove from this trip'));
    }

    if (!existing) {
      const hidden = store.hiddenItems();
      if (hidden.length) {
        s.append(h('div', { class: 'label' }, 'Or bring back a removed item',
          h('div', { class: 'check-list' }, hidden.map((i) => h('button', {
            class: 'check-row', type: 'button',
            onclick: () => { store.restoreItemToTrip(i.id, tripId); close(true); },
          }, h('span', { class: 'box plus', text: '+' }), h('span', { text: i.name }))))));
      }
    }
  });
}

export function headingPopup(headingId) {
  const hd = store.heading(headingId);
  return openSheet((s, close) => {
    const input = h('input', { type: 'text', class: 'field', value: hd.name, 'aria-label': 'Heading name', enterkeyhint: 'done' });
    const save = () => { if (input.value.trim()) { store.renameHeading(hd.id, input.value); close(true); } else input.focus(); };
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') save(); });
    s.append(
      h('h2', { class: 'sheet-title', text: 'Edit heading' }),
      h('label', { class: 'label' }, 'Name', input),
      h('p', { class: 'sheet-note', text: 'Headings are shared by all trip types.' }),
      h('div', { class: 'actions' },
        h('button', { class: 'btn', onclick: () => close(null) }, 'Cancel'),
        h('button', { class: 'btn primary', onclick: save }, 'Save')),
      h('button', {
        class: 'btn danger-text wide',
        onclick: async () => {
          close(null);
          const ok = await confirmBox({
            title: `Delete heading “${hd.name}”?`,
            message: 'It is removed from every trip type. Its items stay, and move under “Other”.',
            ok: 'Delete', danger: true,
          });
          if (ok) store.deleteHeading(hd.id);
        },
      }, 'Delete heading'),
    );
  });
}

// ---------- screens ----------
export function homeScreen({ go }) {
  const list = store.trips();
  const tiles = list.map((t) => {
    const p = store.progress(t.id);
    const art = h('span', { class: 'tile-art' + (isPixel(t.theme) ? ' pixel' : ''), style: `background-image:url("${sceneURL(t.theme)}")`, 'aria-hidden': 'true' });
    return h('button', { class: 'tile' + (p.complete ? ' done' : ''), onclick: () => go('#/trip/' + t.id) }, art,
      h('span', { class: 'tile-name', text: t.name }),
      h('span', { class: 'meter' }, h('span', { style: `width:${p.total ? (100 * p.packed) / p.total : 0}%` })));
  });

  return h('div', { class: 'screen' },
    header({ title: 'Select trip type' }),
    h('main', { class: 'content' },
      list.length ? h('div', { class: 'tiles' }, tiles) : h('p', { class: 'empty', text: 'No trip types yet.' }),
      h('button', { class: 'tile', onclick: () => go('#/notes') },
        h('span', { class: 'tile-art' + (isPixel('notes') ? ' pixel' : ''), style: `background-image:url("${sceneURL('notes')}")`, 'aria-hidden': 'true' }),
        h('span', { class: 'tile-name', text: 'Trip notes' }),
        h('span', { class: 'tile-progress', text: 'Notes and trip goals' })),
      footer(go)));
}

function footer(go) {
  const mode = getMode();
  const pick = (m) => { setMode(m); go(location.hash || '#/'); };
  return h('div', { class: 'footer' },
    h('div', { class: 'mode-switch', role: 'group', 'aria-label': 'Day or night mode' },
      h('button', { class: mode === 'light' ? 'on' : '', 'aria-pressed': String(mode === 'light'), onclick: () => pick('light') }, '☀️ Day'),
      h('button', { class: mode === 'dark' ? 'on' : '', 'aria-pressed': String(mode === 'dark'), onclick: () => pick('dark') }, '🌙 Night')),
    versionButton(),
    accountLine());
}

// Who is signed in, small; tap to sign out.
function accountLine() {
  const st = sync.getStatus();
  if (!st.email) return null;
  return h('button', { class: 'version account', type: 'button', 'aria-label': `Signed in as ${st.email}. Tap to sign out.`, onclick: async () => {
    const ok = await confirmBox({ title: 'Sign out?', message: 'Your lists stay on this device. They stop syncing until you sign in again.', ok: 'Sign out' });
    if (ok) await sync.signOut();
  } }, `${st.email} · Sign out`);
}

// Tap the version text to check for a newer version; if there is one, clear the offline copy and reload.
function versionButton() {
  const label = `Packer · ${APP_VERSION}`;
  const btn = h('button', { class: 'version', type: 'button', 'aria-label': `${label}. Tap to check for updates.`, text: label });
  let busy = false;
  const flash = (msg, ms = 2500) => { btn.textContent = msg; setTimeout(() => { btn.textContent = label; busy = false; }, ms); };
  btn.addEventListener('click', async () => {
    if (busy) return;
    busy = true;
    btn.textContent = 'Checking…';
    try {
      const res = await fetch('js/version.js?fresh=' + Date.now(), { cache: 'no-store' });
      if (!res.ok) throw new Error('offline');
      const latest = ((await res.text()).match(/APP_VERSION\s*=\s*'([^']+)'/) || [])[1];
      if (!latest || latest === APP_VERSION) return flash('Up to date');
      btn.textContent = `Updating to ${latest}…`;
      const reg = await navigator.serviceWorker?.getRegistration();
      await reg?.update().catch(() => {});
      if (window.caches) for (const k of await caches.keys()) if (k.startsWith('packlist-')) await caches.delete(k);
      location.reload();
    } catch {
      flash('No signal. Try again later.');
    }
  });
  return btn;
}

/** Trip notes: one card per note, saved as you type, with + to add a card. */
export function notesScreen({ go }) {
  const saved = h('p', { class: 'hint last-saved' });
  const showSaved = (ts) => {
    if (!ts || ts < 1000) { saved.textContent = ''; return; }
    const d = new Date(ts), same = d.toDateString() === new Date().toDateString();
    const time = d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
    saved.textContent = 'Last saved ' + (same ? time : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) + ', ' + time);
  };
  const cards = store.noteCards();
  showSaved(Math.max(0, ...cards.map((c) => c.updatedAt || 0)));
  const boxes = cards.map(({ id, title }) => {
    const box = h('textarea', { class: 'field notes-field', 'aria-label': title, spellcheck: 'true' });
    box.value = store.notesText(id);
    let timer;
    const flush = () => { clearTimeout(timer); if (box.value !== store.notesText(id)) { store.setNotes(id, box.value); showSaved(store.noteUpdatedAt(id)); } };
    const grow = () => { box.style.height = 'auto'; box.style.height = Math.max(160, box.scrollHeight + 4) + 'px'; };
    box.addEventListener('input', () => { grow(); clearTimeout(timer); timer = setTimeout(flush, 400); });
    box.addEventListener('blur', flush);
    setTimeout(grow, 0);
    return { flush, el: h('label', { class: 'label notes-label' }, title, box) };
  });
  const flushAll = () => boxes.forEach((b) => b.flush());
  const add = h('button', { class: 'add-btn add-card', 'aria-label': 'Add a notes card', onclick: async () => {
    flushAll();
    const title = await titleBox();
    if (title) { store.addNoteCard(title); go('#/notes'); }
  } }, '+');
  const remove = h('button', { class: 'add-btn add-card', 'aria-label': 'Delete a notes card', onclick: async () => {
    flushAll();
    const card = await pickCard(store.noteCards());
    if (!card) return;
    const ok = await confirmBox({ title: `Delete “${card.title}”?`, message: 'The card and everything written in it are deleted.', ok: 'Delete', danger: true });
    if (ok) { store.deleteNoteCard(card.id); go('#/notes'); }
  } }, '−');
  return h('div', { class: 'screen' },
    header({ back: { label: 'Trips', onClick: () => { flushAll(); go('#/'); } }, title: 'Trip notes' }),
    h('main', { class: 'content' }, boxes.map((b) => b.el), h('div', { class: 'card-tools' }, add, cards.length ? remove : null), saved));
}

/** Pick a notes card to delete. */
function pickCard(cards) {
  return openSheet((s, close) => {
    s.append(h('h2', { class: 'sheet-title', text: 'Delete which card?' }),
      h('div', { class: 'check-list' }, cards.map((c) => h('button', { class: 'check-row', type: 'button', onclick: () => close(c) }, h('span', { text: c.title })))),
      h('div', { class: 'actions' }, h('button', { class: 'btn', onclick: () => close(null) }, 'Cancel')));
  });
}

function titleBox() {
  return openSheet((s, close) => {
    const input = h('input', { type: 'text', class: 'field', 'aria-label': 'Card title', placeholder: 'e.g. Gear to buy', enterkeyhint: 'done' });
    const submit = () => { const v = input.value.trim(); if (v) close(v); else input.focus(); };
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') submit(); });
    s.append(h('h2', { class: 'sheet-title', text: 'New notes card' }), h('label', { class: 'label' }, 'Title', input),
      h('div', { class: 'actions' }, h('button', { class: 'btn', onclick: () => close(null) }, 'Cancel'), h('button', { class: 'btn primary', onclick: submit }, 'Add')));
  });
}

/** Calls onLong when the element is pressed and held (or right-clicked). Returns a check for "was that a hold?". */
function onHold(el, onLong) {
  let timer = null, held = false, sx = 0, sy = 0;
  const cancel = () => { clearTimeout(timer); timer = null; };
  el.addEventListener('pointerdown', (e) => {
    held = false; sx = e.clientX; sy = e.clientY; cancel();
    timer = setTimeout(() => { held = true; timer = null; if (navigator.vibrate) navigator.vibrate(15); onLong(); }, 500);
  });
  el.addEventListener('pointermove', (e) => { if (timer && Math.hypot(e.clientX - sx, e.clientY - sy) > 10) cancel(); });
  ['pointerup', 'pointercancel', 'pointerleave'].forEach((ev) => el.addEventListener(ev, cancel));
  el.addEventListener('contextmenu', (e) => { e.preventDefault(); if (!held) { held = true; onLong(); } });
  return () => { const was = held; held = false; return was; };
}

// An icon for each category. New categories get a box.
const ICONS = {
  'h-morning': '☀️', 'h-fridge': '🧊', 'h-day-before': '📅', 'h-pantry': '🥫', 'h-food-pack': '🍎', 'h-kitchen': '🍳',
  'h-clothes': '👕', 'h-necessities': '🎒', 'h-hygiene': '🪥', 'h-medication': '💊', 'h-bedding': '🛏️',
  'h-essentials': '🪓', 'h-garage': '🏠', 'h-bin': '🧰', 'h-last-minute': '⏰', 'h-artimes': '🐕',
  'h-scouting': '💻', 'h-coding': '💻', 'h-rock-tools': '⛏️', 'h-sunstone': '🔦', 'h-fun': '🎸', 'h-winter': '❄️',
  'h-meal-choices': '🍽️', 'h-unpack': '📥', 'h-truck': '🛻', 'h-icebox': '🗃️', 'h-resupply': '🛒', 'h-seasonal': '❄️',
};
const iconFor = (h) => h.icon || ICONS[h.id] || '📦';

// Meal sub-lists in a fixed order: Breakfast, Lunch, Dinner, Snacks, then anything else.
const SUB_ORDER = ['Breakfast', 'Lunch', 'Dinner', 'Snacks'];
function subGroups(items) {
  const map = new Map();
  for (const i of items) { const k = i.sub || ''; if (!map.has(k)) map.set(k, []); map.get(k).push(i); }
  const rank = (k) => (k === '' ? -1 : SUB_ORDER.includes(k) ? SUB_ORDER.indexOf(k) : 99);
  return [...map.entries()].sort((a, b) => rank(a[0]) - rank(b[0]));
}

// Store search pages. Type one of these stores and each item gets a search button.
const STORES = [
  [/walmart/i, (q) => 'https://www.walmart.com/search?q=' + encodeURIComponent(q)],
  [/target/i, (q) => 'https://www.target.com/s?searchTerm=' + encodeURIComponent(q)],
  [/fred\s*meyer/i, (q) => 'https://www.fredmeyer.com/search?query=' + encodeURIComponent(q)],
];
const searchUrl = (storeName) => STORES.find(([re]) => re.test(storeName || ''))?.[1] || null;

// Resupply: store at the top, list to order, then order history by date and store.
function resupplyBody(tripId, items, askDelete) {
  const storeBox = h('input', { type: 'text', class: 'field', placeholder: 'Store, e.g. Walmart', 'aria-label': 'Store', enterkeyhint: 'done' });
  storeBox.value = store.resupplyStore();
  let timer;
  storeBox.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(() => store.setResupplyStore(storeBox.value), 300); });
  storeBox.addEventListener('blur', () => { clearTimeout(timer); if (storeBox.value !== store.resupplyStore()) store.setResupplyStore(storeBox.value); });

  const holdRow = (i, el) => { const held = onHold(el, () => askDelete(i)); return held; };
  const links = [];
  const syncLinks = () => {
    const url = searchUrl(storeBox.value);
    links.forEach(({ a, name }) => { a.classList.toggle('hidden', !url); if (url) a.href = url(name); });
  };
  const toOrder = items.filter((i) => !i.ordered).map((i) => {
    const btn = h('button', { class: 'item' }, h('span', { class: 'box', text: icon.check }), h('span', { class: 'item-name', text: i.name }));
    const held = holdRow(i, btn);
    btn.addEventListener('click', () => {
      if (held()) return;
      if (storeBox.value !== store.resupplyStore()) store.setResupplyStore(storeBox.value);
      store.markOrdered(i.id);
    });
    const a = h('a', { class: 'search-btn', target: '_blank', rel: 'noopener', 'aria-label': `Search the store for ${i.name}` }, '🔎');
    links.push({ a, name: i.name });
    return h('li', { class: 'search-row' }, btn, a);
  });
  storeBox.addEventListener('input', syncLinks);
  syncLinks();

  const groups = new Map();
  items.filter((i) => i.ordered).forEach((i) => {
    const k = i.ordered.date + '|' + i.ordered.store;
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(i);
  });
  const fmt = (iso) => new Date(iso + 'T12:00:00').toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
  const history = [...groups.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1)).map(([k, list]) => {
    const [date, shop] = k.split('|');
    return h('div', { class: 'order-group' },
      h('p', { class: 'order-head', text: `${fmt(date)} · ${shop}` }),
      h('ul', { class: 'items' }, list.map((i) => {
        const btn = h('button', { class: 'item packed' }, h('span', { class: 'box', text: icon.check }), h('span', { class: 'item-name', text: i.name }));
        const held = holdRow(i, btn);
        btn.addEventListener('click', () => { if (!held()) store.unmarkOrdered(i.id); }); // tap to move back to the list
        return h('li', {}, btn);
      })));
  });

  return h('div', { class: 'resupply' },
    h('label', { class: 'label' }, 'Ordering from', storeBox),
    toOrder.length ? h('ul', { class: 'items' }, toOrder) : h('p', { class: 'hint off-hint', text: 'Nothing to order. Tap + to add items.' }),
    history.length ? h('p', { class: 'sub-label', text: 'Order history' }) : null,
    ...history);
}

// Which categories are open or closed (kept while the app is open).
const collapse = new Map(), wasComplete = new Set();
let rerender = () => {};

export function tripScreen({ tripId, go, render }) {
  rerender = render || rerender;
  const t = store.trip(tripId);
  if (!t) { go('#/'); return h('div'); }
  const p = store.progress(tripId);
  const groups = store.groupedForTrip(tripId);

  const sections = groups.map(({ heading, items, on }) => {
    const info = store.isInfo(heading);
    const resupply = store.isResupply(heading);
    const counted = items.filter((i) => store.itemCounts(tripId, i));
    const done = counted.filter((i) => store.isPacked(tripId, i.id)).length;
    const complete = !info && !resupply && counted.length > 0 && done === counted.length;
    const key = tripId + '|' + heading.id;
    // a category closes by itself the moment it is fully packed
    if (complete && !wasComplete.has(key)) collapse.delete(key);
    complete ? wasComplete.add(key) : wasComplete.delete(key);
    const open = collapse.has(key) ? collapse.get(key) : false; // every category starts closed

    const toOrder = items.filter((i) => !i.ordered).length;
    const status = !on ? null
      : resupply ? h('span', { class: 'chip' + (toOrder ? ' todo' : ''), text: `${toOrder} to order` })
      : heading.id === 'h-meal-choices' ? null
      : info ? h('span', { class: 'chip', text: `${items.length} items` })
      : complete ? h('span', { class: 'chip done', text: '✓ Done' })
      : open ? null : h('span', { class: 'chip todo', text: `${done} of ${counted.length}` });
    const title = h('button', { class: 'group-title', 'aria-expanded': String(on && open) },
      on ? h('span', { class: 'chev' + (open ? ' open' : ''), text: '›' }) : null,
      h('span', { class: 'cat-icon', text: iconFor(heading), 'aria-hidden': 'true' }), h('span', { text: heading.name }));
    const wasHold = onHold(title, () => headingPopup(heading.id));
    title.addEventListener('click', () => { if (wasHold() || !on) return; collapse.set(key, !open); rerender(); });

    const askDelete = (i) => confirmBox({ title: `Delete “${i.name}”?`, message: `It comes off ${store.tripTitle(t)} only.`, ok: 'Delete', danger: true })
      .then((ok) => { if (ok) store.removeItemFromTrip(i.id, tripId); });
    const row = (i) => {
      const packed = !info && store.isPacked(tripId, i.id);
      const parts = !info && i.parts?.length ? i.parts : null;
      const btn = h('button', { class: 'item' + (packed ? ' packed' : '') + (info ? ' info' : '') + (parts ? ' has-parts' : ''), 'aria-pressed': info ? null : String(packed) },
        info ? h('span', { class: 'dot-bullet' }) : h('span', { class: 'box', text: icon.check }),
        h('span', { class: 'item-name', text: i.name }),
        parts ? h('span', { class: 'parts-count', text: `${parts.filter((_, k) => store.isPartPacked(tripId, i.id, k)).length} of ${parts.length}` }) : null);
      const held = onHold(btn, () => askDelete(i));
      // items with parts check themselves once every part is checked
      btn.addEventListener('click', () => { if (!held() && !info && !parts) store.togglePacked(tripId, i.id); });
      if (!parts) return h('li', {}, btn);
      return h('li', {}, btn, h('ul', { class: 'parts' }, parts.map((name, k) => {
        const on = store.isPartPacked(tripId, i.id, k);
        return h('li', {}, h('button', { class: 'item part' + (on ? ' packed' : ''), 'aria-pressed': String(on), onclick: () => store.togglePart(tripId, i.id, k) },
          h('span', { class: 'box', text: icon.check }), h('span', { class: 'item-name', text: name })));
      })));
    };

    return h('section', { class: 'group' + (on ? '' : ' off') + (info ? ' info' : '') + (complete ? ' complete' : '') },
      h('div', { class: 'group-head' },
        title,
        h('div', { class: 'group-tools' },
          status,
          heading.optional ? h('button', {
            class: 'opt-toggle' + (on ? ' on' : ''), 'aria-pressed': String(on),
            onclick: () => { if (!on) collapse.set(key, true); store.toggleSection(tripId, heading.id); }, // ticking opens it
          }, h('span', { class: 'box', text: icon.check }), on ? 'Bringing' : 'Optional') : null,
          on && open && heading.id !== 'h-meal-choices' ? h('button', { class: 'add-btn', 'aria-label': `Add item to ${heading.name}`, onclick: () => itemPopup(tripId, null, heading.id) }, '+') : null)),
      !on ? h('p', { class: 'hint off-hint', text: `${items.length} items · tap Optional to include` }) : null,
      on && open && resupply ? resupplyBody(tripId, items, askDelete) : null,
      on && open && !resupply ? h('ul', { class: 'items' }, subGroups(items).flatMap(([sub, list]) => {
        if (!sub) return list.map(row);
        if (heading.optionalSubs?.includes(sub)) {
          // tick-to-open group (like Winter): checkbox row, items open underneath when ticked
          const subIsOn = store.subOn(tripId, heading.id, sub);
          const got = list.filter((i) => store.isPacked(tripId, i.id)).length;
          const toggle = h('button', { class: 'item opt-sub' + (subIsOn ? ' on' : ''), 'aria-pressed': String(subIsOn), onclick: () => store.toggleSub(tripId, heading.id, sub) },
            h('span', { class: 'box', text: icon.check }), h('span', { class: 'item-name', text: sub }),
            h('span', { class: 'parts-count', text: subIsOn ? `${got} of ${list.length}` : `${list.length} items` }));
          return [h('li', {}, toggle, subIsOn ? h('ul', { class: 'parts' }, list.map(row)) : null)];
        }
        const sk = key + '|' + sub, subOpen = !!collapse.get(sk);
        const head = h('li', {}, h('button', { class: 'sub-head', 'aria-expanded': String(subOpen), onclick: () => { collapse.set(sk, !subOpen); rerender(); } },
          h('span', { class: 'chev' + (subOpen ? ' open' : ''), text: '›' }), sub, h('span', { class: 'count', text: `${list.length}` })));
        return subOpen ? [head, ...list.map(row)] : [head];
      })) : null);
  });

  const pattern = patternURL(t.theme);
  const wall = wallpaperURL(t.theme, window.innerWidth, Math.max(window.innerHeight, window.screen?.height || 0));
  return h('div', {
    class: 'screen trip-screen' + (pattern ? ' pixel-bg' : ''),
    style: pattern ? `background-image:url("${pattern}")` : null,
  },
    wall ? h('div', { class: 'trip-wall' + (wallpaperIsPixel(t.theme) ? ' pixel' : ''), style: `background-image:url("${wall}")`, 'aria-hidden': 'true' }) : null,
    header({ back: { label: 'Trips', onClick: () => go('#/') }, title: store.tripTitle(t) }),
    h('div', { class: 'trip-banner' + (isPixel(t.theme) ? ' pixel' : ''), style: `background-image:url("${sceneURL(t.theme)}")`, 'aria-hidden': 'true' }),
    h('div', { class: 'progress' + (p.complete ? ' complete' : '') },
      h('div', { class: 'progress-row' },
        h('span', { class: 'progress-text', text: p.complete ? 'Ready to leave. Have fun!' : `${p.packed} of ${p.total} packed` }),
        h('button', { class: 'btn small', disabled: p.packed === 0 ? true : null, onclick: async () => {
          const ok = await confirmBox({ title: 'Clear all?', message: `This unchecks all ${p.total} items on ${t.name}.`, ok: 'Clear all', danger: true });
          if (ok) store.clearTrip(tripId);
        } }, 'Clear all')),
      h('span', { class: 'meter' }, h('span', { style: `width:${p.total ? (100 * p.packed) / p.total : 0}%` })),
      p.complete ? h('button', { class: 'btn primary wide done-btn', onclick: () => go('#/') }, 'Done') : null),
    h('main', { class: 'content' },
      groups.length ? sections : h('p', { class: 'empty', text: 'No items yet.' }),
      groups.length ? null : h('button', { class: 'btn primary wide', onclick: () => itemPopup(tripId) }, '+ Add item'),
    ));
}

/** Shown once, the first time you open the app (only when sync is set up). */
// Sign in, or create an account on its own page. Shown only when sync is set up and nobody is signed in.
let authMode = 'signin';
export function signInScreen({ render }) {
  const field = (type, label, auto) => h('input', { type, class: 'field', autocomplete: auto, 'aria-label': label, ...(type === 'email' ? { inputmode: 'email' } : {}) });
  const err = h('p', { class: 'error hidden' });
  const fail = (msg) => { err.textContent = msg; err.classList.remove('hidden'); };
  const swap = (mode) => { authMode = mode; render(); };
  // "Show password" switch for every password box on the page
  const showToggle = (...boxes) => {
    const row = h('button', { class: 'check-row show-pass', type: 'button', 'aria-pressed': 'false' }, h('span', { class: 'box', text: icon.check }), h('span', { text: 'Show password' }));
    row.addEventListener('click', () => {
      const on = row.getAttribute('aria-pressed') !== 'true';
      row.setAttribute('aria-pressed', String(on)); row.classList.toggle('on', on);
      boxes.forEach((b) => { b.type = on ? 'text' : 'password'; });
    });
    return row;
  };

  if (authMode === 'create') {
    const email = field('email', 'Email', 'username'), pass = field('password', 'Password', 'new-password'), again = field('password', 'Confirm password', 'new-password');
    const create = async () => {
      err.classList.add('hidden');
      if (!email.value.trim()) return fail('Type your email.');
      if (pass.value.length < 6) return fail('Password must be at least 6 characters.');
      if (pass.value !== again.value) return fail('The passwords don\u2019t match.');
      try {
        await sync.createAccount(email.value, pass.value);
        authMode = 'signin';
        notice('Account created', `You\u2019re signed in as ${email.value.trim()}.`);
      } catch (e) { fail(sync.friendly(e)); }
    };
    return h('div', { class: 'screen' },
      header({ back: { label: 'Sign in', onClick: () => swap('signin') }, title: 'Create account' }),
      h('main', { class: 'content' },
        h('section', { class: 'card' },
          h('h2', { class: 'card-title', text: 'Create account' }),
          h('label', { class: 'label' }, 'Email', email),
          h('label', { class: 'label' }, 'Password', pass),
          h('label', { class: 'label' }, 'Password again', again),
          showToggle(pass, again),
          err,
          h('button', { class: 'btn primary wide', onclick: create }, 'Create account'))));
  }

  const email = field('email', 'Email', 'username'), pass = field('password', 'Password', 'current-password');
  const signIn = async () => {
    err.classList.add('hidden');
    try { await sync.signIn(email.value, pass.value); } catch (e) { fail(sync.friendly(e)); }
  };
  pass.addEventListener('keydown', (e) => { if (e.key === 'Enter') signIn(); });
  return h('div', { class: 'screen' },
    header({ title: 'Packer' }),
    h('main', { class: 'content' },
      h('section', { class: 'card' },
        h('h2', { class: 'card-title', text: 'Sign in' }),
        h('p', { class: 'muted', text: 'Do this once on each device. Your lists then stay the same everywhere, automatically.' }),
        h('label', { class: 'label' }, 'Email', email),
        h('label', { class: 'label' }, 'Password', pass),
        showToggle(pass),
        err,
        h('button', { class: 'btn primary wide', onclick: signIn }, 'Sign in'),
        h('button', { class: 'btn wide', onclick: () => swap('create') }, 'Create account'))));
}

/** A simple message popup with one OK button. */
function notice(title, message) {
  return openSheet((s, close) => {
    s.append(h('h2', { class: 'sheet-title', text: title }), h('p', { class: 'sheet-text', text: message }),
      h('div', { class: 'actions' }, h('button', { class: 'btn primary', style: 'grid-column: 1 / -1', onclick: () => close(true) }, 'OK')));
  });
}
