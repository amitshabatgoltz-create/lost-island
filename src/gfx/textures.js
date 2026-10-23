// Procedural, tileable surface textures (albedo + normal), generated once at load and cached for the session.
// Albedo alpha carries a height value that the terrain shader uses for height-based blending.
// Everything is painted with canvas 2D and typed arrays: no external image files.
import * as THREE from 'three';

let ANISO = 8;
export function setAnisotropy(n) { ANISO = n; }

// ------------------------------------------------------------------ periodic noise
function hash(ix, iy, seed) {
  let h = (ix * 374761393 + iy * 668265263 + seed * 1442695041) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

// fbm that tiles over the texture: `freq` lattice cells per texture side for the first octave
export function tileFbm(size, freq, octaves, seed, gain = 0.5) {
  const out = new Float32Array(size * size);
  let amp = 1, total = 0;
  for (let o = 0; o < octaves; o++) {
    const f = freq << o;
    const lat = new Float32Array(f * f);
    for (let j = 0; j < f; j++) for (let i = 0; i < f; i++) lat[j * f + i] = hash(i, j, seed + o * 101);
    const k = f / size;
    for (let y = 0; y < size; y++) {
      const fy = y * k, y0 = Math.floor(fy), ty = fy - y0, sy = ty * ty * (3 - 2 * ty);
      const r0 = (y0 % f) * f, r1 = ((y0 + 1) % f) * f;
      for (let x = 0; x < size; x++) {
        const fx = x * k, x0 = Math.floor(fx), tx = fx - x0, sx = tx * tx * (3 - 2 * tx);
        const c0 = x0 % f, c1 = (x0 + 1) % f;
        const a = lat[r0 + c0] + (lat[r0 + c1] - lat[r0 + c0]) * sx;
        const b = lat[r1 + c0] + (lat[r1 + c1] - lat[r1 + c0]) * sx;
        out[y * size + x] += (a + (b - a) * sy) * amp;
      }
    }
    total += amp;
    amp *= gain;
  }
  for (let i = 0; i < out.length; i++) out[i] /= total;
  return out;
}

// periodic Worley noise: returns F1 and F2-F1 (cracks) in cell units
function tileWorley(size, cells, seed, stretchY = 1) {
  const f1 = new Float32Array(size * size), edge = new Float32Array(size * size);
  const px = new Float32Array(cells * cells), py = new Float32Array(cells * cells);
  for (let j = 0; j < cells; j++) for (let i = 0; i < cells; i++) {
    px[j * cells + i] = hash(i, j, seed); py[j * cells + i] = hash(i, j, seed + 7);
  }
  const k = cells / size;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const fx = x * k, fy = y * k, cx = Math.floor(fx), cy = Math.floor(fy);
    let d1 = 9, d2 = 9;
    for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) {
      const ix = cx + ox, iy = cy + oy;
      const wi = ((ix % cells) + cells) % cells, wj = ((iy % cells) + cells) % cells;
      const dx = ix + px[wj * cells + wi] - fx, dy = (iy + py[wj * cells + wi] - fy) * stretchY;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) d2 = d;
    }
    f1[y * size + x] = d1; edge[y * size + x] = d2 - d1;
  }
  return { f1, edge };
}

function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ------------------------------------------------------------------ canvas helpers
function canvas(w, h = w) {
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  return { cv, c: cv.getContext('2d', { willReadFrequently: true }) };
}
// draw something that crosses the texture edge on every side it touches, so the result tiles
function wrapped(w, h, x, y, r, fn) {
  for (const ox of [-w, 0, w]) for (const oy of [-h, 0, h]) {
    const xx = x + ox, yy = y + oy;
    if (xx + r < 0 || xx - r > w || yy + r < 0 || yy - r > h) continue;
    fn(xx, yy);
  }
}
const rgb = (r, g, b, a = 1) => `rgba(${r | 0},${g | 0},${b | 0},${a})`;

// ------------------------------------------------------------------ texture assembly
function dataTex(data, w, h, srgb) {
  const t = new THREE.DataTexture(data, w, h, THREE.RGBAFormat);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.magFilter = THREE.LinearFilter;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.generateMipmaps = true;
  t.anisotropy = ANISO;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.userData.shared = true; // survives zone disposal (see core/dispose.js)
  t.needsUpdate = true;
  return t;
}

