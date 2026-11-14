/**
 * core.js -- the headless engine: GameState, movement + AABB collision with
 * sliding, automatic hops, headlamp cone / shadows, edge-triggered hotspots and
 * fact zones, the SIGNAL latency timer, progress, mode, props and the save.
 *
 * This file does NOT import the data module. `index.js` wires the real data in
 * through `_setDataProvider`; tests inject fixture scenes / prop specs the same
 * way, so they never depend on the data module's timing.
 */

import {
  Region, REGION_COUNT, Dir, Btn, EVT, DT, PLAYER, INTERACT_RANGE_PX, HEADLAMP, LATENCY,
  PHYSICS_DEFAULTS, HOP_REGIONS, STEP_INTERVAL_S, GF, Collect, BP_COUNT, BP_ALL_MASK, ROBOT_COUNT,
  Mode, Trigger, HotspotKind, Prop, PROP_COUNT, propRegion, SAVE_KEY, SAVE_VERSION, CANVAS_W, CANVAS_H,
} from '../contract.js';
import { overlaps, pointIn, rectGap, rectCenter, angleDiff, popcount } from './geom.js';
import { createPropState, propActionImpl, propTickImpl, mergeSpec, findRoverHotspot } from './props.js';

/* ========================================================================
 * Physics tuning. The contract allows WALK and HOP_TAKEOFF +/-25%; gravity is
 * always exact. We use the contract values unchanged (factor 1.0).
 * ====================================================================== */
export const TUNING = Object.freeze({
  WALK_FACTOR: 1.0,
  HOP_FACTOR: 1.0,
  AIR_CONTROL: 0.5,     // accel/friction multiplier while airborne (no traction mid-hop)
  MAX_SUBSTEP_PX: 2,
  MOVING_EPS: 4,        // px/s below which a coasting player counts as stopped
});

/* ========================================================================
 * Data provider (injected).
 * ====================================================================== */
const provider = { getScene: null, getPropSpec: null };
const sceneCache = new Map();
const specCache = new Map();

/** Wire a data source: {getScene(region), getPropSpec(prop)}. Clears caches. */
export function _setDataProvider(p) {
  provider.getScene = p && typeof p.getScene === 'function' ? p.getScene : null;
  provider.getPropSpec = p && typeof p.getPropSpec === 'function' ? p.getPropSpec : null;
  sceneCache.clear();
  specCache.clear();
  liveCache.clear();
}

const R = (r, d) => (r && [r.x, r.y, r.w, r.h].every((v) => typeof v === 'number' && Number.isFinite(v)) ? r : d);

function normalizeScene(s, region) {
  const src = s && typeof s === 'object' ? s : {};
  return {
    ...src,
    region,
    w: src.w ?? CANVAS_W,
    h: src.h ?? CANVAS_H,
    spawn: src.spawn ?? { x: (CANVAS_W - PLAYER.W) / 2, y: (CANVAS_H - PLAYER.H) / 2, facing: Dir.DOWN },
    solids: Array.isArray(src.solids) ? src.solids : [],
    shadows: Array.isArray(src.shadows) ? src.shadows : [],
    hotspots: Array.isArray(src.hotspots) ? src.hotspots.filter((h) => h && R(h.rect, null)) : [],
    facts: Array.isArray(src.facts) ? src.facts.filter((f) => f && R(f.rect, null)) : [],
    walkable: R(src.walkable, { x: 0, y: 0, w: CANVAS_W, h: CANVAS_H }),
  };
}

export function sceneFor(region) {
  if (sceneCache.has(region)) return sceneCache.get(region);
  let s = null;
  try { s = provider.getScene ? provider.getScene(region) : null; } catch { s = null; }
  const n = normalizeScene(s, region);
  sceneCache.set(region, n);
  return n;
}

function specFor(prop) {
  if (specCache.has(prop)) return specCache.get(prop);
  let s = null;
  try { s = provider.getPropSpec ? provider.getPropSpec(prop) : null; } catch { s = null; }
  const m = mergeSpec(prop, s);
  specCache.set(prop, m);
  return m;
}

