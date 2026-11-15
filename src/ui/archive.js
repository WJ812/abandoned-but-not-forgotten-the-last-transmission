/** Archive Computer (notebook, star map, blueprints, transcripts, expansions, recap) and the Ending. */
import { Mode, Sfx, Screen, Robot, Blueprint, MISSION_COUNT, GF, Region, CANVAS_W, CANVAS_H } from '../contract.js';
import { MISSION_ICONS } from '../assets.js';
import { ctx } from '../gfx/ctx.js';
import { h, mount, unmount, spriteCanvas, Typer, at, drawPanelArt } from './dom.js';
import { page1El, page2El } from './cards.js';
import { buildNotebook, createStarMap } from './menus.js';
import { buildNotes } from './notes.js';

const TAB_DEFS = [
  { id: 'notebook', label: 'NOTEBOOK', custom: true },
  { id: 'starmap', label: 'STAR MAP', custom: true },
  { id: 'blueprints', label: 'BLUEPRINTS' },
  { id: 'transcripts', label: 'TRANSCRIPTS' },
  { id: 'expansions', label: 'EXPANSIONS' },
  { id: 'notes', label: 'NOTES', custom: true },
  { id: 'recap', label: 'RECAP', needsEnding: true },
];
let nts = null, nbk = null, root, tabs, tab, idx, tabsEl, bodyEl, listEl, detailEl, hintEl, statusEl, map, cur;

function items(id) {
  const E = ctx.engine, D = ctx.data, game = E.game;
  if (id === 'blueprints') {
    return [Blueprint.LRV, Blueprint.SOJOURNER].map((b) => {
      const c = D.getBlueprint(b); const have = !!(game.blueprints & (1 << b));
      return { label: have ? c.name : 'LOCKED BLUEPRINT', locked: !have, detail: () => (have ? h('div', { class: 'ad-card' }, page1El(c), page2El(c)) : h('p', { class: 'dim' }, 'Recover this blueprint in the field to unlock its card.')) };
    });
  }
  if (id === 'transcripts') {
    const out = [];
    for (const r of [Robot.LRV, Robot.SOJOURNER]) {
      const d = D.getDialogue(r);
      if (!(game.robotsTalked & (1 << r))) { out.push({ label: `${d.name}: no signal`, locked: true, detail: () => h('p', { class: 'dim' }, 'NO TRANSMISSION RECORDED. Visit and talk to this robot.') }); continue; }
      out.push({ label: `${d.name}: greeting`, detail: () => h('div', null, h('div', { class: 'who' }, d.name), d.greeting.map((t) => h('p', null, t))) });
      for (const q of d.questions) {
        if (!E.hasAsked(r, q.id)) continue;
        out.push({ label: `${d.name}: ${q.label}`, detail: () => h('div', null, h('div', { class: 'who' }, `${d.name} - ${q.label}`), q.answer.map((t) => h('p', null, t)), game.mode === Mode.ARCHIVIST ? (q.archivist || []).map((t) => h('p', { class: 'arch-p' }, t)) : null) });
      }
      out.push({ label: `${d.name}: sign-off`, detail: () => h('div', null, d.goodbye.map((t) => h('p', null, t))) });
    }
    return out;
  }
  if (id === 'expansions') {
    const cat = D.getCatalog();
    return Array.from({ length: MISSION_COUNT }, (_, i) => cat[i]).filter(Boolean).map((m) => ({
      label: m.name, sub: D.getPackInfo(m.pack).name,
      detail: () => h('div', null,
        h('div', { class: 'cat-head' }, spriteCanvas(MISSION_ICONS[m.id] || m.icon, 0, 'cat-ico'), h('div', null, h('div', { class: 'who' }, m.name), h('div', { class: 'dim' }, `${m.body} - ${m.site} - ${m.dates}`))),
        h('div', { class: 'chip' }, `${D.getPackInfo(m.pack).name.toUpperCase()}  //  COMING SOON`),
        h('p', null, m.summary), game.mode === Mode.ARCHIVIST ? h('p', { class: 'arch-p' }, m.archivist) : null),
    }));
  }
  return [{
    label: 'Play the final recap', recap: true,
    detail: () => h('div', null, h('div', { class: 'who' }, 'CORE ARCHIVE COMPLETE'), h('p', null, 'Both blueprints are recovered. The Moon-versus-Mars comparison, the montage and the closing message are ready.'), h('p', { class: 'cta' }, 'Press Space to play')),
  }];
}

function build() {
  const unlocked = !!(ctx.engine.game.flags & GF.ENDING_UNLOCKED);
  tabs = TAB_DEFS.filter((t) => !t.needsEnding || unlocked);
}

function renderTabs() {
  const game = ctx.engine.game;
  tabsEl.replaceChildren(...tabs.map((t, i) => h('span', { class: `pxbtn${i === tab ? ' sel' : ''}${t.id === 'recap' && !(game.flags & GF.ENDING_SEEN) ? ' ping' : ''}`, onclick: () => setTab(i) }, h('i', null, String(i + 1)), t.label)));
}