// height (0..1, w*h) -> tangent-space normal map (tiling Sobel)
function normalFromHeight(height, w, h, strength) {
  const out = new Uint8Array(w * h * 4);
  const H = (x, y) => height[((y + h) % h) * w + ((x + w) % w)];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const dx = (H(x + 1, y - 1) + 2 * H(x + 1, y) + H(x + 1, y + 1)) - (H(x - 1, y - 1) + 2 * H(x - 1, y) + H(x - 1, y + 1));
    const dy = (H(x - 1, y + 1) + 2 * H(x, y + 1) + H(x + 1, y + 1)) - (H(x - 1, y - 1) + 2 * H(x, y - 1) + H(x + 1, y - 1));
    let nx = -dx * strength, ny = -dy * strength, nz = 1; // OpenGL convention, row 0 = v 0
    const l = Math.hypot(nx, ny, nz);
    nx /= l; ny /= l; nz /= l;
    const i = (y * w + x) * 4;
    out[i] = (nx * 0.5 + 0.5) * 255; out[i + 1] = (ny * 0.5 + 0.5) * 255; out[i + 2] = (nz * 0.5 + 0.5) * 255; out[i + 3] = 255;
  }
  return out;
}

// colour canvas + height array -> { map, normalMap }, height stored in the albedo alpha
function finish(colorCtx, height, w, h, normalStrength) {
  const img = colorCtx.getImageData(0, 0, w, h).data;
  const albedo = new Uint8Array(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    albedo[i * 4] = img[i * 4]; albedo[i * 4 + 1] = img[i * 4 + 1]; albedo[i * 4 + 2] = img[i * 4 + 2];
    albedo[i * 4 + 3] = Math.max(0, Math.min(255, height[i] * 255));
  }
  return { map: dataTex(albedo, w, h, true), normalMap: dataTex(normalFromHeight(height, w, h, normalStrength), w, h, false) };
}
// grayscale canvas -> Float32 height
function readHeight(ctx, w, h) {
  const d = ctx.getImageData(0, 0, w, h).data, out = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) out[i] = d[i * 4] / 255;
  return out;
}
// per-pixel colour modulation from a noise field
function modulate(ctx, w, h, field, amount, tint = [1, 1, 1]) {
  const id = ctx.getImageData(0, 0, w, h), d = id.data;
  for (let i = 0; i < w * h; i++) {
    const k = 1 + (field[i] - 0.5) * amount;
    d[i * 4] *= k * tint[0]; d[i * 4 + 1] *= k * tint[1]; d[i * 4 + 2] *= k * tint[2];
  }
  ctx.putImageData(id, 0, 0);
}

const cache = new Map();
const cached = (key, fn) => { if (!cache.has(key)) cache.set(key, fn()); return cache.get(key); };

// ================================================================== ground
export const sandTex = () => cached('sand', () => {
  const S = 512, { c } = canvas(S);
  const big = tileFbm(S, 4, 4, 11), fine = tileFbm(S, 64, 2, 12), warp = tileFbm(S, 3, 3, 13);
  const id = c.createImageData(S, S), d = id.data, height = new Float32Array(S * S);
  const r = rng(5);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const i = y * S + x;
    // wind ripples: a warped sine, sharp on one side
    const ph = ((y + warp[i] * 140 + big[i] * 40 + (fine[i] - 0.5) * 6) / S) * Math.PI * 2 * 13;
    const rip = Math.pow(0.5 + 0.5 * Math.sin(ph + 0.6 * Math.sin(ph)), 1.6);
    const g = r();
    const grain = g > 0.985 ? -0.35 : g > 0.97 ? 0.18 : (g - 0.5) * 0.12;
    const k = 0.9 + big[i] * 0.18 + grain + (fine[i] - 0.5) * 0.1 - rip * 0.018;
    d[i * 4] = 206 * k; d[i * 4 + 1] = 186 * k; d[i * 4 + 2] = 148 * k; d[i * 4 + 3] = 255;
    height[i] = 0.4 + rip * 0.14 * (0.4 + big[i]) + (fine[i] - 0.5) * 0.3 + grain * 0.4;
  }
  c.putImageData(id, 0, 0);
  return finish(c, height, S, S, 1.6);
});

