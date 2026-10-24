// HUD minimap (top-right corner). Drawn from the real zone data: the zone's own height function, play bounds,
// colliders (trees, rocks, wreckage, buildings), trails and story landmarks. Nothing on it is invented.
//
// Any zone works without extra code: the map is baked from zone.heightAt, zone.bounds and zone.colliders.
// A zone can add an optional `minimap` description for nicer colours and labelled places:
//   minimap: {
//     margin: 30,                                    // metres of scenery shown around the play bounds
//     view: 42,                                      // metres from the centre to the rim (zoom)
//     title: 'THE BEACH',                            // heading of the big map (M)
//     ground(x, z, h, slope) => [r, g, b] (0..255)   // ground colour (sand, grass, water...)
//     paths: [[[x, z], ...], ...],                   // trails drawn on top
//     landmarks: [{ x, z, label, kind, far, found(state) }], // shown once found(state) is true
//   }
// The baked picture is cached per zone id, so walking back and forth between zones costs nothing.
import { T } from '../i18n/index.js';

const PX = 3; // baked picture: pixels per metre
const VIEW = 42; // metres from the centre of the minimap to its rim (a zone can set its own `view`)

const KIND_COLOR = { place: '#f2d49b', camp: '#9fe0a8', danger: '#ff6b5a', far: '#d7e2ec' };

export class Minimap {
  constructor(parent) {
    const wrap = document.createElement('div');
    wrap.id = 'minimap';
    wrap.setAttribute('aria-hidden', 'true');
    this.canvas = document.createElement('canvas');
    wrap.appendChild(this.canvas);
    parent.appendChild(wrap);
    this.el = wrap;
    this.ctx = this.canvas.getContext('2d');
    this.cache = new Map();
    this.zone = null;
    this.base = null;
    this.size = 0;
  }

  // called when a zone finishes loading
  setZone(zone) {
    this.zone = zone;
    if (!this.cache.has(zone.id)) this.cache.set(zone.id, bake(zone));
    this.base = this.cache.get(zone.id);
  }