function renderBody() {
  const def = tabs[tab]; map = null; cur = null; nbk = null; nts = null;
  bodyEl.replaceChildren();
  if (def.id === 'notebook') { nbk = buildNotebook(); bodyEl.appendChild(h('div', { class: 'apane' }, nbk.el)); }
  else if (def.id === 'notes') { nts = buildNotes(); bodyEl.appendChild(h('div', { class: 'apane' }, nts.el)); }
  else if (def.id === 'starmap') { map = createStarMap(); bodyEl.appendChild(h('div', { class: 'apane' }, map.el)); }
  else {
    const list = items(def.id);
    idx = Math.max(0, Math.min(idx, list.length - 1));
    listEl = h('ul', { class: 'alist' }, list.map((it, i) => h('li', { class: `item${i === idx ? ' sel' : ''}${it.locked ? ' off' : ''}`, onclick: () => { idx = i; renderBody(); } }, h('span', { class: 'mk' }), h('span', { class: 'lb' }, it.label), it.sub ? h('span', { class: 'sub' }, it.sub) : null)));
    detailEl = h('div', { class: 'adetail' }, list[idx]?.detail() ?? h('p', { class: 'dim' }, 'Nothing here yet.'));
    cur = list[idx];
    bodyEl.appendChild(h('div', { class: 'acols' }, listEl, detailEl));
  }
  const E = ctx.engine; const c = E.completion();
  statusEl.textContent = `ARCHIVE ${c.percent}%  |  BLUEPRINTS ${c.count}/${c.total}  |  MODE ${E.game.mode === Mode.ARCHIVIST ? 'ARCHIVIST' : 'EXPLORER'}`;
  const nav = def.id === 'notes' ? 'W/S entries  (mouse: Download button)  ' : def.id === 'notebook' ? 'W/S field notes  ' : def.id === 'starmap' ? 'W/S select body  ' : def.custom ? '' : 'W/S item  Space open  ';
  hintEl.replaceChildren(h('span', { class: 'key' }, 'A/D'), ' tab  ', nav, h('span', { class: 'key' }, '1-9'), ' jump  ', h('span', { class: 'key' }, 'Esc'), ' close');
}

function setTab(i) { tab = (i + tabs.length) % tabs.length; idx = 0; ctx.audio.play(Sfx.CURSOR); renderTabs(); renderBody(); }

function makeComputer(initialId) {
  return {
    enter(p) {
      build();
      const want = p?.tab || initialId;
      tab = Math.max(0, tabs.findIndex((t) => t.id === want)); idx = 0;
      tabsEl = h('div', { class: 'tabs' }); bodyEl = h('div', { class: 'abody' }); hintEl = h('div', { class: 'foot' }); statusEl = h('span', { class: 'astatus' });
      root = h('div', { class: 'screen pxterm' },
        h('div', { class: 'term', style: at(19, 17, 322, 146) },
          h('div', { class: 'term-head' }, h('b', null, 'NASA ARCHIVE COMPUTER'), statusEl, h('span', { class: 'boot-cur' }, '_')),
          tabsEl, bodyEl, hintEl));
      mount(root); renderTabs(); renderBody();
    },
    exit() { unmount(root); },
    update() { map?.update(); },
    drawOver(g) {
      g.fillStyle = 'rgba(0,0,0,0.6)'; g.fillRect(0, 0, CANVAS_W, CANVAS_H);
      drawPanelArt(g, 'ui_computer_screen', (c) => { c.fillStyle = '#fffbe8'; c.fillRect(8, 8, 344, 164); c.fillStyle = '#322a48'; c.fillRect(11, 11, 338, 158); });
    },
    action(a, e) {
      if (a === 'left') setTab(tab - 1);
      else if (a === 'right') setTab(tab + 1);
      else if (a === 'num' && e.digit <= tabs.length) setTab(e.digit - 1);
      else if (a === 'up' || a === 'down') {
        const d = a === 'up' ? -1 : 1;
        if (map) map.move(d); else if (nts) nts.move(d); else if (nbk) nbk.move(d); else if (!tabs[tab].custom) { idx = Math.max(0, idx + d); ctx.audio.play(Sfx.CURSOR); renderBody(); }
      } else if (a === 'confirm') { if (cur?.recap) { ctx.audio.play(Sfx.ENDING); ctx.go(Screen.ENDING); } }
      else if (a === 'pause' || a === 'notebook') { ctx.audio.play(Sfx.CANCEL); ctx.back(); }
    },
  };
}
export const archive = makeComputer('blueprints');
export const notebookScreen = makeComputer('notebook');
export const starMapScreen = makeComputer('starmap');

/* ---------------- Ending ---------------- */
let eRoot, eStage, ending, eT, eBody, eTyper, ePage, eShot, eCred, eCredY;
const CRED_PX_S = 70;   // credits scroll speed, layout px per second
const MONTAGE_S = 6;

