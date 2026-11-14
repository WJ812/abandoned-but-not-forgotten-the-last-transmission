/**
 * props.js -- real-hardware prop simulations (contract section 9).
 *
 * Pure and deterministic: no randomness, no wall clock, no DOM. Every function
 * receives the prop's spec (from data.getPropSpec, merged over the fallbacks
 * below) and a small context object for cross-prop / scene lookups:
 *
 *   ctx = { spec(prop) -> PropSpec, scene(region) -> SceneDef, state(prop) -> PropState|null }
 *
 * Time compression is documented per prop in PROP_TUNING. All state objects
 * carry {prop, open, changed}; `changed` is true when the last tick/action
 * changed something the UI should react to (a discrete transition).
 */

import {
  Prop, PropAction as A, PX_PER_M, Region,
  HotspotKind, Robot,
} from '../contract.js';
import { clamp, rayRect, rectCenter, norm360, DEG, sanitizeDt } from './geom.js';

/* ------------------------------------------------------------------------
 * Tuning (time compression and draw-scale factors). Real numbers come from
 * the PropSpec; these only decide how fast the real thing is replayed.
 * ---------------------------------------------------------------------- */
export const PROP_TUNING = Object.freeze({
  NAV_COMPRESS: 1800,         // EVA replay: 30 min of EVA per real second (7 h EVA ~ 14 s)
  NAV_STATION_WINDOW: 0.025,  // |t - station.at| that counts as "at the station"
  NAV_FALLBACK_WH_PER_KM: 70, // only if the battery spec has no evaDrawWh
  BAT_LOAD_TEST_S: 4,         // load-test animation length
  CAM_QUEUE_MAX: 16,
  CAM_LIFTOFF_HOLD_S: 2,      // keep the replay "running" this long after the last keyframe
  FENDER_DEMO_KMH: 10,        // wheel demo speed (LRV cruised ~8-12 km/h; top 18)
  FENDER_DUST_ON: 0.12,       // relative rooster-tail intensity with the repaired fender
  FENDER_DUST_OFF: 1.0,
  FENDER_DUST_RATE: 2.0,      // intensity units per second toward the target
  SOL_PLAY_S: 12,             // one Mars sol (24.66 h) replayed in 12 s
  SOL_LAT_DEG: 19.13,         // Pathfinder landing site latitude, Ares Vallis
  SOL_LS0_DEG: 142.7,         // areocentric solar longitude at landing (4 July 1997)
  SOL_LS_PER_SOL: 0.5,        // deg of Ls per sol around that season
  SOL_OBLIQUITY_DEG: 25.19,
  SOL_TAU: 0.5,               // atmospheric dust optical depth measured by Pathfinder
  SOL_MIN_OPS_W: 1.0,         // below this the rover is asleep / on battery
  APXS_COMPRESSED_S: 6,       // a ~10 h integration replayed in 6 s
  HAZ_SCAN_S: 1.5,            // stripe-by-stripe reveal
  HAZ_FAN_DEG: 60,            // total angular spread of the 5 stripes
  HAZ_MIN_RANGE_PX: 40,       // floor so the stripes reach the (2x drawn) rocks
  ROVER_DRAW_SCALE: 2,        // rovers are drawn at ~2x hero scale
  ROVER_HALF_LEN_PX: 12,      // sojourner_body is 24 px long
  HAZ_HEADING_DEG: 0,         // fixed: the parked rover faces +x (east on the scene)
  DRIVE_REPLAY_S: 10,         // one historical traverse leg replayed in 10 s
  DRIVE_STOP_WINDOW: 0.025,   // |t - stop.at| that counts as "at the stop"
});

const T = PROP_TUNING;

/* ------------------------------------------------------------------------
 * Fallback specs: used for any field data does not provide. Numbers mirror
 * the contract's documented values; EVA paths/compositions are placeholders.
 * ---------------------------------------------------------------------- */
const EVA_FALLBACK = [
  { id: 0, label: 'EVA-1', dateUtc: '1972-12-11', distanceKm: 3.3, durationMin: 432, maxRangeKm: 1.0,
    path: [{ x: 0.5, y: 0.55 }, { x: 0.56, y: 0.6 }, { x: 0.58, y: 0.52 }, { x: 0.5, y: 0.55 }],
    stations: [{ name: 'ALSEP', at: 0.2 }, { name: 'Station 1', at: 0.6 }] },
  { id: 1, label: 'EVA-2', dateUtc: '1972-12-12', distanceKm: 20.3, durationMin: 457, maxRangeKm: 7.6,
    path: [{ x: 0.5, y: 0.55 }, { x: 0.35, y: 0.7 }, { x: 0.15, y: 0.85 }, { x: 0.3, y: 0.62 }, { x: 0.5, y: 0.55 }],
    stations: [{ name: 'Station 2', at: 0.45 }, { name: 'Station 4', at: 0.7 }] },
  { id: 2, label: 'EVA-3', dateUtc: '1972-12-13', distanceKm: 12.1, durationMin: 435, maxRangeKm: 4.2,
    path: [{ x: 0.5, y: 0.55 }, { x: 0.55, y: 0.35 }, { x: 0.62, y: 0.22 }, { x: 0.54, y: 0.42 }, { x: 0.5, y: 0.55 }],
    stations: [{ name: 'Station 6', at: 0.35 }, { name: 'Station 7', at: 0.5 }] },
];

