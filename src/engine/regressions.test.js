/** Regression tests for QA findings (drive vs lander, rover-attached prompts, save fallback). */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Prop, PropAction as A, DT, Region, Dir, HotspotKind, Trigger, Robot, Mode, Blueprint, SAVE_KEY, LATENCY } from '../contract.js';
import {
  game, init, newGame, enterRegion, update, propOpen, propAction, propTick, propState, findInteract,
  collectBlueprint, hasSave, loadSave, eraseSave, _resetMemorySave,
  latencyStart, latencyTick, latencyProgress, latencyActive,
} from './core.js';
import { overlaps, MAX_TICK_DT } from './geom.js';
import { setup, SCENES, SPECS, fakeStorage } from './test_fixtures.js';

/* Mars fixture mirroring the real layout: lander SOLID in scene.solids only. */
const LANDER = { x: 36, y: 66, w: 60, h: 34 };
const ROCK = { x: 206, y: 122, w: 12, h: 10 };
const ROVER = { x: 160, y: 120, w: 24, h: 14 };
const hs = (id, kind, rect, ref, extra = {}) => ({ id, kind, rect, trigger: Trigger.PRESS, ref, solid: false, label: id, ...extra });
const MARS = {
  ...SCENES[Region.MARS],
  spawn: { x: 48, y: 136, facing: Dir.RIGHT },
  walkable: { x: 4, y: 60, w: 312, h: 116 },
  solids: [LANDER, ROCK],
  hotspots: [
    hs('mars.sojourner', HotspotKind.ROBOT, ROVER, Robot.SOJOURNER, { facing: Dir.UP }),
    hs('mars.solar', HotspotKind.PROP, { x: 160, y: 112, w: 24, h: 8 }, Prop.SOJ_SOLAR, { facing: Dir.DOWN }),
    hs('mars.hazard', HotspotKind.PROP, { x: 184, y: 120, w: 6, h: 14 }, Prop.SOJ_HAZARD, { facing: Dir.LEFT }),
    hs('mars.apxs.bb', HotspotKind.PROP, { x: 112, y: 116, w: 16, h: 8 }, Prop.SOJ_APXS, { arg: 0 }),
    hs('mars.apxs.yogi', HotspotKind.PROP, { x: 232, y: 96, w: 28, h: 8 }, Prop.SOJ_APXS, { arg: 1 }),
    hs('mars.drive', HotspotKind.PROP, { x: 96, y: 84, w: 10, h: 14 }, Prop.SOJ_DRIVE),
  ],
  facts: [],
};
const scenes = { ...SCENES, [Region.MARS]: MARS };
const specs = {
  ...SPECS,
  // spec obstacles deliberately omit the lander: scene solids must still block
  [Prop.SOJ_DRIVE]: { ...SPECS[Prop.SOJ_DRIVE], landerPos: { x: 66, y: 83 }, obstacles: [ROCK] },
  [Prop.SOJ_HAZARD]: { ...SPECS[Prop.SOJ_HAZARD], obstacles: [ROCK] },
};
const roverRect = (pos) => ({ x: pos.x - ROVER.w / 2, y: pos.y - ROVER.h / 2, w: ROVER.w, h: ROVER.h });
const inside = (r, b) => r.x >= b.x - 1e-9 && r.y >= b.y - 1e-9 && r.x + r.w <= b.x + b.w + 1e-9 && r.y + r.h <= b.y + b.h + 1e-9;

test('QA1: Sojourner never drives into the lander (scene solid) and stays reachable', () => {
  setup({ scenes, specs });
  enterRegion(Region.MARS);
  const s = propOpen(Prop.SOJ_DRIVE);
  propAction(Prop.SOJ_DRIVE, A.DRIVE_GOTO, { x: 66, y: 83 });       // lander center
  assert.ok(!overlaps(roverRect(s.target), LANDER), `target snapped out of the lander ${JSON.stringify(s.target)}`);
  for (let i = 0; i < 60 * 120 && (s.phase === 'signal' || s.phase === 'moving'); i++) {
    propTick(Prop.SOJ_DRIVE, DT);
    const r = roverRect(s.pos);
    assert.ok(!overlaps(r, LANDER) && !overlaps(r, ROCK), `inside a solid at ${JSON.stringify(s.pos)}`);
    assert.ok(inside(r, MARS.walkable), 'stays in the walkable area');
  }
  assert.equal(s.phase, 'arrived');
  // The player can walk up to the rover and talk to it.
  const p = game.player;
  let found = null;
  for (const [dx, dy, face] of [[0, ROVER.h / 2 + 2, Dir.UP], [0, -(ROVER.h / 2) - 10, Dir.DOWN], [ROVER.w / 2 + 2, 0, Dir.LEFT]]) {
    p.x = s.pos.x + dx - 12; p.y = s.pos.y + dy - 16; p.facing = face;
    update(0, 0);
    const h = findInteract();
    if (h && h.id === 'mars.sojourner') { found = h; break; }
  }
  assert.ok(found, 'rover hotspot reachable after the drive');
});

