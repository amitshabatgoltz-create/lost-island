// Booklet entries. Order = order of slots in the booklet. `part` groups them under a heading.
// `desc` may be a function of the game state (entries that fill in as the player discovers more).
import { CARVINGS, symbolName, SYMBOLS, WIRING_RULES } from './puzzles.js';

const notchWord = (n) => ['', 'חריץ אחד', 'שני חריצים', 'שלושה חריצים'][n];
export const BOOKLET_MESSAGE = 'If you are reading this, the plan went wrong.';
export const FINAL_ENTRY = 'Someone is still here.';
export const LOCKED_FUTURE_SLOTS = 2; // pages for Part 3

const PHOTO_SVG = `<svg viewBox="0 0 300 200" class="clue-art" role="img" aria-label="תצלום: האי מהים ואדם במעיל גשם">
  <defs><filter id="grain"><feTurbulence baseFrequency="0.9" numOctaves="2" seed="4"/><feColorMatrix values="0 0 0 0 0.3  0 0 0 0 0.25  0 0 0 0 0.18  0 0 0 0.22 0"/><feComposite in2="SourceGraphic" operator="in"/></filter></defs>
  <rect x="6" y="6" width="288" height="188" fill="#c9b48e" stroke="#f1e8d4" stroke-width="10"/>
  <rect x="11" y="11" width="278" height="110" fill="#b39a72"/>
  <path d="M11 104 L60 74 L96 82 L130 50 L160 38 L188 56 L220 62 L250 84 L289 92 L289 121 L11 121 Z" fill="#6b5b43"/>
  <path d="M11 121 L289 121 L289 189 L11 189 Z" fill="#8f7a58"/>
  <path d="M30 140 q20 -4 40 0 t40 0 t40 0 t40 0 t40 0 t40 0" fill="none" stroke="#a89070" stroke-width="2"/>
  <g stroke="#3c3226" stroke-width="2"><line x1="210" y1="120" x2="214" y2="40"/><line x1="222" y1="120" x2="215" y2="40"/><line x1="211" y1="100" x2="221" y2="100"/><line x1="212" y1="80" x2="219" y2="80"/><line x1="213" y1="60" x2="218" y2="60"/></g>
  <circle cx="214.5" cy="38" r="3" fill="#7a2a20"/>
  <path d="M170 189 L174 142 Q176 126 186 124 Q197 126 198 142 L202 189 Z" fill="#2c2a26"/>
  <ellipse cx="186" cy="116" rx="9" ry="10" fill="#2c2a26"/>
  <path d="M176 112 Q186 100 196 112" fill="#3a3832"/>
  <rect x="6" y="6" width="288" height="188" filter="url(#grain)" opacity="0.9"/>
</svg>`;

const CAMP_MAP_SVG = `<svg viewBox="0 0 300 220" class="clue-art" role="img" aria-label="מפה מצוירת ביד של היער">
  <rect x="4" y="4" width="292" height="212" rx="3" fill="#ddd0ae" stroke="#9a835f" stroke-width="2"/>
  <path d="M20 200 Q90 186 150 198 T282 192" fill="none" stroke="#5a4630" stroke-width="2" stroke-dasharray="5 4"/>
  <text x="200" y="212" font-size="10" fill="#5a4630" font-family="monospace">SHORE</text>
  <path d="M30 120 Q80 112 130 126 T270 116" fill="none" stroke="#4d6f86" stroke-width="3"/>
  <path d="M150 196 L148 160 L140 120 L120 90 L100 70" fill="none" stroke="#7a5a35" stroke-width="1.6" stroke-dasharray="3 3"/>
  <path d="M100 70 L130 54 L172 40" fill="none" stroke="#7a5a35" stroke-width="1.6" stroke-dasharray="3 3"/>
  <circle cx="98" cy="70" r="6" fill="none" stroke="#3a2e20" stroke-width="2"/><text x="60" y="66" font-size="11" fill="#3a2e20">RELAY</text>
  <rect x="168" y="30" width="16" height="12" fill="none" stroke="#3a2e20" stroke-width="2"/><text x="190" y="40" font-size="11" fill="#3a2e20">CAMP</text>
  <path d="M236 20 L236 150" stroke="#5a4630" stroke-width="1" /><path d="M236 20 l6 6 M236 40 l6 6 M236 60 l6 6 M236 80 l6 6 M236 100 l6 6 M236 120 l6 6" stroke="#5a4630"/>
  <text x="244" y="70" font-size="10" fill="#3a2e20">RIDGE</text>
  <g stroke="#8a2c1f" stroke-width="3" stroke-linecap="round"><path d="M142 188 l12 12 M154 188 l-12 12"/></g>
  <text x="96" y="178" font-size="12" fill="#8a2c1f" font-weight="700">LZ-2</text>
</svg>`;

