// DOM user interface: HUD, toasts, subtitles, cinematic overlays, journal pages.
import { SYMBOL_SVG } from './items.js';
import { ITEMS, KEY_ORDER } from './data/items.js';
import { stacks, slotsUsed } from './systems/inventory.js';
import { CLUES, LOCKED_FUTURE_SLOTS, BOOKLET_MESSAGE } from './data/clues.js';
import { PART_SIZES, PART_START, PART_TITLES, QUESTS } from './data/quests.js';
import { QUEST_INFO, mainGoal } from './data/story.js';
import { shoreZ, PATHS } from './zones/beach/terrain.js';
import { LAYOUT, ITEM_SPOTS } from './zones/beach/layout.js';
import { FL, FPATHS, PRINTS } from './zones/forest/layout.js';
import { streamZ } from './zones/forest/terrain.js';
import { RL, RPATH, RCABLE } from './zones/ridge/layout.js';
import { ROOMS, FX } from './zones/facility/layout.js';
import { T, RTL, paTranslation } from './i18n/index.js';

const $ = (id) => document.getElementById(id);
const descOf = (c, state) => (typeof c.desc === 'function' ? c.desc(state) : c.desc);

export const ICONS = {
  water: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M10 2h4v3l1.5 2v13a2 2 0 0 1-2 2h-3a2 2 0 0 1-2-2V7L10 5z"/><path d="M8.5 12h7"/></svg>',
  flashlight: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M7 2h10l-2 6H9z"/><rect x="9" y="8" width="6" height="14" rx="1.5"/><path d="M12 12v3"/></svg>',
  bandage: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="2.5" y="8" width="19" height="8" rx="4" transform="rotate(-35 12 12)"/><path d="M10.5 11.5l1 1M12.5 10.5l1 1M11.5 13.5l1 1"/></svg>',
  booklet: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M5 3h12a2 2 0 0 1 2 2v16H7a2 2 0 0 1-2-2z"/><circle cx="12" cy="11" r="3.5"/><path d="M12 8v6"/></svg>',
  ticket: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M3 7h13l-1 2 1 2-1 2 1 2-1 2H3z"/><path d="M6 11h5M6 14h3"/></svg>',
  device: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="3" y="8" width="13" height="8" rx="1.5"/><path d="M16 10h4v4h-4"/><circle cx="6" cy="12" r="1" fill="currentColor"/></svg>',
  document: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M6 2h9l4 4v16H6z"/><path d="M9 10h7M9 13h7M9 16h4"/></svg>',
  powerCell: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="4" y="8" width="16" height="12" rx="1.5"/><path d="M8 8V5h8v3M8 14h3M14.5 12.5v3M13 14h3"/></svg>',
  radioLog: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="4" y="9" width="16" height="11" rx="1.5"/><path d="M8 9l8-5M8 14h3M15 14.5a1.5 1.5 0 1 0 0.01 0"/></svg>',
  photo: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="3" y="5" width="18" height="14" rx="1"/><path d="M3 16l5-5 4 4 3-3 6 6"/><circle cx="16" cy="9" r="1.5"/></svg>',
  campMap: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2z"/><path d="M9 4v14M15 6v14M11 11l2 2M13 11l-2 2"/></svg>',
  researchDoc: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M6 2h9l4 4v16H6z"/><circle cx="12" cy="12" r="3"/><path d="M12 9v6"/></svg>',
  schedule: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="4" y="4" width="16" height="17" rx="1"/><path d="M4 9h16M9 4v17M12 13h5M12 16h3"/></svg>',
  routeChart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M3 7c5 0 7 1 11 1s5-1 7-1"/><path d="M11 8c1 4 3 8 6 11" stroke-dasharray="2 2"/><circle cx="17.5" cy="19.5" r="1.5"/></svg>',
  stillHere: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="5" cy="17" r="1.3"/><circle cx="10" cy="13" r="1.3"/><circle cx="15" cy="10" r="1.3"/><circle cx="20" cy="6" r="1.3"/></svg>',
  wood: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M3 9l15-4 2 3-15 4z"/><path d="M4 15l15-4 2 3-15 4z"/><circle cx="19" cy="6.5" r="1"/></svg>',
  rope: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><ellipse cx="12" cy="12" rx="8" ry="5"/><ellipse cx="12" cy="12" rx="5" ry="3"/><path d="M20 12c1 3 0 6-3 7"/></svg>',
  cloth: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M4 7h16v4H4zM5 11h14v4H5zM6 15h12v3H6z"/></svg>',
  battery: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="3" y="8" width="16" height="9" rx="1.5"/><path d="M19 11h2v3h-2M7 12.5h4M9 10.5v4"/></svg>',
  electronics: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="6" y="6" width="12" height="12" rx="1"/><rect x="9.5" y="9.5" width="5" height="5"/><path d="M9 3v3M15 3v3M9 18v3M15 18v3M3 9h3M3 15h3M18 9h3M18 15h3"/></svg>',
  lock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>',
};

export class UI {
  constructor() {
    this.lastToast = {};
    this.journalTab = 'message';
    this.selectedClue = null;
    this.seenClues = new Set();
  }

  // ------------------------------------------------------------ screens
  setLoading(p, text) {
    const pct = Math.round(Math.min(1, Math.max(0, p)) * 100);
    $('loading-fill').style.width = `${pct}%`;
    $('loading-pct').textContent = `${pct}%`;
    if (text) $('loading-text').textContent = text;
  }
  show(id, v = true) { $(id).classList.toggle('hidden', !v); }

  // ------------------------------------------------------------ HUD
  setQuest(index, quest, subItems = null, info = {}) {
    if (info.goal) $('quest-goal').textContent = info.goal;
    const first = PART_START[quest.part];
    $('quest-num').textContent = quest.final
      ? T`Part ${quest.part} · coming soon`
      : T`Part ${quest.part} · Mission ${index - first + 1} / ${PART_SIZES[quest.part]}`;
    $('quest-title').textContent = quest.title;
    const obj = $('quest-obj');
    obj.innerHTML = '';
    if (quest.en) { const en = document.createElement('span'); en.className = 'en'; en.textContent = quest.en; obj.appendChild(en); }
    obj.appendChild(document.createTextNode(info.objective || quest.objective));
    const ul = $('quest-sub');
    ul.innerHTML = '';
    if (subItems) for (const s of subItems) {
      const li = document.createElement('li');
      li.textContent = s.label;
      if (s.done) li.classList.add('done');
      ul.appendChild(li);
    }
  }
  flashQuest() {
    const q = $('quest');
    q.classList.add('flash');
    setTimeout(() => q.classList.remove('flash'), 1600);
  }

