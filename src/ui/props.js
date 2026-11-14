/**
 * Prop panels: one docked panel per Prop that animates the real hardware
 * behavior from engine prop state. Scene overlays (camera head, rover sprite,
 * laser stripes, dust) are drawn by gfx/renderer.js from the same state.
 */
import { Prop, PropAction, Sfx, Mode, HotspotKind, Robot, LATENCY } from '../contract.js';
import { ctx } from '../gfx/ctx.js';
import { drawText } from '../gfx/pixfont.js';
import { sojournerPos, getSceneCached } from '../gfx/renderer.js';
import { h, mount, unmount, Menu, pixCanvas, kvTable, clamp } from './dom.js';

const CW = 240, CH = 135;
const A = PropAction;
const f1 = (v, n = 1) => (typeof v === 'number' ? v.toFixed(n) : String(v ?? '-'));
const bar = (g, x, y, w, hh, k, col, bg = '#10213f') => { g.fillStyle = bg; g.fillRect(x, y, w, hh); g.fillStyle = col; g.fillRect(x, y, Math.round(w * clamp(k, 0, 1)), hh); };
const frame = (g) => { g.fillStyle = '#06122b'; g.fillRect(0, 0, CW, CH); g.fillStyle = 'rgba(61,214,245,0.07)'; for (let x = 0; x < CW; x += 12) g.fillRect(x, 0, 1, CH); for (let y = 0; y < CH; y += 12) g.fillRect(0, y, CW, 1); };

let P, spec, root, cv, rowsEl, menu, panel, rowT, st, prop;
let cursor = { x: 0, y: 0 };

const act = (a, arg) => { ctx.audio.play(Sfx.PROP_ACTION); st = ctx.engine.propAction(prop, a, arg) || st; };

function roverScene() { const sp = sojournerPos(getSceneCached(ctx.engine.game.region)); return sp ? { x: sp.x, y: sp.y } : { x: 160, y: 100 }; }
const K = 0.75;

