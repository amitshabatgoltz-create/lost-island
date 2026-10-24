// NIGHTJAR observation facility N-1 (Part 3): the rooms inside the mountain behind the bunker door.
// Entrance corridor → security checkpoint → observation room, records archive and the restricted control room.
// Loaded on demand (separate chunk) and fully disposed when the player leaves.
import * as THREE from 'three';
import { H, ROOMS, DOORS, FX, FBOUNDS } from './layout.js';
import {
  facilityMaterials, wallSegment, buildDoor, buildCeilingLamp, buildEmergencyLamp, buildPipes, buildCableTray,
  buildDesk, buildChair, buildLockers, buildFilingCabinets, buildRestrictedCabinet, buildPaper, buildCRT, SCREEN,
  nightjarSymbolTexture, box,
} from './props.js';
import { canvasTex } from '../../items.js';
import { createFacilityInteractions } from './interactions.js';

const yieldFrame = () => new Promise((r) => setTimeout(r, 0));
const inRoom = (id, x, z, m = 0) => { const [a, b, c, d] = ROOMS[id].r; return x > a - m && x < b + m && z > c - m && z < d + m; };

export async function build(env, api, onProgress = () => {}) {
  const group = new THREE.Group();
  group.name = 'zone:facility';
  const colliders = [];
  const occluders = [];
  const ctx = { group, colliders, occluders };
  const M = facilityMaterials();

  onProgress(0.15, 'Concrete and steel');
  // floor and ceiling over the whole plan (the walls close every room)
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(36, 38), M.floor);
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(-1, 0, -2);
  floor.receiveShadow = true;
  group.add(floor);
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(36, 38), M.ceiling);
  ceil.rotation.x = Math.PI / 2;
  ceil.position.set(-1, H, -2);
  group.add(ceil);
  // dust, oil and water stains on the floor
  const stainTex = canvasTex(256, 256, (c) => {
    c.clearRect(0, 0, 256, 256);
    for (let i = 0; i < 9; i++) { const g = c.createRadialGradient(128, 128, 0, 128, 128, 128); g.addColorStop(0, 'rgba(25,22,18,0.35)'); g.addColorStop(1, 'rgba(25,22,18,0)'); c.fillStyle = g; c.beginPath(); c.ellipse(128 + (Math.random() - 0.5) * 80, 128 + (Math.random() - 0.5) * 80, 40 + Math.random() * 70, 30 + Math.random() * 50, Math.random() * 3, 0, 7); c.fill(); }
  });
  const stainMat = new THREE.MeshStandardMaterial({ map: stainTex, transparent: true, depthWrite: false, roughness: 0.5, polygonOffset: true, polygonOffsetFactor: -2 });
  for (const [x, z, s] of [[0, 6, 2.4], [-3, -3, 2.2], [2, -12, 3], [-5, -17, 2.4], [11, 1, 2.4], [-13, -14, 2.6], [0, 13, 1.8]]) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(s, s), stainMat);
    m.rotation.x = -Math.PI / 2;
    m.rotation.z = x * z;
    m.position.set(x, 0.005, z);
    group.add(m);
  }

  // ---------------------------------------------------------------- walls (gaps where the doors are)
  const W = (x0, z0, x1, z1) => wallSegment(ctx, M, x0, z0, x1, z1);
  W(-1.5, 0, -1.5, 16); W(1.5, 0, 1.5, 16);                       // corridor
  W(-6, 0, -1.5, 0); W(1.5, 0, 6, 0);                              // checkpoint south
  W(-6, -6, -6, 0);                                                // checkpoint west (the sealed door is set into it)
  W(6, -6, 6, -3.5); W(6, -1.5, 6, 4);                             // checkpoint east / archive west
  W(-8, -6, -1, -6); W(1, -6, 8, -6);                              // checkpoint north / observation south
  W(-8, -20, -8, -15); W(-8, -13, -8, -6);                          // observation west (control door)
  W(8, -20, 8, -6);                                                // observation east
  W(-18, -20, 8, -20);                                             // observation + control north
  W(6, 4, 16, 4); W(6, -5, 16, -5); W(16, -5, 16, 4);              // archive
  W(-18, -10, -8, -10); W(-18, -20, -18, -10);                      // control
  // the stairway up to the bunker door (the way out)
  W(-1.5, 16, -1.5, 18.5); W(1.5, 16, 1.5, 18.5);
  const outGlow = new THREE.Mesh(new THREE.PlaneGeometry(3, H), new THREE.MeshBasicMaterial({ color: 0x1b2433 }));
  outGlow.position.set(0, H / 2, 18.4);
  outGlow.rotation.y = Math.PI;
  group.add(outGlow);
  colliders.push({ type: 'box', x: 0, z: 18.3, hw: 1.5, hd: 0.2, rot: 0 });
  await yieldFrame();

  // ---------------------------------------------------------------- doors
  onProgress(0.35, 'Doors');
  const doors = {
    observation: buildDoor(ctx, M, DOORS.observation, { stencilLines: [['OBSERVATION', 40], ['LEVEL 2', 30]] }),
    archive: buildDoor(ctx, M, DOORS.archive, { stencilLines: [['RECORDS', 40], ['LEVEL 2', 30]] }),
    control: buildDoor(ctx, M, DOORS.control, { stencilLines: [['CONTROL', 40], ['LEVEL 4', 30]] }),
    sealed: buildDoor(ctx, M, DOORS.sealed, { stencilLines: [['B-2 LOWER LEVEL', 34], ['SEALED BY ORDER', 30]], reader: false, sealed: true }),
  };
  // the main entrance: heavy leaves standing open
  for (const sx of [-1, 1]) {
    const leaf = box(group, 0.12, 2.6, 1.2, M.steel, sx * 1.3, 1.3, 16.2 - 0.6);
    leaf.rotation.y = 0;
  }
  box(group, 3.2, 0.3, 0.4, M.rust, 0, 2.75, 16);

  // ---------------------------------------------------------------- lights
  onProgress(0.45, 'Lights');
  const bulbs = [];
  bulbs.push(buildCeilingLamp(ctx, M, 0, 11, { rot: Math.PI / 2 }), buildCeilingLamp(ctx, M, 0, 4, { rot: Math.PI / 2 }));
  bulbs.push(buildCeilingLamp(ctx, M, 0, -3));
  bulbs.push(buildCeilingLamp(ctx, M, -3, -11), buildCeilingLamp(ctx, M, 3, -16), buildCeilingLamp(ctx, M, 3, -9));
  bulbs.push(buildCeilingLamp(ctx, M, 11, -0.5));
  bulbs.push(buildCeilingLamp(ctx, M, -13, -15));
  const emergency = [
    buildEmergencyLamp(ctx, 1.3, 2.6, 7), buildEmergencyLamp(ctx, -5.8, 2.6, -1), buildEmergencyLamp(ctx, 7.8, 2.6, -18),
    buildEmergencyLamp(ctx, -7.8, 2.6, -8), buildEmergencyLamp(ctx, 15.8, 2.6, 3), buildEmergencyLamp(ctx, -17.8, 2.6, -12),
  ];
  const LAMP = 0xffe6c4, RED = 0xff2a1a;
  const lightDefs = [
    { pos: [0, 2.6, 8.5], dist: 11, i: 4, ei: 1.4 },
    { pos: [0, 2.6, -3], dist: 9, i: 4, ei: 1.4 },
    { pos: [-3, 2.6, -11], dist: 11, i: 4.5, ei: 1.6 },
    { pos: [3, 2.6, -15], dist: 11, i: 4.5, ei: 1.2 },
    { pos: [11, 2.6, -0.5], dist: 9, i: 4, ei: 1.0 },
    { pos: [-13, 2.6, -15], dist: 9, i: 4, ei: 1.4 },
  ];
  const lights = lightDefs.map((d) => {
    const l = new THREE.PointLight(LAMP, d.i, d.dist, 1.4);
    l.position.set(...d.pos);
    group.add(l);
    return l;
  });
  // the glow of the monitor wall
  const monGlow = new THREE.PointLight(0x7fe0b0, 1.3, 7, 1.6);
  monGlow.position.set(0, 1.6, -17.6);
  group.add(monGlow);
  await yieldFrame();

  // ---------------------------------------------------------------- ceiling services
  buildPipes(ctx, M, [
    [-1.1, 16, -1.1, -0.2, 2.75, 0.08], [-0.75, 16, -0.75, -0.2, 2.8, 0.04], [1.15, 16, 1.15, 0, 2.6, 0.05],
    [-7.7, -6.3, -7.7, -19.7, 2.75, 0.08], [7.6, -6.3, 7.6, -19.7, 2.7, 0.05], [6.3, 3.7, 15.7, 3.7, 2.75, 0.06],
    [-17.7, -10.3, -17.7, -19.7, 2.7, 0.07], [-5.7, -0.3, 5.7, -0.3, 2.8, 0.05],
  ]);
  buildCableTray(ctx, M, 0.6, 15.5, 0.6, 0.2);
  buildCableTray(ctx, M, -6.6, -6.5, -6.6, -18.6);
  buildCableTray(ctx, M, -8.4, -14, -17.4, -14);

  // ---------------------------------------------------------------- corridor signage
  const signTex = (lines, bg = '#d8d2c0', fg = '#1e1a14') => canvasTex(512, 160, (c) => {
    c.fillStyle = bg; c.fillRect(0, 0, 512, 160);
    c.fillStyle = fg;
    lines.forEach(([t, s], i) => { c.font = `bold ${s}px monospace`; c.fillText(t, 20, 18 + s + i * (s + 12)); });
    for (let i = 0; i < 40; i++) { c.fillStyle = `rgba(70,55,35,${Math.random() * 0.25})`; c.fillRect(Math.random() * 512, Math.random() * 160, 6 + Math.random() * 40, 2 + Math.random() * 8); }
  });
  const sign = (tex, w, h, x, y, z, ry) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.85 }));
    m.position.set(x, y, z);
    m.rotation.y = ry;
    group.add(m);
    return m;
  };
  sign(signTex([['NIGHTJAR · FIELD STATION N-1', 34], ['OBSERVATION LEVEL 1', 30], ['ALL PERSONNEL SIGN IN AT CHECKPOINT', 22]]), 1.6, 0.5, -1.34, 1.7, 12, Math.PI / 2);
  sign(signTex([['⚠ RADIO SILENCE IN EFFECT', 30], ['NO CIVILIAN CHANNELS', 30]], '#c9a42a'), 1.2, 0.38, 1.34, 1.6, 6, -Math.PI / 2);
  sign(signTex([['EMERGENCY EXIT ↑', 40]], '#2f6b3a', '#eef5ec'), 0.9, 0.28, -1.34, 2.3, 3, Math.PI / 2);
  const sym = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 1.3), new THREE.MeshStandardMaterial({ map: nightjarSymbolTexture(), transparent: true, depthWrite: false, roughness: 0.9 }));
  sym.position.set(0, 1.6, 0.17);
  group.add(sym);
  void sym;

  // ---------------------------------------------------------------- checkpoint
  onProgress(0.55, 'Security checkpoint');
  buildDesk(ctx, M, FX.desk.x, FX.desk.z, 0, { w: 1.8 });
  buildChair(ctx, M, FX.desk.x + 0.3, FX.desk.z - 1.0, 0.4, true);
  const secCRT = buildCRT(group, M, { w: 0.46, h: 0.36, depth: 0.38 });
  secCRT.group.position.set(FX.desk.x + 0.45, 1.0, FX.desk.z - 0.12);
  secCRT.group.rotation.y = -0.15;
  const memoPaper = buildPaper(group, FX.memo.x, 0.79, FX.memo.z, 0.3);
  buildPaper(group, FX.desk.x + 0.15, 0.79, FX.desk.z + 0.15, -0.4, 0xd8d0b8);
  const lockers = buildLockers(ctx, M, -3.6, -0.3, Math.PI, 5, 4);
  const notePaper = buildPaper(lockers.group, 1.0, 1.15, 0.13, 0, 0xefe8d6, [0.12, 0.16]);
  notePaper.rotation.x = Math.PI / 2;
  // ceiling camera in the checkpoint corner
  const secCam = buildCeilingCamera(ctx, M, FX.secCam, new THREE.Vector3(0, 1, -1));
  await yieldFrame();

  // ---------------------------------------------------------------- observation room
  onProgress(0.68, 'The observation room');
  buildDesk(ctx, M, 0, -19.05, 0, { w: 8, d: 0.9 });
  const rack = box(group, 6.4, 1.2, 0.3, M.grey, 0, 2.2, -19.75);
  void rack;
  const monitors = [];
  const crt = (x, y, z, opts) => { const m = buildCRT(group, M, opts); m.group.position.set(x, y, z); monitors.push(m); return m; };
  const screens = {
    beach: crt(-2.1, 2.2, -19.45, { w: 0.62, h: 0.46, depth: 0.3 }),
    main: crt(0, 2.2, -19.4, { w: 1.3, h: 0.8, depth: 0.35, cw: 512, ch: 320 }),
    relay: crt(2.1, 2.2, -19.45, { w: 0.62, h: 0.46, depth: 0.3 }),
    map: crt(-2.7, 1.12, -19.2, { w: 0.6, h: 0.45 }),
    passengers: crt(-0.9, 1.12, -19.2, { w: 0.6, h: 0.45 }),
    status: crt(0.9, 1.12, -19.2, { w: 0.6, h: 0.45 }),
    trail: crt(2.7, 1.12, -19.2, { w: 0.6, h: 0.45 }),
  };
  buildDesk(ctx, M, FX.centralDesk.x, FX.centralDesk.z, 0, { w: 2.6, d: 1.2 });
  const reportPaper = buildPaper(group, FX.report.x, 0.79, FX.report.z, 0.15, 0xc7b88f, [0.26, 0.34]);
  for (let i = 0; i < 4; i++) buildPaper(group, 0.4 + i * 0.15, 0.79 + i * 0.007, -13.1 + (i % 2) * 0.1, i * 0.4, 0xd8d0b8);
  const consoleBox = box(group, 0.8, 0.18, 0.45, M.green, 0.7, 0.88, -13.2);
  void consoleBox;
  buildChair(ctx, M, -0.4, -14.2, Math.PI);
  buildChair(ctx, M, 1.0, -17.8, Math.PI + 0.3);
  buildChair(ctx, M, -2.2, -17.9, 2.4, true);
  // reel-to-reel recorder on a side table
  buildDesk(ctx, M, FX.reel.x, FX.reel.z, 0, { w: 1.4, d: 0.7 });
  const reels = [];
  for (const dx of [-0.2, 0.2]) {
    const r = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.02, 20), new THREE.MeshStandardMaterial({ color: 0x8a8a8a, metalness: 0.6, roughness: 0.4 }));
    r.rotation.x = Math.PI / 2 - 0.3;
    r.position.set(FX.reel.x + dx, 1.13, FX.reel.z - 0.15);
    group.add(r);
    reels.push(r);
  }
  box(group, 0.7, 0.35, 0.2, M.grey, FX.reel.x, 0.96, FX.reel.z - 0.2);
  // wall map of the island with the flight route
  const islandMapTex = canvasTex(512, 384, (c) => {
    c.fillStyle = '#d9cfb2'; c.fillRect(0, 0, 512, 384);
    c.fillStyle = '#8fb3c6'; c.fillRect(0, 0, 512, 384);
    c.fillStyle = '#cbbd92'; c.beginPath(); c.ellipse(270, 200, 150, 120, 0.3, 0, 7); c.fill();
    c.fillStyle = '#7d9a5c'; c.beginPath(); c.ellipse(275, 190, 120, 95, 0.3, 0, 7); c.fill();
    c.strokeStyle = '#1e1a14'; c.lineWidth = 2; c.setLineDash([8, 6]); c.beginPath(); c.moveTo(0, 40); c.lineTo(180, 90); c.stroke();
    c.strokeStyle = '#a3241a'; c.lineWidth = 3; c.beginPath(); c.moveTo(180, 90); c.quadraticCurveTo(240, 200, 250, 300); c.stroke(); c.setLineDash([]);
    c.fillStyle = '#a3241a'; c.font = 'bold 20px monospace'; c.fillText('NV 2207', 30, 30); c.fillText('LZ-2', 262, 318); c.fillText('N-1', 300, 120);
    c.strokeStyle = '#a3241a'; c.lineWidth = 4; c.beginPath(); c.arc(290, 112, 12, 0, 7); c.stroke();
    c.fillStyle = '#1e1a14'; c.font = '16px monospace'; c.fillText('OBSERVATION GRID · SECTOR 4', 20, 370);
    for (let x = 0; x < 512; x += 64) { c.fillStyle = 'rgba(0,0,0,0.15)'; c.fillRect(x, 0, 1, 384); }
    for (let y = 0; y < 384; y += 64) { c.fillStyle = 'rgba(0,0,0,0.15)'; c.fillRect(0, y, 512, 1); }
  });
  sign(islandMapTex, 2.4, 1.8, -7.83, 1.7, FX.islandMap.z, Math.PI / 2);
  const corkTex = canvasTex(512, 384, (c) => {
    c.fillStyle = '#9a7650'; c.fillRect(0, 0, 512, 384);
    const r = (a) => Math.random() * a;
    const photos = [['LZ-2', '#3c4a52'], ['RELAY 04', '#2e3a2e'], ['CAMP', '#3a3428'], ['RIDGE', '#2a2e36'], ['31A', '#5a2a24'], ['?', '#222']];
    photos.forEach(([t, col], i) => {
      const x = 30 + (i % 3) * 160 + r(20), y = 30 + Math.floor(i / 3) * 170 + r(20);
      c.save(); c.translate(x + 60, y + 60); c.rotate((Math.random() - 0.5) * 0.2); c.translate(-x - 60, -y - 60);
      c.fillStyle = '#efe8d6'; c.fillRect(x, y, 130, 130); c.fillStyle = col; c.fillRect(x + 8, y + 8, 114, 96);
      c.fillStyle = '#1e1a14'; c.font = 'bold 16px monospace'; c.fillText(t, x + 10, y + 124);
      c.restore();
      c.fillStyle = '#b02a1e'; c.beginPath(); c.arc(x + 65, y + 6, 6, 0, 7); c.fill();
    });
    c.strokeStyle = '#b02a1e'; c.lineWidth = 2; c.beginPath(); c.moveTo(95, 36); c.lineTo(255, 36); c.lineTo(415, 36); c.moveTo(255, 36); c.lineTo(255, 206); c.stroke();
  });
  sign(corkTex, 2.2, 1.65, 7.83, 1.65, FX.corkboard.z, -Math.PI / 2);
  // backup monitor on a side desk by the east wall: shows the live camera feed during the power failure
  buildDesk(ctx, M, 7.35, FX.backup.z, -Math.PI / 2, { w: 1.4, d: 0.7 });
  const backup = buildCRT(group, M, { w: 0.56, h: 0.42, depth: 0.4 });
  backup.group.position.set(7.35, 1.03, FX.backup.z);
  backup.group.rotation.y = -Math.PI / 2;
  const feed = createFeed(backup, group);
  // the observation room's own camera, high in the south-west corner
  const obsCam = buildCeilingCamera(ctx, M, FX.obsCam, new THREE.Vector3(0, 1, -13));
  await yieldFrame();

  // ---------------------------------------------------------------- archive
  onProgress(0.8, 'The archive');
  buildFilingCabinets(ctx, M, 11, -4.62, 0, 8, { openIndex: 6 });
  buildFilingCabinets(ctx, M, 15.62, 2.4, -Math.PI / 2, 3);
  buildFilingCabinets(ctx, M, 6.32, 2.6, Math.PI / 2, 2);
  const cabinet = buildRestrictedCabinet(ctx, M, FX.cabinet.x, FX.cabinet.z, -Math.PI / 2);
  buildDesk(ctx, M, FX.archTerminal.x, 3.4, Math.PI, { w: 1.6, d: 0.7 });
  const archCRT = buildCRT(group, M, { w: 0.46, h: 0.36, depth: 0.38 });
  archCRT.group.position.set(FX.archTerminal.x, 1.0, 3.5);
  archCRT.group.rotation.y = Math.PI;
  const sticky = new THREE.Mesh(new THREE.PlaneGeometry(0.08, 0.08), new THREE.MeshStandardMaterial({ color: 0xe9d65a, roughness: 0.9 }));
  sticky.position.set(FX.archTerminal.x - 0.26, 1.1, 3.27);
  sticky.rotation.y = Math.PI;
  group.add(sticky);
  for (let i = 0; i < 6; i++) buildPaper(group, 8 + Math.random() * 6, 0.004, -3 + Math.random() * 5, Math.random() * 3, 0xd8d0b8);
  await yieldFrame();

  // ---------------------------------------------------------------- restricted control room
  onProgress(0.9, 'The control room');
  // power distribution cabinet
  const pdTex = canvasTex(256, 320, (c) => {
    c.fillStyle = '#4f5e52'; c.fillRect(0, 0, 256, 320);
    c.fillStyle = '#e8e2d0'; c.fillRect(20, 14, 216, 30); c.fillStyle = '#1e1a14'; c.font = 'bold 18px monospace'; c.fillText('N-1 POWER DIST.', 32, 36);
    for (let i = 0; i < 8; i++) { c.fillStyle = '#1b1b1b'; c.fillRect(30 + (i % 4) * 52, 70 + Math.floor(i / 4) * 120, 36, 80); c.fillStyle = '#c9c4b6'; c.fillRect(40 + (i % 4) * 52, 86 + Math.floor(i / 4) * 120, 16, 24); }
  });
  const pdMat = new THREE.MeshStandardMaterial({ map: pdTex, roughness: 0.7, metalness: 0.2 });
  const pd = box(group, 1.2, 1.6, 0.35, [M.green, M.green, M.green, M.green, pdMat, M.green], FX.powerPanel.x, 1.1, -19.65);
  void pd;
  colliders.push({ type: 'box', x: FX.powerPanel.x, z: -19.65, hw: 0.6, hd: 0.2, rot: 0 });
  buildDesk(ctx, M, FX.lockedTerminal.x, -19.25, 0, { w: 1.6, d: 0.7 });
  const lockCRT = buildCRT(group, M, { w: 0.46, h: 0.36, depth: 0.38 });
  lockCRT.group.position.set(FX.lockedTerminal.x, 1.0, -19.35);
  // the playback deck against the west wall
  const deck = new THREE.Group();
  deck.position.set(-17.45, 0, FX.deck.z);
  deck.rotation.y = Math.PI / 2;
  group.add(deck);
  box(deck, 1.6, 1.0, 0.7, M.grey, 0, 0.5, 0);
  box(deck, 1.6, 0.9, 0.3, M.grey, 0, 1.45, -0.2);
  const deckReels = [-0.4, 0.4].map((dx) => {
    const r = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.025, 24), new THREE.MeshStandardMaterial({ color: 0x9a9a9a, metalness: 0.6, roughness: 0.35 }));
    r.rotation.x = Math.PI / 2;
    r.position.set(dx, 1.5, -0.04);
    deck.add(r);
    return r;
  });
  const deckCRT = buildCRT(deck, M, { w: 0.4, h: 0.3, depth: 0.25 });
  deckCRT.group.position.set(0, 1.06, 0.3);
  deckCRT.group.rotation.x = -0.35;
  const slotMat = new THREE.MeshStandardMaterial({ color: 0x220000, emissive: 0x2a7fff, emissiveIntensity: 0 });
  const slot = box(deck, 0.18, 0.04, 0.05, slotMat, 0.55, 1.0, 0.36);
  void slot;
  colliders.push({ type: 'box', x: -17.45, z: FX.deck.z, hw: 0.4, hd: 0.8, rot: 0 });
  buildChair(ctx, M, -16.3, FX.deck.z + 0.4, -Math.PI / 2);
  await yieldFrame();

  const parts = { M, doors, bulbs, emergency, lights, monGlow, screens, secCRT, archCRT, lockCRT, deckCRT, deckReels, reels, slotMat, backup, feed, cabinet, secCam, obsCam, memoPaper, reportPaper, notePaper, lockers };
  let flickT = 0;
  let power = 'normal'; // normal | out (the moment between main power and emergency) | emergency
  let feedFrame = 0;
  const doorAnims = [];

  const zone = {
    id: 'facility',
    group, colliders, occluders,
    heightAt: () => 0,
    ceiling: H,
    isPlatform: () => false,
    bounds: FBOUNDS,
    deepWater: null,
    cameraFar: 60,
    parts,
    time: () => 'indoor',
    fogDensity: (s) => (s.flags.blackout ? 0.05 : 0.035),
    spawns: {
      fromRidge: { x: FX.spawn.x, z: FX.spawn.z, yaw: Math.PI },
    },
    exits: [{
      to: 'ridge', spawn: 'fromFacility',
      when: () => true,
      test: (x, z) => z > 15.6 && Math.abs(x) < 1.1,
    }],
    trailhead: { x: 0, z: 15 },
    boundaryText: () => 'Concrete. The only way out is the corridor, back up to the door.',
    roomAt: (x, z) => Object.keys(ROOMS).find((id) => inRoom(id, x, z)) || null,
    ambience() { return { sea: 0, forest: 0, stream: 0, indoor: 1, hum: power === 'normal' ? 1 : 0 }; },
    setPower(mode) {
      power = mode;
      const on = mode === 'normal', em = mode === 'emergency';
      lights.forEach((l, i) => { l.color.setHex(on ? LAMP : RED); l.intensity = on ? lightDefs[i].i : em ? lightDefs[i].ei : 0; });
      bulbs.forEach((b) => { b.emissiveIntensity = on ? 2.2 : 0; });
      emergency.forEach((m) => { m.emissiveIntensity = em ? 3 : 0; });
      monGlow.intensity = on ? 1.3 : 0;
    },
    // doors: slide over 0.9 s; the collider is removed once the door is open
    setDoor(id, open, animate = false) {
      const d = doors[id];
      const i = colliders.indexOf(d.col);
      if (!open) { d.setOpen(0); if (i < 0) colliders.push(d.col); return; }
      if (!animate) { d.setOpen(1); if (i >= 0) colliders.splice(i, 1); return; }
      doorAnims.push({ d, t: 0 });
    },
    sync(s) {
      const f = s.flags;
      zone.setPower(f.blackout ? 'emergency' : 'normal');
      for (const [id, flag] of [['observation', 'obsOpened'], ['archive', 'archiveOpened'], ['control', 'controlOpened']]) {
        if (!doorAnims.some((a) => a.d === doors[id])) zone.setDoor(id, !!f[flag]);
      }
      zone.setDoor('sealed', false);
      if (doors.control.ledMat) doors.control.ledMat.emissive.setHex(f.controlReleased ? 0x30ff70 : 0xff2010);
      for (const id of ['observation', 'archive']) doors[id].ledMat.emissive.setHex(f[id === 'observation' ? 'obsOpened' : 'archiveOpened'] ? 0x30ff70 : 0xffaa20);
      cabinet.setOpen(f.archiveAccess ? 1 : 0);
      cabinet.ledMat.emissive.setHex(f.archiveAccess ? 0x30ff70 : 0xff2010);
      cabinet.file.visible = !s.collected.includes('file31a');
      memoPaper.visible = !s.collected.includes('memo');
      reportPaper.visible = !s.collected.includes('passengerReport');
      notePaper.visible = !s.collected.includes('fieldNote');
      slotMat.emissiveIntensity = f.cacheInserted ? 2 : 0;
      zone.drawScreens(s);
      zone.syncInteractables && zone.syncInteractables(s);
    },
    update(dt, t, focus) {
      const f = api.state.flags;
      // a corridor tube that will not settle, a ticking monitor wall
      if (power === 'normal') {
        const k = Math.sin(t * 31) > 0.9 || (t % 8.3) < 0.15 ? 0.25 : 1;
        bulbs[1].emissiveIntensity = 2.2 * k;
        lights[0].intensity = lightDefs[0].i * (0.55 + 0.45 * k);
        monGlow.intensity = 1.3 + Math.sin(t * 7) * 0.08;
      } else if (power === 'emergency') {
        // emergency beacons pulse slowly
        const k = 0.75 + 0.25 * Math.sin(t * 2.4);
        lights.forEach((l, i) => { l.intensity = lightDefs[i].ei * k; });
        emergency.forEach((m) => { m.emissiveIntensity = 3 * k; });
      }
      if ((flickT += dt) > 1) { flickT = 0; zone.drawScreens(api.state, true); }
      // the live feed: rendered from the observation camera while the backup monitor is on
      if (feed.active && focus && inRoom('observation', focus.x, focus.z, 1.5)) {
        if ((feedFrame = (feedFrame + 1) % 2) === 0) feed.render(api.renderer, group.parent, t);
      }
      // ceiling cameras: once the player knows, they follow
      if (f.watchedSeen && focus) { obsCam.track(focus, dt); secCam.track(focus, dt); }
      obsCam.led.emissiveIntensity = f.watchedSeen ? ((t % 1) < 0.5 ? 3 : 0.3) : 0;
      secCam.led.emissiveIntensity = f.watchedSeen ? ((t % 1) < 0.5 ? 3 : 0.3) : 0;
      for (const a of doorAnims) {
        a.t += dt;
        const k = Math.min(1, a.t / 0.9);
        a.d.setOpen(k * k * (3 - 2 * k));
        if (k >= 1) { a.done = true; const i = colliders.indexOf(a.d.col); if (i >= 0) colliders.splice(i, 1); }
      }
      for (let i = doorAnims.length - 1; i >= 0; i--) if (doorAnims[i].done) doorAnims.splice(i, 1);
      zone.tickScreens && zone.tickScreens(dt, t);
    },
  };
  zone.dispose = () => feed.dispose();
  createFacilityInteractions(zone, api);
  return zone;
}