export const CLUES = [
  // ---------------- Part 1
  {
    id: 'booklet', part: 1, title: 'החוברת',
    desc: 'כריכת עור שחורה עם סמל שלא ראיתי מעולם: עיגול שבור, קו אנכי ושתי נקודות. בפנים — מפה חלקית של האי ושורה אחת בכתב יד.',
    note: 'מי מחזיק מפה של אי שאף אחד לא אמור להכיר?',
  },
  {
    id: 'ticket', part: 1, title: 'כרטיס טיסה קרוע',
    desc: 'כרטיס עלייה למטוס, טיסה NV 2207, מושב 31A. החלק עם שם הנוסע נתלש.',
    note: '31A זה המושב שלידי. הוא היה ריק כל הטיסה. מישהו הזמין אותו — ולא עלה.',
  },
  {
    id: 'device', part: 1, title: 'התקן זיכרון',
    desc: 'התקן קטן עם אותו סמל חרוט עליו. נורית כחולה עדיין מהבהבת. על הצד מודבקת תווית: CACHE / TAIL.',
    note: 'TAIL — הזנב. החלק האחורי של המטוס נפל ליד קצה היער.',
  },
  {
    id: 'document', part: 1, title: 'מסמך פנימי',
    desc: 'דף מודפס בשרוול פלסטיק, נושא את הסמל. תאריך: 14 בספטמבר — תשעה ימים לפני הטיסה. נושא: NV 2207 / 23 SEP. “סטייה מהנתיב אושרה”. השאר מושחר.',
    note: 'הם ידעו על הטיסה שלי תשעה ימים מראש. הם ידעו לאן היא תגיע.',
  },
  // ---------------- Part 2
  {
    id: 'carvings', part: 2, title: 'סימנים חרוטים',
    desc: (s) => {
      const found = CARVINGS.filter((c) => s.flags[c.id]);
      const lines = found.map((c) => `${SYMBOLS.find((x) => x.id === c.symbol).svg.replace('<svg', '<svg class="glyph"')} ${symbolName(c.symbol)} — ${notchWord(c.notches)}`);
      return 'סימנים שנחרטו בקליפת העצים, לאורך העקבות שיוצאות מהמשדר. מתחת לכל סימן — חריצים.<br><br>' +
        (lines.length ? lines.join('<br>') : '') + (found.length < CARVINGS.length ? `<br><br><i>מצאתי ${found.length} מתוך ${CARVINGS.length}.</i>` : '');
    },
    note: 'אותם סימנים יש על המנעול של ארגז האספקה. החריצים... אולי סדר?',
  },
  {
    id: 'serviceCard', part: 2, title: 'כרטיס שירות — RELAY 04',
    desc: 'כרטיס למינציה שהיה בארגז האספקה, ליד תא הכוח: “חיבור מחדש של לוח ההזנה. ארבעה מסופים, ממוספרים מלמעלה (1) למטה (4).”<br><br>' + WIRING_RULES.map((r, i) => `${i + 1}. ${r}`).join('<br>'),
    note: 'שלושה משפטים בלבד. אם קוראים אותם נכון, אין יותר מדרך אחת.',
  },
  {
    id: 'radioLog', part: 2, title: 'יומן רדיו פגום',
    desc: 'כשהמשדר התעורר, הצג הדפיס את מה שנשאר מהיומן. רוב השורות מחוקות. נשארו: “יום 41 — הצוות עזב לפי הנוהל. נשאר צופה אחד.” · “יום 52 — אישור חלון 02:40. ממסר NIGHTJAR, תדר 417.9.” · “יום 53 — אין לענות לערוצים אזרחיים.”',
    note: '417.9 — אותו מספר שחרוט על לוח המשדר. ו“צופה אחד”. מישהו נשאר כאן בכוונה.',
  },
  {
    id: 'photo', part: 2, title: 'תצלום',
    desc: 'תצלום דהוי, צולם מהים: האי, תורן המשדר, ובחזית אדם במעיל גשם כהה שעומד עם הגב למצלמה. בגב התצלום, בעט: “N. — השבוע הראשון. הכל לפי התוכנית.”',
    note: 'הוא עמד ליד התורן שבו אני עמדתי לפני שעה. אין פנים, רק אות אחת.',
    art: PHOTO_SVG,
  },
  {
    id: 'campMap', part: 2, title: 'מפה מצוירת ביד',
    desc: 'מפה שהייתה נעוצה בקיר הבקתה. מסומנים בה המחנה, הממסר והרכס המזרחי. בקצה הדרומי, על קו החוף: X אדום והכיתוב LZ-2.',
    note: 'LZ-2 הוא בדיוק המקום שבו המטוס נפל. הנייר מצהיב — המפה הזאת צוירה לפני שבועות.',
    art: CAMP_MAP_SVG,
  },
  {
    id: 'calendar', part: 2, title: 'לוח שנה מהבקתה',
    desc: 'לוח שנה תלוי על הקיר בבקתה, פתוח על ספטמבר. שני ימים מוקפים באדום: 14 — ולידו “APPROVED”. 23 — ולידו “ARRIVAL · LZ-2”.',
    note: '23 בספטמבר הוא היום שבו נפלנו. ו־14... התאריך של המסמך הפנימי מהחוף.',
  },
  {
    id: 'researchDoc', part: 2, title: 'פרוטוקול מחקר',
    desc: 'PROJECT NIGHTJAR — פרוטוקול שלב 3. תאריך: 2 באוגוסט, שבעה שבועות לפני הטיסה. “מטרת השלב: תיעוד התנהגות של נבדקים בבידוד מלא, ללא ידיעתם. אופן הכניסה: ירידה לא מתוכננת. מספר שורדים צפוי: נמוך. אין ליצור מגע.”',
    note: 'נבדקים. “ירידה לא מתוכננת”. הם קוראים להתרסקות כניסה. האי הזה הוא מעבדה.',
  },
  {
    id: 'schedule', part: 2, title: 'לוח משמרות תצפית',
    desc: 'דף משמרות מלוכלך בבוץ: “צופה — הרכס המזרחי. משמרת לילה. לדווח על כל תנועה ב-LZ-2.” השורה האחרונה בכתב יד: “23/9 · 02:41 — יש מגע.”',
    note: '02:41. דקה אחרי שנפלנו. מישהו ישב על הרכס וחיכה לנו.',
  },
  {
    id: 'routeChart', part: 2, title: 'תרשים נתיב הטיסה',
    desc: 'תרשים מודפס של נתיב NV 2207, עם חותמת תאריך מלפני ההמראה. מעל הנתיב המקורי מישהו שרטט בעיפרון קו שני שסוטה דרומה, אל האי. ליד הסטייה: “02:14 — מערכות. 02:40 — ירידה.” בשוליים: “31A — מלווה. לא לעלות.”',
    note: 'הם ידעו את הנתיב לפני שהמטוס המריא. והמושב הריק שלידי — מישהו קנה אותו כדי שיישאר ריק.',
  },
  {
    id: 'stillHere', part: 2, title: 'רשומה אחרונה',
    desc: 'אחרי השידור, האורות ביער נדלקו אחד אחרי השני, והאות האדום עבר למקום אחר. כתבתי בחוברת את מה שאני כבר לא יכול להכחיש:',
    note: 'Someone is still here.',
    noteEn: true,
  },
];
