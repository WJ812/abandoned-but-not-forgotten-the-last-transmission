/**
 * Prop panels: one docked panel per Prop that animates the real hardware
 * behavior from engine prop state. Scene overlays (camera head, rover sprite,
 * laser stripes, dust) are drawn by gfx/renderer.js from the same state.
 */
import { Prop, PropAction, Sfx, Mode, LATENCY, CANVAS_W } from '../contract.js';
import { ctx } from '../gfx/ctx.js';
import { drawText } from '../gfx/pixfont.js';
import { sojournerPos, getSceneCached } from '../gfx/renderer.js';
import { h, mount, unmount, Menu, pixCanvas, kvTable, clamp } from './dom.js';

const CW = 240, CH = 135;
const A = PropAction;
const f1 = (v, n = 1) => (typeof v === 'number' ? v.toFixed(n) : String(v ?? '-'));
const bar = (g, x, y, w, hh, k, col, bg = '#10213f') => { g.fillStyle = bg; g.fillRect(x, y, w, hh); g.fillStyle = col; g.fillRect(x, y, Math.round(w * clamp(k, 0, 1)), hh); };
const frame = (g) => { g.fillStyle = '#06122b'; g.fillRect(0, 0, CW, CH); g.fillStyle = 'rgba(61,214,245,0.07)'; for (let x = 0; x < CW; x += 12) g.fillRect(x, 0, 1, CH); for (let y = 0; y < CH; y += 12) g.fillRect(0, y, CW, 1); };

const arr = (v) => (Array.isArray(v) ? v : []);
const pt = (v, d) => (v && typeof v.x === 'number' && typeof v.y === 'number' ? v : d);
/** Guard against missing or short arrays in a (possibly malformed) PropSpec. */
function normSpec(p, raw) {
  const s = { ...(raw || {}) };
  s.title = s.title || 'Hardware'; s.blurb = s.blurb || '';
  if (p === Prop.LRV_NAV) {
    s.evas = arr(s.evas).map((e, i) => ({ label: `EVA ${i + 1}`, distanceKm: 0, ...(e || {}), path: arr(e?.path).length >= 2 ? e.path : [{ x: 0.4, y: 0.5 }, { x: 0.6, y: 0.5 }], stations: arr(e?.stations) }));
    s.lm = pt(s.lm, { x: 0.5, y: 0.5 }); s.odometerKm = s.odometerKm ?? 0; s.maxRangeFromLmKm = s.maxRangeFromLmKm ?? 0;
  } else if (p === Prop.LRV_BATTERY) {
    s.evaDrawWh = arr(s.evaDrawWh); s.motors = { count: 0, hp: 0, ...(s.motors || {}) }; s.count = s.count || 2; s.energyWh = s.energyWh || 0;
    s.chargeHistory = arr(s.chargeHistory).filter((c) => c && typeof c.pct === 'number');
  } else if (p === Prop.LRV_CAMERA) s.liftoffSequence = arr(s.liftoffSequence);
  else if (p === Prop.SOJ_APXS) s.targets = arr(s.targets).map((t) => ({ name: '?', rockType: '', finding: '', ...(t || {}), composition: arr(t?.composition) }));
  else if (p === Prop.SOJ_HAZARD || p === Prop.SOJ_DRIVE) s.obstacles = arr(s.obstacles);
  return s;
}

let P, spec, root, cv, rowsEl, menu, panel, rowT, st, prop;
let cursor = { x: 0, y: 0 }, hist = 0, warned = false;

const act = (a, arg) => { ctx.audio.play(Sfx.PROP_ACTION); st = ctx.engine.propAction(prop, a, arg) || st; };

