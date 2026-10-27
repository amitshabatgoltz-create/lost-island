# איך להפעיל את ההתחברות עם קוד במייל

הקוד במשחק כבר מוכן. מה שחסר זה "שרת" ששולח את הקודים למייל. משתמשים ב-**Supabase** (חינם) וב-**Brevo** (חינם, הוא זה ששולח את המיילים בפועל).
עד שזה מוגדר, הכפתור "אונליין" עובד כמו קודם, בלי התחברות.

> כדאי לעשות את זה עם הורה, כי צריך לפתוח חשבונות באתרים.

## חלק 1: Supabase (בערך 5 דקות)

1. נכנסים ל-https://supabase.com ולוחצים **Start your project**. מתחברים עם GitHub.
2. לוחצים **New project**. שם: `lost`. סיסמה: כל דבר (שומרים אותה). אזור: **Europe**. לוחצים **Create new project** ומחכים דקה.
3. בתפריט בצד: **Authentication** ← **Emails** (או **Email Templates**).
4. פותחים את **Magic Link**. מוחקים את מה שכתוב בתיבה הגדולה ומדביקים:
   ```
   <h2>הקוד שלך ל-LOST</h2>
   <p style="font-size:32px;letter-spacing:6px"><b>{{ .Token }}</b></p>
   <p>אם לא ביקשת קוד, אפשר להתעלם מהמייל.</p>
   ```
   לוחצים **Save**.
5. עושים בדיוק אותו דבר גם ב-**Confirm signup**.
6. בתפריט: **Authentication** ← **Sign In / Providers** ← **Email**. אם יש שם **Email OTP Length**, שמים **6** ושומרים.

## חלק 2: Brevo (שולח את המיילים, בערך 5 דקות)

בלי זה Supabase שולח קודים רק לכתובת שלך, לא לחברים.

1. נכנסים ל-https://www.brevo.com ונרשמים בחינם.
2. למעלה מימין: השם שלך ← **Senders, Domains & Dedicated IPs** ← **Senders** ← **Add a sender**. שם: `LOST`. מייל: המייל שלך. מאשרים את המייל שהם שולחים.
3. השם שלך ← **SMTP & API** ← לשונית **SMTP** ← **Generate a new SMTP key**. מעתיקים את ה-**Login** ואת ה-**key**.
4. חוזרים ל-Supabase: **Authentication** ← **Emails** ← **SMTP Settings** ← מדליקים **Enable Custom SMTP** וממלאים:
   - Sender email: המייל שאישרת ב-Brevo
   - Sender name: `LOST`
   - Host: `smtp-relay.brevo.com`
   - Port: `587`
   - Username: ה-Login מ-Brevo
   - Password: ה-key מ-Brevo

   לוחצים **Save**.
5. **Authentication** ← **Rate Limits**: את **emails per hour** משנים ל-`50` ושומרים.

## חלק 3: לשלוח לClaude שני דברים

ב-Supabase: **Project Settings** (גלגל שיניים) ← **API** (או **Data API** / **API Keys**). מעתיקים:

- **Project URL** (נראה כמו `https://abcd.supabase.co`)
- **anon public** key (מחרוזת ארוכה שמתחילה ב-`eyJ`)

שולחים את שניהם בצ'אט, ו-Claude מכניס אותם למשחק. מותר לשלוח אותם, הם לא סודיים. (את ה-key של Brevo ואת הסיסמה **לא** שולחים לאף אחד.)

---

לטכני: המשחק קורא את הערכים מ-`VITE_SUPABASE_URL` ו-`VITE_SUPABASE_ANON_KEY` (קובץ `.env` או משתני סביבה ב-Netlify). הקוד ב-`src/net/auth.js`.