// Placeholder legs used only if data provides none (shapes are not real traces).
const LEG_FALLBACK = [
  { id: 0, label: 'Leg 1', sols: 'Sols 1-3', distanceM: 4,
    path: [{ x: 0.5, y: 0.5 }, { x: 0.55, y: 0.6 }, { x: 0.62, y: 0.62 }], stops: [{ name: 'Barnacle Bill', at: 1 }] },
  { id: 1, label: 'Leg 2', sols: 'Sols 4-20', distanceM: 20,
    path: [{ x: 0.62, y: 0.62 }, { x: 0.7, y: 0.45 }, { x: 0.75, y: 0.35 }], stops: [{ name: 'Yogi', at: 1 }] },
  { id: 2, label: 'Leg 3', sols: 'Sols 21-83', distanceM: 76,
    path: [{ x: 0.75, y: 0.35 }, { x: 0.4, y: 0.3 }, { x: 0.3, y: 0.55 }], stops: [] },
];

export const PROP_FALLBACK = Object.freeze({
  [Prop.LRV_NAV]: { title: 'LRV Navigation', blurb: '', archivist: '', odometerKm: 35.9, maxRangeFromLmKm: 7.6,
    navSystem: '', lm: { x: 0.5, y: 0.55 }, evas: EVA_FALLBACK },
  [Prop.LRV_BATTERY]: { title: 'LRV Batteries', blurb: '', archivist: '', count: 2, voltageV: 36, capacityAh: 121,
    chemistry: 'silver-zinc', rechargeable: false, energyWh: 2 * 36 * 121,
    motors: { count: 4, hp: 0.25, watts: 186 }, topSpeedKmh: 18, evaDrawWh: null, whyDead: '' },
  [Prop.LRV_CAMERA]: { title: 'GCTA TV Camera', blurb: '', archivist: '', panMinDeg: -170, panMaxDeg: 170,
    tiltMinDeg: -45, tiltMaxDeg: 85, zoomMin: 1, zoomMax: 6, panStepDeg: 15, tiltStepDeg: 10,
    commandDelayS: 1.3, liftoffUtc: '', liftoffSequence: [{ atS: 0, tiltDeg: 0 }, { atS: 3, tiltDeg: 15 }, { atS: 6, tiltDeg: 30 }], operator: '' },
  [Prop.LRV_FENDER]: { title: 'Fender Repair', blurb: '', archivist: '', brokenDate: '', fixDate: '', fixMaterials: '',
    wheelDiameterCm: 81.8, wheelMaterial: '', dustWithoutFender: '', dustWithFender: '' },
  [Prop.SOJ_SOLAR]: { title: 'Solar Panel', blurb: '', archivist: '', panelW: 16, panelAreaM2: 0.22, cellType: 'GaAs',
    batteryChemistry: 'LiSOCl2', batteryRechargeable: false, solHours: 24.66, dustLossPerSol: 0.0028,
    missionSols: 83, plannedSols: 7, nightPowerSource: '' },
  [Prop.SOJ_APXS]: { title: 'APXS', blurb: '', archivist: '', integrationHours: 10,
    targets: [{ id: 0, name: 'Barnacle Bill', sol: 3, rockType: '', composition: [], finding: '' },
      { id: 1, name: 'Yogi', sol: 5, rockType: '', composition: [], finding: '' }] },
  [Prop.SOJ_HAZARD]: { title: 'Hazard Detection', blurb: '', archivist: '', laserStripes: 5, cameras: 2,
    wheelDiameterCm: 13, hazardHeightCm: 13, scanRangeCm: 30, decision: '', obstacles: [] },
  [Prop.SOJ_DRIVE]: { title: 'Traverse Replay', blurb: '', archivist: '', maxSpeedCmS: 1, totalTraverseM: 100,
    maxFromLanderM: 12, landerPos: { x: 160, y: 80 }, commandNote: '', lastContactUtc: '1997-09-27', fate: '',
    lander: { x: 0.5, y: 0.5 }, legs: LEG_FALLBACK },
});

/** Merge a data spec over the fallback; empty arrays fall back too. */
export function mergeSpec(prop, spec) {
  const base = PROP_FALLBACK[prop] || {};
  const out = { ...base, ...(spec && typeof spec === 'object' ? spec : {}), prop };
  for (const k of Object.keys(base)) {
    if (Array.isArray(base[k]) && !(Array.isArray(out[k]) && out[k].length)) out[k] = base[k];
    if (out[k] === undefined || out[k] === null) {
      if (base[k] !== null) out[k] = base[k];
    }
  }
  return out;
}

