// LOST: The Missing Island — Parts 1–3. Bootstrap, game modes, zone loading, quest chain and saves.
// Zone content and zone-specific interactions live in src/zones/*, story data in src/data/*.
import * as THREE from 'three';
import { createEnvironment } from './env.js';
import { Player } from './player.js';
import { IntroScene } from './intro.js';
import { AudioSystem } from './audio.js';
import { UI } from './ui.js';
import { Sequencer } from './core/sequencer.js';
import { ITEMS } from './data/items.js';
import { QUESTS, questById, PART_START } from './data/quests.js';
import { FINAL_ENTRY, CLUES } from './data/clues.js';
import { QUEST_INFO, mainGoal, CLUE_LEARNED } from './data/story.js';
import { freshState, loadState, saveState, clearState, loadSettings, saveSettings, storageAvailable } from './save.js';
import { CONTAINERS, add as invAdd, count as invCount, spaceFor, transfer, totals } from './systems/inventory.js';
import { isStorable } from './data/items.js';
import { RECIPES } from './data/recipes.js';
import { createPost } from './gfx/post.js';
import { GFX } from './gfx/materials.js';
import { setAnisotropy } from './gfx/textures.js';
import { TIERS, AutoQuality, FogCuller, guessTier } from './gfx/perf.js';
import { Lobby } from './lobby.js';
import { DEFAULT_SKIN, skinById } from './data/skins.js';
import { RemotePlayers } from './net/remotes.js';
import { OnlinePanel } from './net/panel.js';
import { Minimap, BigMap } from './systems/minimap.js';
import { portal } from './portal.js';
import { LegalPanel } from './legal.js';
// fonts are bundled with the game (no outside requests, works on game portals)
import '@fontsource/heebo/300.css';
import '@fontsource/heebo/400.css';
import '@fontsource/heebo/500.css';
import '@fontsource/heebo/700.css';
import '@fontsource/heebo/800.css';
import '@fontsource/amatic-sc/400.css';
import '@fontsource/amatic-sc/700.css';
import '@fontsource/caveat/500.css';
import '@fontsource/caveat/700.css';
import { T, LANG, setLang, locale, applyToPage } from './i18n/index.js';

// zones are separate chunks; all of them are built once while the game loads (before the lobby and the plane)
// and kept, out of the scene while the player is elsewhere, so entering an area never stops to load
const ZONES = {
  beach: () => import('./zones/beach/index.js'),
  forest: () => import('./zones/forest/index.js'),
  ridge: () => import('./zones/ridge/index.js'),
  facility: () => import('./zones/facility/index.js'),
};
const LOADING_TEXT = { beach: T('Back to the beach…'), forest: T('Entering the forest…'), ridge: T('Climbing north…'), facility: T('Into the mountain…') };

const params = new URLSearchParams(location.search);
const DEBUG = params.has('debug');
const $ = (id) => document.getElementById(id);
applyToPage();

// ------------------------------------------------------------------ renderer
const canvas = $('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0; // per time of day, see env.js
renderer.outputColorSpace = THREE.SRGBColorSpace;
setAnisotropy(Math.min(8, renderer.capabilities.getMaxAnisotropy()));
const post = createPost(renderer);

const camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.1, 4000);
const ui = new UI();
const audio = new AudioSystem();
const settings = loadSettings();
// automatic quality: resolution, effects and shadow detail follow the measured frame rate (see gfx/perf.js)
// (perfLevel replaces the old perfTier, whose lowest levels rendered below full resolution)
delete settings.perfTier;
const autoQ = new AutoQuality(settings.perfLevel ?? guessTier(renderer), (tier) => {
  settings.perfLevel = tier;
  saveSettings(settings);
  applyQuality();
});
const fogCull = new FogCuller();
audio.volume = settings.volume;
const seq = new Sequencer();
const minimap = new Minimap($('hud'));
const bigmap = new BigMap(minimap);

const game = {
  mode: 'loading', // loading | title | intro | wake | play | journal | keypad | paused | reveal | cine | transition | end
  state: freshState(),
  zone: null,
  zonePromise: null,
  input: {},
  focused: null,
  time: 0,
  modeTime: 0,
  lastSave: 0,
  pointerLocked: false,
  suppressPause: false,
  boundaryCooldown: 0,
  hintTimer: 0,
  anims: [],
  flicker: 0,
  lookTween: null,
  cineCam: null,
};
let env, player, intro, lobby;

window.addEventListener('resize', () => {
  applyPixelRatio();
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  intro && intro.resize();
  bigmap.resize();
});

const has = (id) => game.state.collected.includes(id);

// first-time guidance for a mechanic; remembered across sessions so it never repeats
const TIPS = {
  move: T('WASD to move · click the screen and move the mouse to look · Shift to run.'),
  interact: T('When a prompt shows at the bottom of the screen, press E to check or pick up an object.'),
  flashlight: T('F turns the flashlight on and off.'),
  journal: T('J opens the booklet: what I know, the clues I found and the map.'),
  clue: T('Every clue goes into the booklet (J → Clues). Your mission updates as you discover more.'),
  locked: T('This has a combination lock. Look around for details that explain it. Everything you found is in the booklet (J).'),
  hint: T('Stuck? H gives a hint. Each press is clearer, and the last one explains the answer.'),
  forest: T('There is no arrow in the forest. Find your way by the red light, the trails and landmarks, and the forest map in the booklet (J → Map).'),
  storage: T('In the chest: click moves a whole stack, Shift+click moves one item.'),
};
function tip(id) {
  settings.tutorials = settings.tutorials || {};
  if (settings.tutorials[id] || !TIPS[id]) return;
  settings.tutorials[id] = true;
  saveSettings(settings);
  ui.tip(TIPS[id]);
}
// modes where the player is not playing: portals may only show ads then
const IDLE_MODES = ['loading', 'title', 'paused', 'end'];
function setMode(m) {
  game.mode = m;
  game.modeTime = 0;
  portal.gameplay(!IDLE_MODES.includes(m));
}