/* ========================================================================
 * GameState singleton. Mutated in place so references stay valid.
 * ====================================================================== */
const newPlayer = () => ({ x: 0, y: 0, vx: 0, vy: 0, z: 0, vz: 0, facing: Dir.DOWN, anim: 0, moving: false, airborne: false });

export const game = {
  blueprints: 0, robotsTalked: 0, asked: [0, 0], mode: Mode.EXPLORER, flags: 0,
  region: Region.HUB, player: newPlayer(), events: 0, frame: 0, time: 0,
  headlampOn: false, inShadow: false, nearHotspot: null, pendingFact: -1, factsSeen: 0,
  latency: { active: false, progress: 0, elapsed: 0 },
  props: {},
};

/** Engine-private session bookkeeping (not part of GameState). */
const sess = {
  spawnGuard: true,           // true until the first update() after a spawn has run
  stepArmed: new Map(),       // STEP hotspot id -> armed (hitbox has been outside it)
  factArmed: new Map(),       // fact id -> armed
  stepAccum: 0,
};

function resetPersistent() {
  game.blueprints = 0; game.robotsTalked = 0; game.asked = new Array(ROBOT_COUNT).fill(0);
  game.mode = Mode.EXPLORER; game.flags = 0;
}

function resetSession() {
  game.region = Region.HUB; game.player = newPlayer(); game.events = 0; game.frame = 0; game.time = 0;
  game.headlampOn = false; game.inShadow = false; game.nearHotspot = null; game.pendingFact = -1; game.factsSeen = 0;
  game.latency = { active: false, progress: 0, elapsed: 0 };
  game.props = {};
  liveCache.clear();
}

/* ========================================================================
 * Helpers
 * ====================================================================== */
export function hitbox(p = game.player) {
  return { x: p.x + PLAYER.HIT_X, y: p.y + PLAYER.HIT_Y, w: PLAYER.HIT_W, h: PLAYER.HIT_H };
}

const DIR_VEC = { [Dir.DOWN]: [0, 1], [Dir.UP]: [0, -1], [Dir.LEFT]: [-1, 0], [Dir.RIGHT]: [1, 0] };
const DIR_ANGLE = { [Dir.RIGHT]: 0, [Dir.DOWN]: 90, [Dir.LEFT]: 180, [Dir.UP]: 270 };

/**
 * Hotspots that ride on Sojourner (its own ROBOT hotspot plus any hotspot whose
 * rect overlapped the rover's original rect) follow SOJ_DRIVE.pos. Returns the
 * hotspot itself when unmoved, else a cached shallow clone with a moved rect.
 */
const liveCache = new Map();
function liveHotspot(h, scene) {
  if (scene.region !== Region.MARS) return h;
  const d = game.props[Prop.SOJ_DRIVE];
  if (!d) return h;
  const dx = d.pos.x - d.start.x, dy = d.pos.y - d.start.y;
  if (dx === 0 && dy === 0) return h;
  const rover = findRoverHotspot(scene);
  if (!rover || !(h === rover || overlaps(h.rect, rover.rect))) return h;
  const c = liveCache.get(h.id);
  if (c && c.rect.x === h.rect.x + dx && c.rect.y === h.rect.y + dy) return c;
  const clone = { ...h, rect: { x: h.rect.x + dx, y: h.rect.y + dy, w: h.rect.w, h: h.rect.h } };
  liveCache.set(h.id, clone);
  return clone;
}

function liveHotspots(scene) { return scene.hotspots.map((h) => liveHotspot(h, scene)); }

function blockers(scene) {
  const out = scene.solids.slice();
  for (const h of liveHotspots(scene)) if (h.solid) out.push(h.rect);
  return out;
}

/* ========================================================================
 * Lifecycle
 * ====================================================================== */
export function init() {
  resetPersistent();
  resetSession();
  if (hasSave()) loadSave();
  enterRegion(Region.HUB);
}

