// Player characters ("skins"). Every skin is a rigged Mixamo character; the animation clips live in
// survivor.glb and are shared by all of them (the skin files carry only mesh, skeleton and textures,
// with their bones renamed to survivor.glb's names). See tools/skins/README.md for adding one.
// height: metres, when the file's units are not centimetres · hide: meshes that do not survive the conversion
import { T } from '../i18n/index.js';
export const SKINS = [
  { id: 'alex', file: 'survivor.glb', name: T('Alex'), role: T('The Passenger'), desc: T('Black hoodie and sneakers. Was sitting by the window when the plane started shaking.') },
  { id: 'noa', file: 'skins/ch02.glb', name: T('Noa'), role: T('The Student'), desc: T('Orange sweatshirt and denim shorts. Flying home for summer break.') },
  { id: 'marcus', file: 'skins/ch06.glb', name: T('Marcus'), role: T('The Musician'), desc: T('Headphones, a cap and high hiking boots. Won\'t take the headphones off, even here.') },
  { id: 'sara', file: 'skins/ch07.glb', name: T('Sara'), role: T('The Lawyer'), desc: T('Blue suit and heels. Was on her way to the most important meeting of her career.') },
  { id: 'daniel', file: 'skins/ch01.glb', name: T('Daniel'), role: T('The Engineer'), desc: T('Polo shirt and jeans. Can fix almost anything, if only he had tools.') },
  { id: 'yoni', file: 'skins/ch08.glb', name: T('Yoni'), role: T('The Coach'), desc: T('Light tracksuit and a beard. Used to running long distances.') },
  { id: 'maya', file: 'skins/ch22.glb', name: T('Maya'), role: T('The Photographer'), desc: T('White shirt and ripped jeans. Notices every little detail.') },
  { id: 'remy', file: 'skins/remy.glb', name: T('Remy'), role: T('The Traveler'), desc: T('Cargo shorts and a T-shirt. Has traveled half the world, but never to an island like this.'), height: 1.8, hide: ['Eyelashes'] },
];

// existing players, and anyone who never picked, are the original survivor
export const DEFAULT_SKIN = 'alex';
export const skinById = (id) => SKINS.find((s) => s.id === id) || SKINS[0];
