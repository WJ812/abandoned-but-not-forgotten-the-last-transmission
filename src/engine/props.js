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
  Prop, PropAction as A, LATENCY, PX_PER_M, TIME_SCALE, Region, CANVAS_W, CANVAS_H,
  HotspotKind, Robot,
} from '../contract.js';
import { clamp, overlaps, rayRect, rectGap, rectCenter, norm360, DEG } from './geom.js';

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
  ROVER_FOOT_W: 16, ROVER_FOOT_H: 8,
  DRIVE_TIME_COMPRESS: 20,    // on top of TIME_SCALE: 1 cm/s -> 6 px/s on screen
  DRIVE_STALL_S: 8,           // no progress for this long -> 'blocked'
  DRIVE_RIPPLE_DEG: 3,        // rocker-bogie rocking over small stones
  DRIVE_RIPPLE_M: 0.35,       // wavelength of that rocking
  DRIVE_ROCK_TILT_DEG: 12,    // extra tilt when a wheel climbs beside a rock
  DRIVE_ROCK_NEAR_PX: 6,
  DRIVE_TILT_RATE: 40,        // deg/s the body can change tilt
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
  [Prop.SOJ_DRIVE]: { title: 'Drive Command', blurb: '', archivist: '', maxSpeedCmS: 1, totalTraverseM: 100,
    maxFromLanderM: 12, landerPos: { x: 160, y: 80 }, commandNote: '', obstacles: [] },
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
      const start = roverStartPos(ctx, spec);
      return { ...base, phase: 'idle', signal: 0, pos: { ...start }, start: { ...start }, target: null,
        tiltDeg: 0, odometerM: 0, realTimeS: 0, speedPxS: 0, headingDeg: 0, stopSignal: -1,
        detourSide: 0, stall: 0, bestDist: Infinity };
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

function roverStartPos(ctx, driveSpec) {
  let scene = null;
  try { scene = ctx.scene(Region.MARS); } catch { scene = null; }
  const h = findRoverHotspot(scene);
  if (h && h.rect) return rectCenter(h.rect);
  const lp = driveSpec.landerPos || { x: 160, y: 80 };
  return { x: lp.x + 36, y: lp.y };
}

function roverPose(ctx) {
  const d = ctx.state(Prop.SOJ_DRIVE);
  if (d) return { pos: { ...d.pos }, headingDeg: d.headingDeg, driven: d.odometerM > 0 };
  const ds = ctx.spec(Prop.SOJ_DRIVE);
  return { pos: roverStartPos(ctx, ds), headingDeg: 0, driven: false };
}

const footRect = (x, y) => ({ x: x - T.ROVER_FOOT_W / 2, y: y - T.ROVER_FOOT_H / 2, w: T.ROVER_FOOT_W, h: T.ROVER_FOOT_H });

/* ------------------------------------------------------------------------
 * SOJ_HAZARD: five laser stripes fanned ahead of the rover, ray-cast against
 * the rock rects. A stripe "hits" where it meets a rock within range (rocks
 * with heightCm below hazardHeightCm are seen but are not hazards). The
 * onboard decision turns toward the side whose stripes are clearer.
 * Before the rover has driven, it faces the nearest rock (demo pose).
 * ---------------------------------------------------------------------- */
function hazardRangePx(spec) {
  const r = num(spec.scanRangeCm, 30) / 100 * PX_PER_M * T.ROVER_DRAW_SCALE;
  return Math.max(T.HAZ_MIN_RANGE_PX, r);
}

function hazardObstacles(spec, ctx) {
  if (Array.isArray(spec.obstacles) && spec.obstacles.length) return spec.obstacles;
  const ds = ctx.spec(Prop.SOJ_DRIVE);
  return Array.isArray(ds.obstacles) ? ds.obstacles : [];
}

