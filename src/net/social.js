// Usernames and friends, stored in the Supabase database (tables and rules: docs/online-login-setup.md).
//   profiles:    one row per player: username (their name in the game); anyone signed in can look one up
//   presence:    the room a player is in and when they were last seen; only their friends can read it
//   friendships: requester -> addressee, 'pending' until the addressee accepts
import { auth, API_URL, API_KEY } from './auth.js';

export const USERNAME_RE = /^[A-Za-z0-9_א-ת]{3,16}$/;
// a room shown to friends counts as live this long after its last heartbeat
const ROOM_FRESH = 3 * 60e3;

async function rest(method, path, body, prefer) {
  await auth.check();
  const headers = { apikey: API_KEY, Authorization: `Bearer ${auth.token}`, 'Content-Type': 'application/json' };
  if (prefer) headers.Prefer = prefer;
  let res;
  try {
    res = await fetch(API_URL + '/rest/v1/' + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
  } catch (e) {
    throw Object.assign(new Error('network'), { code: 'network' });
  }
  const data = res.status === 204 ? null : await res.json().catch(() => null);
  if (!res.ok) {
    const code = data && data.code === '23505' ? 'taken' : 'network';
    throw Object.assign(new Error((data && data.message) || String(res.status)), { code });
  }
  return data;
}

export const social = {
  profile: null, // { id, username, room, seen_at } once loaded; null while unknown or not created

  async loadProfile() {
    const rows = await rest('GET', `profiles?id=eq.${auth.id}&select=id,username`);
    this.profile = rows && rows[0] ? rows[0] : null;
    return this.profile;
  },

  async createProfile(username) {
    const rows = await rest('POST', 'profiles', { id: auth.id, username }, 'return=representation');
    this.profile = rows[0];
    return this.profile;
  },

  // the room code friends see (null when not in a room); called on join/leave and as a heartbeat
  setRoom(room) {
    if (!this.profile) return Promise.resolve();
    return rest('POST', 'presence', { id: auth.id, room: room || null, seen_at: new Date().toISOString() }, 'resolution=merge-duplicates').catch(() => {});
  },

  // { friends: [{id, username, room}], incoming: [{id, username}], outgoing: [{id, username}] }
  async friends() {
    const me = auth.id;
    const links = await rest('GET', 'friendships?select=requester,addressee,status');
    const ids = [...new Set(links.map((l) => (l.requester === me ? l.addressee : l.requester)))];
    const list = `id=in.(${ids.join(',')})`;
    const [people, rooms] = ids.length
      ? await Promise.all([rest('GET', `profiles?${list}&select=id,username`), rest('GET', `presence?${list}&select=id,room,seen_at`)])
      : [[], []];
    const byId = new Map(people.map((p) => [p.id, p]));
    for (const r of rooms) if (byId.has(r.id)) Object.assign(byId.get(r.id), r);
    const out = { friends: [], incoming: [], outgoing: [] };
    for (const l of links) {
      const p = byId.get(l.requester === me ? l.addressee : l.requester);
      if (!p) continue;
      const live = p.room && p.seen_at && Date.now() - Date.parse(p.seen_at) < ROOM_FRESH;
      if (l.status === 'accepted') out.friends.push({ id: p.id, username: p.username, room: live ? p.room : null });
      else if (l.requester === me) out.outgoing.push({ id: p.id, username: p.username });
      else out.incoming.push({ id: p.id, username: p.username });
    }
    const byName = (a, b) => a.username.localeCompare(b.username);
    out.friends.sort((a, b) => (!!b.room - !!a.room) || byName(a, b));
    out.incoming.sort(byName);
    out.outgoing.sort(byName);
    return out;
  },

  // -> 'sent' | 'accepted' (they had already asked us) | 'not-found' | 'self' | 'already'
  async addFriend(username) {
    const rows = await rest('GET', `profiles?handle=eq.${encodeURIComponent(username.toLowerCase())}&select=id`);
    if (!rows.length) return 'not-found';
    const id = rows[0].id;
    if (id === auth.id) return 'self';
    const links = await rest('GET', `friendships?or=(requester.eq.${id},addressee.eq.${id})&select=requester,status`);
    if (links.length) {
      if (links[0].status === 'pending' && links[0].requester === id) { await this.accept(id); return 'accepted'; }
      return 'already';
    }
    await rest('POST', 'friendships', { requester: auth.id, addressee: id, status: 'pending' });
    return 'sent';
  },

  accept(id) {
    return rest('PATCH', `friendships?requester=eq.${id}&addressee=eq.${auth.id}`, { status: 'accepted' });
  },

  // decline a request, cancel ours, or remove a friend
  remove(id) {
    const me = auth.id;
    return rest('DELETE', `friendships?or=(and(requester.eq.${id},addressee.eq.${me}),and(requester.eq.${me},addressee.eq.${id}))`);
  },

  signOut() { this.profile = null; },
};