export const grassTex = () => cached('grass', () => {
  const S = 512, { c } = canvas(S), hc = canvas(S).c;
  const soil = tileFbm(S, 8, 4, 21);
  c.fillStyle = rgb(74, 62, 40); c.fillRect(0, 0, S, S);
  modulate(c, S, S, soil, 0.6);
  hc.fillStyle = '#000'; hc.fillRect(0, 0, S, S);
  const r = rng(22), patch = tileFbm(S, 4, 3, 23);
  c.lineCap = hc.lineCap = 'round';
  for (let n = 0; n < 16000; n++) {
    const x = r() * S, y = r() * S, p = patch[(y | 0) * S + (x | 0)];
    const len = 5 + r() * 13, a = r() * Math.PI * 2, w = 1.1 + r() * 1.6;
    const dry = r() < 0.12 + p * 0.25;
    const lum = 0.7 + r() * 0.5;
    const col = dry ? [150 * lum, 140 * lum, 70 * lum] : [(58 + p * 40) * lum, (98 + p * 30) * lum, (34 + r() * 16) * lum];
    const ex = x + Math.cos(a) * len, ey = y + Math.sin(a) * len;
    const hgt = 0.35 + (n / 16000) * 0.65;
    wrapped(S, S, x, y, len + 2, (xx, yy) => {
      const dx = ex - x, dy = ey - y;
      c.strokeStyle = rgb(...col); c.lineWidth = w; c.beginPath(); c.moveTo(xx, yy); c.lineTo(xx + dx, yy + dy); c.stroke();
      hc.strokeStyle = rgb(hgt * 255, hgt * 255, hgt * 255); hc.lineWidth = w; hc.beginPath(); hc.moveTo(xx, yy); hc.lineTo(xx + dx, yy + dy); hc.stroke();
    });
  }
  return finish(c, readHeight(hc, S, S), S, S, 3.0);
});

export const dirtTex = () => cached('dirt', () => {
  const S = 512, { c } = canvas(S), hc = canvas(S).c;
  const base = tileFbm(S, 6, 5, 31), fine = tileFbm(S, 48, 2, 32);
  const id = c.createImageData(S, S), d = id.data, hd = hc.createImageData(S, S), h = hd.data;
  for (let i = 0; i < S * S; i++) {
    const k = 0.78 + base[i] * 0.4 + (fine[i] - 0.5) * 0.18;
    d[i * 4] = 146 * k; d[i * 4 + 1] = 122 * k; d[i * 4 + 2] = 90 * k; d[i * 4 + 3] = 255;
    const hv = (0.3 + base[i] * 0.3 + (fine[i] - 0.5) * 0.3) * 255;
    h[i * 4] = h[i * 4 + 1] = h[i * 4 + 2] = hv; h[i * 4 + 3] = 255;
  }
  c.putImageData(id, 0, 0); hc.putImageData(hd, 0, 0);
  const r = rng(33);
  for (let n = 0; n < 700; n++) {
    const x = r() * S, y = r() * S, rad = 1.5 + r() * r() * 7, ell = 0.6 + r() * 0.4, rot = r() * Math.PI;
    const g = 110 + r() * 70, warm = r() * 14;
    wrapped(S, S, x, y, rad + 2, (xx, yy) => {
      const grd = c.createRadialGradient(xx - rad * 0.3, yy - rad * 0.3, 0, xx, yy, rad);
      grd.addColorStop(0, rgb(g + 35 + warm, g + 30, g + 22)); grd.addColorStop(1, rgb(g * 0.6 + warm, g * 0.56, g * 0.5));
      c.fillStyle = grd; c.beginPath(); c.ellipse(xx, yy, rad, rad * ell, rot, 0, 7); c.fill();
      const hg = hc.createRadialGradient(xx, yy, 0, xx, yy, rad);
      hg.addColorStop(0, '#fff'); hg.addColorStop(1, '#777');
      hc.fillStyle = hg; hc.beginPath(); hc.ellipse(xx, yy, rad, rad * ell, rot, 0, 7); hc.fill();
    });
  }
  return finish(c, readHeight(hc, S, S), S, S, 2.6);
});

