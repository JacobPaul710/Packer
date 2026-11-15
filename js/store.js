import { STARTER } from './starter.js';
// Data and logic only. No screen code here.
// Every record has updatedAt; deleted records stay as "deleted: true" so sync can merge.

const KEY = 'packlist.v1';
const listeners = new Set();
let data = null;

const now = () => Date.now();
const uid = () => Math.random().toString(36).slice(2, 10) + now().toString(36);

function emptyData() {
  return { version: 1, trips: {}, headings: {}, items: {}, packed: {}, sections: {}, notes: {} };
}

// Reference sections: shown closed, nothing to check, not counted in progress.
const INFO = ['h-breakfast', 'h-lunch', 'h-dinner', 'h-meal-choices', 'h-unpack'];

const TRIPS = [['t-camp', 'Traditional', 'camp'], ['t-scout', 'Scout', 'scout'], ['t-rock', 'Rock Hounding', 'rock']];
const tripIdFor = { camp: 't-camp', scout: 't-scout', rock: 't-rock' };

/** Adds the starter trips, headings, items and notes. Never overwrites records that already exist. */
function addStarter(d) {
  const T = 1; // fixed time: any real edit is newer and wins when devices sync
  const put = (map, rec) => { if (!d[map][rec.id]) d[map][rec.id] = { ...rec, updatedAt: T }; };
  TRIPS.forEach(([id, name, theme], i) => put('trips', { id, name, theme, order: i + 1 }));
  let n = 0;
  STARTER.sections.forEach((sec, i) => {
    const hid = 'h-' + sec.id;
    put('headings', { id: hid, name: sec.name, order: i + 1, ...(sec.optional ? { optional: true } : {}), ...(INFO.includes(hid) ? { kind: 'info' } : {}) });
    sec.items.forEach((name, k) => put('items', { id: `i-${sec.id}-${k + 1}`, name, headingId: hid, trips: sec.trips.map((t) => tripIdFor[t]), created: ++n }));
  });
  put('notes', { id: 'main', text: STARTER.notes });
}

function seed() { const d = emptyData(); addStarter(d); return d; }

// ---------- persistence ----------
const MIGRATED = 'packlist.migrated';
const CURRENT = '17';

export function load() {
  try { data = JSON.parse(localStorage.getItem(KEY)); } catch { data = null; }
  if (!data || data.version !== 1) { data = seed(); save(false); localStorage.setItem(MIGRATED, '9'); }
  migrate();
  return data;
}

// Patch 9: the placeholder lists are replaced with your real lists. Runs once per device.
function migrate() {
  const from = Number(localStorage.getItem(MIGRATED) || 0);
  if (from >= Number(CURRENT)) return;
  if (from < 9) migrate9();
  if (from < 12) migrate12();
  if (from < 13) migrate13();
  if (from < 14) migrate14();
  if (from < 15) migrate15();
  if (from < 16) migrate16();
  if (from < 17) migrate17();
  save(false);
  localStorage.setItem(MIGRATED, CURRENT);
}

// Patch 12: meal lists and unpacking become reference sections (not counted, open when you need them).
function migrate12() {
  const t = now();
  for (const id of INFO) {
    const h = data.headings[id];
    if (!h || h.deleted) continue;
    data.headings[id] = { ...h, kind: 'info', ...(id === 'h-unpack' && h.name === 'Unpack after' ? { name: 'Immediate unpack' } : {}), updatedAt: t };
  }
}

// Patch 13: Morning of trip first, then Fridge, then Day before trip; meals merged into one Meal choices section.
function migrate13() {
  const t = now();
  const set = (id, patch) => { const h = data.headings[id]; if (h && !h.deleted) data.headings[id] = { ...h, ...patch, updatedAt: t }; };
  if (data.headings['h-morning']?.name === 'Morning') set('h-morning', { name: 'Morning of trip' });
  set('h-morning', { order: 1 }); set('h-fridge', { order: 2 }); set('h-day-before', { order: 3 });
  if (!heading('h-meal-choices')) return;
  for (const i of Object.values(data.items)) {
    if (i.deleted) continue;
    if (i.headingId === 'h-meal-choices' && !i.sub) data.items[i.id] = { ...i, sub: 'Other choices', updatedAt: t };
  }
  for (const id of ['h-breakfast', 'h-lunch', 'h-dinner']) {
    const h = data.headings[id];
    if (!h || h.deleted) continue;
    for (const i of Object.values(data.items)) {
      if (!i.deleted && i.headingId === id) data.items[i.id] = { ...i, headingId: 'h-meal-choices', sub: h.name, updatedAt: t };
    }
    data.headings[id] = { ...h, deleted: true, updatedAt: t };
  }
}