test('QA1: huge / invalid dt never tunnels the rover through a rock or poisons state', () => {
  setup({ scenes, specs });
  enterRegion(Region.MARS);
  const s = propOpen(Prop.SOJ_DRIVE);
  propAction(Prop.SOJ_DRIVE, A.DRIVE_GOTO, { x: 242, y: 127 });     // straight through ROCK
  for (const bad of [NaN, Infinity, -Infinity, -1, 0, 'x', null]) propTick(Prop.SOJ_DRIVE, bad);
  assert.equal(s.phase, 'signal');
  assert.equal(s.signal, 0, 'invalid dt advances nothing');
  propTick(Prop.SOJ_DRIVE, 1e4);
  assert.ok(Math.abs(s.signal - MAX_TICK_DT / LATENCY.GAUGE_REAL_S) < 1e-9, 'huge dt clamped to MAX_TICK_DT');
  // Every huge tick is clamped and sub-stepped (<= 2 px, each collision-checked).
  let prev = { ...s.pos };
  for (let i = 0; i < 2000 && s.phase !== 'arrived' && s.phase !== 'blocked'; i++) {
    propTick(Prop.SOJ_DRIVE, 1e4);
    assert.ok(!overlaps(roverRect(s.pos), ROCK), `tunnelled into the rock at ${JSON.stringify(s.pos)}`);
    assert.ok(Math.hypot(s.pos.x - prev.x, s.pos.y - prev.y) <= MAX_TICK_DT * s.speedPxS + 1e-6 || s.speedPxS === 0);
    prev = { ...s.pos };
  }
  assert.equal(s.phase, 'arrived');
});

test('QA-low: NaN/Infinity/negative dt cannot lock the SIGNAL bar or break the camera/fender', () => {
  setup({ scenes, specs });
  latencyStart();
  for (const bad of [NaN, Infinity, -Infinity, -5]) latencyTick(bad);
  assert.equal(latencyProgress(), 0);
  assert.equal(latencyActive(), true);
  assert.equal(latencyTick(1e9), MAX_TICK_DT / LATENCY.GAUGE_REAL_S);
  let n = 0;
  while (latencyActive() && n < 1000) { latencyTick(DT); n++; }
  assert.equal(latencyProgress(), 1, 'still completes after bad ticks');

  const cam = propOpen(Prop.LRV_CAMERA);
  for (const bad of [Infinity, NaN, -1]) propTick(Prop.LRV_CAMERA, bad);
  assert.equal(cam.clock, 0);
  propAction(Prop.LRV_CAMERA, A.CAM_PAN, 1);
  propTick(Prop.LRV_CAMERA, Infinity);
  propTick(Prop.LRV_CAMERA, 1e9);                 // clamped: 0.25 s < 1.3 s delay
  assert.equal(cam.panDeg, 0, 'the Earth delay still applies');
  assert.ok(Number.isFinite(cam.clock) && Number.isFinite(cam.nextFireIn));
  const fen = propOpen(Prop.LRV_FENDER);
  for (const bad of [Infinity, NaN, 1e12]) propTick(Prop.LRV_FENDER, bad);
  assert.ok(Number.isFinite(fen.wheelAngleDeg) && fen.wheelAngleDeg >= 0 && fen.wheelAngleDeg < 360);
  assert.ok(Number.isFinite(fen.dustIntensity));
});