  setPrompt(text, locked = false) {
    const p = $('prompt');
    if (!text) { p.classList.add('hidden'); this._prompt = null; return; }
    if (this._prompt !== text) {
      p.innerHTML = `<kbd>E</kbd>${text}`;
      this._prompt = text;
    }
    p.classList.toggle('locked', locked);
    p.classList.remove('hidden');
  }

  setMarker(angle, dist) {
    const m = $('marker');
    if (angle === null) { m.classList.add('hidden'); return; }
    m.classList.remove('hidden');
    $('marker-arrow').style.transform = `rotate(${angle}rad)`;
    $('marker-dist').textContent = dist != null ? T`${Math.round(dist)} m` : '';
  }

  // HUD bar: tools the player always carries, then the bag (with quantities)
  setInventory(state, flashlightOn, justAdded) {
    const inv = $('inventory');
    inv.innerHTML = '';
    const has = (id) => state.collected.includes(id);
    const cell = (id, qty, isKey) => {
      const d = document.createElement('div');
      d.className = 'inv' + (isKey ? ' key' : '') + (id === 'flashlight' && flashlightOn ? ' on' : '') + (id === justAdded ? ' new' : '');
      const lbl = id === 'booklet' ? T('Booklet · J') : id === 'flashlight' ? T('Flashlight · F') : ITEMS[id].name;
      d.innerHTML = (ICONS[id] || ICONS.document) + `<span class="lbl">${lbl}</span>` + (qty > 1 ? `<span class="qty">${qty}</span>` : '');
      d.title = ITEMS[id].name;
      inv.appendChild(d);
    };
    for (const id of KEY_ORDER) if (has(id) && !(id === 'powerCell' && state.flags.powerInstalled) && !(id === 'fuse' && state.flags.fuseInstalled)) cell(id, 1, true);
    const bag = state.inv;
    if (bag && Object.keys(bag.items).length) {
      const sep = document.createElement('div');
      sep.className = 'inv-sep';
      sep.textContent = T`Bag ${slotsUsed(bag)}/${bag.slots}`;
      inv.appendChild(sep);
      for (const [id, q] of Object.entries(bag.items)) cell(id, q, false);
    }
  }

  // ------------------------------------------------------------ storage (chest) interface
  openStorage({ title, bag, chest, keyItems = [], move, onClose }) {
    const el = $('storage');
    $('storage-title').textContent = title;
    const msg = $('storage-msg');
    const say = (text, kind = '') => { msg.textContent = text; msg.className = 'storage-msg ' + kind; };
    say(T('Click moves a whole stack · Shift+click moves one item'));
    const grid = (container, side) => {
      const list = stacks(container);
      let html = '';
      for (let i = 0; i < container.slots; i++) {
        const st = list[i];
        if (!st) { html += '<div class="slot empty" aria-hidden="true"></div>'; continue; }
        html += `<button class="slot" data-side="${side}" data-id="${st.id}" data-qty="${st.qty}" title="${ITEMS[st.id].name}">
          <span class="slot-ico">${ICONS[st.id] || ICONS.document}</span>
          <span class="slot-name">${ITEMS[st.id].name}</span>
          <span class="slot-qty">${st.qty}</span></button>`;
      }
      return html;
    };
    const render = () => {
      $('bag-cap').textContent = T`${slotsUsed(bag)}/${bag.slots} slots`;
      $('chest-cap').textContent = T`${slotsUsed(chest)}/${chest.slots} slots`;
      $('bag-grid').innerHTML = grid(bag, 'bag');
      $('chest-grid').innerHTML = grid(chest, 'chest');
      $('key-items').innerHTML = keyItems.length
        ? keyItems.map((id) => `<span class="key-item">${ICONS[id] || ''}<span>${ITEMS[id].name}</span></span>`).join('') + T('<span class="key-note">Key items stay with me</span>')
        : '';
      $('store-all').disabled = !Object.keys(bag.items).some((id) => ITEMS[id].kind === 'resource');
      el.querySelectorAll('.slot[data-id]').forEach((b) => {
        b.onclick = (e) => doMove(b.dataset.side, b.dataset.id, e.shiftKey ? 1 : +b.dataset.qty);
        b.oncontextmenu = (e) => { e.preventDefault(); doMove(b.dataset.side, b.dataset.id, 1); };
      });
    };
    const doMove = (side, id, qty) => {
      const dir = side === 'bag' ? 'toChest' : 'toBag';
      const r = move(dir, id, qty);
      const name = ITEMS[id] ? ITEMS[id].name : '';
      const where = dir === 'toChest' ? T('the chest') : T('my bag');
      if (r.reason === 'ok') say(`${name} ×${r.moved} → ${where}`, 'ok');
      else if (r.reason === 'partial') say(T`Moved only ${r.moved}: ${where} is full.`, 'warn');
      else if (r.reason === 'full') say(T`${where[0].toUpperCase() + where.slice(1)} is full. No room for ${name}.`, 'warn');
      else if (r.reason === 'none') say(T('Nothing to move.'), 'warn');
      else say(T('That can\'t be moved.'), 'warn');
      render();
      return r;
    };
    $('store-all').onclick = () => {
      let moved = 0, blocked = false;
      for (const id of Object.keys(bag.items).filter((i) => ITEMS[i].kind === 'resource')) {
        const r = move('toChest', id, bag.items[id]);
        moved += r.moved;
        if (r.reason === 'full' || r.reason === 'partial') blocked = true;
      }
      say(blocked ? T`Moved ${moved}: the chest is full.` : T`All resources stored (${moved}).`, blocked ? 'warn' : 'ok');
      render();
    };
    const close = () => { el.classList.add('hidden'); window.removeEventListener('keydown', onKey, true); this.storageMove = null; onClose && onClose(); };
    const onKey = (e) => {
      if (e.code === 'Escape' || e.code === 'KeyE' || e.code === 'Tab') { close(); e.stopPropagation(); e.preventDefault(); }
    };
    $('storage-close').onclick = close;
    window.addEventListener('keydown', onKey, true);
    el.classList.remove('hidden');
    render();
    this.storageMove = doMove; // used by automated tests
    this.storageClose = close;
    return close;
  }

  openWorkbench({ materials, recipes, onClose }) {
    const el = $('workbench');
    const ids = ['wood', 'rope', 'cloth', 'battery', 'electronics'];
    $('bench-materials').innerHTML = ids.map((id) => `<div class="mat"><span class="slot-ico">${ICONS[id]}</span><span>${ITEMS[id].name}</span><b>${materials[id] || 0}</b></div>`).join('');
    $('bench-recipes').textContent = recipes.length ? '' : T('I have no blueprints to build from yet. Maybe I will find some at the research camp, or elsewhere on the island.');
    const close = () => { el.classList.add('hidden'); window.removeEventListener('keydown', onKey, true); onClose && onClose(); };
    const onKey = (e) => { if (e.code === 'Escape' || e.code === 'KeyE') { close(); e.stopPropagation(); e.preventDefault(); } };
    $('bench-close').onclick = close;
    window.addEventListener('keydown', onKey, true);
    el.classList.remove('hidden');
    this.benchClose = close;
  }