const num = (v, d) => (typeof v === 'number' && Number.isFinite(v) ? v : d);

/* ========================================================================
 * Factory
 * ====================================================================== */
export function createPropState(prop, spec, ctx) {
  const base = { prop, open: false, changed: false };
  switch (prop) {
    case Prop.LRV_NAV: {
      const s = { ...base, evaIndex: 0, playing: false, t: 0, pos: { x: 0, y: 0 }, headingDeg: 0,
        bearingToLmDeg: 0, rangeToLmKm: 0, distanceKm: 0, batteryPct: 100, station: null };
      navSample(s, spec, ctx);
      return s;
    }
    case Prop.LRV_BATTERY:
      return { ...base, chargePct: 0, voltageV: 0,
        loadTest: { running: false, evaIndex: 0, drawnWh: 0, remainingPct: 100, t: 0 } };
    case Prop.LRV_CAMERA:
      return { ...base, panDeg: clamp(0, spec.panMinDeg, spec.panMaxDeg), tiltDeg: clamp(0, spec.tiltMinDeg, spec.tiltMaxDeg),
        zoom: spec.zoomMin, queue: [], nextFireIn: 0, clock: 0, liftoff: { running: false, t: 0, frame: -1 } };
    case Prop.LRV_FENDER:
      return { ...base, fenderOn: true, wheelAngleDeg: 0, dustIntensity: T.FENDER_DUST_ON };
    case Prop.SOJ_SOLAR: {
      const s = { ...base, playing: false, sol: 1, solTime: 0.5, sunElevDeg: 0, dustFactor: 1, powerW: 0, onBattery: false };
      solarSample(s, spec);
      return s;
    }
    case Prop.SOJ_APXS:
      return { ...base, targetIndex: 0, deployed: false, progress: 0, elapsedH: 0, result: null };
    case Prop.SOJ_HAZARD: {
      const n = Math.max(1, Math.round(num(spec.laserStripes, 5)));
      return { ...base, scanning: false, progress: 0, rangePx: hazardRangePx(spec),
        stripes: Array.from({ length: n }, () => ({ hit: false, distPx: 0, angleDeg: 0 })),
        hazard: false, detour: null, origin: null, headingDeg: 0, revealed: 0, pending: null };
    }
    case Prop.SOJ_DRIVE: {
      const s = { ...base, legIndex: 0, playing: false, t: 0, pos: { x: 0, y: 0 }, headingDeg: 0,
        rangeToLanderM: 0, distanceM: 0, sol: '', stop: null };
      driveSample(s, spec);
      return s;
    }
    default:
      return null;
  }
}

/* ========================================================================
 * Actions
 * ====================================================================== */
export function propActionImpl(s, spec, action, arg, ctx) {
  s.changed = false;
  switch (s.prop) {
    case Prop.LRV_NAV: return navAction(s, spec, action, arg, ctx);
    case Prop.LRV_BATTERY: return batteryAction(s, spec, action, arg);
    case Prop.LRV_CAMERA: return cameraAction(s, spec, action, arg);
    case Prop.LRV_FENDER:
      if (action === A.FENDER_TOGGLE) { s.fenderOn = !s.fenderOn; s.changed = true; }
      return s;
    case Prop.SOJ_SOLAR: return solarAction(s, spec, action, arg);
    case Prop.SOJ_APXS: return apxsAction(s, spec, action, arg);
    case Prop.SOJ_HAZARD:
      if (action === A.HAZ_SCAN) hazardStart(s, spec, ctx);
      return s;
    case Prop.SOJ_DRIVE: return driveAction(s, spec, action, arg);
    default: return s;
  }
}

/* ========================================================================
 * Ticks
 * ====================================================================== */
export function propTickImpl(s, spec, dt, ctx) {
  s.changed = false;
  dt = sanitizeDt(dt);              // NaN/Infinity/negative -> 0, huge -> MAX_TICK_DT
  if (!(dt > 0)) return s;
  switch (s.prop) {
    case Prop.LRV_NAV: return navTick(s, spec, dt, ctx);
    case Prop.LRV_BATTERY: return batteryTick(s, spec, dt);
    case Prop.LRV_CAMERA: return cameraTick(s, spec, dt);
    case Prop.LRV_FENDER: return fenderTick(s, spec, dt);
    case Prop.SOJ_SOLAR: return solarTick(s, spec, dt);
    case Prop.SOJ_APXS: return apxsTick(s, spec, dt);
    case Prop.SOJ_HAZARD: return hazardTick(s, spec, dt);
    case Prop.SOJ_DRIVE: return driveTick(s, spec, dt);
    default: return s;
  }
}