// ------------------------------------------------------------------ API handed to zones
const api = {
  get state() { return game.state; },
  get player() { return player; },
  audio, ui, seq, renderer,
  has,
  collect,
  setFlag(k, v = true) { game.state.flags[k] = v; },
  thought(text, seconds = 3.6, delay = 0) { delay ? seq.after(delay, () => ui.thought(text, seconds)) : ui.thought(text, seconds); },
  toast: (text, kind = '', life) => ui.toast(text, kind, life),
  subtitle: (text, kind, tr, seconds) => ui.subtitle(text, kind, tr, seconds),
  persist: () => persist(),
  collectResource,
  invCount: (id) => invCount(game.state.inv, id),
  openStorage,
  openWorkbench,
  refresh: () => refreshHUD(),
  openSymbolLock: (opts) => openPuzzle('openSymbolLock', opts),
  openWiring: (opts) => openPuzzle('openWiring', opts),
  openTuning: (opts) => openPuzzle('openTuning', { ...opts, tuner: audio.startTuning() }),
  openScope,
  // a document or a screen fills the panel; the game waits behind it
  readDocument(id, opts = {}) {
    const c = CLUES.find((x) => x.id === id);
    if (!c) return;
    audio.page();
    openPuzzle('openDocument', { title: c.title, html: typeof c.desc === 'function' ? c.desc(game.state) : c.desc, ...opts });
  },
  openTerminal: (opts) => openPuzzle('openTerminal', opts),
  openBoard() {
    audio.page();
    ui.journalTab = 'clues';
    openJournal();
    ui.thought(T('My board. Everything I found, connected with red string.'), 3);
  },
  checkQuests: () => checkQuests(),
  setFlashlight: (on) => setFlashlight(on),
  enterZone: (to, spawn) => enterZone(to, spawn),
  animate(dur, fn, done) { game.anims.push({ t: 0, dur, fn, done }); },
  flickerFlashlight(seconds) { game.flicker = seconds; },
  lookToward(pos, seconds = 0.7) {
    const dx = pos.x - player.pos.x, dz = pos.z - player.pos.z;
    let target = Math.atan2(-dx, -dz);
    let d = target - player.camYaw;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    game.lookTween = { from: player.camYaw, to: player.camYaw + d, t: 0, dur: seconds };
    player.facing = Math.atan2(dx, dz); // turn the survivor too, so the flashlight lands on it
  },
  openKeypad(opts) {
    tip('locked');
    setMode('keypad');
    releasePointer();
    ui.setPrompt(null);
    ui.openKeypad({ ...opts, onClose: () => { if (game.mode === 'keypad') { setMode('play'); updateLockHint(); } } });
  },
  beginCinematic(cameraFn) {
    releasePointer();
    ui.setPrompt(null);
    ui.setMarker(null);
    ui.show('hud', false);
    game.cineCam = cameraFn;
    setMode('cine');
  },
  endCinematic() {
    game.cineCam = null;
    ui.show('hud', true);
    refreshHUD();
    setMode('play');
  },
  showFinalEntry() { audio.page(); ui.showFinalEntry(FINAL_ENTRY); },
  hideFinalEntry() { ui.hideFinalEntry(); },
  showEndcard: (part) => showEndcard(part),
};

// ------------------------------------------------------------------ play with friends (src/net)
// Not offered in the game-portal builds (Poki / CrazyGames), whose rules limit outside connections.
const ONLINE_ALLOWED = !['poki', 'crazygames'].includes(import.meta.env.MODE);
const net = { panel: null, remotes: null, online: null, names: new Map(), badgeT: 0 };
const netName = () => settings.netName || skinById(player.skinId || settings.skin).name;

function setupOnline() {
  if (!ONLINE_ALLOWED) return;
  net.remotes = new RemotePlayers(env.scene, player);
  net.panel = new OnlinePanel({
    getName: netName,
    setName(name) {
      const n = String(name || '').trim().slice(0, 16);
      if (n === (settings.netName || '')) return;
      settings.netName = n;
      saveSettings(settings);
      if (net.online) net.online.setProfile(netName(), player.skinId);
    },
    getSkin: () => player.skinId,
    click: () => audio.click(),
    onOpen() { releasePointer(); },
    onClose() {},
    onChatClosed() { game.input = {}; if (game.mode === 'play') requestPointer(); },
    async connect() {
      const { Online } = await import('./net/online.js');
      net.online = new Online({
        onStatus: (st, detail) => {
          if (st === 'error' || st === 'offline') { net.remotes.clear(); net.names.clear(); }
          net.panel.onStatus(st, detail);
        },
        onRoster: (list) => {
          // announce who came and went
          const now = new Map(list.filter((r) => !r.self).map((r) => [r.id, r.name]));
          for (const [id, name] of now) if (!net.names.has(id)) net.panel.onJoinLeave(name, true);
          for (const [id, name] of net.names) if (!now.has(id)) net.panel.onJoinLeave(name, false);
          net.names = now;
          net.remotes.syncRoster(list);
          net.panel.onRoster(list);
        },
        onState: (id, st) => net.remotes.state(id, st),
        onChat: (id, name, text) => { net.panel.onChat(name, text); audio.click(); },
        onLeave: (id) => net.remotes.remove(id),
      });
      return net.online;
    },
  });
  const make = (id) => { const b = document.createElement('button'); b.id = id; b.className = 'btn'; b.textContent = T('Play with Friends'); b.addEventListener('click', () => { audio.click(); net.panel.open(); }); return b; };
  $('btn-title-settings').before(make('btn-online'));
  $('btn-resume').after(make('btn-online2'));
}

// every frame: friends' avatars, and our own position to the room (~10/s)
const NET_SEND_MODES = ['play', 'paused', 'journal', 'map', 'cine', 'scope', 'puzzle', 'keypad', 'storage', 'end'];
function updateOnline(dt) {
  if (!net.remotes || !game.zone) return;
  const hidden = ['title', 'intro', 'wake', 'loading', 'transition'].includes(game.mode);
  net.remotes.update(dt, game.zone.id, hidden);
  const o = net.online;
  if (!o || !o.active) return;
  if (player.skinId && player.skinId !== o.me.skin) o.setProfile(netName(), player.skinId);
  const p = player.pos;
  // outside the game itself (lobby, intro, wake-up) friends are told to hide this player
  const inWorld = NET_SEND_MODES.includes(game.mode);
  o.tick(dt, { z: game.zone.id, x: +p.x.toFixed(2), y: +p.y.toFixed(2), z2: +p.z.toFixed(2), f: +player.facing.toFixed(3), v: inWorld ? +player.speed.toFixed(2) : 0, a: player.air ? 1 : 0, l: player.flashlightOn ? 1 : 0, h: inWorld ? 0 : 1 });
  if ((net.badgeT -= dt) < 0) { net.badgeT = 1; net.panel.renderBadge(net.remotes.nearby(game.zone.id)); }
}

// ------------------------------------------------------------------ boot
async function boot() {
  await portal.init();
  try {
    env = createEnvironment(renderer);
    player = new Player(env.scene, camera);
    player.onBoundary = onBoundary;
    ui.setLoading(0.02, T('Character'));
    const onSkin = (p) => ui.setLoading(0.02 + p * 0.08, T('Character'));
    try {
      await player.load(onSkin, settings.skin || DEFAULT_SKIN);
    } catch (err) {
      // a missing or broken skin file must never block the game: fall back to the original survivor
      console.error(err);
      if (!player.mixer) await player.setSkin(DEFAULT_SKIN);
    }
    intro = new IntroScene(audio, ui);
    lobby = new Lobby({ player, camera, settings, ui, hooks: { click: () => audio.click() } });
    setupOnline();
    applySettings();
    // the lobby is on the beach; every other area is built and drawn once now, behind the loading screen
    const saved = loadState();
    await loadZone('beach', (p, t) => ui.setLoading(0.1 + p * 0.3, t), saved);
    await preloadZones(saved || freshState()).catch((err) => console.error(err));
    if (game.zone.id !== 'beach') await loadZone('beach', () => {}, saved);
  } catch (err) {
    console.error(err);
    ui.setLoading(1, T('Error loading the world. Try refreshing the page.'));
    return;
  }
  ui.setLoading(0.96, T('Preparing shaders'));
  await new Promise((r) => setTimeout(r, 0));
  intro.compile(renderer);
  ui.setLoading(1, T('Ready'));
  portal.loadingFinished();
  setTimeout(() => { ui.show('loading', false); showTitle(); }, 250);
  requestAnimationFrame(loop);
}

// ------------------------------------------------------------------ zones
const zoneCache = {}; // id -> promise of the built zone
const zoneReady = (id) => !!zoneCache[id] && zoneCache[id].done;

function buildZone(id, onProgress) {
  if (!zoneCache[id]) {
    const p = ZONES[id]().then((mod) => mod.build(env, api, onProgress));
    p.then(() => { p.done = true; }, () => { delete zoneCache[id]; });
    zoneCache[id] = p;
  }
  return zoneCache[id];
}

