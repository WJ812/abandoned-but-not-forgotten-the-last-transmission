/** Notebook, star map, pause menu. */
import { Region, Mode, Sfx, Screen, Robot, BP_COUNT, PACK_COUNT, Blueprint, CANVAS_W, CANVAS_H } from '../contract.js';
import { ctx } from '../gfx/ctx.js';
import { h, mount, unmount, Menu, pixCanvas, popcount } from './dom.js';
import { modeLabels } from './hud.js';

/* ---------------- Notebook pane (used by the Archive Computer) ---------------- */
export function buildNotebook() {
  const nb = buildNotebookBase();
  const E = ctx.engine, D = ctx.data;
  let log = [];
  try { log = (E.factsLog?.() || []); } catch { log = []; }
  const entries = [];
  for (const region of [Region.MOON, Region.MARS]) {
    let facts = []; try { facts = D.getScene(region).facts || []; } catch { facts = []; }
    for (const l of log) if (l.region === region) { const f = facts.find((x) => x.id === l.id); if (f) entries.push({ region, f }); }
  }
  let sel = 0;
  const list = h('div', { class: 'nb-flist' }); const det = h('div', { class: 'nb-fdet' });
  const render = () => {
    list.textContent = '';
    if (!entries.length) { list.append(h('div', { class: 'dim' }, 'No field notes yet. Explore the Moon and Mars.')); det.textContent = ''; return; }
    let last = -1;
    entries.forEach((e, i) => {
      if (e.region !== last) { last = e.region; list.append(h('div', { class: 'grp' }, e.region === Region.MOON ? 'THE MOON' : 'MARS')); }
      list.append(h('div', { class: `fi${i === sel ? ' sel' : ''}` }, e.f.title));
    });
    list.querySelector('.sel')?.scrollIntoView({ block: 'nearest' });
    const f = entries[sel].f; const arch = E.game.mode === Mode.ARCHIVIST && f.archivist;
    det.replaceChildren(h('div', { class: 'who' }, f.title), h('p', null, f.explorer), arch ? h('p', { class: 'arch-p' }, f.archivist) : null);
  };
  render();
  const glint = !(E.game.blueprints & (1 << Blueprint.LRV)) ? h('div', { class: 'glint' }, 'Something glints in the shadows... try your headlamp (F)') : null;
  const el = h('div', null, nb, glint, h('div', { class: 'nb-facts' }, h('div', null, h('div', { class: 'tbl-title' }, `FIELD NOTES ${entries.length}`), list), det));
  return { el, move(d) { if (!entries.length) return; sel = (sel + d + entries.length) % entries.length; ctx.audio.play(Sfx.CURSOR); render(); } };
}
function buildNotebookBase() {
  const E = ctx.engine, D = ctx.data, game = E.game;
  const comp = E.completion();
  const moon = D.getRegionStats(Region.MOON), mars = D.getRegionStats(Region.MARS);
  const bpNames = [D.getBlueprint(Blueprint.LRV).name, D.getBlueprint(Blueprint.SOJOURNER).name];
  const check = (ok, t) => h('li', { class: ok ? 'ok' : '' }, h('span', { class: 'box' }, ok ? '✓' : ''), t);
  const robots = [Robot.LRV, Robot.SOJOURNER].map((r) => {
    const dd = D.getDialogue(r); const n = popcount(game.asked[r] || 0);
    return check(!!(game.robotsTalked & (1 << r)), `${dd.name}: ${n}/${dd.questions.length} questions asked`);
  });
  const rows = [
    { label: 'Gravity', moon: `${moon.gravityG}g  (${moon.gravityMps2} m/s2)`, mars: `${mars.gravityG}g  (${mars.gravityMps2} m/s2)` },
    { label: 'Atmosphere', moon: moon.atmosphere, mars: mars.atmosphere },
    { label: 'Rover', moon: moon.rover, mars: mars.rover },
    ...(moon.rows || []).map((r, i) => ({ label: r.label, moon: r.value, mars: mars.rows?.[i]?.value ?? '' })),
  ];
  const packs = Array.from({ length: PACK_COUNT }, (_, p) => D.getPackInfo(p));
  return h('div', { class: 'nb-cols' },
    h('div', { class: 'nb-left' },
      h('div', { class: 'nb-pct' }, h('b', null, `${comp.percent}%`), ' Core Archive',
        h('div', { class: 'bar' }, h('i', { style: { width: `${comp.percent}%` } }))),
      h('div', { class: 'tbl-title' }, `CORE BLUEPRINTS ${comp.count}/${BP_COUNT}`),
      h('ul', { class: 'check' }, bpNames.map((n, i) => check(!!(game.blueprints & (1 << i)), n)), robots),
      h('div', { class: 'tbl-title' }, 'EXPANSION PACKS'),
      h('ul', { class: 'check' }, packs.map((p) => h('li', { class: 'lock' }, h('span', { class: 'box' }, '■'), `${p.name} - sealed`)))),
    h('div', { class: 'nb-right' },
      h('table', { class: 'cmp' },
        h('thead', null, h('tr', null, h('th'), h('th', null, 'MOON'), h('th', null, 'MARS'))),
        h('tbody', null, rows.map((r) => h('tr', null, h('th', null, r.label), h('td', null, r.moon), h('td', null, r.mars)))))));
}

