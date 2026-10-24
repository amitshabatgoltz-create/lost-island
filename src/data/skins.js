// Player characters ("skins"). Every skin is a rigged Mixamo character; the animation clips live in
// survivor.glb and are shared by all of them (the skin files carry only mesh, skeleton and textures,
// with their bones renamed to survivor.glb's names). See tools/skins/README.md for adding one.
// height: metres, when the file's units are not centimetres · hide: meshes that do not survive the conversion
export const SKINS = [
  { id: 'alex', file: 'survivor.glb', name: 'אלכס', role: 'הנוסע', desc: 'קפוצ׳ון שחור ונעלי ספורט. ישב ליד החלון כשהמטוס התחיל לרעוד.' },
  { id: 'noa', file: 'skins/ch02.glb', name: 'נועה', role: 'הסטודנטית', desc: 'סווטשירט כתום ומכנסי ג׳ינס קצרים. טסה הביתה לחופשת הקיץ.' },
  { id: 'marcus', file: 'skins/ch06.glb', name: 'מרקוס', role: 'המוזיקאי', desc: 'אוזניות, כובע מצחייה ונעלי הליכה גבוהות. לא מוריד את האוזניות גם כאן.' },
  { id: 'sara', file: 'skins/ch07.glb', name: 'שרה', role: 'עורכת הדין', desc: 'חליפה כחולה ונעלי עקב. הייתה בדרך לישיבה הכי חשובה בקריירה.' },
  { id: 'daniel', file: 'skins/ch01.glb', name: 'דניאל', role: 'המהנדס', desc: 'חולצת פולו וג׳ינס. יודע לתקן כמעט כל דבר — אם רק יש כלים.' },
  { id: 'yoni', file: 'skins/ch08.glb', name: 'יוני', role: 'המאמן', desc: 'אימונית בהירה וזקן. רגיל לרוץ מרחקים ארוכים.' },
  { id: 'maya', file: 'skins/ch22.glb', name: 'מאיה', role: 'הצלמת', desc: 'חולצה לבנה וג׳ינס קרוע. שמה לב לכל פרט קטן.' },
  { id: 'remy', file: 'skins/remy.glb', name: 'רמי', role: 'המטייל', desc: 'מכנסי דגמ״ח קצרים וטי־שירט. כבר טייל בחצי עולם — אבל לא באי כזה.', height: 1.8, hide: ['Eyelashes'] },
];

// existing players, and anyone who never picked, are the original survivor
export const DEFAULT_SKIN = 'alex';
export const skinById = (id) => SKINS.find((s) => s.id === id) || SKINS[0];
