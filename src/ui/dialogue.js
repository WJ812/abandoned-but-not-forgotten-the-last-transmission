/**
 * Dialogue on the user's dialogue-box art: portrait, typewriter text with talk blips, a Pokemon-style
 * question menu plus Goodbye, and the "SIGNAL ~11 min" bar before each Mars answer. Talking to a rover
 * also opens ALL of its hardware on the same screen (combined screen).
 */
import { Robot, Mode, Sfx, LATENCY, Prop, CANVAS_W, CANVAS_H } from '../contract.js';
import { ctx } from '../gfx/ctx.js';
import { h, mount, unmount, spriteCanvas, redrawSprite, Typer, Menu, at, drawPanelArt } from './dom.js';
import { createHardware } from './props.js';

const HW = {
  [Robot.LRV]: [Prop.LRV_NAV, Prop.LRV_BATTERY, Prop.LRV_CAMERA, Prop.LRV_FENDER],
  [Robot.SOJOURNER]: [Prop.SOJ_SOLAR, Prop.SOJ_APXS, Prop.SOJ_HAZARD, Prop.SOJ_DRIVE],
};

let root, d, robot, st, pages, pi, archFrom, typer, menu, portrait, eqEls, eqT, sigWrap, sigFill, sigPct, textBox, pageTag, archTag, qIdx, lastTick, lastFrame;
let hw = null, focus = 0, hintEl, menuWrap;

const blipId = () => (robot === Robot.LRV ? Sfx.TALK_LRV : Sfx.TALK_SOJ);

function setPages(list, nextState, from = Infinity) {
  pages = list.length ? list : ['...']; pi = 0; archFrom = from; st = nextState;
  showPage();
}
function showPage() {
  textBox.classList.remove('hidden'); menuWrap.classList.add('hidden'); sigWrap.classList.add('hidden');
  typer.set(pages[pi]);
  pageTag.textContent = pages.length > 1 ? `${pi + 1}/${pages.length}` : '';
  archTag.classList.toggle('hidden', !(pi >= archFrom));
}

function toMenu() {
  st = 'menu';
  const E = ctx.engine;
  menu.setItems([
    ...d.questions.map((q) => ({ label: q.label, sub: E.hasAsked(robot, q.id) ? '✓' : '' })),
    { label: 'Goodbye', cls: 'bye' },
  ]);
  textBox.classList.add('hidden'); sigWrap.classList.add('hidden'); menuWrap.classList.remove('hidden');
}

function pickMenu(i) {
  const E = ctx.engine;
  if (i >= d.questions.length) return goodbye();
  qIdx = i;
  menuWrap.classList.add('hidden');
  if (d.latency) {
    st = 'signal'; lastTick = 0;
    E.latencyStart();
    textBox.classList.add('hidden'); sigWrap.classList.remove('hidden');
    sigFill.style.width = '0%';
  } else startAnswer();
}

function startAnswer() {
  const q = d.questions[qIdx]; const arch = ctx.engine.game.mode === Mode.ARCHIVIST;
  setPages([...q.answer, ...(arch ? (q.archivist || []) : [])], 'answer', q.answer.length);
}

function goodbye() { setPages(d.goodbye, 'bye'); }

function advance() {
  if (!typer.done) { typer.skip(); return; }
  ctx.audio.play(Sfx.CURSOR);
  if (pi + 1 < pages.length) { pi++; showPage(); return; }
  const E = ctx.engine;
  if (st === 'greet') { E.markRobotTalked(robot); toMenu(); }
  else if (st === 'answer') { E.markAsked(robot, d.questions[qIdx].id); toMenu(); }
  else if (st === 'bye') ctx.back();
}

function setFocus(n) {
  focus = n; hw?.setFocus(n - 1);
  const names = hw ? '  Tab: next area  1: dialogue  2-5: hardware' : '';
  hintEl.textContent = focus === 0
    ? `${st === 'menu' ? 'W/S choose  Space ask  Esc goodbye' : 'Space: continue  Esc: skip'}${names}`
    : `Hardware ${focus + 1}: W/S control  Space run  A/D adjust  Esc back to dialogue${names}`;
}