/* ---------------- Star map pane ---------------- */
function drawBody(g, b, w, hh, t, sel) {
  const cx = Math.round(b.x * w), cy = Math.round(b.y * hh), r = Math.max(3, Math.round(b.r * w));
  for (let y = -r; y <= r; y++) {
    const half = Math.round(Math.sqrt(r * r - y * y));
    g.fillStyle = b.color; g.fillRect(cx - half, cy + y, half * 2, 1);
    g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(cx + Math.round(half * 0.2), cy + y, Math.max(0, Math.round(half * 0.8)), 1);
  }
  if (sel) {
    g.strokeStyle = '#ffd166'; g.lineWidth = 1; const q = r + 3 + (Math.floor(t * 3) % 2);
    g.strokeRect(cx - q + 0.5, cy - q + 0.5, q * 2, q * 2);
  }
}
/** Returns {el, update(), move(d)}; W/S (up/down) selects a body. */
export function createStarMap() {
  const bodies = ctx.data.getStarMap().bodies;
  let sel = Math.max(0, bodies.findIndex((b) => b.beacons.some((x) => !x.locked)));
  const { c, g } = pixCanvas(CANVAS_W, CANVAS_H, 'map-cv');
  const labels = bodies.map((b) => h('span', { class: 'bl', style: { left: `${b.x * 100}%`, top: `${(b.y + b.r * 1.9 + 0.03) * 100}%` } }, b.name));
  const info = h('div', { class: 'map-info' });
  const renderInfo = () => {
    const b = bodies[sel];
    info.replaceChildren(h('div', { class: 'pd-name' }, b.name.toUpperCase()),
      ...(b.beacons.length ? b.beacons.map((bc) => h('div', { class: `beacon ${bc.locked ? 'locked' : 'live'}` }, h('span', { class: 'dot' }), bc.label, h('em', null, bc.locked ? ' LOCKED - expansion' : ' ACTIVE'))) : [h('div', { class: 'pd-row' }, 'No beacons here yet.')]));
  };
  renderInfo();
  return {
    el: h('div', { class: 'starmap' }, h('div', { class: 'map-wrap' }, c, labels, h('div', { class: 'sweep' })), info),
    update() {
      const t = ctx.time;
      g.fillStyle = '#030a1c'; g.fillRect(0, 0, CANVAS_W, CANVAS_H);
      for (let i = 0; i < 90; i++) { const x = (i * 97) % CANVAS_W, y = (i * 53) % CANVAS_H; g.fillStyle = (Math.floor(t * 2 + i) % 5) ? '#2d3f6b' : '#fff'; g.fillRect(x, y, 1, 1); }
      g.strokeStyle = 'rgba(61,214,245,0.15)';
      for (const rr of [50, 100, 150]) { g.beginPath(); g.arc(CANVAS_W / 2, CANVAS_H / 2, rr, 0, 6.3); g.stroke(); }
      bodies.forEach((b, i) => drawBody(g, b, CANVAS_W, CANVAS_H, t, i === sel));
    },
    move(d) { sel = (sel + d + bodies.length) % bodies.length; ctx.audio.play(Sfx.CURSOR); renderInfo(); },
  };
}

