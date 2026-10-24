// Crafting recipes for the workbench. A recipe shows once its blueprint has been found (blueprint id in state.collected).
//   needs  — materials taken from the bag first, then from the base chest
//   gives  — { item, qty } goes into the bag; { upgrade } adds a feature to state.base.unlocked (built once)
export const RECIPES = [
  { id: 'bandage', blueprint: 'bpBandage', name: 'תחבושת', desc: 'רצועות בד נקיות לחבישה.', needs: { cloth: 2 }, gives: { item: 'bandage', qty: 1 } },
  { id: 'bigBag', blueprint: 'bpBag', name: 'תיק גדול', desc: 'תיק גב מבד וחבל: עוד 3 מקומות בתיק.', needs: { cloth: 3, rope: 2 }, gives: { upgrade: 'bigBag' } },
  { id: 'chest2', blueprint: 'bpChest', name: 'תיבה גדולה', desc: 'מגדיל את תיבת העץ במחנה: עוד 8 מקומות.', needs: { wood: 8, rope: 2 }, gives: { upgrade: 'chest2' } },
];

// Base upgrades: extra slots each one adds
export const BAG_BONUS = { bigBag: 3 };
export const CHEST_BONUS = { chest2: 8 };
export const BASE_UPGRADES = ['bigBag', 'chest2'];
