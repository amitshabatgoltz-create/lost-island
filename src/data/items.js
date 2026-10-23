// Every item in the game, one registry for everything.
//   kind 'key'      — tools the player always carries (never stored, no slot)
//   kind 'gear'     — carried items with a quantity; can be stored (stack = max per slot)
//   kind 'resource' — materials for future crafting; stackable and storable
//   kind 'clue'     — booklet entries (not physical inventory)
export const ITEMS = {
  // ---- Part 1 (beach)
  water: { name: 'בקבוק מים', kind: 'gear', stack: 5, toast: 'נאסף: בקבוק מים', desc: 'בקבוק סגור, כמעט מלא. זה יחזיק אותי יום, אולי יומיים.' },
  flashlight: { name: 'פנס', kind: 'key', toast: 'נאסף: פנס — לחץ F להדלקה', desc: 'פנס מתכת קטן. הסוללה עדיין חיה.' },
  bandage: { name: 'תחבושת', kind: 'gear', stack: 5, toast: 'נאסף: תחבושת', desc: 'ערכת עזרה ראשונה קטנה. חבשתי את החתך ביד.' },
  booklet: { name: 'החוברת המסתורית', kind: 'key', clue: true, toast: 'נאספה: החוברת המסתורית — לחץ J כדי לפתוח' },
  ticket: { name: 'כרטיס טיסה קרוע', kind: 'clue', toast: 'רמז חדש: כרטיס טיסה קרוע' },
  device: { name: 'התקן זיכרון', kind: 'clue', toast: 'רמז חדש: התקן זיכרון' },
  document: { name: 'מסמך פנימי', kind: 'clue', toast: 'רמז חדש: מסמך פנימי' },
  // ---- Part 2 (forest)
  powerCell: { name: 'תא כוח', kind: 'key', toast: 'נאסף: תא כוח', desc: 'סוללה תעשייתית כבדה, עם אותו סמל. המחוון מראה שהיא עדיין טעונה.' },
  // ---- resources (base camp update)
  wood: { name: 'שאריות עץ', kind: 'resource', stack: 20, desc: 'קרשים וענפים יבשים. אפשר לבנות מהם משהו.' },
  rope: { name: 'חבל', kind: 'resource', stack: 10, desc: 'חבל ניילון חזק, מרצועות מזוודות ומקשירות מטען.' },
  cloth: { name: 'בד', kind: 'resource', stack: 10, desc: 'בד ריפוד ושמיכות. טוב לחבישה, לגג או לבידוד.' },
  battery: { name: 'סוללות', kind: 'resource', stack: 12, desc: 'סוללות AA ו-9 וולט. חלקן עוד עובדות.' },
  electronics: { name: 'רכיבים אלקטרוניים', kind: 'resource', stack: 12, desc: 'מעגלים, חוטים ומחברים. אולי אפשר לתקן איתם משהו.' },
  carvings: { name: 'סימנים חרוטים', kind: 'clue', toast: 'נרשם בחוברת: סימנים חרוטים' },
  serviceCard: { name: 'כרטיס שירות', kind: 'clue', toast: 'רמז חדש: כרטיס שירות — RELAY 04' },
  calendar: { name: 'לוח שנה', kind: 'clue', toast: 'נרשם בחוברת: לוח השנה מהבקתה' },
  radioLog: { name: 'יומן רדיו פגום', kind: 'clue', toast: 'רמז חדש: יומן רדיו פגום' },
  photo: { name: 'תצלום', kind: 'clue', toast: 'רמז חדש: תצלום' },
  campMap: { name: 'מפת המחנה', kind: 'clue', toast: 'רמז חדש: מפה מצוירת ביד' },
  researchDoc: { name: 'פרוטוקול מחקר', kind: 'clue', toast: 'רמז חדש: פרוטוקול מחקר' },
  schedule: { name: 'לוח משמרות תצפית', kind: 'clue', toast: 'רמז חדש: לוח משמרות תצפית' },
  routeChart: { name: 'תרשים נתיב הטיסה', kind: 'clue', toast: 'רמז חדש: תרשים נתיב הטיסה' },
  stillHere: { name: 'רשומה אחרונה', kind: 'clue', toast: 'נוספה רשומה לחוברת' },
};

export const KEY_ORDER = ['flashlight', 'booklet', 'powerCell'];
export const isStorable = (id) => !!ITEMS[id] && (ITEMS[id].kind === 'gear' || ITEMS[id].kind === 'resource');

export const SUITCASE_THOUGHTS = [
  'בגדים רטובים ונעלי ספורט. שום דבר שיעזור לי.',
  'מישהו ארז ספרים לחופשה. אף אחד מהם לא יציל אותי.',
  'בגדי ים, קרם הגנה ותמונה של ילדה. אני סוגר את זה מהר.',
  'ריקה. מישהו כבר פתח אותה? או שהיא נפתחה בנפילה.',
  'מטען יד של דייל: מדים, רשימות בטיחות. השם על התג מטושטש.',
  'מזוודה נעולה. המנעול מעוך — אי אפשר לפתוח.',
  'שקיות קפה, מתנות ליום הולדת. החופשה של מישהו אחר.',
];