/* ------------------------------------------------------------------------
 * LRV_NAV: replay of the real EVA traverses on the nav mini-map.
 * Heading/bearing are compass degrees (0 = north = up on the map, clockwise).
 * Range uses a per-EVA map scale fixed so the farthest path point from the LM
 * equals that EVA's real maxRangeKm.
 * ---------------------------------------------------------------------- */
function navAction(s, spec, action, arg, ctx) {
  const n = spec.evas.length;
  if (action === A.NAV_SELECT) {
    const i = clamp(Math.trunc(num(arg, 0)), 0, n - 1);
    s.evaIndex = i; s.t = 0; s.playing = false; s.changed = true;
  } else if (action === A.NAV_PLAY) {
    if (s.t >= 1) s.t = 0;
    s.playing = true; s.changed = true;
  } else if (action === A.NAV_PAUSE) {
    if (s.playing) { s.playing = false; s.changed = true; }
  } else if (action === A.NAV_RESET) {
    s.t = 0; s.playing = false; s.changed = true;
  }
  navSample(s, spec, ctx);
  return s;
}

function navTick(s, spec, dt, ctx) {
  if (!s.playing) return s;
  const eva = spec.evas[s.evaIndex] || spec.evas[0];
  const replayS = Math.max(1, (num(eva.durationMin, 420) * 60) / T.NAV_COMPRESS);
  s.t += dt / replayS;
  if (s.t >= 1) { s.t = 1; s.playing = false; s.changed = true; }
  const before = s.station;
  navSample(s, spec, ctx);
  if (s.station !== before) s.changed = true;
  return s;
}

function navSample(s, spec, ctx) {
  const eva = spec.evas[s.evaIndex] || spec.evas[0];
  const pts = (eva && Array.isArray(eva.path) && eva.path.length >= 2) ? eva.path : EVA_FALLBACK[0].path;
  const lm = spec.lm || { x: 0.5, y: 0.5 };
  const seg = [];
  let total = 0;
  for (let i = 1; i < pts.length; i++) {
    const l = Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
    seg.push(l); total += l;
  }
  let target = clamp(s.t, 0, 1) * total;
  let i = 0;
  while (i < seg.length - 1 && target > seg[i]) { target -= seg[i]; i++; }
  const a = pts[i], b = pts[i + 1];
  const f = seg[i] > 0 ? clamp(target / seg[i], 0, 1) : 0;
  const x = a.x + (b.x - a.x) * f;
  const y = a.y + (b.y - a.y) * f;
  s.pos = { x, y };
  s.headingDeg = norm360(Math.atan2(b.x - a.x, -(b.y - a.y)) / DEG);
  const dx = lm.x - x, dy = lm.y - y;
  const d = Math.hypot(dx, dy);
  s.bearingToLmDeg = d > 1e-9 ? norm360(Math.atan2(dx, -dy) / DEG) : 0;
  let maxD = 0;
  for (const p of pts) maxD = Math.max(maxD, Math.hypot(p.x - lm.x, p.y - lm.y));
  const kmPerUnit = maxD > 1e-9 ? num(eva.maxRangeKm, 1) / maxD : 0;
  s.rangeToLmKm = d * kmPerUnit;
  s.distanceKm = clamp(s.t, 0, 1) * num(eva.distanceKm, 0);
  s.batteryPct = navBatteryPct(s, spec, ctx);
  let st = null;
  for (const sta of (eva.stations || [])) {
    if (Math.abs(num(sta.at, -1) - s.t) <= T.NAV_STATION_WINDOW) { st = sta.name; break; }
  }
  s.station = st;
}

/** Battery level the console would have shown at this point of the replay
 *  (fresh packs at EVA-1 start, real per-EVA draw). Today it reads 0 %. */
function navBatteryPct(s, spec, ctx) {
  const bat = ctx.spec(Prop.LRV_BATTERY);
  const energy = num(bat.energyWh, 0) || num(bat.count, 2) * num(bat.voltageV, 36) * num(bat.capacityAh, 121);
  const draws = evaDraws(bat, spec);
  let used = 0;
  for (let i = 0; i < s.evaIndex && i < draws.length; i++) used += draws[i];
  used += clamp(s.t, 0, 1) * (draws[s.evaIndex] || 0);
  return energy > 0 ? clamp(100 * (1 - used / energy), 0, 100) : 0;
}

function evaDraws(bat, navSpec) {
  if (Array.isArray(bat.evaDrawWh) && bat.evaDrawWh.length) return bat.evaDrawWh.map((v) => num(v, 0));
  const evas = (navSpec && navSpec.evas) || EVA_FALLBACK;
  return evas.map((e) => num(e.distanceKm, 0) * T.NAV_FALLBACK_WH_PER_KM);
}

