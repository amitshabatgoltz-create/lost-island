// Part 2 gameplay in the forest: transmitter, power cell, camp, locker code, observation post,
// tension events, the scripted encounter and the ending cinematic.
import * as THREE from 'three';
import { createGlint } from '../../items.js';
import { createPowerCellMesh } from './props.js';
import { FL, PRINTS } from './layout.js';
import { heightAt as terrainHeight } from './terrain.js';
import { ITEMS } from '../../data/items.js';
import { addResourceNodes } from '../resources.js';
import { CARVINGS, CRATE_CODE, SYMBOLS, symbolName, WIRES, WIRING_RULES, WIRING_SOLUTION, TUNE, LOCKER_CODE } from '../../data/puzzles.js';
import { T } from '../../i18n/index.js';
const rot2 = (lx, lz, r) => ({ x: lx * Math.cos(r) + lz * Math.sin(r), z: -lx * Math.sin(r) + lz * Math.cos(r) });
const front = (p, d) => { const o = rot2(0, d, p.rot || 0); return { x: p.x + o.x, z: p.z + o.z }; };

export function createForestInteractions(zone, api) {
  const { has } = api;
  const P = zone.parts;
  const list = [];
  const add = (def) => list.push({ radius: 2.2, ...def });
  const flags = () => api.state.flags;
  const q = () => api.state.questIndex;
  const examine = (id, pos, label, text, radius = 2.0, extra) => add({
    id, kind: 'examine', x: pos.x, z: pos.z, radius,
    available: () => true, label: () => label,
    use: () => { api.audio.click(); api.thought(typeof text === 'function' ? text() : text, 4.2); extra && extra(); },
  });

  // ------------------------------------------------------------------ transmitter (cell → wiring → tuning)
  const tFront = front(FL.transmitter, 1.15);
  let busy = false;
  add({
    id: 'transmitter', kind: 'machine', x: tFront.x, z: tFront.z, radius: 2.3,
    available: () => !busy,
    label: () => {
      const f = flags();
      if (!f.powerInstalled) {
        if (f.wired) return T('Tune the frequency');
        if (f.cellInserted) return T('Open the wiring panel');
        return has('powerCell') ? T('Insert the power cell') : T('Check the transmitter');
      }
      if (q() === 14) return T('Listen to the broadcast');
      return T('Check the transmitter');
    },
    use: () => {
      const f = flags();
      if (!f.powerInstalled) {
        if (f.wired) return openTuning();
        if (f.cellInserted) return openWiring();
        if (has('powerCell')) return insertCell();
        api.audio.click();
        api.setFlag('transmitterInspected');
        api.thought(T('The transmitter is dead. The power cell slot is empty and its door is open. On the panel: RELAY 04. And in the mud around it: tracks.'), 5.5);
        return;
      }
      if (q() === 14) return startEnding();
      api.audio.click();
      api.thought(f.endingSeen ? T('The transmitter is silent. The display reads LINK: LOST.') : T('The transmitter hums on 417.9. Nobody answers.'), 3.5);
    },
  });

  function insertCell() {
    api.setFlag('cellInserted');
    api.player.playPickup();
    api.audio.latch();
    zone.sync(api.state);
    api.refresh();
    api.persist();
    api.thought(T('The cell clicks into place. Nothing. Behind the panel: four loose wires.'), 4.5, 0.6);
  }

  function openWiring() {
    // saves from before this update may hold the cell without the card that came with it
    if (!has('serviceCard')) api.collect('serviceCard', { silent: true });
    api.openWiring({
      wires: WIRES,
      rules: has('serviceCard') ? WIRING_RULES : null,
      check(assign) {
        const ok = Object.entries(WIRING_SOLUTION).every(([w, t]) => assign[w] === t);
        if (!ok) { api.audio.spark(); return false; }
        api.setFlag('wired');
        api.audio.powerUp();
        zone.sync(api.state);
        api.refresh();
        api.persist();
        api.thought(T('The screen lights up. Only static. It is searching for something.'), 4, 0.8);
        return true;
      },
    });
  }

  function openTuning() {
    api.openTuning({
      ...TUNE,
      onLocked() {
        busy = true;
        api.setFlag('powerInstalled');
        api.persist();
        api.seq.run([
          [0.2, () => { zone.sync(api.state); api.audio.signalBeeps(); }],
          [1.0, () => api.audio.radio(4.5)],
          [1.3, () => api.subtitle('“...Nightjar relay... no civilian contact... observer remains on the ridge... [static]”', 'pa', '', 5)],
          [2.6, () => { api.collect('radioLog'); }],
          [6.6, () => { busy = false; api.thought(T('The transmitter printed its log. And it broadcast something about a camp.'), 4.5); api.checkQuests(); }],
        ]);
      },
    });
  }

  // ------------------------------------------------------------------ supply drop: symbol padlock, power cell, service card
  const cellMesh = createPowerCellMesh();
  cellMesh.position.copy(P.supply.top);
  cellMesh.rotation.y = 0.8;
  zone.group.add(cellMesh);
  const cellGlint = createGlint();
  cellGlint.position.set(P.supply.top.x, P.supply.top.y + 0.6, P.supply.top.z);
  zone.group.add(cellGlint);
  const crateOpen = () => !!flags().crateOpen || has('powerCell');
  add({
    id: 'powerCell', kind: 'pickup', obj: cellMesh, glint: cellGlint, x: FL.powerCell.x, z: FL.powerCell.z, radius: 2.0,
    available: () => crateOpen() && !has('powerCell') && !flags().powerInstalled,
    visible: () => crateOpen() && !has('powerCell') && !flags().powerInstalled,
    label: () => T`Pick up: ${ITEMS.powerCell.name}`,
    use: () => { if (api.collect('powerCell')) api.thought(T('48 volts, with the same symbol. Someone took it out of the transmitter and locked it in here.'), 4.5, 0.6); },
  });
  let lockTries = 0;
  add({
    id: 'supplyDrop', kind: 'container', x: FL.powerCell.x, z: FL.powerCell.z, radius: 2.0,
    available: () => !crateOpen(),
    label: () => T('Lock with three symbols'),
    use: () => {
      if (!flags().crateSeen) { api.setFlag('crateSeen'); api.thought(T('An air-dropped supply crate. Locked with a three-wheel lock: symbols on each wheel, not numbers.'), 4.5); }
      api.openSymbolLock({
        symbols: SYMBOLS,
        size: CRATE_CODE.length,
        check(code) {
          if (code.every((c, i) => c === CRATE_CODE[i])) {
            api.setFlag('crateOpen');
            api.audio.unlock();
            zone.sync(api.state);
            api.collect('serviceCard', { silent: true });
            api.thought(T('Open. Inside: the power cell, and a service card for the transmitter.'), 4, 0.5);
            api.persist();
            return true;
          }
          lockTries++;
          api.audio.deny();
          if (lockTries === 3) api.thought(T('These are not random symbols. I saw symbols like these on the way here.'), 3.5);
          return false;
        },
      });
    },
  });

  // carvings on trees along the boot prints
  for (const c of CARVINGS) {
    add({
      id: c.id, kind: 'examine', x: c.look.x, z: c.look.z, radius: 2.0,
      available: () => true,
      label: () => T('Examine the mark in the bark'),
      use: () => {
        api.audio.click();
        const notch = ['', T('one notch'), T('two notches'), T('three notches')][c.notches];
        api.thought(T`Someone carved into the bark: a ${symbolName(c.symbol).toLowerCase()}. And under it, ${notch}.`, 4);
        if (!flags()[c.id]) {
          api.setFlag(c.id);
          if (!has('carvings')) api.collect('carvings', { silent: true });
          else api.toast(T('Booklet updated: carved symbols'), 'item', 2.5);
          api.persist();
        }
      },
    });
  }

  // ------------------------------------------------------------------ camp
  const tentFront = front(FL.tent, 2.3);
  add({
    id: 'tent', kind: 'examine', x: tentFront.x, z: tentFront.z, radius: 2.4,
    available: () => true,
    label: () => T('Check the tent'),
    use: () => {
      api.audio.click();
      api.thought(T('The fabric is torn from the inside, not the outside. A sleeping bag, and one boot. Just one.'), 4.5);
      if (!flags().tentSeen) { api.setFlag('tentSeen'); api.checkQuests(); }
    },
  });
  add({
    id: 'cabinMap', kind: 'examine', x: P.cabin.spots.map.x, z: P.cabin.spots.map.z, radius: 1.5,
    available: () => true,
    label: () => (has('campMap') ? T('Look at the map') : T('Take the map off the wall')),
    use: () => {
      if (!has('campMap')) {
        api.collect('campMap');
        api.thought(T('A map of the forest. And at the edge, a red X on the beach, exactly where the plane went down. “LZ-2”.'), 5, 0.5);
      } else api.thought(T('LZ-2. They marked the landing spot before it happened.'), 3.5);
      if (!flags().cabinSeen) { api.setFlag('cabinSeen'); api.checkQuests(); }
    },
  });
  add({
    id: 'calendar', kind: 'examine', x: P.cabin.spots.calendar.x, z: P.cabin.spots.calendar.z, radius: 1.3,
    available: () => true,
    label: () => T('Examine the calendar'),
    use: () => {
      api.audio.click();
      api.thought(T('September. Two days circled in red: 14, “APPROVED”. And 23, “ARRIVAL · LZ-2”.'), 4.8);
      if (!has('calendar')) api.collect('calendar', { silent: true });
    },
  });
  examine('cabinDesk', P.cabin.spots.desk, T('Check the desk in the hut'), T('A moldy coffee cup and pages of numbers. Whoever lived here left in a hurry: the chair is still knocked over.'), 1.4);
  examine('cabinShelf', P.cabin.spots.shelf, T('Check the shelf'), T('Jars of soil and water samples, labeled with dates. The last one: September 22. The day before the flight.'), 1.4);
  const tableFront = front(FL.table, 1.15);
  add({
    id: 'table', kind: 'examine', x: tableFront.x, z: tableFront.z, radius: 1.9,
    available: () => true,
    label: () => (has('photo') ? T('Check the papers') : T('Check the papers and photos')),
    use: () => {
      if (!has('photo')) {
        api.collect('photo');
        api.thought(T('Photos of the island, from the sea. In one of them, someone stands by the mast. On the back: “N. — first week. All according to plan.”'), 5.5, 0.5);
      } else api.thought(T('“Subject intake: see protocol 3.” The rest is blacked out.'), 3.5);
      if (!flags().tableSeen) { api.setFlag('tableSeen'); api.checkQuests(); }
    },
  });
  examine('campRadio', { x: P.table.radioPos.x, z: P.table.radioPos.z }, T('Check the radio'), T('A handheld radio tuned to 417.9. The battery is warm. Someone held it not long ago.'), 1.2);
  examine('crates', FL.crates, T('Check the equipment crates'), T('Equipment crates with the same symbol and “NJ · FIELD 04”. Empty. Someone cleared them out before leaving.'), 2.2);
  examine('generator', FL.generator, T('Check the generator'), T('A stripped generator. The parts were not broken, they were removed carefully, one by one.'), 2.0);
  examine('dish', FL.dish, T('Check the satellite dish'), T('The dish points south. Not at the sky, at the sea. Toward where we came from.'), 2.0);

  // ------------------------------------------------------------------ locker (code = relay frequency)
  const lockerFront = front(FL.locker, 0.95);
  let attempts = 0;
  let lidAnim = false;
  add({
    id: 'locker', kind: 'container', x: lockerFront.x, z: lockerFront.z, radius: 1.7,
    available: () => !flags().lockerOpen && !lidAnim,
    label: () => T('Enter the locker code'),
    use: () => {
      if (!flags().lockerHint) { api.setFlag('lockerHint'); api.thought(T('Stenciled on the lid: “ACCESS: APPROVAL / ARRIVAL”.'), 4.5); }
      api.openKeypad({
        title: T('Locked locker · ACCESS: APPROVAL / ARRIVAL'),
        length: 4,
        onSubmit: (code) => {
          if (code === LOCKER_CODE) { openLocker(); return true; }
          attempts++;
          api.audio.deny();
          if (attempts === 3) api.thought(T('APPROVAL, ARRIVAL. Two moments. Four digits... two numbers of two digits each?'), 4.5);
          return false;
        },
      });
    },
  });
  function openLocker() {
    api.setFlag('lockerOpen');
    lidAnim = true;
    api.audio.unlock();
    P.locker.ledMat.emissive.setHex(0x3cff88);
    api.animate(1.1, (k) => { P.locker.lidPivot.rotation.x = -k * k * (3 - 2 * k) * 1.9; }, () => {
      lidAnim = false;
      api.thought(T('Inside: a folder with the symbol, and a muddy shift sheet.'), 4);
      api.checkQuests();
    });
    api.checkQuests();
    api.persist();
  }
  const docPos = front(FL.locker, 0.95);
  for (const [id, mesh] of [['researchDoc', P.locker.docA], ['schedule', P.locker.docB]]) {
    add({
      id, kind: 'pickup', obj: mesh, x: docPos.x, z: docPos.z, radius: 1.7,
      available: () => flags().lockerOpen && !lidAnim && !has(id),
      visible: () => !has(id),
      label: () => T`Pick up: ${ITEMS[id].name}`,
      use: () => {
        api.collect(id);
        if (id === 'researchDoc') api.thought(T('“Subjects.” “Unplanned descent.” They call the crash an entry.'), 4.5, 0.5);
        if (id === 'schedule') api.thought(T('An observer on the east ridge. “23/9 · 02:41 — contact.” One minute after we crashed.'), 4.5, 0.5);
      },
    });
  }

  // ------------------------------------------------------------------ observation post
  const chartGlint = createGlint();
  chartGlint.position.set(FL.routeChart.x, terrainHeight(FL.routeChart.x, FL.routeChart.z) + 1.9, FL.routeChart.z);
  zone.group.add(chartGlint);
  add({
    id: 'routeChart', kind: 'pickup', obj: P.post.chart, glint: chartGlint, x: FL.routeChart.x + 0.6, z: FL.routeChart.z + 0.8, radius: 1.9,
    available: () => q() >= 13 && !has('routeChart'),
    visible: () => !has('routeChart'),
    label: () => T`Pick up: ${ITEMS.routeChart.name}`,
    use: () => { api.collect('routeChart'); startEncounter(); },
  });
  add({
    id: 'postBoard', kind: 'examine', x: FL.routeChart.x + 0.6, z: FL.routeChart.z + 0.8, radius: 1.9,
    available: () => q() < 13 && !has('routeChart'),
    label: () => T('Check the board'),
    use: () => { api.audio.click(); api.thought(T('A flight chart pinned to the board. First I need to understand what they did at the camp.'), 3.8); },
  });
  examine('scope', FL.scope, T('Look through the binoculars'), T('The binoculars point south, at the beach. Exactly where I woke up.'), 1.6);

  // spotting scope at the camp: pan across the forest and find the lens glint on the ridge
  const SC = FL.campScope;
  add({
    id: 'campScope', kind: 'machine', x: SC.x - 1.0, z: SC.z - 0.3, radius: 1.6,
    available: () => true,
    label: () => T('Use the binoculars'),
    use: () => {
      const eye = new THREE.Vector3(SC.x, terrainHeight(SC.x, SC.z) + 1.45, SC.z);
      api.openScope({
        eye,
        yaw: 2.15,
        pitch: 0.04,
        glint: P.postGlint,
        found: !!flags().postSpotted,
        onFound() {
          if (flags().postSpotted) return;
          api.setFlag('postSpotted');
          api.audio.sting();
          api.thought(T('A glint. On the east ridge, above the cliff: a lens. Someone set something up there.'), 4.5);
          api.persist();
        },
      });
    },
  });

  // ------------------------------------------------------------------ scripted encounter
  let encounter = null;
  const fig = P.figure;
  // on the plateau edge, ~12 m from the post, then off the cliff into the dark
  const figStart = new THREE.Vector3(64, 0, -30);
  const figEnd = new THREE.Vector3(53, 0, -22);
  let figMove = null;
  function startEncounter() {
    if (encounter) return;
    encounter = api.seq.run([
      [0.6, () => api.thought(T('Someone sat here and watched the crash. From here.'), 3.2)],
      [3.4, () => api.audio.branchSnap(figStart)],
      [3.7, () => api.flickerFlashlight(1.6)],
      [3.9, () => {
        figStart.y = terrainHeight(figStart.x, figStart.z);
        fig.position.copy(figStart);
        fig.lookAt(api.player.pos.x, figStart.y, api.player.pos.z);
        fig.visible = true;
        api.lookToward(figStart, 0.7);
        api.audio.sting();
      }],
      [5.5, () => { figMove = { t: 0, dur: 1.3 }; api.audio.footstepsRun(figStart, figEnd, 1.3); }],
      [6.9, () => { fig.visible = false; figMove = null; api.thought(T('Who\'s there?!'), 2.4); }],
      [10.2, () => {
        api.audio.radio(2.5);
        api.audio.signalBeeps();
        api.toast(T('The radio in the transmitter woke up. Someone is calling it.'), 'warn', 4.5);
        api.setFlag('encounterDone');
        encounter = null;
        api.checkQuests();
        zone.sync(api.state);
        api.persist();
      }],
    ]);
  }

  // ------------------------------------------------------------------ ending
  function startEnding() {
    const TX = FL.transmitter;
    const base = terrainHeight(TX.x, TX.z);
    const camPos = new THREE.Vector3(TX.x + Math.sin(TX.rot) * 4.2 + 1.2, base + 1.8, TX.z + Math.cos(TX.rot) * 4.2 + 1.6);
    const lookCab = new THREE.Vector3(TX.x, base + 1.2, TX.z);
    const lookMast = P.transmitter.top.clone();
    const lights = FL.farLights.map(([x, z]) => new THREE.Vector3(x, terrainHeight(x, z) + 7, z));
    const lookFar = lights.reduce((a, b) => a.add(b), new THREE.Vector3()).multiplyScalar(1 / lights.length);
    let t0 = null;
    const ease = (k) => k * k * (3 - 2 * k);
    api.beginCinematic((camera, t) => {
      if (t0 === null) t0 = t;
      const e = t - t0;
      const look = new THREE.Vector3();
      if (e < 8.6) look.copy(lookCab);
      else if (e < 9.8) look.lerpVectors(lookCab, lookMast, ease((e - 8.6) / 1.2));
      else if (e < 11.5) look.lerpVectors(lookMast, lookFar, ease((e - 9.8) / 1.7));
      else look.copy(lookFar);
      const pos = camPos.clone();
      pos.y += Math.min(1.2, Math.max(0, e - 9) * 0.4);
      camera.position.copy(pos);
      camera.lookAt(look);
    });
    P.transmitter.setScreen('call');
    api.audio.radio(8);
    const steps = [
      [1.0, () => {
        api.subtitle('“We know you survived.”', 'pa', '', 3.4);
        api.audio.speak('We know you survived. Do not trust anyone coming to the island.', { pitch: 0.55, rate: 0.82 });
      }],
      [4.5, () => api.subtitle('“Do not trust anyone coming to the island.”', 'pa', '', 3.8)],
      [8.6, () => { api.audio.spark(); P.transmitter.setRed('off'); P.transmitter.setScreen('dead'); }],
      [10.4, () => { zone.setNewSignal(true); api.audio.signalBeeps(); }],
    ];
    lights.forEach((_, i) => steps.push([11.6 + i * 0.55, () => { zone.setFarLights(i + 1); api.audio.lightOn(i); }]));
    steps.push([16.4, () => api.showFinalEntry()]);
    steps.push([16.8, () => api.collect('stillHere', { silent: true })]);
    steps.push([22.5, () => {
      api.hideFinalEntry();
      api.setFlag('endingSeen');
      api.checkQuests();
      zone.sync(api.state);
      api.persist();
      api.endCinematic();
      api.showEndcard(2);
    }]);
    api.seq.run(steps);
  }

  // ------------------------------------------------------------------ scavenged resources
  list.push(...addResourceNodes(zone, api, terrainHeight));

  // ------------------------------------------------------------------ sync + per-frame triggers
  zone.interactables = list;
  zone.syncInteractables = (s) => {
    for (const it of list) {
      if (it.obj && it.visible) it.obj.visible = it.visible();
      if (it.glint) it.glint.visible = it.available();
    }
    if (!lidAnim) P.locker.lidPivot.rotation.x = s.flags.lockerOpen ? -1.9 : 0;
    P.locker.ledMat.emissive.setHex(s.flags.lockerOpen ? 0x3cff88 : 0xff3020);
  };

  let noiseT = 18, campRadioRun = false;
  const TX = FL.transmitter;
  zone.tick = (dt, t, player) => {
    const s = api.state, f = s.flags;
    const px = player.pos.x, pz = player.pos.z;
    const dT = Math.hypot(px - TX.x, pz - TX.z);
    if (!f.reachedTransmitter && dT < 13) {
      api.setFlag('reachedTransmitter');
      api.thought(T('The transmitter. Someone built it here, in the middle of the forest, and it is dead.'), 4);
      api.checkQuests();
    }
    // brief movement between the trees on the way to the signal
    if (!f.figure1 && s.questIndex >= 7 && dT < 42 && dT > 18) {
      api.setFlag('figure1');
      const fw = player.forward();
      const rt = new THREE.Vector3(-fw.z, 0, fw.x);
      const a = new THREE.Vector3(px, 0, pz).addScaledVector(fw, 24).addScaledVector(rt, -5);
      const b = a.clone().addScaledVector(rt, 9);
      a.y = terrainHeight(a.x, a.z); b.y = terrainHeight(b.x, b.z);
      fig.position.copy(a);
      fig.visible = true;
      figMove = { t: 0, dur: 1.1, from: a, to: b };
      api.audio.branchSnap(a);
      api.seq.after(1.15, () => { fig.visible = false; figMove = null; api.thought(T('...was someone there? Between the trees.'), 3); });
    }
    // the camp radio wakes up on its own
    if (!f.campRadio && !campRadioRun && Math.hypot(px - FL.camp.x, pz - FL.camp.z) < 16) {
      campRadioRun = true;
      P.table.radioLedMat.emissiveIntensity = 3;
      api.audio.radioAt(P.table.radioPos, 5);
      api.subtitle('“...camp, this is ridge... movement at L-Z two... say again...”', 'pa', '', 4.8);
      api.seq.after(5, () => { P.table.radioLedMat.emissiveIntensity = 0; api.setFlag('campRadio'); campRadioRun = false; api.thought(T('The radio on the table. It turned on by itself.'), 3); });
    }
    // footprint hints
    const [sx, sz] = PRINTS.toPower[0];
    if (!f.printsPower && s.questIndex === 8 && Math.hypot(px - sx, pz - sz) < 7) {
      api.setFlag('printsPower');
      api.thought(T('Boot prints in the mud. They lead west from the transmitter.'), 3.5);
    }
    const [rx, rz] = PRINTS.toRidge[0];
    if (!f.printsRidge && s.questIndex >= 12 && Math.hypot(px - rx, pz - rz) < 6) {
      api.setFlag('printsRidge');
      api.thought(T('Fresh tracks. Someone walked east from the camp toward the ridge, tonight.'), 3.8);
    }
    const [ux, uz] = PRINTS.stray[0];
    if (!f.printsStray && Math.hypot(px - ux, pz - uz) < 5) {
      api.setFlag('printsStray');
      api.thought(T('These tracks go straight to the edge of the cliff... and vanish.'), 3.8);
    }
    // a scripted encounter interrupted by a reload restarts
    if (has('routeChart') && !f.encounterDone && !encounter) startEncounter();
    // distant noises
    if ((noiseT -= dt) < 0) {
      noiseT = 22 + Math.random() * 26;
      const a = Math.random() * Math.PI * 2, d = 35 + Math.random() * 30;
      api.audio.distantNoise(new THREE.Vector3(px + Math.cos(a) * d, player.pos.y + 2, pz + Math.sin(a) * d));
    }
    // figure animation
    if (fig.visible && figMove) {
      figMove.t += dt;
      const k = Math.min(1, figMove.t / figMove.dur);
      const from = figMove.from || figStart, to = figMove.to || figEnd;
      fig.position.lerpVectors(from, to, k);
      fig.position.y = terrainHeight(fig.position.x, fig.position.z) + Math.abs(Math.sin(figMove.t * 14)) * 0.06;
      fig.lookAt(to.x, fig.position.y, to.z);
    }
  };
}