  // `yaw` is the camera yaw (the map turns so the camera looks up), `facing` the body direction
  update(pos, camYaw, facing, state) {
    if (!this.base) return;
    const css = this.el.clientWidth;
    if (!css) return; // HUD hidden
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const size = Math.round(css * dpr);
    if (size !== this.size) { this.canvas.width = this.canvas.height = size; this.size = size; }
    const c = this.ctx, R = size / 2, k = (R - 3 * dpr) / this.base.view; // pixels per metre on screen
    const b = this.base;
    const cs = Math.cos(camYaw), sn = Math.sin(camYaw);
    // world offset (metres from the player) -> minimap pixel
    const toMap = (dx, dz) => [R + (dx * cs - dz * sn) * k, R + (dx * sn + dz * cs) * k];

    c.setTransform(1, 0, 0, 1, 0, 0);
    c.clearRect(0, 0, size, size);
    c.save();
    c.beginPath(); c.arc(R, R, R - 1.5 * dpr, 0, Math.PI * 2); c.clip();
    c.fillStyle = '#1b2a33';
    c.fillRect(0, 0, size, size);
    // terrain, turned with the camera
    c.save();
    c.translate(R, R);
    c.rotate(camYaw);
    c.scale(k, k);
    c.imageSmoothingEnabled = true;
    c.drawImage(b.canvas, b.minX - pos.x, b.minZ - pos.z, b.w, b.h);
    c.restore();

    // camera view cone
    const cone = 0.6;
    c.fillStyle = 'rgba(255, 255, 255, 0.10)';
    c.beginPath(); c.moveTo(R, R);
    c.arc(R, R, R, -Math.PI / 2 - cone, -Math.PI / 2 + cone);
    c.closePath(); c.fill();

    // landmarks the player already knows about
    const font = Math.round(9.5 * dpr);
    c.font = `700 ${font}px system-ui, sans-serif`;
    c.textAlign = 'center';
    c.textBaseline = 'bottom';
    for (const m of b.landmarks) {
      if (m.found && !m.found(state)) continue;
      const dx = m.x - pos.x, dz = m.z - pos.z;
      const dist = Math.hypot(dx, dz);
      let [x, y] = toMap(dx, dz);
      const col = KIND_COLOR[m.kind] || KIND_COLOR.place;
      if (dist * k > R - 10 * dpr) {
        // outside the view: a small pip on the rim, pointing the way
        const a = Math.atan2(y - R, x - R), rr = R - 7 * dpr;
        x = R + Math.cos(a) * rr; y = R + Math.sin(a) * rr;
        c.fillStyle = col;
        c.strokeStyle = 'rgba(0, 0, 0, 0.7)';
        c.lineWidth = 1.5 * dpr;
        c.beginPath(); c.arc(x, y, 2.8 * dpr, 0, Math.PI * 2); c.fill(); c.stroke();
        continue;
      }
      c.fillStyle = col;
      c.strokeStyle = 'rgba(0, 0, 0, 0.75)';
      c.lineWidth = 1.5 * dpr;
      c.beginPath(); c.rect(x - 3.2 * dpr, y - 3.2 * dpr, 6.4 * dpr, 6.4 * dpr); c.fill(); c.stroke();
      if (m.label) {
        c.lineWidth = 3 * dpr;
        c.strokeText(m.label, x, y - 4.5 * dpr);
        c.fillText(m.label, x, y - 4.5 * dpr);
      }
    }
    c.restore();

    // rim + north marker
    c.strokeStyle = 'rgba(214, 228, 240, 0.55)';
    c.lineWidth = 1.5 * dpr;
    c.beginPath(); c.arc(R, R, R - 1.5 * dpr, 0, Math.PI * 2); c.stroke();
    const [nx, ny] = toMap(0, -1);
    const na = Math.atan2(ny - R, nx - R), nr = R - 9 * dpr;
    const px = R + Math.cos(na) * nr, py = R + Math.sin(na) * nr;
    c.fillStyle = 'rgba(10, 16, 22, 0.8)';
    c.beginPath(); c.arc(px, py, 7 * dpr, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#ffb4a8';
    c.textBaseline = 'middle';
    c.fillText('N', px, py + 0.5 * dpr);

    // the player: arrow at the centre pointing where the body faces
    const [fx, fy] = toMap(Math.sin(facing), Math.cos(facing));
    const ang = Math.atan2(fx - R, -(fy - R));
    c.save();
    c.translate(R, R);
    c.rotate(ang);
    const s = 7.5 * dpr;
    c.beginPath();
    c.moveTo(0, -s * 1.15); c.lineTo(s * 0.8, s * 0.85); c.lineTo(0, s * 0.4); c.lineTo(-s * 0.8, s * 0.85); c.closePath();
    c.fillStyle = '#ffffff';
    c.strokeStyle = 'rgba(0, 0, 0, 0.8)';
    c.lineWidth = 2 * dpr;
    c.stroke(); c.fill();
    c.restore();
  }
}

// ------------------------------------------------------------------ the big map (M): the whole zone, north up
export class BigMap {
  constructor(minimap) {
    this.minimap = minimap;
    const el = document.createElement('div');
    el.id = 'bigmap';
    el.className = 'screen hidden';
    el.innerHTML = '<div class="bigmap-frame"><div class="bigmap-title"></div><canvas></canvas>'
      + T('<div class="bigmap-foot"><span><kbd>M</kbd> / <kbd>Esc</kbd> close</span><span class="bigmap-scale"></span></div></div>');
    document.body.appendChild(el);
    this.el = el;
    this.canvas = el.querySelector('canvas');
    this.open = false;
  }

  show(on, pos, facing, state) {
    this.open = on;
    this.el.classList.toggle('hidden', !on);
    if (on) this.draw(pos, facing, state);
  }

