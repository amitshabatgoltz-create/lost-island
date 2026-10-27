// Online with friends: a private room of up to 4 players who see each other walking around the island.
// Each player keeps their own story and save; only position, animation state, character and chat are shared.
//
// Transport: PeerJS (WebRTC data channels). GitHub Pages cannot run a server, so the player who creates the
// room is the host: every guest connects to the host, and the host relays each player's updates to the others.
// The PeerJS cloud server is only used to introduce the browsers to each other.
//   ?peerhost=localhost&peerport=9000&peersecure=0   use a different PeerJS server (tests, self-hosting)
import { Peer } from 'peerjs';

export const MAX_PLAYERS = 4;
const PREFIX = 'lost-island-room-';
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O, 1/I lookalikes
const SEND_HZ = 10;

function peerOptions() {
  const p = new URLSearchParams(location.search);
  const opts = {
    debug: 0,
    config: { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:stun1.l.google.com:19302' }] },
  };
  if (p.get('peerhost')) {
    opts.host = p.get('peerhost');
    opts.port = +(p.get('peerport') || 443);
    opts.path = p.get('peerpath') || '/';
    opts.secure = p.get('peersecure') !== '0';
  }
  return opts;
}

export const newRoomCode = () => Array.from({ length: 6 }, () => ALPHABET[Math.floor(Math.random() * ALPHABET.length)]).join('');
export const cleanCode = (s) => String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
const cleanName = (s) => String(s || '').replace(/[<>]/g, '').trim().slice(0, 16);
const cleanChat = (s) => String(s || '').replace(/\s+/g, ' ').trim().slice(0, 140);

// events: onStatus(status, detail), onRoster(list), onState(id, state), onChat(id, name, text), onLeave(id)
export class Online {
  constructor(events) {
    this.ev = events;
    this.peer = null;
    this.role = null; // 'host' | 'guest' | null
    this.code = null;
    this.selfId = null;
    this.me = { name: '', skin: 'alex' };
    this.players = new Map(); // id -> { id, name, skin, conn? }  (excludes self)
    this.hostConn = null;
    this.sendT = 0;
  }

  get active() { return !!this.role; }
  get count() { return this.active ? this.players.size + 1 : 0; }

  setProfile(name, skin) {
    this.me.name = cleanName(name) || 'Survivor';
    this.me.skin = skin;
    if (this.active) this.broadcastSelf();
  }

  // ------------------------------------------------------------------ create / join / leave
  host() {
    this.leave(true);
    const tryCode = (attempt) => {
      const code = newRoomCode();
      const peer = new Peer(PREFIX + code, peerOptions());
      this.peer = peer;
      this.ev.onStatus('connecting');
      peer.on('open', (id) => {
        this.role = 'host';
        this.code = code;
        this.selfId = id;
        this.ev.onStatus('hosting', code);
        this.emitRoster();
      });
      peer.on('connection', (conn) => this.acceptGuest(conn));
      peer.on('error', (err) => {
        if (err.type === 'unavailable-id' && attempt < 4) { peer.destroy(); tryCode(attempt + 1); return; }
        this.fail(err);
      });
      peer.on('disconnected', () => { if (this.role === 'host' && !peer.destroyed) peer.reconnect(); });
    };
    tryCode(0);
  }

  join(rawCode) {
    const code = cleanCode(rawCode);
    if (code.length !== 6) { this.ev.onStatus('error', 'bad-code'); return; }
    this.leave(true);
    const peer = new Peer(peerOptions());
    this.peer = peer;
    this.ev.onStatus('connecting');
    peer.on('open', (id) => {
      this.selfId = id;
      const conn = peer.connect(PREFIX + code, { reliable: true, metadata: { name: this.me.name, skin: this.me.skin } });
      this.hostConn = conn;
      const timer = setTimeout(() => { if (this.role !== 'guest') this.fail({ type: 'timeout' }); }, 15000);
      conn.on('open', () => {
        clearTimeout(timer);
        this.role = 'guest';
        this.code = code;
        conn.send({ t: 'hello', name: this.me.name, skin: this.me.skin });
      });
      conn.on('data', (m) => this.onGuestData(m));
      conn.on('close', () => { if (this.role === 'guest') { this.leave(true); this.ev.onStatus('error', 'host-left'); } });
      conn.on('error', (err) => this.fail(err));
    });
    peer.on('error', (err) => this.fail(err.type === 'peer-unavailable' ? { type: 'no-room' } : err));
  }

  leave(quiet = false) {
    if (this.hostConn) { try { this.hostConn.send({ t: 'bye' }); this.hostConn.close(); } catch (e) { /* already closed */ } }
    for (const p of this.players.values()) { if (p.conn) try { p.conn.send({ t: 'closed' }); p.conn.close(); } catch (e) { /* already closed */ } }
    for (const id of this.players.keys()) this.ev.onLeave(id);
    this.players.clear();
    if (this.peer) { try { this.peer.destroy(); } catch (e) { /* already gone */ } }
    this.peer = null;
    this.hostConn = null;
    this.role = null;
    this.code = null;
    if (!quiet) this.ev.onStatus('offline');
    this.emitRoster();
  }

  fail(err) {
    const kind = err && err.type;
    this.leave(true);
    this.ev.onStatus('error', kind === 'no-room' ? 'no-room' : kind === 'timeout' ? 'timeout' : kind === 'room-full' ? 'room-full' : 'network');
  }

  // ------------------------------------------------------------------ host side
  acceptGuest(conn) {
    conn.on('open', () => {
      if (this.players.size + 1 >= MAX_PLAYERS) { conn.send({ t: 'full' }); setTimeout(() => conn.close(), 300); return; }
      const meta = conn.metadata || {};
      const p = { id: conn.peer, name: cleanName(meta.name) || 'Survivor', skin: String(meta.skin || 'alex'), conn };
      this.players.set(p.id, p);
      conn.send({ t: 'welcome', code: this.code, host: this.selfId });
      this.emitRoster();
      this.ev.onStatus('hosting', this.code);
    });
    conn.on('data', (m) => this.onHostData(conn.peer, m));
    conn.on('close', () => this.dropGuest(conn.peer));
    conn.on('error', () => this.dropGuest(conn.peer));
  }

  dropGuest(id) {
    if (!this.players.has(id)) return;
    this.players.delete(id);
    this.ev.onLeave(id);
    this.relay({ t: 'left', id });
    this.emitRoster();
  }

  onHostData(id, m) {
    const p = this.players.get(id);
    if (!p || !m || typeof m !== 'object') return;
    if (m.t === 'hello' || m.t === 'profile') {
      p.name = cleanName(m.name) || p.name;
      p.skin = String(m.skin || p.skin);
      this.emitRoster();
    } else if (m.t === 's') {
      this.ev.onState(id, m);
      this.relay({ ...m, id }, id);
    } else if (m.t === 'chat') {
      const text = cleanChat(m.text);
      if (!text) return;
      this.ev.onChat(id, p.name, text);
      this.relay({ t: 'chat', id, name: p.name, text }, id);
    } else if (m.t === 'bye') {
      this.dropGuest(id);
    }
  }

  relay(msg, exceptId) {
    for (const p of this.players.values()) if (p.id !== exceptId && p.conn && p.conn.open) p.conn.send(msg);
  }

  // ------------------------------------------------------------------ guest side
  onGuestData(m) {
    if (!m || typeof m !== 'object') return;
    if (m.t === 'welcome') {
      this.ev.onStatus('joined', this.code);
    } else if (m.t === 'full') {
      this.fail({ type: 'room-full' });
    } else if (m.t === 'roster') {
      const seen = new Set();
      for (const r of m.list) {
        if (r.id === this.selfId) continue;
        seen.add(r.id);
        this.players.set(r.id, { id: r.id, name: cleanName(r.name) || 'Survivor', skin: String(r.skin || 'alex') });
      }
      for (const id of [...this.players.keys()]) if (!seen.has(id)) { this.players.delete(id); this.ev.onLeave(id); }
      this.ev.onRoster(this.roster());
    } else if (m.t === 's') {
      if (m.id && m.id !== this.selfId) this.ev.onState(m.id, m);
    } else if (m.t === 'chat') {
      const text = cleanChat(m.text);
      if (text && m.id !== this.selfId) this.ev.onChat(m.id, cleanName(m.name), text);
    } else if (m.t === 'left') {
      if (this.players.delete(m.id)) { this.ev.onLeave(m.id); this.ev.onRoster(this.roster()); }
    } else if (m.t === 'closed') {
      this.leave(true);
      this.ev.onStatus('error', 'host-left');
    }
  }

  // ------------------------------------------------------------------ shared
  roster() {
    const list = [{ id: this.selfId, name: this.me.name, skin: this.me.skin, self: true, host: this.role === 'host' }];
    for (const p of this.players.values()) list.push({ id: p.id, name: p.name, skin: p.skin, host: this.role === 'guest' && this.hostConn && p.id === this.hostConn.peer });
    return this.active ? list : [];
  }

  emitRoster() {
    if (this.role === 'host') {
      const list = [{ id: this.selfId, name: this.me.name, skin: this.me.skin }, ...[...this.players.values()].map((p) => ({ id: p.id, name: p.name, skin: p.skin }))];
      this.relay({ t: 'roster', list });
    }
    this.ev.onRoster(this.roster());
  }

  broadcastSelf() {
    if (this.role === 'guest' && this.hostConn && this.hostConn.open) this.hostConn.send({ t: 'profile', name: this.me.name, skin: this.me.skin });
    if (this.role === 'host') this.emitRoster();
  }

  // own position, ~10 times a second
  tick(dt, state) {
    if (!this.active || !state) return;
    this.sendT -= dt;
    if (this.sendT > 0) return;
    this.sendT = 1 / SEND_HZ;
    const msg = { t: 's', ...state };
    if (this.role === 'guest') { if (this.hostConn && this.hostConn.open) this.hostConn.send(msg); } else this.relay({ ...msg, id: this.selfId });
  }

  chat(raw) {
    const text = cleanChat(raw);
    if (!text || !this.active) return null;
    if (this.role === 'guest') { if (this.hostConn && this.hostConn.open) this.hostConn.send({ t: 'chat', text }); } else this.relay({ t: 'chat', id: this.selfId, name: this.me.name, text });
    return text;
  }
}