export function newGame(mode) {
  resetPersistent();
  resetSession();
  game.mode = mode === Mode.ARCHIVIST ? Mode.ARCHIVIST : Mode.EXPLORER;
  writeSave();
  enterRegion(Region.HUB);
}

export function enterRegion(region) {
  const r = Number.isInteger(region) && region >= 0 && region < REGION_COUNT ? region : Region.HUB;
  const scene = sceneFor(r);
  game.region = r;
  const p = game.player;
  p.x = scene.spawn.x; p.y = scene.spawn.y;
  p.vx = 0; p.vy = 0; p.z = 0; p.vz = 0; p.anim = 0; p.moving = false; p.airborne = false;
  p.facing = DIR_VEC[scene.spawn.facing] ? scene.spawn.facing : Dir.DOWN;
  game.events = 0;
  game.headlampOn = false;
  game.pendingFact = -1;
  game.factsSeen = 0;
  game.latency = { active: false, progress: 0, elapsed: 0 };
  // Arm triggers only for zones the hitbox is NOT already in: nothing fires on spawn.
  const hb = hitbox(p);
  sess.stepArmed.clear();
  sess.factArmed.clear();
  for (const h of liveHotspots(scene)) if (h.trigger === Trigger.STEP) sess.stepArmed.set(h.id, !overlaps(hb, h.rect));
  for (const f of scene.facts) sess.factArmed.set(f.id, !overlaps(hb, f.rect));
  sess.stepAccum = 0;
  sess.spawnGuard = true;
  game.inShadow = computeInShadow(scene);
  game.nearHotspot = computeNear(scene);
}

/* ========================================================================
 * Physics
 * ====================================================================== */
export function getPhysics(region) {
  const base = PHYSICS_DEFAULTS[region] ?? PHYSICS_DEFAULTS[Region.HUB];
  return {
    ...base,
    maxSpeed: base.maxSpeed * TUNING.WALK_FACTOR,
    hopImpulse: base.hopImpulse * TUNING.HOP_FACTOR,
    hop: base.hop && HOP_REGIONS.includes(region),
  };
}

function updateFacing(p, ix, iy, pressed) {
  if (!ix && !iy) return;
  const order = [[Btn.RIGHT, Dir.RIGHT, 1, 0], [Btn.LEFT, Dir.LEFT, -1, 0], [Btn.DOWN, Dir.DOWN, 0, 1], [Btn.UP, Dir.UP, 0, -1]];
  for (const [b, d, dx, dy] of order) {
    if ((pressed & b) && ((dx && dx === ix) || (dy && dy === iy))) { p.facing = d; return; }
  }
  const [cx, cy] = DIR_VEC[p.facing];
  if ((cx && cx === ix) || (cy && cy === iy)) return;
  p.facing = ix ? (ix > 0 ? Dir.RIGHT : Dir.LEFT) : (iy > 0 ? Dir.DOWN : Dir.UP);
}

/** Axis-separated move with clamping against walkable bounds and solids.
 *  Solids the hitbox already overlapped at the start are ignored (escape hatch). */
function moveAndCollide(p, dx, dy, scene) {
  const solids = blockers(scene);
  const start = hitbox(p);
  const ignore = new Set(solids.filter((s) => overlaps(start, s)));
  const wb = scene.walkable;
  let blockedX = false, blockedY = false;
  const steps = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)) / TUNING.MAX_SUBSTEP_PX));
  const sx = dx / steps, sy = dy / steps;
  for (let i = 0; i < steps; i++) {
    for (const axis of ['x', 'y']) {
      const d = axis === 'x' ? sx : sy;
      if (!d || (axis === 'x' ? blockedX : blockedY)) continue;
      p[axis] += d;
      let hb = hitbox(p);
      let hit = false;
      const off = axis === 'x' ? PLAYER.HIT_X : PLAYER.HIT_Y;
      const size = axis === 'x' ? PLAYER.HIT_W : PLAYER.HIT_H;
      const lo = axis === 'x' ? wb.x : wb.y;
      const hi = lo + (axis === 'x' ? wb.w : wb.h);
      if (hb[axis] < lo && d < 0) { p[axis] = lo - off; hit = true; }
      if (hb[axis] + size > hi && d > 0) { p[axis] = hi - size - off; hit = true; }
      hb = hitbox(p);
      for (const s of solids) {
        if (ignore.has(s) || !overlaps(hb, s)) continue;
        const edge = axis === 'x' ? s.x : s.y;
        const ext = axis === 'x' ? s.w : s.h;
        p[axis] = d > 0 ? edge - size - off : edge + ext - off;
        hb = hitbox(p);
        hit = true;
      }
      if (hit) { if (axis === 'x') blockedX = true; else blockedY = true; }
    }
  }
  return { blockedX, blockedY };
}

