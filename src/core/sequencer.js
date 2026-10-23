// Timed events driven by game time (not wall-clock), so cinematics pause with the game and can be
// fast-forwarded in tests. Each `run` returns a handle that can be cancelled.
export class Sequencer {
  constructor() { this.items = []; this.t = 0; }
  after(delay, fn) {
    const item = { at: this.t + delay, fn, dead: false };
    this.items.push(item);
    return { cancel: () => { item.dead = true; } };
  }
  // steps: [[time, fn], ...] relative to now
  run(steps) {
    const handles = steps.map(([t, fn]) => this.after(t, fn));
    return { cancel: () => handles.forEach((h) => h.cancel()) };
  }
  clear() { this.items.length = 0; }
  update(dt) {
    this.t += dt;
    if (!this.items.length) return;
    const due = this.items.filter((i) => !i.dead && i.at <= this.t);
    this.items = this.items.filter((i) => !i.dead && i.at > this.t);
    for (const i of due) i.fn();
  }
}
