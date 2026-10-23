// The whole mission chain as data. Each quest becomes active after the previous one is done.
// Indices 0–5 are Part 1 and must keep their order (saved games store questIndex).
import { LAYOUT, ITEM_SPOTS } from '../zones/beach/layout.js';
import { FL } from '../zones/forest/layout.js';

const has = (s, id) => s.collected.includes(id);
const at = (zone, p) => ({ zone, x: p.x, z: p.z });
const nearest = (zone, list, pos) => {
  let best = null, bd = 1e9;
  for (const p of list) {
    const d = pos ? Math.hypot(p.x - pos.x, p.z - pos.z) : 0;
    if (d < bd) { bd = d; best = p; }
  }
  return best ? at(zone, best) : null;
};
const fuselageEnd = { x: LAYOUT.fuselage.x + Math.cos(LAYOUT.fuselage.rot) * 10.4, z: LAYOUT.fuselage.z - Math.sin(LAYOUT.fuselage.rot) * 10.4 };

export const QUESTS = [
  // ============================== PART 1
  {
    id: 'wake', part: 1, hints: ['הסתכל סביב: משהו גדול ולבן שוכב על החוף.', 'גוף המטוס — מצפון־מזרח לנקודה שבה התעוררתי.', 'התקרב לגוף המטוס או בדוק את הקצה הפתוח שלו.'], title: 'התעוררות', objective: 'חקור את אזור ההתרסקות',
    done: (s) => s.flags.exploredWreck,
    target: () => at('beach', fuselageEnd),
  },
  {
    id: 'gear', part: 1, hints: ['בין השברים מפוזרים חפצים מהמטוס. נצנוץ קטן מסמן משהו שאפשר לאסוף.', 'חפש ליד גוף המטוס, ליד הכנף השבורה וליד המושבים שנזרקו.', 'המים — ליד הצד של גוף המטוס. הפנס — ליד הכנף, מערבה. התחבושת — ליד המושבים, מזרחה.'], title: 'איסוף ציוד', objective: 'מצא ציוד בין שברי המטוס',
    sub: (s, I) => ['water', 'flashlight', 'bandage'].map((id) => ({ label: I[id].name, done: has(s, id) })),
    done: (s) => has(s, 'water') && has(s, 'flashlight') && has(s, 'bandage'),
    target: (s, pos) => nearest('beach', ['water', 'flashlight', 'bandage'].filter((id) => !has(s, id)).map((id) => ITEM_SPOTS[id]), pos),
    start: { thought: 'אני צריך מים, אור ומשהו לחבוש את היד. אולי בין השברים.', delay: 1.2 },
  },
  {
    id: 'suitcase', part: 1, hints: ['משהו שחור נתקע בין הסלעים.', 'בקצה המערבי של החוף יש סדק בין סלעים גדולים.', 'צריך פנס כדי לפתוח את המזוודה.'], title: 'המזוודה השחורה', objective: 'מצא את המזוודה השחורה המיוחדת ופתח אותה',
    done: (s) => s.flags.suitcaseOpened,
    target: () => at('beach', LAYOUT.blackSuitcase),
    start: { thought: 'ראיתי משהו שחור בין הסלעים, בקצה המערבי של החוף.', delay: 1.2 },
  },
  {
    id: 'booklet', part: 1, title: 'החוברת', objective: 'אסוף את החוברת, פתח אותה (J) וקרא את ההודעה',
    sub: (s) => [{ label: 'לאסוף את החוברת', done: has(s, 'booklet') }, { label: 'לפתוח אותה (J) ולקרוא', done: s.flags.bookletRead }],
    done: (s) => has(s, 'booklet') && s.flags.bookletRead,
    target: (s) => (has(s, 'booklet') ? null : at('beach', LAYOUT.blackSuitcase)),
  },
  {
    id: 'clues', part: 1, hints: ['במפה שבחוברת (J) יש שני סימני X.', 'אחד ליד החוף המערבי ואחד ליד השביל לג׳ונגל.', 'הכרטיס — בקצה המערבי של החוף, ליד המים. ההתקן — על השביל שנכנס לג׳ונגל, צפונית לגוף המטוס.'], title: 'הרמזים', objective: 'מצא את המקומות שמסומנים במפה שבחוברת',
    sub: (s, I) => ['ticket', 'device'].map((id) => ({ label: I[id].name, done: has(s, id) })),
    done: (s) => has(s, 'ticket') && has(s, 'device'),
    target: (s, pos) => nearest('beach', ['ticket', 'device'].filter((id) => !has(s, id)).map((id) => ITEM_SPOTS[id]), pos),
    start: { thought: 'על המפה בחוברת יש שני סימני X. שניהם קרובים לכאן.', delay: 0.8 },
  },
  {
    id: 'reveal', part: 1, hints: ['התווית אמרה CACHE / TAIL.', 'TAIL הוא זנב המטוס, ליד קצה היער.', 'חפש ליד מכולת המטען שליד הזנב.'], title: 'הגילוי', objective: 'חפש ליד זנב המטוס את מה שהתווית CACHE / TAIL מסמנת',
    done: (s) => has(s, 'document'),
    cinematic: 'reveal', // advancing waits for the "THE CRASH WAS NO ACCIDENT." sequence
    target: () => at('beach', ITEM_SPOTS.document),
    start: { thought: 'TAIL. הזנב של המטוס. מה מחכה שם?', delay: 0.8 },
  },

  // ============================== PART 2
  {
    id: 'enter', part: 2, title: 'האות', en: 'Find the source of the signal in the forest.',
    objective: 'השביל הצפוני, מאחורי זנב המטוס, נכנס ליער',
    done: (s) => s.zone === 'forest',
    target: () => ({ zone: 'beach', x: 1, z: -97 }),
    hints: [
      'האור האדום הופיע מעל היער, צפונה.',
      'מאחורי זנב המטוס מתחיל שביל עפר.',
      'לך צפונה בשביל שמתחיל ליד הזנב, עד שהוא נכנס בין העצים.',
    ],
  },
  // From here on the forest has no compass: the player navigates by the red light, the trails and the booklet map.
  {
    id: 'follow', part: 2, title: 'האור האדום', objective: 'האור האדום מהבהב מעל הצמרות',
    done: (s) => s.flags.reachedTransmitter,
    target: () => at('forest', FL.transmitter),
    start: { thought: 'האור האדום מהבהב מעל הצמרות. איפשהו לפניי.', delay: 1.5 },
    hints: [
      'הרם את המבט: האור האדום נראה מעל העצים. כשהוא גדל — אני מתקרב.',
      'השביל מתפתל, אבל הוא חוצה את הנחל בגשר עצים וממשיך לכיוון האור.',
      'המשדר בקרחת יער צפונית־מערבית, בסוף השביל הראשי שאחרי הגשר.',
    ],
  },
  {
    id: 'power', part: 2, title: 'מקור כוח', objective: 'המשדר מת. משהו נלקח ממנו.',
    sub: (s) => [
      { label: 'ארגז האספקה', done: !!s.flags.crateOpen || has(s, 'powerCell') },
      { label: 'תא הכוח', done: has(s, 'powerCell') },
    ],
    done: (s) => has(s, 'powerCell'),
    target: () => at('forest', FL.powerCell),
    hints: [
      'בדוק את הבוץ סביב המשדר, ואת הקליפה של העצים לאורך העקבות. משהו נחרט בה.',
      'השווה את הסימנים החרוטים (בחוברת: “סימנים חרוטים”) לסימנים שעל גלגלי המנעול. שים לב גם לחריצים.',
      'כל סימן חרוט מופיע עם 1, 2 או 3 חריצים — זה המקום שלו במנעול. סדר: גל (חריץ אחד), משולש (שניים), ספירלה (שלושה).',
    ],
  },
  {
    id: 'activate', part: 2, title: 'המשדר', objective: 'להחזיר את המשדר לחיים',
    sub: (s) => [
      { label: 'תא הכוח במקומו', done: !!s.flags.cellInserted || !!s.flags.powerInstalled },
      { label: 'החיווט', done: !!s.flags.wired || !!s.flags.powerInstalled },
      { label: 'התדר', done: !!s.flags.powerInstalled },
    ],
    done: (s) => s.flags.powerInstalled,
    target: () => at('forest', FL.transmitter),
    hints: [
      'קרא שוב את כרטיס השירות בחוברת. כל משפט בו קובע דבר אחד.',
      'השווה כל כלל בכרטיס למסופים 1–4 מלמעלה למטה. התחל מהכלל שמצביע על מסוף אחד בלבד.',
      'ירוק בראש (1). כחול צמוד לירוק — כלומר 2. צהוב לא בתחתית — נשאר לו 3. אדום — 4. בתדר: עקוב אחרי מד האות ועצור כשהוא מלא.',
    ],
  },
  {
    id: 'camp', part: 2, title: 'המחנה', objective: 'מה היה המקום הזה?',
    sub: (s) => [
      { label: 'האוהל', done: s.flags.tentSeen },
      { label: 'הבקתה', done: s.flags.cabinSeen },
      { label: 'השולחן', done: s.flags.tableSeen },
    ],
    done: (s) => s.flags.tentSeen && s.flags.cabinSeen && s.flags.tableSeen,
    target: (s, pos) => nearest('forest', [
      !s.flags.tentSeen && FL.tent, !s.flags.cabinSeen && FL.cabin, !s.flags.tableSeen && FL.table,
    ].filter(Boolean), pos),
    start: { thought: 'הממסר שידר משהו על מחנה.', delay: 6 },
    hints: [
      'השידור הזכיר מחנה. השביל ממשיך מהמשדר הלאה, לעומק היער.',
      'המשך בשביל מהמשדר צפונה־מזרחה עד קרחת גדולה עם אוהל ובקתה.',
      'במחנה יש שלושה דברים לבדוק: האוהל, השולחן תחת הברזנט, והמפה שעל הקיר בתוך הבקתה.',
    ],
  },
  {
    id: 'locker', part: 2, title: 'הארגז הנעול', objective: 'ארגז מתכת עם מקלדת קוד',
    done: (s) => s.flags.lockerOpen,
    target: () => at('forest', FL.locker),
    hints: [
      'קרא את השלט על הארגז: APPROVAL / ARRIVAL. שתי מילים — שני רגעים.',
      'השווה את לוח השנה שבבקתה למסמך הפנימי מהחוף ולכרטיס הטיסה שבחוברת.',
      'APPROVAL — היום שבו אושרה הסטייה מהנתיב: 14. ARRIVAL — היום שבו נפלנו: 23. הקוד: 1423.',
    ],
  },
  {
    id: 'docs', part: 2, title: 'מה שבארגז', objective: 'מה הם החזיקו כאן?',
    sub: (s, I) => ['researchDoc', 'schedule'].map((id) => ({ label: I[id].name, done: has(s, id) })),
    done: (s) => has(s, 'researchDoc') && has(s, 'schedule'),
    target: () => at('forest', FL.locker),
  },
  {
    id: 'evidence', part: 2, title: 'הצופה', objective: 'מישהו צפה במחנה. מאיפה?',
    done: (s) => has(s, 'routeChart') && s.flags.encounterDone,
    target: () => at('forest', FL.post),
    start: { thought: '“צופה — הרכס המזרחי.” מאיפה רואים מכאן את כל היער?', delay: 1.0 },
    hints: [
      'קרא את לוח המשמרות בחוברת: איפה הצופה ישב?',
      'השווה את הרכס שבלוח המשמרות למה שרואים דרך המשקפת בקצה המחנה — ולעקבות הטריות שיוצאות מזרחה.',
      'נקודת התצפית על הרכס המזרחי, מעל הצוק. לרכס יש עלייה אחת, דרומית־מזרחית למחנה.',
    ],
  },
  {
    id: 'return', part: 2, title: 'הקריאה', objective: 'המשדר קורא',
    done: (s) => s.flags.endingSeen,
    target: () => at('forest', FL.transmitter),
  },

  // ============================== PART 3 (teaser)
  {
    id: 'part3', part: 3, title: 'האורות ביער', en: 'Someone is still here.',
    objective: 'חלק 3 — בקרוב', final: true,
    done: () => false,
    target: () => null,
  },
];

export const PART_SIZES = { 1: 6, 2: 9 };
export const questById = (id) => QUESTS.findIndex((q) => q.id === id);