  toast(text, kind = '', life = 3.2) {
    const now = performance.now();
    if (this.lastToast[text] && now - this.lastToast[text] < 2500) return;
    this.lastToast[text] = now;
    const t = document.createElement('div');
    t.className = 'toast ' + kind;
    t.style.setProperty('--life', `${life}s`);
    t.textContent = text;
    $('toasts').appendChild(t);
    setTimeout(() => t.remove(), (life + 0.6) * 1000);
  }

  // a newly found clue: what it is and what it adds, then where it went
  discovery(title, learned) {
    const t = document.createElement('div');
    t.className = 'toast discovery';
    t.style.setProperty('--life', '6s');
    t.innerHTML = T('<b></b><span></span><small>Added to the booklet · J</small>');
    t.querySelector('b').textContent = T`New clue · ${title}`;
    t.querySelector('span').textContent = learned || '';
    $('toasts').appendChild(t);
    setTimeout(() => t.remove(), 6600);
  }

  // first-time guidance; never blocks input
  tip(text, seconds = 7) {
    $('tip-text').textContent = text;
    const el = $('tip');
    el.classList.remove('hidden');
    el.style.animation = 'none'; void el.offsetWidth; el.style.animation = '';
    clearTimeout(this._tipT);
    this._tipT = setTimeout(() => el.classList.add('hidden'), seconds * 1000);
  }

  hintControls(show) {
    $('controls-hint').classList.toggle('faded', !show);
  }

  // ------------------------------------------------------------ cinematic
  subtitle(text, kind = 'thought', translation = '', seconds = 0) {
    const el = $('subtitles');
    clearTimeout(this._subT);
    if (!text) { el.innerHTML = ''; return; }
    if (seconds) this._subT = setTimeout(() => this.subtitle(null), seconds * 1000);
    const span = document.createElement('span');
    span.className = 'sub ' + kind;
    span.textContent = text;
    if (!translation && kind === 'pa') translation = paTranslation(text);
    if (translation) { const tr = document.createElement('span'); tr.className = 'tr'; tr.textContent = translation; span.appendChild(tr); }
    el.innerHTML = '';
    el.appendChild(span);
  }
  thought(text, seconds = 3.6) {
    this.subtitle(text, 'thought');
    this._subT = setTimeout(() => this.subtitle(null), seconds * 1000);
  }
  titleCard(a, b) {
    const tc = $('titlecard');
    tc.querySelector('.tc-a').textContent = a;
    tc.querySelector('.tc-b').textContent = b;
    tc.classList.remove('hidden');
    tc.style.animation = 'none'; void tc.offsetWidth; tc.style.animation = '';
    clearTimeout(this._tcT);
    this._tcT = setTimeout(() => tc.classList.add('hidden'), 6200);
  }
  fade(to, seconds) {
    const f = $('fade');
    f.style.transition = `opacity ${seconds}s ease`;
    f.style.opacity = to;
  }
  flashWhite() {
    const f = $('flash');
    f.style.transition = 'none';
    f.style.opacity = 1;
    setTimeout(() => { f.style.transition = 'opacity 0.15s'; f.style.opacity = 0; }, 60);
    this.fade(1, 0.05);
  }
  eyes(stateName) {
    const e = $('eyelids');
    e.classList.remove('hidden', 'open', 'half');
    if (stateName === 'hidden') { e.classList.add('hidden'); return; }
    if (stateName) e.classList.add(stateName);
  }
  blur(px) {
    document.getElementById('game').style.filter = px ? `blur(${px}px) brightness(${1 - px * 0.04})` : '';
  }

