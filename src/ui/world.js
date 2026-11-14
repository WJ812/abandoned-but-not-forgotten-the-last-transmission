/** Hub / Region screens (the walkable world) plus fact pop-up and portal menu. */
import {
  EVT, Screen, Region, HotspotKind, Station, Sfx, Surface, Mode, HOP_REGIONS, GRAVITY_G,
} from '../contract.js';
import { ctx } from '../gfx/ctx.js';
import { takeFrame } from '../gfx/input.js';
import { getSceneCached } from '../gfx/renderer.js';
import { h, mount, unmount, Menu } from './dom.js';

let prompt = null, promptId = '', sceneRef = null;

function ensurePrompt() {
  if (!prompt || !prompt.isConnected) {
    prompt = h('div', { class: 'prompt hidden' }, h('span', { class: 'key' }, 'E'), h('span', { class: 'plabel' }));
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
  prompt.style.left = `${((near.rect.x + near.rect.w / 2) / 320) * 100}%`;
  prompt.style.top = `${(Math.max(14, near.rect.y - 15) / 180) * 100}%`;
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
      if (hot.ref === Station.STAR_MAP) { A.play(Sfx.STATION_STARMAP); ctx.go(Screen.STAR_MAP); }
      else if (hot.ref === Station.ARCHIVE_COMPUTER) { A.play(Sfx.STATION_COMPUTER); ctx.go(Screen.ARCHIVE_COMPUTER); }
      else if (hot.ref === Station.NOTEBOOK) { A.play(Sfx.NOTEBOOK); ctx.go(Screen.NOTEBOOK); }
      else ctx.toast(hot.caption || hot.label);
      break;
    case HotspotKind.PROP: A.play(Sfx.PROP_OPEN); ctx.go(Screen.PROP_PANEL, { prop: hot.ref }); break;
    case HotspotKind.DECOR: A.play(Sfx.CURSOR); ctx.toast(hot.caption || hot.label); break;
    case HotspotKind.PORTAL: A.play(Sfx.PORTAL); ctx.go(Screen.PORTAL_MENU); break;
    case HotspotKind.RETURN_PAD: returnToHub(); break;
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
    enter() { ensurePrompt(); promptId = '?'; sceneRef = getSceneCached(ctx.engine.game.region); },
    exit() { prompt?.classList.add('hidden'); promptId = '?'; },
    update() {
      const E = ctx.engine; const game = E.game;
      const f = takeFrame();
      E.update(f.held, f.pressed);
      const ev = game.events; const scene = getSceneCached(game.region); sceneRef = scene;
      stepSound(scene, ev);
      if (ev & EVT.HEADLAMP) ctx.audio.play(Sfx.HEADLAMP);
      if (ev & EVT.ENTERED_HOTSPOT) ctx.audio.play(Sfx.CURSOR);
      if (ev & EVT.BUMP && ctx.time - (this._bump || 0) > 0.4) { this._bump = ctx.time; }
      updatePrompt();
      if (game.pendingFact >= 0 && (ev & EVT.FACT)) {
        const fz = scene.facts.find((x) => x.id === game.pendingFact);
        if (fz) { ctx.go(Screen.FACT_POPUP, { fact: fz }); return; }
        E.acknowledgeFact();
      }
      if (ev & EVT.ON_PORTAL) { ctx.audio.play(Sfx.PORTAL); ctx.flash('cyan'); ctx.go(Screen.PORTAL_MENU); return; }
      if (ev & EVT.ON_RETURN_PAD) { returnToHub(); }
    },
    action(a) {
      if (a === 'confirm') { const hot = ctx.engine.findInteract(); if (hot) interact(hot); }
      else if (a === 'notebook') { ctx.audio.play(Sfx.NOTEBOOK); ctx.go(Screen.NOTEBOOK); }
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
    factTyper = new (ctx.Typer)(body, { cps: 90 }); factTyper.set(fact.explorer);
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

/* ---------------- Portal menu ---------------- */
let portalRoot, portalMenu, portalDetail, portalStats;
const PORTAL_REGIONS = [Region.MOON, Region.MARS];
function portalRender() {
  const i = portalMenu.index;
  portalDetail.textContent = '';
  if (i < 2) {
    const s = portalStats[i];
    portalDetail.append(
      h('div', { class: 'pd-name' }, s.name.toUpperCase()),
      h('div', { class: 'pd-site' }, s.site),
      h('div', { class: 'pd-g' }, h('span', null, `g = ${s.gravityMps2} m/s2  (${s.gravityG}g)`),
        h('div', { class: 'bar' }, h('i', { style: { width: `${Math.min(100, (s.gravityG || GRAVITY_G[PORTAL_REGIONS[i]]) * 100)}%` } }))),
      h('div', { class: 'pd-row' }, h('b', null, 'Air  '), s.atmosphere),
      h('div', { class: 'pd-row' }, h('b', null, 'Rover  '), s.rover));
  } else portalDetail.append(h('div', { class: 'pd-site' }, 'Stay in the NASA Archives hub.'));
}
export const portalMenuScreen = {
  enter() {
    portalStats = PORTAL_REGIONS.map((r) => ctx.data.getRegionStats(r));
    portalMenu = new Menu({
      cls: 'big',
      items: [
        ...portalStats.map((s, i) => ({ label: `${i + 1}. ${s.name.toUpperCase()}`, sub: s.site })),
        { label: 'Stay in the Hub', sub: 'Esc' },
      ],
      onPick: (i) => {
        if (i >= 2) { ctx.audio.play(Sfx.CANCEL); ctx.back(); return; }
        ctx.audio.play(Sfx.PORTAL); ctx.flash('cyan');
        ctx.engine.enterRegion(PORTAL_REGIONS[i]);
        ctx.go(Screen.REGION);
      },
    });
    portalDetail = h('div', { class: 'pd' });
    portalRoot = h('div', { class: 'screen center' },
      h('div', { class: 'card portal' },
        h('div', { class: 'card-title' }, h('span', { class: 'chip' }, 'TELEPORT'), 'DESTINATION SELECTOR'),
        h('div', { class: 'portal-cols' }, portalMenu.el, portalDetail),
        h('div', { class: 'foot' }, h('span', { class: 'key' }, 'W/S'), ' choose  ', h('span', { class: 'key' }, 'Space'), ' go  ', h('span', { class: 'key' }, '1-2'), ' quick pick')));
    mount(portalRoot); portalRender();
  },
  exit() { unmount(portalRoot); },
  update() {},
  action(a, e) {
    if (a === 'up') { portalMenu.move(-1); portalRender(); }
    else if (a === 'down') { portalMenu.move(1); portalRender(); }
    else if (a === 'confirm') portalMenu.pick();
    else if (a === 'num' && e.digit <= 2) { portalMenu.index = e.digit - 1; portalMenu.render(); portalMenu.pick(); }
    else if (a === 'pause') { ctx.audio.play(Sfx.CANCEL); ctx.back(); }
  },
};
