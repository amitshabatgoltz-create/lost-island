// "Online": email-code sign-in, then the room screen (create / join with a code), the in-game badge and the chat.
// The networking code (and PeerJS) is only downloaded the first time this screen is opened.
import { T } from '../i18n/index.js';
import { auth, AUTH_ENABLED } from './auth.js';

const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };

const ERRORS = () => ({
  'bad-code': T('A room code has 6 letters and digits.'),
  'no-room': T('No room with this code. Check the code with your friend.'),
  'room-full': T('This room is full (4 players).'),
  'timeout': T('Could not reach the room. Try again.'),
  'host-left': T('The room was closed by the friend who created it.'),
  'network': T('Connection problem. Check the internet and try again.'),
});

const AUTH_ERRORS = () => ({
  'bad-email': T('That email does not look right. Check it and try again.'),
  'bad-code': T('Wrong or expired code. Check the email or send a new code.'),
  'rate-limit': T('Too many codes were sent. Wait a few minutes and try again.'),
  'network': T('Connection problem. Check the internet and try again.'),
});

export class OnlinePanel {
  // hooks: { getName(), setName(name), getSkin(), onOpen(), onClose(), connect(online), click() }
  constructor(hooks) {
    this.hooks = hooks;
    this.online = null;
    this.status = 'offline';
    this.build();
  }

