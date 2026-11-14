/** Regression tests for QA findings (drive vs lander, rover-attached prompts, save fallback). */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Btn, Prop, PropAction as A, DT, Region, Dir, HotspotKind, Trigger, Robot, Mode, Blueprint, SAVE_KEY, LATENCY } from '../contract.js';
import {
  game, init, newGame, enterRegion, update, propOpen, propAction, propTick, propState, findInteract,
  collectBlueprint, hasSave, loadSave, eraseSave, _resetMemorySave,
  latencyStart, latencyTick, latencyProgress, latencyActive,
} from './core.js';
import { MAX_TICK_DT } from './geom.js';
import { PROP_TUNING } from './props.js';
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

test('Sojourner never moves: rover position and hotspots unchanged across every prop action', () => {
  setup({ scenes, specs });
  enterRegion(Region.MARS);
  const snap = () => JSON.stringify(MARS.hotspots.map((h) => h.rect));
  const before = snap();
  const roverId = 'mars.sojourner';
  const actions = Object.values(A);
  const args = [undefined, 0, 1, 2, -1, 99, { x: 10, y: 10 }, NaN];
  for (let p = 0; p < 8; p++) propOpen(p);
  for (let k = 0; k < 400; k++) {
    const p = k % 8;
    propAction(p, actions[(k * 7) % actions.length], args[k % args.length]);
    for (let i = 0; i < 10; i++) propTick(p, DT);
    update(k % 3 ? Btn.RIGHT : Btn.UP, 0);
  }
  assert.equal(snap(), before, 'scene hotspots never move');
  const s = propState(Prop.SOJ_DRIVE);
  for (const k of ['phase', 'target', 'odometerM', 'tiltDeg', 'signal', 'stopSignal'])
    assert.ok(!(k in s), `no drive-movement field ${k}`);
  // the prompt is always found at the original rover rect
  const rect = MARS.hotspots.find((h) => h.id === roverId).rect;
  const p = game.player;
  p.x = rect.x + rect.w / 2 - 12; p.y = rect.y + rect.h + 2 - 16; p.facing = Dir.UP;
  update(0, 0);
  assert.equal(findInteract()?.id, roverId);
  assert.equal(findInteract().rect, rect);
});

test('hazard scan never rotates the rover (fixed heading)', () => {
  setup({ scenes, specs });
  const s = propOpen(Prop.SOJ_HAZARD);
  propAction(Prop.SOJ_DRIVE, A.DRIVE_SELECT, 1); propAction(Prop.SOJ_DRIVE, A.DRIVE_PLAY);
  for (let i = 0; i < 300; i++) propTick(Prop.SOJ_DRIVE, DT);
  propAction(Prop.SOJ_HAZARD, A.HAZ_SCAN);
  for (let i = 0; i < 120; i++) propTick(Prop.SOJ_HAZARD, DT);
  assert.equal(s.headingDeg, PROP_TUNING.HAZ_HEADING_DEG);
  const c = { x: ROVER.x + ROVER.w / 2, y: ROVER.y + ROVER.h / 2 };
  assert.ok(Math.abs(s.origin.y - c.y) < 1e-9 && s.origin.x > c.x, 'origin at the parked rover front');
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
