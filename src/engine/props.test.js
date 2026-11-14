import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Prop, PropAction as A, DT, LATENCY, EVT, Region, PROP_COUNT } from '../contract.js';
import { game, enterRegion, update, propOpen, propAction, propTick, propClose, propState, findInteract } from './core.js';
import { overlaps } from './geom.js';
import { PROP_TUNING } from './props.js';
import { setup, SPECS } from './test_fixtures.js';

const tick = (prop, seconds) => { const n = Math.round(seconds / DT); let s; for (let i = 0; i < n; i++) s = propTick(prop, DT); return s; };

test('propOpen/propClose/propState lifecycle', () => {
  setup();
  assert.equal(propState(Prop.LRV_CAMERA), null);
  const s = propOpen(Prop.LRV_CAMERA);
  assert.equal(s.open, true);
  assert.equal(s.prop, Prop.LRV_CAMERA);
  propClose(Prop.LRV_CAMERA);
  assert.equal(propState(Prop.LRV_CAMERA).open, false);
  assert.equal(propState(99), null);
  for (let p = 0; p < PROP_COUNT; p++) {
    const st = propOpen(p);
    assert.ok(st && typeof st.changed === 'boolean' && st.open === true, `prop ${p}`);
  }
});

test('LRV_CAMERA: commands execute only after the 1.3 s Earth delay', () => {
  setup();
  propOpen(Prop.LRV_CAMERA);
  const s = propAction(Prop.LRV_CAMERA, A.CAM_PAN, +1);
  assert.ok(game.events & EVT.PROP_CHANGED);
  assert.equal(s.panDeg, 0);
  assert.equal(s.queue.length, 1);
  tick(Prop.LRV_CAMERA, 1.25);
  assert.equal(s.panDeg, 0, 'still in flight at 1.25 s');
  assert.ok(s.nextFireIn > 0 && s.nextFireIn < 0.06);
  tick(Prop.LRV_CAMERA, 0.1);
  assert.equal(s.panDeg, 15, 'executed by 1.35 s');
  assert.equal(s.queue.length, 0);
  // zoom clamps to the real range
  for (let i = 0; i < 10; i++) propAction(Prop.LRV_CAMERA, A.CAM_ZOOM, +1);
  tick(Prop.LRV_CAMERA, 2);
  assert.equal(s.zoom, 6);
  // tilt clamps
  for (let i = 0; i < 10; i++) propAction(Prop.LRV_CAMERA, A.CAM_TILT, -1);
  tick(Prop.LRV_CAMERA, 2);
  assert.equal(s.tiltDeg, -30);
  // liftoff replay steps through the keyframes
  propAction(Prop.LRV_CAMERA, A.CAM_LIFTOFF);
  assert.equal(s.liftoff.running, true);
  assert.equal(s.tiltDeg, 0);
  tick(Prop.LRV_CAMERA, 1.05);
  assert.equal(s.tiltDeg, 20);
  tick(Prop.LRV_CAMERA, 1.0);
  assert.equal(s.tiltDeg, 40);
  tick(Prop.LRV_CAMERA, PROP_TUNING.CAM_LIFTOFF_HOLD_S + 0.1);
  assert.equal(s.liftoff.running, false);
});

test('LRV_BATTERY reads 0% and never recharges; load test shows one EVA draw', () => {
  setup();
  const s = propOpen(Prop.LRV_BATTERY);
  assert.equal(s.chargePct, 0);
  assert.equal(s.voltageV, 0);
  propAction(Prop.LRV_BATTERY, A.BAT_LOAD_TEST, 1);
  tick(Prop.LRV_BATTERY, 100);
  assert.equal(s.chargePct, 0);
  assert.equal(s.voltageV, 0);
  assert.equal(s.loadTest.running, false);
  assert.equal(s.loadTest.evaIndex, 1);
  assert.equal(s.loadTest.drawnWh, 1500);
  assert.ok(Math.abs(s.loadTest.remainingPct - 100 * (1 - 1500 / 8712)) < 1e-9);
  propAction(Prop.LRV_BATTERY, A.BAT_LOAD_TEST);  // no arg: next EVA
  assert.equal(s.loadTest.evaIndex, 2);
});

