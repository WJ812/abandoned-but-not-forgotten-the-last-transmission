/** Hub / Region screens (the walkable world) plus fact pop-up and portal menu. */
import {
  CANVAS_W, CANVAS_H, PLAYER, Btn, DT, EVT, Screen, Region, HotspotKind, Station, Sfx, Surface, Mode, Prop, Robot, HOP_REGIONS, GRAVITY_G,
} from '../contract.js';
import { ctx } from '../gfx/ctx.js';
import { takeFrame, clearInput } from '../gfx/input.js';
import { getSceneCached } from '../gfx/renderer.js';
import { h, mount, unmount, Menu, Typer, spriteCanvas, at } from './dom.js';

let prompt = null, promptId = '', sceneRef = null, pendingEvt = 0;

/* Defensive anti-freeze: if movement keys are held but the astronaut has not moved for a while and is
 * wedged inside a solid / outside the walkable area, nudge it to the nearest free spot. */
const MOVE_BITS = Btn.LEFT | Btn.RIGHT | Btn.UP | Btn.DOWN;
let stuckT = 0, lastX = 0, lastY = 0;
const hbox = (p) => ({ x: p.x + PLAYER.HIT_X, y: p.y + PLAYER.HIT_Y, w: PLAYER.HIT_W, h: PLAYER.HIT_H });
const ovl = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
function badPos(scene, x, y) {
  const b = hbox({ x, y }); b.x += 3; b.y += 3; b.w -= 6; b.h -= 6; const w = scene.walkable;   // shrunk: only DEEP wedges count
  if (w && (b.x < w.x || b.y < w.y || b.x + b.w > w.x + w.w || b.y + b.h > w.y + w.h)) return true;
  return (scene.solids || []).some((s) => ovl(b, s)) || scene.hotspots.some((hh) => hh.solid && ovl(b, hh.rect));
}
function antiFreeze(scene, held, dt) {
  const p = ctx.engine.game.player;
  const moved = Math.abs(p.x - lastX) + Math.abs(p.y - lastY);
  lastX = p.x; lastY = p.y;
  if (!(held & MOVE_BITS) || moved > 0.02) { stuckT = 0; return; }
  stuckT += dt;
  if (stuckT < 4) return;
  stuckT = 0;
  if (!badPos(scene, p.x, p.y)) return;           // just pushing against a wall: leave it alone
  for (let r = 1; r <= 40; r++) {
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
      if (!badPos(scene, p.x + dx, p.y + dy)) { p.x += dx; p.y += dy; p.vx = 0; p.vy = 0; return; }
    }
  }
}

function ensurePrompt() {
  if (!prompt || !prompt.isConnected) {
    prompt = h('div', { class: 'prompt hidden' }, h('span', { class: 'key' }, 'Space'), h('span', { class: 'plabel' }));
    ctx.ui.appendChild(prompt);
  }
}

function updatePrompt() {
  const near = ctx.engine.game.nearHotspot;
  const id = near ? near.id + '|' + near.label : '';
  if (id === promptId) return;
  promptId = id;
  if (!near) { prompt.classList.add('hidden'); return; }
  prompt.querySelector('.plabel').textContent = near.label || near.id;
  prompt.style.left = `${Math.max(9, Math.min(91, ((near.rect.x + near.rect.w / 2) / CANVAS_W) * 100))}%`;
  prompt.style.top = `${(Math.max(14, near.rect.y - 15) / CANVAS_H) * 100}%`;
  prompt.classList.remove('hidden');
}

function stepSound(scene, ev) {
  const hop = HOP_REGIONS.includes(scene.region);
  if (!((hop && (ev & EVT.LANDED)) || (!hop && (ev & EVT.STEP)))) return;
  const id = scene.surface === Surface.SAND ? Sfx.STEP_SAND : scene.surface === Surface.REGOLITH ? Sfx.STEP_SUIT : Sfx.STEP_WOOD;
  ctx.audio.play(id);
}

