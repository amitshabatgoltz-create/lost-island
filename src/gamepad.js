// Xbox (and any "standard" layout) controller support through the browser Gamepad API.
//
// In play:   left stick move · right stick camera · A jump · X use · Y flashlight · B view (eyes / behind)
//            RT (or click the left stick) run · RB / d-pad up booklet · View / d-pad down map · LB hint · Menu pause
// In menus:  d-pad / left stick move the highlight · A select · B back · right stick scrolls · LB / RB booklet tabs
//
// Buttons are turned into the same keyboard events the game already listens to (Space, E, F, Q, J, M, H, Escape,
// arrows, Enter), so every screen keeps one set of rules. The sticks are analog: they write padX / padY (move) into
// the game's input object and turn the camera directly.
//
// While the controller is the last thing used, <body> gets the class "pad": the on-screen key hints switch to
// controller buttons (see style.css) and the "click the screen" hint is hidden.

const B = { A: 0, B: 1, X: 2, Y: 3, LB: 4, RB: 5, LT: 6, RT: 7, VIEW: 8, MENU: 9, LS: 10, RS: 11, UP: 12, DOWN: 13, LEFT: 14, RIGHT: 15 };
const DEAD = 0.22;
const LOOK_SPEED = 1100; // "mouse pixels" per second at full tilt
const REPEAT_FIRST = 0.38, REPEAT_NEXT = 0.12;

// modes where the survivor is moved (no menu on screen)
const WORLD_MODES = ['play', 'intro', 'cine', 'wake', 'transition', 'reveal', 'scope', 'loading'];
const FOCUSABLE = 'button, input, select, a[href], [role="option"]';
// "back" buttons, tried in order before falling back to Escape
const BACK_BUTTONS = ['#confirm-no', '#btn-settings-back', '#sel-back'];

function stick(x, y) {
  const m = Math.hypot(x, y);
  if (m < DEAD) return { x: 0, y: 0, m: 0 };
  const k = Math.min(1, (m - DEAD) / (1 - DEAD)) / m;
  return { x: x * k, y: y * k, m: Math.min(1, m * k) };
}

export class GamepadInput {
  /**
   * hooks: {
   *   mode(): string, input(): object (game.input), modal(): bool (a dialog over the game),
   *   arrowsOwner(): false | 'lr' | 'all' (the screen uses the arrow keys itself: character select, dial puzzle),
   *   look(dx, dy), releasePointer(), onActive(bool)
   * }
   */
  constructor(hooks) {
    this.h = hooks;
    this.prev = [];
    this.active = false;
    this.connected = false;
    this.runLatch = false;
    this.focus = null;
    this.rep = {}; // direction -> seconds until it repeats
    this.scanT = 0;
    window.addEventListener('gamepadconnected', () => { this.connected = true; });
    window.addEventListener('gamepaddisconnected', () => {
      this.connected = !!this.pad();
      if (!this.connected) this.setActive(false);
    });
    // the mouse or the keyboard take over again
    window.addEventListener('mousemove', (e) => { if (this.active && Math.abs(e.movementX) + Math.abs(e.movementY) > 6) this.setActive(false); });
    window.addEventListener('mousedown', () => this.setActive(false));
    window.addEventListener('keydown', (e) => { if (e.isTrusted) this.setActive(false); }, true);
  }

  pad() {
    const list = navigator.getGamepads ? navigator.getGamepads() : [];
    let best = null;
    for (const p of list) if (p && p.connected && (!best || p.timestamp > best.timestamp)) best = p;
    return best;
  }

  setActive(on) {
    if (this.active === on) return;
    this.active = on;
    document.body.classList.toggle('pad', on);
    if (on) this.h.releasePointer(); // the controller turns the camera: no locked mouse in the way
    else this.clearFocus();
    this.h.onActive && this.h.onActive(on);
  }

