// Main lobby and character selection. Both are drawn over the real beach zone: the player character
// (the actual in-game Player, wearing the chosen skin) stands on the sand while the camera drifts.
// main.js owns the game flow; this module owns the lobby camera, the selection screen and the skin choice.
import * as THREE from 'three';
import { SKINS, DEFAULT_SKIN, skinById } from './data/skins.js';
import { saveSettings } from './save.js';

const $ = (id) => document.getElementById(id);
const ease = (k) => k * k * (3 - 2 * k);
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const wrapScrolls = () => { const el = $('sel-cards'); return el.scrollWidth > el.clientWidth + 1; };

export class Lobby {
  // hooks: { onPlay(), onNew(), click(), deny() }
  constructor({ player, camera, settings, ui, hooks }) {
    this.player = player;
    this.camera = camera;
    this.settings = settings;
    this.ui = ui;
    this.hooks = hooks;
    this.active = false;
    this.view = 'lobby'; // lobby | select
    this.k = 0; // 0 = lobby framing, 1 = selection framing
    this.t = 0;
    this.sel = 0;
    this.first = false;
    this.spin = 0; // turntable yaw while choosing (drag to rotate)
    this.spinVel = 0;
    this.loadToken = 0;
    this.spot = null;
    this.look = new THREE.Vector3();
    this.buildCards();
    this.bind();
  }

  get chosenId() { return skinById(this.settings.skin || DEFAULT_SKIN).id; }
  // first launch: nobody has picked a character yet
  get needsChoice() { return !this.settings.skin; }

  buildCards() {
    const wrapEl = $('sel-cards');
    wrapEl.innerHTML = '';
    SKINS.forEach((s, i) => {
      const b = document.createElement('button');
      b.className = 'sel-card';
      b.setAttribute('role', 'option');
      b.dataset.i = i;
      b.innerHTML = `<img src="./models/skins/portraits/${s.id}.webp" alt="" loading="lazy" draggable="false" /><span class="card-name">${s.name}</span><span class="card-load" aria-hidden="true"></span>`;
      b.addEventListener('click', () => this.choose(i));
      wrapEl.appendChild(b);
    });
  }

  bind() {
    $('sel-prev').addEventListener('click', () => this.choose(this.sel - 1));
    $('sel-next').addEventListener('click', () => this.choose(this.sel + 1));
    $('sel-confirm').addEventListener('click', () => this.confirm());
    $('sel-back').addEventListener('click', () => this.cancel());
    $('btn-skin').addEventListener('click', () => { this.hooks.click(); this.openSelect(false); });
    window.addEventListener('keydown', (e) => {
      if (!this.active || this.view !== 'select' || e.repeat) return;
      // left arrow goes back, right arrow goes forward
      if (e.code === 'ArrowLeft') this.choose(this.sel - 1);
      else if (e.code === 'ArrowRight') this.choose(this.sel + 1);
      else if (e.code === 'Enter') this.confirm();
      else if (e.code === 'Escape' && !this.first) this.cancel();
    });
    // drag on the 3D view to turn the character around
    let drag = null;
    window.addEventListener('pointerdown', (e) => {
      if (!this.active || this.view !== 'select' || e.target.closest('button')) return;
      drag = { x: e.clientX };
    });
    window.addEventListener('pointermove', (e) => {
      if (!drag) return;
      const dx = e.clientX - drag.x;
      drag.x = e.clientX;
      this.spin += dx * 0.012;
      this.spinVel = dx * 0.012 * 60;
    });
    window.addEventListener('pointerup', () => { drag = null; });
    this.dragging = () => !!drag;
  }

  // the lobby lives on the beach zone; spot = { x, z, yaw, cam: {...} }
  enter(zone) {
    this.active = true;
    this.spot = zone.lobby;
    this.t = 0;
    const p = this.player;
    p.setPosition(this.spot.x, this.spot.z, this.spot.yaw);
    p.lying = 0;
    p.speed = 0;
    p.setFlashlight(false);
    p.showBandage(false);
    p.holdFlashlight(false);
    p.model.root.visible = true;
    // item sparkles are gameplay hints, not scenery; zone.sync() brings them back when play starts
    for (const it of zone.interactables || []) if (it.glint) it.glint.visible = false;
    if (this.needsChoice) this.openSelect(true);
    else this.showLobby(true);
  }

  leave() {
    this.active = false;
    this.camera.fov = 60; // gameplay field of view
    this.camera.updateProjectionMatrix();
    this.ui.show('title', false);
    this.ui.show('select', false);
  }

  showLobby(instant = false) {
    this.view = 'lobby';
    if (instant) this.k = 0;
    this.spin = 0;
    const s = skinById(this.chosenId);
    $('lobby-name').textContent = s.name;
    $('lobby-role').textContent = s.role;
    this.ui.show('select', false);
    this.ui.show('title', true);
    $('btn-play').focus({ preventScroll: true });
  }

  openSelect(first) {
    this.first = first;
    this.view = 'select';
    this.spin = 0;
    this.spinVel = 0;
    $('select-kicker').textContent = first ? 'Before takeoff' : 'Change character';
    this.ui.show('sel-back', !first);
    this.ui.show('title', false);
    this.ui.show('select', true);
    this.choose(SKINS.findIndex((s) => s.id === this.chosenId), true);
  }