  draw(pos, facing, state) {
    const b = this.minimap.base, zone = this.minimap.zone;
    if (!b) return;
    this.args = [pos, facing, state];
    this.el.querySelector('.bigmap-title').textContent = (zone.minimap && zone.minimap.title) || zone.id.toUpperCase();
    // fit the whole picture into the screen, keeping its shape
    const maxW = Math.min(innerWidth * 0.92, 1100), maxH = innerHeight * 0.78;
    const k = Math.min(maxW / b.w, maxH / b.h); // css pixels per metre
    const cw = Math.round(b.w * k), ch = Math.round(b.h * k);
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const cv = this.canvas;
    cv.style.width = cw + 'px'; cv.style.height = ch + 'px';
    cv.width = Math.round(cw * dpr); cv.height = Math.round(ch * dpr);
    const c = cv.getContext('2d');
    const s = k * dpr;
    const toPx = (x, z) => [(x - b.minX) * s, (z - b.minZ) * s];
    c.imageSmoothingEnabled = true;
    c.drawImage(b.canvas, 0, 0, cv.width, cv.height);

    // known places
    c.font = `700 ${Math.round(12 * dpr)}px system-ui, sans-serif`;
    c.textAlign = 'center';
    c.textBaseline = 'bottom';
    for (const m of b.landmarks) {
      if (m.found && !m.found(state)) continue;
      let [x, y] = toPx(m.x, m.z);
      const outside = x < 0 || y < 0 || x > cv.width || y > cv.height;
      const pad = 14 * dpr;
      x = Math.max(pad, Math.min(cv.width - pad, x));
      y = Math.max(pad * 1.6, Math.min(cv.height - pad * 0.5, y));
      c.fillStyle = KIND_COLOR[m.kind] || KIND_COLOR.place;
      c.strokeStyle = 'rgba(0, 0, 0, 0.8)';
      c.lineWidth = 2 * dpr;
      const r = 5 * dpr;
      c.beginPath();
      if (outside) c.arc(x, y, r * 0.8, 0, Math.PI * 2); else c.rect(x - r, y - r, r * 2, r * 2);
      c.fill(); c.stroke();
      if (m.label) {
        const t = outside ? m.label + ' ›' : m.label;
        c.lineWidth = 4 * dpr;
        c.strokeText(t, x, y - r - 2 * dpr);
        c.fillText(t, x, y - r - 2 * dpr);
      }
    }

    // the player
    const [px, py] = toPx(pos.x, pos.z);
    c.save();
    c.translate(px, py);
    c.rotate(Math.atan2(Math.sin(facing), -Math.cos(facing)));
    const a = 10 * dpr;
    c.beginPath();
    c.moveTo(0, -a * 1.15); c.lineTo(a * 0.8, a * 0.85); c.lineTo(0, a * 0.4); c.lineTo(-a * 0.8, a * 0.85); c.closePath();
    c.fillStyle = '#ffffff';
    c.strokeStyle = 'rgba(0, 0, 0, 0.85)';
    c.lineWidth = 2.5 * dpr;
    c.stroke(); c.fill();
    c.restore();
    c.strokeStyle = 'rgba(255, 255, 255, 0.7)';
    c.lineWidth = 1.5 * dpr;
    c.beginPath(); c.arc(px, py, 16 * dpr, 0, Math.PI * 2); c.stroke();

    // north marker (north is always up here)
    const nx = cv.width - 22 * dpr, ny = 26 * dpr;
    c.fillStyle = 'rgba(10, 16, 22, 0.8)';
    c.beginPath(); c.arc(nx, ny, 13 * dpr, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#ffb4a8';
    c.textBaseline = 'middle';
    c.fillText('N', nx, ny + 1 * dpr);

    // scale bar: a round number of metres about 80 px long
    const metres = [5, 10, 20, 25, 50, 100].find((m) => m * k >= 70) || 100;
    this.el.querySelector('.bigmap-scale').innerHTML = T`<i style="width:${Math.round(metres * k)}px"></i>${metres} m`;
  }

  // keep it sharp when the window changes size
  resize() { if (this.open && this.args) this.draw(...this.args); }
}

// ------------------------------------------------------------------ baking the zone picture
function bake(zone) {
  const d = zone.minimap || {};
  const B = zone.bounds;
  const margin = d.margin ?? 30;
  const minX = Math.floor(B.minX - margin), maxX = Math.ceil(B.maxX + margin);
  const minZ = Math.floor(B.minZ - margin), maxZ = Math.ceil(B.maxZ + margin);
  const W = maxX - minX, H = maxZ - minZ;

  // height samples, one per metre (with a 1 sample border for slopes)
  const sw = W + 3, sh = H + 3;
  const hs = new Float32Array(sw * sh);
  for (let j = 0; j < sh; j++) for (let i = 0; i < sw; i++) hs[j * sw + i] = zone.heightAt(minX + i - 1 + 0.5, minZ + j - 1 + 0.5);
  const hAt = (i, j) => hs[(j + 1) * sw + (i + 1)];

  const ground = d.ground || defaultGround(zone);
  const small = document.createElement('canvas');
  small.width = W; small.height = H;
  const sc = small.getContext('2d');
  const img = sc.createImageData(W, H);
  for (let j = 0; j < H; j++) {
    for (let i = 0; i < W; i++) {
      const x = minX + i + 0.5, z = minZ + j + 0.5, h = hAt(i, j);
      const gx = (hAt(i + 1, j) - hAt(i - 1, j)) / 2, gz = (hAt(i, j + 1) - hAt(i, j - 1)) / 2;
      const slope = Math.hypot(gx, gz);
      const col = ground(x, z, h, slope);
      // hill shading, light from the north-west
      let sh2 = 1 + (-gx - gz) * 0.55;
      sh2 = Math.max(0.55, Math.min(1.35, sh2));
      // dim everything outside the walkable area
      const out = x < B.minX || x > B.maxX || z < B.minZ || z > B.maxZ ? 0.55 : 1;
      const o = (j * W + i) * 4;
      img.data[o] = Math.min(255, col[0] * sh2 * out);
      img.data[o + 1] = Math.min(255, col[1] * sh2 * out);
      img.data[o + 2] = Math.min(255, col[2] * sh2 * out);
      img.data[o + 3] = 255;
    }
  }
  sc.putImageData(img, 0, 0);

  const canvas = document.createElement('canvas');
  canvas.width = W * PX; canvas.height = H * PX;
  const c = canvas.getContext('2d');
  c.imageSmoothingEnabled = true;
  c.drawImage(small, 0, 0, W * PX, H * PX);
  c.scale(PX, PX);
  c.translate(-minX, -minZ);

  // trails
  c.lineCap = c.lineJoin = 'round';
  for (const p of d.paths || []) {
    c.strokeStyle = 'rgba(176, 140, 92, 0.85)';
    c.lineWidth = 2.2;
    c.beginPath();
    p.forEach(([x, z], i) => (i ? c.lineTo(x, z) : c.moveTo(x, z)));
    c.stroke();
  }
  // colliders: trees and rocks as dots, wreckage and buildings as their real footprints
  for (const o of zone.colliders) {
    if (o.type === 'circle') {
      c.fillStyle = o.r < 1.2 ? 'rgba(18, 40, 20, 0.75)' : 'rgba(120, 122, 118, 0.9)';
      c.beginPath(); c.arc(o.x, o.z, Math.max(0.6, o.r), 0, Math.PI * 2); c.fill();
    } else if (o.type === 'box') {
      c.save();
      c.translate(o.x, o.z);
      c.rotate(-(o.rot || 0));
      c.fillStyle = 'rgba(226, 222, 210, 0.95)';
      c.strokeStyle = 'rgba(40, 36, 30, 0.8)';
      c.lineWidth = 0.35;
      c.fillRect(-o.hw, -o.hd, o.hw * 2, o.hd * 2);
      c.strokeRect(-o.hw, -o.hd, o.hw * 2, o.hd * 2);
      c.restore();
    }
  }
  // edge of the walkable area
  c.strokeStyle = 'rgba(255, 255, 255, 0.25)';
  c.lineWidth = 0.6;
  c.setLineDash([2, 2]);
  c.strokeRect(B.minX, B.minZ, B.maxX - B.minX, B.maxZ - B.minZ);

  return { canvas, minX, minZ, w: W, h: H, view: d.view || VIEW, landmarks: d.landmarks || [] };
}

// zones without their own colours: water below the sea level (if the zone has a sea), green by height
function defaultGround(zone) {
  return (x, z, h, slope) => {
    if (zone.deepWater !== null && zone.deepWater !== undefined && h < 0) return [34, 78, 96];
    if (slope > 0.75) return [118, 116, 104];
    const t = Math.max(0, Math.min(1, (h + 4) / 16));
    return [62 + t * 40, 92 + t * 22, 52 + t * 18];
  };
}
