// Turns RESOURCE_NODES of one zone into interactables. Taking a node needs room in the bag.
import { createResourceMesh, createGlint } from '../items.js';
import { RESOURCE_NODES } from '../data/resources.js';
import { ITEMS } from '../data/items.js';

export function addResourceNodes(zone, api, heightAt) {
  const list = [];
  for (const n of RESOURCE_NODES.filter((r) => r.zone === zone.id)) {
    const mesh = createResourceMesh(n.look);
    mesh.position.set(n.x, heightAt(n.x, n.z) + 0.01, n.z);
    mesh.rotation.y = (n.x * 7.1) % 6.28;
    zone.group.add(mesh);
    const glint = createGlint();
    glint.scale.setScalar(0.3);
    glint.position.set(n.x, mesh.position.y + 0.5, n.z);
    zone.group.add(glint);
    list.push({
      id: n.id, kind: 'resource', obj: mesh, glint, x: n.x, z: n.z, radius: 1.9,
      available: () => !api.has(n.id),
      visible: () => !api.has(n.id),
      label: () => `${n.label} (${ITEMS[n.item].name} ×${n.qty})`,
      use: () => api.collectResource(n.id, n.item, n.qty),
    });
  }
  return list;
}