export function interact(hot) {
  const E = ctx.engine; const A = ctx.audio;
  switch (hot.kind) {
    case HotspotKind.ROBOT: A.play(Sfx.CONFIRM); ctx.go(Screen.DIALOGUE, { robot: hot.ref }); break;
    case HotspotKind.BLUEPRINT: {
      const result = E.collectBlueprint(hot.ref);
      ctx.go(Screen.BLUEPRINT_CARD, { bp: hot.ref, result });
      break;
    }
    case HotspotKind.STATION:
      if (hot.ref === Station.STAR_MAP) { A.play(Sfx.STATION_STARMAP); ctx.go(Screen.ARCHIVE_COMPUTER, { tab: 'starmap' }); }
      else if (hot.ref === Station.ARCHIVE_COMPUTER) { A.play(Sfx.STATION_COMPUTER); ctx.go(Screen.ARCHIVE_COMPUTER, { tab: 'blueprints' }); }
      else if (hot.ref === Station.NOTEBOOK) { A.play(Sfx.NOTEBOOK); ctx.go(Screen.ARCHIVE_COMPUTER, { tab: 'notebook' }); }
      else ctx.toast(hot.caption || hot.label);
      break;
    case HotspotKind.PROP:
      A.play(Sfx.PROP_OPEN);
      if (hot.ref <= Prop.LRV_FENDER) ctx.go(Screen.DIALOGUE, { robot: Robot.LRV });          // hardware lives on the combined rover screen
      else if (hot.ref === Prop.SOJ_APXS || hot.ref === Prop.SOJ_SOLAR || hot.ref === Prop.SOJ_HAZARD || hot.ref === Prop.SOJ_DRIVE) ctx.go(Screen.DIALOGUE, { robot: Robot.SOJOURNER });
      else ctx.go(Screen.PROP_PANEL, { prop: hot.ref });
      break;
    case HotspotKind.DECOR: A.play(Sfx.CURSOR); ctx.toast(hot.caption || hot.label); break;
    case HotspotKind.PORTAL: A.play(Sfx.PORTAL); ctx.go(Screen.PORTAL_MENU); break;
    case HotspotKind.RETURN_PAD: A.play(Sfx.CONFIRM); ctx.go('confirmReturn'); break;
    default: break;
  }
}

export function returnToHub() {
  ctx.audio.play(Sfx.RETURN_PAD); ctx.flash('cyan');
  ctx.engine.enterRegion(Region.HUB);
  ctx.go(Screen.HUB);
}

function makeWorld(name) {
  return {
    enter() {
      stuckT = 0; ensurePrompt(); promptId = '?'; sceneRef = getSceneCached(ctx.engine.game.region);
      if (pendingEvt & EVT.ON_RETURN_PAD) { pendingEvt = 0; returnToHub(); } else if (pendingEvt & EVT.ON_PORTAL) { pendingEvt = 0; ctx.go(Screen.PORTAL_MENU); } else pendingEvt = 0;
    },
    exit() { prompt?.classList.add('hidden'); promptId = '?'; },
    update() {
      const E = ctx.engine; const game = E.game;
      const f = takeFrame();
      E.update(f.held, f.pressed);
      const ev = game.events; const scene = getSceneCached(game.region); sceneRef = scene;
      stepSound(scene, ev); antiFreeze(scene, f.held, DT);
      if (ev & EVT.HEADLAMP) ctx.audio.play(Sfx.HEADLAMP);
      if (ev & EVT.ENTERED_HOTSPOT) ctx.audio.play(Sfx.CURSOR);
      if (ev & EVT.BUMP && ctx.time - (this._bump || 0) > 0.4) { this._bump = ctx.time; }
      updatePrompt();
      if (game.pendingFact >= 0 && (ev & EVT.FACT)) {
        const fz = scene.facts.find((x) => x.id === game.pendingFact);
        if (fz) { pendingEvt = ev & (EVT.ON_RETURN_PAD | EVT.ON_PORTAL); ctx.go(Screen.FACT_POPUP, { fact: fz }); return; }
        E.acknowledgeFact();
      }
      if (ev & EVT.ON_PORTAL) { ctx.audio.play(Sfx.PORTAL); ctx.flash('cyan'); ctx.go(Screen.PORTAL_MENU); return; }
      if (ev & EVT.ON_RETURN_PAD) { returnToHub(); }
    },
    action(a) {
      if (a === 'confirm') { const hot = ctx.engine.findInteract(); if (hot) interact(hot); }
      else if (a === 'notebook') { ctx.audio.play(Sfx.NOTEBOOK); ctx.go(Screen.ARCHIVE_COMPUTER, { tab: 'notebook' }); }
      else if (a === 'pause') { ctx.audio.play(Sfx.PAUSE); ctx.go(Screen.PAUSE); }
    },
  };
}
export const hubScreen = makeWorld(Screen.HUB);
export const regionScreen = makeWorld(Screen.REGION);

/* ---------------- Fact pop-up ---------------- */
let factRoot, factTyper;
export const factPopup = {
  enter({ fact }) {
    const arch = ctx.engine.game.mode === Mode.ARCHIVIST && fact.archivist;
    ctx.audio.play(Sfx.FACT); ctx.flash('amber');
    const body = h('p', { class: 'fact-body' });
    factRoot = h('div', { class: 'screen popup-wrap' },
      h('div', { class: 'card fact' },
        h('div', { class: 'fact-head' }, h('span', { class: 'bang' }, '[!]'), h('span', { class: 'ttl' }, fact.title), h('span', { class: 'chip' }, 'FIELD NOTE')),
        body, arch ? h('p', { class: 'fact-arch' }, h('b', null, 'ARCHIVIST  '), fact.archivist) : null,
        h('div', { class: 'foot' }, h('span', { class: 'key' }, 'Space'), ' continue')));
    factTyper = new Typer(body, { cps: 90 }); factTyper.set(fact.explorer);
    mount(factRoot);
  },
  exit() { ctx.engine.acknowledgeFact(); unmount(factRoot); },
  update(dt) { factTyper.update(dt); },
  action(a) {
    if (a === 'confirm' || a === 'pause') {
      if (!factTyper.done) { factTyper.skip(); return; }
      ctx.audio.play(Sfx.CONFIRM); ctx.back();
    }
  },
};