// ---------------------------------------------------------------- a ceiling camera that can turn to follow the player
function buildCeilingCamera(ctx, M, P, lookAt) {
  const g = new THREE.Group();
  g.position.set(P.x, P.y, P.z);
  ctx.group.add(g);
  box(g, 0.05, 0.25, 0.05, M.grey, 0, 0.13, 0);
  const head = new THREE.Group();
  g.add(head);
  box(head, 0.16, 0.16, 0.36, new THREE.MeshStandardMaterial({ color: 0xcfcac0, roughness: 0.6 }), 0, 0, 0.1);
  const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.05, 12), new THREE.MeshStandardMaterial({ color: 0x080808, roughness: 0.2 }));
  lens.rotation.x = Math.PI / 2;
  lens.position.z = 0.3;
  head.add(lens);
  const led = new THREE.MeshStandardMaterial({ color: 0x220000, emissive: 0xff2010, emissiveIntensity: 0 });
  const l = new THREE.Mesh(new THREE.SphereGeometry(0.015, 6, 4), led);
  l.position.set(0.05, 0.05, 0.29);
  head.add(l);
  head.lookAt(lookAt);
  const tmp = new THREE.Vector3(), q = new THREE.Quaternion(), m4 = new THREE.Matrix4(), up = new THREE.Vector3(0, 1, 0);
  return {
    head, led,
    track(focus, dt) {
      tmp.set(focus.x, 1.3, focus.z);
      m4.lookAt(tmp, g.position, up);
      q.setFromRotationMatrix(m4);
      head.quaternion.slerp(q, Math.min(1, dt * 2));
    },
  };
}