  // ------------------------------------------------------------ keyboard events
  key(code, type = 'keydown') {
    const keyName = { Space: ' ', Escape: 'Escape', Enter: 'Enter', ArrowLeft: 'ArrowLeft', ArrowRight: 'ArrowRight', ArrowUp: 'ArrowUp', ArrowDown: 'ArrowDown' }[code]
      || code.replace(/^Key/, '').toLowerCase();
    // sent from <body> like a real key press, so the dialogs' capture listeners on window can stop it
    const ev = new KeyboardEvent(type, { code, key: keyName, bubbles: true, cancelable: true });
    document.body.dispatchEvent(ev);
  }
  tap(code) { this.key(code, 'keydown'); this.key(code, 'keyup'); }

  // ------------------------------------------------------------ main update, once per frame
  update(dt) {
    const p = this.pad();
    const input = this.h.input();
    if (!p) {
      if (input.padX || input.padY) { input.padX = 0; input.padY = 0; input.padRun = false; }
      return;
    }
    this.connected = true;
    const btn = (i) => !!(p.buttons[i] && (p.buttons[i].pressed || p.buttons[i].value > 0.5));
    const now = p.buttons.map((b, i) => btn(i));
    const down = (i) => now[i] && !this.prev[i];
    const ax = p.axes || [];
    const L = stick(ax[0] || 0, ax[1] || 0), R = stick(ax[2] || 0, ax[3] || 0);
    if (now.some(Boolean) || L.m > 0.3 || R.m > 0.3) this.setActive(true);
    if (!this.active) { this.prev = now; return; }

    const mode = this.h.mode();
    const world = WORLD_MODES.includes(mode) && !this.h.modal();
    document.body.classList.toggle('pad-ui', !world);

    if (world) {
      this.clearFocus();
      this.updateWorld(mode, input, L, R, now, down, dt);
    } else {
      input.padX = 0; input.padY = 0; input.padRun = false;
      this.updateMenu(mode, L, R, now, down, dt);
    }
    this.prev = now;
  }

  updateWorld(mode, input, L, R, now, down, dt) {
    // analog movement: right = +x, forward = +y
    input.padX = L.x;
    input.padY = -L.y;
    if (L.m === 0) this.runLatch = false;
    if (down(B.LS)) this.runLatch = !this.runLatch;
    input.padRun = now[B.RT] || now[B.LT] || this.runLatch;
    input.padLookX = R.x;
    input.padLookY = R.y;
    if (mode === 'play' && (R.x || R.y)) {
      // a little curve: small tilts aim precisely, full tilt turns fast
      const cx = R.x * Math.abs(R.x) * 0.6 + R.x * 0.4, cy = R.y * Math.abs(R.y) * 0.6 + R.y * 0.4;
      this.h.look(cx * LOOK_SPEED * dt, cy * LOOK_SPEED * dt * 0.75);
    }

    if (mode === 'intro') {
      if (down(B.A) || down(B.MENU)) this.tap('Space');
      return;
    }
    if (mode === 'scope') {
      if (down(B.X) || down(B.A)) this.tap('KeyE');
      if (down(B.B) || down(B.MENU)) this.tap('Escape');
      return;
    }
    if (mode !== 'play') return;
    const map = [
      [B.A, 'Space'], [B.X, 'KeyE'], [B.Y, 'KeyF'], [B.B, 'KeyQ'], [B.RS, 'KeyQ'],
      [B.RB, 'KeyJ'], [B.UP, 'KeyJ'], [B.VIEW, 'KeyM'], [B.DOWN, 'KeyM'], [B.LB, 'KeyH'], [B.MENU, 'Escape'],
    ];
    for (const [i, code] of map) {
      if (down(i)) this.key(code, 'keydown');
      else if (!now[i] && this.prev[i]) this.key(code, 'keyup');
    }
  }