const PANELS = {
  [Prop.LRV_NAV]: () => ({
    controls: [
      ...spec.evas.map((e, i) => ({ label: `EVA ${i + 1}`, sub: `${e.distanceKm} km`, run: () => act(A.NAV_SELECT, i) })),
      { label: 'Play / Pause', run: () => act(st.playing ? A.NAV_PAUSE : A.NAV_PLAY) },
      { label: 'Reset', run: () => act(A.NAV_RESET) },
    ],
    rows: () => [
      { label: 'EVA', value: spec.evas[st.evaIndex]?.label ?? '' }, { label: 'Odometer', value: `${f1(st.distanceKm)} km of ${spec.odometerKm} km total` },
      { label: 'Range to LM', value: `${f1(st.rangeToLmKm)} km (max ${spec.maxRangeFromLmKm})` }, { label: 'Bearing to LM', value: `${Math.round(st.bearingToLmDeg)} deg` },
      { label: 'Battery', value: `${f1(st.batteryPct, 0)}%` }, { label: 'Station', value: st.station || '-' },
    ],
    draw(g, t) {
      frame(g); const eva = spec.evas[st.evaIndex]; if (!eva) return;
      const pts = eva.path.map((p) => [p.x * CW, p.y * CH]);
      g.strokeStyle = '#2f6b57'; g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.stroke();
      const seg = st.t * (pts.length - 1); g.strokeStyle = '#5fe0a0'; g.beginPath();
      for (let i = 0; i <= Math.floor(seg) && i < pts.length; i++) (i ? g.lineTo(pts[i][0], pts[i][1]) : g.moveTo(pts[i][0], pts[i][1]));
      if (st.pos) g.lineTo(st.pos.x * CW, st.pos.y * CH); g.stroke();
      (eva.stations || []).forEach((s, i) => { const k = s.at * (pts.length - 1), a = Math.floor(k), p0 = pts[a], p1 = pts[Math.min(pts.length - 1, a + 1)]; const x = p0[0] + (p1[0] - p0[0]) * (k - a), y = p0[1] + (p1[1] - p0[1]) * (k - a); g.fillStyle = '#ffd166'; g.fillRect(Math.round(x) - 1, Math.round(y) - 1, 3, 3); drawText(g, String(i + 1), Math.round(x) + 3, Math.round(y) - 7, '#ffd166'); });
      g.fillStyle = '#3dd6f5'; g.fillRect(Math.round(spec.lm.x * CW) - 3, Math.round(spec.lm.y * CH) - 3, 7, 7); drawText(g, 'LM', Math.round(spec.lm.x * CW) + 6, Math.round(spec.lm.y * CH) - 2, '#3dd6f5');
      if (st.pos) { const x = st.pos.x * CW, y = st.pos.y * CH, a = (st.headingDeg * Math.PI) / 180; g.fillStyle = '#fff'; g.fillRect(Math.round(x) - 2, Math.round(y) - 2, 5, 5); g.strokeStyle = '#fff'; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * 9, y + Math.sin(a) * 9); g.stroke(); }
      drawText(g, 'EVA TRAVERSE REPLAY', 4, 4, '#8fb4e8');
    },
  }),
  [Prop.LRV_BATTERY]: () => ({
    controls: spec.evaDrawWh.map((w, i) => ({ label: `Load test: EVA ${i + 1}`, sub: `${Math.round(w)} Wh`, run: () => act(A.BAT_LOAD_TEST, i) })),
    rows: () => [
      { label: 'Charge', value: `${f1(st.chargePct, 0)}%` }, { label: 'Voltage', value: `${f1(st.voltageV, 0)} V (rated ${spec.voltageV} V)` },
      { label: 'Cells', value: `${spec.count} x ${spec.capacityAh} Ah ${spec.chemistry}` }, { label: 'Rechargeable', value: spec.rechargeable ? 'yes' : 'no' },
      { label: 'Energy', value: `${Math.round(spec.energyWh)} Wh` }, { label: 'Motors', value: `${spec.motors.count} x ${spec.motors.hp} hp` },
      st.loadTest?.running || st.loadTest?.drawnWh ? { label: 'Load test', value: `drew ${Math.round(st.loadTest.drawnWh)} Wh, ${f1(st.loadTest.remainingPct, 0)}% left` } : { label: 'Why dead', value: spec.whyDead },
    ],
    draw(g, t) {
      frame(g);
      for (let i = 0; i < spec.count; i++) { const x = 20 + i * 108; g.fillStyle = '#2a3a58'; g.fillRect(x, 24, 96, 44); g.fillStyle = '#10213f'; g.fillRect(x + 4, 28, 88, 36); bar(g, x + 6, 32, 84, 28, st.chargePct / 100, '#5fe0a0', '#1a0d10'); drawText(g, `BAT ${i + 1}`, x + 4, 14, '#8fb4e8'); }
      drawText(g, `${f1(st.chargePct, 0)}%`, 100, 40, '#ff6b5a', 2);
      const lt = st.loadTest; if (lt) { drawText(g, 'LOAD TEST', 20, 82, '#8fb4e8'); bar(g, 20, 92, 200, 10, 1 - (lt.remainingPct ?? 0) / 100 || 0, '#ffd166'); drawText(g, `DRAWN ${Math.round(lt.drawnWh || 0)} WH`, 20, 108, '#fff'); }
      if (st.chargePct === 0 && Math.floor(t * 2) % 2) drawText(g, 'EMPTY - NOT RECHARGEABLE', 20, 122, '#ff6b5a');
    },
  }),
  [Prop.LRV_CAMERA]: () => ({
    controls: [
      { label: 'Pan left', run: () => act(A.CAM_PAN, -1) }, { label: 'Pan right', run: () => act(A.CAM_PAN, 1) },
      { label: 'Tilt up', run: () => act(A.CAM_TILT, 1) }, { label: 'Tilt down', run: () => act(A.CAM_TILT, -1) },
      { label: 'Zoom in', run: () => act(A.CAM_ZOOM, 1) }, { label: 'Zoom out', run: () => act(A.CAM_ZOOM, -1) },
      { label: 'Replay liftoff', sub: spec.liftoffUtc, run: () => act(A.CAM_LIFTOFF) },
    ],
    rows: () => [
      { label: 'Pan', value: `${f1(st.panDeg, 0)} deg` }, { label: 'Tilt', value: `${f1(st.tiltDeg, 0)} deg` }, { label: 'Zoom', value: `${f1(st.zoom, 1)}x` },
      { label: 'Command queue', value: `${st.queue?.length || 0} (Earth delay ${spec.commandDelayS} s)` }, { label: 'Next fires in', value: st.queue?.length ? `${f1(st.nextFireIn)} s` : '-' },
      { label: 'Operator', value: spec.operator },
    ],
    draw(g, t) {
      frame(g);
      const tilt = st.tiltDeg + (st.liftoff?.running ? 0 : 0), z = st.zoom || 1;
      const hor = 70 + tilt * 1.4;
      g.save(); g.beginPath(); g.rect(20, 14, 200, 104); g.clip();
      g.fillStyle = '#000'; g.fillRect(20, 14, 200, 104);
      g.fillStyle = '#4b4f58'; g.fillRect(20, hor, 200, 120);
      const off = -st.panDeg * 3 * z;
      for (let i = -6; i < 12; i++) { const x = 20 + ((i * 38 + off) % 460 + 460) % 460 - 100; g.fillStyle = '#6b707b'; g.fillRect(x, hor - 6 * z, 18 * z, 6 * z); }
      g.fillStyle = '#9fc4ff'; const ex = 120 + off * 0.5 + 60, ey = 30 - tilt;
      g.beginPath(); g.arc(ex, ey, 8 * z, 0, 7); g.fill(); g.fillStyle = '#3a78c8'; g.beginPath(); g.arc(ex + 2, ey + 1, 6 * z, 0, 7); g.fill();
      g.restore();
      g.strokeStyle = '#3dd6f5'; g.strokeRect(20.5, 14.5, 199, 103);
      g.fillStyle = '#3dd6f5'; g.fillRect(118, 65, 5, 1); g.fillRect(120, 63, 1, 5);
      if (st.liftoff?.running) drawText(g, 'LIFTOFF REPLAY', 26, 20, '#ffd166');
      if (st.queue?.length) drawText(g, `CMD PENDING ${f1(st.nextFireIn)}S`, 26, 108, '#ffd166');
      drawText(g, 'GCTA TV', 26, 4, '#8fb4e8');
    },
  }),
  [Prop.LRV_FENDER]: () => ({
    controls: [{ label: 'Toggle fender', sub: 'repaired / lost', run: () => act(A.FENDER_TOGGLE) }],
    rows: () => [
      { label: 'Fender', value: st.fenderOn ? `repaired (${spec.fixMaterials})` : 'missing (broken ' + spec.brokenDate + ')' },
      { label: 'Wheel', value: `${spec.wheelDiameterCm} cm, ${spec.wheelMaterial}` }, { label: 'Fixed', value: spec.fixDate },
      { label: 'Dust', value: st.fenderOn ? spec.dustWithFender : spec.dustWithoutFender },
    ],
    draw(g, t) {
      frame(g);
      ctx.assets.draw(g, 'lrv_wheel', Math.floor(((st.wheelAngleDeg % 360 + 360) % 360) / 90) % 4, 84, 40, { w: 60, h: 60 });
      if (st.fenderOn) ctx.assets.draw(g, 'lrv_fender', 1, 76, 24, { w: 80, h: 40 });
      const n = Math.round(30 * st.dustIntensity);
      for (let i = 0; i < n; i++) { const k = (t * 1.5 + i / Math.max(1, n)) % 1; g.fillStyle = `rgba(200,200,205,${1 - k})`; g.fillRect(Math.round(80 - k * 70), Math.round(95 - Math.sin(k * 3.14) * (30 + 30 * st.dustIntensity) + ((i * 7) % 9)), 2, 2); }
      g.fillStyle = '#767b86'; g.fillRect(0, 100, CW, 35);
      drawText(g, st.fenderOn ? 'WITH TAPED-MAP FENDER' : 'NO FENDER: ROOSTER TAIL', 8, 6, st.fenderOn ? '#5fe0a0' : '#ff6b5a');
    },
  }),
  [Prop.SOJ_SOLAR]: () => ({
    controls: [
      { label: 'Play / Pause', run: () => act(st.playing ? A.SOLAR_PAUSE : A.SOLAR_PLAY) },
      { label: 'Sol -10', run: () => act(A.SOLAR_SET_SOL, clamp(st.sol - 10, 1, spec.missionSols)) }, { label: 'Sol +10', run: () => act(A.SOLAR_SET_SOL, clamp(st.sol + 10, 1, spec.missionSols)) },
      { label: 'Sol 1', run: () => act(A.SOLAR_SET_SOL, 1) }, { label: `Sol ${spec.missionSols}`, run: () => act(A.SOLAR_SET_SOL, spec.missionSols) },
    ],
    rows: () => [
      { label: 'Sol', value: `${Math.round(st.sol)} of ${spec.missionSols} (planned ${spec.plannedSols})` }, { label: 'Sun elevation', value: `${f1(st.sunElevDeg, 0)} deg` },
      { label: 'Dust on panel', value: `${f1(st.dustFactor * 100, 0)}% clear` }, { label: 'Power', value: `${f1(st.powerW)} W of ${spec.panelW} W` },
      { label: 'Source', value: st.onBattery ? `${spec.batteryChemistry} battery (night)` : `${spec.cellType} solar panel` },
    ],
    draw(g, t) {
      frame(g);
      g.fillStyle = st.sunElevDeg > 0 ? '#2a3f78' : '#050a1a'; g.fillRect(0, 0, CW, 90); g.fillStyle = '#6e3a1c'; g.fillRect(0, 90, CW, 45);
      const a = clamp((st.solTime ?? 0), 0, 1) * Math.PI, sx = 20 + (1 - Math.cos(a)) * 100, sy = 90 - Math.sin(a) * 70;
      g.strokeStyle = 'rgba(255,209,102,0.25)'; g.beginPath(); g.arc(120, 90, 100, Math.PI, 0); g.stroke();
      g.fillStyle = '#ffd166'; g.beginPath(); g.arc(sx, sy, 6, 0, 7); g.fill();
      g.fillStyle = `rgba(150,60,20,${1 - st.dustFactor})`; g.fillStyle = '#1d2f66'; g.fillRect(90, 82, 40, 8);
      g.fillStyle = `rgba(193,68,14,${clamp(1 - st.dustFactor, 0, 1) * 1.2})`; g.fillRect(90, 82, 40, 8);
      drawText(g, 'POWER', 150, 20, '#8fb4e8'); bar(g, 150, 30, 80, 10, st.powerW / spec.panelW, '#5fe0a0');
      drawText(g, `${f1(st.powerW)} W`, 150, 46, '#fff', 2);
      if (st.onBattery && Math.floor(t * 2) % 2) drawText(g, 'ON BATTERY', 150, 66, '#ff6b5a');
      drawText(g, `SOL ${Math.round(st.sol)}`, 6, 6, '#fff');
    },
  }),
  [Prop.SOJ_APXS]: () => ({
    controls: [
      ...spec.targets.map((tg, i) => ({ label: `Deploy on ${tg.name}`, sub: tg.rockType, run: () => act(A.APXS_DEPLOY, i) })),
      { label: 'Abort', run: () => act(A.APXS_ABORT) },
    ],
    rows: () => [
      { label: 'Target', value: spec.targets[st.targetIndex]?.name ?? '-' }, { label: 'Head', value: st.deployed ? 'deployed' : 'stowed' },
      { label: 'Integration', value: `${f1(st.progress * 100, 0)}% of ~${spec.integrationHours} h (compressed)` },
      ...(st.result ? [{ label: 'Result', value: `${st.result.rockType}. ${st.result.finding}` }] : []),
    ],
    draw(g, t) {
      frame(g);
      g.fillStyle = '#6e3a1c'; g.fillRect(0, 95, CW, 40);
      g.fillStyle = '#7d5a46'; g.fillRect(30, 60, 70, 40); g.fillStyle = '#9a7660'; g.fillRect(34, 56, 50, 8);
      ctx.assets.draw(g, 'sojourner_apxs', st.deployed ? 1 : 0, 56, st.deployed ? 52 : 40, { w: 32, h: 32 });
      if (st.deployed) { g.fillStyle = `rgba(61,214,245,${0.3 + 0.2 * Math.sin(t * 10)})`; g.fillRect(64, 80, 16, 3); }
      bar(g, 20, 112, 90, 8, st.progress, '#3dd6f5');
      const comp = st.result?.composition; if (comp) {
        comp.slice(0, 6).forEach((c, i) => { drawText(g, c.element, 126, 10 + i * 17, '#8fb4e8'); bar(g, 146, 9 + i * 17, 88, 8, c.pct / 60, '#ffd166'); drawText(g, `${f1(c.pct)}%`, 192, 10 + i * 17, '#fff'); });
      } else drawText(g, st.deployed ? 'MEASURING...' : 'PICK A ROCK', 130, 60, '#8fb4e8');
    },
  }),
  [Prop.SOJ_HAZARD]: () => ({
    controls: [{ label: 'Run hazard scan', run: () => act(A.HAZ_SCAN) }],
    rows: () => [
      { label: 'Laser stripes', value: `${spec.laserStripes} + ${spec.cameras} cameras` }, { label: 'Scan', value: st.scanning ? `${f1(st.progress * 100, 0)}%` : st.hazard ? 'hazard found' : 'ready' },
      { label: 'Decision', value: st.detour ? `detour ${st.detour}` : 'no detour yet' }, { label: 'How', value: spec.decision },
    ],
    draw(g, t) { drawField(g, t, spec.obstacles, st); },
  }),
  [Prop.SOJ_DRIVE]: () => ({
    controls: [{ label: 'Send waypoint', sub: 'Space', run: () => sendDrive() }, { label: 'Stop', run: () => act(A.DRIVE_STOP) }],
    rows: () => [
      { label: 'Phase', value: st.phase }, { label: 'Signal', value: st.phase === 'signal' ? `${LATENCY.LABEL} ${f1(st.signal * 100, 0)}%` : LATENCY.LABEL },
      { label: 'Odometer', value: `${f1(st.odometerM, 2)} m (mission ~${spec.totalTraverseM} m)` }, { label: 'Speed', value: `max ${spec.maxSpeedCmS} cm/s (scene time compressed)` },
      { label: 'Tilt', value: `${f1(st.tiltDeg, 0)} deg` }, { label: 'Note', value: spec.commandNote },
    ],
    onKey(a) {
      const d = { up: [0, -6], down: [0, 6], left: [-6, 0], right: [6, 0] }[a]; if (!d) return false;
      cursor.x = clamp(cursor.x + d[0], 4, 316); cursor.y = clamp(cursor.y + d[1], 56, 176); ctx.audio.play(Sfx.CURSOR); return true;
    },
    draw(g, t) { drawField(g, t, spec.obstacles, st, true); },
  }),
};