/* ========================================================================
 * update()
 * ====================================================================== */
export function update(held = 0, pressed = 0) {
  game.events = 0;
  game.frame += 1;
  game.time += DT;
  const scene = sceneFor(game.region);
  const phys = getPhysics(game.region);
  const p = game.player;

  // Headlamp (only where there are shadows to light: the Moon).
  if ((pressed & Btn.HEADLAMP) && phys.shadows) {
    game.headlampOn = !game.headlampOn;
    game.events |= EVT.HEADLAMP;
  }

  // Input -> facing + target velocity.
  const ix = ((held & Btn.RIGHT) ? 1 : 0) - ((held & Btn.LEFT) ? 1 : 0);
  const iy = ((held & Btn.DOWN) ? 1 : 0) - ((held & Btn.UP) ? 1 : 0);
  const hasInput = ix !== 0 || iy !== 0;
  updateFacing(p, ix, iy, pressed);
  const len = Math.hypot(ix, iy) || 1;
  const tx = (ix / len) * phys.maxSpeed, ty = (iy / len) * phys.maxSpeed;
  let rate = hasInput ? phys.accel : phys.friction;
  if (p.airborne) rate *= TUNING.AIR_CONTROL;
  const dvx = tx - p.vx, dvy = ty - p.vy;
  const dv = Math.hypot(dvx, dvy);
  const maxDv = rate * DT;
  if (dv <= maxDv) { p.vx = tx; p.vy = ty; } else { p.vx += (dvx / dv) * maxDv; p.vy += (dvy / dv) * maxDv; }

  // Move + collide (sliding comes from the axis separation).
  const { blockedX, blockedY } = moveAndCollide(p, p.vx * DT, p.vy * DT, scene);
  if (blockedX) { if (ix && Math.sign(p.vx || ix) === ix) game.events |= EVT.BUMP; p.vx = 0; }
  if (blockedY) { if (iy && Math.sign(p.vy || iy) === iy) game.events |= EVT.BUMP; p.vy = 0; }

  // Automatic hops: take off on any grounded frame while moving (i.e. the frame
  // after landing), exact ballistic integration under gPx.
  if (phys.hop) {
    if (!p.airborne && hasInput) { p.airborne = true; p.vz = phys.hopImpulse; }
    if (p.airborne) {
      const g = phys.gravityZ;
      p.z += p.vz * DT - 0.5 * g * DT * DT;
      p.vz -= g * DT;
      if (p.z <= 0) { p.z = 0; p.vz = 0; p.airborne = false; game.events |= EVT.LANDED; }
    }
  } else { p.z = 0; p.vz = 0; p.airborne = false; }

  // Walk cycle + footsteps (non-hop regions; LANDED is the footstep on hop regions).
  const speed = Math.hypot(p.vx, p.vy);
  p.moving = hasInput || speed > TUNING.MOVING_EPS;
  if (p.moving || p.airborne) p.anim += DT; else p.anim = 0;
  if (!phys.hop && p.moving && speed > 0) {
    sess.stepAccum += DT * Math.min(1, speed / phys.maxSpeed);
    if (sess.stepAccum >= STEP_INTERVAL_S) { sess.stepAccum -= STEP_INTERVAL_S; game.events |= EVT.STEP; }
  } else if (!p.moving) sess.stepAccum = STEP_INTERVAL_S * 0.5;

  // Shadows.
  const inShadow = computeInShadow(scene);
  if (inShadow !== game.inShadow) { game.inShadow = inShadow; game.events |= EVT.SHADOW_CHANGED; }

  // STEP hotspots and fact zones: edge-triggered, never on the spawn frame.
  const hb = hitbox(p);
  for (const h of liveHotspots(scene)) {
    if (h.trigger !== Trigger.STEP) continue;
    const inside = overlaps(hb, h.rect);
    if (!inside) { sess.stepArmed.set(h.id, true); continue; }
    if (sess.stepArmed.get(h.id) && !sess.spawnGuard) {
      if (h.kind === HotspotKind.PORTAL) game.events |= EVT.ON_PORTAL;
      else if (h.kind === HotspotKind.RETURN_PAD) game.events |= EVT.ON_RETURN_PAD;
    }
    sess.stepArmed.set(h.id, false);
  }
  for (const f of scene.facts) {
    const inside = overlaps(hb, f.rect);
    if (!inside) { sess.factArmed.set(f.id, true); continue; }
    if (sess.spawnGuard) { sess.factArmed.set(f.id, false); continue; }
    const bit = 1 << f.id;
    if (sess.factArmed.get(f.id) && !(game.factsSeen & bit) && game.pendingFact === -1) {
      game.factsSeen |= bit;
      game.pendingFact = f.id;
      game.events |= EVT.FACT;
      sess.factArmed.set(f.id, false);
    }
  }

  // Interaction prompt target.
  const near = computeNear(scene);
  const prevId = game.nearHotspot ? game.nearHotspot.id : null;
  const nextId = near ? near.id : null;
  if (nextId !== prevId) game.events |= near ? EVT.ENTERED_HOTSPOT : EVT.LEFT_HOTSPOT;
  game.nearHotspot = near;

  // SIGNAL bar and the props of this region keep running while walking.
  if (game.latency.active) latencyTick(DT);
  for (let i = 0; i < PROP_COUNT; i++) {
    if (game.props[i] && propRegion(i) === game.region) propTick(i, DT);
  }

  sess.spawnGuard = false;
  return game.events;
}

