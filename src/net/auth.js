// Online sign-in with an email code: the player types their email, gets a one-time 6-digit code by email
// and types it back. Uses Supabase Auth over plain fetch (no SDK); the session is kept in localStorage.
// The URL and the public "anon" key come from the Supabase project (Project Settings → API). The anon key
// is meant to be public. While they are empty, sign-in is skipped and "Online" opens straight to the rooms.
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

const KEY = 'lost_auth';
export const API_URL = SUPABASE_URL.replace(/\/+$/, '');
export const API_KEY = SUPABASE_KEY;
export const AUTH_ENABLED = !!(SUPABASE_URL && SUPABASE_KEY);

async function call(path, body, token) {
  const headers = { 'Content-Type': 'application/json', apikey: SUPABASE_KEY };
  if (token) headers.Authorization = `Bearer ${token}`;
  let res;
  try {
    res = await fetch(API_URL + '/auth/v1/' + path, { method: 'POST', headers, body: JSON.stringify(body || {}) });
  } catch (e) {
    throw Object.assign(new Error('network'), { code: 'network' });
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const raw = String(data.error_code || data.code || data.error || '');
    const code = res.status === 429 || /rate_limit/.test(raw) ? 'rate-limit'
      : /otp_expired|invalid|token/.test(raw) || res.status === 403 ? 'bad-code'
      : /email/.test(raw) && res.status === 400 ? 'bad-email'
      : 'network';
    throw Object.assign(new Error(raw || String(res.status)), { code });
  }
  return data;
}

function load() {
  try { return JSON.parse(localStorage.getItem(KEY)) || null; } catch (e) { return null; }
}
function store(s) {
  try { if (s) localStorage.setItem(KEY, JSON.stringify(s)); else localStorage.removeItem(KEY); } catch (e) { /* this page only */ }
}
// the user id is in the token too ("sub"), for sessions saved without it
function subOf(jwt) {
  try { return JSON.parse(atob(jwt.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))).sub || ''; } catch (e) { return ''; }
}
function fromResponse(d) {
  return {
    id: (d.user && d.user.id) || subOf(d.access_token),
    access: d.access_token,
    refresh: d.refresh_token,
    expires: d.expires_at ? d.expires_at * 1000 : Date.now() + (d.expires_in || 3600) * 1000,
    email: (d.user && d.user.email) || '',
  };
}

export const auth = {
  session: load(),
  get email() { return this.session ? this.session.email : ''; },
  get id() { return this.session ? this.session.id || subOf(this.session.access) : ''; },
  get token() { return this.session ? this.session.access : ''; },

  // true when there is a usable session (refreshed if it ran out)
  async check() {
    const s = this.session;
    if (!s) return false;
    if (s.expires - Date.now() > 60e3) return true;
    try {
      this.session = fromResponse(await call('token?grant_type=refresh_token', { refresh_token: s.refresh }));
      store(this.session);
      return true;
    } catch (e) {
      // offline: keep the saved session and let the player in; a rejected refresh token signs them out
      if (e.code === 'network') return true;
      this.session = null;
      store(null);
      return false;
    }
  },

  sendCode(email) { return call('otp', { email, create_user: true }); },

  async verify(email, token) {
    this.session = fromResponse(await call('verify', { type: 'email', email, token }));
    if (!this.session.email) this.session.email = email;
    store(this.session);
  },

  signOut() {
    const s = this.session;
    this.session = null;
    store(null);
    if (s) call('logout', {}, s.access).catch(() => {});
  },
};