test('LRV_NAV: EVA replay follows the path, range/bearing to the LM, odometer and battery', () => {
  setup();
  const s = propOpen(Prop.LRV_NAV);
  assert.equal(s.rangeToLmKm, 0);
  propAction(Prop.LRV_NAV, A.NAV_SELECT, 0);
  propAction(Prop.LRV_NAV, A.NAV_PLAY);
  // first leg goes due north
  tick(Prop.LRV_NAV, 0.5);
  assert.ok(Math.abs(s.headingDeg - 0) < 1e-6, `heading ${s.headingDeg}`);
  assert.ok(Math.abs(s.bearingToLmDeg - 180) < 1e-6, 'LM is behind (south)');
  assert.ok(s.rangeToLmKm > 0);
  let sawStation = false;
  const replayS = 432 * 60 / PROP_TUNING.NAV_COMPRESS;
  for (let i = 0; i < Math.round(replayS / DT) + 10; i++) { propTick(Prop.LRV_NAV, DT); if (s.station === 'ALSEP') sawStation = true; }
  assert.ok(sawStation);
  assert.equal(s.t, 1);
  assert.equal(s.playing, false);
  assert.ok(Math.abs(s.distanceKm - 3.3) < 1e-9);
  assert.ok(Math.abs(s.batteryPct - 100 * (1 - 300 / 8712)) < 1e-9);
  // the farthest point equals the EVA's real max range
  propAction(Prop.LRV_NAV, A.NAV_SELECT, 1);
  s.t = 1 / 3 * 0.999; propTick(Prop.LRV_NAV, DT);
  assert.ok(s.rangeToLmKm <= 7.6 + 1e-9);
  propAction(Prop.LRV_NAV, A.NAV_RESET);
  assert.equal(s.t, 0);
});

test('LRV_FENDER: rooster tail is small with the fender, large without', () => {
  setup();
  const s = propOpen(Prop.LRV_FENDER);
  tick(Prop.LRV_FENDER, 1);
  const withF = s.dustIntensity;
  assert.ok(s.wheelAngleDeg > 0);
  propAction(Prop.LRV_FENDER, A.FENDER_TOGGLE);
  assert.equal(s.fenderOn, false);
  tick(Prop.LRV_FENDER, 1);
  assert.ok(s.dustIntensity > withF * 4);
});

test('SOJ_SOLAR: power follows the sun and falls with dust; night is on battery', () => {
  setup();
  const s = propOpen(Prop.SOJ_SOLAR);
  const at = (sol, t) => { propAction(Prop.SOJ_SOLAR, A.SOLAR_SET_SOL, sol); s.solTime = t; propTick(Prop.SOJ_SOLAR, DT); return { ...s }; };
  const noon = at(1, 0.5), morning = at(1, 0.3), night = at(1, 0.0), lateNoon = at(80, 0.5);
  assert.ok(noon.powerW > 12 && noon.powerW <= 16, `noon ${noon.powerW}`);
  assert.ok(noon.sunElevDeg > 70);
  assert.ok(morning.powerW > 0 && morning.powerW < noon.powerW);
  assert.equal(night.powerW, 0);
  assert.equal(night.onBattery, true);
  assert.equal(noon.onBattery, false);
  assert.ok(lateNoon.dustFactor < 0.8 && lateNoon.powerW < noon.powerW);
  propAction(Prop.SOJ_SOLAR, A.SOLAR_SET_SOL, 500);
  assert.equal(s.sol, 83);
  propAction(Prop.SOJ_SOLAR, A.SOLAR_SET_SOL, 1);
  propAction(Prop.SOJ_SOLAR, A.SOLAR_PLAY);
  tick(Prop.SOJ_SOLAR, PROP_TUNING.SOL_PLAY_S + 0.1);
  assert.equal(s.sol, 2);
});