  // ------------------------------------------------------------ journal
  renderJournal(state, playerPos) {
    const has = (id) => state.collected.includes(id);
    // before the booklet is found, only the player's own investigation notes exist
    if (!has('booklet')) this.journalTab = 'case';
    document.querySelectorAll('.book-tabs .tab').forEach((t) => {
      t.classList.toggle('active', t.dataset.tab === this.journalTab);
      t.classList.toggle('hidden', t.dataset.tab !== 'case' && !has('booklet'));
    });
    const R = $('page-right'), L = $('page-left');
    if (this.journalTab === 'case') {
      const i = Math.min(state.questIndex, QUESTS.length - 1);
      const q = QUESTS[i];
      const info = QUEST_INFO[q.id] || {};
      const esc = (t) => String(t).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
      const done = QUESTS.slice(0, i).filter((x) => x.part === q.part).map((x) => `<span>${esc(x.title)}</span>`).join('<br>');
      R.innerHTML = T`<h3>Goal</h3>
        <div class="case-goal">${esc(mainGoal(state))}</div>
        <div class="case-block"><h4>Current mission · ${esc(q.title)}</h4><p class="case-now">${esc(info.objective ? info.objective(state) : q.objective)}</p></div>
        <div class="case-block"><h4>Why it matters</h4><p>${esc(info.why || '')}</p></div>
        ${done ? T`<div class="case-block"><h4>What I have done</h4><div class="case-done">${done}</div></div>` : ''}`;
      const know = info.know ? info.know(state) : [];
      L.innerHTML = T`<h3>What I know</h3>
        <div class="case-block"><ul>${know.map((k) => `<li>${esc(k)}</li>`).join('')}</ul></div>
        <div class="case-block"><h4>Still to find out</h4><p class="char-note" style="margin-top:0">${esc(info.question || '')}</p></div>
        ${q.hints && q.hints.length ? T('<div class="case-block"><p class="empty">Stuck? H gives a hint. Each press is clearer.</p></div>') : ''}`;
    } else if (this.journalTab === 'message') {
      R.innerHTML = `<div class="cover">${SYMBOL_SVG}<div class="cover-note">— — — —</div></div>`;
      L.innerHTML = T`<h3>The first page</h3>
        <div class="handwritten-en">${BOOKLET_MESSAGE}</div>
        <div class="char-note">The handwriting of someone in a hurry. Nobody was supposed to read this... except the people who planned something.</div>
        <div class="char-note">And this symbol: I am sure I saw it today. But where?</div>`;
    } else if (this.journalTab === 'clues') {
      const found = CLUES.filter((c) => state.clues.includes(c.id));
      if (!this.selectedClue || !state.clues.includes(this.selectedClue)) this.selectedClue = found.length ? found[found.length - 1].id : null;
      let html = T('<h3>Clues found</h3><div class="clue-list">');
      for (const part of [1, 2, 3]) {
        if (state.questIndex < PART_START[part]) break;
        html += T`<div class="clue-part">Part ${part} · ${PART_TITLES[part]}</div>`;
        for (const c of CLUES.filter((x) => x.part === part)) {
          if (state.clues.includes(c.id)) {
            const isNew = !this.seenClues.has(c.id);
            const plain = descOf(c, state).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
            const short = plain.length > 46 ? plain.slice(0, 46) + '…' : plain;
            html += `<button class="clue ${c.id === this.selectedClue ? 'sel' : ''} ${isNew ? 'new' : ''}" data-clue="${c.id}"><span class="ico">${ICONS[c.id] || ICONS.document}</span><span class="txt"><span class="t">${c.title}</span><span class="s">${short}</span></span></button>`;
          } else {
            html += T`<div class="clue locked"><span class="ico">${ICONS.lock}</span><span class="txt"><span class="t">A clue not found yet</span><span class="s">???</span></span></div>`;
          }
        }
      }
      for (let i = 0; i < LOCKED_FUTURE_SLOTS; i++) {
        html += T`<div class="clue locked"><span class="ico">${ICONS.lock}</span><span class="txt"><span class="t">Locked page</span><span class="s">Part of the booklet is still stuck together from the water…</span></span></div>`;
      }
      html += '</div>';
      R.innerHTML = html;
      const sel = CLUES.find((c) => c.id === this.selectedClue);
      if (sel) {
        this.seenClues.add(sel.id);
        const note = sel.noteEn ? `<div class="handwritten-en final">${sel.note}</div>` : `<div class="char-note">${sel.note}</div>`;
        L.innerHTML = `<h3>${sel.title}</h3>${sel.art || ''}<div class="detail-desc">${descOf(sel, state)}</div>${note}`;
      } else L.innerHTML = T('<h3>Details</h3><p class="empty">No clues found yet.</p>');
      R.querySelectorAll('[data-clue]').forEach((b) => b.addEventListener('click', () => { this.selectedClue = b.dataset.clue; this.renderJournal(state, playerPos); }));
    } else if (this.mapView(state) === 'north') {
      const inside = state.zone === 'facility';
      R.innerHTML = `${this.mapSwitch(state)}<h3>${inside ? T('N-1: the facility') : T('The northern ridge')}</h3><div class="mapwrap">${inside ? this.facilityMapSVG(state, playerPos) : this.ridgeMapSVG(state, state.zone === 'ridge' ? playerPos : null)}</div>`;
      const f = state.flags;
      const lines = [T('<div><span class="k" style="color:#1d4f8a">●</span> My location</div>')];
      if (inside) {
        lines.push(T('<div><span class="k">↓</span> The way out, to the ridge</div>'));
        if (f.archiveAccess) lines.push(T('<div><span class="k">▪</span> Restricted cabinet (archive)</div>'));
        if (f.controlReleased) lines.push(T('<div><span class="k">▪</span> Control room: the playback deck</div>'));
        if (f.blackout) lines.push(T('<div><span class="k" style="color:#c0392b">●</span> Emergency power only</div>'));
      } else {
        lines.push(T('<div><span class="k">↓</span> The trail from the forest</div>'));
        lines.push(T('<div><span class="k" style="color:#c0392b">●</span> The red signal, on the cliff</div>'));
        if (f.entranceFound) lines.push(T('<div><span class="k">▮</span> The door in the cliff: N-1</div>'));
        if (f.genSeen) lines.push(T('<div><span class="k">▪</span> Generator shed, GEN-2</div>'));
        if (state.collected.includes('mapFragment')) lines.push(T('<div><span class="k">✕</span> “N-1” on the missing map piece</div>'));
      }
      L.innerHTML = T`<h3>Legend</h3><div class="legend">${lines.join('')}</div>
        <div class="char-note">${inside ? T('I sketched the rooms as I found them. The door to the lower level is sealed.') : T('A narrow valley between rock walls. The only way is up the trail, toward the cliff.')}</div>`;
      this.bindMapSwitch(state, playerPos);
    } else if (this.mapView(state) === 'forest') {
      R.innerHTML = T`${this.mapSwitch(state)}<h3>The forest: what I have seen so far</h3><div class="mapwrap">${this.forestMapSVG(state, state.zone === 'forest' ? playerPos : null)}</div>`;
      const f = state.flags;
      const lines = [T('<div><span class="k" style="color:#1d4f8a">●</span> My location</div>'), T('<div><span class="k">↓</span> The trail from the beach</div>')];
      if (f.reachedTransmitter) lines.push(T('<div><span class="k">⌇</span> The transmitter (RELAY 04 · 417.9)</div>'));
      if (f.printsPower || has('powerCell') || f.powerInstalled) lines.push(T('<div><span class="k">▪</span> The supply crate</div>'));
      if (f.campRadio || f.tentSeen || f.tableSeen || f.cabinSeen) lines.push(T('<div><span class="k">⌂</span> The research camp</div>'));
      if (f.postSpotted || f.printsRidge || has('routeChart')) lines.push(T('<div><span class="k">◭</span> The lookout on the ridge</div>'));
      if (f.endingSeen) lines.push(T('<div><span class="k" style="color:#c0392b">●</span> The new signal, north-east</div>'));
      L.innerHTML = T`<h3>Legend</h3><div class="legend">${lines.join('')}</div>
        <div class="char-note">I drew this myself by flashlight. The ridge in the east is steep: there is only one way up, south of the camp.</div>`;
      this.bindMapSwitch(state, playerPos);
    } else {
      R.innerHTML = T`${this.mapSwitch(state)}<h3>Partial map of the island</h3><div class="mapwrap">${this.mapSVG(state, state.zone === 'beach' ? playerPos : null)}</div>`;
      this.bindMapSwitch(state, playerPos);
      const lines = [
        T('<div><span class="k" style="color:#1d4f8a">●</span> My location</div>'),
        T('<div><span class="k">✈</span> The fuselage</div>'),
      ];
      if (state.questIndex >= 4) {
        lines.push(T`<div><span class="k">✕</span> Booklet marks ${has('ticket') && has('device') ? T('(checked)') : ''}</div>`);
      }
      if (has('device')) lines.push(T('<div><span class="k">T</span> TAIL: the plane\'s tail</div>'));
      if (state.questIndex >= 6) lines.push(T('<div><span class="k">?</span> Signal source: deep in the forest, via the north trail</div>'));
      L.innerHTML = T`<h3>Legend</h3><div class="legend">${lines.join('')}</div>
        <div class="char-note">The map is torn. The northern part is missing, as if someone ripped it off on purpose.</div>
        ${state.questIndex >= 4 ? T('<div class="char-note">Two X marks in red pen: near the west beach and near the jungle trail.</div>') : ''}`;
    }
  }