  // ------------------------------------------------------------ menus
  updateMenu(mode, L, R, now, down, dt) {
    const arrows = this.h.arrowsOwner();
    // directions from the d-pad and the left stick, with key-repeat
    const dirs = {
      up: now[B.UP] || L.y < -0.55, down: now[B.DOWN] || L.y > 0.55,
      left: now[B.LEFT] || L.x < -0.55, right: now[B.RIGHT] || L.x > 0.55,
    };
    const dpadOnly = { up: now[B.UP], down: now[B.DOWN], left: now[B.LEFT], right: now[B.RIGHT] };
    for (const d of Object.keys(dirs)) {
      if (!dirs[d]) { delete this.rep[d]; continue; }
      if (this.rep[d] === undefined) { this.rep[d] = REPEAT_FIRST; this.dir(d, arrows && dpadOnly[d], arrows); continue; }
      this.rep[d] -= dt;
      if (this.rep[d] <= 0) { this.rep[d] = REPEAT_NEXT; this.dir(d, arrows && dpadOnly[d], arrows); }
    }

    // keep a highlight on screen whenever a menu is open
    this.scanT -= dt;
    if (this.scanT <= 0) {
      this.scanT = 0.25;
      if (!this.focus || !this.visible(this.focus)) this.setFocus(this.defaultFocus(arrows));
    }

    if (R.y) this.scroll(R.y * 900 * dt);

    if (down(B.A)) this.activate(arrows);
    if (down(B.B)) this.back();
    if (down(B.MENU)) {
      if (mode === 'paused' || mode === 'map' || mode === 'journal') this.tap('Escape');
      else this.activate(arrows);
    }
    if (down(B.VIEW) && mode === 'map') this.tap('KeyM');
    if (mode === 'journal') {
      if (down(B.RB)) this.journalTab(1);
      if (down(B.LB)) this.journalTab(-1);
    } else if (arrows) {
      // character select: the bumpers flip through the survivors too
      if (down(B.RB)) this.tap(document.dir === 'rtl' ? 'ArrowLeft' : 'ArrowRight');
      if (down(B.LB)) this.tap(document.dir === 'rtl' ? 'ArrowRight' : 'ArrowLeft');
    }
  }