// Patch 14: your list review (already applied on your devices; details removed from the public code).
function migrate14() {}

// Patch 15: Ice box leaves the app (kept in ICEBOX.md); a few items come back.
function migrate15() {
  const t = now();
  const ALL = ['t-camp', 't-scout', 't-rock'];
  const find = (hid, name) => Object.values(data.items).find((i) => !i.deleted && i.headingId === hid && i.name.toLowerCase() === name.toLowerCase());
  const upd = (it, patch) => { if (it) data.items[it.id] = { ...it, ...patch, updatedAt: t }; };
  const addIfMissing = (hid, name, created) => {
    const id = 'i-p15-' + name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    if (!data.items[id] && !find(hid, name)) data.items[id] = { id, name, headingId: hid, trips: ALL, created, updatedAt: t };
  };
  const maxC = Math.max(0, ...Object.values(data.items).map((i) => i.created || 0));
  if (data.headings['h-necessities'] && !data.headings['h-necessities'].deleted) {
    addIfMissing('h-necessities', 'Body sunscreen', maxC + 1);
    addIfMissing('h-necessities', 'Face sunscreen', maxC + 2);
  }
  // Fill personal Bubba goes back to Morning of trip, right after Precool fridge
  const bubba = find('h-icebox', 'Fill personal Bubba'), pre = find('h-morning', 'Precool fridge');
  if (bubba) upd(bubba, { headingId: 'h-morning', created: pre ? pre.created + 0.5 : maxC + 3 });
  // everything else in the Ice box is removed from the app
  for (const i of Object.values(data.items)) if (!i.deleted && i.headingId === 'h-icebox') upd(i, { deleted: true });
  const ib = data.headings['h-icebox'];
  if (ib && !ib.deleted) data.headings['h-icebox'] = { ...ib, deleted: true, updatedAt: t };
}

// Patch 18: Last minute stuff first, then Morning of trip, Day before trip, Fridge.
function migrate16() {
  const t = now();
  [['h-last-minute', 0], ['h-morning', 1], ['h-day-before', 2], ['h-fridge', 3]].forEach(([id, order]) => {
    const h = data.headings[id];
    if (h && !h.deleted) data.headings[id] = { ...h, order, updatedAt: t };
  });
}

// Patch 19: garage list split up; new Seasonal category.
function garageCleanup(t) {
  const live = (id) => data.headings[id] && !data.headings[id].deleted;
  if (!live('h-garage')) return;
  const ALL = ['t-camp', 't-scout', 't-rock'];
  const find = (name) => Object.values(data.items).find((i) => !i.deleted && i.headingId === 'h-garage' && i.name === name);
  const maxC = () => Math.max(0, ...Object.values(data.items).map((i) => i.created || 0));
  const upd = (it, patch) => { if (it) data.items[it.id] = { ...it, ...patch, updatedAt: t }; };
  const add = (id, name, headingId) => { if (!data.items[id]) data.items[id] = { id, name, headingId, trips: ALL, created: maxC() + 1, updatedAt: t }; };
  if (live('h-necessities')) {
    upd(find('Containers of drinking water'), { headingId: 'h-necessities', created: maxC() + 1 });
    add('i-p19-howl-r4', 'Howl R4', 'h-necessities');
  }
  if (live('h-truck')) upd(find('Camp chair'), { headingId: 'h-truck', created: maxC() + 1 });
  ['Fire starter', 'Propane burner', 'Kindling', 'Firewood'].forEach((n) => upd(find(n), { deleted: true }));
  const winter = data.headings['h-winter'];
  if (!data.headings['h-seasonal']) data.headings['h-seasonal'] = { id: 'h-seasonal', name: 'Seasonal', order: winter ? winter.order - 0.5 : 998, updatedAt: t };
  add('i-p19-kindling-firewood', 'Kindling/firewood', 'h-seasonal');
  for (const i of Object.values(data.items)) if (!i.deleted && i.headingId === 'h-garage') upd(i, { headingId: 'h-truck' });
  data.headings['h-garage'] = { ...data.headings['h-garage'], deleted: true, updatedAt: t };
}