// builds every area and gets its shaders and textures onto the GPU behind the loading screen. Nothing here may
// hold the game: an area that fails or takes too long is simply built (again) when the player walks in.
async function preloadZones(state) {
  const order = ['forest', 'ridge', 'facility'];
  for (let i = 0; i < order.length; i++) {
    const id = order[i];
    try {
      await loadZone(id, (p, t) => ui.setLoading(0.4 + (i + p) * 0.15, t), state);
      ui.setLoading(0.4 + (i + 0.9) * 0.15, T('Preparing shaders'));
      await warmZone(game.zone);
    } catch (err) {
      console.error(err);
    }
  }
  await loadZone('beach', () => {}, loadState());
  await warmZone(game.zone);
}

// compiles every shader the zone needs, hidden things included (an item not placed yet, a far chunk), and uploads
// its textures. No frame is drawn: drawing a whole zone at once could choke a weak graphics card.
async function warmZone(zone) {
  const hidden = [];
  zone.group.traverse((o) => { if (!o.visible) { o.visible = true; hidden.push(o); } });
  let done;
  try {
    done = renderer.compileAsync(env.scene, camera); // the compile itself happens right away, inside this call
  } finally {
    for (const o of hidden) o.visible = false;
  }
  const textures = new Set();
  zone.group.traverse((o) => {
    for (const m of [].concat(o.material || [])) for (const v of Object.values(m)) if (v && v.isTexture && v.image && !v.isRenderTargetTexture) textures.add(v);
  });
  for (const t of textures) renderer.initTexture(t);
  // the browser finishes compiling in the background; never wait on it for more than a few seconds
  await Promise.race([done.catch(() => {}), new Promise((r) => setTimeout(r, 4000))]);
}

async function loadZone(id, onProgress = () => {}, stateForEnv = null) {
  if (game.zone && game.zone.id === id) return game.zone;
  const zone = await buildZone(id, onProgress);
  if (game.zone && game.zone.id === id) return game.zone;
  if (game.zone) {
    fogCull.setZone(null);
    game.zone.group.removeFromParent();
    game.zone = null;
  }
  game.focused = null;
  env.scene.add(zone.group);
  game.zone = zone;
  player.setZone(zone);
  minimap.setZone(zone);
  fogCull.setZone(zone.group);
  camera.far = zone.cameraFar;
  camera.updateProjectionMatrix();
  applyZoneEnv(stateForEnv || game.state);
  zone.sync(stateForEnv || game.state);
  applyShadowSetting();
  const spawn = Object.values(zone.spawns)[0];
  player.setPosition(spawn.x, spawn.z, spawn.yaw);
  player.updateCamera(1);
  renderer.compile(env.scene, camera);
  return zone;
}

function applyZoneEnv(s = game.state) {
  const z = game.zone;
  if (!z) return;
  env.setTime(z.time(s), { fogDensity: z.fogDensity(s) });
  post.setMood(z.time(s));
}

async function enterZone(to, spawnName) {
  if (game.mode === 'transition' || !game.zone || game.zone.id === to) return;
  setMode('transition');
  releasePointer();
  ui.setPrompt(null);
  ui.setMarker(null);
  ui.fade(1, 0.6);
  audio.stopAmbience();
  await new Promise((r) => setTimeout(r, 650));
  const firstForest = to === 'forest' && !game.state.flags.nightfall;
  if (to === 'forest') game.state.flags.nightfall = true;
  const from = game.zone.id;
  game.state.zone = to;
  ui.show('loading', !zoneReady(to)); // everything is normally built at the start
  ui.setLoading(0, to === 'forest' && from !== 'beach' ? T('Back to the forest…') : LOADING_TEXT[to]);
  await loadZone(to, (p, t) => ui.setLoading(p, t));
  ui.show('loading', false);
  const sp = game.zone.spawns[spawnName];
  player.setPosition(sp.x, sp.z, sp.yaw);
  player.camPitch = 0.25;
  player.updateCamera(1);
  if (firstForest) setFlashlight(true);
  persist();
  setMode('play');
  checkQuests();
  refreshHUD();
  updateLockHint();
  audio.resumeAmbience();
  ui.fade(0, 1.4);
  if (to === 'forest') setTimeout(() => tip('forest'), 3000);
  if (game.zone.onEnter) game.zone.onEnter(from);
  if (firstForest) {
    ui.titleCard(T('A few hours later'), T('The forest · night'));
    api.thought(T('Darkness fell fast. The flashlight is all I have, and one red light above the treetops.'), 5, 2.5);
  }
}

// ------------------------------------------------------------------ items & quests
function bagFull(need) {
  audio.deny();
  ui.toast(need ? T`My bag is full, no room for ${need}. I can make room in the chest at the beach camp.` : T('My bag is full'), 'warn', 4);
}

// returns true if the item was taken
function collect(id, { silent = false } = {}) {
  if (has(id)) return false;
  const s = game.state;
  if (isStorable(id)) {
    if (spaceFor(s.inv, id) < 1) { bagFull(ITEMS[id].name); return false; }
    invAdd(s.inv, id, 1);
  }
  s.collected.push(id);
  if ((ITEMS[id].kind === 'clue' || ITEMS[id].clue) && !s.clues.includes(id)) s.clues.push(id);
  if (!silent) {
    audio.pickup();
    player.playPickup();
  }
  if (ITEMS[id].kind === 'clue' || ITEMS[id].clue) {
    const c = CLUES.find((x) => x.id === id);
    ui.discovery(c ? c.title : ITEMS[id].name, CLUE_LEARNED[id]);
    if (id === 'booklet') tip('journal'); else if (id !== 'stillHere') tip('clue');
  } else {
    ui.toast(ITEMS[id].toast, 'item', 3.6);
  }
  if (id === 'flashlight') tip('flashlight');
  if (['water', 'flashlight', 'bandage'].includes(id)) api.thought(ITEMS[id].desc, 3.4, 0.4);
  checkQuests();
  refreshHUD(id);
  persist();
  return true;
}

// a resource pile: all of it goes into the bag, or none of it
function collectResource(nodeId, itemId, qty) {
  const s = game.state;
  if (s.collected.includes(nodeId)) return false;
  if (spaceFor(s.inv, itemId) < qty) { bagFull(`${ITEMS[itemId].name} ×${qty}`); return false; }
  invAdd(s.inv, itemId, qty);
  s.collected.push(nodeId);
  audio.pickup();
  player.playPickup();
  ui.toast(T`Picked up: ${ITEMS[itemId].name} ×${qty}`, 'item', 3);
  refreshHUD(itemId);
  persist();
  return true;
}

function openStorage(containerId, onClosed) {
  tip('storage');
  const s = game.state;
  const chest = s.containers[containerId];
  setMode('storage');
  releasePointer();
  ui.setPrompt(null);
  ui.openStorage({
    title: CONTAINERS[containerId].name,
    bag: s.inv,
    chest,
    keyItems: ['flashlight', 'booklet', 'powerCell', 'badge', 'fuse'].filter((id) => has(id) && !(id === 'powerCell' && s.flags.powerInstalled) && !(id === 'fuse' && s.flags.fuseInstalled)),
    move(direction, id, qty) {
      const [from, to] = direction === 'toChest' ? [s.inv, chest] : [chest, s.inv];
      const r = transfer(from, to, id, qty);
      if (r.moved) { audio.click(); persist(); } else audio.deny();
      return r;
    },
    onClose() {
      if (game.mode === 'storage') setMode('play');
      refreshHUD();
      persist();
      updateLockHint();
      onClosed && onClosed();
    },
  });
}