test('SOJ_APXS: result only after the compressed integration', () => {
  setup();
  const s = propOpen(Prop.SOJ_APXS);
  propAction(Prop.SOJ_APXS, A.APXS_DEPLOY, 1);
  assert.equal(s.deployed, true);
  tick(Prop.SOJ_APXS, PROP_TUNING.APXS_COMPRESSED_S / 2);
  assert.equal(s.result, null);
  assert.ok(Math.abs(s.elapsedH - 5) < 0.1);
  tick(Prop.SOJ_APXS, PROP_TUNING.APXS_COMPRESSED_S / 2 + 0.1);
  assert.equal(s.result.name, 'Yogi');
  assert.equal(s.progress, 1);
  propAction(Prop.SOJ_APXS, A.APXS_DEPLOY, 0);
  tick(Prop.SOJ_APXS, 1);
  propAction(Prop.SOJ_APXS, A.APXS_ABORT);
  assert.equal(s.result, null);
  assert.equal(s.deployed, false);
});

test('SOJ_HAZARD: five stripes against the rock rects, then a detour', () => {
  setup();
  const s = propOpen(Prop.SOJ_HAZARD);
  propAction(Prop.SOJ_HAZARD, A.HAZ_SCAN);
  assert.equal(s.stripes.length, 5);
  assert.equal(s.scanning, true);
  tick(Prop.SOJ_HAZARD, PROP_TUNING.HAZ_SCAN_S + 0.05);
  assert.equal(s.scanning, false);
  // rover at (160, 90) faces the rock at x 190; front is at x 172 -> 18 px gap
  assert.equal(s.stripes[2].hit, true);
  assert.ok(Math.abs(s.stripes[2].distPx - 18) < 1e-6, `center ${s.stripes[2].distPx}`);
  assert.equal(s.hazard, true);
  assert.ok(s.detour === 'left' || s.detour === 'right');
  // no rocks -> clear
  setup({ specs: { ...SPECS, [Prop.SOJ_HAZARD]: { ...SPECS[Prop.SOJ_HAZARD], obstacles: [] }, [Prop.SOJ_DRIVE]: { ...SPECS[Prop.SOJ_DRIVE], obstacles: [] } } });
  const c = propOpen(Prop.SOJ_HAZARD);
  propAction(Prop.SOJ_HAZARD, A.HAZ_SCAN);
  tick(Prop.SOJ_HAZARD, 2);
  assert.equal(c.hazard, false);
  assert.equal(c.detour, null);
  assert.ok(c.stripes.every((x) => !x.hit && x.distPx === c.rangePx));
});

test('SOJ_DRIVE: historical traverse replay along the leg by distance', () => {
  setup();
  const s = propOpen(Prop.SOJ_DRIVE);
  assert.equal(s.legIndex, 0);
  assert.deepEqual(s.pos, { x: 0.5, y: 0.5 });
  assert.equal(s.rangeToLanderM, 0);
  propAction(Prop.SOJ_DRIVE, A.DRIVE_PLAY);
  tick(Prop.SOJ_DRIVE, PROP_TUNING.DRIVE_REPLAY_S / 2);
  assert.ok(Math.abs(s.t - 0.5) < 0.01);
  assert.ok(Math.abs(s.headingDeg - 0) < 1e-9, 'first leg heads north on the map');
  assert.ok(Math.abs(s.distanceM - 1.5) < 0.05);
  assert.equal(s.sol, 'Sols 2-3');
  tick(Prop.SOJ_DRIVE, PROP_TUNING.DRIVE_REPLAY_S);
  assert.equal(s.t, 1); assert.equal(s.playing, false);
  assert.equal(s.stop, 'Barnacle Bill');
  assert.equal(s.distanceM, 3);
  // farthest point of all legs from the lander = maxFromLanderM
  propAction(Prop.SOJ_DRIVE, A.DRIVE_SELECT, 2);
  assert.ok(Math.abs(s.rangeToLanderM - 12) < 1e-9);
  propAction(Prop.SOJ_DRIVE, A.DRIVE_SELECT, 99);
  assert.equal(s.legIndex, 2);
  propAction(Prop.SOJ_DRIVE, A.DRIVE_PLAY); tick(Prop.SOJ_DRIVE, 1);
  propAction(Prop.SOJ_DRIVE, A.DRIVE_PAUSE);
  const t = s.t; tick(Prop.SOJ_DRIVE, 1);
  assert.equal(s.t, t, 'paused');
  propAction(Prop.SOJ_DRIVE, A.DRIVE_RESET);
  assert.equal(s.t, 0);
  // missing legs: falls back, never throws
  setup({ specs: { ...SPECS, [Prop.SOJ_DRIVE]: { ...SPECS[Prop.SOJ_DRIVE], legs: undefined } } });
  const f = propOpen(Prop.SOJ_DRIVE);
  propAction(Prop.SOJ_DRIVE, A.DRIVE_PLAY); tick(Prop.SOJ_DRIVE, 3);
  assert.ok(Number.isFinite(f.pos.x) && Number.isFinite(f.rangeToLanderM));
});

