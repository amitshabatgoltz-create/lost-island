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
        if (f.wired) return 'כוון את התדר';
        if (f.cellInserted) return 'פתח את לוח החיווט';
        return has('powerCell') ? 'הכנס את תא הכוח' : 'בדוק את המשדר';
      }
      if (q() === 14) return 'האזן לשידור';
      return 'בדוק את המשדר';
    },
    use: () => {
      const f = flags();
      if (!f.powerInstalled) {
        if (f.wired) return openTuning();
        if (f.cellInserted) return openWiring();
        if (has('powerCell')) return insertCell();
        api.audio.click();
        api.setFlag('transmitterInspected');
        api.thought('המשדר מת. התא של מקור הכוח ריק, והדלת שלו פתוחה. על הלוח: RELAY 04. ובבוץ סביב — עקבות.', 5.5);
        return;
      }
      if (q() === 14) return startEnding();
      api.audio.click();
      api.thought(f.endingSeen ? 'המשדר שותק. הצג כותב LINK: LOST.' : 'המשדר מזמזם על 417.9. אף אחד לא עונה.', 3.5);
    },
  });

  function insertCell() {
    api.setFlag('cellInserted');
    api.player.playPickup();
    api.audio.latch();
    zone.sync(api.state);
    api.refresh();
    api.persist();
    api.thought('התא נכנס למקום. שום דבר. מאחורי הלוח — ארבעה חוטים מנותקים.', 4.5, 0.6);
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
        api.thought('המסך נדלק. רק רעש. הוא מחפש משהו.', 4, 0.8);
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
          [1.3, () => api.subtitle('“...Nightjar relay... no civilian contact... observer remains on the ridge... [static]”', 'pa', '...ממסר נייטג׳אר... אין מגע אזרחי... הצופה נשאר על הרכס... [רעש]', 5)],
          [2.6, () => { api.collect('radioLog'); }],
          [6.6, () => { busy = false; api.thought('המשדר הדפיס את היומן שלו. והוא שידר משהו על מחנה.', 4.5); api.checkQuests(); }],
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
    label: () => `אסוף: ${ITEMS.powerCell.name}`,
    use: () => { if (api.collect('powerCell')) api.thought('48 וולט, עם אותו סמל. מישהו הוציא אותו מהמשדר — ונעל אותו כאן.', 4.5, 0.6); },
  });
  let lockTries = 0;
  add({
    id: 'supplyDrop', kind: 'container', x: FL.powerCell.x, z: FL.powerCell.z, radius: 2.0,
    available: () => !crateOpen(),
    label: () => 'מנעול עם שלושה סימנים',
    use: () => {
      if (!flags().crateSeen) { api.setFlag('crateSeen'); api.thought('ארגז אספקה שהוצנח. נעול במנעול עם שלושה גלגלים — על כל גלגל סימנים, לא מספרים.', 4.5); }
      api.openSymbolLock({
        symbols: SYMBOLS,
        size: CRATE_CODE.length,
        check(code) {
          if (code.every((c, i) => c === CRATE_CODE[i])) {
            api.setFlag('crateOpen');
            api.audio.unlock();
            zone.sync(api.state);
            api.collect('serviceCard', { silent: true });
            api.thought('נפתח. בפנים: תא הכוח — וכרטיס שירות של המשדר.', 4, 0.5);
            api.persist();
            return true;
          }
          lockTries++;
          api.audio.deny();
          if (lockTries === 3) api.thought('לא סתם סימנים. ראיתי סימנים כאלה בדרך לכאן.', 3.5);
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
      label: () => 'בחן את הסימן שבקליפה',
      use: () => {
        api.audio.click();
        const notch = ['', 'חריץ אחד', 'שני חריצים', 'שלושה חריצים'][c.notches];
        api.thought(`מישהו חרט בקליפה: ${symbolName(c.symbol)}. ומתחתיו — ${notch}.`, 4);
        if (!flags()[c.id]) {
          api.setFlag(c.id);
          if (!has('carvings')) api.collect('carvings', { silent: true });
          else api.toast('החוברת עודכנה: סימנים חרוטים', 'item', 2.5);
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
    label: () => (has('bpBandage') ? 'בדוק את האוהל' : 'בדוק את האוהל (יש שם שרטוט)'),
    use: () => {
      api.audio.click();
      const found = !has('bpBandage') && api.collect('bpBandage');
      api.thought('הבד קרוע מבפנים, לא מבחוץ. שק שינה, ומגף אחד. רק אחד.' + (found ? ' ובכיס של השק — שרטוט של תחבושת מבד.' : ''), 4.5);
      if (!flags().tentSeen) { api.setFlag('tentSeen'); api.checkQuests(); }
    },
  });
  add({
    id: 'cabinMap', kind: 'examine', x: P.cabin.spots.map.x, z: P.cabin.spots.map.z, radius: 1.5,
    available: () => true,
    label: () => (has('campMap') ? 'הסתכל על המפה' : 'קח את המפה מהקיר'),
    use: () => {
      if (!has('campMap')) {
        api.collect('campMap');
        api.thought('מפה של היער. ובקצה — X אדום על החוף, בדיוק איפה שהמטוס נפל. “LZ-2”.', 5, 0.5);
      } else api.thought('LZ-2. הם סימנו את מקום הנחיתה לפני שהיא קרתה.', 3.5);
      if (!flags().cabinSeen) { api.setFlag('cabinSeen'); api.checkQuests(); }
    },
  });
  add({
    id: 'calendar', kind: 'examine', x: P.cabin.spots.calendar.x, z: P.cabin.spots.calendar.z, radius: 1.3,
    available: () => true,
    label: () => 'בחן את לוח השנה',
    use: () => {
      api.audio.click();
      api.thought('ספטמבר. שני ימים מוקפים באדום: 14 — “APPROVED”. ו־23 — “ARRIVAL · LZ-2”.', 4.8);
      if (!has('calendar')) api.collect('calendar', { silent: true });
    },
  });
  // blueprints for the workbench at the base camp
  const blueprintSpot = (id, pos, label, text, radius, bp, bpText) => add({
    id, kind: 'examine', x: pos.x, z: pos.z, radius,
    available: () => true,
    label: () => (has(bp) ? label : `${label} (יש שם שרטוט)`),
    use: () => {
      api.audio.click();
      if (!has(bp)) { api.collect(bp); api.thought(bpText, 4.5, 0.4); } else api.thought(text, 4.2);
    },
  });
  blueprintSpot('cabinDesk', P.cabin.spots.desk, 'בדוק את השולחן בבקתה', 'כוס קפה עם עובש ודפים עם מספרים. מי שגר כאן עזב בחיפזון — הכיסא עוד הפוך.', 1.4,
    'bpBag', 'מתחת לכוס הקפה — שרטוט של תיק גב מבד וחבל. אפשר לבנות אותו בשולחן העבודה במחנה.');
  examine('cabinShelf', P.cabin.spots.shelf, 'בדוק את המדף', 'צנצנות עם דגימות אדמה ומים, מתויגות בתאריכים. האחרונה: 22 בספטמבר. יום לפני הטיסה.', 1.4);
  const tableFront = front(FL.table, 1.15);
  add({
    id: 'table', kind: 'examine', x: tableFront.x, z: tableFront.z, radius: 1.9,
    available: () => true,
    label: () => (has('photo') ? 'בדוק את המסמכים' : 'בדוק את המסמכים והתמונות'),
    use: () => {
      if (!has('photo')) {
        api.collect('photo');
        api.thought('תצלומים של האי, מהים. באחד מהם — מישהו עומד ליד התורן. בגב: “N. — השבוע הראשון. הכל לפי התוכנית.”', 5.5, 0.5);
      } else api.thought('“קליטת נבדקים — ראה פרוטוקול 3”. השאר מושחר.', 3.5);
      if (!flags().tableSeen) { api.setFlag('tableSeen'); api.checkQuests(); }
    },
  });
  examine('campRadio', { x: P.table.radioPos.x, z: P.table.radioPos.z }, 'בדוק את מכשיר הקשר', 'מכשיר קשר ידני, מכוון ל־417.9. הסוללה חמה. מישהו החזיק אותו לא מזמן.', 1.2);
  blueprintSpot('crates', FL.crates, 'בדוק את ארגזי הציוד', 'ארגזי ציוד עם אותו סמל ו־“NJ · FIELD 04”. ריקים. מישהו פינה אותם לפני שעזב.', 2.2,
    'bpChest', 'על הארגז מודבק שרטוט הרכבה של תיבה גדולה. אפשר לבנות אותה בשולחן העבודה במחנה.');
  examine('generator', FL.generator, 'בדוק את הגנרטור', 'גנרטור מפורק. החלקים לא נשברו — הם הוצאו בזהירות, אחד אחד.', 2.0);
  examine('dish', FL.dish, 'בדוק את צלחת הלוויין', 'הצלחת מכוונת דרומה. לא לשמיים — לים. לכיוון שממנו הגענו.', 2.0);

  // ------------------------------------------------------------------ locker (code = relay frequency)
  const lockerFront = front(FL.locker, 0.95);
  let attempts = 0;
  let lidAnim = false;
  add({
    id: 'locker', kind: 'container', x: lockerFront.x, z: lockerFront.z, radius: 1.7,
    available: () => !flags().lockerOpen && !lidAnim,
    label: () => 'הקש קוד בארגז הנעול',
    use: () => {
      if (!flags().lockerHint) { api.setFlag('lockerHint'); api.thought('על המכסה, בשבלונה: “ACCESS: APPROVAL / ARRIVAL”.', 4.5); }
      api.openKeypad({
        title: 'ארגז נעול · ACCESS: APPROVAL / ARRIVAL',
        length: 4,
        onSubmit: (code) => {
          if (code === LOCKER_CODE) { openLocker(); return true; }
          attempts++;
          api.audio.deny();
          if (attempts === 3) api.thought('APPROVAL, ARRIVAL. שני רגעים. ארבע ספרות... שני מספרים של שתי ספרות?', 4.5);
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
      api.thought('בפנים: תיקייה עם הסמל, ודף משמרות מלוכלך בבוץ.', 4);
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
      label: () => `אסוף: ${ITEMS[id].name}`,
      use: () => {
        api.collect(id);
        if (id === 'researchDoc') api.thought('“נבדקים”. “ירידה לא מתוכננת”. הם קוראים להתרסקות כניסה.', 4.5, 0.5);
        if (id === 'schedule') api.thought('צופה על הרכס המזרחי. “23/9 · 02:41 — יש מגע.” דקה אחרי שנפלנו.', 4.5, 0.5);
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
    label: () => `אסוף: ${ITEMS.routeChart.name}`,
    use: () => { api.collect('routeChart'); startEncounter(); },
  });
  add({
    id: 'postBoard', kind: 'examine', x: FL.routeChart.x + 0.6, z: FL.routeChart.z + 0.8, radius: 1.9,
    available: () => q() < 13 && !has('routeChart'),
    label: () => 'בדוק את הלוח',
    use: () => { api.audio.click(); api.thought('תרשים טיסה נעוץ בלוח. קודם אני צריך להבין מה הם עשו במחנה.', 3.8); },
  });
  examine('scope', FL.scope, 'הסתכל דרך המשקפת', 'המשקפת מכוונת דרומה, אל החוף. בדיוק אל המקום שבו התעוררתי.', 1.6);

  // spotting scope at the camp: pan across the forest and find the lens glint on the ridge
  const SC = FL.campScope;
  add({
    id: 'campScope', kind: 'machine', x: SC.x - 1.0, z: SC.z - 0.3, radius: 1.6,
    available: () => true,
    label: () => 'הבט במשקפת',
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
          api.thought('נצנוץ. על הרכס המזרחי, מעל הצוק — עדשה. מישהו הציב שם משהו.', 4.5);
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
      [0.6, () => api.thought('מישהו ישב כאן וצפה בהתרסקות. מכאן.', 3.2)],
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
      [6.9, () => { fig.visible = false; figMove = null; api.thought('מי שם?!', 2.4); }],
      [10.2, () => {
        api.audio.radio(2.5);
        api.audio.signalBeeps();
        api.toast('הרדיו במשדר התעורר. מישהו משדר אליו.', 'warn', 4.5);
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
    const T = FL.transmitter;
    const base = terrainHeight(T.x, T.z);
    const camPos = new THREE.Vector3(T.x + Math.sin(T.rot) * 4.2 + 1.2, base + 1.8, T.z + Math.cos(T.rot) * 4.2 + 1.6);
    const lookCab = new THREE.Vector3(T.x, base + 1.2, T.z);
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
        api.subtitle('“We know you survived.”', 'pa', 'אנחנו יודעים ששרדת.', 3.4);
        api.audio.speak('We know you survived. Do not trust anyone coming to the island.', { pitch: 0.55, rate: 0.82 });
      }],
      [4.5, () => api.subtitle('“Do not trust anyone coming to the island.”', 'pa', 'אל תסמוך על אף אחד שמגיע לאי.', 3.8)],
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
  const T = FL.transmitter;
  zone.tick = (dt, t, player) => {
    const s = api.state, f = s.flags;
    const px = player.pos.x, pz = player.pos.z;
    const dT = Math.hypot(px - T.x, pz - T.z);
    if (!f.reachedTransmitter && dT < 13) {
      api.setFlag('reachedTransmitter');
      api.thought('המשדר. מישהו בנה אותו כאן, באמצע היער — והוא מת.', 4);
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
      api.seq.after(1.15, () => { fig.visible = false; figMove = null; api.thought('...היה שם מישהו? בין העצים.', 3); });
    }
    // the camp radio wakes up on its own
    if (!f.campRadio && !campRadioRun && Math.hypot(px - FL.camp.x, pz - FL.camp.z) < 16) {
      campRadioRun = true;
      P.table.radioLedMat.emissiveIntensity = 3;
      api.audio.radioAt(P.table.radioPos, 5);
      api.subtitle('“...camp, this is ridge... movement at L-Z two... say again...”', 'pa', '...מחנה, כאן הרכס... יש תנועה ב־LZ-2... חזור...', 4.8);
      api.seq.after(5, () => { P.table.radioLedMat.emissiveIntensity = 0; api.setFlag('campRadio'); campRadioRun = false; api.thought('המכשיר על השולחן. הוא נדלק לבד.', 3); });
    }
    // footprint hints
    const [sx, sz] = PRINTS.toPower[0];
    if (!f.printsPower && s.questIndex === 8 && Math.hypot(px - sx, pz - sz) < 7) {
      api.setFlag('printsPower');
      api.thought('עקבות מגפיים בבוץ. הן יוצאות מהמשדר מערבה.', 3.5);
    }
    const [rx, rz] = PRINTS.toRidge[0];
    if (!f.printsRidge && s.questIndex >= 12 && Math.hypot(px - rx, pz - rz) < 6) {
      api.setFlag('printsRidge');
      api.thought('עקבות טריות. מישהו הלך מהמחנה מזרחה, אל הרכס — הלילה.', 3.8);
    }
    const [ux, uz] = PRINTS.stray[0];
    if (!f.printsStray && Math.hypot(px - ux, pz - uz) < 5) {
      api.setFlag('printsStray');
      api.thought('העקבות האלה הולכות ישר אל קצה הצוק... ונעלמות.', 3.8);
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
