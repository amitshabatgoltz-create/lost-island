// Terms of Use and Privacy: a small panel opened from Settings. The text lives here in both languages
// (not in he.js) because it is long and must say exactly the same thing in each.
// Keep it honest: if the game starts storing or sending something new, update the privacy part.
import { RTL } from './i18n/index.js';

const UPDATED = '2026-10-27';

const EN = {
  title: 'Terms & Privacy',
  tabs: ['Privacy', 'Terms of Use'],
  close: 'Close',
  privacy: `
<p><b>Short version:</b> you can play without any account. The game never asks for your real name, and it does not sell or share your information.</p>
<h4>What is saved on your device</h4>
<p>Your progress, your settings (volume, graphics, mouse), your chosen character and language are saved in your browser's local storage. They stay on your device and are never sent anywhere. Clearing your browser's site data deletes them.</p>
<h4>Play with Friends (online rooms)</h4>
<p>Only if you go online and open a room or join one, the game connects your browser directly to your friends' browsers (WebRTC). To find each other, the browsers use the free PeerJS service (peerjs.com) and Google's STUN servers. Like any website, these services can see your IP address while connecting.</p>
<p>If you sign in to Online with your email, your email is kept only to send you the login code and sign you in. It is not shown to other players and is never used for ads or newsletters.</p>
<p>Inside a room, the other players see the name you type (choose a nickname, not your real name), your character, where you walk on the island and the chat messages you send. Chat is not saved anywhere: it disappears when you leave the room. Rooms are private and only people with the 6-letter code can join.</p>
<h4>Game websites and ads</h4>
<p>If you play LOST on a game website such as Poki or CrazyGames, that website may show ads and use its own cookies. Their privacy policy covers that part.</p>
<h4>Questions</h4>
<p>If you have a question, contact the developer through the page where you found the game.</p>`,
  terms: `
<p>LOST: The Missing Island is a free game. By playing it you agree to these simple rules:</p>
<ul>
<li>Be kind in online rooms. No insults, bullying, or sharing personal details (yours or anyone else's) in names or chat.</li>
<li>Only share your room code with friends you know.</li>
<li>Do not try to break, cheat, or hack the game or other players.</li>
<li>The game, its story, and its art belong to the developer. Please do not copy or sell it as your own.</li>
<li>The game is given "as is". We try hard to keep it working, but cannot promise it will always work or that a save will never be lost.</li>
<li>If you are a kid, play online with a parent's permission.</li>
</ul>
<p>These terms may change when the game is updated. The date below shows the latest version.</p>`,
  updated: `Last updated: ${UPDATED}`,
};