/* ------------------------------------------------------------------------
 * LRV_BATTERY: silver-zinc primaries, discharged in 1972, never recharge.
 * chargePct and voltageV are always 0. The load test animates what ONE EVA
 * drew from a fresh pair, as a hypothetical (the real packs stay at 0).
 * ---------------------------------------------------------------------- */
function batteryAction(s, spec, action, arg) {
  if (action !== A.BAT_LOAD_TEST) return s;
  const draws = evaDraws(spec, null);
  const n = Math.max(1, draws.length);
  const i = (typeof arg === 'number' && Number.isFinite(arg))
    ? clamp(Math.trunc(arg), 0, n - 1)
    : (s.loadTest.running || s.loadTest.t > 0 ? (s.loadTest.evaIndex + 1) % n : s.loadTest.evaIndex);
  s.loadTest = { running: true, evaIndex: i, drawnWh: 0, remainingPct: 100, t: 0 };
  s.chargePct = 0; s.voltageV = 0;
  s.changed = true;
  return s;
}

function batteryTick(s, spec, dt) {
  s.chargePct = 0; s.voltageV = 0;                 // dead since 1972: never recharges
  const lt = s.loadTest;
  if (!lt.running) return s;
  const draws = evaDraws(spec, null);
  const energy = num(spec.energyWh, 0) || num(spec.count, 2) * num(spec.voltageV, 36) * num(spec.capacityAh, 121);
  lt.t = Math.min(T.BAT_LOAD_TEST_S, lt.t + dt);
  const f = lt.t / T.BAT_LOAD_TEST_S;
  lt.drawnWh = f * (draws[lt.evaIndex] || 0);
  lt.remainingPct = energy > 0 ? clamp(100 * (1 - lt.drawnWh / energy), 0, 100) : 0;
  if (f >= 1) { lt.running = false; s.changed = true; }
  return s;
}

/* ------------------------------------------------------------------------
 * LRV_CAMERA (GCTA): every pan/tilt/zoom command is queued and executes
 * spec.commandDelayS (1.3 s one-way Earth-Moon light time) after it was sent.
 * The liftoff replay steps the tilt through the pre-timed keyframes.
 * ---------------------------------------------------------------------- */
function cameraAction(s, spec, action, arg) {
  if (action === A.CAM_PAN || action === A.CAM_TILT || action === A.CAM_ZOOM) {
    const sign = Math.sign(num(arg, 0));
    if (!sign) return s;
    if (s.queue.length >= T.CAM_QUEUE_MAX) return s;
    s.queue.push({ action, arg: sign, fireAt: s.clock + num(spec.commandDelayS, 1.3) });
    s.nextFireIn = Math.max(0, s.queue[0].fireAt - s.clock);
    s.changed = true;
  } else if (action === A.CAM_LIFTOFF) {
    s.liftoff = { running: true, t: 0, frame: -1 };
    cameraLiftoffApply(s, spec);
    s.changed = true;
  }
  return s;
}

function cameraExec(s, spec, cmd) {
  if (cmd.action === A.CAM_PAN) s.panDeg = clamp(s.panDeg + cmd.arg * num(spec.panStepDeg, 15), spec.panMinDeg, spec.panMaxDeg);
  else if (cmd.action === A.CAM_TILT) s.tiltDeg = clamp(s.tiltDeg + cmd.arg * num(spec.tiltStepDeg, 10), spec.tiltMinDeg, spec.tiltMaxDeg);
  else if (cmd.action === A.CAM_ZOOM) s.zoom = clamp(s.zoom + cmd.arg, spec.zoomMin, spec.zoomMax);
}

function cameraLiftoffApply(s, spec) {
  const seq = Array.isArray(spec.liftoffSequence) ? spec.liftoffSequence : [];
  let f = -1;
  for (let i = 0; i < seq.length; i++) if (num(seq[i].atS, 0) <= s.liftoff.t + 1e-9) f = i;
  if (f !== s.liftoff.frame) {
    s.liftoff.frame = f;
    if (f >= 0) {
      const k = seq[f];
      if (typeof k.tiltDeg === 'number') s.tiltDeg = clamp(k.tiltDeg, spec.tiltMinDeg, spec.tiltMaxDeg);
      if (typeof k.panDeg === 'number') s.panDeg = clamp(k.panDeg, spec.panMinDeg, spec.panMaxDeg);
      if (typeof k.zoom === 'number') s.zoom = clamp(k.zoom, spec.zoomMin, spec.zoomMax);
    }
    s.changed = true;
  }
  const last = seq.length ? num(seq[seq.length - 1].atS, 0) : 0;
  if (s.liftoff.t >= last + T.CAM_LIFTOFF_HOLD_S) { s.liftoff.running = false; s.changed = true; }
}