export const rockTex = () => cached('rock', () => {
  const S = 512, { c } = canvas(S);
  const base = tileFbm(S, 4, 6, 41, 0.55), fine = tileFbm(S, 32, 3, 42), lich = tileFbm(S, 12, 3, 43);
  const { edge } = tileWorley(S, 5, 44);
  const warp = tileFbm(S, 8, 3, 45);
  const id = c.createImageData(S, S), d = id.data, height = new Float32Array(S * S);
  for (let i = 0; i < S * S; i++) {
    // thin, broken cracks only (no visible cell pattern)
    const crack = (1 - Math.min(1, edge[i] / 0.025)) * Math.max(0, warp[i] - 0.45) * 2;
    const k = 0.7 + base[i] * 0.5 + (fine[i] - 0.5) * 0.22 - crack * 0.3;
    let r = 128 * k, g = 125 * k, b = 118 * k;
    const l = Math.max(0, (lich[i] - 0.62) * 4) * (1 - crack);
    r += (150 - r) * l * 0.5; g += (150 - g) * l * 0.55; b += (90 - b) * l * 0.5;
    d[i * 4] = r; d[i * 4 + 1] = g; d[i * 4 + 2] = b; d[i * 4 + 3] = 255;
    height[i] = 0.25 + base[i] * 0.55 + (fine[i] - 0.5) * 0.3 - crack * 0.2;
  }
  c.putImageData(id, 0, 0);
  return finish(c, height, S, S, 3.2);
});

// forest floor: soil covered in fallen leaves and twigs
export const litterTex = () => cached('litter', () => {
  const S = 512, { c } = canvas(S), hc = canvas(S).c;
  const soil = tileFbm(S, 8, 4, 51);
  c.fillStyle = rgb(52, 42, 30); c.fillRect(0, 0, S, S);
  modulate(c, S, S, soil, 0.7);
  hc.fillStyle = '#202020'; hc.fillRect(0, 0, S, S);
  const r = rng(52);
  const leaf = (ctx, x, y, L, W, a) => {
    ctx.save(); ctx.translate(x, y); ctx.rotate(a);
    ctx.beginPath(); ctx.moveTo(-L, 0); ctx.quadraticCurveTo(0, -W * 2, L, 0); ctx.quadraticCurveTo(0, W * 2, -L, 0); ctx.fill();
    ctx.restore();
  };
  const N = 2600;
  for (let n = 0; n < N; n++) {
    const x = r() * S, y = r() * S, L = 5 + r() * 11, W = L * (0.3 + r() * 0.2), a = r() * Math.PI * 2;
    const t = r(), lum = 0.55 + r() * 0.55;
    const col = t < 0.45 ? [110, 72, 38] : t < 0.7 ? [140, 98, 44] : t < 0.85 ? [82, 80, 40] : [60, 46, 30];
    const hv = 70 + (n / N) * 185;
    wrapped(S, S, x, y, L + 2, (xx, yy) => {
      c.fillStyle = rgb(col[0] * lum, col[1] * lum, col[2] * lum); leaf(c, xx, yy, L, W, a);
      c.strokeStyle = rgb(col[0] * lum * 0.6, col[1] * lum * 0.6, col[2] * lum * 0.6); c.lineWidth = 0.8;
      c.beginPath(); c.moveTo(xx - Math.cos(a) * L, yy - Math.sin(a) * L); c.lineTo(xx + Math.cos(a) * L, yy + Math.sin(a) * L); c.stroke();
      hc.fillStyle = rgb(hv, hv, hv); leaf(hc, xx, yy, L, W, a);
    });
  }
  c.lineCap = hc.lineCap = 'round';
  for (let n = 0; n < 90; n++) {
    const x = r() * S, y = r() * S, L = 14 + r() * 40, a = r() * Math.PI * 2, w = 1.2 + r() * 2.2;
    wrapped(S, S, x, y, L + 4, (xx, yy) => {
      c.strokeStyle = rgb(70, 54, 36); c.lineWidth = w; c.beginPath(); c.moveTo(xx, yy); c.lineTo(xx + Math.cos(a) * L, yy + Math.sin(a) * L); c.stroke();
      hc.strokeStyle = '#fff'; hc.lineWidth = w; hc.beginPath(); hc.moveTo(xx, yy); hc.lineTo(xx + Math.cos(a) * L, yy + Math.sin(a) * L); hc.stroke();
    });
  }
  return finish(c, readHeight(hc, S, S), S, S, 2.4);
});