  mapView(state) {
    if (state.questIndex < 7 && state.zone !== 'forest') return 'beach';
    const own = state.zone === 'ridge' || state.zone === 'facility' ? 'north' : state.zone;
    if (this.mapChoice === 'north' && !state.flags.reachedRidge) return own;
    return this.mapChoice || own;
  }

  mapSwitch(state) {
    if (state.questIndex < 7 && state.zone !== 'forest') return '';
    const v = this.mapView(state);
    const north = state.flags.reachedRidge ? T`<button data-map="north" class="${v === 'north' ? 'on' : ''}">North</button>` : '';
    return T`<div class="map-switch"><button data-map="beach" class="${v === 'beach' ? 'on' : ''}">Beach</button><button data-map="forest" class="${v === 'forest' ? 'on' : ''}">Forest</button>${north}</div>`;
  }

  ridgeMapSVG(state, playerPos) {
    // ridge (x,z) -> map; north (-z) up
    const u = (x) => 220 + x * 4.2, v = (z) => 250 + z * 3.4;
    const f = state.flags;
    const line = (pts, st) => '<path d="M' + pts.map(([x, z]) => `${u(x).toFixed(1)},${v(z).toFixed(1)}`).join(' L') + `" fill="none" ${st}/>`;
    const walls = [-1, 1].map((sd) => line(Array.from({ length: 12 }, (_, i) => { const z = 64 - i * 10; return [sd * 27 + Math.sin(z * 0.045) * 4, z]; }), 'stroke="#5a4630" stroke-width="2"')).join('');
    let marks = `<path d="M${u(-30)},${v(-49)} Q${u(0)},${v(-53)} ${u(30)},${v(-49)}" stroke="#5a4630" stroke-width="3" fill="none"/>`;
    marks += `<circle cx="${u(RL.mast.x)}" cy="${v(RL.mast.z) + 20}" r="6" fill="#c0392b"/>`;
    if (f.cableSeen) marks += line(RCABLE, 'stroke="#222" stroke-width="1.6"');
    if (f.entranceFound) marks += `<rect x="${u(-3)}" y="${v(-47)}" width="${4.2 * 6}" height="8" fill="#3a2e20"/>`;
    if (f.genSeen) marks += `<rect x="${u(RL.shed.x) - 7}" y="${v(RL.shed.z) - 6}" width="14" height="12" fill="none" stroke="#3a2e20" stroke-width="2"/>`;
    if (state.collected.includes('fieldRecorder')) marks += `<path d="M${u(RL.tarp.x) - 8},${v(RL.tarp.z) + 5} l8,-10 l8,10 z" fill="none" stroke="#3a2e20" stroke-width="2"/>`;
    const me = playerPos ? `<circle cx="${u(playerPos.x)}" cy="${v(playerPos.z)}" r="5" fill="#1d4f8a" stroke="#fff" stroke-width="1.5"/>` : '';
    return `<svg viewBox="0 0 440 480" xmlns="http://www.w3.org/2000/svg">
      <rect x="10" y="10" width="420" height="460" fill="#d8c79e" opacity="0.35" stroke="#9a835f"/>
      ${walls}${line(RPATH, 'stroke="#7a5a35" stroke-width="1.8" stroke-dasharray="4 4"')}${marks}${me}
      <text x="18" y="462" font-size="13" fill="#5a4630" font-family="monospace" direction="ltr">N ↑</text>
    </svg>`;
  }

  facilityMapSVG(state, playerPos) {
    const u = (x) => 230 + x * 11, v = (z) => 260 + z * 11;
    const f = state.flags;
    const seen = { corridor: true, checkpoint: true, observation: !!f.obsOpened, archive: !!f.archiveOpened, control: !!f.controlReleased };
    const rooms = Object.entries(ROOMS).filter(([id]) => seen[id]).map(([id, rm]) => {
      const [x0, x1, z0, z1] = rm.r;
      return `<rect x="${u(x0)}" y="${v(z0)}" width="${(x1 - x0) * 11}" height="${(z1 - z0) * 11}" fill="#e6dcc0" stroke="#3a2e20" stroke-width="2"/>
        <text x="${u((x0 + x1) / 2)}" y="${v((z0 + z1) / 2) + 4}" font-size="10" text-anchor="middle" fill="#5a4630" font-family="monospace">${rm.name.toUpperCase()}</text>`;
    }).join('');
    const sealed = `<path d="M${u(-6) - 3},${v(-4)} v22" stroke="#8a2c1f" stroke-width="4"/>`;
    const me = playerPos ? `<circle cx="${u(playerPos.x)}" cy="${v(playerPos.z)}" r="5" fill="#1d4f8a" stroke="#fff" stroke-width="1.5"/>` : '';
    const mon = f.obsOpened ? `<rect x="${u(-4)}" y="${v(FX.monitorWall.z) - 3}" width="88" height="5" fill="#3a2e20"/>` : '';
    return `<svg viewBox="0 0 440 470" xmlns="http://www.w3.org/2000/svg">
      <rect x="10" y="10" width="420" height="450" fill="#d8c79e" opacity="0.25" stroke="#9a835f"/>
      ${rooms}${sealed}${mon}${me}
      <text x="18" y="452" font-size="13" fill="#5a4630" font-family="monospace" direction="ltr">N ↑</text>
    </svg>`;
  }

  bindMapSwitch(state, playerPos) {
    document.querySelectorAll('[data-map]').forEach((b) => b.addEventListener('click', () => { this.mapChoice = b.dataset.map; this.renderJournal(state, playerPos); }));
  }

