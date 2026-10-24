// Part 3 gameplay inside N-1: documents, doors and badge readers, the monitor wall, the archive terminal
// (window code), the restricted cabinet, the playback deck, the power failure, the live feed and the finale.
import * as THREE from 'three';
import { FX, DOORS } from './layout.js';
import { SCREEN } from './props.js';
import { ARCHIVE_CODE } from '../../data/puzzles.js';

export function createFacilityInteractions(zone, api) {
  const { has } = api;
  const P = zone.parts;
  const S = P.screens;
  const list = [];
  const add = (def) => list.push({ radius: 1.5, ...def });
  const flags = () => api.state.flags;
  const q = () => api.state.questIndex;
  const examine = (id, pos, label, text, radius = 1.5, extra) => add({
    id, kind: 'examine', x: pos.x, z: pos.z, radius,
    available: () => true, label: typeof label === 'function' ? label : () => label,
    use: () => { api.audio.click(); api.thought(typeof text === 'function' ? text() : text, 4.6); extra && extra(); },
  });
  // pick up a document: it goes into the booklet and opens for reading
  const takeDoc = (id, pos, label, radius, after) => add({
    id, kind: 'pickup', x: pos.x, z: pos.z, radius,
    available: () => !has(id) && (!pos.when || pos.when()),
    label: () => label,
    use: () => {
      if (!api.collect(id, { silent: false })) return;
      api.readDocument(id, { onClose: () => { after && after(); api.checkQuests(); } });
    },
  });
  // open a facility screen as a readable panel
  const terminal = (title, html, onClose) => api.openTerminal({ title, html, onClose });

  // ------------------------------------------------------------------ checkpoint
  takeDoc('memo', { x: FX.memo.x + 0.05, z: -1.55 }, 'Take the memo from the desk', 1.15, () => api.thought('“Anomalous conditions.” So that is why nobody has come looking for us.', 4.4, 0.4));
  add({
    id: 'secTerminal', kind: 'machine', x: FX.desk.x + 0.75, z: -1.5, radius: 1.15,
    available: () => true,
    label: () => 'Use the security terminal',
    use: () => {
      api.audio.click();
      const f = flags();
      terminal('Security terminal · N-1', `<h4>SECURITY STATUS</h4><table>
        <tr><td>MAIN ENTRANCE</td><td class="warn">OPEN · BADGE L2 · 0 MIN AGO</td></tr>
        <tr><td>OBSERVATION</td><td>${f.obsOpened ? '<span class="warn">OPEN</span>' : 'LOCKED · L2'}</td></tr>
        <tr><td>RECORDS</td><td>${f.archiveOpened ? '<span class="warn">OPEN</span>' : 'LOCKED · L2'}</td></tr>
        <tr><td>CONTROL</td><td>${f.controlReleased ? '<span class="warn">RELEASED</span>' : 'LOCKED · L4'}</td></tr>
        <tr><td>B-2 LOWER LEVEL</td><td class="alert">SEALED</td></tr>
        <tr><td>POWER</td><td>${f.blackout ? '<span class="alert">MAIN TRIPPED · EMERGENCY</span>' : 'MAIN · GEN-2 EXTERNAL'}</td></tr>
        <tr><td>CAMERAS</td><td>7 OF 9 ACTIVE</td></tr>
        <tr><td>REMOTE SESSION</td><td class="dim">${f.watchedSeen ? '<span class="alert">ACTIVE</span>' : '—'}</td></tr>
        </table><p class="dim">The entrance log shows my badge. It noticed me the second I walked in.</p>`);
    },
  });
  takeDoc('fieldNote', { x: -4.6, z: -1.2 }, 'Search the open locker', 1.2, () => api.thought('A dark raincoat. Like the one in the photo from the camp. But no face, and no name. Just “N.”', 4.8, 0.4));
  examine('lockers', { x: -3.1, z: -1.2 }, 'Check the lockers', () => (has('fieldNote') ? 'Empty lockers, and the raincoat. Whoever wore it left in a hurry, or did not need it anymore.' : 'Locked lockers. Names scratched off the tags. One at the end is standing open.'), 1.0);
  examine('sealedDoor', { x: -5.25, z: DOORS.sealed.c }, 'Look at the sealed door', () => (flags().chapter3Done
    ? 'Silent now. The bars are still there. Something on the other side knocked, three times.'
    : '“B-2 LOWER LEVEL. SEALED BY ORDER.” Steel bars welded across it. The paint on the bars is scratched... from the other side.'), 1.4);

  // ------------------------------------------------------------------ badge doors
  const badgeDoor = (id, flag, pos, name) => add({
    id: id + 'Door', kind: 'machine', x: pos.x, z: pos.z, radius: 1.4,
    available: () => !flags()[flag],
    label: () => `Swipe the badge (${name})`,
    use: () => {
      if (!has('badge')) { api.audio.deny(); api.thought('A badge reader. I need a NIGHTJAR badge.', 3.4); return; }
      api.setFlag(flag);
      api.audio.unlock();
      api.audio.slideDoor();
      zone.setDoor(id, true, true);
      zone.sync(api.state);
      api.persist();
      api.refresh();
    },
  });
  badgeDoor('observation', 'obsOpened', { x: 1.6, z: -5.3 }, 'OBSERVATION');
  badgeDoor('archive', 'archiveOpened', { x: 5.3, z: -1.0 }, 'RECORDS');
  add({
    id: 'controlDoor', kind: 'machine', x: -7.3, z: DOORS.control.c + 1.5, radius: 1.4,
    available: () => !flags().controlOpened,
    label: () => (flags().controlReleased ? 'Open the control room' : 'Swipe the badge (CONTROL)'),
    use: () => {
      if (!flags().controlReleased) {
        api.audio.deny();
        api.thought('“LEVEL 4.” My badge is only level 2. Something else has to release this door.', 4);
        return;
      }
      api.setFlag('controlOpened');
      api.audio.unlock();
      api.audio.slideDoor();
      zone.setDoor('control', true, true);
      zone.sync(api.state);
      api.persist();
    },
  });

  // ------------------------------------------------------------------ observation room
  add({
    id: 'monitorWall', kind: 'machine', x: 0, z: -17.95, radius: 1.9,
    available: () => !finale,
    label: () => {
      const f = flags();
      if (f.watchedSeen && !f.chapter3Done) return 'Play the new recording';
      return 'Look at the monitor wall';
    },
    use: () => {
      const f = flags();
      if (f.watchedSeen && !f.chapter3Done) return startFinale();
      if (f.chapter3Done) { api.audio.click(); api.thought('Dark. Every screen. But the camera in the corner is still watching.', 4); return; }
      if (f.blackout) { api.audio.click(); api.thought('All dead... except one small screen, on the east side of the room.', 4); return; }
      api.audio.click();
      terminal('Monitor wall · observation room', `<h4>CAM 01 · LZ-2 BEACH</h4><p>Last frame 02:41, 23/09. The wreck on the sand.</p>
        <h4>NIGHTJAR SYSTEM</h4><p>RESTRICTED · STANDBY. “Subject records: see central desk.”</p>
        <h4>CAM 05 · RELAY 04</h4><p>Last frame: the transmitter clearing, tonight. Someone by the mast.</p>
        <h4>FACILITY MAP</h4><p>Checkpoint · Observation · Records · Control (L4) · B-2 lower level: <span class="alert">SEALED</span></p>
        <h4>PASSENGER RECORDS</h4><p>NV 2207 · 23 SEP · CLASSIFIED: 12 · SEAT 31A: <span class="warn">RESTRICTED</span></p>
        <h4>SECURITY</h4><p>MAIN ENTRANCE OPEN · BADGE L2</p>
        <h4>CAM 03 · NORTH TRAIL</h4><p>The trail with the lamps. The camera on the pole.</p>
        <p class="dim">They watched everything. The beach, the transmitter, the trail. Every place I have been.</p>`,
      () => { if (!flags().monitorsSeen) { api.setFlag('monitorsSeen'); api.persist(); api.checkQuests(); } });
    },
  });
  takeDoc('passengerReport', { x: FX.report.x, z: -12.05 }, 'Take the report from the desk', 1.3, () => api.thought('They sorted us before we sat down. And seat 31A has its own restricted file. The records room...', 4.6, 0.4));
  examine('centralDesk', { x: 1.1, z: -12.05 }, 'Check the console', 'A console with switches for every camera. Most are labeled with places I have been. One is labeled “B-2”.', 1.0);
  examine('reel', { x: FX.reel.x, z: FX.reel.z + 0.9 }, 'Look at the tape recorder', 'An old reel-to-reel recorder. The tape is labeled “NV 2207 / 23 SEP / CABIN AUDIO”. Cabin audio. They recorded inside our plane.', 1.3);
  examine('islandMap', { x: -7.0, z: FX.islandMap.z }, 'Look at the wall map', 'A map of the island. The flight route comes in from the north-west, and a red line bends it down to LZ-2. N-1 is circled.', 1.6);
  examine('corkboard', { x: 7.0, z: FX.corkboard.z }, 'Look at the board', 'Photos pinned with red string: the beach, the relay, the camp, the ridge. One card says “31A”. The last card has only a question mark.', 1.6);
  add({
    id: 'backup', kind: 'machine', x: 6.3, z: FX.backup.z, radius: 1.5,
    available: () => !watching,
    label: () => (flags().blackout ? 'Look at the screen' : 'Check the small monitor'),
    use: () => {
      const f = flags();
      if (!f.blackout) { api.audio.click(); api.thought('A small spare monitor. Switched off. Its cable goes into the wall, not into the console.', 4); return; }
      if (!f.watchedSeen) return startWatched();
      api.audio.click();
      api.thought('CAM 07. Live. Me, looking at a screen that shows me looking at a screen.', 4);
    },
  });

  // ------------------------------------------------------------------ archive
  takeDoc('discrepancies', { x: 12.25, z: -3.45 }, 'Take the file from the open drawer', 1.25, () => api.thought('Arrival dates that have not happened yet. Some of them years from now.', 4.4, 0.4));
  let codeTries = 0;
  add({
    id: 'archTerminal', kind: 'machine', x: FX.archTerminal.x, z: 2.45, radius: 1.5,
    available: () => true,
    label: () => (flags().archiveAccess ? 'Use the archive terminal' : 'Use the archive terminal'),
    use: () => {
      api.audio.click();
      if (flags().archiveAccess) {
        terminal('Archive terminal', `<h4>NIGHTJAR ARCHIVE</h4><p>ACCESS GRANTED.</p><p>RESTRICTED CABINET R-1: <span class="warn">RELEASED</span></p><p>CONTROL (L4): <span class="warn">RELEASED</span></p><p class="dim">Restricted recording: transferred to control, playback deck.</p>`);
        return;
      }
      api.setFlag('archiveTried');
      const { body, close } = terminal('Archive terminal', `<h4>NIGHTJAR ARCHIVE · RESTRICTED</h4>
        <p>ACCESS REQUIRES WINDOW CODE.</p><p>FORMAT: <b>DDHHMM</b> (day, hour, minute)</p>
        <p class="dim">A yellow sticky note on the screen: “window code = the day they arrive + the time the window opens. DON'T write it down. — E.”</p>
        <div class="dev-row"><button class="btn primary" id="arch-enter">Enter the code</button></div>`);
      body.querySelector('#arch-enter').onclick = () => {
        close();
        api.openKeypad({
          title: 'Archive terminal · WINDOW CODE (DDHHMM)',
          length: 6,
          onSubmit: (code) => {
            if (code === ARCHIVE_CODE) { grantArchive(); return true; }
            codeTries++;
            api.audio.deny();
            if (codeTries === 2) api.thought('Day, hour, minute. Which day did we arrive? And when did the “window” open?', 4.4);
            if (codeTries === 4) api.thought('The calendar at the camp: ARRIVAL, the 23rd. The passenger report: the window opened at 02:40.', 5);
            return false;
          },
        });
      };
    },
  });
  function grantArchive() {
    api.setFlag('archiveAccess');
    api.setFlag('controlReleased');
    api.audio.unlock();
    api.persist();
    setTimeout(() => {
      zone.sync(api.state);
      api.thought('ACCESS GRANTED. Behind me, a lock clicks open: the red cabinet. And somewhere further, another door.', 5);
      api.checkQuests();
    }, 700);
  }
  add({
    id: 'cabinet', kind: 'pickup', x: FX.cabinet.x - 0.85, z: FX.cabinet.z, radius: 1.3,
    available: () => !has('file31a'),
    label: () => (flags().archiveAccess ? 'Take the file from the cabinet' : 'Check the red cabinet'),
    use: () => {
      if (!flags().archiveAccess) { api.audio.deny(); api.thought('Locked. “RESTRICTED — TERMINAL RELEASE ONLY.”', 3.6); return; }
      if (!api.collect('file31a')) return;
      zone.sync(api.state);
      api.readDocument('file31a', { onClose: () => { api.thought('OBSERVER. The empty seat next to mine, and the person who watched us from the ridge. The same word.', 5, 0.4); api.checkQuests(); } });
    },
  });

  // ------------------------------------------------------------------ control room
  examine('powerPanel', { x: FX.powerPanel.x, z: -18.85 }, 'Check the power panel', () => (flags().blackout
    ? '“MAIN: TRIPPED — REMOTE COMMAND.” Remote. Nobody touched this panel. Someone switched the power off from somewhere else.'
    : 'N-1 power distribution. Every breaker is on, fed from GEN-2 outside. One label is handwritten: “SECONDARY ROOM”.'), 1.4);
  add({
    id: 'lockedTerminal', kind: 'machine', x: FX.lockedTerminal.x, z: -18.45, radius: 1.3,
    available: () => true,
    label: () => 'Use the terminal',
    use: () => {
      api.audio.click();
      terminal('Control terminal · L4', `<h4>NIGHTJAR CONTROL · LEVEL 4</h4><p class="alert">LOCKED</p><p>REMOTE SESSION ACTIVE</p><p>USER: ██████ · ORIGIN: SECONDARY ROOM</p><p class="dim">Someone else is logged in to this terminal. Right now.</p>`);
    },
  });

  // ------------------------------------------------------------------ the playback deck: the restricted recording
  const PART1 = [
    'Observation log.',
    'Flight NV 2207 has entered the designated observation window.',
    'Passenger classifications have been confirmed.',
    'The observer designation remains restricted.',
    'If the subject reaches the facility, do not initiate direct contact.',
    'Repeat: do not initiate direct contact.',
  ];
  const PART2 = [
    '[secondary input · CACHE / TAIL]',
    '...the subject\'s arrival at N-1 is anticipated.',
    'Observation continues from the secondary room.',
    'Phase 3 begins when the subject—',
  ];
  let playback = null;
  add({
    id: 'deck', kind: 'machine', x: -16.55, z: FX.deck.z, radius: 1.5,
    available: () => !blackoutRun,
    label: () => (flags().recordingDone ? 'Check the playback deck' : 'Use the playback deck'),
    use: () => openDeck(),
  });
  function openDeck() {
    api.audio.click();
    const f = flags();
    if (f.recordingDone) { api.thought('The tape stopped in the middle of a word. “Phase 3 begins when the subject—”', 4); return; }
    const { body, close } = terminal('Playback deck · control room', `<h4>RESTRICTED RECORDING · NJ-OBS-2207</h4>
      <div class="lines" id="pb-lines"><p class="dim">Reel loaded. Primary input.</p></div>
      <div class="bar"><i id="pb-bar"></i></div>
      <div id="pb-status" class="dim"></div>
      <div class="dev-row"><button class="btn primary" id="pb-play">▶ Play</button><button class="btn ghost" id="pb-insert">Insert the memory device</button></div>`,
    () => { if (playback) { playback.cancel(); playback = null; api.audio.stopSpeech(); } });
    const $ = (id) => body.querySelector(id);
    const render = () => {
      const g = flags();
      $('#pb-insert').style.display = g.recordingPart1 && !g.cacheInserted ? '' : 'none';
      $('#pb-play').textContent = g.cacheInserted ? '▶ Play secondary input' : g.recordingPart1 ? '▶ Play again' : '▶ Play';
      $('#pb-status').innerHTML = g.cacheInserted ? 'SECONDARY INPUT: CACHE / TAIL · 1 FILE'
        : g.recordingPart1 ? '<span class="warn">DATA ERROR · RECORDING TRUNCATED · REMAINING DATA ON SECONDARY INPUT (CACHE)</span>' : 'PRIMARY INPUT';
    };
    render();
    $('#pb-insert').onclick = () => {
      if (!has('device')) { api.audio.deny(); $('#pb-status').textContent = 'NO DEVICE.'; return; }
      api.setFlag('cacheInserted');
      api.audio.latch();
      zone.sync(api.state);
      api.persist();
      render();
      api.thought('The memory device from the beach. “CACHE / TAIL”... it fits. A blue light. It was made for this deck.', 4.8);
    };
    $('#pb-play').onclick = () => {
      if (playback) return;
      const second = !!flags().cacheInserted;
      const lines = second ? PART2 : PART1;
      const box = $('#pb-lines');
      box.innerHTML = '';
      $('#pb-play').disabled = true;
      api.audio.tapeStart();
      api.audio.radio(lines.length * 3.1);
      api.audio.speak(lines.filter((l) => !l.startsWith('[')).join(' '), { pitch: 0.6, rate: 0.85 });
      P.deckReels.forEach((r) => (r.userData.spin = true));
      const steps = lines.map((l, i) => [0.4 + i * 3.1, () => {
        const p = document.createElement('p');
        p.textContent = l.startsWith('[') ? l : `“${l}”`;
        if (l.startsWith('[')) p.className = 'dim';
        box.appendChild(p);
        const bar = $('#pb-bar');
        if (bar) bar.style.width = `${Math.round(((i + 1) / lines.length) * (second ? 100 : 62))}%`;
      }]);
      steps.push([0.4 + lines.length * 3.1, () => {
        playback = null;
        P.deckReels.forEach((r) => (r.userData.spin = false));
        api.audio.stopSpeech();
        if (!second) {
          api.audio.spark();
          api.setFlag('recordingPart1');
          api.persist();
          api.refresh();
          render();
          $('#pb-play').disabled = false;
          api.thought('It stops. Cut off. “Remaining data on secondary input”... a cache.', 4.4);
        } else {
          api.setFlag('recordingDone');
          api.persist();
          $('#pb-status').innerHTML = '<span class="alert">END OF DATA</span>';
          api.collect('recording', { silent: true });
          setTimeout(() => { close(); startBlackout(); }, 1400);
        }
      }]);
      playback = api.seq.run(steps);
    };
  }

  // ------------------------------------------------------------------ the power failure
  let blackoutRun = false;
  let quiet = false;
  const baseAmbience = zone.ambience;
  zone.ambience = (p) => { const a = baseAmbience(p); if (quiet && a.hum) a.hum = 0.35; return a; };
  function startBlackout() {
    if (blackoutRun || flags().blackout) return;
    blackoutRun = true;
    api.seq.run([
      [0.6, () => { quiet = true; api.thought('...Silence. Even the ventilation sounds different.', 3.4); }],
      [2.4, () => { P.lockCRT.draw((c, w, h) => { c.fillStyle = '#000'; c.fillRect(0, 0, w, h); for (let i = 0; i < 1500; i++) { c.fillStyle = `rgba(200,255,220,${Math.random() * 0.6})`; c.fillRect(Math.random() * w, Math.random() * h, 2, 1); } }); api.audio.spark(); }],
      [3.0, () => P.deckCRT.off()],
      [3.6, () => { quiet = false; zone.setPower('out'); api.audio.powerDown(); api.flickerFlashlight(0.5); }],
      [5.4, () => {
        api.setFlag('blackout');
        api.audio.emergencyOn();
        zone.sync(api.state);
        api.persist();
        api.thought(api.player.flashlightOn ? 'Emergency lights. The flashlight still works.' : 'Emergency lights. I need the flashlight. (F)', 3.8);
      }],
      [8.0, () => {
        api.audio.monitorOn();
        api.thought('A click, somewhere behind me. A screen just came on. In the observation room.', 4.4);
        blackoutRun = false;
        api.checkQuests();
      }],
    ]);
  }

  // ------------------------------------------------------------------ the live feed
  let watching = false;
  const obsCamPos = new THREE.Vector3(FX.obsCam.x, 0, FX.obsCam.z);
  function startWatched() {
    watching = true;
    api.audio.click();
    // a close look at the small screen: the room, live, from the corner camera
    const screen = new THREE.Vector3(7.35, 1.03, FX.backup.z);
    api.beginCinematic((camera, t) => {
      camera.position.set(6.3, 1.32, FX.backup.z + 0.2 + Math.sin(t * 0.5) * 0.02);
      camera.lookAt(screen);
    });
    api.seq.run([
      [0.2, () => api.thought('The observation room. This room. Live... that is me, standing at this desk.', 4.4)],
      [2.0, () => api.audio.sting()],
      [4.4, () => { api.endCinematic(); api.setFlag('watchedSeen'); api.persist(); api.lookToward(obsCamPos, 0.9); }],
      [5.0, () => api.thought('The camera in the corner. Its red light is on... and it is turning with me.', 4.6)],
      [9.4, () => { watching = false; api.checkQuests(); zone.sync(api.state); }],
    ]);
  }

  // ------------------------------------------------------------------ the finale: OBSERVATION ACTIVE
  let finale = false;
  function startFinale() {
    finale = true;
    const look = new THREE.Vector3(0, 2.05, -19.4);
    const camPos = new THREE.Vector3(0.35, 1.65, -15.6);
    api.player.setPosition(-0.95, -17.5, Math.PI); // step aside so the survivor does not block the shot
    const sealed = new THREE.Vector3(DOORS.sealed.at, 1.2, DOORS.sealed.c);
    let t0 = null;
    api.beginCinematic((camera, t) => {
      if (t0 === null) t0 = t;
      const e = t - t0;
      camera.position.copy(camPos);
      camera.position.z -= Math.min(1.1, e * 0.08);
      camera.position.x += Math.sin(e * 0.4) * 0.03;
      camera.lookAt(look);
    });
    finaleScreen = 'active';
    zone.drawScreens(api.state, true);
    api.audio.monitorOn();
    api.seq.run([
      [3.0, () => { finaleScreen = 'playing'; zone.drawScreens(api.state, true); api.audio.radio(4); }],
      [3.6, () => {
        api.subtitle('“If you can hear this, they\'ve already found you.”', 'pa', '', 4.2);
        api.audio.speak('If you can hear this, they\'ve already found you.', { pitch: 0.7, rate: 0.82 });
      }],
      [8.6, () => api.audio.distantNoise(new THREE.Vector3(-4, -6, -6))],
      [9.6, () => { api.audio.thump(0.7); api.flickerFlashlight(0.4); }],
      [11.2, () => api.audio.knock(sealed, 3)],
      [13.4, () => { finaleScreen = 'off'; api.audio.spark(); zone.drawScreens(api.state, true); }],
      [15.0, () => { api.audio.page(); api.ui.showFinalEntry('Someone has been watching.'); }],
      [15.4, () => api.collect('phase3', { silent: true })],
      [21.0, () => {
        api.hideFinalEntry();
        api.setFlag('chapter3Done');
        finale = false;
        finaleScreen = null;
        api.checkQuests();
        zone.sync(api.state);
        api.persist();
        api.endCinematic();
        api.showEndcard(3);
      }],
    ]);
  }
  let finaleScreen = null;

  // ------------------------------------------------------------------ screens
  const still = {
    beach: (c, w, h) => { c.fillStyle = '#1b2a2a'; c.fillRect(0, h * 0.55, w, h); c.fillStyle = '#2b3c3a'; c.fillRect(0, h * 0.72, w, h); c.fillStyle = '#a9b8b0'; c.beginPath(); c.ellipse(w * 0.5, h * 0.66, w * 0.28, 12, -0.08, 0, 7); c.fill(); c.fillRect(w * 0.7, h * 0.48, 10, 40); },
    relay: (c, w, h) => { c.fillStyle = '#16221a'; c.fillRect(0, h * 0.6, w, h); c.strokeStyle = '#8fa89a'; c.lineWidth = 3; c.beginPath(); c.moveTo(w * 0.55, h * 0.62); c.lineTo(w * 0.58, h * 0.15); c.lineTo(w * 0.61, h * 0.62); c.stroke(); c.fillStyle = '#ff5544'; c.beginPath(); c.arc(w * 0.58, h * 0.14, 4, 0, 7); c.fill(); c.fillStyle = '#0c120e'; c.fillRect(w * 0.3, h * 0.45, 9, 34); c.beginPath(); c.arc(w * 0.3 + 4.5, h * 0.43, 6, 0, 7); c.fill(); },
    trail: (c, w, h) => { c.fillStyle = '#121c16'; c.fillRect(0, 0, w, h); c.fillStyle = '#2a2a20'; c.beginPath(); c.moveTo(w * 0.42, h); c.lineTo(w * 0.5, h * 0.45); c.lineTo(w * 0.56, h * 0.45); c.lineTo(w * 0.7, h); c.fill(); for (const [x, y] of [[0.3, 0.5], [0.66, 0.42], [0.45, 0.3]]) { const g = c.createRadialGradient(w * x, h * y, 0, w * x, h * y, 18); g.addColorStop(0, 'rgba(255,220,160,0.9)'); g.addColorStop(1, 'rgba(255,220,160,0)'); c.fillStyle = g; c.fillRect(0, 0, w, h); } },
  };
  zone.drawScreens = (s, tickOnly = false) => {
    const f = s.flags, t = performance.now() / 1000;
    const blink = Math.floor(t * 2) % 2 === 0;
    const dark = f.blackout;
    // monitor wall
    if (dark) {
      for (const k of ['beach', 'relay', 'map', 'passengers', 'status', 'trail']) S[k].off();
    } else if (!tickOnly) {
      S.beach.on(); S.beach.draw((c, w, h) => SCREEN.still(c, w, h, 'CAM 01 · LZ-2', 'LAST FRAME 02:41 23/09', still.beach));
      S.relay.on(); S.relay.draw((c, w, h) => SCREEN.still(c, w, h, 'CAM 05 · RELAY 04', 'LAST FRAME 23:58 TONIGHT', still.relay));
      S.trail.on(); S.trail.draw((c, w, h) => SCREEN.still(c, w, h, 'CAM 03 · NORTH TRAIL', 'LAST FRAME 00:37 TONIGHT', still.trail));
      S.map.on(); S.map.draw((c, w, h) => SCREEN.text(c, w, h, 'N-1 FACILITY', ['CHECKPOINT', 'OBSERVATION', 'RECORDS', 'CONTROL  · L4', '!B-2 LOWER  · SEALED'], { size: 16 }));
      S.passengers.on(); S.passengers.draw((c, w, h) => SCREEN.text(c, w, h, 'NV 2207 · 23 SEP', ['PASSENGERS ...... 214', 'CLASSIFIED ...... 12', 'SURVIVORS ....... ?', '!SEAT 31A: RESTRICTED'], { size: 16 }));
      S.status.on(); S.status.draw((c, w, h) => SCREEN.text(c, w, h, 'SECURITY', ['ENTRANCE · OPEN', 'BADGE L2 · ACCEPTED', 'CAMERAS · 7/9', `!${f.archiveAccess ? 'ARCHIVE · ACCESSED' : 'ARCHIVE · LOCKED'}`], { size: 16 }));
    }
    // the main screen
    const main = S.main;
    if (finaleScreen === 'off' || (f.chapter3Done && !finaleScreen)) main.off();
    else if (finaleScreen || (f.watchedSeen && !f.chapter3Done)) {
      main.on(1.2);
      main.draw((c, w, h) => {
        c.fillStyle = '#04100a'; c.fillRect(0, 0, w, h);
        c.fillStyle = '#c8ffd9'; c.font = 'bold 30px monospace'; c.fillText('NIGHTJAR SYSTEM', 26, 52);
        c.fillRect(26, 64, w - 52, 2);
        c.fillStyle = '#8ef0b0'; c.font = 'bold 26px monospace'; c.fillText('SUBJECT 31A', 26, 112);
        c.fillStyle = '#ff7a6a'; c.fillText('OBSERVATION ACTIVE', 26, 152);
        c.fillStyle = '#ffb347'; c.font = 'bold 21px monospace';
        if (finaleScreen === 'playing') c.fillText('▶ PLAYING NEW RECORDING', 26, 210);
        else if (blink || finaleScreen) c.fillText('A NEW RECORDING HAS BEEN DETECTED', 26, 210);
        c.fillStyle = '#4f9a6b'; c.font = '17px monospace'; c.fillText(finaleScreen ? '' : 'PRESS TO PLAY', 26, 260);
      });
    } else if (dark) main.off();
    else if (!tickOnly) {
      main.on();
      main.draw((c, w, h) => SCREEN.text(c, w, h, 'NIGHTJAR SYSTEM', ['RESTRICTED', 'STANDBY', '', 'SUBJECT RECORDS: CENTRAL DESK'], { size: 22 }));
    }
    if (tickOnly) return;
    // single terminals
    if (dark) { P.secCRT.off(); P.archCRT.off(); P.lockCRT.off(); P.deckCRT.off(); }
    else {
      P.secCRT.on(); P.secCRT.draw((c, w, h) => SCREEN.text(c, w, h, 'SECURITY · N-1', ['ENTRANCE OPEN', 'BADGE L2', '0 MIN AGO'], { size: 18 }));
      P.archCRT.on(); P.archCRT.draw((c, w, h) => SCREEN.text(c, w, h, 'ARCHIVE', f.archiveAccess ? ['ACCESS GRANTED', '!R-1 RELEASED', '!CONTROL RELEASED'] : ['WINDOW CODE', 'DDHHMM', '_ _ _ _ _ _'], { size: 18 }));
      P.lockCRT.on(); P.lockCRT.draw((c, w, h) => SCREEN.text(c, w, h, 'CONTROL · L4', ['LOCKED', '!REMOTE SESSION', '!ACTIVE'], { size: 18 }));
      P.deckCRT.on(); P.deckCRT.draw((c, w, h) => SCREEN.text(c, w, h, 'PLAYBACK', f.recordingDone ? ['END OF DATA'] : f.cacheInserted ? ['SECONDARY', 'CACHE / TAIL'] : f.recordingPart1 ? ['!DATA ERROR', '!SEE SECONDARY'] : ['NJ-OBS-2207', 'READY'], { size: 18 }));
    }
    // the backup monitor: the live feed while the main power is out
    if (dark && !P.feed.active) P.feed.start();
    if (!dark && P.feed.active) P.feed.stop();
    if (!dark) P.backup.off();
  };
  zone.tickScreens = (dt) => {
    for (const r of P.deckReels) if (r.userData.spin) r.rotation.y += dt * 3;
  };

  // ------------------------------------------------------------------ sync + per-frame triggers
  zone.interactables = list;
  zone.syncInteractables = () => {};
  let noiseT = 20;
  const seen = {};
  zone.tick = (dt, t, player) => {
    const f = flags();
    const px = player.pos.x, pz = player.pos.z;
    if (!f.enteredFacility) {
      api.setFlag('enteredFacility');
      api.persist();
      api.thought('Cold air, old paint, dust... and the lights are on. Somebody keeps this place running.', 4.8, 1.0);
      api.checkQuests();
    }
    const room = zone.roomAt(px, pz);
    if (room && !seen[room]) {
      seen[room] = true;
      const text = {
        observation: f.blackout ? null : 'Screens. A whole wall of them. Every one shows a place on the island.',
        archive: 'Filing cabinets. Years of paper. One drawer is pulled out.',
        control: 'The control room. A deck with two reels, and a terminal with a red light.',
      }[room];
      if (text && !f[room + 'Seen']) { api.setFlag(room + 'Seen'); api.thought(text, 4); }
    }
    // a reload during the power failure: run it again from the start, it only sets flags at the end
    if (f.recordingDone && !f.blackout && !blackoutRun) startBlackout();
    // the old building: distant knocks and ticks
    if ((noiseT -= dt) < 0) {
      noiseT = 25 + Math.random() * 30;
      if (f.blackout) api.audio.knock(new THREE.Vector3(DOORS.sealed.at - 3, 0.5, DOORS.sealed.c), 1);
      else api.audio.distantNoise(new THREE.Vector3(px + (Math.random() - 0.5) * 30, -4, pz + (Math.random() - 0.5) * 30));
    }
    void q;
  };
  zone.onEnter = (from) => {
    if (from === 'ridge' && flags().enteredFacility) api.thought(flags().blackout ? 'Red light, and the hum of the emergency power.' : 'Back inside N-1.', 3, 0.8);
  };
}