export const mossTex = () => cached('moss', () => {
  const S = 512, { c } = canvas(S);
  const base = tileFbm(S, 6, 4, 61), fine = tileFbm(S, 96, 2, 62), clump = tileFbm(S, 24, 3, 63);
  const id = c.createImageData(S, S), d = id.data, height = new Float32Array(S * S);
  for (let i = 0; i < S * S; i++) {
    const k = 0.7 + base[i] * 0.5 + (fine[i] - 0.5) * 0.35;
    const y = Math.max(0, clump[i] - 0.5);
    d[i * 4] = (58 + y * 60) * k; d[i * 4 + 1] = (82 + y * 50) * k; d[i * 4 + 2] = 36 * k; d[i * 4 + 3] = 255;
    height[i] = 0.3 + clump[i] * 0.4 + (fine[i] - 0.5) * 0.4;
  }
  c.putImageData(id, 0, 0);
  return finish(c, height, S, S, 2.8);
});

// ================================================================== bark & wood
export const barkTex = () => cached('bark', () => {
  const W = 256, H = 512, { c } = canvas(W, H);
  const { edge } = (() => {
    // vertical fissures: worley stretched along the trunk (computed square, then sampled stretched)
    const w = tileWorley(256, 6, 71, 0.25);
    return w;
  })();
  const fine = tileFbm(256, 32, 3, 72);
  const id = c.createImageData(W, H), d = id.data, height = new Float32Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const j = ((y >> 1) * 256 + x), i = y * W + x;
    const fis = 1 - Math.min(1, edge[j] / 0.12);
    const k = 0.75 + fine[j] * 0.4 - fis * 0.55;
    d[i * 4] = 112 * k; d[i * 4 + 1] = 88 * k; d[i * 4 + 2] = 64 * k; d[i * 4 + 3] = 255;
    height[i] = 0.6 - fis * 0.5 + (fine[j] - 0.5) * 0.3;
  }
  c.putImageData(id, 0, 0);
  return finish(c, height, W, H, 3.5);
});

export const palmBarkTex = () => cached('palmBark', () => {
  const S = 256, { c } = canvas(S);
  const fine = tileFbm(S, 32, 3, 81), big = tileFbm(S, 4, 3, 82);
  const id = c.createImageData(S, S), d = id.data, height = new Float32Array(S * S);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const i = y * S + x;
    // leaf-scar rings, slightly offset per column so they are not perfectly straight
    const ring = ((y + big[i] * 24 + Math.sin((x / S) * Math.PI * 2) * 6) / S) * 6;
    const f = ring - Math.floor(ring);
    const scar = Math.pow(Math.max(0, 1 - Math.abs(f - 0.5) * 2.4), 3);
    const k = 0.72 + fine[i] * 0.35 + scar * 0.2 - (f < 0.08 ? 0.35 : 0);
    d[i * 4] = 150 * k; d[i * 4 + 1] = 126 * k; d[i * 4 + 2] = 92 * k; d[i * 4 + 3] = 255;
    height[i] = 0.3 + scar * 0.5 + (fine[i] - 0.5) * 0.2 - (f < 0.08 ? 0.3 : 0);
  }
  c.putImageData(id, 0, 0);
  return finish(c, height, S, S, 3.5);
});