// a puzzle device takes the screen; the game waits behind it
function openPuzzle(method, opts) {
  if (method === 'openSymbolLock') tip('locked');
  setMode('puzzle');
  releasePointer();
  ui.setPrompt(null);
  return ui[method]({
    ...opts,
    onClose() {
      if (game.mode === 'puzzle') setMode('play');
      refreshHUD();
      persist();
      updateLockHint();
      opts.onClose && opts.onClose();
    },
  });
}

// looking through a spotting scope: narrow field of view, pan to search
function openScope({ eye, yaw, pitch, glint, found, onFound }) {
  setMode('scope');
  releasePointer();
  ui.setPrompt(null);
  ui.show('hud', false);
  game.scope = { eye, yaw, pitch, glint, onFound, found, hold: 0 };
  glint.visible = true;
  camera.fov = 13;
  camera.updateProjectionMatrix();
  ui.showScope(true);
}
function closeScope() {
  if (!game.scope) return;
  game.scope.glint.visible = false;
  game.scope = null;
  camera.fov = 60;
  camera.updateProjectionMatrix();
  ui.showScope(false);
  ui.show('hud', true);
  setMode('play');
  refreshHUD();
  updateLockHint();
}
function updateScope(dt) {
  const sc = game.scope, inp = game.input;
  const sp = 0.45 * dt;
  if (inp.ArrowLeft || inp.KeyA) sc.yaw += sp;
  if (inp.ArrowRight || inp.KeyD) sc.yaw -= sp;
  if (inp.ArrowUp || inp.KeyW) sc.pitch += sp * 0.7;
  if (inp.ArrowDown || inp.KeyS) sc.pitch -= sp * 0.7;
  sc.pitch = Math.max(-0.35, Math.min(0.45, sc.pitch));
  const dir = new THREE.Vector3(Math.sin(sc.yaw) * Math.cos(sc.pitch), Math.sin(sc.pitch), Math.cos(sc.yaw) * Math.cos(sc.pitch));
  camera.position.copy(sc.eye);
  camera.lookAt(sc.eye.clone().add(dir));
  const toGlint = sc.glint.position.clone().sub(sc.eye).normalize();
  if (dir.dot(toGlint) > Math.cos(THREE.MathUtils.degToRad(2.6))) {
    sc.hold += dt;
    if (sc.hold > 0.5 && !sc.found) { sc.found = true; sc.onFound(); }
  } else sc.hold = 0;
}

// H: escalating hints for the current mission
function showHint() {
  const s = game.state;
  const q = QUESTS[Math.min(s.questIndex, QUESTS.length - 1)];
  if (!q.hints || !q.hints.length) { ui.toast(T('No hint right now.'), '', 2); return; }
  s.hints = s.hints || {};
  const prev = s.hints[q.id] || 0;
  const lvl = Math.min(prev + 1, q.hints.length);
  if (lvl > prev) { s.hints[q.id] = lvl; s.hintsUsed = (s.hintsUsed || 0) + 1; }
  audio.page();
  ui.toast(T`Hint ${lvl} / ${q.hints.length}`, '', 2.2);
  ui.thought(q.hints[lvl - 1], 7);
  persist();
}

function openWorkbench() {
  const s = game.state;
  setMode('storage');
  releasePointer();
  ui.setPrompt(null);
  ui.openWorkbench({
    materials: totals(s.inv, s.containers.baseChest),
    recipes: RECIPES,
    onClose() { if (game.mode === 'storage') setMode('play'); updateLockHint(); },
  });
}

function checkQuests() {
  const s = game.state;
  let advanced = false;
  while (s.questIndex < QUESTS.length - 1) {
    const q = QUESTS[s.questIndex];
    if (!q.done(s)) break;
    if (q.cinematic === 'reveal') { startReveal(); return; }
    s.questIndex++;
    advanced = true;
    onQuestStart(s.questIndex);
  }
  refreshHUD();
  if (advanced) persist();
}

function onQuestStart(i) {
  const q = QUESTS[i];
  game.questTime = 0;
  audio.quest();
  ui.flashQuest();
  ui.toast(q.final ? T`Part ${q.part - 1} complete` : T`New mission: ${q.title}`, 'quest', 4);
  if (q.start) api.thought(q.start.thought, 4.2, q.start.delay || 0.8);
}

function refreshHUD(justAdded) {
  const s = game.state;
  const i = Math.min(s.questIndex, QUESTS.length - 1);
  const q = QUESTS[i];
  const info = QUEST_INFO[q.id];
  const objective = info ? info.objective(s) : q.objective;
  ui.setQuest(i, q, q.sub ? q.sub(s, ITEMS) : null, { goal: mainGoal(s), objective });
  if (game.lastObjective && game.lastObjective !== objective && game.mode === 'play') ui.flashQuest();
  game.lastObjective = objective;
  ui.setHintAvailable(!!(q.hints && q.hints.length));
  ui.setInventory(s, player.flashlightOn, justAdded);
  player.showBandage(has('bandage'));
  player.holdFlashlight(has('flashlight') && player.flashlightOn);
  if (game.zone) game.zone.sync(s);
}

function objectiveTarget() {
  const s = game.state;
  const q = QUESTS[Math.min(s.questIndex, QUESTS.length - 1)];
  const t = q.target && q.target(s, player.pos);
  if (!t) return null;
  if (t.zone !== game.zone.id) return game.zone.trailhead; // lead the player to the way out first
  return t;
}

function persist() {
  const s = game.state;
  if (player && game.zone && ['play', 'journal', 'map', 'keypad', 'storage', 'puzzle', 'scope', 'end', 'paused', 'cine'].includes(game.mode)) {
    s.player = { zone: game.zone.id, x: +player.pos.x.toFixed(2), z: +player.pos.z.toFixed(2), yaw: +player.facing.toFixed(3) };
  }
  if (game.zone) s.zone = game.zone.id;
  s.flashlightOn = player ? player.flashlightOn : false;
  saveState(s);
  game.lastSave = game.time;
}

// ------------------------------------------------------------------ screens & flow
function partLabel(s) {
  const q = QUESTS[Math.min(s.questIndex, QUESTS.length - 1)];
  if (q.final) return T`Part ${q.part - 1} complete`;
  return T`Part ${q.part} · Mission ${s.questIndex - PART_START[q.part] + 1}`;
}

// main lobby on the beach (the forest is left behind if the player was there)
async function showTitle() {
  setMode('title');
  game.starting = false;
  audio.stopSpeech();
  audio.stopAmbience();
  seq.clear();
  game.anims.length = 0;
  ['hud', 'pause', 'endcard', 'keypad', 'final-entry', 'reveal', 'skip-hint'].forEach((id) => ui.show(id, false));
  audio.setIndoor(0);
  ui.subtitle(null);
  ui.blur(0);
  ui.eyes('hidden');
  if (document.pointerLockElement) { game.suppressPause = true; document.exitPointerLock(); }
  if (game.zone.id !== 'beach') {
    ui.fade(1, 0);
    ui.show('loading', !zoneReady('beach'));
    ui.setLoading(0, T('Back to the beach…'));
    await loadZone('beach', (p, t) => ui.setLoading(p, t), loadState() || game.state);
    ui.show('loading', false);
  }
  // the lobby is always a clear day on the beach, whatever time it is in the story
  env.setTime('day');
  post.setMood('lobby');
  lobby.enter(game.zone);
  refreshLobbyMenu();
  lobbySound();
  ui.fade(0, 1.2);
}

