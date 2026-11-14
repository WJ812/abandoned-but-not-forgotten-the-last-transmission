/** Blueprint card: 2 pages (schematic with scan effect, then history/telemetry). */
import { Mode, Sfx, Collect, BP_COUNT } from '../contract.js';
import { ctx } from '../gfx/ctx.js';
import { h, mount, unmount, spriteCanvas, kvTable } from './dom.js';

const SCAN_S = 2.2;

export function page1El(card, { scan = false } = {}) {
  const shot = h('div', { class: 'schem-shot' }, spriteCanvas(card.schematic, 0, 'schem'), scan ? h('div', { class: 'scanline' }) : null);
  return h('div', { class: 'bp-p1' },
    h('div', { class: 'bp-name' }, card.name),
    h('div', { class: 'bp-sub' }, card.subsystem),
    h('div', { class: 'schem-frame' }, h('div', { class: 'grid' }), shot, h('span', { class: 'corner tl' }), h('span', { class: 'corner br' })),
    h('div', { class: 'bp-dates' }, card.dates));
}

export function page2El(card) {
  const arch = ctx.engine.game.mode === Mode.ARCHIVIST;
  const left = h('div', { class: 'bp-text' },
    h('div', { class: 'bp-name small' }, card.name),
    (card.explorerPages || []).map((t) => h('p', null, t)),
    arch ? (card.archivistPages || []).map((t) => h('p', { class: 'arch-p' }, t)) : null);
  const right = arch ? h('div', { class: 'bp-tables' },
    h('div', { class: 'tbl-title' }, 'TELEMETRY'), kvTable(card.telemetry),
    h('div', { class: 'tbl-title' }, 'TRUE SCALE (rovers drawn ~2x)'), kvTable(card.trueScale)) : null;
  return h('div', { class: `bp-p2${arch ? ' two' : ''}` }, left, right);
}

let root, card, page, scanT, scanning, bodyEl, shotEl, stamp, hint, result, bpId, titleEl;

function renderPage() {
  bodyEl.textContent = '';
  if (page === 0) {
    const el = page1El(card, { scan: scanning });
    shotEl = el.querySelector('.schem-shot');
    bodyEl.appendChild(el);
    if (scanning) shotEl.style.clipPath = 'inset(0 0 100% 0)';
  } else bodyEl.appendChild(page2El(card));
  titleEl.textContent = `PAGE ${page + 1} / 2`;
  hint.textContent = page === 0 ? (scanning ? 'Scanning...' : 'Space: next page') : 'Space: close';
}

function finishScan() {
  scanning = false;
  if (result !== Collect.ALREADY) { ctx.audio.play(Sfx.BLUEPRINT_GET); ctx.flash('amber'); }
  stamp.classList.remove('hidden');
  renderPage();
  root.querySelector('.scanline')?.remove();
}

export const blueprintCard = {
  enter({ bp, result: r }) {
    bpId = bp; result = r; card = ctx.data.getBlueprint(bp); page = 0;
    scanning = r !== Collect.ALREADY; scanT = 0;
    titleEl = h('span', { class: 'chip' }); hint = h('span', { class: 'hint' });
    bodyEl = h('div', { class: 'bp-body' });
    stamp = h('div', { class: `stamp ${r === Collect.ALREADY ? 'old' : ''} hidden` }, r === Collect.ALREADY ? 'ARCHIVED COPY' : 'RECOVERED');
    root = h('div', { class: 'screen center' },
      h('div', { class: 'card blueprint' },
        h('div', { class: 'card-title' }, h('span', { class: 'chip cy' }, 'BLUEPRINT'), 'TECHNICAL ARCHIVE', titleEl),
        bodyEl, stamp,
        h('div', { class: 'foot' }, hint)));
    mount(root);
    if (scanning) ctx.audio.play(Sfx.SCAN); else stamp.classList.remove('hidden');
    renderPage();
  },
  exit() {
    unmount(root);
    if (result === Collect.COMPLETE) {
      ctx.flash('cyan');
      ctx.toast(`CORE ARCHIVE COMPLETE ${BP_COUNT}/${BP_COUNT}. Return to the Archive Computer in the Hub for the recap.`, 6500);
    }
  },
  update(dt) {
    if (!scanning) return;
    scanT += dt;
    const k = Math.min(1, scanT / SCAN_S);
    if (shotEl) {
      shotEl.style.clipPath = `inset(0 0 ${(1 - k) * 100}% 0)`;
      const sl = shotEl.querySelector('.scanline'); if (sl) sl.style.top = `${k * 100}%`;
    }
    if (k >= 1) finishScan();
  },
  action(a) {
    if (a === 'confirm' || a === 'right') {
      if (scanning) { scanT = SCAN_S; return; }
      if (page === 0) { page = 1; ctx.audio.play(Sfx.CURSOR); renderPage(); } else if (a === 'confirm') { ctx.audio.play(Sfx.CONFIRM); ctx.back(); }
    } else if (a === 'left' && page === 1 && !scanning) { page = 0; ctx.audio.play(Sfx.CURSOR); renderPage(); }
    else if (a === 'pause') { ctx.audio.play(Sfx.CANCEL); ctx.back(); }
  },
};