// Patch 19: Resupply section on Scout, between Pantry inventory and Immediate unpack.
function migrate17() {
  const t = now();
  for (const i of Object.values(data.items)) if (!i.deleted && i.sub === 'Lunch (driving)') data.items[i.id] = { ...i, sub: 'Lunch', updatedAt: t };
  garageCleanup(t);
  if (data.headings['h-resupply']) return;
  const pantry = data.headings['h-pantry'], unpack = data.headings['h-unpack'];
  const order = pantry && unpack ? (pantry.order + unpack.order) / 2 : 999;
  data.headings['h-resupply'] = { id: 'h-resupply', name: 'Resupply', kind: 'resupply', showOn: ['t-scout'], order, updatedAt: now() };
}

function migrate9() {
  const t = now();
  data.sections = data.sections || {};
  data.notes = data.notes || {};
  for (const k of ['trips', 'headings', 'items']) {
    for (const r of Object.values(data[k])) if (!r.id.startsWith(k[0] + '-')) data[k][r.id] = { ...r, deleted: true, updatedAt: t };
  }
  for (const key of Object.keys(data.packed)) data.packed[key] = { v: false, updatedAt: t };
  addStarter(data);
}

function save(notify = true) {
  localStorage.setItem(KEY, JSON.stringify(data));
  if (notify) listeners.forEach((fn) => fn(data));
}

export function subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); }
export function getData() { return data; }

// ---------- reads ----------
const alive = (map) => Object.values(map).filter((r) => !r.deleted);

export function trips() { return alive(data.trips).sort((a, b) => a.order - b.order || a.name.localeCompare(b.name)); }
export function trip(id) { const t = data.trips[id]; return t && !t.deleted ? t : null; }
export function headings() { return alive(data.headings).sort((a, b) => a.order - b.order || a.name.localeCompare(b.name)); }
export function heading(id) { const h = data.headings[id]; return h && !h.deleted ? h : null; }
export function item(id) { const i = data.items[id]; return i && !i.deleted ? i : null; }

export function itemsForTrip(tripId) {
  return alive(data.items).filter((i) => i.trips.includes(tripId)).sort((a, b) => a.created - b.created);
}

/** Headings with their items for one trip. Empty headings are left out. */
export function groupedForTrip(tripId) {
  const items = itemsForTrip(tripId);
  const groups = headings().map((h) => ({ heading: h, on: sectionOn(tripId, h), items: items.filter((i) => i.headingId === h.id) }));
  return groups.filter((g) => g.items.length || g.heading.showOn?.includes(tripId)); // some sections show even when empty
}

// Optional sections (like Fun stuff): off by default; while off, their items are hidden and not counted.
const skey = (tripId, headingId) => tripId + '|' + headingId;
export function sectionOn(tripId, h) {
  const hd = typeof h === 'string' ? heading(h) : h;
  if (!hd || !hd.optional) return true;
  return !!data.sections?.[skey(tripId, hd.id)]?.v;
}
export function toggleSection(tripId, headingId) {
  data.sections[skey(tripId, headingId)] = { v: !sectionOn(tripId, headingId), updatedAt: now() };
  save();
}
export const isInfo = (h) => (typeof h === 'string' ? heading(h) : h)?.kind === 'info';
export const isResupply = (h) => (typeof h === 'string' ? heading(h) : h)?.kind === 'resupply';
const countedItems = (tripId) => itemsForTrip(tripId).filter((i) => sectionOn(tripId, i.headingId) && !isInfo(i.headingId) && !isResupply(i.headingId));