function refreshLobbyMenu() {
  const saved = loadState();
  const canContinue = !!(saved && saved.flags.introDone);
  $('btn-play-label').textContent = canContinue ? T('Continue') : T('Play');
  $('play-note').textContent = canContinue ? T`Pick up where you left off · ${partLabel(saved)}` : T('Start from the beginning: the flight, the crash and the island');
  ui.show('btn-new', canContinue);
  $('save-info').textContent = canContinue
    ? T`Last saved: ${new Date(saved.savedAt).toLocaleString(locale())}`
    : storageAvailable() ? '' : T('Note: your browser blocks local saving, so progress will not be saved.');
}

// waves and birds behind the lobby; browsers only allow sound after the first click or key press
function lobbySound() {
  if (game.mode !== 'title' || !audio.ctx) return;
  audio.startAmbience();
  audio.resumeAmbience();
}
for (const ev of ['pointerdown', 'keydown']) {
  window.addEventListener(ev, () => {
    if (game.mode !== 'title' || audio.ctx) return;
    audio.init();
    audio.setVolume(settings.volume);
    lobbySound();
  });
}

// PLAY / NEW GAME leave the lobby once: fade to black, then the existing flow takes over
function leaveLobby(start) {
  if (game.mode !== 'title' || game.starting || lobby.view !== 'lobby') return;
  game.starting = true;
  audio.init();
  audio.click();
  ui.fade(1, 0.7);
  setTimeout(() => portal.commercialBreak(audio).then(() => {
    lobby.leave();
    game.starting = false;
    start();
  }), 750);
}

async function newGame() {
  clearState();
  seq.clear();
  game.anims.length = 0;
  game.state = freshState();
  setFlashlight(false);
  lobby.leave();
  audio.init();
  audio.setVolume(settings.volume);
  // the forest may be loaded (title showed it); bring the beach back while the intro plays
  game.zonePromise = game.zone.id === 'beach' ? Promise.resolve() : loadZone('beach');
  game.zonePromise.then(() => { applyZoneEnv(); refreshHUD(); });
  if (game.zone.id === 'beach') { applyZoneEnv(); game.zone.sync(game.state); }
  startIntro();
}

async function continueGame() {
  const saved = loadState();
  if (!saved || !saved.flags.introDone) return newGame();
  seq.clear();
  game.state = saved;
  lobby.leave();
  audio.init();
  audio.setVolume(settings.volume);
  ui.fade(1, 0);
  if (game.zone.id !== saved.zone) {
    ui.show('loading', !zoneReady(saved.zone));
    await loadZone(saved.zone, (p, t) => ui.setLoading(p, t));
    ui.show('loading', false);
  }
  applyZoneEnv();
  game.zone.sync(game.state);
  const p = saved.player && (saved.player.zone || 'beach') === game.zone.id ? saved.player : Object.values(game.zone.spawns)[0];
  player.setPosition(p.x, p.z, p.yaw ?? 0);
  player.lying = 0;
  setFlashlight(!!saved.flashlightOn && has('flashlight'));
  ui.fade(0, 1.2);
  audio.startAmbience();
  audio.resumeAmbience();
  enterPlay();
  ui.toast(T('Progress loaded'), '', 2.5);
  checkQuests(); // also resumes a reveal interrupted by a reload
  chapter3Intro();
}

function startIntro() {
  setMode('intro');
  ui.show('hud', false);
  audio.stopAmbience();
  ui.show('skip-hint', !!settings.introSeen);
  intro.start(async () => {
    settings.introSeen = true;
    saveSettings(settings);
    ui.show('skip-hint', false);
    await game.zonePromise;
    startWake();
  });
}

function startWake() {
  setMode('wake');
  ui.fade(0, 0);
  ui.eyes('');
  ui.blur(10);
  game.wakeFired = null;
  const sp = game.zone.spawns.wake;
  player.setPosition(sp.x, sp.z, sp.yaw);
  player.lying = 1;
  player.camPitch = 0.28;
  audio.startAmbience();
}

function updateWake(dt) {
  const t = game.modeTime;
  const fired = (game.wakeFired ||= new Set());
  const once = (k, at, fn) => { if (t >= at && !fired.has(k)) { fired.add(k); fn(); } };
  once('blink1', 0.6, () => ui.eyes('half'));
  once('blink2', 1.7, () => ui.eyes(''));
  once('blink3', 2.4, () => ui.eyes('open'));
  once('t1', 2.8, () => ui.thought(T('...where am I?'), 2.6));
  once('t2', 6.0, () => ui.thought(T('The plane. We crashed.'), 2.8));
  ui.blur(Math.max(0, 10 - t * 2.2));
  // the Stand_Up clip is scrubbed by `lying`: still on the sand, then up over ~4.6 s
  player.lying = Math.max(0.0001, 1 - Math.min(1, Math.max(0, (t - 4.2) / 4.6)));
  if (t > 8.8) player.lying = 0;
  player.update(dt, {}, false);

  // camera: from above the face, to behind the shoulder
  const fwd = new THREE.Vector3(Math.sin(player.facing), 0, Math.cos(player.facing));
  const headLying = (game.wakeHead ||= player.headPosition());
  const top = headLying.clone().add(new THREE.Vector3(0, 1.6 + t * 0.12, 0)).addScaledVector(fwd, 0.6);
  const k = Math.min(1, Math.max(0, (t - 6.2) / 2.4));
  const kk = k * k * (3 - 2 * k);
  player.updateCamera(1);
  const follow = camera.position.clone();
  camera.position.lerpVectors(top, follow, kk);
  const lookA = headLying.clone().addScaledVector(fwd, 0.4);
  const lookB = player.pos.clone().add(new THREE.Vector3(0, 1.45, 0)).addScaledVector(fwd, 1.5);
  camera.lookAt(new THREE.Vector3().lerpVectors(lookA, lookB, kk));
  if (t > 8.8) {
    ui.eyes('hidden');
    ui.blur(0);
    game.wakeFired = null;
    game.wakeHead = null;
    game.state.flags.introDone = true;
    enterPlay();
    onQuestStart(0);
    persist();
  }
}

function enterPlay() {
  setMode('play');
  setTimeout(() => tip('move'), 1500);
  ui.show('hud', true);
  ui.hintControls(true);
  game.hintTimer = 22;
  refreshHUD();
  updateLockHint();
}

function skipIntro() {
  if (game.mode === 'intro' && settings.introSeen) intro.finish();
}

// ------------------------------------------------------------------ journal
function openJournal() {
  setMode('journal');
  if (has('booklet') && !game.state.flags.bookletRead) ui.journalTab = 'message';
  ui.mapChoice = null;
  ui.renderJournal(game.state, player.pos);
  ui.show('journal', true);
  ui.setPrompt(null);
  audio.page();
  releasePointer();
  if (has('booklet') && !game.state.flags.bookletRead) {
    game.state.flags.bookletRead = true;
    game.pendingBookletQuest = true; // the quest updates when the booklet is closed, after reading
  }
}

// M: the big map of the whole zone (gameplay waits while it is open)
function openMap() {
  setMode('map');
  ui.setPrompt(null);
  game.input = {};
  bigmap.show(true, player.pos, player.facing, game.state);
  audio.page();
  releasePointer();
}

function closeMap() {
  bigmap.show(false);
  audio.page();
  setMode('play');
  updateLockHint();
}

function closeJournal() {
  ui.show('journal', false);
  audio.page();
  setMode('play');
  updateLockHint();
  refreshHUD();
  if (game.pendingBookletQuest) {
    game.pendingBookletQuest = false;
    checkQuests();
  }
  persist();
}