  choose(i, silent = false) {
    const n = SKINS.length;
    this.sel = ((i % n) + n) % n;
    const s = SKINS[this.sel];
    if (!silent) this.hooks.click();
    $('sel-count').textContent = `${this.sel + 1} / ${n}`;
    $('sel-name').textContent = s.name;
    $('sel-role').textContent = s.role;
    $('sel-desc').textContent = s.desc;
    this.ui.show('sel-current', !this.first && s.id === this.chosenId);
    document.querySelectorAll('.sel-card').forEach((c, j) => {
      c.classList.toggle('selected', j === this.sel);
      c.setAttribute('aria-selected', j === this.sel ? 'true' : 'false');
    });
    const card = document.querySelector(`.sel-card[data-i="${this.sel}"]`);
    if (card && wrapScrolls()) card.scrollIntoView({ block: 'nearest', inline: 'center', behavior: silent ? 'auto' : 'smooth' });
    this.wear(s.id, card);
    // warm up the neighbours so browsing feels instant
    for (const d of [1, -1]) this.player.loadSkin(SKINS[(this.sel + d + n) % n].id).catch(() => {});
  }

  // put a skin on the lobby character; the latest request wins if several are loading
  async wear(id, card) {
    const token = ++this.loadToken;
    card && card.classList.add('loading');
    $('sel-confirm').disabled = true;
    try {
      await this.player.loadSkin(id);
      if (token !== this.loadToken) return;
      await this.player.setSkin(id);
      this.player.showBandage(false);
    } catch (err) {
      console.error(err);
      if (token === this.loadToken) this.ui.toast('Could not load the character. Try again.', 'warn', 3);
    } finally {
      card && card.classList.remove('loading');
      if (token === this.loadToken) $('sel-confirm').disabled = false;
    }
  }

  confirm() {
    if (this.view !== 'select' || $('sel-confirm').disabled) return;
    const s = SKINS[this.sel];
    if (this.player.skinId !== s.id) return; // still loading
    this.settings.skin = s.id;
    saveSettings(this.settings);
    this.hooks.click();
    this.showLobby();
  }

  cancel() {
    if (this.first) return;
    this.hooks.click();
    this.choose(SKINS.findIndex((s) => s.id === this.chosenId), true);
    this.showLobby();
  }

  update(dt) {
    this.t += dt;
    const p = this.player;
    const sp = this.spot;
    this.k += ((this.view === 'select' ? 1 : 0) - this.k) * Math.min(1, dt * 2.6);
    const k = ease(Math.min(1, Math.max(0, this.k)));

    // turntable while choosing: drag to spin, then it eases back to face the camera
    if (this.view === 'select' && !this.dragging()) {
      this.spinVel *= Math.max(0, 1 - dt * 4);
      this.spin += this.spinVel * dt;
      if (Math.abs(this.spinVel) < 0.3) this.spin += wrap(0 - this.spin) * Math.min(1, dt * 1.2);
    } else if (this.view !== 'select') this.spin += wrap(0 - this.spin) * Math.min(1, dt * 3);
    p.facing = sp.yaw + this.spin;
    p.update(dt, {}, false);

    // camera: a slow cinematic drift in the lobby, a close portrait framing while choosing
    const c = sp.cam;
    const fwd = new THREE.Vector3(Math.sin(sp.yaw), 0, Math.cos(sp.yaw));
    const right = new THREE.Vector3(fwd.z, 0, -fwd.x);
    const base = new THREE.Vector3(sp.x, p.pos.y, sp.z);
    const drift = Math.sin(this.t * 0.09);
    const lobbyPos = base.clone().addScaledVector(fwd, c.dist + Math.sin(this.t * 0.06) * 0.4).addScaledVector(right, c.side + drift * 0.9);
    lobbyPos.y += c.height + Math.sin(this.t * 0.13) * 0.12;
    const lobbyLook = base.clone().addScaledVector(right, c.lookSide).add(new THREE.Vector3(0, c.lookY, 0));
    const aspect = this.camera.aspect;
    // narrow screens: step back and centre the character so it is not cut off
    const narrow = Math.min(1, Math.max(0, (1.3 - aspect) / 0.7));
    lobbyPos.addScaledVector(fwd, narrow * 1.6);
    lobbyLook.addScaledVector(right, -c.lookSide * narrow);
    // portrait framing with a longer lens: full height at a third of the width (the panel takes the right side);
    // on narrow screens the character is centred above the bottom panel
    const selPos = base.clone().addScaledVector(fwd, 3.5 + narrow * 2.2);
    selPos.y += 1.2 + Math.sin(this.t * 0.2) * 0.04;
    const selLook = base.clone().addScaledVector(right, 0.62 * (1 - narrow)).add(new THREE.Vector3(0, 0.9 - narrow * 0.55, 0));
    this.camera.position.lerpVectors(lobbyPos, selPos, k);
    this.look.lerpVectors(lobbyLook, selLook, k);
    this.camera.lookAt(this.look);
    const fov = 50 + (36 - 50) * k;
    if (Math.abs(this.camera.fov - fov) > 0.01) { this.camera.fov = fov; this.camera.updateProjectionMatrix(); }
  }
}