const HE = {
  title: 'תנאי שימוש ופרטיות',
  tabs: ['פרטיות', 'תנאי שימוש'],
  close: 'סגור',
  privacy: `
<p><b>בקצרה:</b> אפשר לשחק בלי שום חשבון. המשחק אף פעם לא מבקש את השם האמיתי שלך, והוא לא מוכר או משתף את המידע שלך.</p>
<h4>מה נשמר במכשיר שלך</h4>
<p>ההתקדמות שלך, ההגדרות (עוצמת קול, גרפיקה, עכבר), הדמות והשפה שבחרת נשמרים באחסון המקומי של הדפדפן. הם נשארים במכשיר שלך ולא נשלחים לשום מקום. מחיקת נתוני האתר בדפדפן מוחקת אותם.</p>
<h4>שחק עם חברים (חדרים אונליין)</h4>
<p>רק אם יוצרים חדר או מצטרפים לחדר, המשחק מחבר את הדפדפן שלך ישירות לדפדפנים של החברים (WebRTC). כדי למצוא אחד את השני, הדפדפנים משתמשים בשירות החינמי PeerJS (peerjs.com) ובשרתי STUN של גוגל. כמו כל אתר, השירותים האלה יכולים לראות את כתובת ה־IP שלך בזמן ההתחברות.</p>
<p>אם מתחברים לאונליין עם אימייל, האימייל נשמר רק כדי לשלוח לך את קוד הכניסה ולחבר אותך. שחקנים אחרים לא רואים אותו, והוא לא משמש לפרסומות או לניוזלטרים.</p>
<p>בתוך החדר, שאר השחקנים רואים את השם שהקלדת (כדאי כינוי ולא שם אמיתי), את הדמות שלך, לאן אתה הולך על האי ואת הודעות הצ'אט ששלחת. הצ'אט לא נשמר בשום מקום ונעלם כשיוצאים מהחדר. החדרים פרטיים, ורק מי שיש לו את הקוד בן 6 התווים יכול להצטרף.</p>
<h4>אתרי משחקים ופרסומות</h4>
<p>אם משחקים ב־LOST באתר משחקים כמו Poki או CrazyGames, האתר יכול להציג פרסומות ולהשתמש בעוגיות (cookies) משלו. מדיניות הפרטיות שלו חלה על החלק הזה.</p>
<h4>שאלות</h4>
<p>יש שאלה? אפשר לפנות למפתח דרך העמוד שבו מצאת את המשחק.</p>`,
  terms: `
<p>המשחק LOST הוא משחק חינמי. כשמשחקים בו מסכימים לכללים הפשוטים האלה:</p>
<ul>
<li>להיות נחמדים בחדרים אונליין. בלי קללות, בלי בריונות, ובלי לשתף פרטים אישיים (שלך או של מישהו אחר) בשם או בצ'אט.</li>
<li>לשלוח את קוד החדר רק לחברים שאתה מכיר.</li>
<li>לא לנסות לשבור, לרמות או לפרוץ את המשחק או שחקנים אחרים.</li>
<li>המשחק, הסיפור והעיצוב שייכים למפתח. בבקשה לא להעתיק או למכור אותו כאילו הוא שלך.</li>
<li>המשחק ניתן "כמו שהוא". אנחנו משתדלים שהוא יעבוד תמיד, אבל לא יכולים להבטיח שלא יהיו תקלות או שהתקדמות לא תימחק אף פעם.</li>
<li>ילדים: לשחק אונליין רק ברשות ההורים.</li>
</ul>
<p>התנאים יכולים להשתנות כשהמשחק מתעדכן. התאריך למטה מראה את הגרסה האחרונה.</p>`,
  updated: `עודכן לאחרונה: ${UPDATED}`,
};

export class LegalPanel {
  constructor() {
    this.L = RTL ? HE : EN;
    this.el = null;
  }

  get isOpen() { return !!this.el && !this.el.classList.contains('hidden'); }

  build() {
    const L = this.L;
    const el = document.createElement('div');
    el.id = 'legal';
    el.className = 'screen hidden';
    el.innerHTML = `
      <div class="panel legal-panel">
        <button class="close-x" aria-label="${L.close}">✕</button>
        <h2>${L.title}</h2>
        <div class="legal-tabs">${L.tabs.map((t, i) => `<button class="legal-tab${i ? '' : ' active'}" data-i="${i}">${t}</button>`).join('')}</div>
        <div class="legal-body"></div>
        <div class="legal-date">${L.updated}</div>
      </div>`;
    document.body.appendChild(el);
    el.querySelector('.close-x').onclick = () => this.close();
    el.addEventListener('click', (e) => { if (e.target === el) this.close(); });
    for (const b of el.querySelectorAll('.legal-tab')) b.onclick = () => this.tab(+b.dataset.i);
    this.el = el;
  }

  tab(i) {
    for (const b of this.el.querySelectorAll('.legal-tab')) b.classList.toggle('active', +b.dataset.i === i);
    const body = this.el.querySelector('.legal-body');
    body.innerHTML = i ? this.L.terms : this.L.privacy;
    body.scrollTop = 0;
  }

  open() {
    if (!this.el) this.build();
    this.tab(0);
    this.el.classList.remove('hidden');
  }

  close() { if (this.el) this.el.classList.add('hidden'); }
}