test('QA2: solar + hazard prompts ride with the rover; relay and APXS spots stay put', () => {
  setup({ scenes, specs });
  enterRegion(Region.MARS);
  const s = propOpen(Prop.SOJ_DRIVE);
  propAction(Prop.SOJ_DRIVE, A.DRIVE_GOTO, { x: 190, y: 150 });
  for (let i = 0; i < 60 * 30; i++) update(0, 0);
  assert.equal(s.phase, 'arrived');
  const dx = s.pos.x - s.start.x, dy = s.pos.y - s.start.y;
  assert.ok(Math.abs(dx) + Math.abs(dy) > 10);
  const p = game.player;
  const probe = (id, rect, face) => {
    // stand just outside the rect on the side matching `face`, then look it up
    if (face === Dir.DOWN) { p.x = rect.x + rect.w / 2 - 12; p.y = rect.y - 8 - 2 - 16; }
    if (face === Dir.LEFT) { p.x = rect.x + rect.w + 2 - 6; p.y = rect.y + rect.h / 2 - 4 - 16; }
    if (face === Dir.UP) { p.x = rect.x + rect.w / 2 - 12; p.y = rect.y + rect.h + 2 - 16; }
    p.facing = face;
    update(0, 0);
    const h = findInteract();
    return h && h.id === id ? h : null;
  };
  const moved = (r) => ({ x: r.x + dx, y: r.y + dy, w: r.w, h: r.h });
  const solar = probe('mars.solar', moved(MARS.hotspots[1].rect), Dir.DOWN);
  assert.ok(solar, 'solar prompt found at the moved rover');
  assert.deepEqual(solar.rect, moved(MARS.hotspots[1].rect));
  const haz = probe('mars.hazard', moved(MARS.hotspots[2].rect), Dir.LEFT);
  assert.ok(haz, 'hazard prompt found at the moved rover');
  assert.deepEqual(haz.rect, moved(MARS.hotspots[2].rect));
  // relay and APXS rock spots unchanged, and APXS keeps its arg
  const relay = probe('mars.drive', MARS.hotspots[5].rect, Dir.UP);
  assert.ok(relay && relay.rect === MARS.hotspots[5].rect);
  const yogi = probe('mars.apxs.yogi', MARS.hotspots[4].rect, Dir.UP);
  assert.ok(yogi, 'yogi APXS spot found at its fixed rect');
  assert.equal(yogi.arg, 1);
  assert.equal(yogi.rect, MARS.hotspots[4].rect);
});

test('QA3a: setItem throws but getItem returns null -> hasSave true this session', () => {
  setup({ scenes, specs });
  globalThis.localStorage = { getItem: () => null, setItem() { throw new Error('QuotaExceededError'); }, removeItem() {} };
  try {
    assert.equal(hasSave(), false);
    newGame(Mode.ARCHIVIST);
    assert.equal(hasSave(), true, 'Continue visible after newGame');
    collectBlueprint(Blueprint.LRV);
    init();
    assert.equal(game.blueprints, 1);
    assert.equal(game.mode, Mode.ARCHIVIST);
  } finally { delete globalThis.localStorage; }
});

test('QA3b: quota hit after an earlier save does not roll progress back', () => {
  setup({ scenes, specs });
  const ls = fakeStorage();
  globalThis.localStorage = ls;
  try {
    newGame(Mode.EXPLORER);                       // stored OK
    const stale = ls.getItem(SAVE_KEY);
    ls.setItem = () => { throw new Error('QuotaExceededError'); };
    collectBlueprint(Blueprint.LRV);
    collectBlueprint(Blueprint.SOJOURNER);
    assert.equal(ls.getItem(SAVE_KEY), stale, 'storage still holds the stale save');
    assert.equal(loadSave(), true);
    assert.equal(game.blueprints, 3);
    init();
    assert.equal(game.blueprints, 3, 'Continue keeps the newest progress');
    // a real reload (no memory) falls back to what storage has
    _resetMemorySave();
    init();
    assert.equal(game.blueprints, 0);
  } finally { delete globalThis.localStorage; }
});

test('QA3c: erase wins even when removeItem throws', () => {
  setup({ scenes, specs });
  const ls = fakeStorage();
  globalThis.localStorage = ls;
  try {
    newGame(Mode.ARCHIVIST);
    ls.removeItem = () => { throw new Error('denied'); };
    eraseSave();
    assert.equal(hasSave(), false);
    assert.equal(loadSave(), false);
  } finally { delete globalThis.localStorage; }
});
