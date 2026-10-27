// "Play with friends": the room screen (create / join with a code), the in-game badge and the chat.
// The networking code (and PeerJS) is only downloaded the first time this screen is opened.
import { T } from '../i18n/index.js';

const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };

const ERRORS = () => ({
  'bad-code': T('A room code has 6 letters and digits.'),
  'no-room': T('No room with this code. Check the code with your friend.'),
  'room-full': T('This room is full (4 players).'),
  'timeout': T('Could not reach the room. Try again.'),
  'host-left': T('The room was closed by the friend who created it.'),
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
    p.append(el('h2', null, T('Play with Friends')));
    p.append(el('p', 'online-note', T('Up to 4 players in a private room. Everyone plays their own story, and you see each other on the island.')));

    const nameRow = el('label', 'online-row');
    nameRow.append(el('span', null, T('Your name')));
    this.nameIn = el('input');
    this.nameIn.maxLength = 16;
    this.nameIn.autocomplete = 'off';
    this.nameIn.addEventListener('change', () => this.hooks.setName(this.nameIn.value));
    nameRow.append(this.nameIn);
    p.append(nameRow);

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
    p.append(this.offView);

    // in a room: the code to share, who is here, leave
    this.onView = el('div', 'online-view hidden');
    this.codeBox = el('div', 'online-code');
    const copy = el('button', 'btn ghost', T('Copy code'));
    copy.addEventListener('click', () => {
      const code = this.online && this.online.code;
      if (code && navigator.clipboard) navigator.clipboard.writeText(code).then(() => { copy.textContent = T('Copied!'); setTimeout(() => { copy.textContent = T('Copy code'); }, 1500); }, () => {});
    });
    this.shareNote = el('p', 'online-note', T('Send this code to your friends. They open the game, press "Play with Friends" and enter it.'));
    this.list = el('ul', 'online-list');
    const leave = el('button', 'btn ghost', T('Leave the room'));
    leave.addEventListener('click', () => { this.hooks.click(); this.online && this.online.leave(); });
    this.onView.append(this.codeBox, copy, this.shareNote, this.list, leave);
    p.append(this.onView);

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
    this.render();
    this.hooks.onOpen();
  }
  close() {
    this.hooks.setName(this.nameIn.value);
    this.screen.classList.add('hidden');
    this.hooks.onClose();
  }
  get isOpen() { return !this.screen.classList.contains('hidden'); }

  async act(kind) {
    this.hooks.click();
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