/* ---------------- Return-to-hub confirmation ---------------- */
let rcRoot, rcMenu;
export const confirmReturn = {
  enter() {
    rcMenu = new Menu({ cls: 'big', items: [{ label: 'Yes, return to the Hub' }, { label: 'No, stay here' }], onPick: (i) => { if (i === 0) returnToHub(); else { ctx.audio.play(Sfx.CANCEL); ctx.back(); } } });
    rcMenu.index = 1; rcMenu.render();
    rcRoot = h('div', { class: 'screen center dim' }, h('div', { class: 'card pause' }, h('div', { class: 'card-title' }, h('span', { class: 'chip cy' }, 'RETURN PAD'), 'RETURN TO HUB?'), rcMenu.el,
      h('div', { class: 'foot' }, h('span', { class: 'key' }, 'W/S'), ' choose ', h('span', { class: 'key' }, 'Space'), ' confirm ', h('span', { class: 'key' }, 'Esc'), ' cancel')));
    mount(rcRoot);
  },
  exit() { unmount(rcRoot); },
  update() {},
  action(a) {
    if (a === 'up') rcMenu.move(-1); else if (a === 'down') rcMenu.move(1); else if (a === 'confirm') rcMenu.pick();
    else if (a === 'pause') { ctx.audio.play(Sfx.CANCEL); ctx.back(); }
  },
};

/* ---------------- Portal dropdown (image buttons) ---------------- */
let portalRoot, portalIdx, portalBtns, portalStats;
const PORTAL_REGIONS = [Region.MOON, Region.MARS];
const PORTAL_ART = ['btn_portal_moon', 'btn_portal_mars'];
function portalRender() { portalBtns.forEach((b, i) => b.classList.toggle('sel', i === portalIdx)); }
function portalGo() {
  ctx.audio.play(Sfx.PORTAL); ctx.flash('cyan');
  ctx.engine.enterRegion(PORTAL_REGIONS[portalIdx]);
  ctx.go(Screen.REGION);
}
export const portalMenuScreen = {
  enter() {
    portalStats = PORTAL_REGIONS.map((r) => ctx.data.getRegionStats(r)); portalIdx = 0;
    portalBtns = PORTAL_ART.map((id, i) => h('li', { class: 'pbtn', onclick: () => { portalIdx = i; portalRender(); portalGo(); }, onmouseenter: () => { portalIdx = i; portalRender(); } },
      spriteCanvas(id, 0, 'pbtn-art'), h('span', { class: 'pbtn-cap' }, `${i + 1}. ${portalStats[i].site}`)));
    const sc = getSceneCached(Region.HUB);
    const hot = sc.hotspots.find((x) => x.kind === HotspotKind.PORTAL);
    const r = hot ? hot.rect : { x: CANVAS_W / 2 - 20, y: 30, w: 40, h: 24 };
    // anchored beside the portal (below it when there is room), always fully on screen
    const below = r.y + r.h + 3 < CANVAS_H * 0.5;
    const left = below ? Math.max(4, Math.min(66, ((r.x + r.w / 2) / CANVAS_W) * 100 - 15)) : Math.min(66, ((r.x + r.w) / CANVAS_W) * 100 + 1);
    const top = below ? ((r.y + r.h + 3) / CANVAS_H) * 100 : Math.max(10, Math.min(44, (r.y / CANVAS_H) * 100));
    portalRoot = h('div', { class: 'screen dropwrap' },
      h('div', { class: 'dropdown', style: { left: `${left}%`, top: `${top}%`, transform: 'none' } },
        h('div', { class: 'drop-head' }, h('span', null, 'DESTINATION'), h('span', { class: 'drop-caret' }, '▼')),
        h('ul', { class: 'pbtns' }, portalBtns),
        h('div', { class: 'foot' }, h('span', { class: 'key' }, 'W/S'), ' choose ', h('span', { class: 'key' }, 'Space'), ' go ', h('span', { class: 'key' }, 'Esc'), ' close')));
    mount(portalRoot); portalRender();
  },
  exit() { unmount(portalRoot); },
  update() {},
  action(a, e) {
    const n = PORTAL_REGIONS.length;
    if (a === 'up') { portalIdx = (portalIdx + n - 1) % n; ctx.audio.play(Sfx.CURSOR); portalRender(); }
    else if (a === 'down') { portalIdx = (portalIdx + 1) % n; ctx.audio.play(Sfx.CURSOR); portalRender(); }
    else if (a === 'confirm') portalGo();
    else if (a === 'num' && e.digit <= n) { portalIdx = e.digit - 1; portalRender(); portalGo(); }
    else if (a === 'pause') { ctx.audio.play(Sfx.CANCEL); ctx.back(); }
  },
};