/* ========================================================================
 * Hotspots
 * ====================================================================== */
function computeNear(scene) {
  const hb = hitbox();
  const pc = rectCenter(hb);
  let best = null, bestGap = Infinity, bestD = Infinity;
  for (const h of liveHotspots(scene)) {
    if (h.trigger !== Trigger.PRESS) continue;
    if (typeof h.facing === 'number' && h.facing !== game.player.facing) continue;
    const gap = rectGap(hb, h.rect);
    if (gap > INTERACT_RANGE_PX) continue;
    const c = rectCenter(h.rect);
    const d = Math.hypot(c.x - pc.x, c.y - pc.y);
    if (gap < bestGap - 1e-9 || (Math.abs(gap - bestGap) <= 1e-9 && d < bestD)) { best = h; bestGap = gap; bestD = d; }
  }
  return best;
}

export function findInteract() {
  const near = computeNear(sceneFor(game.region));
  return near;
}

/* ========================================================================
 * Headlamp + shadows
 * ====================================================================== */
export function headlampCone() {
  const p = game.player;
  return {
    x: p.x + PLAYER.W / 2, y: p.y + PLAYER.H / 2, dir: p.facing, angleDeg: DIR_ANGLE[p.facing] ?? 90,
    radius: HEADLAMP.RADIUS_PX, coneDeg: HEADLAMP.CONE_DEG, ambient: HEADLAMP.AMBIENT_PX, on: game.headlampOn,
  };
}

function inCone(x, y) {
  const c = headlampCone();
  const dx = x - c.x, dy = y - c.y;
  const d = Math.hypot(dx, dy);
  if (d <= c.ambient) return true;
  if (d > c.radius) return false;
  const a = Math.atan2(dy, dx) * 180 / Math.PI;
  return Math.abs(angleDiff(a, c.angleDeg)) <= c.coneDeg / 2 + 1e-9;
}

