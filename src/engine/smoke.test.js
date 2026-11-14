/**
 * Smoke test of the public barrel against the REAL data module. Skipped while
 * src/data/index.js does not exist or fails to load (it is built in parallel).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Region, Btn, Prop, PropAction as A, PROP_COUNT, DT, EVT } from '../contract.js';

let engine = null;
let loadError = null;
try {
  engine = await import('./index.js');
} catch (e) { loadError = e; }

const skip = engine ? false : `data module not loadable yet (${loadError && loadError.code ? loadError.code : loadError})`;

test('barrel exports exactly the contract engine API', { skip }, () => {
  const expected = ['game', 'init', 'newGame', 'enterRegion', 'update', 'getPhysics', 'findInteract',
    'collectBlueprint', 'markRobotTalked', 'markAsked', 'hasAsked', 'setMode', 'toggleMode',
    'markIntroSeen', 'markEndingSeen', 'completion', 'isLit', 'headlampCone',
    'latencyStart', 'latencyTick', 'latencyProgress', 'latencyActive', 'acknowledgeFact',
    'propOpen', 'propAction', 'propTick', 'propClose', 'propState',
    'hasSave', 'loadSave', 'writeSave', 'eraseSave'].sort();
  assert.deepEqual(Object.keys(engine).sort(), expected);
});

test('real scenes: spawn is clear, nothing fires on spawn, walking works', { skip }, () => {
  delete globalThis.localStorage;
  engine.init();
  for (const r of [Region.HUB, Region.MOON, Region.MARS]) {
    engine.enterRegion(r);
    const ev = engine.update(0, 0);
    assert.equal(ev & (EVT.ON_PORTAL | EVT.ON_RETURN_PAD | EVT.FACT), 0, `region ${r} spawn frame`);
    for (const dir of [Btn.LEFT, Btn.RIGHT, Btn.UP, Btn.DOWN]) {
      for (let i = 0; i < 120; i++) engine.update(dir, 0);
      const p = engine.game.player;
      assert.ok(Number.isFinite(p.x) && Number.isFinite(p.y));
      assert.ok(p.x > -24 && p.x < 320 && p.y > -24 && p.y < 180);
    }
  }
});

test('real prop specs: every prop opens and ticks without throwing', { skip }, () => {
  engine.init();
  engine.enterRegion(Region.MARS);
  for (let p = 0; p < PROP_COUNT; p++) {
    const s = engine.propOpen(p);
    assert.ok(s && s.prop === p);
    for (let i = 0; i < 30; i++) engine.propTick(p, DT);
    engine.propClose(p);
  }
  engine.propAction(Prop.LRV_CAMERA, A.CAM_PAN, 1);
  engine.propAction(Prop.SOJ_HAZARD, A.HAZ_SCAN);
  for (let i = 0; i < 180; i++) { engine.propTick(Prop.LRV_CAMERA, DT); engine.propTick(Prop.SOJ_HAZARD, DT); }
  assert.equal(engine.propState(Prop.LRV_CAMERA).queue.length, 0);
  assert.equal(engine.propState(Prop.SOJ_HAZARD).scanning, false);
  assert.equal(engine.propState(Prop.LRV_BATTERY).chargePct, 0);
  const d = engine.propState(Prop.SOJ_DRIVE);
  assert.ok(Number.isFinite(d.pos.x) && Number.isFinite(d.pos.y));
});
