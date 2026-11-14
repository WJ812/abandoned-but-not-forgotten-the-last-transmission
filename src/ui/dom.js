/** Tiny DOM helpers shared by every UI screen. */
import { Sfx } from '../contract.js';
import { ctx } from '../gfx/ctx.js';

export function h(tag, props, ...kids) {
  const e = document.createElement(tag);
  if (props) {
    for (const [k, v] of Object.entries(props)) {
      if (v == null || v === false) continue;
      if (k === 'class') e.className = v;
      else if (k === 'text') e.textContent = v;
      else if (k === 'html') e.innerHTML = v;
      else if (k === 'style' && typeof v === 'object') Object.assign(e.style, v);
      else if (k.startsWith('on') && typeof v === 'function') e.addEventListener(k.slice(2).toLowerCase(), v);
      else e.setAttribute(k, v === true ? '' : v);
    }
  }
  const add = (kid) => {
    if (kid == null || kid === false) return;
    if (Array.isArray(kid)) kid.forEach(add);
    else e.appendChild(typeof kid === 'string' || typeof kid === 'number' ? document.createTextNode(String(kid)) : kid);
  };
  kids.forEach(add);
  return e;
}

/** Add `root` to the UI layer and fade it in. */
export function mount(root, parent) {
  (parent || ctx.ui).appendChild(root);
  requestAnimationFrame(() => requestAnimationFrame(() => root.classList.add('in')));
  return root;
}
export function unmount(root) {
  if (!root) return;
  root.classList.remove('in'); root.classList.add('out');
  setTimeout(() => root.remove(), 200);
}

/** A <canvas> showing one frame of a manifest asset (real art or placeholder), pixelated. */
export function spriteCanvas(id, frame = 0, cls = '') {
  const s = ctx.assets.slotOf(id);
  const c = document.createElement('canvas');
  c.width = s.w; c.height = s.h; c.className = `px ${cls}`;
  c.getContext('2d').imageSmoothingEnabled = false;
  ctx.assets.draw(c.getContext('2d'), id, frame, 0, 0);
  c.dataset.asset = id;
  return c;
}
export function redrawSprite(c, frame) {
  const g = c.getContext('2d'); g.clearRect(0, 0, c.width, c.height);
  ctx.assets.draw(g, c.dataset.asset, frame, 0, 0);
}

/** Small pixel canvas with its own 2d context for custom panel art. */
export function pixCanvas(w, h2, cls = '') {
  const c = document.createElement('canvas'); c.width = w; c.height = h2; c.className = `px ${cls}`;
  const g = c.getContext('2d'); g.imageSmoothingEnabled = false;
  return { c, g };
}

/** Typewriter: reveals text char by char, blinking cursor, onChar for talk blips. */
export class Typer {
  constructor(el, { cps = 52, onChar = null } = {}) {
    this.el = el; this.cps = cps; this.onChar = onChar; this.text = ''; this.n = 0; this.acc = 0; this.done = true;
    this.txt = document.createTextNode(''); this.cur = h('span', { class: 'cursor' }); el.append(this.txt, this.cur);
  }
  set(text) { this.text = text; this.n = 0; this.acc = 0; this.done = !text; this.draw(); }
  update(dt) {
    if (this.done) return;
    this.acc += dt * this.cps;
    const add = Math.floor(this.acc); if (!add) return;
    this.acc -= add;
    const from = this.n; this.n = Math.min(this.text.length, this.n + add);
    for (let i = from; i < this.n; i++) {
      const ch = this.text[i];
      if (this.onChar && ch !== ' ' && (i % 3 === 0)) this.onChar(ch, i);
    }
    if (this.n >= this.text.length) this.done = true;
    this.draw();
  }
  skip() { this.n = this.text.length; this.done = true; this.draw(); }
  draw() { this.txt.nodeValue = this.text.slice(0, this.n); this.cur.classList.toggle('wait', this.done); }
}

/** Vertical selectable list used by portal, pause, dialogue and title. */
export class Menu {
  constructor({ items = [], onPick, cls = '' }) {
    this.onPick = onPick; this.index = 0; this.items = items;
    this.el = h('ul', { class: `menu ${cls}` });
    this.render();
  }
  setItems(items, keep = true) { this.items = items; if (!keep || this.index >= items.length) this.index = 0; this.render(); }
  render() {
    this.el.textContent = '';
    this.items.forEach((it, i) => {
      const li = h('li', {
        class: `item${i === this.index ? ' sel' : ''}${it.disabled ? ' off' : ''}${it.cls ? ' ' + it.cls : ''}`,
        onclick: () => { this.index = i; this.render(); this.pick(); },
        onmouseenter: () => { if (this.index !== i) { this.index = i; ctx.audio.play(Sfx.CURSOR); this.render(); } },
      }, h('span', { class: 'mk' }), h('span', { class: 'lb' }, it.label), it.sub ? h('span', { class: 'sub' }, it.sub) : null);
      this.el.appendChild(li);
    });
  }
  move(d) {
    if (!this.items.length) return;
    this.index = (this.index + d + this.items.length) % this.items.length;
    ctx.audio.play(Sfx.CURSOR); this.render();
  }
  pick() { const it = this.items[this.index]; if (it && !it.disabled) this.onPick?.(this.index, it); }
}

/** Table rows from [{label,value}] */
export function kvTable(rows, cls = '') {
  return h('table', { class: `kv ${cls}` }, h('tbody', null, (rows || []).map((r) => h('tr', null, h('th', null, r.label), h('td', null, r.value)))));
}

export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const popcount = (n) => { let c = 0; while (n) { c += n & 1; n >>= 1; } return c; };