// Resupply: check an item when you order it; it moves to order history with the date and store.
const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
export function resupplyStore() { return notesText('resupply-store'); }
export function setResupplyStore(text) { data.notes['resupply-store'] = { id: 'resupply-store', kind: 'setting', text, updatedAt: now() }; save(false); listeners.forEach((fn) => fn(data, 'notes')); }
export function markOrdered(itemId) {
  const i = data.items[itemId];
  data.items[itemId] = { ...i, ordered: { date: today(), store: resupplyStore().trim() || 'No store' }, updatedAt: now() };
  save();
}
export function unmarkOrdered(itemId) {
  const { ordered, ...rest } = data.items[itemId];
  data.items[itemId] = { ...rest, updatedAt: now() };
  save();
}

// Trip notes: one free-text note.
export function notesText(id) { const n = data.notes?.[id]; return n && !n.deleted ? n.text || '' : ''; }
export function setNotes(id, text) { data.notes[id] = { ...(data.notes[id] || {}), id, text, updatedAt: now() }; save(false); listeners.forEach((fn) => fn(data, 'notes')); }
export function noteUpdatedAt(id) { return data.notes?.[id]?.updatedAt || 0; }

// Note cards on the Trip notes screen.
const DEFAULT_TITLES = { oregon: 'Central Oregon notes', goals: 'Trip goals' };
export function noteCards() {
  return Object.values(data.notes || {})
    .filter((n) => !n.deleted && n.id !== 'main' && n.kind !== 'setting')
    .map((n) => ({ ...n, title: n.title || DEFAULT_TITLES[n.id] || 'Notes' }))
    .sort((a, b) => (a.order ?? (a.id === 'oregon' ? 0 : 1)) - (b.order ?? (b.id === 'oregon' ? 0 : 1)));
}
export function addNoteCard(title) {
  const id = 'n-' + uid();
  const order = Math.max(1, ...noteCards().map((n) => n.order ?? 1)) + 1;
  data.notes[id] = { id, title: title.trim(), text: '', order, updatedAt: now() };
  save(false); listeners.forEach((fn) => fn(data, 'notes'));
  return id;
}

/** Items that are on no trip: the hidden pile. */
export function hiddenItems() {
  return alive(data.items).filter((i) => !i.trips.some((t) => trip(t))).sort((a, b) => a.name.localeCompare(b.name));
}

const pkey = (tripId, itemId) => tripId + '|' + itemId;
// An item with parts (like Puffco) counts as packed only when every part is checked.
export function isPacked(tripId, itemId) {
  const it = data.items[itemId];
  if (it?.parts?.length) return it.parts.every((_, k) => isPartPacked(tripId, itemId, k));
  return !!data.packed[pkey(tripId, itemId)]?.v;
}
export function isPartPacked(tripId, itemId, k) { return !!data.packed[pkey(tripId, itemId) + '#' + k]?.v; }
export function togglePart(tripId, itemId, k) {
  data.packed[pkey(tripId, itemId) + '#' + k] = { v: !isPartPacked(tripId, itemId, k), updatedAt: now() };
  save();
}

export function progress(tripId) {
  const items = countedItems(tripId);
  const packed = items.filter((i) => isPacked(tripId, i.id)).length;
  return { packed, total: items.length, complete: items.length > 0 && packed === items.length };
}

/** Title for a trip's list screen: adds "trip" unless the name already ends with it. */
export function tripTitle(t) { return /\btrip$/i.test(t.name.trim()) ? t.name : t.name + ' trip'; }

// ---------- writes ----------
export function togglePacked(tripId, itemId) {
  data.packed[pkey(tripId, itemId)] = { v: !isPacked(tripId, itemId), updatedAt: now() };
  save();
}

export function clearTrip(tripId) {
  const t = now();
  itemsForTrip(tripId).forEach((i) => {
    data.packed[pkey(tripId, i.id)] = { v: false, updatedAt: t };
    (i.parts || []).forEach((_, k) => { data.packed[pkey(tripId, i.id) + '#' + k] = { v: false, updatedAt: t }; });
  });
  save();
}