document.querySelectorAll('.book-tabs .tab').forEach((t) => t.addEventListener('click', () => {
  ui.journalTab = t.dataset.tab;
  audio.page();
  ui.renderJournal(game.state, player.pos);
}));
$('journal-close').addEventListener('click', closeJournal);

// ------------------------------------------------------------------ Part 1 reveal & end cards
function startReveal() {
  if (game.mode === 'reveal') return;
  setMode('reveal');
  releasePointer();
  ui.setPrompt(null);
  ui.show('hud', false);
  audio.stopAmbience();
  audio.reveal();
  const en = $('reveal-en'), he = $('reveal-he');
  en.textContent = '';
  he.classList.remove('show');
  he.textContent = T('Someone planned this.');
  ui.show('reveal', true);
  const text = 'THE CRASH WAS NO ACCIDENT.';
  let i = 0;
  setTimeout(function type() {
    en.textContent = text.slice(0, i);
    if (i === text.length) {
      en.innerHTML = `<span class="glitch">${text}</span>`;
      he.classList.add('show');
      return;
    }
    i++;
    audio.click();
    setTimeout(type, text[i - 1] === ' ' ? 160 : 75);
  }, 1400);
  setTimeout(() => {
    ui.show('reveal', false);
    const s = game.state;
    s.questIndex = questById('reveal') + 1;
    s.flags.revealSeen = true;
    audio.resumeAmbience();
    audio.signalBeeps();
    ui.show('hud', true);
    setMode('play');
    refreshHUD();
    onQuestStart(s.questIndex);
    persist();
    // point the camera toward the signal above the jungle
    player.camYaw = Math.atan2(player.pos.x - 8, player.pos.z + 178);
    player.camPitch = 0.05;
    api.thought(T('A red light, blinking, above the forest. Someone is transmitting.'), 4.5, 0.9);
    setTimeout(() => showEndcard(1), 5200);
  }, 9000);
}

function showEndcard(part) {
  if (game.mode !== 'play') return;
  setMode('end');
  releasePointer();
  const s = game.state;
  if (part === 1) {
    $('end-kicker').textContent = T('End of Part 1');
    $('end-title').textContent = T('The Crash');
    $('end-obj').innerHTML = T('New mission: Find the source of the signal in the forest.');
    $('btn-keep').textContent = T('Continue to Part 2');
  } else if (part === 2) {
    $('end-kicker').textContent = T('End of Part 2');
    $('end-title').textContent = T('The Signal');
    $('end-obj').innerHTML = T('<span class="end-en">Someone is still here.</span><br>The lights in the forest came on, and the signal moved north.');
    $('btn-keep').textContent = T('Continue to Part 3');
  } else {
    $('end-kicker').textContent = T('Chapter 3 complete');
    $('end-title').textContent = T('The Observer');
    $('end-obj').innerHTML = '<span class="end-en">“Someone has been watching.”</span><br><span class="end-protocol">NIGHTJAR PROTOCOL — PHASE 3 ACTIVATED</span>';
    $('btn-keep').textContent = T('Keep exploring');
  }
  $('end-stats').textContent = T`${s.clues.length} booklet entries · ${s.hintsUsed || 0} hints · progress saved`;
  ui.show('endcard', true);
}

$('btn-keep').addEventListener('click', () => {
  ui.show('endcard', false);
  portal.commercialBreak(audio).then(() => { setMode('play'); updateLockHint(); requestPointer(); chapter3Intro(); });
});

// the chapter 3 title, once, when the player first plays on after the Part 2 ending
function chapter3Intro() {
  const s = game.state;
  if (s.flags.ch3Intro || s.questIndex !== questById('north')) return;
  s.flags.ch3Intro = true;
  persist();
  setTimeout(() => {
    ui.titleCard(T('Chapter 3'), T('The Observer'));
    audio.signalBeeps();
    setTimeout(() => ui.toast(T('Objective: Follow the northbound signal.'), 'quest', 5), 2600);
  }, 600);
}
$('btn-end-main').addEventListener('click', () => { persist(); ui.show('endcard', false); showTitle(); });

// ------------------------------------------------------------------ pause & settings
function pause() {
  if (game.mode !== 'play') return;
  setMode('paused');
  persist();
  $('pause-title').textContent = T('Paused');
  ui.show('pause-menu', true);
  ui.show('btn-settings-back', false);
  ui.show('pause', true);
  ui.setPrompt(null);
}
function resume() {
  ui.show('pause', false);
  setMode('play');
  updateLockHint();
  requestPointer();
}

// graphics quality: the automatic tier (or the best one when "auto" is off) within the player's own settings.
// "Advanced graphics" off = no post-processing, simple terrain blending, 1024 shadows.
function qualityTier() {
  if (params.has('lowfx')) return TIERS[TIERS.length - 1];
  return TIERS[settings.autoQuality !== false ? autoQ.tier : 0];
}
function applyPixelRatio() {
  const t = qualityTier();
  renderer.setPixelRatio(params.has('lowfx') ? 0.5 : Math.min(window.devicePixelRatio || 1, t.pr));
  renderer.setSize(innerWidth, innerHeight);
  post.setSize(innerWidth, innerHeight);
}
function applyQuality() {
  const t = qualityTier();
  const high = settings.hq !== false && !params.has('lowfx');
  post.enabled = high && t.post;
  post.setSamples(t.samples);
  GFX.detail.value = high && t.detail ? 1 : 0;
  env.setShadowQuality(high ? t.shadow : 1024);
  fogCull.maxDist = t.veg;
  applyPixelRatio();
}

let shadowsOn = null;
function applyShadowSetting() {
  // switching shadows rebuilds every shader: only when the setting really changed
  if (shadowsOn === settings.shadows) return;
  shadowsOn = settings.shadows;
  renderer.shadowMap.enabled = settings.shadows;
  env.setShadows(settings.shadows);
  if (player) player.setFlashlightShadows(settings.shadows);
  const refresh = (o) => { if (o.material) [].concat(o.material).forEach((m) => (m.needsUpdate = true)); };
  env.scene.traverse(refresh);
  // areas the player is not in are kept out of the scene
  for (const p of Object.values(zoneCache)) p.then((z) => { if (z !== game.zone) z.group.traverse(refresh); }, () => {});
}

function applySettings() {
  $('set-sens').value = settings.sens;
  $('set-vol').value = settings.volume;
  $('set-invert').checked = settings.invertY;
  $('set-shadows').checked = settings.shadows;
  $('set-quality').checked = settings.hq !== false;
  $('set-auto').checked = settings.autoQuality !== false;
  player.settings.sens = settings.sens;
  player.settings.invertY = settings.invertY;
  audio.setVolume(settings.volume);
  applyQuality();
  applyShadowSetting();
}
function bindSetting(id, key, prop = 'value', parse = Number) {
  $(id).addEventListener('input', (e) => {
    settings[key] = prop === 'checked' ? e.target.checked : parse(e.target.value);
    saveSettings(settings);
    if (key === 'shadows') applyShadowSetting();
    if (key === 'hq' || key === 'autoQuality') applyQuality();
    player.settings.sens = settings.sens;
    player.settings.invertY = settings.invertY;
    audio.setVolume(settings.volume);
    });
}
bindSetting('set-sens', 'sens');
bindSetting('set-vol', 'volume');
bindSetting('set-invert', 'invertY', 'checked');
bindSetting('set-quality', 'hq', 'checked');
// language: English or Hebrew. Saved per browser; switching reloads the page (progress is saved).
$('set-lang').value = LANG;
const switchLang = (lang) => { if (game.mode === 'paused') persist(); setLang(lang); };
$('set-lang').addEventListener('change', (e) => switchLang(e.target.value));
$('btn-lang').textContent = LANG === 'he' ? 'English' : 'עברית';
$('btn-lang').addEventListener('click', () => switchLang(LANG === 'he' ? 'en' : 'he'));
bindSetting('set-shadows', 'shadows', 'checked');
bindSetting('set-auto', 'autoQuality', 'checked');