function cameraTick(s, spec, dt) {
  s.clock += dt;
  while (s.queue.length && s.queue[0].fireAt <= s.clock + 1e-9) {
    cameraExec(s, spec, s.queue.shift());
    s.changed = true;
  }
  s.nextFireIn = s.queue.length ? Math.max(0, s.queue[0].fireAt - s.clock) : 0;
  if (s.liftoff.running) {
    s.liftoff.t += dt;
    cameraLiftoffApply(s, spec);
  }
  return s;
}

/* ------------------------------------------------------------------------
 * LRV_FENDER: the wheel spins at a demo speed; the rooster tail of dust is
 * large without the fender and small with the taped-map repair.
 * ---------------------------------------------------------------------- */
function fenderTick(s, spec, dt) {
  const v = T.FENDER_DEMO_KMH / 3.6;                                 // m/s
  const circ = Math.PI * num(spec.wheelDiameterCm, 81.8) / 100;      // m
  s.wheelAngleDeg = norm360(s.wheelAngleDeg + (v / circ) * 360 * dt);
  const target = s.fenderOn ? T.FENDER_DUST_ON : T.FENDER_DUST_OFF;
  const step = T.FENDER_DUST_RATE * dt;
  s.dustIntensity = Math.abs(target - s.dustIntensity) <= step ? target : s.dustIntensity + Math.sign(target - s.dustIntensity) * step;
  return s;
}

/* ------------------------------------------------------------------------
 * SOJ_SOLAR: panel output follows the real sun elevation at Ares Vallis
 * (latitude 19.13 N, northern summer, Ls advancing per sol), attenuated by
 * atmospheric dust (optical depth tau along the slant path) and by dust
 * settling on the cells (dustLossPerSol, compounding).
 *   P = panelW * sin(el) * exp(-tau (1/sin(el) - 1)) * (1 - loss)^(sols elapsed)
 * At night (or below SOL_MIN_OPS_W) the rover is on its non-rechargeable battery.
 * ---------------------------------------------------------------------- */
function solarAction(s, spec, action, arg) {
  if (action === A.SOLAR_PLAY) { s.playing = true; s.changed = true; }
  else if (action === A.SOLAR_PAUSE) { s.playing = false; s.changed = true; }
  else if (action === A.SOLAR_SET_SOL) {
    s.sol = clamp(Math.trunc(num(arg, 1)), 1, Math.max(1, num(spec.missionSols, 83)));
    s.changed = true;
  }
  solarSample(s, spec);
  return s;
}

function solarTick(s, spec, dt) {
  if (!s.playing) { solarSample(s, spec); return s; }
  const maxSol = Math.max(1, num(spec.missionSols, 83));
  s.solTime += dt / T.SOL_PLAY_S;
  while (s.solTime >= 1) {
    if (s.sol >= maxSol) { s.solTime = 1; s.playing = false; break; }
    s.solTime -= 1; s.sol += 1; s.changed = true;
  }
  const wasBattery = s.onBattery;
  solarSample(s, spec);
  if (s.onBattery !== wasBattery) s.changed = true;
  return s;
}

export function sunElevationDeg(sol, solTime) {
  const ls = (T.SOL_LS0_DEG + T.SOL_LS_PER_SOL * (sol - 1 + solTime)) * DEG;
  const dec = Math.asin(Math.sin(T.SOL_OBLIQUITY_DEG * DEG) * Math.sin(ls));
  const lat = T.SOL_LAT_DEG * DEG;
  const h = (solTime - 0.5) * 2 * Math.PI;
  const sinEl = Math.sin(lat) * Math.sin(dec) + Math.cos(lat) * Math.cos(dec) * Math.cos(h);
  return Math.asin(clamp(sinEl, -1, 1)) / DEG;
}

function solarSample(s, spec) {
  s.sunElevDeg = sunElevationDeg(s.sol, s.solTime);
  s.dustFactor = Math.pow(1 - clamp(num(spec.dustLossPerSol, 0.0028), 0, 1), Math.max(0, s.sol - 1 + s.solTime));
  const sinEl = Math.sin(s.sunElevDeg * DEG);
  if (sinEl <= 0) s.powerW = 0;
  else {
    const atm = Math.exp(-T.SOL_TAU * (1 / Math.max(sinEl, 0.02) - 1));
    s.powerW = num(spec.panelW, 16) * sinEl * atm * s.dustFactor;
  }
  s.onBattery = s.powerW < T.SOL_MIN_OPS_W;
}

/* ------------------------------------------------------------------------
 * SOJ_APXS: deploy the sensor head on a target rock; the ~10 h integration
 * runs on a compressed timer; the composition appears only when it completes.
 * ---------------------------------------------------------------------- */
function apxsAction(s, spec, action, arg) {
  if (action === A.APXS_DEPLOY) {
    const n = Math.max(1, spec.targets.length);
    s.targetIndex = clamp(Math.trunc(num(arg, 0)), 0, n - 1);
    s.deployed = true; s.progress = 0; s.elapsedH = 0; s.result = null; s.changed = true;
  } else if (action === A.APXS_ABORT) {
    if (s.deployed) { s.deployed = false; s.progress = 0; s.elapsedH = 0; s.result = null; s.changed = true; }
  }
  return s;
}