export function addTrip(name) {
  const id = uid();
  const order = Math.max(0, ...trips().map((t) => t.order)) + 1;
  data.trips[id] = { id, name: name.trim(), order, theme: 'plain', updatedAt: now() };
  save();
  return id;
}

export function renameTrip(id, name) { data.trips[id] = { ...data.trips[id], name: name.trim(), updatedAt: now() }; save(); }

export function deleteTrip(id) {
  const t = now();
  data.trips[id] = { ...data.trips[id], deleted: true, updatedAt: t };
  alive(data.items).forEach((i) => {
    if (i.trips.includes(id)) data.items[i.id] = { ...i, trips: i.trips.filter((x) => x !== id), updatedAt: t };
  });
  save();
}

export function addHeading(name) {
  const clean = name.trim();
  const existing = headings().find((h) => h.name.toLowerCase() === clean.toLowerCase());
  if (existing) return existing.id;
  const id = uid();
  const order = Math.max(0, ...headings().map((h) => h.order)) + 1;
  data.headings[id] = { id, name: clean, order, updatedAt: now() };
  save();
  return id;
}

export function renameHeading(id, name) { data.headings[id] = { ...data.headings[id], name: name.trim(), updatedAt: now() }; save(); }

/** Deletes a heading everywhere. Its items move to "Other". */
export function deleteHeading(id) {
  const t = now();
  data.headings[id] = { ...data.headings[id], deleted: true, updatedAt: t };
  const moved = alive(data.items).filter((i) => i.headingId === id);
  if (moved.length) {
    const other = addHeading('Other');
    moved.forEach((i) => { data.items[i.id] = { ...i, headingId: other, updatedAt: t }; });
  }
  save();
}

export function addItem({ name, headingId, trips: tripIds }) {
  const id = uid();
  const t = now();
  data.items[id] = { id, name: name.trim(), headingId, trips: [...new Set(tripIds)], created: t, updatedAt: t };
  save();
  return id;
}

export function updateItem(id, { name, headingId, trips: tripIds }) {
  data.items[id] = { ...data.items[id], name: name.trim(), headingId, trips: [...new Set(tripIds)], updatedAt: now() };
  save();
}

/** Removes an item from one trip only. If it is on no trips after that, it sits in the hidden pile. */
export function removeItemFromTrip(itemId, tripId) {
  const i = data.items[itemId];
  data.items[itemId] = { ...i, trips: i.trips.filter((t) => t !== tripId), updatedAt: now() };
  data.packed[pkey(tripId, itemId)] = { v: false, updatedAt: now() };
  save();
}

export function restoreItemToTrip(itemId, tripId) {
  const i = data.items[itemId];
  data.items[itemId] = { ...i, trips: [...new Set([...i.trips, tripId])], updatedAt: now() };
  save();
}

// ---------- sync support ----------
/** Merges two data sets record by record. The newer record wins. Same result in any order. */
export function merge(a, b) {
  const out = emptyData();
  for (const k of ['trips', 'headings', 'items', 'packed', 'sections', 'notes']) {
    const A = a?.[k] || {}, B = b?.[k] || {};
    for (const id of new Set([...Object.keys(A), ...Object.keys(B)])) {
      const x = A[id], y = B[id];
      if (!x) out[k][id] = y;
      else if (!y) out[k][id] = x;
      else if (x.updatedAt !== y.updatedAt) out[k][id] = x.updatedAt > y.updatedAt ? x : y;
      else out[k][id] = stable(x) >= stable(y) ? x : y; // tie-break so every device agrees
    }
  }
  return out;
}

export function stable(v) {
  if (v === null || typeof v !== 'object') return JSON.stringify(v);
  if (Array.isArray(v)) return '[' + v.map(stable).join(',') + ']';
  return '{' + Object.keys(v).sort().map((k) => JSON.stringify(k) + ':' + stable(v[k])).join(',') + '}';
}

/** Used by sync: replace local data with a merged copy. */
export function replaceAll(next) {
  if (stable(next) === stable(data)) return false;
  data = next;
  save();
  return true;
}
