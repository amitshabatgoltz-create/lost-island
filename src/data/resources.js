// Resource pickups placed in the world. Each node can be taken once (its id goes into state.collected).
// New research locations add their nodes here.
export const RESOURCE_NODES = [
  // beach — scavenged from the wreck and the shoreline
  { id: 'res:beach:drift1', zone: 'beach', item: 'wood', qty: 4, x: -3, z: 27, look: 'wood', label: 'Gather driftwood' },
  { id: 'res:beach:drift2', zone: 'beach', item: 'wood', qty: 3, x: -33, z: 18, look: 'wood', label: 'Gather broken planks' },
  { id: 'res:beach:strap', zone: 'beach', item: 'rope', qty: 2, x: 11.5, z: 20, look: 'rope', label: 'Take suitcase straps' },
  { id: 'res:beach:net', zone: 'beach', item: 'rope', qty: 2, x: 26.5, z: -9.5, look: 'rope', label: 'Take the cargo net' },
  { id: 'res:beach:seat', zone: 'beach', item: 'cloth', qty: 2, x: 19, z: 11.5, look: 'cloth', label: 'Tear padding off a seat' },
  { id: 'res:beach:blanket', zone: 'beach', item: 'cloth', qty: 2, x: -8, z: 13, look: 'cloth', label: 'Take a flight blanket' },
  { id: 'res:beach:avionics', zone: 'beach', item: 'electronics', qty: 2, x: 26.5, z: 16.5, look: 'electronics', label: 'Pull out a circuit board' },
  { id: 'res:beach:beacon', zone: 'beach', item: 'battery', qty: 2, x: 40.5, z: -13.5, look: 'battery', label: 'Take batteries from the beacon' },
  // forest — from the camp and the transmitter clearing
  { id: 'res:forest:crates', zone: 'forest', item: 'battery', qty: 3, x: 8.8, z: -54.6, look: 'battery', label: 'Take batteries from the crate' },
  { id: 'res:forest:generator', zone: 'forest', item: 'electronics', qty: 2, x: 34.5, z: -59.8, look: 'electronics', label: 'Strip parts from the generator' },
  { id: 'res:forest:dish', zone: 'forest', item: 'electronics', qty: 2, x: 4.8, z: -62.5, look: 'electronics', label: 'Strip parts from the dish' },
  { id: 'res:forest:chute', zone: 'forest', item: 'rope', qty: 3, x: -76.5, z: -44.5, look: 'rope', label: 'Cut parachute cords' },
  { id: 'res:forest:tent', zone: 'forest', item: 'cloth', qty: 2, x: 6.8, z: -71.5, look: 'cloth', label: 'Take cloth from the tent' },
  { id: 'res:forest:branches', zone: 'forest', item: 'wood', qty: 4, x: -48, z: -8, look: 'wood', label: 'Gather dry branches' },
  { id: 'res:forest:trail', zone: 'forest', item: 'wood', qty: 3, x: 5, z: 92, look: 'wood', label: 'Gather planks' },
  // northern ridge (Part 3) — the abandoned tarp camp and the spares crate
  { id: 'res:ridge:tarp', zone: 'ridge', item: 'rope', qty: 2, x: -11.6, z: 36.4, look: 'rope', label: 'Take the guy ropes' },
  { id: 'res:ridge:crate', zone: 'ridge', item: 'electronics', qty: 2, x: -16.6, z: -13.6, look: 'electronics', label: 'Take spare parts from the crate' },
];