  forestMapSVG(state, playerPos) {
    // forest (x,z) -> map; north (-z) up
    const u = (x) => 220 + x * 2.0, v = (z) => 240 + z * 2.0;
    const f = state.flags, has = (id) => state.collected.includes(id);
    let stream = '';
    for (let x = -100; x <= 100; x += 5) stream += `${x === -100 ? 'M' : 'L'}${u(x).toFixed(1)},${v(streamZ(x)).toFixed(1)} `;
    const paths = FPATHS.map((p) => '<path d="M' + p.map(([x, z]) => `${u(x).toFixed(1)},${v(z).toFixed(1)}`).join(' L') + '" fill="none" stroke="#7a5a35" stroke-width="1.8" stroke-dasharray="4 4"/>').join('');
    const prints = (list, show) => (show ? '<path d="M' + list.map(([x, z]) => `${u(x).toFixed(1)},${v(z).toFixed(1)}`).join(' L') + '" fill="none" stroke="#3a2e20" stroke-width="1.2" stroke-dasharray="1 3"/>' : '');
    const trees = [];
    for (let i = 0; i < 90; i++) {
      const x = -95 + ((i * 41) % 190), z = -95 + ((i * 67) % 195);
      if (Math.abs(z - streamZ(x)) < 6) continue;
      trees.push(`<path d="M${u(x)},${v(z) - 4} l-3.5,7 h7 z" fill="#5e6b3a" opacity="0.45"/>`);
    }
    const ridge = Array.from({ length: 16 }, (_, i) => { const z = -96 + i * 12.5; return Math.abs(z + 60) < 12 ? '' : `<path d="M${u(56)},${v(z)} l8,4" stroke="#5a4630" stroke-width="1.5"/>`; }).join('');
    let marks = '';
    if (f.reachedTransmitter) marks += `<g stroke="#3a2e20" stroke-width="2" fill="none"><path d="M${u(FL.mast.x)},${v(FL.mast.z) + 8} L${u(FL.mast.x)},${v(FL.mast.z) - 12}"/><path d="M${u(FL.mast.x) - 6},${v(FL.mast.z) - 6} q6,-6 12,0"/></g>`;
    if (f.printsPower || has('powerCell') || f.powerInstalled) marks += `<rect x="${u(FL.powerSite.x) - 6}" y="${v(FL.powerSite.z) - 5}" width="12" height="10" fill="none" stroke="#3a2e20" stroke-width="2"/>`;
    if (f.campRadio || f.tentSeen || f.tableSeen || f.cabinSeen) marks += `<path d="M${u(FL.cabin.x) - 9},${v(FL.cabin.z) + 6} v-9 l9,-7 l9,7 v9 z" fill="none" stroke="#3a2e20" stroke-width="2"/><path d="M${u(FL.tent.x) - 7},${v(FL.tent.z) + 5} l7,-11 l7,11 z" fill="none" stroke="#3a2e20" stroke-width="2"/>`;
    if (f.postSpotted || f.printsRidge || has('routeChart')) marks += `<path d="M${u(FL.post.x) - 8},${v(FL.post.z) + 6} l8,-13 l8,13 z" fill="none" stroke="#8a2c1f" stroke-width="2"/>`;
    if (f.endingSeen) {
      marks += FL.farLights.map(([x, z]) => `<circle cx="${u(x)}" cy="${Math.max(10, v(z))}" r="3" fill="#c9a24a"/>`).join('');
      marks += `<circle cx="${u(FL.newSignal.x)}" cy="16" r="6" fill="#c0392b"/><text x="${u(FL.newSignal.x) + 10}" y="21" font-size="13" fill="#8a2c1f">?</text>`;
    }
    const me = playerPos ? `<circle cx="${u(playerPos.x)}" cy="${v(playerPos.z)}" r="5" fill="#1d4f8a" stroke="#fff" stroke-width="1.5"/>` : '';
    return `<svg viewBox="0 0 440 470" xmlns="http://www.w3.org/2000/svg">
      <rect x="10" y="10" width="420" height="450" fill="#d8c79e" opacity="0.35" stroke="#9a835f"/>
      ${trees.join('')}
      <path d="${stream}" fill="none" stroke="#4d6f86" stroke-width="3"/>
      ${ridge}
      ${paths}
      ${prints(PRINTS.toPower, f.printsPower || has('powerCell') || f.powerInstalled)}
      ${prints(PRINTS.toRidge, f.printsRidge || has('routeChart'))}
      ${marks}
      ${me}
      <text x="18" y="455" font-size="13" fill="#5a4630" font-family="monospace" direction="ltr">N ↑</text>
    </svg>`;
  }

  // ------------------------------------------------------------ keypad
  openKeypad({ title, length = 4, onSubmit, onClose }) {
    const el = $('keypad');
    $('keypad-title').textContent = title;
    let code = '';
    const display = $('keypad-display');
    const render = (state = '') => {
      display.textContent = (code + '_'.repeat(length)).slice(0, length).split('').join(' ');
      display.className = state + (length > 4 ? ' long' : '');
    };
    const close = () => { el.classList.add('hidden'); window.removeEventListener('keydown', onKey, true); onClose && onClose(); };
    const submit = () => {
      if (code.length < length) return;
      const ok = onSubmit(code);
      render(ok ? 'ok' : 'bad');
      if (ok) setTimeout(close, 650);
      else setTimeout(() => { code = ''; render(); }, 700);
    };
    const press = (k) => {
      if (k === 'C') { code = ''; render(); return; }
      if (k === 'OK') { submit(); return; }
      if (code.length < length) { code += k; render(); if (code.length === length) setTimeout(submit, 180); }
    };
    const onKey = (e) => {
      if (/^Digit\d$|^Numpad\d$/.test(e.code)) { press(e.code.slice(-1)); e.stopPropagation(); e.preventDefault(); }
      else if (e.code === 'Backspace') { code = code.slice(0, -1); render(); e.stopPropagation(); e.preventDefault(); }
      else if (e.code === 'Enter' || e.code === 'NumpadEnter') { submit(); e.stopPropagation(); e.preventDefault(); }
      else if (e.code === 'Escape' || e.code === 'KeyE') { close(); e.stopPropagation(); e.preventDefault(); }
    };
    el.querySelectorAll('[data-key]').forEach((b) => { b.onclick = () => press(b.dataset.key); });
    $('keypad-close').onclick = close;
    window.addEventListener('keydown', onKey, true);
    el.classList.remove('hidden');
    render();
    this.keypadPress = press; // used by automated tests
    return close;
  }

  // ------------------------------------------------------------ puzzle devices (shared shell)
  openDevice(title, html, onClose) {
    const el = $('device');
    $('device-title').textContent = title;
    $('device-body').innerHTML = html;
    el.classList.remove('hidden');
    let closed = false;
    const close = () => {
      if (closed) return;
      closed = true;
      el.classList.add('hidden');
      window.removeEventListener('keydown', onKey, true);
      if (this.deviceTick) { cancelAnimationFrame(this.deviceTick); this.deviceTick = null; }
      this.deviceKey = null;
      onClose && onClose();
    };
    const onKey = (e) => {
      if (e.code === 'Escape' || e.code === 'KeyE') { close(); e.stopPropagation(); e.preventDefault(); return; }
      if (this.deviceKey && this.deviceKey(e)) { e.stopPropagation(); e.preventDefault(); }
    };
    window.addEventListener('keydown', onKey, true);
    $('device-close').onclick = close;
    this.deviceClose = close;
    return close;
  }

  // a found document, readable at any size (the panel scrolls)
  openDocument({ title, html, onClose }) {
    this.openDevice(title, T`<div class="doc-paper">${html}</div><p class="dev-note">Added to the booklet (J → Clues). E or Esc to close.</p>`, () => { $('device').classList.remove('doc'); onClose && onClose(); });
    $('device').classList.add('doc');
  }

  // a facility screen: an old green terminal; returns the body so the caller can wire its buttons
  openTerminal({ title, html, onClose }) {
    const close = this.openDevice(title, `<div class="crt">${html}</div>`, () => { $('device').classList.remove('term'); onClose && onClose(); });
    $('device').classList.add('term');
    return { body: $('device-body'), close };
  }