export const woodTex = () => cached('wood', () => {
  const W = 256, H = 512, { c } = canvas(W, H);
  const n = tileFbm(256, 8, 4, 91), fine = tileFbm(256, 64, 2, 92);
  const id = c.createImageData(W, H), d = id.data, height = new Float32Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const j = ((y >> 1) * 256 + x), i = y * W + x;
    const grain = 0.5 + 0.5 * Math.sin((x / W) * Math.PI * 2 * 14 + n[j] * 14);
    const plank = (x % 64) < 2 ? 0.45 : 1;
    const k = (0.7 + grain * 0.2 + (fine[j] - 0.5) * 0.15) * plank;
    d[i * 4] = 122 * k; d[i * 4 + 1] = 96 * k; d[i * 4 + 2] = 70 * k; d[i * 4 + 3] = 255;
    height[i] = 0.5 + grain * 0.15 - (plank < 1 ? 0.4 : 0);
  }
  c.putImageData(id, 0, 0);
  return finish(c, height, W, H, 2.5);
});

// ================================================================== aircraft skin
// near-white so the per-vertex livery and burn colours of the wreck still show through
export const panelTex = () => cached('panel', () => {
  const S = 512, { c } = canvas(S), hc = canvas(S).c;
  const big = tileFbm(S, 4, 4, 101), fine = tileFbm(S, 64, 2, 102), streak = tileFbm(S, 2, 4, 103);
  const id = c.createImageData(S, S), d = id.data;
  const hd = hc.createImageData(S, S), h = hd.data;
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const i = y * S + x;
    // vertical grime streaks (rain run-off) and slight panel tone differences
    const st = Math.pow(streak[(y % 64) * S + x] * 0.5 + streak[i] * 0.5, 2);
    const panel = hash(Math.floor(x / 170), Math.floor((y + (Math.floor(x / 170) % 2) * 64) / 128), 104);
    const k = 0.9 + panel * 0.07 + (big[i] - 0.5) * 0.08 + (fine[i] - 0.5) * 0.04 - st * 0.12;
    d[i * 4] = 238 * k; d[i * 4 + 1] = 238 * k; d[i * 4 + 2] = 234 * k; d[i * 4 + 3] = 255;
    const hv = (0.6 + (fine[i] - 0.5) * 0.04) * 255;
    h[i * 4] = h[i * 4 + 1] = h[i * 4 + 2] = hv; h[i * 4 + 3] = 255;
  }
  c.putImageData(id, 0, 0); hc.putImageData(hd, 0, 0);
  // seams: horizontal every 128 px, vertical every 170 px staggered per row
  c.strokeStyle = 'rgba(60,62,66,0.55)'; hc.strokeStyle = '#333';
  c.lineWidth = hc.lineWidth = 2;
  const seam = (x0, y0, x1, y1) => { for (const ctx of [c, hc]) { ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke(); } };
  for (let y = 0; y < S; y += 128) seam(0, y + 0.5, S, y + 0.5);
  for (let row = 0; row < 4; row++) {
    const off = (row % 2) * 85;
    for (let x = off; x < S + 170; x += 170) seam((x % S) + 0.5, row * 128, (x % S) + 0.5, row * 128 + 128);
  }
  // rivet rows along the seams
  c.fillStyle = 'rgba(120,122,126,0.7)'; hc.fillStyle = '#fff';
  for (let y = 0; y < S; y += 128) for (let x = 4; x < S; x += 12) for (const yy of [y + 6, y - 6]) {
    const ty = (yy + S) % S;
    c.beginPath(); c.arc(x, ty, 1.3, 0, 7); c.fill(); hc.beginPath(); hc.arc(x, ty, 1.6, 0, 7); hc.fill();
  }
  // scratches
  const r = rng(105);
  c.strokeStyle = 'rgba(150,150,150,0.35)'; c.lineWidth = 0.8;
  for (let n = 0; n < 140; n++) {
    const x = r() * S, y = r() * S, a = r() * 0.6 - 0.3 + (r() > 0.5 ? 0 : Math.PI / 2), L = 6 + r() * 40;
    c.beginPath(); c.moveTo(x, y); c.lineTo(x + Math.cos(a) * L, y + Math.sin(a) * L); c.stroke();
  }
  return finish(c, readHeight(hc, S, S), S, S, 2.0);
});