function showStage(n) {
  eStage = n; eBody.replaceChildren(); eTyper = null;
  if (n === 0) {
    eBody.append(h('div', { class: 'card ending-cmp' }, h('div', { class: 'card-title' }, h('span', { class: 'chip cy' }, 'RECAP'), 'MOON vs MARS'),
      h('table', { class: 'cmp' }, h('thead', null, h('tr', null, h('th'), h('th', null, spriteCanvas('rover_lrv', 0, 'cmp-rover'), 'THE MOON'), h('th', null, spriteCanvas('rover_sojourner', 0, 'cmp-rover'), 'MARS'))),
        h('tbody', null, ending.comparison.map((r) => h('tr', null, h('th', null, r.label), h('td', null, r.moon), h('td', null, r.mars))))),
      h('div', { class: 'foot' }, h('span', { class: 'key' }, 'Space'), ' continue')));
  } else if (n === 1) {
    eT = 0; eShot = h('div', { class: 'montage-cap' });
    eBody.append(eShot);
  } else if (n === 2) {
    ePage = 0;
    const p = h('p', { class: 'quote' });
    eTyper = new Typer(p, { cps: 34 }); eTyper.set(ending.closing[0]);
    eBody.append(h('div', { class: 'closing' }, p, h('div', { class: 'foot' }, h('span', { class: 'key' }, 'Space'), ' continue')));
  } else if (n === 3) {
    eCredY = 0;
    eCred = h('div', { class: 'credits' }, ending.credits.map((c) => h('div', { class: 'cred-sec' },
      h('div', { class: 'cred-head' }, c.heading), ...c.lines.map((l) => h('div', { class: 'cred-line' }, l)))));
    eBody.append(h('div', { class: 'credits-view' }, eCred), h('div', { class: 'foot cred-foot' }, h('span', { class: 'key' }, 'Space'), ' skip'));
  } else {
    eBody.append(h('div', { class: 'closing end' }, h('div', { class: 'theend' }, 'THE END'), h('div', { class: 'tagline' }, 'Abandoned, but not forgotten.'), h('div', { class: 'foot' }, h('span', { class: 'key' }, 'Space'), ' return to the Archive')));
  }
}

export const endingScreen = {
  enter() {
    ending = ctx.data.getEnding(); ctx.audio.startLoop(Sfx.ENDING);
    eBody = h('div', { class: 'ending-body' });
    eRoot = h('div', { class: 'screen ending' }, eBody);
    mount(eRoot); showStage(0);
  },
  exit() { ctx.audio.stopLoop(Sfx.ENDING); ctx.engine.markEndingSeen(); unmount(eRoot); },
  update(dt) {
    eTyper?.update(dt);
    if (eStage === 1) {
      eT += dt;
      const i = Math.min(1, Math.floor(eT / MONTAGE_S));
      eShot.textContent = ending.montage[i]?.caption || '';
      if (eT >= MONTAGE_S * 2) showStage(2);
    } else if (eStage === 3) {
      eCredY += dt * CRED_PX_S;
      const view = eCred.parentElement;
      eCred.style.transform = `translateY(${view.clientHeight - eCredY}px)`;
      if (eCredY > view.clientHeight + eCred.offsetHeight) showStage(4);
    }
  },
  action(a) {
    if (a !== 'confirm') return;
    if (eStage === 0) showStage(1);
    else if (eStage === 1) { eT = (Math.floor(eT / MONTAGE_S) + 1) * MONTAGE_S; if (eT >= MONTAGE_S * 2) showStage(2); }
    else if (eStage === 2) {
      if (!eTyper.done) { eTyper.skip(); return; }
      if (ePage + 1 < ending.closing.length) { ePage++; eTyper.set(ending.closing[ePage]); } else showStage(3);
    } else if (eStage === 3) showStage(4);
    else { ctx.audio.play(Sfx.CONFIRM); ctx.engine.enterRegion(Region.HUB); ctx.go(Screen.HUB); }
  },
  /** Montage drawn on the canvas with a crossfade and slow push-in. */
  drawBackdrop(g) {
    g.fillStyle = '#02040c'; g.fillRect(0, 0, CANVAS_W, CANVAS_H);
    if (eStage >= 1) {
      const t = eStage === 1 ? eT : MONTAGE_S * 2;
      const i = Math.min(1, Math.floor(t / MONTAGE_S)), local = t - i * MONTAGE_S;
      const fade = Math.min(1, local / 0.4) * (eStage === 1 ? 1 : 0.35);   // reach full brightness fast so the rovers read clearly
      const z = 1 + local * 0.006;
      g.save(); g.globalAlpha = fade; g.translate(CANVAS_W / 2, CANVAS_H / 2); g.scale(z, z); g.translate(-CANVAS_W / 2, -CANVAS_H / 2);
      ctx.assets.draw(g, ending.montage[i].art, 0, 0, 0); g.restore();
    } else {
      g.fillStyle = '#071a3f'; g.fillRect(0, 0, CANVAS_W, CANVAS_H);
      for (let i = 0; i < 70; i++) { g.fillStyle = (Math.floor(ctx.time * 2 + i) % 6) ? '#31456f' : '#fff'; g.fillRect((i * 83) % CANVAS_W, (i * 47) % CANVAS_H, 1, 1); }
    }
    return true;
  },
};