/** false only for points inside a shadow rect not lit by the headlamp. */
export function isLit(x, y) {
  const scene = sceneFor(game.region);
  if (!scene.shadows.some((r) => pointIn(x, y, r))) return true;
  return game.headlampOn && inCone(x, y);
}

function computeInShadow(scene) {
  const c = rectCenter(hitbox());
  return scene.shadows.some((r) => pointIn(c.x, c.y, r));
}

/* ========================================================================
 * SIGNAL latency
 * ====================================================================== */
export function latencyStart() {
  game.latency = { active: true, progress: 0, elapsed: 0 };
}

export function latencyTick(dt = DT) {
  const L = game.latency;
  if (!L.active) return L.progress;
  L.elapsed += Math.max(0, dt);
  L.progress = Math.min(1, L.elapsed / LATENCY.GAUGE_REAL_S);
  if (L.progress >= 1 - 1e-9) {
    L.progress = 1;
    L.active = false;
    game.events |= EVT.LATENCY_DONE;
  }
  return L.progress;
}

export const latencyProgress = () => game.latency.progress;
export const latencyActive = () => game.latency.active;

export function acknowledgeFact() { game.pendingFact = -1; }

/* ========================================================================
 * Progress + mode
 * ====================================================================== */
export function collectBlueprint(bp) {
  if (!Number.isInteger(bp) || bp < 0 || bp >= BP_COUNT) return Collect.ALREADY;
  const bit = 1 << bp;
  if (game.blueprints & bit) return Collect.ALREADY;
  game.blueprints |= bit;
  let res = Collect.NEW;
  if ((game.blueprints & BP_ALL_MASK) === BP_ALL_MASK) {
    game.flags |= GF.ENDING_UNLOCKED;
    game.events |= EVT.BLUEPRINT_COMPLETE;
    res = Collect.COMPLETE;
  }
  writeSave();
  return res;
}

export function markRobotTalked(robot) {
  if (!Number.isInteger(robot) || robot < 0 || robot >= ROBOT_COUNT) return;
  game.robotsTalked |= 1 << robot;
  writeSave();
}

export function markAsked(robot, questionId) {
  if (!Number.isInteger(robot) || robot < 0 || robot >= ROBOT_COUNT) return;
  if (!Number.isInteger(questionId) || questionId < 0 || questionId > 30) return;
  game.asked[robot] = (game.asked[robot] | 0) | (1 << questionId);
  writeSave();
}

export function hasAsked(robot, questionId) {
  if (!Number.isInteger(robot) || robot < 0 || robot >= ROBOT_COUNT) return false;
  if (!Number.isInteger(questionId) || questionId < 0 || questionId > 30) return false;
  return ((game.asked[robot] | 0) & (1 << questionId)) !== 0;
}

export function setMode(mode) {
  if (mode !== Mode.EXPLORER && mode !== Mode.ARCHIVIST) return;
  game.mode = mode;
  writeSave();
}

export function toggleMode() { setMode(game.mode === Mode.ARCHIVIST ? Mode.EXPLORER : Mode.ARCHIVIST); }
export function markIntroSeen() { game.flags |= GF.INTRO_SEEN; writeSave(); }
export function markEndingSeen() { game.flags |= GF.ENDING_SEEN; writeSave(); }

export function completion() {
  const count = popcount(game.blueprints & BP_ALL_MASK);
  return { count, total: BP_COUNT, percent: Math.round((count / BP_COUNT) * 100) };
}

/* ========================================================================
 * Props
 * ====================================================================== */
const propCtx = {
  spec: (p) => specFor(p),
  scene: (r) => sceneFor(r),
  state: (p) => game.props[p] ?? null,
};

const validProp = (p) => Number.isInteger(p) && p >= 0 && p < PROP_COUNT;