$('btn-resume').addEventListener('click', resume);
$('btn-main').addEventListener('click', () => { persist(); ui.show('pause', false); showTitle(); });
$('btn-new2').addEventListener('click', () => confirmNew(() => { ui.show('pause', false); newGame(); }));
$('btn-play').addEventListener('click', () => {
  const saved = loadState();
  leaveLobby(saved && saved.flags.introDone ? continueGame : newGame);
});
$('btn-new').addEventListener('click', () => {
  audio.init();
  const saved = loadState();
  if (saved && saved.flags.introDone) confirmNew(() => leaveLobby(newGame)); else leaveLobby(newGame);
});
$('btn-title-settings').addEventListener('click', () => {
  $('pause-title').textContent = T('Settings');
  ui.show('pause-menu', false);
  ui.show('btn-settings-back', true);
  ui.show('pause', true);
});
$('btn-settings-back').addEventListener('click', () => ui.show('pause', false));
const legal = new LegalPanel();
$('btn-legal').addEventListener('click', () => { audio.click(); legal.open(); });

function confirmNew(onYes) {
  $('confirm-text').textContent = T('Start a new game? Your saved progress in every part will be deleted.');
  ui.show('confirm', true);
  $('confirm-yes').onclick = () => { ui.show('confirm', false); onYes(); };
  $('confirm-no').onclick = () => ui.show('confirm', false);
}

// ------------------------------------------------------------------ input
function requestPointer() {
  if (game.mode !== 'play') return;
  try {
    const p = canvas.requestPointerLock && canvas.requestPointerLock();
    if (p && p.catch) p.catch(() => {});
  } catch (e) { /* pointer lock not available: drag-to-look still works */ }
}
function releasePointer() {
  if (document.pointerLockElement) { game.suppressPause = true; document.exitPointerLock(); }
  updateLockHint();
}
function updateLockHint() {
  ui.show('lock-hint', game.mode === 'play' && !game.pointerLocked && !game.dragging);
}

document.addEventListener('pointerlockchange', () => {
  game.pointerLocked = document.pointerLockElement === canvas;
  if (!game.pointerLocked && game.mode === 'play' && !game.suppressPause) pause();
  game.suppressPause = false;
  updateLockHint();
});

canvas.addEventListener('mousedown', (e) => {
  if (game.mode === 'scope') { game.dragging = true; game.lastMouse = { x: e.clientX, y: e.clientY }; return; }
  if (game.mode !== 'play') return;
  game.dragging = true;
  game.lastMouse = { x: e.clientX, y: e.clientY };
  requestPointer();
  updateLockHint();
});
window.addEventListener('mouseup', () => { game.dragging = false; });
window.addEventListener('mousemove', (e) => {
  if (game.mode === 'scope' && game.dragging && game.lastMouse) {
    game.scope.yaw -= (e.clientX - game.lastMouse.x) * 0.0016 * settings.sens;
    game.scope.pitch -= (e.clientY - game.lastMouse.y) * 0.0016 * settings.sens * (settings.invertY ? -1 : 1);
    game.lastMouse = { x: e.clientX, y: e.clientY };
    return;
  }
  if (game.mode !== 'play') return;
  if (game.pointerLocked) player.look(e.movementX, e.movementY);
  else if (game.dragging && game.lastMouse) {
    player.look(e.clientX - game.lastMouse.x, e.clientY - game.lastMouse.y);
    game.lastMouse = { x: e.clientX, y: e.clientY };
  }
});

window.addEventListener('keydown', (e) => {
  // typing in a text box (name, room code, chat) never moves the survivor
  if (e.target && /^(INPUT|TEXTAREA)$/.test(e.target.tagName) && e.target.type !== 'range' && e.target.type !== 'checkbox') return;
  if (e.code === 'Enter' && game.mode === 'play' && net.panel && net.panel.openChat()) { e.preventDefault(); game.input = {}; releasePointer(); return; }
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.code)) e.preventDefault();
  game.input[e.code] = true;
  if (e.repeat) return;
  switch (e.code) {
    case 'Space':
      if (game.mode === 'play') player.jump();
      else skipIntro();
      break;
    case 'KeyE':
      if (game.mode === 'play') interact();
      else if (game.mode === 'scope') closeScope();
      break;
    case 'KeyH': if (game.mode === 'play') showHint(); break;
    case 'KeyJ':
      if (game.mode === 'play') openJournal();
      else if (game.mode === 'journal') closeJournal();
      break;
    case 'KeyM':
      if (game.mode === 'play') openMap();
      else if (game.mode === 'map') closeMap();
      break;
    case 'KeyQ':
      // Q: look through the survivor's eyes, or from behind again (remembered with the other settings)
      if (game.mode === 'play') {
        settings.firstPerson = !settings.firstPerson;
        saveSettings(settings);
        ui.toast(settings.firstPerson ? T('View: through the eyes · Q to switch back') : T('View: from behind · Q to switch'), '', 2);
      }
      break;
    case 'KeyF':
      if (game.mode === 'play') {
        if (!has('flashlight')) { ui.toast(T('I haven\'t found a flashlight yet. Maybe in the wreckage.'), 'warn'); break; }
        setFlashlight(!player.flashlightOn);
        audio.flashlight();
      }
      break;
    case 'Escape':
      if (legal.isOpen) { legal.close(); break; }
      if (net.panel && net.panel.isOpen) { net.panel.close(); break; }
      if (game.mode === 'journal') closeJournal();
      else if (game.mode === 'map') closeMap();
      else if (game.mode === 'paused') resume();
      else if (game.mode === 'scope') closeScope();
      else if (game.mode === 'play') pause();
      break;
  }
});
window.addEventListener('keyup', (e) => {
  if (e.target && /^(INPUT|TEXTAREA)$/.test(e.target.tagName) && e.target.type !== 'range' && e.target.type !== 'checkbox') return;
  game.input[e.code] = false;
});
window.addEventListener('blur', () => { game.input = {}; });

// F takes the flashlight out (in both hands, lit) or puts it away (plain walking, still in the inventory)
function setFlashlight(on) {
  player.setFlashlight(on);
  player.holdFlashlight(on && has('flashlight'));
  ui.setInventory(game.state, on);
}

function interact() {
  if (player.sitting) { player.standUp(); return; }
  const it = game.focused;
  if (!it) return;
  it.use();
  refreshHUD();
}

function onBoundary(type) {
  if (game.boundaryCooldown > 0 || !game.zone) return;
  game.boundaryCooldown = 4;
  const forest = game.zone.id === 'forest';
  const north = game.zone.boundaryText && game.zone.boundaryText(type, game.state);
  const msg = north || (forest ? {
    forest: game.state.flags.endingSeen
      ? T('Too dense here. The lights are to the north-east: the trail past the camp leads that way.')
      : T('The thicket to the north is too dense. The lights... are farther than they look.'),
    sea: T('The trail back to the beach is to the south, in the middle.'),
    side: T('The thicket is too dense to get through here.'),
    cliff: T('Too steep to climb. Maybe there is a way up somewhere else.'),
  }[type] : {
    forest: game.state.questIndex >= 6
      ? T('The thicket is too dense here. The north trail, behind the tail, leads into the forest.')
      : T('The jungle is too thick. First I should figure out what happened here.'),
    sea: T('The water is too deep. No point swimming without knowing where to.'),
    side: T('The rocks are too steep to climb.'),
    cliff: T('Too steep to climb here.'),
  }[type]);
  ui.thought(msg, 3);
}