function apxsTick(s, spec, dt) {
  if (!s.deployed) return s;
  const hours = Math.max(0.01, num(spec.integrationHours, 10));
  s.progress = Math.min(1, s.progress + dt / T.APXS_COMPRESSED_S);
  s.elapsedH = s.progress * hours;
  if (s.progress >= 1 - 1e-9) {
    s.progress = 1;
    const tg = spec.targets[s.targetIndex] || {};
    s.result = { name: tg.name ?? '', rockType: tg.rockType ?? '',
      composition: Array.isArray(tg.composition) ? tg.composition.map((c) => ({ ...c })) : [], finding: tg.finding ?? '' };
    s.deployed = false;                         // head stowed, spectrum downlinked
    s.changed = true;
  }
  return s;
}

/* ------------------------------------------------------------------------
 * Rover pose helpers (shared by HAZARD and DRIVE).
 * ---------------------------------------------------------------------- */
export function findRoverHotspot(scene) {
  if (!scene || !Array.isArray(scene.hotspots)) return null;
  return scene.hotspots.find((h) => h.id === 'mars.sojourner')
    || scene.hotspots.find((h) => h.kind === HotspotKind.ROBOT && h.ref === Robot.SOJOURNER)
    || null;
}

/** Sojourner never moves: its pose is the 'mars.sojourner' hotspot center with
 *  a fixed heading. Falls back to beside the lander if the scene lacks it. */
export function roverPos(ctx) {
  let scene = null;
  try { scene = ctx.scene(Region.MARS); } catch { scene = null; }
  const h = findRoverHotspot(scene);
  if (h && h.rect) return rectCenter(h.rect);
  const lp = ctx.spec(Prop.SOJ_DRIVE).landerPos || { x: 160, y: 80 };
  return { x: lp.x + 36, y: lp.y };
}

/* ------------------------------------------------------------------------
 * SOJ_HAZARD: five laser stripes fanned ahead of the rover, ray-cast against
 * the rock rects. A stripe "hits" where it meets a rock within range (rocks
 * with heightCm below hazardHeightCm are seen but are not hazards). The
 * onboard decision turns toward the side whose stripes are clearer.
 * The rover never moves or turns: fixed pose, so the scan is a pure readout.
 * ---------------------------------------------------------------------- */
function hazardRangePx(spec) {
  const r = num(spec.scanRangeCm, 30) / 100 * PX_PER_M * T.ROVER_DRAW_SCALE;
  return Math.max(T.HAZ_MIN_RANGE_PX, r);
}

function hazardObstacles(spec, ctx) {
  if (Array.isArray(spec.obstacles) && spec.obstacles.length) return spec.obstacles;
  const ds = ctx.spec(Prop.SOJ_DRIVE);
  return Array.isArray(ds && ds.obstacles) ? ds.obstacles : [];
}

function hazardStart(s, spec, ctx) {
  const obs = hazardObstacles(spec, ctx);
  const pos = roverPos(ctx);
  const heading = num(spec.headingDeg, T.HAZ_HEADING_DEG);   // fixed; the rover is parked forever
  const n = s.stripes.length;
  const range = hazardRangePx(spec);
  const ox = pos.x + Math.cos(heading * DEG) * T.ROVER_HALF_LEN_PX;
  const oy = pos.y + Math.sin(heading * DEG) * T.ROVER_HALF_LEN_PX;
  const hazH = num(spec.hazardHeightCm, 13);
  const result = [];
  for (let i = 0; i < n; i++) {
    const off = n === 1 ? 0 : -T.HAZ_FAN_DEG / 2 + (i * T.HAZ_FAN_DEG) / (n - 1);
    const ang = heading + off;                  // + = clockwise = rover's right (y down)
    const dx = Math.cos(ang * DEG), dy = Math.sin(ang * DEG);
    let tBest = -1, hazardous = false;
    for (const o of obs) {
      const t = rayRect(ox, oy, dx, dy, o, range);
      if (t >= 0 && (tBest < 0 || t < tBest)) {
        tBest = t;
        hazardous = !(typeof o.heightCm === 'number' && o.heightCm < hazH);
      }
    }
    result.push({ hit: tBest >= 0, distPx: tBest >= 0 ? tBest : range, angleDeg: norm360(ang), hazardous });
  }
  s.scanning = true; s.progress = 0; s.hazard = false; s.detour = null;
  s.rangePx = range; s.origin = { x: ox, y: oy }; s.headingDeg = norm360(heading);
  s.stripes = result.map((r) => ({ hit: false, distPx: 0, angleDeg: r.angleDeg }));
  s.pending = result;
  s.revealed = 0;
  s.changed = true;
}