  // three dials of symbols; check(codeArray) -> bool
  openSymbolLock({ symbols, size, check, onClose }) {
    const pos = Array(size).fill(0);
    const close = this.openDevice(T('Symbol lock'), T`
      <p class="dev-note">Three wheels. Six symbols on each wheel.</p>
      <div class="dials" dir="ltr">${pos.map((_, i) => T`
        <div class="dial" data-i="${i}">
          <button class="dial-btn" data-step="-1" aria-label="Previous symbol">▲</button>
          <div class="dial-face" id="dial-${i}"></div>
          <button class="dial-btn" data-step="1" aria-label="Next symbol">▼</button>
        </div>`).join('')}</div>
      <div class="dev-row"><button id="lock-try" class="btn primary">Pull the lock</button></div>
      <div id="dev-msg" class="dev-msg" aria-live="polite"></div>`, onClose);
    const render = () => pos.forEach((p, i) => { $(`dial-${i}`).innerHTML = symbols[p].svg + `<span>${symbols[p].name}</span>`; });
    $('device-body').querySelectorAll('.dial').forEach((d) => d.querySelectorAll('.dial-btn').forEach((b) => {
      b.onclick = () => { const i = +d.dataset.i; pos[i] = (pos[i] + +b.dataset.step + symbols.length) % symbols.length; render(); };
    }));
    const attempt = () => {
      const ok = check(pos.map((p) => symbols[p].id));
      const msg = $('dev-msg');
      msg.textContent = ok ? T('Click. The lock opens.') : T('The lock doesn\'t move.');
      msg.className = 'dev-msg ' + (ok ? 'ok' : 'bad');
      if (ok) setTimeout(close, 700);
    };
    $('lock-try').onclick = attempt;
    render();
    this.symbolLockSet = (ids) => { ids.forEach((id, i) => { pos[i] = symbols.findIndex((x) => x.id === id); }); render(); attempt(); };
  }

  // connect four wires to four terminals; check(assign) -> bool
  openWiring({ wires, rules, check, onClose, title = T('Wiring panel · RELAY 04'), cardTitle = T('Service card') }) {
    const assign = {};
    let picked = null;
    const close = this.openDevice(title, T`
      <div class="wiring">
        <div class="wire-col">${wires.map((w) => `<button class="wire" data-w="${w.id}" style="--c:${w.color}"><span class="plug"></span>${w.name}</button>`).join('')}</div>
        <svg class="wire-svg" viewBox="0 0 100 200" preserveAspectRatio="none" aria-hidden="true"></svg>
        <div class="term-col">${[1, 2, 3, 4].map((t) => `<button class="term" data-t="${t}">${t}</button>`).join('')}</div>
      </div>
      <div class="card">${rules ? `<b>${cardTitle}:</b><br>` + rules.map((r, i) => `${i + 1}. ${r}`).join('<br>') : T('I have no diagram.')}</div>
      <div class="dev-row"><button id="wire-clear" class="btn ghost">Disconnect all</button><button id="wire-try" class="btn primary">Power on</button></div>
      <div id="dev-msg" class="dev-msg" aria-live="polite">Pick a wire, then a terminal.</div>`, onClose);
    const body = $('device-body');
    const render = () => {
      body.querySelectorAll('.wire').forEach((b) => b.classList.toggle('sel', b.dataset.w === picked));
      body.querySelectorAll('.term').forEach((b) => {
        const w = Object.keys(assign).find((k) => assign[k] === +b.dataset.t);
        b.style.setProperty('--c', w ? wires.find((x) => x.id === w).color : 'transparent');
        b.classList.toggle('used', !!w);
      });
      const idx = (id) => wires.findIndex((w) => w.id === id);
      body.querySelector('.wire-svg').innerHTML = Object.entries(assign).map(([w, t]) => {
        const y1 = 25 + idx(w) * 50, y2 = 25 + (t - 1) * 50;
        // from the wire label to the terminal: labels are on the left in English, on the right in Hebrew
        const [a, b, c, d] = RTL ? [100, 55, 45, 0] : [0, 45, 55, 100];
        return `<path d="M${a} ${y1} C${b} ${y1} ${c} ${y2} ${d} ${y2}" stroke="${wires[idx(w)].color}" stroke-width="5" fill="none" vector-effect="non-scaling-stroke"/>`;
      }).join('');
    };
    body.querySelectorAll('.wire').forEach((b) => { b.onclick = () => { picked = b.dataset.w; render(); }; });
    body.querySelectorAll('.term').forEach((b) => {
      b.onclick = () => {
        if (!picked) return;
        const t = +b.dataset.t;
        for (const k of Object.keys(assign)) if (assign[k] === t) delete assign[k];
        assign[picked] = t;
        picked = null;
        render();
      };
    });
    $('wire-clear').onclick = () => { for (const k of Object.keys(assign)) delete assign[k]; render(); };
    const attempt = () => {
      const msg = $('dev-msg');
      if (Object.keys(assign).length < wires.length) { msg.textContent = T('Not all wires are connected.'); msg.className = 'dev-msg bad'; return false; }
      const ok = check({ ...assign });
      msg.textContent = ok ? T('A hum. The screen lights up.') : T('A spark, then silence. Something is wrong.');
      msg.className = 'dev-msg ' + (ok ? 'ok' : 'bad');
      if (ok) setTimeout(close, 800);
      return ok;
    };
    $('wire-try').onclick = attempt;
    render();
    this.wiringSet = (a) => { for (const k of Object.keys(assign)) delete assign[k]; Object.assign(assign, a); render(); return attempt(); };
  }

