/** Notebook, star map, pause menu. */
import { Region, Mode, Sfx, Screen, Robot, BP_COUNT, PACK_COUNT, Blueprint } from '../contract.js';
import { ctx } from '../gfx/ctx.js';
import { h, mount, unmount, Menu, pixCanvas, popcount, kvTable } from './dom.js';
import { modeLabels } from './hud.js';

/* ---------------- Notebook ---------------- */
let nbRoot;
export const notebook = {
  enter() {
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
      ...moon.rows.map((r, i) => ({ label: r.label, moon: r.value, mars: mars.rows[i]?.value ?? '' })),
    ];
    const packs = Array.from({ length: PACK_COUNT }, (_, p) => D.getPackInfo(p));
    nbRoot = h('div', { class: 'screen center' },
      h('div', { class: 'card notebook' },
        h('div', { class: 'card-title' }, h('span', { class: 'chip' }, 'FIELD'), 'EXPLORER NOTEBOOK'),
        h('div', { class: 'nb-cols' },
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
              h('tbody', null, rows.map((r) => h('tr', null, h('th', null, r.label), h('td', null, r.moon), h('td', null, r.mars))))))),
        h('div', { class: 'foot' }, h('span', { class: 'key' }, 'N'), ' close')));
    mount(nbRoot);
  },
  exit() { unmount(nbRoot); },
  update() {},
  action(a) { if (a === 'notebook' || a === 'pause' || a === 'confirm') { ctx.audio.play(Sfx.CANCEL); ctx.back(); } },
};

/* ---------------- Star map ---------------- */
let smRoot, smBodies, smCv, smSel, smInfo, smLabels;
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
function smInfoRender() {
  const b = smBodies[smSel];
  smInfo.replaceChildren(h('div', { class: 'pd-name' }, b.name.toUpperCase()),
    ...(b.beacons.length ? b.beacons.map((bc) => h('div', { class: `beacon ${bc.locked ? 'locked' : 'live'}` }, h('span', { class: 'dot' }), bc.label, h('em', null, bc.locked ? ' LOCKED - expansion' : ' ACTIVE'))) : [h('div', { class: 'pd-row' }, 'No beacons here yet.')]));
}
export const starMap = {
  enter() {
    smBodies = ctx.data.getStarMap().bodies; smSel = Math.max(0, smBodies.findIndex((b) => b.beacons.some((x) => !x.locked)));
    const { c, g } = pixCanvas(320, 180, 'map-cv'); smCv = { c, g };
    smLabels = smBodies.map((b) => h('span', { class: 'bl', style: { left: `${b.x * 100}%`, top: `${(b.y + b.r * 1.9 + 0.03) * 100}%` } }, b.name));
    smInfo = h('div', { class: 'map-info' });
    smRoot = h('div', { class: 'screen center' },
      h('div', { class: 'card starmap' },
        h('div', { class: 'card-title' }, h('span', { class: 'chip' }, 'ORRERY'), 'STAR MAP'),
        h('div', { class: 'map-wrap' }, c, smLabels, h('div', { class: 'sweep' })),
        smInfo,
        h('div', { class: 'foot' }, h('span', { class: 'key' }, 'A/D'), ' select  ', h('span', { class: 'key' }, 'Esc'), ' close')));
    mount(smRoot); smInfoRender();
  },
  exit() { unmount(smRoot); },
  update() {
    const g = smCv.g, t = ctx.time;
    g.fillStyle = '#030a1c'; g.fillRect(0, 0, 320, 180);
    for (let i = 0; i < 90; i++) { const x = (i * 97) % 320, y = (i * 53) % 180; g.fillStyle = (Math.floor(t * 2 + i) % 5) ? '#2d3f6b' : '#fff'; g.fillRect(x, y, 1, 1); }
    g.strokeStyle = 'rgba(61,214,245,0.15)';
    for (const rr of [50, 100, 150]) { g.beginPath(); g.arc(160, 90, rr, 0, 6.3); g.stroke(); }
    smBodies.forEach((b, i) => drawBody(g, b, 320, 180, t, i === smSel));
  },
  action(a) {
    if (a === 'left' || a === 'up') { smSel = (smSel + smBodies.length - 1) % smBodies.length; ctx.audio.play(Sfx.CURSOR); smInfoRender(); }
    else if (a === 'right' || a === 'down') { smSel = (smSel + 1) % smBodies.length; ctx.audio.play(Sfx.CURSOR); smInfoRender(); }
    else if (a === 'pause' || a === 'confirm') { ctx.audio.play(Sfx.CANCEL); ctx.back(); }
  },
};

/* ---------------- Pause ---------------- */
let pRoot, pMenu;
function pauseItems() {
  const game = ctx.engine.game;
  return [
    { label: 'Resume' },
    { label: game.mode === Mode.ARCHIVIST ? modeLabels()[1] : modeLabels()[0], sub: 'switch mode' },
    { label: ctx.audio.muted ? 'Sound: OFF' : 'Sound: ON', sub: 'mute' },
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
        else if (i === 2) { ctx.audio.toggleMute(); ctx.audio.play(Sfx.CONFIRM); pMenu.setItems(pauseItems()); }
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