/* ---------------- Pause ---------------- */
let pRoot, pMenu;
function pauseItems() {
  const game = ctx.engine.game;
  return [
    { label: 'Resume' },
    { label: game.mode === Mode.ARCHIVIST ? modeLabels()[1] : modeLabels()[0], sub: 'switch mode' },
    { label: ctx.audio.muted ? 'Sound: OFF' : 'Sound: ON', sub: 'mute' },
    { label: ctx.reduceFlash() ? 'Reduce flashing: ON' : 'Reduce flashing: OFF', sub: 'comfort' },
    { label: 'Controls', sub: 'how to play' },
    { label: 'Quit to title' },
  ];
}
export const pause = {
  enter() {
    pMenu = new Menu({
      cls: 'big', items: pauseItems(),
      onPick: (i) => {
        if (i === 0) { ctx.audio.play(Sfx.CONFIRM); ctx.back(); }
        else if (i === 1) { ctx.engine.toggleMode(); ctx.audio.play(Sfx.CONFIRM); pMenu.setItems(pauseItems()); }
        else if (i === 2) { ctx.toggleMute(); ctx.audio.play(Sfx.CONFIRM); pMenu.setItems(pauseItems()); }
        else if (i === 3) { let cur = false; try { cur = !!ctx.engine.getSettings?.().reduceFlashing; } catch { /* none */ } ctx.setSetting('reduceFlashing', !cur); ctx.audio.play(Sfx.CONFIRM); pMenu.setItems(pauseItems()); }
        else if (i === 4) { ctx.audio.play(Sfx.CONFIRM); ctx.go('controls', { after: Screen.PAUSE }); }
        else { ctx.audio.play(Sfx.CANCEL); ctx.go(Screen.TITLE); }
      },
    });
    pRoot = h('div', { class: 'screen center dim' },
      h('div', { class: 'card pause' }, h('div', { class: 'card-title' }, h('span', { class: 'chip' }, 'PAUSED'), 'MISSION CONTROL'), pMenu.el,
        h('div', { class: 'foot' }, h('span', { class: 'key' }, 'W/S'), ' choose  ', h('span', { class: 'key' }, 'Space'), ' select  ', h('span', { class: 'key' }, 'Esc'), ' resume')));
    mount(pRoot);
  },
  exit() { unmount(pRoot); },
  update() {},
  action(a) {
    if (a === 'up') pMenu.move(-1); else if (a === 'down') pMenu.move(1);
    else if (a === 'confirm') pMenu.pick();
    else if ((a === 'left' || a === 'right') && pMenu.index === 1) pMenu.pick();
    else if (a === 'pause') { ctx.audio.play(Sfx.CONFIRM); ctx.back(); }
  },
};

/* ---------------- Controls card (New Game, and from the pause menu) ---------------- */
let ccRoot, ccAfter;
export const controlsCard = {
  enter(p) {
    ccAfter = p?.after || Screen.HUB;
    const row = (k, t) => h('div', { class: 'cc-row' }, h('span', { class: 'key' }, k), h('span', null, t));
    ccRoot = h('div', { class: 'screen center dim' }, h('div', { class: 'card controls' },
      h('div', { class: 'card-title' }, h('span', { class: 'chip cy' }, 'BRIEFING'), 'CONTROLS'),
      h('div', { class: 'cc-grid' }, row('W A S D', 'move'), row('Space', 'interact'), row('F', 'headlamp (Moon)'), row('N', 'notebook'), row('P', 'pause')),
      h('div', { class: 'foot' }, 'Arrow keys and E also work.   ', h('span', { class: 'key' }, 'Space'), ' continue')));
    mount(ccRoot);
  },
  exit() { unmount(ccRoot); },
  update() {},
  action(a) { if (a === 'confirm' || a === 'pause') { ctx.audio.play(Sfx.CONFIRM); ctx.go(ccAfter); } },
};