// seat fabric
export const fabricTex = () => cached('fabric', () => {
  const S = 128, { c } = canvas(S);
  const id = c.createImageData(S, S), d = id.data, height = new Float32Array(S * S);
  const n = tileFbm(S, 8, 3, 111);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const i = y * S + x;
    const weave = ((x >> 1) + (y >> 1)) % 2 ? 0.9 : 1.06;
    const k = weave * (0.9 + n[i] * 0.2);
    d[i * 4] = 230 * k; d[i * 4 + 1] = 230 * k; d[i * 4 + 2] = 230 * k; d[i * 4 + 3] = 255;
    height[i] = weave - 0.5;
  }
  c.putImageData(id, 0, 0);
  return finish(c, height, S, S, 1.2);
});

// sea surface ripples (normal map only)
export const rippleNormal = () => cached('ripple', () => {
  const S = 256;
  const a = tileFbm(S, 8, 4, 121, 0.55), b = tileFbm(S, 16, 3, 122);
  const h = new Float32Array(S * S);
  for (let i = 0; i < S * S; i++) h[i] = a[i] * 0.7 + b[i] * 0.3;
  return dataTex(normalFromHeight(h, S, S, 6), S, S, false);
});

// ================================================================== foliage atlas
// 2x2 cells (each 512 px): 0 broadleaf cluster, 1 palm frond, 2 fern frond, 3 grass tuft.
// Transparent pixels keep a leaf colour so mipmaps do not get dark halos.
export const ATLAS = { leaf: [0, 0.5], palm: [0.5, 0.5], fern: [0, 0], grass: [0.5, 0] };
export const foliageAtlas = () => cached('foliage', () => {
  const S = 1024, C = 512, { c } = canvas(S);
  const r = rng(131);
  c.clearRect(0, 0, S, S);
  const leafShape = (x, y, L, W, a) => {
    c.save(); c.translate(x, y); c.rotate(a);
    c.beginPath(); c.moveTo(0, 0); c.quadraticCurveTo(L * 0.45, -W, L, 0); c.quadraticCurveTo(L * 0.45, W, 0, 0); c.fill();
    c.restore();
  };
  const green = (lum, hue = 0) => rgb((48 + hue * 30) * lum, (92 + hue * 18) * lum, (30 + hue * 4) * lum);

  // --- cell 0 (top-left in canvas = v 0.5..1): broadleaf cluster around a dense core
  {
    const ox = 0, oy = 0, cx = ox + C / 2, cy = oy + C / 2;
    c.fillStyle = green(0.45); c.beginPath(); c.ellipse(cx, cy, 120, 105, 0, 0, 7); c.fill();
    for (let n = 0; n < 260; n++) {
      const a = r() * Math.PI * 2, rad = Math.sqrt(r()) * 190;
      const x = cx + Math.cos(a) * rad, y = cy + Math.sin(a) * rad * 0.92;
      const L = 38 + r() * 34, W = L * (0.32 + r() * 0.12);
      const dir = a + (r() - 0.5) * 1.2;
      const lum = 0.55 + r() * 0.65 * (1 - rad / 260), hue = r();
      c.fillStyle = green(lum, hue);
      leafShape(x, y, L, W, dir);
      c.strokeStyle = green(lum * 1.25, hue); c.lineWidth = 1.2;
      c.beginPath(); c.moveTo(x, y); c.lineTo(x + Math.cos(dir) * L * 0.85, y + Math.sin(dir) * L * 0.85); c.stroke();
    }
  }
  // --- cell 1 (top-right): palm frond, rachis along the cell's vertical axis (v = length)
  {
    const ox = C, cx = ox + C / 2;
    c.strokeStyle = rgb(120, 112, 60); c.lineWidth = 7; c.lineCap = 'round';
    c.beginPath(); c.moveTo(cx, C - 6); c.lineTo(cx, 6); c.stroke();
    for (let i = 0; i < 46; i++) {
      const t = i / 46, y = C - 12 - t * (C - 30);
      const env = Math.sin(Math.min(1, t * 1.15) * Math.PI) * 0.9 + 0.1;
      for (const s of [-1, 1]) {
        const L = (40 + 205 * env) * (0.9 + r() * 0.2), a = -Math.PI / 2 + s * (0.95 + r() * 0.15);
        const lum = 0.75 + r() * 0.4;
        c.strokeStyle = rgb(66 * lum, 112 * lum, 36 * lum); c.lineWidth = 7 + env * 5; c.lineCap = 'round';
        c.beginPath(); c.moveTo(cx, y); c.quadraticCurveTo(cx + Math.cos(a) * L * 0.5, y + Math.sin(a) * L * 0.5 - 8, cx + Math.cos(a) * L, y + Math.sin(a) * L + 14); c.stroke();
        c.strokeStyle = rgb(96 * lum, 140 * lum, 52 * lum); c.lineWidth = 1.2;
        c.beginPath(); c.moveTo(cx, y); c.lineTo(cx + Math.cos(a) * L * 0.9, y + Math.sin(a) * L * 0.9 + 10); c.stroke();
      }
    }
  }
  // --- cell 2 (bottom-left): fern frond with lobed pinnae
  {
    const ox = 0, oy = C, cx = ox + C / 2;
    c.strokeStyle = rgb(70, 96, 36); c.lineWidth = 5; c.lineCap = 'round';
    c.beginPath(); c.moveTo(cx, oy + C - 6); c.lineTo(cx, oy + 10); c.stroke();
    for (let i = 0; i < 30; i++) {
      const t = i / 30, y = oy + C - 18 - t * (C - 40);
      const env = Math.sin(Math.min(1, t * 1.1) * Math.PI) * 0.85 + 0.15;
      for (const s of [-1, 1]) {
        const L = 30 + 190 * env, a = -Math.PI / 2 + s * 1.15;
        const lum = 0.8 + r() * 0.35;
        for (let k = 0; k < 9; k++) {
          const q = k / 9, px = cx + Math.cos(a) * L * q, py = y + Math.sin(a) * L * q;
          c.fillStyle = rgb(70 * lum, 122 * lum, 44 * lum);
          c.beginPath(); c.ellipse(px, py, 9 * (1 - q * 0.6), 5 * (1 - q * 0.5), a, 0, 7); c.fill();
        }
      }
    }
  }
  // --- cell 3 (bottom-right): grass tuft fanning up from the bottom centre
  {
    const ox = C, oy = C, bx = ox + C / 2, by = oy + C - 2;
    for (let n = 0; n < 70; n++) {
      const a = -Math.PI / 2 + (r() - 0.5) * 1.3, L = 180 + r() * 300, w = 6 + r() * 6;
      const tx = bx + Math.cos(a) * L + (r() - 0.5) * 40, ty = by + Math.sin(a) * L;
      const lum = 0.7 + r() * 0.5, dry = r() < 0.18;
      c.fillStyle = dry ? rgb(150 * lum, 140 * lum, 74 * lum) : rgb(82 * lum, 128 * lum, 42 * lum);
      const sx = bx + (r() - 0.5) * 60;
      c.beginPath(); c.moveTo(sx - w, by); c.quadraticCurveTo((sx + tx) / 2, (by + ty) / 2 - 20, tx, ty); c.quadraticCurveTo((sx + tx) / 2 + 4, (by + ty) / 2 - 18, sx + w, by); c.fill();
    }
  }
  // fill transparent texels with the mean leaf colour (no dark mip halos)
  const id = c.getImageData(0, 0, S, S), d = id.data;
  for (let i = 0; i < S * S; i++) {
    if (d[i * 4 + 3] < 250) {
      const a = d[i * 4 + 3] / 255;
      d[i * 4] = d[i * 4] * a + 60 * (1 - a); d[i * 4 + 1] = d[i * 4 + 1] * a + 96 * (1 - a); d[i * 4 + 2] = d[i * 4 + 2] * a + 36 * (1 - a);
      d[i * 4 + 3] = a > 0.5 ? 255 : 0;
    }
  }
  // canvas row 0 is the top; DataTexture row 0 is v = 0 (bottom) -> flip
  const flipped = new Uint8Array(S * S * 4);
  for (let y = 0; y < S; y++) flipped.set(d.subarray((S - 1 - y) * S * 4, (S - y) * S * 4), y * S * 4);
  const t = dataTex(flipped, S, S, true);
  t.anisotropy = 4;
  return t;
});