function roverScene() { const sp = sojournerPos(getSceneCached(ctx.engine.game.region)); return sp ? { x: sp.x, y: sp.y } : { x: 160, y: 100 }; }
const K = CW / CANVAS_W;

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
    onKey(a) {
      const n = spec.chargeHistory.length; if (!n || (a !== 'left' && a !== 'right')) return false;
      hist = (hist + (a === 'right' ? 1 : -1) + n) % n; ctx.audio.play(Sfx.CURSOR); return true;
    },
    hint: [['W/S', 'choose'], ['A/D', 'graph point'], ['Space', 'do'], ['Esc', 'close']],
    rows: () => {
      const pnt = spec.chargeHistory[hist];
      const lt = st.loadTest;
      return [
        { label: 'Charge now', value: `${f1(st.chargePct, 0)}%  (${f1(st.voltageV, 0)} V of ${spec.voltageV} V)` },
        pnt ? { label: pnt.label, value: `${pnt.dateUtc}  ${f1(pnt.pct, 0)}%${pnt.estimated ? '  (estimated)' : ''}` } : { label: 'History', value: 'no charge history available' },
        { label: 'Cells', value: `${spec.count} x ${spec.capacityAh} Ah ${spec.chemistry}, ${spec.rechargeable ? 'rechargeable' : 'not rechargeable'}` },
        { label: 'Energy / motors', value: `${Math.round(spec.energyWh)} Wh, ${spec.motors.count} x ${spec.motors.hp} hp` },
        lt && (lt.running || lt.drawnWh) ? { label: 'Load test', value: `drew ${Math.round(lt.drawnWh)} Wh, ${f1(lt.remainingPct, 0)}% left` } : { label: 'Why dead', value: spec.whyDead || '-' },
      ];
    },
    draw(g, t) {
      frame(g);
      // compact cell gauges
      for (let i = 0; i < spec.count && i < 3; i++) { const x = 6 + i * 52; g.fillStyle = '#2a3a58'; g.fillRect(x, 4, 46, 16); bar(g, x + 2, 6, 42, 12, (st.chargePct || 0) / 100, '#5fe0a0', '#1a0d10'); drawText(g, `BAT ${i + 1}`, x + 2, 22, '#8fb4e8'); }
      const lt = st.loadTest;
      if (lt && (lt.running || lt.drawnWh)) { drawText(g, 'LOAD TEST', 166, 4, '#8fb4e8'); bar(g, 166, 12, 68, 6, 1 - (lt.remainingPct ?? 0) / 100 || 0, '#ffd166'); }
      drawText(g, `NOW ${f1(st.chargePct, 0)}%`, 166, 22, (st.chargePct || 0) > 0 ? '#5fe0a0' : '#ff6b5a');
      const H = spec.chargeHistory;
      const GL = 24, GT = 44, GB = 114, GH = GB - GT;
      const Y = (p) => Math.round(GB - (clamp(p, 0, 100) / 100) * GH);
      drawText(g, 'LRV BATTERY CHARGE %', 6, 36, '#8fb4e8');
      if (!H.length) { drawText(g, 'NO CHARGE HISTORY', GL + 4, 70, '#ff6b5a'); return; }
      // axes and grid
      for (const p of [0, 50, 100]) { g.fillStyle = p === 0 ? '#3a5a96' : '#16294d'; g.fillRect(GL, Y(p), 212, 1); drawText(g, String(p), p === 100 ? 6 : p === 50 ? 10 : 14, Y(p) - 2, '#8fb4e8'); }
      g.fillStyle = '#3a5a96'; g.fillRect(GL, GT, 1, GH + 1);
      // broken x axis: [EVA days] // [50-year tail]
      const t0 = Date.parse(H[0].dateUtc), tEva = Date.parse('1972-12-14T23:59:00Z'), tEnd = Date.parse(H[H.length - 1].dateUtc);
      const okT = H.every((c) => !Number.isNaN(Date.parse(c.dateUtc)));
      const AX0 = GL + 4, AX1 = 132, BX0 = 146, BX1 = 232;
      const X = (c, i) => {
        if (!okT) return Math.round(AX0 + (i / Math.max(1, H.length - 1)) * (BX1 - AX0));
        const tm = Date.parse(c.dateUtc);
        if (tm <= tEva) return Math.round(AX0 + ((tm - t0) / Math.max(1, tEva - t0 + 86400000)) * (AX1 - AX0));
        return Math.round(BX0 + ((tm - tEva) / Math.max(1, tEnd - tEva)) * (BX1 - BX0));
      };
      g.fillStyle = '#ffd166'; g.fillRect(AX1 + 3, GB - 3, 1, 7); g.fillRect(AX1 + 6, GB - 3, 1, 7);
      drawText(g, '1972', AX0, GB + 5, '#8fb4e8'); drawText(g, 'TODAY', BX1 - 20, GB + 5, '#8fb4e8');
      // segments: solid when measured, dashed when the end point is estimated
      const xs = H.map(X);
      for (let i = 1; i < H.length; i++) {
        const x0 = xs[i - 1], y0 = Y(H[i - 1].pct), x1 = xs[i], y1 = Y(H[i].pct);
        if (x1 < x0) continue;
        const crossBreak = x0 < AX1 + 2 && x1 > BX0 - 2;
        const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
        g.fillStyle = H[i].estimated ? '#ffd166' : '#5fe0a0';
        for (let k = 0; k <= n; k++) {
          if (H[i].estimated && Math.floor(k / 3) % 2) continue;
          const xx = x0 + ((x1 - x0) * k) / n;
          if (crossBreak && xx > AX1 && xx < BX0) continue;
          g.fillRect(Math.round(xx), Math.round(y0 + ((y1 - y0) * k) / n), 1, 1);
        }
      }
      // points and labels
      let lastLabelX = -99;
      H.forEach((c, i) => {
        const x = xs[i], y = Y(c.pct), sel = i === hist;
        g.fillStyle = sel ? '#ffffff' : c.estimated ? '#ffd166' : '#5fe0a0'; g.fillRect(x - 1, y - 1, 3, 3);
        if (sel) { g.strokeStyle = '#ffffff'; g.strokeRect(x - 3.5, y - 3.5, 7, 7); }
        const lab = /^EVA/i.test(c.label) ? c.label.toUpperCase() : null;
        if (lab && x - lastLabelX > 20) { drawText(g, lab, x - 8, Math.max(GT - 2, y - 12), '#e6edf5'); lastLabelX = x; }
      });
      // TODAY marker
      const li = H.length - 1, lx = xs[li], ly = Y(H[li].pct);
      g.fillStyle = '#ff6b5a'; for (let yy = GT; yy < GB; yy += 4) g.fillRect(lx, yy, 1, 2);
      const tl = `TODAY ${f1(H[li].pct, 0)}%`; drawText(g, tl, Math.min(lx - 3 * tl.length, BX1 - 4 * tl.length + 6), Math.min(GB - 12, ly - 10), '#ff6b5a');
      // tooltip for the selected point
      const c = H[hist], tip = `${c.label} ${c.dateUtc} ${f1(c.pct, 0)}%`.toUpperCase().slice(0, 44);
      const tw = tip.length * 4 + 4, tx = clamp(xs[hist] - tw / 2, GL, BX1 + 8 - tw);
      g.fillStyle = '#000'; g.fillRect(tx, 25, tw, 8); g.strokeStyle = '#ffd166'; g.strokeRect(tx + 0.5, 25.5, tw - 1, 7); drawText(g, tip, tx + 2, 27, '#ffd166');
      // legend
      g.fillStyle = '#5fe0a0'; g.fillRect(6, 130, 10, 1); drawText(g, 'MEASURED', 19, 128, '#8fb4e8');
      g.fillStyle = '#ffd166'; for (let k = 0; k < 10; k += 6) g.fillRect(80 + k, 130, 3, 1); drawText(g, 'DASHED = ESTIMATED', 96, 128, '#8fb4e8');
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
      const comp = arr(st.result?.composition); if (comp.length) {
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
    hint: [['WASD/Arrows', 'aim'], ['Space', 'send'], ['2', 'stop'], ['Esc', 'close']],
    controls: [{ label: 'Send waypoint', sub: '1 / Space', run: () => sendDrive() }, { label: 'Stop', sub: '2', run: () => act(A.DRIVE_STOP) }],
    rows: () => [
      { label: 'Phase', value: st.phase }, { label: 'Signal', value: st.phase === 'signal' ? `${LATENCY.LABEL} ${f1(st.signal * 100, 0)}%` : LATENCY.LABEL },
      { label: 'Odometer', value: `${f1(st.odometerM, 2)} m (mission ~${spec.totalTraverseM} m)` }, { label: 'Speed', value: `max ${spec.maxSpeedCmS} cm/s (scene time compressed)` },
      { label: 'Tilt', value: `${f1(st.tiltDeg, 0)} deg` }, { label: 'Note', value: spec.commandNote },
    ],
    onKey(a) {
      const d = { up: [0, -6], down: [0, 6], left: [-6, 0], right: [6, 0] }[a]; if (!d) return false;
      cursor.x = clamp(cursor.x + d[0], 4, CANVAS_W - 4); cursor.y = clamp(cursor.y + d[1], 56, 176); ctx.audio.play(Sfx.CURSOR); return true;
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
    prop = p; spec = normSpec(p, ctx.data.getPropSpec(p)); st = ctx.engine.propOpen(p); hist = 0;
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
      h('div', { class: 'foot' }, (panel.hint || [['W/S', 'choose'], ['Space', 'do'], ['1-9', 'quick'], ['Esc', 'close']]).map(([k, t]) => [h('span', { class: 'key' }, k), ` ${t}  `]))));
    mount(root); refreshRows();
  },
  exit() { ctx.engine.propClose(prop); unmount(root); },
  update(dt) {
    st = ctx.engine.propTick(prop, dt) || st;
    try { panel.draw(cv.g, ctx.time); rowT -= dt; if (rowT <= 0) { rowT = 0.1; refreshRows(); } } catch (err) { if (!warned) { warned = true; console.warn('prop panel draw failed', err); } }
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
