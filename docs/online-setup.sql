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
revoke update on public.friendships from authenticated;
grant update (status) on public.friendships to authenticated;

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