function sendDrive() { act(A.DRIVE_GOTO, { x: cursor.x, y: cursor.y }); }

function drawField(g, t, obstacles, s, drive) {
  frame(g); g.fillStyle = '#5a2c14'; g.fillRect(0, 0, CW, CH);
  const rv = roverScene(); const X = (v) => Math.round(v * K), Y = (v) => Math.round(v * K);
  g.fillStyle = '#3a1a0c'; for (const r of obstacles || []) g.fillRect(X(r.x), Y(r.y), Math.max(2, Math.round(r.w * K)), Math.max(2, Math.round(r.h * K)));
  try { const lp = ctx.data.getPropSpec(Prop.SOJ_DRIVE).landerPos; if (lp) { g.fillStyle = '#b07a4a'; g.fillRect(X(lp.x) - 12, Y(lp.y) - 8, 24, 16); drawText(g, 'LANDER', X(lp.x) - 11, Y(lp.y) - 2, '#000'); } } catch { /* none */ }
  const dir = 1;
  if (s.stripes) s.stripes.forEach((sr, i) => { g.fillStyle = sr.hit ? '#ff3b3b' : '#ff9a9a'; g.globalAlpha = s.scanning ? 0.9 : 0.45; g.fillRect(X(rv.x + 12 * dir), Y(rv.y - 8 + i * 4), Math.max(2, Math.round((sr.distPx ?? 30) * K * Math.min(1, (s.progress ?? 1) * 1.4 + 0.2))), 1); g.globalAlpha = 1; });
  if (drive) {
    if (s.target) { g.fillStyle = '#ffd166'; g.fillRect(X(s.target.x) - 3, Y(s.target.y), 7, 1); g.fillRect(X(s.target.x), Y(s.target.y) - 3, 1, 7); }
    g.fillStyle = Math.floor(t * 4) % 2 ? '#fff' : '#3dd6f5'; const cx = X(cursor.x), cy = Y(cursor.y);
    g.fillRect(cx - 5, cy, 4, 1); g.fillRect(cx + 2, cy, 4, 1); g.fillRect(cx, cy - 5, 1, 4); g.fillRect(cx, cy + 2, 1, 4);
    if (s.phase === 'signal') { bar(g, 10, 120, 100, 8, s.signal, '#3dd6f5'); drawText(g, LATENCY.LABEL, 10, 110, '#3dd6f5'); }
  }
  if (s.detour) { g.fillStyle = '#5fe0a0'; g.fillRect(X(rv.x + 14), Y(rv.y + (s.detour === 'left' ? -14 : 14)), 18, 2); }
  g.fillStyle = '#d8a24a'; g.fillRect(X(rv.x) - 4, Y(rv.y) - 3, 9, 7);
  drawText(g, drive ? 'ARROWS: AIM   SPACE: SEND' : 'HAZARD SCAN (TOP VIEW)', 4, 4, '#ffe9c0');
}