// ------------------------------------------------------------------ main loop
const clock = new THREE.Clock();
function step(dt) {
  game.time += dt;
  game.modeTime += dt;
  if (!['paused', 'title', 'loading'].includes(game.mode)) seq.update(dt);
  for (const a of game.anims) {
    a.t += dt;
    a.fn(Math.min(1, a.t / a.dur));
    if (a.t >= a.dur) { a.finished = true; a.done && a.done(); }
  }
  game.anims = game.anims.filter((a) => !a.finished);
  if (game.mode === 'intro') { intro.update(dt); return; }
  const zone = game.zone;
  if (!zone || game.mode === 'transition') return;
  const m = game.mode;
  // first person only while the game's own camera follows the survivor; lobby, wake-up, cut-scenes and the
  // binoculars keep the body in view
  player.setFirstPerson(!!settings.firstPerson && !['title', 'wake', 'cine', 'scope'].includes(m));
  if (m === 'title') {
    updateOnline(dt); // keeps friends hidden behind the lobby
    if (!lobby.active) return;
    lobby.update(dt);
    env.update(dt, game.time, player.pos, camera);
    zone.update(dt, game.time, player.pos, camera);
    audio.updateListener(camera);
    audio.updateAmbience(game.time, 0.8, 0.3, 0, 0);
    return;
  }
  if (m === 'wake') {
    updateWake(dt);
  } else if (m === 'cine') {
    player.update(dt, {}, false);
    game.cineCam && game.cineCam(camera, game.time);
  } else if (m === 'scope') {
    player.update(dt, {}, false);
    updateScope(dt);
  } else {
    const active = m === 'play';
    if (game.lookTween) {
      const lt = game.lookTween;
      lt.t += dt;
      const k = Math.min(1, lt.t / lt.dur);
      player.camYaw = lt.from + (lt.to - lt.from) * k * k * (3 - 2 * k);
      if (k >= 1) game.lookTween = null;
    }
    player.update(dt, game.input, active);
    player.updateCamera(dt);
    if (active) updatePlay(dt);
  }
  // flashlight flicker (tension beats)
  if (game.flicker > 0) {
    game.flicker -= dt;
    player.flicker = game.flicker > 0 ? (Math.random() < 0.45 ? 0 : 0.35 + Math.random() * 0.75) : 1;
  }
  env.update(dt, game.time, player.pos, camera);
  zone.update(dt, game.time, player.pos, camera);
  audio.updateListener(camera);
  const amb = zone.ambience(player.pos);
  audio.setIndoor(amb.indoor || 0, amb.hum ?? 1);
  audio.updateAmbience(game.time, amb.sea, amb.forest, env.mode === 'night' ? 1 : 0, amb.stream);
  minimap.update(player.pos, player.camYaw, player.facing, game.state);
  updateOnline(dt);
}

// modes in which the frame rate is measured for the automatic quality (the world is on screen and moving)
const MEASURE_MODES = ['play', 'cine', 'scope', 'title', 'wake', 'intro'];
function loop() {
  requestAnimationFrame(loop);
  const raw = clock.getDelta();
  if (fpsEl) { renderer.info.autoReset = false; renderer.info.reset(); }
  step(Math.min(raw, 0.05));
  if (game.zone && game.mode !== 'intro') fogCull.update(raw, camera, env.scene.fog);
  renderFrame();
  if (settings.autoQuality !== false && !params.has('lowfx')) autoQ.sample(raw, MEASURE_MODES.includes(game.mode) && !document.hidden);
  if (fpsEl) fpsEl.textContent = `${Math.round(autoQ.fps)} fps · level ${autoQ.tier + 1}/${TIERS.length} · ${renderer.info.render.calls} draws`;
}
// ?fps shows the measured frame rate and the automatic quality level
const fpsEl = params.has('fps') ? Object.assign(document.body.appendChild(document.createElement('div')), { style: 'position:fixed;left:8px;bottom:8px;z-index:99;font:12px monospace;color:#fff;background:#0008;padding:3px 6px;pointer-events:none' }) : null;
function renderFrame() {
  if (game.mode === 'intro') post.render(intro.scene, intro.camera);
  else if (game.zone && game.mode !== 'transition') post.render(env.scene, camera);
}

function updatePlay(dt) {
  const zone = game.zone;
  game.boundaryCooldown -= dt;
  zone.tick && zone.tick(dt, game.time, player);
  if (game.mode !== 'play') return; // a zone trigger may have started a cinematic or transition

  // walking out of the zone (trail between beach and forest)
  for (const ex of zone.exits) {
    if (ex.when(game.state) && ex.test(player.pos.x, player.pos.z)) { enterZone(ex.to, ex.spawn); return; }
  }

  // nearest interactable
  let best = null, bd = 1e9;
  for (const it of player.busy ? [] : zone.interactables) {
    if (!it.available()) continue;
    const d = Math.hypot(it.x - player.pos.x, it.z - player.pos.z);
    if (d < it.radius && d < bd) { bd = d; best = it; }
  }
  game.focused = best;
  if (best) tip('interact');
  if (best) ui.setPrompt(best.label(), best.locked ? best.locked() : false);
  else if (player.sitting) ui.setPrompt(T('Stand up'));
  else ui.setPrompt(null);

  // item glints bob
  for (const it of zone.interactables) {
    if (!it.glint || !it.glint.visible) continue;
    const base = it.glintBase ?? (it.glintBase = it.glint.position.y - 0.6);
    it.glint.position.y = base + 0.6 + Math.sin(game.time * 2.4 + it.x) * 0.08;
    it.glint.material.opacity = 0.55 + Math.sin(game.time * 3.1 + it.z) * 0.35;
  }

  // no arrow or distance marker: the panel says what to investigate, the world shows where
  game.questTime = (game.questTime || 0) + dt;
  const cq = QUESTS[Math.min(game.state.questIndex, QUESTS.length - 1)];
  if (game.questTime > 75 && cq.hints && cq.hints.length) tip('hint');

  if (game.hintTimer > 0) { game.hintTimer -= dt; if (game.hintTimer <= 0) ui.hintControls(false); }
  if (game.time - game.lastSave > 8) persist();
}

// ------------------------------------------------------------------ debug hooks (only with ?debug)
if (DEBUG) {
  window.__lost = {
    game, renderer, settings, ui, seq, camera, net,
    get player() { return player; },
    get zone() { return game.zone; },
    get env() { return env; },
    get intro() { return intro; },
    get lobby() { return lobby; },
    teleport(x, z) { player.setPosition(x, z, player.facing); },
    interact,
    enterZone,
    step(seconds, dt = 0.05) { for (let t = 0; t < seconds; t += dt) step(dt); },
    near(id) {
      const it = game.zone.interactables.find((i) => i.id === id);
      return it ? { x: it.x, z: it.z, available: it.available() } : null;
    },
    keypad(code) { for (const k of code) ui.keypadPress(k); },
    get scope() { return game.scope; },
    showHint,
    renderFrame,
    post,
    GFXdetail: GFX.detail,
    autoQ,
    fogCull,
    applyQuality,
  };
}

boot();