// ---------------------------------------------------------------- live feed: a small render target shown on the backup monitor
function createFeed(monitor, group) {
  const rt = new THREE.WebGLRenderTarget(320, 240, { samples: 0 });
  rt.texture.colorSpace = THREE.SRGBColorSpace;
  const cam = new THREE.PerspectiveCamera(60, 320 / 240, 0.1, 40);
  cam.position.set(FX.obsCam.x + 0.3, FX.obsCam.y - 0.1, FX.obsCam.z - 0.3);
  cam.lookAt(4.2, 0.9, -14.6); // the backup desk: whoever looks at the screen is in the shot
  group.add(cam);
  const feedMat = new THREE.MeshBasicMaterial({ map: rt.texture, color: 0xb8ffd0, toneMapped: false });
  const overlayCv = document.createElement('canvas');
  overlayCv.width = 320; overlayCv.height = 240;
  const overlay = new THREE.CanvasTexture(overlayCv);
  overlay.colorSpace = THREE.SRGBColorSpace;
  const overlayMesh = new THREE.Mesh(new THREE.PlaneGeometry(0.56, 0.42), new THREE.MeshBasicMaterial({ map: overlay, transparent: true, depthWrite: false, toneMapped: false }));
  overlayMesh.position.z = 0.035;
  overlayMesh.visible = false;
  monitor.group.add(overlayMesh);
  let lastSec = -1;
  const drawOverlay = (t) => {
    const c = overlayCv.getContext('2d');
    c.clearRect(0, 0, 320, 240);
    c.fillStyle = 'rgba(0,0,0,0.16)';
    for (let y = 0; y < 240; y += 3) c.fillRect(0, y, 320, 1);
    c.fillStyle = '#e8fff0'; c.font = 'bold 15px monospace'; c.fillText('CAM 07 · OBSERVATION', 10, 22);
    c.fillStyle = '#ff3b2a'; c.fillText((t % 1) < 0.5 ? '● LIVE' : '  LIVE', 236, 22);
    const sec = Math.floor(t);
    const hh = String(3 + Math.floor(sec / 3600) % 24).padStart(2, '0'), mm = String(Math.floor(sec / 60) % 60).padStart(2, '0'), ss = String(sec % 60).padStart(2, '0');
    c.fillStyle = '#ffb347'; c.font = '14px monospace'; c.fillText(`REC  ${hh}:${mm}:${ss}`, 10, 228);
    overlay.needsUpdate = true;
  };
  const feed = {
    active: false,
    start() {
      feed.active = true;
      monitor.screen.material = feedMat;
      overlayMesh.visible = true;
    },
    stop() {
      feed.active = false;
      overlayMesh.visible = false;
      monitor.screen.material = monitor.mat;
      monitor.off();
    },
    render(renderer, scene, t) {
      if (!renderer || !scene) return;
      const prev = renderer.getRenderTarget();
      const shadowAuto = renderer.shadowMap.autoUpdate;
      renderer.shadowMap.autoUpdate = false;
      overlayMesh.visible = false;
      monitor.screen.visible = false; // never sample the target while drawing into it
      renderer.setRenderTarget(rt);
      renderer.render(scene, cam);
      renderer.setRenderTarget(prev);
      renderer.shadowMap.autoUpdate = shadowAuto;
      monitor.screen.visible = true;
      overlayMesh.visible = true;
      if (Math.floor(t * 2) !== lastSec) { lastSec = Math.floor(t * 2); drawOverlay(t); }
    },
    dispose() { rt.dispose(); feedMat.dispose(); },
  };
  return feed;
}

export { SCREEN };