export const propPanel = {
  enter({ prop: p }) {
    prop = p; spec = ctx.data.getPropSpec(p); st = ctx.engine.propOpen(p);
    const rv = roverScene(); cursor = { x: Math.round(rv.x + 30), y: Math.round(rv.y) };
    panel = PANELS[p]();
    const px = pixCanvas(CW, CH, 'prop-cv'); cv = px;
    menu = new Menu({
      cls: 'pmenu', items: [...panel.controls.map((c) => ({ label: c.label, sub: c.sub })), { label: 'Close panel', sub: 'Esc' }],
      onPick: (i) => { if (i >= panel.controls.length) { ctx.audio.play(Sfx.CANCEL); ctx.back(); } else panel.controls[i].run(); },
    });
    rowsEl = h('div', { class: 'prow' }); rowT = 0;
    const arch = ctx.engine.game.mode === Mode.ARCHIVIST;
    root = h('div', { class: 'screen dock' }, h('div', { class: 'card prop' },
      h('div', { class: 'card-title' }, h('span', { class: 'chip' }, 'HARDWARE'), spec.title),
      h('p', { class: 'blurb' }, spec.blurb), arch ? h('p', { class: 'blurb arch-p' }, spec.archivist) : null,
      h('div', { class: 'pcols' }, h('div', null, px.c, rowsEl), menu.el),
      h('div', { class: 'foot' }, h('span', { class: 'key' }, 'W/S'), ' choose ', h('span', { class: 'key' }, 'Space'), ' do  ', h('span', { class: 'key' }, 'Esc'), ' close')));
    mount(root); refreshRows();
  },
  exit() { ctx.engine.propClose(prop); unmount(root); },
  update(dt) {
    st = ctx.engine.propTick(prop, dt) || st;
    panel.draw(cv.g, ctx.time);
    rowT -= dt; if (rowT <= 0) { rowT = 0.1; refreshRows(); }
  },
  action(a, e) {
    if (panel.onKey?.(a)) return;
    if (a === 'up') menu.move(-1); else if (a === 'down') menu.move(1);
    else if (a === 'confirm') { if (prop === Prop.SOJ_DRIVE) sendDrive(); else menu.pick(); }
    else if (a === 'num' && e.digit <= panel.controls.length) { menu.index = e.digit - 1; menu.render(); menu.pick(); }
    else if (a === 'pause' || a === 'notebook') { ctx.audio.play(Sfx.CANCEL); ctx.back(); }
  },
};

function refreshRows() {
  const rows = panel.rows(); rowsEl.textContent = '';
  rowsEl.appendChild(kvTable(rows));
}
