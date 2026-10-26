// Minimap description of facility N-1: floor plan from the room rectangles, walls from the colliders.
import { ROOMS } from './layout.js';
import { T } from '../../i18n/index.js';

const inRoom = (x, z) => Object.values(ROOMS).some(({ r }) => x >= r[0] && x <= r[1] && z >= r[2] && z <= r[3]);
const center = (id) => ({ x: (ROOMS[id].r[0] + ROOMS[id].r[1]) / 2, z: (ROOMS[id].r[2] + ROOMS[id].r[3]) / 2 });

export const MINIMAP = {
  title: T('FACILITY N-1'),
  margin: 4,
  view: 16, // small indoor plan: zoom in
  ground: (x, z) => (inRoom(x, z) ? [112, 120, 122] : [30, 32, 34]),
  landmarks: [
    { ...center('corridor'), label: 'EXIT' },
    { ...center('checkpoint'), label: 'CHECKPOINT' },
    { ...center('observation'), label: 'OBSERVATION', found: (s) => !!s.flags.monitorsSeen },
    { ...center('archive'), label: 'ARCHIVE', found: (s) => !!(s.flags.archiveTried || s.flags.archiveAccess) },
    { ...center('control'), label: 'CONTROL', kind: 'danger', found: (s) => !!(s.flags.controlReleased || s.flags.controlOpened) },
  ],
};