function hazardStart(s, spec, ctx) {
  const obs = hazardObstacles(spec, ctx);
  const pose = roverPose(ctx);
  let heading = pose.headingDeg;
  if (!pose.driven && obs.length) {
    let best = Infinity;
    for (const o of obs) {
      const c = rectCenter(o);
      const d = Math.hypot(c.x - pose.pos.x, c.y - pose.pos.y);
      if (d < best) { best = d; heading = norm360(Math.atan2(c.y - pose.pos.y, c.x - pose.pos.x) / DEG); }
    }
  }
  const n = s.stripes.length;
  const range = hazardRangePx(spec);
  const ox = pose.pos.x + Math.cos(heading * DEG) * T.ROVER_HALF_LEN_PX;
  const oy = pose.pos.y + Math.sin(heading * DEG) * T.ROVER_HALF_LEN_PX;
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
 * SOJ_DRIVE: a waypoint command first crosses the Earth-Mars gap (the SIGNAL
 * bar, LATENCY.GAUGE_REAL_S), then the rover crawls at maxSpeedCmS (1 cm/s)
 * scaled by TIME_SCALE and DRIVE_TIME_COMPRESS, autonomously steering around
 * rocks. A STOP command also takes the full signal delay to arrive, so the
 * rover keeps crawling meanwhile, as it would have. Rocker-bogie tilt follows
 * small-stone rocking plus rocks beside the wheels. Target is kept within
 * maxFromLanderM of the lander (the rover's radio range) and on screen.
 * ---------------------------------------------------------------------- */
export function driveSpeedPxS(spec) {
  return num(spec.maxSpeedCmS, 1) / 100 * PX_PER_M * TIME_SCALE * T.DRIVE_TIME_COMPRESS;
}

function clampTarget(spec, p) {
  let x = clamp(num(p.x, 0), T.ROVER_FOOT_W / 2, CANVAS_W - T.ROVER_FOOT_W / 2);
  let y = clamp(num(p.y, 0), T.ROVER_FOOT_H / 2, CANVAS_H - T.ROVER_FOOT_H / 2);
  const lp = spec.landerPos;
  const R = num(spec.maxFromLanderM, 12) * PX_PER_M;
  if (lp && R > 0) {
    const dx = x - lp.x, dy = y - lp.y;
    const d = Math.hypot(dx, dy);
    if (d > R) { x = lp.x + (dx / d) * R; y = lp.y + (dy / d) * R; }
  }
  return { x, y };
}

function driveAction(s, spec, action, arg) {
  if (action === A.DRIVE_GOTO) {
    if (!arg || typeof arg !== 'object') return s;
    s.target = clampTarget(spec, arg);
    s.phase = 'signal'; s.signal = 0; s.stopSignal = -1; s.speedPxS = 0;
    s.detourSide = 0; s.stall = 0; s.bestDist = Infinity;
    s.changed = true;
  } else if (action === A.DRIVE_STOP) {
    if ((s.phase === 'signal' || s.phase === 'moving' || s.phase === 'blocked') && s.stopSignal < 0) {
      s.stopSignal = 0; s.changed = true;
    }
  }
  return s;
}

function driveFree(spec, obs, from, to) {
  const f = footRect(to.x, to.y);
  if (f.x < 0 || f.y < 0 || f.x + f.w > CANVAS_W || f.y + f.h > CANVAS_H) return false;
  const cur = footRect(from.x, from.y);
  for (const o of obs) if (overlaps(f, o) && !overlaps(cur, o)) return false;
  return true;
}

function driveTick(s, spec, dt) {
  const gauge = LATENCY.GAUGE_REAL_S;
  if (s.stopSignal >= 0) {
    s.stopSignal = Math.min(1, s.stopSignal + dt / gauge);
    if (s.stopSignal >= 1 - 1e-9) {
      s.stopSignal = -1;
      if (s.phase === 'signal' || s.phase === 'moving' || s.phase === 'blocked') {
        s.phase = 'idle'; s.target = null; s.speedPxS = 0; s.changed = true;
      }
    }
  }
  if (s.phase === 'signal') {
    s.signal = Math.min(1, s.signal + dt / gauge);
    if (s.signal >= 1 - 1e-9) { s.signal = 1; s.phase = 'moving'; s.changed = true; }
    return s;
  }
  if (s.phase !== 'moving' || !s.target) { s.speedPxS = 0; return s; }

  const obs = Array.isArray(spec.obstacles) ? spec.obstacles : [];
  const speed = driveSpeedPxS(spec);
  const dx = s.target.x - s.pos.x, dy = s.target.y - s.pos.y;
  const dist = Math.hypot(dx, dy);
  const step = Math.min(speed * dt, dist);
  if (dist < 1e-6) { s.phase = 'arrived'; s.speedPxS = 0; s.changed = true; return s; }

  const desired = Math.atan2(dy, dx) / DEG;
  const tryAt = (offDeg) => {
    const a = (desired + offDeg) * DEG;
    const to = { x: s.pos.x + Math.cos(a) * step, y: s.pos.y + Math.sin(a) * step };
    return driveFree(spec, obs, s.pos, to) ? to : null;
  };
  let moved = tryAt(0);
  let usedOff = 0;
  if (!moved) {
    if (!s.detourSide) {
      // Turn away from the blocking rock (positive offset = clockwise = right).
      const probe = { x: s.pos.x + Math.cos(desired * DEG) * Math.max(step, 1), y: s.pos.y + Math.sin(desired * DEG) * Math.max(step, 1) };
      const pf = footRect(probe.x, probe.y);
      const rock = obs.find((o) => overlaps(pf, o));
      if (rock) {
        const c = rectCenter(rock);
        const cross = Math.cos(desired * DEG) * (c.y - s.pos.y) - Math.sin(desired * DEG) * (c.x - s.pos.x);
        s.detourSide = cross > 0 ? -1 : 1;
      } else s.detourSide = 1;
    }
    // Exhaust the chosen side before trying the other (no left/right dithering).
    for (const sd of [s.detourSide, -s.detourSide]) {
      for (const a of [30, 60, 90, 120, 150]) {
        moved = tryAt(sd * a);
        if (moved) { usedOff = sd * a; break; }
      }
      if (moved) break;
    }
  }

  if (!moved) {
    s.phase = 'blocked'; s.speedPxS = 0; s.changed = true;
    return s;
  }
  const movedPx = Math.hypot(moved.x - s.pos.x, moved.y - s.pos.y);
  s.pos = moved;
  s.headingDeg = norm360(desired + usedOff);
  s.speedPxS = speed;
  s.odometerM += movedPx / PX_PER_M;
  s.realTimeS = s.odometerM / Math.max(1e-6, num(spec.maxSpeedCmS, 1) / 100);
  driveTilt(s, obs, dt);

  const left = Math.hypot(s.target.x - s.pos.x, s.target.y - s.pos.y);
  if (left <= 1e-3) {
    s.pos = { ...s.target };
    s.phase = 'arrived'; s.speedPxS = 0; s.changed = true;
    return s;
  }
  if (left < s.bestDist - 0.5) { s.bestDist = left; s.stall = 0; }
  else {
    s.stall += dt;
    if (s.stall >= T.DRIVE_STALL_S) { s.phase = 'blocked'; s.speedPxS = 0; s.changed = true; }
  }
  return s;
}

function driveTilt(s, obs, dt) {
  let target = T.DRIVE_RIPPLE_DEG * Math.sin((s.odometerM / T.DRIVE_RIPPLE_M) * 2 * Math.PI);
  const f = footRect(s.pos.x, s.pos.y);
  const h = s.headingDeg * DEG;
  let rock = 0;
  for (const o of obs) {
    const gap = rectGap(f, o);
    if (gap >= T.DRIVE_ROCK_NEAR_PX) continue;
    const c = rectCenter(o);
    const cross = Math.cos(h) * (c.y - s.pos.y) - Math.sin(h) * (c.x - s.pos.x);
    const side = cross >= 0 ? 1 : -1;            // rock on the right lifts the right bogie
    const amt = T.DRIVE_ROCK_TILT_DEG * (1 - gap / T.DRIVE_ROCK_NEAR_PX) * side;
    if (Math.abs(amt) > Math.abs(rock)) rock = amt;
  }
  target += rock;
  const maxStep = T.DRIVE_TILT_RATE * dt;
  const d = target - s.tiltDeg;
  s.tiltDeg = Math.abs(d) <= maxStep ? target : s.tiltDeg + Math.sign(d) * maxStep;
}