function ensureProp(prop) {
  if (!validProp(prop)) return null;
  let s = game.props[prop];
  if (!s) { s = createPropState(prop, specFor(prop), propCtx); game.props[prop] = s; }
  return s;
}

export function propOpen(prop) {
  const s = ensureProp(prop);
  if (s) s.open = true;
  return s;
}

export function propAction(prop, action, arg) {
  const s = ensureProp(prop);
  if (!s) return null;
  propActionImpl(s, specFor(prop), action, arg, propCtx);
  if (s.changed) game.events |= EVT.PROP_CHANGED;
  return s;
}

export function propTick(prop, dt = DT) {
  const s = ensureProp(prop);
  if (!s) return null;
  propTickImpl(s, specFor(prop), dt, propCtx);
  if (s.changed) game.events |= EVT.PROP_CHANGED;
  return s;
}

export function propClose(prop) {
  const s = validProp(prop) ? game.props[prop] : null;
  if (s) s.open = false;
}

export function propState(prop) { return validProp(prop) ? (game.props[prop] ?? null) : null; }

/* ========================================================================
 * Save. Only module touching localStorage, always through a guarded
 * globalThis.localStorage. If storage is missing or throws, an in-memory
 * fallback keeps the save working for the session.
 * ====================================================================== */
let memSave = null;

/** Test hook: forget the in-memory fallback save. */
export function _resetMemorySave() { memSave = null; }

function storage() {
  try {
    const s = globalThis.localStorage;
    if (s && typeof s.getItem === 'function' && typeof s.setItem === 'function') return s;
  } catch { /* access itself may throw (SecurityError) */ }
  return null;
}

function readRaw() {
  const s = storage();
  if (s) {
    try { return s.getItem(SAVE_KEY); } catch { /* fall through */ }
  }
  return memSave;
}

const isInt = (v) => Number.isInteger(v) && v >= 0;

function parseSave(raw) {
  if (typeof raw !== 'string' || !raw) return null;
  let o;
  try { o = JSON.parse(raw); } catch { return null; }
  if (!o || typeof o !== 'object' || o.v !== SAVE_VERSION) return null;
  if (!isInt(o.blueprints) || !isInt(o.robotsTalked) || !isInt(o.flags)) return null;
  if (o.mode !== Mode.EXPLORER && o.mode !== Mode.ARCHIVIST) return null;
  if (!Array.isArray(o.asked) || o.asked.length !== ROBOT_COUNT || !o.asked.every(isInt)) return null;
  return {
    blueprints: o.blueprints & BP_ALL_MASK,
    robotsTalked: o.robotsTalked & ((1 << ROBOT_COUNT) - 1),
    asked: o.asked.map((n) => n | 0),
    mode: o.mode,
    flags: o.flags & (GF.ENDING_UNLOCKED | GF.ENDING_SEEN | GF.INTRO_SEEN),
  };
}

export function hasSave() { return parseSave(readRaw()) !== null; }

export function loadSave() {
  const d = parseSave(readRaw());
  if (!d) return false;
  game.blueprints = d.blueprints;
  game.robotsTalked = d.robotsTalked;
  game.asked = d.asked;
  game.mode = d.mode;
  game.flags = d.flags;
  if ((game.blueprints & BP_ALL_MASK) === BP_ALL_MASK) game.flags |= GF.ENDING_UNLOCKED;
  return true;
}

export function writeSave() {
  const raw = JSON.stringify({
    v: SAVE_VERSION, blueprints: game.blueprints, robotsTalked: game.robotsTalked,
    asked: game.asked.slice(0, ROBOT_COUNT).map((n) => n | 0), mode: game.mode, flags: game.flags,
  });
  const s = storage();
  if (s) {
    try { s.setItem(SAVE_KEY, raw); return; } catch { /* quota / disabled: fall back */ }
  }
  memSave = raw;
}

export function eraseSave() {
  const s = storage();
  if (s && typeof s.removeItem === 'function') {
    try { s.removeItem(SAVE_KEY); } catch { /* ignore */ }
  }
  memSave = null;
}