function hazardTick(s, spec, dt) {
  if (!s.scanning || !s.pending) return s;
  s.progress = Math.min(1, s.progress + dt / T.HAZ_SCAN_S);
  const n = s.pending.length;
  const shown = Math.min(n, Math.floor(s.progress * n + 1e-9));
  while (s.revealed < shown) {
    const r = s.pending[s.revealed];
    s.stripes[s.revealed] = { hit: r.hit, distPx: r.distPx, angleDeg: r.angleDeg };
    s.revealed++;
    s.changed = true;
  }
  if (s.progress >= 1) {
    const res = s.pending;
    s.hazard = res.some((r) => r.hit && r.hazardous);
    if (s.hazard) {
      const mid = (n - 1) / 2;
      let left = 0, right = 0;
      res.forEach((r, i) => {
        if (!(r.hit && r.hazardous)) return;
        const w = s.rangePx - r.distPx + 1;     // nearer rock = worse
        if (i < mid) left += w; else if (i > mid) right += w;
      });
      s.detour = left <= right ? 'left' : 'right';
    } else s.detour = null;
    s.scanning = false; s.pending = null; s.changed = true;
  }
  return s;
}

/* ------------------------------------------------------------------------
 * SOJ_DRIVE: HISTORICAL TRAVERSE REPLAY. Sojourner has been silent since
 * 1997-09-27 and never moves in the game; this only replays its real legs on
 * the minimap (like LRV_NAV), by distance along spec.legs[i].path.
 * Range uses one map scale for all legs: the farthest path point from the
 * lander equals spec.maxFromLanderM.
 * ---------------------------------------------------------------------- */
function legsOf(spec) {
  const legs = Array.isArray(spec.legs) ? spec.legs.filter((l) => l && Array.isArray(l.path) && l.path.length >= 2) : [];
  return legs.length ? legs : LEG_FALLBACK;
}

function driveAction(s, spec, action, arg) {
  const n = legsOf(spec).length;
  if (action === A.DRIVE_SELECT) {
    s.legIndex = clamp(Math.trunc(num(arg, 0)), 0, n - 1); s.t = 0; s.playing = false; s.changed = true;
  } else if (action === A.DRIVE_PLAY) {
    if (s.t >= 1) s.t = 0;
    s.playing = true; s.changed = true;
  } else if (action === A.DRIVE_PAUSE) {
    if (s.playing) { s.playing = false; s.changed = true; }
  } else if (action === A.DRIVE_RESET) {
    s.t = 0; s.playing = false; s.changed = true;
  }
  driveSample(s, spec);
  return s;
}

function driveTick(s, spec, dt) {
  if (!s.playing) return s;
  s.t += dt / T.DRIVE_REPLAY_S;
  if (s.t >= 1) { s.t = 1; s.playing = false; s.changed = true; }
  const before = s.stop;
  driveSample(s, spec);
  if (s.stop !== before) s.changed = true;
  return s;
}

function driveSample(s, spec) {
  const legs = legsOf(spec);
  s.legIndex = clamp(s.legIndex, 0, legs.length - 1);
  const leg = legs[s.legIndex];
  const pts = leg.path;
  const lander = spec.lander && Number.isFinite(spec.lander.x) ? spec.lander : pts[0];
  const seg = [];
  let total = 0;
  for (let i = 1; i < pts.length; i++) {
    const l = Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
    seg.push(l); total += l;
  }
  const t = clamp(num(s.t, 0), 0, 1);
  let rest = t * total;
  let i = 0;
  while (i < seg.length - 1 && rest > seg[i]) { rest -= seg[i]; i++; }
  const a = pts[i], b = pts[i + 1];
  const f = seg[i] > 0 ? clamp(rest / seg[i], 0, 1) : 0;
  const x = a.x + (b.x - a.x) * f, y = a.y + (b.y - a.y) * f;
  s.pos = { x, y };
  s.headingDeg = norm360(Math.atan2(b.x - a.x, -(b.y - a.y)) / DEG);   // map compass, 0 = up
  let maxD = 0;
  for (const l of legs) for (const p of l.path) maxD = Math.max(maxD, Math.hypot(p.x - lander.x, p.y - lander.y));
  const mPerUnit = maxD > 1e-9 ? num(spec.maxFromLanderM, 12) / maxD : 0;
  s.rangeToLanderM = Math.hypot(x - lander.x, y - lander.y) * mPerUnit;
  s.distanceM = t * num(leg.distanceM, 0);
  s.sol = typeof leg.sols === 'string' ? leg.sols : String(leg.sols ?? '');
  let st = null;
  for (const p of (leg.stops || [])) {
    if (Math.abs(num(p.at, -1) - t) <= T.DRIVE_STOP_WINDOW) { st = p.name; break; }
  }
  s.stop = st;
}