export const dialogue = {
  enter({ robot: r }) {
    const E = ctx.engine;
    robot = r; d = ctx.data.getDialogue(r); st = 'greet'; lastFrame = -1; focus = 0;
    hw = HW[r] ? createHardware(HW[r]) : null;
    portrait = spriteCanvas(d.portrait, 0, 'portrait');
    eqEls = Array.from({ length: 6 }, () => h('i'));
    const txt = h('p', { class: 'dlg-text' });
    pageTag = h('span', { class: 'page-tag' }); archTag = h('span', { class: 'arch-tag hidden' }, 'ARCHIVIST');
    textBox = h('div', { class: 'dlg-textwrap' }, txt, h('div', { class: 'dlg-meta' }, archTag, pageTag, h('span', { class: 'adv' }, '▼')));
    sigFill = h('i'); sigPct = h('span', { class: 'sig-pct' }, '0%');
    sigWrap = h('div', { class: 'signal hidden' },
      h('div', { class: 'sig-head' }, h('span', { class: 'sig-label' }, LATENCY.LABEL), sigPct),
      h('div', { class: 'sig-bar' }, sigFill),
      h('div', { class: 'sig-sub' }, E.game.mode === Mode.ARCHIVIST ? `${LATENCY.LABEL_ROUND_TRIP}. Delay varied as the planets moved (about 10.6 min at landing). Compressed to ${LATENCY.GAUGE_REAL_S} s.` : `Earth-Mars light time, compressed to ${LATENCY.GAUGE_REAL_S} s.`));
    menu = new Menu({ cls: 'dq', items: [], onPick: (i) => { ctx.audio.play(Sfx.CONFIRM); pickMenu(i); } });
    menuWrap = h('div', { class: 'dq-wrap hidden' }, menu.el);
    typer = new Typer(txt, { cps: 52, onChar: () => ctx.audio.blip(blipId()) });
    hintEl = h('div', { class: 'dlg-hint', style: at(10, 171, 340, 8) });
    root = h('div', { class: 'screen dialogue' },
      hw ? h('div', { class: 'hw-area', style: at(4, 6, 352, 86) }, hw.el) : null,
      h('div', { class: 'dlg-portrait', style: at(17, 113, 46, 46) }, portrait),
      h('div', { class: 'dlg-name', style: at(16, 96, 68, 18) }, h('span', { class: 'who' }, d.name), h('div', { class: 'eq' }, eqEls)),
      h('div', { class: 'dbox', style: at(70, 113, 272, 54) }, textBox, sigWrap, menuWrap),
      hintEl);
    mount(root);
    const first = !(E.game.robotsTalked & (1 << robot));
    setPages(first ? d.greeting : d.greetingAgain, 'greet');
    setFocus(0); eqT = 0;
  },
  exit() { hw?.close(); unmount(root); hw = null; },
  update(dt) {
    const E = ctx.engine;
    hw?.update(dt);
    typer.update(dt);
    const speaking = !typer.done && st !== 'menu' && st !== 'signal';
    const f = speaking ? Math.floor(ctx.time * 8) % 2 : 0;
    if (f !== lastFrame) { lastFrame = f; redrawSprite(portrait, f); }
    eqT -= dt;
    if (eqT <= 0) { eqT = 0.08; eqEls.forEach((e, i) => { e.style.height = `${speaking ? 12 + Math.random() * 88 : 8 + (i % 3) * 2}%`; }); }
    if (st === 'signal') {
      const p = E.latencyTick(dt);
      sigFill.style.width = `${Math.min(100, p * 100)}%`; sigPct.textContent = `${Math.floor(Math.min(1, p) * 100)}%`;
      const tick = Math.floor(p * 8);
      if (tick !== lastTick && p < 1) { lastTick = tick; ctx.audio.play(Sfx.SIGNAL_TICK); }
      if (p >= 1 || !E.latencyActive()) { ctx.audio.play(Sfx.SIGNAL_DONE); ctx.flash('cyan'); startAnswer(); setFocus(focus); }
    }
  },
  drawOver(g) {
    if (hw) { g.fillStyle = 'rgba(2,6,16,0.78)'; g.fillRect(0, 0, CANVAS_W, 96); }
    drawPanelArt(g, 'ui_dialogue_box', (c) => {
      c.fillStyle = '#5a2a4a'; c.fillRect(10, 108, 340, 62); c.fillStyle = '#8c4660'; c.fillRect(13, 111, 334, 56); c.fillStyle = '#5a2a4a'; c.fillRect(14, 94, 72, 22); c.fillStyle = '#8c4660'; c.fillRect(16, 96, 68, 18);
    });
  },
  action(a, e) {
    if (hw) {
      const n = hw.count;
      if (a === 'tab') { ctx.audio.play(Sfx.CURSOR); setFocus((focus + 1) % (n + 1)); return; }
      if (a === 'num' && e.digit <= n + 1) { ctx.audio.play(Sfx.CURSOR); setFocus(e.digit - 1); return; }
      if (focus > 0) { if (a === 'pause' || a === 'notebook') setFocus(0); else hw.action(a, e); return; }
    }
    if (st === 'menu') {
      if (a === 'up') menu.move(-1); else if (a === 'down') menu.move(1);
      else if (a === 'left') menu.move(-4); else if (a === 'right') menu.move(4);
      else if (a === 'confirm') menu.pick();
      else if (a === 'pause') { ctx.audio.play(Sfx.CANCEL); goodbye(); setFocus(0); }
      else if (a === 'num' && !hw && menu.items[e.digit - 1]) { menu.index = e.digit - 1; menu.render(); menu.pick(); }
    } else if (st !== 'signal' && a === 'confirm') { advance(); setFocus(0); }
    else if (st !== 'signal' && a === 'pause') {
      const E = ctx.engine; ctx.audio.play(Sfx.CANCEL);
      if (st === 'greet') { E.markRobotTalked(robot); toMenu(); }
      else if (st === 'answer') { E.markAsked(robot, d.questions[qIdx].id); toMenu(); }
      else if (st === 'bye') ctx.back();
      setFocus(0);
    }
  },
};
