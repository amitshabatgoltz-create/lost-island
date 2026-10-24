// Part 3 gameplay on the northern ridge: the clues along the trail, the power puzzle (fuse → junction box →
// generator), the badge and the bunker door.
import * as THREE from 'three';
import { createGlint } from '../../items.js';
import { RL, RCABLE, RPRINTS } from './layout.js';
import { heightAt as terrainHeight } from './terrain.js';
import { ITEMS } from '../../data/items.js';
import { addResourceNodes } from '../resources.js';
import { createBadgeMesh, createFuseMesh, createPaperMesh } from './props.js';
import { JUNCTION_WIRES, JUNCTION_RULES, JUNCTION_SOLUTION } from '../../data/puzzles.js';
import { T } from '../../i18n/index.js';

const rot2 = (lx, lz, r) => ({ x: lx * Math.cos(r) + lz * Math.sin(r), z: -lx * Math.sin(r) + lz * Math.cos(r) });
const front = (p, d) => { const o = rot2(0, d, p.rot || 0); return { x: p.x + o.x, z: p.z + o.z }; };

export function createRidgeInteractions(zone, api) {
  const { has } = api;
  const P = zone.parts;
  const list = [];
  const add = (def) => list.push({ radius: 2.0, ...def });
  const flags = () => api.state.flags;
  const powered = () => !!flags().genRunning && !!flags().junctionWired;
  const examine = (id, pos, label, text, radius = 2.0, extra) => add({
    id, kind: 'examine', x: pos.x, z: pos.z, radius,
    available: () => true, label: typeof label === 'function' ? label : () => label,
    use: () => { api.audio.click(); api.thought(typeof text === 'function' ? text() : text, 4.4); extra && extra(); },
  });
  const pickupAt = (mesh, pos, y = 0.02) => {
    mesh.position.set(pos.x, terrainHeight(pos.x, pos.z) + y, pos.z);
    zone.group.add(mesh);
    const glint = createGlint();
    glint.position.set(pos.x, mesh.position.y + 0.6, pos.z);
    zone.group.add(glint);
    return glint;
  };

  // ------------------------------------------------------------------ the tarp camp
  let tapeBusy = false;
  add({
    id: 'recorder', kind: 'examine', x: RL.recorder.x + 0.2, z: RL.recorder.z + 0.8, radius: 1.8,
    available: () => !tapeBusy,
    label: () => (has('fieldRecorder') ? T('Play the field recorder again') : T('Play the field recorder')),
    use: () => {
      tapeBusy = true;
      api.audio.tapeStart();
      api.audio.radioAt(new THREE.Vector3(RL.recorder.x, terrainHeight(RL.recorder.x, RL.recorder.z) + 0.6, RL.recorder.z), 9);
      api.seq.run([
        [0.6, () => api.subtitle('“Day 61. The north door still takes the old badges.”', 'pa', '', 3.6)],
        [4.3, () => api.subtitle('“GEN-2 has blown its main fuse again. Spares are in the crates on the slope.”', 'pa', '', 4.2)],
        [8.6, () => api.subtitle('“I am not going back inside. Not after what the screens showed.”', 'pa', '', 3.8)],
        [12.6, () => {
          tapeBusy = false;
          if (!has('fieldRecorder')) { api.collect('fieldRecorder'); api.thought(T('A badge for the door, a fuse for the generator. Whoever this was, they knew how to get in, and chose not to.'), 5, 0.6); }
          api.persist();
        }],
      ]);
    },
  });
  examine('fieldRadio', front({ ...RL.radio, rot: 0.8 }, 0.6), T('Check the portable radio'), () => {
    api.audio.radioAt(P.camp.radioPos, 2.2);
    return T('A portable radio, still switched on. Weak interference... for a second a steady tone, from the north. Then nothing.');
  }, 1.5);
  examine('sign', front(RL.sign, 1.0), T('Read the sign'), T('“WARNING. RESTRICTED AREA. NIGHTJAR · N-1. NO ENTRY BEYOND THIS POINT.” Someone broke it off its post.'), 2.2);
  examine('trailCamera', { x: RL.camera.x - 0.9, z: RL.camera.z + 0.6 }, T('Look at the camera on the pole'), () => {
    const first = !flags().cameraSeen;
    api.setFlag('cameraSeen');
    api.persist();
    return first ? T('A NIGHTJAR camera, pointed at the trail. The lens is cracked... and a tiny red light under it is blinking. Is it still recording?') : T('The red light is still blinking. It is pointed at me now, not at the trail.');
  }, 2.4);
  examine('disturbed', RL.disturbed, T('Look at the ground'), T('Freshly dug earth over the cable. Someone buried it again, not long ago. The boot prints go on toward the cliff.'), 2.2);
  examine('crateLabel', front(RL.crate, -0.9), T('Read the crate label'), T('“NIGHTJAR · N-1 · SPARES · ELECTRICAL.” Burst open on the rocks. Straw everywhere.'), 1.6);

  // ------------------------------------------------------------------ pickups: badge, fuse, map fragment
  const badge = createBadgeMesh();
  badge.rotation.y = 0.7;
  const badgeGlint = pickupAt(badge, RL.badge, 0.02);
  add({
    id: 'badge', kind: 'pickup', obj: badge, glint: badgeGlint, x: RL.badge.x, z: RL.badge.z, radius: 1.7,
    available: () => !has('badge'),
    visible: () => !has('badge'),
    label: () => T`Pick up: ${ITEMS.badge.name}`,
    use: () => { if (api.collect('badge')) api.thought(T('A NIGHTJAR badge. “FIELD STATION N-1 · LEVEL 2.” The photo has been torn off.'), 4.6, 0.6); },
  });
  const fuse = createFuseMesh();
  fuse.rotation.z = Math.PI / 2;
  fuse.position.copy(P.crate.top);
  zone.group.add(fuse);
  const fuseGlint = createGlint();
  fuseGlint.position.set(P.crate.top.x, P.crate.top.y + 0.6, P.crate.top.z);
  zone.group.add(fuseGlint);
  const crateFront = front(RL.crate, 1.0);
  add({
    id: 'fuse', kind: 'pickup', obj: fuse, glint: fuseGlint, x: crateFront.x, z: crateFront.z, radius: 1.9,
    available: () => !has('fuse') && !flags().fuseInstalled,
    visible: () => !has('fuse') && !flags().fuseInstalled,
    label: () => T`Pick up: ${ITEMS.fuse.name}`,
    use: () => { if (api.collect('fuse')) api.thought(T('“GEN-2 · MAIN · 40 A.” A spare fuse, still in its packing.'), 4, 0.6); },
  });
  const paper = createPaperMesh();
  paper.rotation.y = 0.4;
  const paperGlint = pickupAt(paper, RL.fragment, 0.03);
  add({
    id: 'mapFragment', kind: 'pickup', obj: paper, glint: paperGlint, x: RL.fragment.x, z: RL.fragment.z, radius: 1.7,
    available: () => !has('mapFragment'),
    visible: () => !has('mapFragment'),
    label: () => T('Pick up the paper in the mud'),
    use: () => { if (api.collect('mapFragment')) api.thought(T('The torn edge fits my booklet map exactly. The missing north part: this valley, and “N-1” drawn into the cliff.'), 5.2, 0.6); },
  });

  // ------------------------------------------------------------------ power: junction box
  const jFront = front(RL.junction, 0.9);
  add({
    id: 'junction', kind: 'machine', x: jFront.x, z: jFront.z, radius: 1.7,
    available: () => true,
    label: () => (flags().junctionWired ? T('Check the junction box') : flags().junctionSeen ? T('Reconnect the wires') : T('Open the junction box')),
    use: () => {
      if (flags().junctionWired) { api.audio.click(); api.thought(powered() ? T('All four wires in place. The light is green.') : T('Wired. But no power is coming from the generator yet.'), 3.5); return; }
      if (!flags().junctionSeen) {
        api.setFlag('junctionSeen');
        api.audio.latch();
        zone.sync(api.state);
        api.persist();
        api.thought(T('Four wires pulled out of their terminals. There is a label inside the cover.'), 4, 0.3);
      }
      api.openWiring({
        title: T('Junction box · GEN-2 feed'),
        cardTitle: T('Label inside the cover'),
        wires: JUNCTION_WIRES,
        rules: JUNCTION_RULES,
        check(assign) {
          const ok = Object.entries(JUNCTION_SOLUTION).every(([w, t]) => assign[w] === t);
          if (!ok) { api.audio.spark(); return false; }
          api.setFlag('junctionWired');
          if (flags().genRunning) api.audio.powerUp(); else api.audio.latch();
          zone.sync(api.state);
          api.persist();
          api.thought(flags().genRunning ? T('Power flows to the door. The panel by the door lights up.') : T('Wired. Now the generator has to run.'), 4, 0.9);
          api.checkQuests();
          return true;
        },
      });
    },
  });

  // ------------------------------------------------------------------ power: the generator
  const gFront = front(RL.shed, 0.9);
  let starting = false;
  add({
    id: 'generator', kind: 'machine', x: gFront.x, z: gFront.z, radius: 2.0,
    available: () => !starting,
    label: () => {
      const f = flags();
      if (!f.fuseInstalled) return has('fuse') ? T('Insert the main fuse') : T('Check the generator');
      return f.genRunning ? T('Check the generator') : T('Start the generator');
    },
    use: () => {
      const f = flags();
      if (!f.fuseInstalled) {
        if (!has('fuse')) {
          api.audio.click();
          api.setFlag('genSeen');
          api.persist();
          api.refresh();
          api.thought(T('GEN-2. Diesel, and the tank is not empty. But the main fuse holder is empty: “MAIN FUSE 40 A”.'), 4.8);
          return;
        }
        api.setFlag('genSeen');
        api.setFlag('fuseInstalled');
        api.player.playPickup();
        api.audio.latch();
        zone.sync(api.state);
        api.refresh();
        api.persist();
        api.thought(T('The fuse clicks into the holder. Now: the starter.'), 3.6, 0.6);
        api.checkQuests();
        return;
      }
      if (f.genRunning) { api.audio.click(); api.thought(powered() ? T('GEN-2 is running. The door has power.') : T('Running. But the power does not reach the door. Something between here and the door is disconnected.'), 4); return; }
      starting = true;
      api.audio.generatorStart();
      api.seq.run([
        [0.4, () => api.thought(T('Pull... again...'), 1.6)],
        [1.8, () => {
          starting = false;
          api.setFlag('genRunning');
          startEngine();
          zone.sync(api.state);
          api.persist();
          if (powered()) { api.audio.powerUp(); api.thought(T('It runs! And by the door, an amber light starts turning.'), 4.2, 0.4); }
          else api.thought(T('It runs. But the door is still dark. Something between here and the door is cut off.'), 4.6, 0.4);
          api.checkQuests();
        }],
      ]);
    },
  });
  let stopEngine = null;
  function startEngine() {
    if (stopEngine) return;
    stopEngine = api.audio.engineAt(new THREE.Vector3(RL.generator.x, terrainHeight(RL.generator.x, RL.generator.z) + 0.8, RL.generator.z));
  }
  zone.dispose = () => { if (stopEngine) { stopEngine(); stopEngine = null; } };

  // ------------------------------------------------------------------ the access panel and the door
  let denyT = null;
  add({
    id: 'accessPanel', kind: 'machine', x: RL.panel.x + 0.1, z: RL.panel.z + 0.9, radius: 1.6,
    available: () => !flags().doorOpen,
    label: () => (!powered() ? T('Check the access panel') : has('badge') ? T('Swipe the badge') : T('Use the access panel')),
    use: () => {
      if (!powered()) {
        api.audio.click();
        api.setFlag('panelSeen');
        api.persist();
        api.refresh();
        api.thought(flags().genRunning || flags().fuseInstalled
          ? T('Still dead. The power is not getting through to the door.')
          : T('Dead. The label says “FEED: GEN-2”. A thinner cable runs from the panel along the rock, to the east.'), 4.6);
        return;
      }
      if (!has('badge')) {
        api.audio.deny();
        P.panel.draw('denied');
        clearTimeout(denyT);
        denyT = setTimeout(() => { if (!flags().doorOpen) P.panel.draw('ready'); }, 2600);
        api.thought(T('“ACCESS DENIED. BADGE REQUIRED.” I need a NIGHTJAR badge.'), 4);
        return;
      }
      api.setFlag('doorOpen');
      api.persist();
      P.panel.draw('granted');
      api.audio.heavyDoor();
      api.thought(T('ACCESS GRANTED. The whole cliff seems to shudder.'), 3.4, 0.3);
      zone.openDoor(() => {
        zone.sync(api.state);
        api.checkQuests();
      });
    },
  });

  // ------------------------------------------------------------------ scavenged resources
  list.push(...addResourceNodes(zone, api, terrainHeight));

  // ------------------------------------------------------------------ sync + per-frame triggers
  zone.interactables = list;
  zone.syncInteractables = (s) => {
    for (const it of list) {
      if (it.obj && it.visible) it.obj.visible = it.visible();
      if (it.glint) it.glint.visible = it.available();
    }
    if (s.flags.genRunning) startEngine();
  };

  const doorPos = new THREE.Vector3(RL.door.x, 0, RL.door.z);
  const camHead = P.camera.head;
  const camWorld = new THREE.Vector3(RL.camera.x, terrainHeight(RL.camera.x, RL.camera.z) + 3.0, RL.camera.z);
  let radioT = 4;
  zone.tick = (dt, t, player) => {
    const s = api.state, f = s.flags;
    const px = player.pos.x, pz = player.pos.z;
    if (!f.reachedRidge) {
      api.setFlag('reachedRidge');
      api.persist();
      api.thought(T('Out of the trees. A valley, climbing to a mountain. And on the cliff top: the red light.'), 4.8, 1.2);
      api.checkQuests();
    }
    if (!f.cableSeen && pz < RCABLE[0][1] - 6) {
      api.setFlag('cableSeen');
      api.thought(T('A thick black cable, half sunk in the mud. It runs north, along the trail.'), 4);
    }
    const [bx, bz] = RPRINTS[0];
    if (!f.printsNorth && Math.hypot(px - bx, pz - bz) < 5) {
      api.setFlag('printsNorth');
      api.thought(T('Boot prints. Fresh, made tonight. Going north.'), 3.6);
    }
    if (!f.entranceFound && Math.hypot(px - doorPos.x, pz - doorPos.z) < 13) {
      api.setFlag('entranceFound');
      api.audio.sting();
      api.lookToward(doorPos, 0.9);
      api.thought(T('A door. A steel door, built into the rock, and the NIGHTJAR symbol above it.'), 4.6, 0.4);
      api.persist();
      api.checkQuests();
    }
    // the radio at the camp keeps picking up a weak carrier
    if (Math.hypot(px - RL.radio.x, pz - RL.radio.z) < 12 && (radioT -= dt) < 0) {
      radioT = 9 + Math.random() * 8;
      api.audio.radioAt(P.camp.radioPos, 1.2);
    }
    // once noticed, the trail camera turns to follow the player
    P.camera.ledMat.emissiveIntensity = f.cameraSeen && (t % 1.2) < 0.25 ? 3 : 0;
    if (f.cameraSeen && Math.hypot(px - RL.camera.x, pz - RL.camera.z) < 18) {
      const want = Math.atan2(px - camWorld.x, pz - camWorld.z);
      const cur = camHead.rotation.y;
      let d = want - cur;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      camHead.rotation.set(0.25, cur + d * Math.min(1, dt * 1.5), 0.35, 'YXZ');
    }
  };
  zone.onEnter = (from) => {
    if (from === 'facility') api.thought(T('Fresh air. The red light still blinks above the cliff.'), 3.4, 1.0);
  };
}
