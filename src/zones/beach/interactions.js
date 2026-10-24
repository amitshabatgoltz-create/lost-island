// Part 1 interactions on the beach. Moved out of main.js unchanged in behaviour.
import { createItemMesh, createBlackSuitcase, createGlint } from '../../items.js';
import { heightAt } from './terrain.js';
import { LAYOUT, ITEM_SPOTS } from './layout.js';
import { ITEMS, SUITCASE_THOUGHTS } from '../../data/items.js';
import { addResourceNodes } from '../resources.js';

export function createBeachInteractions(zone, api) {
  const list = [];
  const add = (def) => list.push({ radius: 2.1, ...def });
  const group = zone.group;
  const { has } = api;

  const itemUnlocked = (id) => {
    const q = api.state.questIndex;
    if (id === 'ticket' || id === 'device') return q >= 4;
    if (id === 'document') return q >= 5;
    return true;
  };

  // collectible items
  for (const id of Object.keys(ITEM_SPOTS)) {
    if (id === 'booklet') continue;
    const s = ITEM_SPOTS[id];
    const mesh = createItemMesh(id);
    mesh.position.set(s.x, heightAt(s.x, s.z) + 0.01, s.z);
    mesh.rotation.y += (s.x * 13.7) % 6.28;
    group.add(mesh);
    const glint = createGlint();
    glint.position.set(s.x, mesh.position.y + 0.55, s.z);
    group.add(glint);
    add({
      id, kind: 'pickup', obj: mesh, glint, x: s.x, z: s.z,
      available: () => !has(id) && itemUnlocked(id),
      visible: () => !has(id) && itemUnlocked(id),
      label: () => `Pick up: ${ITEMS[id].name}`,
      use: () => {
        api.collect(id);
        if (id === 'ticket') api.thought('Seat 31A... that is the seat next to mine. It was empty.', 4, 0.4);
        if (id === 'device') api.thought('The same symbol. And a label: CACHE / TAIL.', 4, 0.4);
      },
    });
  }

  // the special black suitcase in the rock crevice
  const bs = LAYOUT.blackSuitcase;
  const blackSuitcase = createBlackSuitcase();
  blackSuitcase.position.set(bs.x, heightAt(bs.x, bs.z) - 0.02, bs.z);
  blackSuitcase.rotation.set(0.04, 2.3, -0.06);
  group.add(blackSuitcase);
  const bookletMesh = createItemMesh('booklet');
  bookletMesh.position.set(0.05, blackSuitcase.userData.innerY, 0.02);
  bookletMesh.rotation.y = 0.2;
  bookletMesh.scale.multiplyScalar(0.9);
  blackSuitcase.add(bookletMesh);
  const bGlint = createGlint();
  bGlint.position.set(bs.x, blackSuitcase.position.y + 0.8, bs.z);
  group.add(bGlint);
  let animating = false;

  function openBlackSuitcase() {
    if (!has('flashlight')) {
      api.audio.deny();
      api.thought('It is too dark between the rocks, and something black is stuck deep in there. I need a flashlight.', 4);
      return;
    }
    if (!api.player.flashlightOn) { api.setFlashlight(true); api.toast('You turned on the flashlight'); }
    api.setFlag('suitcaseOpened');
    animating = true;
    api.audio.latch();
    api.player.playPickup();
    api.checkQuests();
    api.persist();
    const lid = blackSuitcase.userData.lid;
    api.animate(1.3, (k) => { lid.rotation.x = -k * k * (3 - 2 * k) * 1.95; }, () => {
      animating = false;
      api.thought('This suitcase doesn\'t belong to any passenger. Inside: just one booklet, wrapped in plastic.', 4.5);
      api.checkQuests();
    });
  }

  add({
    id: 'blackSuitcase', kind: 'container', x: bs.x, z: bs.z, radius: 2.4,
    available: () => !api.state.flags.suitcaseOpened,
    label: () => (has('flashlight') ? 'Open the black suitcase' : 'Black suitcase in the rocks'),
    locked: () => !has('flashlight'),
    use: openBlackSuitcase,
  });
  add({
    id: 'booklet', kind: 'pickup', obj: bookletMesh, glint: bGlint, x: bs.x, z: bs.z, radius: 2.4,
    available: () => api.state.flags.suitcaseOpened && !has('booklet') && !animating,
    visible: () => !has('booklet'),
    label: () => `Pick up: ${ITEMS.booklet.name}`,
    use: () => api.collect('booklet'),
  });

  // ordinary suitcases: examinable scenery
  zone.wreck.suitcases.forEach((s, i) => {
    add({
      id: 'suitcase' + i, kind: 'examine', x: s.x, z: s.z, radius: 1.8,
      available: () => true,
      label: () => 'Check suitcase',
      use: () => { api.audio.click(); api.thought(SUITCASE_THOUGHTS[i % SUITCASE_THOUGHTS.length]); },
    });
  });

  // look into the fuselage
  const f = LAYOUT.fuselage;
  const ex = f.x + Math.cos(f.rot) * 10.4, ez = f.z - Math.sin(f.rot) * 10.4;
  add({
    id: 'fuselage', kind: 'examine', x: ex, z: ez, radius: 3.0,
    available: () => true,
    label: () => 'Look inside the fuselage',
    use: () => {
      api.audio.click();
      api.setFlag('exploredWreck');
      api.thought(api.state.flags.nightfall
        ? 'In the dark, the fuselage looks like a skeleton. Nobody came back here.'
        : 'The seats are empty. Nobody here... where are all the other passengers?', 4.2);
      api.checkQuests();
    },
  });
  // the tail section
  add({
    id: 'tailExamine', kind: 'examine', x: LAYOUT.tail.x - 2, z: LAYOUT.tail.z + 3.2, radius: 2.6,
    available: () => true,
    label: () => 'Check the tail',
    use: () => {
      api.audio.click();
      const q = api.state.questIndex;
      api.thought(q === 5 && !has('document')
        ? 'TAIL. Here. By the cargo container, something under a rock.'
        : q >= 6 ? 'Behind the tail a trail leads into the forest. The red light comes from there.'
          : 'The tail was ripped off and thrown to the edge of the forest. The airline logo is still intact.', 4);
    },
  });
  // the trailhead into the forest (Part 2)
  add({
    id: 'trailhead', kind: 'examine', x: 1, z: -95, radius: 3.2,
    available: () => api.state.questIndex >= 6,
    label: () => 'Enter the forest',
    use: () => api.enterZone('forest', 'fromBeach'),
  });

  // ---------------------------------------------------------------- base camp
  const B = zone.base;
  const baseOpen = () => api.state.base.found;
  add({
    id: 'baseChest', kind: 'container', x: B.spots.chest.x, z: B.spots.chest.z, radius: 1.5,
    available: () => true,
    label: () => (baseOpen() ? 'Open the wooden chest' : 'Makeshift wooden chest'),
    use: () => {
      claimBase();
      api.audio.latch();
      api.animate(0.35, (k) => { B.lidPivot.rotation.x = -k * 1.4; });
      api.openStorage('baseChest', () => api.animate(0.35, (k) => { B.lidPivot.rotation.x = -(1 - k) * 1.4; }));
    },
  });
  add({
    id: 'workbench', kind: 'machine', x: B.spots.bench.x, z: B.spots.bench.z, radius: 1.5,
    available: () => true,
    label: () => 'Workbench',
    use: () => { claimBase(); api.audio.click(); api.openWorkbench(); },
  });
  add({
    id: 'evidenceBoard', kind: 'examine', x: B.spots.board.x, z: B.spots.board.z, radius: 1.6,
    available: () => true,
    label: () => (has('booklet') ? 'Evidence board' : 'Empty corkboard'),
    use: () => {
      claimBase();
      if (!has('booklet')) { api.audio.click(); api.thought('An empty corkboard. If I find something worth remembering, I will pin it here.', 3.8); return; }
      api.openBoard();
    },
  });
  add({
    id: 'lantern', kind: 'machine', x: B.spots.lantern.x, z: B.spots.lantern.z, radius: 1.4,
    available: () => true,
    label: () => (api.state.base.lanternOn ? 'Turn off the lantern' : 'Turn on the lantern'),
    use: () => {
      api.state.base.lanternOn = !api.state.base.lanternOn;
      B.setLantern(api.state.base.lanternOn);
      api.audio.flashlight();
      api.persist();
    },
  });
  add({
    id: 'campSeat', kind: 'examine', x: B.spots.seat.x, z: B.spots.seat.z, radius: 1.5,
    available: () => !api.player.sitting,
    label: () => 'Sit by the campfire',
    use: () => {
      claimBase();
      api.player.sit(B.sitSpot, B.sitSpot.yaw);
      api.thought('A moment to breathe. The waves, the fire. I am still here.', 3.6, 2.2);
    },
  });
  function claimBase() {
    if (api.state.base.found) return;
    api.state.base.found = true;
    api.toast('Shelter found: base camp on the beach', 'quest', 4);
    api.persist();
  }

  // ---------------------------------------------------------------- scavenged resources
  list.push(...addResourceNodes(zone, api, heightAt));

  zone.interactables = list;
  zone.syncInteractables = (s) => {
    B.setPins(s.clues.length);
    B.setLantern(s.base.lanternOn);
    for (const it of list) {
      if (it.obj && it.visible) it.obj.visible = it.visible();
      if (it.glint) it.glint.visible = it.available();
    }
    if (!animating) blackSuitcase.userData.lid.rotation.x = s.flags.suitcaseOpened ? -1.95 : 0;
  };

  // per-frame zone logic
  const device = list.find((i) => i.id === 'device');
  zone.tick = (dt, t, player) => {
    const s = api.state;
    if (!s.base.found && Math.hypot(player.pos.x - B.spots.center.x, player.pos.z - B.spots.center.z) < 3.5) {
      claimBase();
      api.thought('Someone built a shelter here from plane parts, or I will. A chest, a workbench, a board. I could live here.', 4.6);
    }
    if (!s.flags.exploredWreck && Math.hypot(player.pos.x - f.x, player.pos.z - f.z) < 10.5) {
      api.setFlag('exploredWreck');
      api.thought('This is... what is left of the plane.', 3);
      api.checkQuests();
    }
    if (device.obj.visible) device.obj.traverse((o) => { if (o.name === 'led') o.material.emissiveIntensity = (t % 1.2) < 0.15 ? 4 : 0.2; });
  };
}
