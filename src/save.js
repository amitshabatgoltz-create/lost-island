// Progress persistence in localStorage (fails gracefully when storage is blocked).
import { BAG_SLOTS, CONTAINERS, createContainer } from './systems/inventory.js';
import { isStorable } from './data/items.js';

const KEY = 'lost-missing-island:save:v1';
const SETTINGS_KEY = 'lost-missing-island:settings:v1';

export function freshState() {
  return {
    version: 1,
    questIndex: 0,
    zone: 'beach', // added in Part 2; Part 1 saves default to the beach
    collected: [],
    clues: [],
    flags: { exploredWreck: false, suitcaseOpened: false, bookletRead: false, revealSeen: false, introDone: false },
    flashlightOn: false,
    player: null, // { x, z, yaw }
    // base camp update (schema 2): carried quantities, containers and base features
    schema: 2,
    inv: createContainer(BAG_SLOTS),
    containers: Object.fromEntries(Object.entries(CONTAINERS).map(([id, c]) => [id, createContainer(c.slots)])),
    base: { found: false, lanternOn: true, unlocked: ['chest', 'workbench', 'board'] },
    savedAt: 0,
  };
}

// Saves from Parts 1–2 have no quantities: carried gear is rebuilt from what was picked up.
function migrate(s) {
  const base = freshState();
  if (!s.inv || typeof s.inv !== 'object' || !s.inv.items) {
    s.inv = createContainer(BAG_SLOTS);
    for (const id of ['water', 'bandage']) if (s.collected.includes(id)) s.inv.items[id] = 1;
  }
  s.inv.slots = BAG_SLOTS;
  s.containers = { ...base.containers, ...(s.containers || {}) };
  for (const [id, c] of Object.entries(CONTAINERS)) {
    if (!s.containers[id] || !s.containers[id].items) s.containers[id] = createContainer(c.slots);
    s.containers[id].slots = c.slots;
  }
  // never trust stored numbers blindly: drop anything that is not a whole positive quantity
  for (const c of [s.inv, ...Object.values(s.containers)]) {
    for (const [id, q] of Object.entries(c.items)) if (!isStorable(id) || !Number.isInteger(q) || q <= 0) delete c.items[id];
  }
  s.base = { ...base.base, ...(s.base || {}) };
  s.schema = 2;
  return s;
}

export function loadState() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const s = JSON.parse(raw);
    if (!s || s.version !== 1) return null;
    const base = freshState();
    // Part 1 saves have no zone or Part 2 flags: missing fields fall back to defaults, nothing is reset
    const merged = { ...base, ...s, flags: { ...base.flags, ...(s.flags || {}) } };
    if (!['beach', 'forest'].includes(merged.zone)) merged.zone = 'beach';
    merged.collected = [...new Set(merged.collected)];
    merged.clues = [...new Set(merged.clues)];
    if (!s.inv) delete merged.inv; // an old save: rebuild the bag from what was picked up
    return migrate(merged);
  } catch (e) {
    return null;
  }
}

export function saveState(state) {
  try {
    state.savedAt = Date.now();
    localStorage.setItem(KEY, JSON.stringify(state));
    return true;
  } catch (e) {
    return false;
  }
}

export function clearState() {
  try { localStorage.removeItem(KEY); } catch (e) { /* ignore */ }
}

export function loadSettings() {
  // navAssist replaces the old always-on `marker` setting; old stored values are ignored so the compass starts off
  const def = { sens: 1, volume: 0.8, invertY: false, shadows: true, navAssist: false, introSeen: false };
  try {
    return { ...def, ...(JSON.parse(localStorage.getItem(SETTINGS_KEY)) || {}) };
  } catch (e) {
    return def;
  }
}

export function saveSettings(s) {
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(s)); } catch (e) { /* ignore */ }
}

export function storageAvailable() {
  try {
    localStorage.setItem('__t', '1');
    localStorage.removeItem('__t');
    return true;
  } catch (e) {
    return false;
  }
}
