// Quantity-based containers (player bag, base chest, future containers).
// A container is plain data so it saves as-is: { slots: number, items: { [itemId]: qty } }.
// Every change goes through add/remove/transfer, which keep quantities whole, positive and conserved.
import { ITEMS, isStorable } from '../data/items.js';
import { T } from '../i18n/index.js';

export const BAG_SLOTS = 6;

export const CONTAINERS = {
  // future containers (crates at new research sites, a bigger chest after a base upgrade) go here
  baseChest: { name: T('Wooden Chest'), slots: 16, zone: 'beach' },
};

export function createContainer(slots) {
  return { slots, items: {} };
}

const stackOf = (id) => ITEMS[id].stack || 1;
const validQty = (q) => Number.isInteger(q) && q > 0;

export function count(c, id) {
  return (c && c.items[id]) || 0;
}

export function slotsUsed(c, exceptId = null) {
  let n = 0;
  for (const [id, q] of Object.entries(c.items)) if (id !== exceptId && q > 0) n += Math.ceil(q / stackOf(id));
  return n;
}

// how many more of `id` fit
export function spaceFor(c, id) {
  if (!isStorable(id)) return 0;
  const freeSlots = c.slots - slotsUsed(c, id);
  return Math.max(0, freeSlots * stackOf(id) - count(c, id));
}

export function add(c, id, qty) {
  if (!isStorable(id) || !validQty(qty) || spaceFor(c, id) < qty) return false;
  c.items[id] = count(c, id) + qty;
  return true;
}

export function remove(c, id, qty) {
  if (!validQty(qty) || count(c, id) < qty) return false;
  const left = count(c, id) - qty;
  if (left > 0) c.items[id] = left; else delete c.items[id];
  return true;
}

// move up to qty; returns { moved, reason } where reason is 'ok' | 'partial' | 'full' | 'none' | 'invalid'
export function transfer(from, to, id, qty) {
  if (from === to || !isStorable(id) || !validQty(qty)) return { moved: 0, reason: 'invalid' };
  const have = count(from, id);
  if (have === 0) return { moved: 0, reason: 'none' };
  const want = Math.min(qty, have);
  const room = spaceFor(to, id);
  if (room === 0) return { moved: 0, reason: 'full' };
  const moved = Math.min(want, room);
  remove(from, id, moved);
  to.items[id] = count(to, id) + moved;
  return { moved, reason: moved < want ? 'partial' : 'ok' };
}

export function totals(...containers) {
  const t = {};
  for (const c of containers) for (const [id, q] of Object.entries(c.items)) t[id] = (t[id] || 0) + q;
  return t;
}

// list the stacks a container shows, one entry per occupied slot
export function stacks(c) {
  const out = [];
  for (const [id, q] of Object.entries(c.items)) {
    const s = stackOf(id);
    for (let left = q; left > 0; left -= s) out.push({ id, qty: Math.min(s, left), total: q });
  }
  return out;
}
