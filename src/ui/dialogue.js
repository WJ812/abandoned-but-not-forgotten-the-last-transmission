/**
 * Dialogue: portrait, typewriter text with talk blips, Pokemon-style question
 * menu plus Goodbye, and the "SIGNAL ~11 min" bar before each Mars answer.
 */
import { Robot, Mode, Sfx, LATENCY } from '../contract.js';
import { ctx } from '../gfx/ctx.js';
import { h, mount, unmount, spriteCanvas, redrawSprite, Typer, Menu } from './dom.js';

let root, d, robot, st, pages, pi, archFrom, typer, menu, portrait, eqEls, eqT, sigWrap, sigFill, sigPct, textBox, pageTag, archTag, menuBox, qIdx, lastTick, lastFrame;

const blipId = () => (robot === Robot.LRV ? Sfx.TALK_LRV : Sfx.TALK_SOJ);

function setPages(list, nextState, from = Infinity) {
  pages = list.length ? list : ['...']; pi = 0; archFrom = from; st = nextState;
  showPage();
}
function showPage() {
  textBox.classList.remove('hidden'); sigWrap.classList.add('hidden');
  typer.set(pages[pi]);
  pageTag.textContent = pages.length > 1 ? `${pi + 1}/${pages.length}` : '';
  archTag.classList.toggle('hidden', !(pi >= archFrom));
  root.classList.toggle('arch-page', pi >= archFrom);
}

function toMenu() {
  st = 'menu';
  const E = ctx.engine;
  menu.setItems([
    ...d.questions.map((q) => ({ label: q.label, sub: E.hasAsked(robot, q.id) ? '✓' : '' })),
    { label: 'Goodbye', cls: 'bye' },
  ]);
  menuBox.classList.remove('hidden');
  textBox.classList.remove('hidden'); sigWrap.classList.add('hidden'); archTag.classList.add('hidden'); pageTag.textContent = '';
  root.classList.remove('arch-page');
  typer.set(d.questions.some((q) => E.hasAsked(robot, q.id)) ? 'What else would you like to know?' : 'What would you like to ask?');
  typer.skip();
}

function pickMenu(i) {
  const E = ctx.engine;
  if (i >= d.questions.length) return goodbye();
  qIdx = i;
  menuBox.classList.add('hidden');
  if (d.latency) {
    st = 'signal'; lastTick = 0;
    E.latencyStart();
    textBox.classList.add('hidden'); sigWrap.classList.remove('hidden'); archTag.classList.add('hidden'); pageTag.textContent = '';
    sigFill.style.width = '0%';
  } else startAnswer();
}

function startAnswer() {
  const q = d.questions[qIdx]; const arch = ctx.engine.game.mode === Mode.ARCHIVIST;
  const extra = arch ? (q.archivist || []) : [];
  setPages([...q.answer, ...extra], 'answer', q.answer.length);
}

function goodbye() {
  menuBox.classList.add('hidden');
  setPages(d.goodbye, 'bye');
}

function advance() {
  if (!typer.done) { typer.skip(); return; }
  ctx.audio.play(Sfx.CURSOR);
  if (pi + 1 < pages.length) { pi++; showPage(); return; }
  const E = ctx.engine;
  if (st === 'greet') { E.markRobotTalked(robot); toMenu(); }
  else if (st === 'answer') { E.markAsked(robot, d.questions[qIdx].id); toMenu(); }
  else if (st === 'bye') ctx.back();
}

export const dialogue = {
  enter({ robot: r }) {
    const E = ctx.engine;
    robot = r; d = ctx.data.getDialogue(r); st = 'greet'; lastFrame = -1;
    portrait = spriteCanvas(d.portrait, 0, 'portrait');
    eqEls = Array.from({ length: 12 }, () => h('i'));
    const txt = h('p', { class: 'dlg-text' });
    pageTag = h('span', { class: 'page-tag' }); archTag = h('span', { class: 'chip arch-tag hidden' }, 'ARCHIVIST DATA');
    textBox = h('div', { class: 'dlg-textwrap' }, txt, h('div', { class: 'dlg-meta' }, archTag, pageTag, h('span', { class: 'adv' }, 'Space ▼')));
    sigFill = h('i'); sigPct = h('span', { class: 'sig-pct' }, '0%');
    sigWrap = h('div', { class: 'signal hidden' },
      h('div', { class: 'sig-head' }, h('span', { class: 'sig-label' }, LATENCY.LABEL), sigPct),
      h('div', { class: 'sig-bar' }, sigFill),
      h('div', { class: 'sig-sub' }, `Earth-Mars light time, compressed to ${LATENCY.GAUGE_REAL_S} s. ${E.game.mode === Mode.ARCHIVIST ? `${LATENCY.LABEL_ROUND_TRIP}. The delay varied as the planets moved (about 10.6 min at landing).` : 'Waiting for the reply...'}`));
    menu = new Menu({ cls: 'qmenu', items: [], onPick: (i) => { ctx.audio.play(Sfx.CONFIRM); pickMenu(i); } });
    menuBox = h('div', { class: 'qbox hidden' }, h('div', { class: 'qhead' }, 'ASK'), menu.el);
    typer = new Typer(txt, { cps: 52, onChar: () => ctx.audio.blip(blipId()) });
    root = h('div', { class: 'screen dialogue' },
      menuBox,
      h('div', { class: 'dlg' },
        h('div', { class: 'dlg-portrait' }, portrait, h('div', { class: 'eq' }, eqEls)),
        h('div', { class: 'dlg-main' },
          h('div', { class: 'dlg-head' }, h('span', { class: 'who' }, d.name), h('span', { class: 'where' }, d.location), h('span', { class: 'chip' }, 'LAST TRANSMISSION')),
          textBox, sigWrap)));
    mount(root);
    const first = !(E.game.robotsTalked & (1 << robot));
    setPages(first ? d.greeting : d.greetingAgain, 'greet');
    menuBox.classList.add('hidden'); eqT = 0;
  },
  exit() { unmount(root); },
  update(dt) {
    const E = ctx.engine;
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
      if (p >= 1 || !E.latencyActive()) { ctx.audio.play(Sfx.SIGNAL_DONE); ctx.flash('cyan'); startAnswer(); }
    }
  },
  action(a, e) {
    if (st === 'menu') {
      if (a === 'up') menu.move(-1); else if (a === 'down') menu.move(1);
      else if (a === 'confirm') menu.pick();
      else if (a === 'pause') { ctx.audio.play(Sfx.CANCEL); goodbye(); }
      else if (a === 'num' && menu.items[e.digit - 1]) { menu.index = e.digit - 1; menu.render(); menu.pick(); }
    } else if (st !== 'signal' && a === 'confirm') advance();
    else if (st !== 'signal' && a === 'pause') {
      const E = ctx.engine; ctx.audio.play(Sfx.CANCEL);
      if (st === 'greet') { E.markRobotTalked(robot); toMenu(); }
      else if (st === 'answer') { E.markAsked(robot, d.questions[qIdx].id); toMenu(); }
      else if (st === 'bye') ctx.back();
    }
  },
};
