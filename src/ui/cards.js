/** Blueprint card on the user's scroll art: page 1 procedural pixel schematic with scan, page 2 text. */
import { Mode, Sfx, Collect, BP_COUNT, CANVAS_W, CANVAS_H } from '../contract.js';
import { ctx } from '../gfx/ctx.js';
import { drawSchematic } from '../gfx/schematic.js';
import { drawText } from '../gfx/pixfont.js';
import { h, mount, unmount, kvTable, pixCanvas, at, drawPanelArt } from './dom.js';

const SCAN_S = 2.2;
const SC = { x: 100, y: 50, w: 160, h: 80 };       // schematic box on the scroll body

/** DOM version of page 1 (used inside the computer terminal). */
export function page1El(card) {
  const { c, g } = pixCanvas(180, 96, 'schem');
  g.fillStyle = '#0d1030'; g.fillRect(0, 0, 180, 96);
  drawSchematic(g, card.id, 10, 8, 160, 80);
  return h('div', { class: 'bp-p1' }, h('div', { class: 'bp-name' }, card.name), h('div', { class: 'bp-sub' }, card.subsystem), c, h('div', { class: 'bp-dates' }, card.dates));
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

let root, card, page, scanT, scanning, result, hint, nameEl, bodyEl, stamp;

function renderDom() {
  bodyEl.textContent = '';
  nameEl.classList.toggle('hidden', page !== 0 || scanning);
  if (page === 1) bodyEl.appendChild(page2El(card));
  hint.textContent = page === 0 ? (scanning ? 'Scanning...' : 'Space: next page') : 'Space: close   A: back';
}

function finishScan() {
  scanning = false;
  if (result !== Collect.ALREADY) { ctx.audio.play(Sfx.BLUEPRINT_GET); ctx.flash('amber'); }
  stamp.classList.remove('hidden'); renderDom();
}

export const blueprintCard = {
  enter({ bp, result: r }) {
    result = r; card = ctx.data.getBlueprint(bp); page = 0;
    scanning = r !== Collect.ALREADY; scanT = 0;
    hint = h('div', { class: 'bp-hint' });
    nameEl = h('div', { class: 'bp-cap', style: at(92, 132, 176, 22) }, h('b', null, card.name), h('span', null, `${card.subsystem}  |  ${card.dates}`));
    bodyEl = h('div', { class: 'bp-pg2', style: at(94, 46, 172, 104) });
    stamp = h('div', { class: `stamp ${r === Collect.ALREADY ? 'old' : ''} hidden`, style: at(222, 118, 50, 12) }, r === Collect.ALREADY ? 'ARCHIVED' : 'RECOVERED');
    root = h('div', { class: 'screen bpscreen' }, nameEl, bodyEl, stamp, h('div', { class: 'bp-foot', style: at(92, 154, 176, 10) }, hint));
    mount(root);
    if (scanning) ctx.audio.play(Sfx.SCAN); else stamp.classList.remove('hidden');
    renderDom();
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
    if (scanT >= SCAN_S) finishScan();
  },
  drawOver(g) {
    g.fillStyle = 'rgba(0,0,0,0.55)'; g.fillRect(0, 0, CANVAS_W, CANVAS_H);
    drawPanelArt(g, 'ui_blueprint_scroll', (c) => { c.fillStyle = '#2a2a5a'; c.fillRect(70, 10, 220, 150); c.strokeStyle = '#7fd0ff'; c.strokeRect(70.5, 10.5, 219, 149); drawText(c, 'BLUEPRINT', 150, 18, '#7fd0ff', 2); });
    if (page !== 0) return;
    const k = scanning ? Math.min(1, scanT / SCAN_S) : 1;
    g.save(); g.beginPath(); g.rect(SC.x - 4, SC.y - 2, SC.w + 8, Math.round((SC.h + 4) * k)); g.clip();
    drawSchematic(g, card.id, SC.x, SC.y, SC.w, SC.h, '#8fe0ff');
    g.restore();
    if (scanning) { const y = SC.y - 2 + Math.round((SC.h + 4) * k); g.fillStyle = '#ffffff'; g.fillRect(SC.x - 6, y, SC.w + 12, 1); g.fillStyle = 'rgba(143,224,255,0.45)'; g.fillRect(SC.x - 6, y - 2, SC.w + 12, 2); }
  },
  action(a) {
    if (a === 'confirm' || a === 'right') {
      if (scanning) { scanT = SCAN_S; return; }
      if (page === 0) { page = 1; ctx.audio.play(Sfx.CURSOR); renderDom(); } else if (a === 'confirm') { ctx.audio.play(Sfx.CONFIRM); ctx.back(); }
    } else if (a === 'left' && page === 1 && !scanning) { page = 0; ctx.audio.play(Sfx.CURSOR); renderDom(); }
    else if (a === 'pause') { ctx.audio.play(Sfx.CANCEL); ctx.back(); }
  },
};
