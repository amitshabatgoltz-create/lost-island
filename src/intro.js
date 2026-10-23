// Opening cinematic: night flight cabin -> malfunction -> crash -> black.
import * as THREE from 'three';

export class IntroScene {
  constructor(audio, ui) {
    this.audio = audio;
    this.ui = ui;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x05070b);
    this.scene.fog = new THREE.Fog(0x05070b, 8, 30);
    this.camera = new THREE.PerspectiveCamera(62, innerWidth / innerHeight, 0.05, 80);
    this.build();
    this.t = 0;
    this.running = false;
    this.events = [];
  }

  build() {
    const s = this.scene;
    const R = 2.5, L = 34;
    // cabin shell
    const wallMat = new THREE.MeshStandardMaterial({ color: 0xd9d6cc, roughness: 0.85, side: THREE.BackSide });
    const shell = new THREE.Mesh(new THREE.CylinderGeometry(R, R, L, 36, 1, true), wallMat);
    shell.rotation.x = Math.PI / 2;
    shell.position.y = 1.0;
    s.add(shell);
    const carpet = new THREE.Mesh(new THREE.PlaneGeometry(4.2, L), new THREE.MeshStandardMaterial({ color: 0x2a3550, roughness: 1 }));
    carpet.rotation.x = -Math.PI / 2;
    carpet.position.y = -0.6;
    s.add(carpet);
    const aisle = new THREE.Mesh(new THREE.PlaneGeometry(0.6, L), new THREE.MeshStandardMaterial({ color: 0x5a3a3a, roughness: 1 }));
    aisle.rotation.x = -Math.PI / 2;
    aisle.position.y = -0.595;
    s.add(aisle);

    // seats (instanced): base, back, headrest
    const rows = 18, cols = [-1.55, -1.05, -0.55, 0.55, 1.05, 1.55];
    const n = rows * cols.length;
    const fabric = new THREE.MeshStandardMaterial({ color: 0x3a5f96, roughness: 0.9 });
    const head = new THREE.MeshStandardMaterial({ color: 0xd8d2c2, roughness: 0.9 });
    const baseI = new THREE.InstancedMesh(new THREE.BoxGeometry(0.46, 0.14, 0.5), fabric, n);
    const backI = new THREE.InstancedMesh(new THREE.BoxGeometry(0.46, 0.78, 0.12), fabric, n);
    const headI = new THREE.InstancedMesh(new THREE.BoxGeometry(0.4, 0.2, 0.13), head, n);
    const m = new THREE.Matrix4();
    let i = 0;
    for (let r = 0; r < rows; r++) {
      for (const x of cols) {
        const z = -r * 0.95 + 4;
        m.makeTranslation(x, -0.15, z); baseI.setMatrixAt(i, m);
        m.makeRotationX(-0.12).setPosition(x, 0.3, z + 0.24); backI.setMatrixAt(i, m);
        m.makeRotationX(-0.12).setPosition(x, 0.78, z + 0.3); headI.setMatrixAt(i, m);
        i++;
      }
    }
    s.add(baseI, backI, headI);

    // overhead bins
    const binMat = new THREE.MeshStandardMaterial({ color: 0xeeeae2, roughness: 0.7 });
    for (const side of [-1, 1]) {
      const bin = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.5, L - 2), binMat);
      bin.position.set(side * 1.65, 2.05, -4);
      bin.rotation.z = side * 0.35;
      s.add(bin);
    }
    // ceiling light strip
    this.stripMat = new THREE.MeshStandardMaterial({ color: 0x222222, emissive: 0xffe2b0, emissiveIntensity: 1.2 });
    for (const side of [-1, 1]) {
      const strip = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, L - 4), this.stripMat);
      strip.position.set(side * 1.05, 2.42, -4);
      s.add(strip);
    }
    // emergency floor lights
    this.emMat = new THREE.MeshStandardMaterial({ color: 0x220000, emissive: 0xff2a1a, emissiveIntensity: 0 });
    for (const side of [-1, 1]) {
      const em = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.02, L - 4), this.emMat);
      em.position.set(side * 0.32, -0.58, -4);
      s.add(em);
    }
    // windows
    this.winMat = new THREE.MeshStandardMaterial({ color: 0x0a1020, emissive: 0x1a2a4a, emissiveIntensity: 0.35, roughness: 0.2 });
    const winGeo = new THREE.BoxGeometry(0.06, 0.42, 0.3);
    for (let r = 0; r < rows; r++) {
      for (const side of [-1, 1]) {
        const w = new THREE.Mesh(winGeo, this.winMat);
        w.position.set(side * 2.32, 0.95, -r * 0.95 + 4.2);
        s.add(w);
      }
    }
    // seat-belt sign + oxygen masks
    this.signMat = new THREE.MeshStandardMaterial({ color: 0x111111, emissive: 0xffb000, emissiveIntensity: 0 });
    const sign = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.1, 0.02), this.signMat);
    sign.position.set(0, 2.25, 1.5);
    s.add(sign);
    this.masks = [];
    const maskMat = new THREE.MeshStandardMaterial({ color: 0xf2c230, roughness: 0.7 });
    const tubeMat = new THREE.LineBasicMaterial({ color: 0xdedede });
    for (let r = 0; r < 10; r++) {
      for (const x of [-1.05, 1.05]) {
        const mask = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.1, 10, 1, true), maskMat);
        const top = 2.2;
        mask.position.set(x, top, -r * 0.95 + 3.6);
        const tubeGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(x, top, mask.position.z), new THREE.Vector3(x, top, mask.position.z)]);
        const tube = new THREE.Line(tubeGeo, tubeMat);
        mask.visible = tube.visible = false;
        s.add(mask, tube);
        this.masks.push({ mask, tube, top, drop: 0.9 + Math.random() * 0.4, phase: Math.random() * 6 });
      }
    }
    // passengers (silhouettes in a few seats ahead)
    const pMat = new THREE.MeshStandardMaterial({ color: 0x2b2725, roughness: 0.9 });
    const hairs = [0x1c140f, 0x5a4330, 0x2a2a2a, 0x8a7a60];
    for (let k = 0; k < 22; k++) {
      const r = 1 + Math.floor(Math.random() * 12), x = cols[Math.floor(Math.random() * cols.length)];
      const z = -r * 0.95 + 4;
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 8), new THREE.MeshStandardMaterial({ color: hairs[k % 4], roughness: 0.9 }));
      head.position.set(x, 0.82, z + 0.05);
      const sh = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.3, 0.2), pMat);
      sh.position.set(x, 0.55, z + 0.08);
      s.add(head, sh);
    }

    // lights
    this.ambient = new THREE.AmbientLight(0x8090a0, 0.55);
    s.add(this.ambient);
    this.cabinLights = [];
    for (let k = 0; k < 6; k++) {
      const l = new THREE.PointLight(0xffe0b0, 3.2, 7, 1.6);
      l.position.set(0, 2.1, 3 - k * 3.2);
      s.add(l);
      this.cabinLights.push(l);
    }
    this.redLight = new THREE.PointLight(0xff2010, 0, 14, 1.4);
    this.redLight.position.set(0, 1.5, -3);
    s.add(this.redLight);
    this.flash = new THREE.PointLight(0xbfd8ff, 0, 12, 1.2);
    this.flash.position.set(2.2, 1.0, 0);
    s.add(this.flash);
    this.wingLight = new THREE.PointLight(0xff3030, 0, 4, 2);
    this.wingLight.position.set(2.6, 0.9, 1.5);
    s.add(this.wingLight);
  }

  resize() {
    this.camera.aspect = innerWidth / innerHeight;
    this.camera.updateProjectionMatrix();
  }

  start(onDone) {
    this.onDone = onDone;
    this.t = 0;
    this.running = true;
    this.fired = new Set();
    this.audio.startCabin();
    this.ui.fade(1, 0);
    this.ui.fade(0, 2.2);
  }

  at(time, key, fn) {
    if (this.t >= time && !this.fired.has(key)) { this.fired.add(key); fn(); }
  }

  finish() {
    if (!this.running) return;
    this.running = false;
    this.audio.stopCabin(true);
    this.audio.stopSpeech();
    this.ui.subtitle(null);
    this.onDone && this.onDone();
  }

  update(dt) {
    if (!this.running) return;
    this.t += dt;
    const t = this.t;
    const ui = this.ui, a = this.audio;

    // ---------------- timeline
    this.at(0.3, 'card', () => ui.titleCard('טיסה NV-2207 · 02:14 · מעל האוקיינוס השקט', 'שלוש שעות ליעד. סוף סוף חופשה.'));
    this.at(5.5, 'bump', () => { a.thump(0.25); a.seatbelt(); this.signOn = true; });
    this.at(6.6, 'thought1', () => ui.subtitle('רק עוד כיס אוויר...', 'thought'));
    this.at(9.6, 'jolt', () => { a.thump(0.6); ui.subtitle(null); this.lightning = 1; });
    this.at(11.2, 'pa', () => {
      a.chime(); a.radio(5.5);
      ui.subtitle('“Ladies and gentlemen, this is the captain. We have lost several systems. Return to your seats and fasten your seatbelts — now.”', 'pa', 'גבירותיי ורבותיי, מדבר הקברניט. איבדנו כמה מערכות. חזרו למקומותיכם והדקו חגורות — מיד.');
      setTimeout(() => this.running && a.speak('Ladies and gentlemen, this is the captain. We have lost several systems. Return to your seats and fasten your seatbelts. Now.'), 900);
    });
    this.at(17.2, 'dark', () => { this.emergency = true; a.alarm(5); a.thump(0.5); ui.subtitle(null); this.masksDown = true; });
    this.at(19.4, 'brace', () => {
      ui.subtitle('“BRACE! BRACE! BRACE!”', 'pa', 'התכוננו לפגיעה!');
      a.speak('Brace! Brace! Brace!');
    });
    this.at(22.6, 'impact', () => { a.crash(); ui.flashWhite(); ui.subtitle(null); this.blackout = true; a.stopCabin(true); });
    this.at(24.2, 'ring', () => a.tinnitus(5));
    this.at(25.0, 'dots', () => ui.subtitle('...', 'thought'));
    this.at(28.5, 'end', () => this.finish());

    // ---------------- intensity curves
    const turb = t < 5.5 ? 0.004 : t < 9.6 ? 0.012 : t < 17 ? 0.035 : t < 21 ? 0.07 : 0.16;
    a.cabinIntensity(Math.min(1, turb * 8));
    const shake = turb * (0.6 + 0.4 * Math.sin(t * 31));
    const cam = this.camera;
    const dive = Math.max(0, t - 20.5) * 0.18;
    cam.position.set(0.24 + Math.sin(t * 23.1) * shake, 1.06 + Math.sin(t * 29.7) * shake * 1.3 + Math.sin(t * 0.6) * 0.01, 4.1 + Math.sin(t * 17.3) * shake * 0.5);
    cam.rotation.set(-0.1 - dive * 0.6 + Math.sin(t * 21) * shake * 0.6, -0.12 + Math.sin(t * 0.25) * 0.08, Math.sin(t * 13) * shake * 1.5 + dive * 0.9, 'YXZ');

    // lights
    let lightK = 1;
    if (t > 9.6 && t < 17.2) lightK = Math.random() < 0.15 + (t - 9.6) * 0.03 ? 0.15 : 1;
    if (this.emergency) lightK = Math.random() < 0.06 ? 0.4 : 0.04;
    if (this.blackout) lightK = 0;
    this.cabinLights.forEach((l) => (l.intensity = 3.2 * lightK));
    this.stripMat.emissiveIntensity = 1.2 * lightK;
    this.ambient.intensity = this.blackout ? 0 : 0.15 + 0.4 * lightK;
    this.signMat.emissiveIntensity = this.signOn && !this.blackout ? 2 : 0;
    this.redLight.intensity = this.emergency && !this.blackout ? 3 + Math.sin(t * 9) * 2.5 : 0;
    this.emMat.emissiveIntensity = this.emergency && !this.blackout ? 2.5 : 0;
    this.wingLight.intensity = !this.blackout && (t % 1.6) < 0.12 ? 4 : 0;
    // lightning in the windows
    if (t > 9 && !this.blackout && Math.random() < 0.012) this.lightning = 1;
    this.lightning = (this.lightning || 0) * Math.pow(0.02, dt);
    this.flash.intensity = this.lightning * 18;
    this.winMat.emissiveIntensity = 0.35 + this.lightning * 6;

    // masks
    if (this.masksDown) {
      for (const mk of this.masks) {
        mk.mask.visible = mk.tube.visible = !this.blackout;
        mk.cur = Math.min(mk.drop, (mk.cur || 0) + dt * 3);
        const sway = Math.sin(t * 5 + mk.phase) * 0.08 * (1 + turb * 10);
        mk.mask.position.y = mk.top - mk.cur;
        mk.mask.position.x = mk.tube.geometry.attributes.position.getX(0) + sway;
        const p = mk.tube.geometry.attributes.position;
        p.setXYZ(1, mk.mask.position.x, mk.mask.position.y + 0.05, mk.mask.position.z);
        p.needsUpdate = true;
      }
    }
  }
}