  // tune by ear (and by the signal meter): hold the dial on the station for a moment
  openTuning({ min, max, target, lock, hold, onLocked, onClose, tuner }) {
    let f = 405.0, held = 0, last = performance.now(), done = false;
    const close = this.openDevice(T('Frequency tuning'), T`
      <div class="tuner">
        <div class="freq" dir="ltr"><span id="tune-f"></span> <small>MHz</small></div>
        <div class="meter" id="tune-meter" aria-label="Signal strength">${'<i></i>'.repeat(10)}</div>
        <input type="range" id="tune-range" min="${min}" max="${max}" step="0.1" dir="ltr" aria-label="Frequency" />
        <div class="dev-row" dir="ltr">
          <button class="btn ghost" data-d="-1">−1</button><button class="btn ghost" data-d="-0.1">−0.1</button>
          <button class="btn ghost" data-d="0.1">+0.1</button><button class="btn ghost" data-d="1">+1</button>
        </div>
      </div>
      <div id="dev-msg" class="dev-msg" aria-live="polite">Only static. Listen, and watch the signal meter. ← → for fine tuning.</div>`, () => { tuner && tuner.stop(); onClose && onClose(); });
    const range = $('tune-range');
    const set = (v) => { f = Math.round(Math.min(max, Math.max(min, v)) * 10) / 10; range.value = f; };
    const strength = () => Math.max(0, 1 - Math.abs(f - target) / 3.5) ** 1.6;
    range.oninput = () => set(+range.value);
    $('device-body').querySelectorAll('[data-d]').forEach((b) => { b.onclick = () => set(f + +b.dataset.d); });
    this.deviceKey = (e) => {
      if (e.code === 'ArrowRight') { set(f + 0.1); return true; }
      if (e.code === 'ArrowLeft') { set(f - 0.1); return true; }
      if (e.code === 'ArrowUp') { set(f + 1); return true; }
      if (e.code === 'ArrowDown') { set(f - 1); return true; }
      return false;
    };
    set(f);
    const tick = (now) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      const sgl = strength();
      $('tune-f').textContent = f.toFixed(1);
      $('tune-meter').querySelectorAll('i').forEach((b, i) => b.classList.toggle('on', i < Math.round(sgl * 10)));
      tuner && tuner.set(sgl);
      if (!done) {
        if (Math.abs(f - target) <= lock + 1e-9) {
          held += dt;
          const msg = $('dev-msg');
          msg.textContent = T('A voice... through the static. Hold it.');
          msg.className = 'dev-msg ok';
          if (held >= hold) {
            done = true;
            msg.textContent = T('Locked on.');
            onLocked();
            setTimeout(close, 900);
          }
        } else held = 0;
      }
      this.deviceTick = requestAnimationFrame(tick);
    };
    this.deviceTick = requestAnimationFrame(tick);
    this.tuneSet = set;
  }

  showScope(on) {
    $('scope-view').classList.toggle('hidden', !on);
  }

  // ------------------------------------------------------------ hints
  setHintAvailable(on) { $('quest-hint').classList.toggle('hidden', !on); }

  // ------------------------------------------------------------ Part 2 ending overlays
  showFinalEntry(text) {
    $('final-entry-text').textContent = text;
    $('final-entry').classList.remove('hidden');
  }
  hideFinalEntry() { $('final-entry').classList.add('hidden'); }

  mapSVG(state, playerPos) {
    // world (x,z) -> map (u,v). North (-z) is up.
    const u = (x) => 220 + x * 1.8, v = (z) => 330 + z * 1.53;
    const has = (id) => state.collected.includes(id);
    let coast = '';
    for (let x = -100; x <= 100; x += 5) coast += `${x === -100 ? 'M' : 'L'}${u(x).toFixed(1)},${v(shoreZ(x) + (Math.abs(x) > 70 ? (Math.abs(x) - 70) * 1.2 : 0)).toFixed(1)} `;
    coast += `C ${u(130)},${v(0)} ${u(120)},${v(-160)} ${u(40)},${v(-190)} L ${u(-60)},${v(-185)} C ${u(-130)},${v(-150)} ${u(-130)},${v(0)} ${u(-100)},${v(shoreZ(-100) + 36)} Z`;
    const paths = PATHS.map((p) => 'M' + p.map(([x, z]) => `${u(x).toFixed(1)},${v(z).toFixed(1)}`).join(' L')).map((d) => `<path d="${d}" fill="none" stroke="#7a5a35" stroke-width="1.6" stroke-dasharray="4 4"/>`).join('');
    const trees = [];
    for (let i = 0; i < 70; i++) {
      const x = -85 + ((i * 37) % 170), z = -40 - ((i * 53) % 120);
      trees.push(`<path d="M${u(x)},${v(z) - 5} l-4,8 h8 z" fill="#5e6b3a" opacity="0.5"/>`);
    }
    const X = (p, color = '#8a2c1f') => `<g stroke="${color}" stroke-width="3" stroke-linecap="round"><path d="M${u(p.x) - 6},${v(p.z) - 6} L${u(p.x) + 6},${v(p.z) + 6} M${u(p.x) + 6},${v(p.z) - 6} L${u(p.x) - 6},${v(p.z) + 6}"/></g>`;
    let marks = '';
    if (state.questIndex >= 4) {
      marks += X(ITEM_SPOTS.ticket, has('ticket') ? '#8a7a68' : '#8a2c1f');
      marks += X(ITEM_SPOTS.device, has('device') ? '#8a7a68' : '#8a2c1f');
    }
    if (has('device')) marks += `<text x="${u(LAYOUT.tail.x) + 8}" y="${v(LAYOUT.tail.z) + 4}" font-size="15" font-weight="700" fill="#8a2c1f">T</text><circle cx="${u(LAYOUT.tail.x)}" cy="${v(LAYOUT.tail.z)}" r="9" fill="none" stroke="#8a2c1f" stroke-width="2"/>`;
    if (state.questIndex >= 6) marks += `<text x="${u(LAYOUT.signal.x) - 6}" y="${v(-108)}" font-size="26" font-weight="700" fill="#8a2c1f">?</text>`;
    const plane = `<text x="${u(LAYOUT.fuselage.x) - 9}" y="${v(LAYOUT.fuselage.z) + 6}" font-size="18" fill="#3a2e20">✈</text>`;
    const me = playerPos ? `<circle cx="${u(playerPos.x)}" cy="${v(playerPos.z)}" r="5" fill="#1d4f8a" stroke="#fff" stroke-width="1.5"/>` : '';
    return `<svg viewBox="0 0 440 470" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <clipPath id="torn"><path d="M0,470 L0,150 L30,140 L52,160 L80,128 L110,148 L140,118 L170,140 L200,112 L232,138 L262,110 L292,134 L318,104 L350,130 L382,100 L410,124 L440,96 L440,470 Z"/></clipPath>
        <pattern id="waves" width="22" height="10" patternUnits="userSpaceOnUse"><path d="M0,6 q5.5,-5 11,0 t11,0" fill="none" stroke="#7a8f9a" stroke-width="0.8" opacity="0.5"/></pattern>
      </defs>
      <g clip-path="url(#torn)">
        <rect width="440" height="470" fill="url(#waves)"/>
        <path d="${coast}" fill="#d8c79e" stroke="#5a4630" stroke-width="2"/>
        ${trees.join('')}
        ${paths}
        ${plane}
        ${marks}
        ${me}
      </g>
      <path d="M0,150 L30,140 L52,160 L80,128 L110,148 L140,118 L170,140 L200,112 L232,138 L262,110 L292,134 L318,104 L350,130 L382,100 L410,124 L440,96" fill="none" stroke="#9a835f" stroke-width="2"/>
      <text x="16" y="455" font-size="13" fill="#5a4630" font-family="monospace" direction="ltr">N ↑</text>
    </svg>`;
  }
}
