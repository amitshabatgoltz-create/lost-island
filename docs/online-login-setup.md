# איך להפעיל את ההתחברות עם קוד במייל (ושמות משתמש וחברים)

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

## חלק 1.5: טבלאות לשמות משתמש וחברים (דקה אחת)

1. בתפריט בצד של Supabase: **SQL Editor** ← **New query**.
2. מעתיקים את **כל** הטקסט שבתיבה למטה, מדביקים, ולוחצים **Run**. צריך להופיע **Success**.

```sql
-- LOST online: usernames and friends. Paste all of this into Supabase → SQL Editor → New query → Run.

-- one row per player; the username is their name in the game
create table public.profiles (
  id uuid primary key references auth.users on delete cascade,
  username text not null check (username ~ '^[A-Za-z0-9_א-ת]{3,16}$'),
  handle text generated always as (lower(username)) stored unique,
  created_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
create policy "signed-in players can look up usernames" on public.profiles for select to authenticated using (true);
create policy "players create their own profile" on public.profiles for insert to authenticated with check (id = auth.uid());

-- friend requests: 'pending' until the other player accepts
create table public.friendships (
  requester uuid not null references public.profiles on delete cascade,
  addressee uuid not null references public.profiles on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted')),
  created_at timestamptz not null default now(),
  primary key (requester, addressee),
  check (requester <> addressee)
);
create unique index friendships_pair on public.friendships (least(requester, addressee), greatest(requester, addressee));
alter table public.friendships enable row level security;
create policy "see your own friendships" on public.friendships for select to authenticated using (auth.uid() in (requester, addressee));
create policy "send friend requests" on public.friendships for insert to authenticated with check (requester = auth.uid() and status = 'pending');
create policy "accept requests sent to you" on public.friendships for update to authenticated using (addressee = auth.uid()) with check (addressee = auth.uid() and status = 'accepted');
create policy "decline or remove friends" on public.friendships for delete to authenticated using (auth.uid() in (requester, addressee));

-- which room a player is in; only accepted friends can see it
create table public.presence (
  id uuid primary key references public.profiles on delete cascade,
  room text check (room is null or room ~ '^[A-Z0-9]{6}$'),
  seen_at timestamptz not null default now()
);
alter table public.presence enable row level security;
create policy "friends see your room" on public.presence for select to authenticated using (
  id = auth.uid() or exists (
    select 1 from public.friendships f
    where f.status = 'accepted'
      and ((f.requester = auth.uid() and f.addressee = presence.id) or (f.addressee = auth.uid() and f.requester = presence.id))
  )
);
create policy "set your own room" on public.presence for insert to authenticated with check (id = auth.uid());
create policy "update your own room" on public.presence for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- table access for signed-in players (the policies above decide which rows)
grant select, insert, update, delete on public.profiles, public.friendships, public.presence to authenticated;
revoke update on public.friendships from authenticated;
grant update (status) on public.friendships to authenticated;
```

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