  dir(d, asArrow, arrows) {
    const el = this.focus;
    // sliders and lists change their value with left / right
    if (el && (d === 'left' || d === 'right') && this.adjust(el, d === 'right' ? 1 : -1)) return;
    // 'lr': the screen only uses left / right (character select), up / down still move the highlight
    if (asArrow && (arrows !== 'lr' || d === 'left' || d === 'right')) { this.tap({ up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight' }[d]); return; }
    this.move(d, arrows);
  }

  adjust(el, s) {
    if (el.tagName === 'INPUT' && el.type === 'range') {
      if (document.dir === 'rtl') s = -s;
      const step = +el.step || 0.05, min = +el.min, max = +el.max;
      el.value = Math.max(min, Math.min(max, +el.value + s * step * 2));
      el.dispatchEvent(new Event('input', { bubbles: true }));
      return true;
    }
    if (el.tagName === 'SELECT') {
      const n = el.options.length;
      el.selectedIndex = (el.selectedIndex + s + n) % n;
      el.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    }
    return false;
  }

  activate(arrows) {
    const el = this.focus;
    if (!el || !this.visible(el)) {
      if (arrows) this.tap('Enter');
      else this.setFocus(this.defaultFocus(arrows));
      return;
    }
    if (el.tagName === 'SELECT') { this.adjust(el, 1); return; }
    if (el.tagName === 'INPUT' && el.type === 'range') return;
    if (el.tagName === 'INPUT' && el.type !== 'checkbox' && el.type !== 'radio') { el.focus(); return; }
    el.click();
    // the screen may have changed under the highlight
    this.scanT = 0.05;
  }

  back() {
    for (const sel of BACK_BUTTONS) {
      const el = document.querySelector(sel);
      if (el && this.visible(el)) { el.click(); return; }
    }
    this.tap('Escape');
  }

  journalTab(s) {
    const tabs = [...document.querySelectorAll('#journal .book-tabs .tab')].filter((t) => this.visible(t));
    if (!tabs.length) return;
    const i = tabs.findIndex((t) => t.classList.contains('active'));
    const dirS = document.dir === 'rtl' ? -s : s;
    tabs[(i + dirS + tabs.length) % tabs.length].click();
  }

  scroll(dy) {
    let el = this.focus;
    const sc = (n) => n && n !== document.body && n.scrollHeight > n.clientHeight + 4 && /(auto|scroll)/.test(getComputedStyle(n).overflowY);
    while (el && !sc(el)) el = el.parentElement;
    if (!el) {
      // the scrolling panel under the middle of the screen (journal page, document)
      let n = document.elementFromPoint(innerWidth / 2, innerHeight / 2);
      while (n && !sc(n)) n = n.parentElement;
      el = n;
    }
    if (el) el.scrollTop += dy;
  }

  // ------------------------------------------------------------ highlight
  visible(el) {
    if (!el || !el.isConnected || el.disabled) return false;
    const r = el.getBoundingClientRect();
    if (r.width < 4 || r.height < 4) return false;
    const cx = Math.min(innerWidth - 1, Math.max(0, r.left + r.width / 2)), cy = Math.min(innerHeight - 1, Math.max(0, r.top + r.height / 2));
    if (r.bottom < 0 || r.top > innerHeight || r.right < 0 || r.left > innerWidth) {
      // inside a scrolling panel: counts if the panel itself is on screen
      return false;
    }
    const top = document.elementFromPoint(cx, cy);
    if (!top) return false;
    return top === el || el.contains(top) || (top.tagName === 'LABEL' && top.contains(el));
  }

  candidates() {
    return [...document.querySelectorAll(FOCUSABLE)].filter((el) => !el.closest('#hud') && this.visible(el));
  }

  defaultFocus(arrows) {
    const c = this.candidates();
    if (!c.length) return null;
    if (arrows) return c.find((e) => e.id === 'sel-confirm') || null;
    return c.find((e) => e.matches('.btn.play, .btn.primary, #btn-keep, #confirm-yes')) || c.find((e) => e.matches('.btn')) || c[0];
  }

  setFocus(el) {
    if (this.focus === el) return;
    if (this.focus) this.focus.classList.remove('pad-focus');
    this.focus = el;
    if (!el) return;
    el.classList.add('pad-focus');
    try { el.focus({ preventScroll: true }); } catch (e) { /* not focusable: the class still shows it */ }
    el.scrollIntoView && el.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }

  clearFocus() {
    if (this.focus) this.focus.classList.remove('pad-focus');
    if (this.focus && document.activeElement === this.focus) this.focus.blur();
    this.focus = null;
  }

  move(d) {
    const c = this.candidates();
    if (!c.length) return;
    const cur = this.focus && this.visible(this.focus) ? this.focus : null;
    if (!cur) { this.setFocus(this.defaultFocus(false)); return; }
    const a = cur.getBoundingClientRect();
    const ax = a.left + a.width / 2, ay = a.top + a.height / 2;
    const v = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }[d];
    let best = null, bs = Infinity;
    for (const el of c) {
      if (el === cur) continue;
      const r = el.getBoundingClientRect();
      // nearest edge distance along the direction, so wide buttons next to small ones still line up
      const bx = Math.max(r.left, Math.min(ax, r.right)), by = Math.max(r.top, Math.min(ay, r.bottom));
      const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      const along = (cx - ax) * v[0] + (cy - ay) * v[1];
      if (along <= 2) continue;
      const perp = Math.abs((bx - ax) * v[1]) + Math.abs((by - ay) * v[0]);
      const s = along + perp * 2.2;
      if (s < bs) { bs = s; best = el; }
    }
    if (best) this.setFocus(best);
  }
}