test('LRV combined screen: all 4 LRV props open and tick together without interference', () => {
  const LRV = [Prop.LRV_NAV, Prop.LRV_BATTERY, Prop.LRV_CAMERA, Prop.LRV_FENDER];
  const act = (p) => {
    if (p === Prop.LRV_NAV) { propAction(p, A.NAV_SELECT, 1); propAction(p, A.NAV_PLAY); }
    if (p === Prop.LRV_BATTERY) propAction(p, A.BAT_LOAD_TEST, 2);
    if (p === Prop.LRV_CAMERA) { propAction(p, A.CAM_PAN, 1); propAction(p, A.CAM_LIFTOFF); }
    if (p === Prop.LRV_FENDER) propAction(p, A.FENDER_TOGGLE);
  };
  const solo = {};
  for (const p of LRV) {
    setup(); enterRegion(Region.MOON);
    propOpen(p); act(p);
    for (let i = 0; i < 300; i++) propTick(p, DT);
    solo[p] = JSON.stringify(propState(p));
  }
  setup(); enterRegion(Region.MOON);
  for (const p of LRV) propOpen(p);
  for (const p of LRV) act(p);
  for (let i = 0; i < 300; i++) for (const p of LRV) propTick(p, DT);
  for (const p of LRV) {
    assert.equal(propState(p).open, true);
    assert.equal(JSON.stringify(propState(p)), solo[p], `prop ${p} unaffected by the others`);
  }
  assert.equal(propState(Prop.LRV_CAMERA).panDeg, 15);
  assert.equal(propState(Prop.LRV_BATTERY).chargePct, 0);
});

test('props are deterministic', () => {
  const script = () => {
    setup();
    enterRegion(Region.MARS);
    for (let p = 0; p < PROP_COUNT; p++) propOpen(p);
    propAction(Prop.LRV_NAV, A.NAV_SELECT, 1); propAction(Prop.LRV_NAV, A.NAV_PLAY);
    propAction(Prop.LRV_BATTERY, A.BAT_LOAD_TEST, 0);
    propAction(Prop.LRV_CAMERA, A.CAM_PAN, 1); propAction(Prop.LRV_CAMERA, A.CAM_LIFTOFF);
    propAction(Prop.LRV_FENDER, A.FENDER_TOGGLE);
    propAction(Prop.SOJ_SOLAR, A.SOLAR_PLAY);
    propAction(Prop.SOJ_APXS, A.APXS_DEPLOY, 0);
    propAction(Prop.SOJ_HAZARD, A.HAZ_SCAN);
    propAction(Prop.SOJ_DRIVE, A.DRIVE_SELECT, 1); propAction(Prop.SOJ_DRIVE, A.DRIVE_PLAY);
    for (let i = 0; i < 900; i++) {
      update(i % 7 < 4 ? 1 : 8, 0);
      for (let p = 0; p < 4; p++) propTick(p, DT);
    }
    return JSON.stringify(game.props) + JSON.stringify(game.player);
  };
  assert.equal(script(), script());
});