  // ------------------------------------------------------------------ DOM
  build() {
    const scr = el('div', 'screen hidden online-screen');
    scr.id = 'online';
    const p = el('div', 'panel online-panel');
    p.append(el('h2', null, T('Online')));
    p.append(el('p', 'online-note', T('Up to 4 players in a private room. Everyone plays their own story, and you see each other on the island.')));

    // sign in with an email code (only when sign-in is set up, see auth.js)
    this.loginView = el('div', 'online-view hidden');
    this.emailStep = el('div', 'online-view');
    this.emailStep.append(el('p', 'online-note', T('To play online, sign in with your email. We will send you a 6-digit code.')));
    this.emailIn = el('input');
    this.emailIn.type = 'email';
    this.emailIn.placeholder = T('Your email');
    this.emailIn.autocomplete = 'email';
    this.emailIn.dir = 'ltr';
    this.emailIn.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter') this.sendCode(); });
    const send = el('button', 'btn primary', T('Send me a code'));
    send.addEventListener('click', () => this.sendCode());
    this.emailStep.append(this.emailIn, send);
    this.codeStep = el('div', 'online-view hidden');
    this.sentNote = el('p', 'online-note');
    this.otpIn = el('input', 'online-otp');
    this.otpIn.inputMode = 'numeric';
    this.otpIn.autocomplete = 'one-time-code';
    this.otpIn.maxLength = 8;
    this.otpIn.placeholder = '000000';
    this.otpIn.addEventListener('input', () => { this.otpIn.value = this.otpIn.value.replace(/\D/g, ''); });
    this.otpIn.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter') this.verify(); });
    const verify = el('button', 'btn primary', T('Sign in'));
    verify.addEventListener('click', () => this.verify());
    const back = el('button', 'btn ghost', T('Change email / send a new code'));
    back.addEventListener('click', () => { this.hooks.click(); this.showCodeStep(false); });
    this.codeStep.append(this.sentNote, this.otpIn, verify, back);
    this.loginView.append(this.emailStep, this.codeStep);
    p.append(this.loginView);

    this.mainView = el('div', 'online-view');
    this.account = el('div', 'online-account hidden');
    this.accountEmail = el('span');
    const signOut = el('button', 'btn ghost small', T('Sign out'));
    signOut.addEventListener('click', () => { this.hooks.click(); this.online && this.online.leave(); auth.signOut(); this.setMsg(''); this.render(); });
    this.account.append(this.accountEmail, signOut);
    this.mainView.append(this.account);

    const nameRow = el('label', 'online-row');
    nameRow.append(el('span', null, T('Your name')));
    this.nameIn = el('input');
    this.nameIn.maxLength = 16;
    this.nameIn.autocomplete = 'off';
    this.nameIn.addEventListener('change', () => this.hooks.setName(this.nameIn.value));
    nameRow.append(this.nameIn);
    this.mainView.append(nameRow);

    // offline: create or join
    this.offView = el('div', 'online-view');
    const create = el('button', 'btn primary', T('Create a room'));
    create.addEventListener('click', () => this.act('host'));
    const joinRow = el('div', 'online-join');
    this.codeIn = el('input');
    this.codeIn.placeholder = T('Room code');
    this.codeIn.maxLength = 6;
    this.codeIn.autocomplete = 'off';
    this.codeIn.addEventListener('input', () => { this.codeIn.value = this.codeIn.value.toUpperCase().replace(/[^A-Z0-9]/g, ''); });
    this.codeIn.addEventListener('keydown', (e) => { if (e.key === 'Enter') this.act('join'); });
    const join = el('button', 'btn', T('Join'));
    join.addEventListener('click', () => this.act('join'));
    joinRow.append(this.codeIn, join);
    this.offView.append(create, el('div', 'online-or', T('or join a friend')), joinRow);
    this.mainView.append(this.offView);

    // in a room: the code to share, who is here, leave
    this.onView = el('div', 'online-view hidden');
    this.codeBox = el('div', 'online-code');
    const copy = el('button', 'btn ghost', T('Copy code'));
    copy.addEventListener('click', () => {
      const code = this.online && this.online.code;
      if (code && navigator.clipboard) navigator.clipboard.writeText(code).then(() => { copy.textContent = T('Copied!'); setTimeout(() => { copy.textContent = T('Copy code'); }, 1500); }, () => {});
    });
    this.shareNote = el('p', 'online-note', T('Send this code to your friends. They open the game, press "Online" and enter it.'));
    this.list = el('ul', 'online-list');
    const leave = el('button', 'btn ghost', T('Leave the room'));
    leave.addEventListener('click', () => { this.hooks.click(); this.online && this.online.leave(); });
    this.onView.append(this.codeBox, copy, this.shareNote, this.list, leave);
    this.mainView.append(this.onView);
    p.append(this.mainView);

    this.msg = el('div', 'online-msg');
    p.append(this.msg);
    const close = el('button', 'btn', T('Close'));
    close.addEventListener('click', () => this.close());
    p.append(close);
    scr.append(p);
    document.body.append(scr);
    this.screen = scr;

    // in-game badge + chat
    this.badge = el('div', 'net-badge hidden');
    document.body.append(this.badge);
    this.log = el('div', 'chat-log');
    document.body.append(this.log);
    this.chatIn = el('input', 'chat-input hidden');
    this.chatIn.maxLength = 140;
    this.chatIn.placeholder = T('Message to your friends · Enter to send · Esc to cancel');
    this.chatIn.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Enter') { this.sendChat(this.chatIn.value); this.closeChat(); }
      else if (e.key === 'Escape') this.closeChat();
    });
    document.body.append(this.chatIn);
  }

  // ------------------------------------------------------------------ open / close
  open() {
    this.nameIn.value = this.hooks.getName();
    this.screen.classList.remove('hidden');
    this.setMsg('');
    this.render();
    this.hooks.onOpen();
    // a saved session may need refreshing; until then the sign-in view stays up
    if (AUTH_ENABLED && auth.session) auth.check().then(() => this.render());
  }

  get signedIn() { return !AUTH_ENABLED || !!auth.session; }

  // ------------------------------------------------------------------ sign in
  showCodeStep(on) {
    this.emailStep.classList.toggle('hidden', on);
    this.codeStep.classList.toggle('hidden', !on);
    this.setMsg('');
    if (on) { this.otpIn.value = ''; this.otpIn.focus(); } else this.emailIn.focus();
  }

  async sendCode() {
    if (this.busy) return;
    this.hooks.click();
    const email = this.emailIn.value.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { this.setMsg(AUTH_ERRORS()['bad-email'], true); return; }
    this.busy = true;
    this.setMsg(T('Sending…'));
    try {
      await auth.sendCode(email);
      this.pendingEmail = email;
      this.showCodeStep(true);
      this.sentNote.textContent = T`We sent a code to ${email}. Type it here (check spam too).`;
    } catch (e) {
      console.error(e);
      this.setMsg(AUTH_ERRORS()[e.code] || AUTH_ERRORS().network, true);
    }
    this.busy = false;
  }

  async verify() {
    if (this.busy) return;
    this.hooks.click();
    const code = this.otpIn.value.trim();
    if (code.length < 6) { this.setMsg(T('The code has 6 digits.'), true); return; }
    this.busy = true;
    this.setMsg(T('Checking…'));
    try {
      await auth.verify(this.pendingEmail, code);
      this.showCodeStep(false);
      this.setMsg(T('Signed in!'));
      this.render();
    } catch (e) {
      console.error(e);
      this.setMsg(AUTH_ERRORS()[e.code] || AUTH_ERRORS().network, true);
    }
    this.busy = false;
  }
  close() {
    this.hooks.setName(this.nameIn.value);
    this.screen.classList.add('hidden');
    this.hooks.onClose();
  }
  get isOpen() { return !this.screen.classList.contains('hidden'); }

  async act(kind) {
    this.hooks.click();
    if (!this.signedIn) { this.render(); return; }
    this.hooks.setName(this.nameIn.value);
    if (!this.online) {
      this.setMsg(T('Connecting…'));
      try { this.online = await this.hooks.connect(); } catch (e) { console.error(e); this.setMsg(ERRORS().network, true); return; }
    }
    this.online.setProfile(this.hooks.getName(), this.hooks.getSkin());
    if (kind === 'host') this.online.host(); else this.online.join(this.codeIn.value);
  }

  // ------------------------------------------------------------------ events from Online
  onStatus(status, detail) {
    this.status = status;
    if (status === 'connecting') this.setMsg(T('Connecting…'));
    else if (status === 'hosting' || status === 'joined') { this.setMsg(status === 'joined' ? T('Connected!') : ''); if (status === 'joined') this.addLine(null, T('You joined the room.')); }
    else if (status === 'error') { this.setMsg(ERRORS()[detail] || ERRORS().network, true); this.addLine(null, ERRORS()[detail] || ERRORS().network); }
    else this.setMsg('');
    this.render();
  }
  onRoster(list) { this.roster = list; this.render(); }
  onChat(name, text) { this.addLine(name, text); }
  onJoinLeave(name, joined) { this.addLine(null, joined ? T`${name} joined.` : T`${name} left.`); }

  setMsg(text, bad = false) {
    this.msg.textContent = text || '';
    this.msg.classList.toggle('bad', !!bad);
  }

  render() {
    const signedIn = this.signedIn;
    this.loginView.classList.toggle('hidden', signedIn);
    this.mainView.classList.toggle('hidden', !signedIn);
    this.account.classList.toggle('hidden', !(AUTH_ENABLED && signedIn));
    if (AUTH_ENABLED && signedIn) this.accountEmail.replaceChildren(T('Signed in as') + ' ', el('bdi', null, auth.email));
    const on = !!(this.online && this.online.active);
    this.offView.classList.toggle('hidden', on);
    this.onView.classList.toggle('hidden', !on);
    if (on) {
      this.codeBox.textContent = this.online.code;
      this.shareNote.classList.toggle('hidden', this.online.role !== 'host');
      this.list.innerHTML = '';
      for (const r of this.roster || []) {
        const li = el('li', null, r.name);
        if (r.self) li.append(el('span', 'tag', T('you')));
        if (r.host) li.append(el('span', 'tag', T('host')));
        this.list.append(li);
      }
    }
    this.renderBadge();
  }

  renderBadge(nearby = 0) {
    const on = !!(this.online && this.online.active);
    this.badge.classList.toggle('hidden', !on);
    if (!on) return;
    const n = this.online.count;
    this.badge.textContent = T`Room ${this.online.code} · ${n}/4 · Enter: chat` + (n > 1 && nearby === 0 ? ' · ' + T('friends are in another area') : '');
  }

  // ------------------------------------------------------------------ chat
  openChat() {
    if (!this.online || !this.online.active) return false;
    this.chatIn.value = '';
    this.chatIn.classList.remove('hidden');
    this.chatIn.focus();
    return true;
  }
  closeChat() {
    this.chatIn.classList.add('hidden');
    this.chatIn.blur();
    this.hooks.onChatClosed && this.hooks.onChatClosed();
  }
  get chatting() { return !this.chatIn.classList.contains('hidden'); }

  sendChat(text) {
    const sent = this.online && this.online.chat(text);
    if (sent) this.addLine(this.hooks.getName(), sent, true);
  }

  addLine(name, text, mine = false) {
    const line = el('div', 'chat-line' + (mine ? ' mine' : '') + (name ? '' : ' sys'));
    if (name) line.append(el('b', null, name + ': '));
    line.append(document.createTextNode(text));
    this.log.append(line);
    while (this.log.children.length > 6) this.log.firstChild.remove();
    setTimeout(() => line.classList.add('old'), 12000);
  }
}
