/** Contract 10c: automatic notes journal. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Region, Btn, EVT, Mode, Robot, Blueprint, Prop, PropAction as A, DT, SAVE_KEY } from '../contract.js';
import {
  init, newGame, enterRegion, update, acknowledgeFact, markAsked, collectBlueprint, notes, loadSave, hasSave,
  propOpen, propAction, propTick, _resetMemorySave,
} from './core.js';
import { PROP_TUNING } from './props.js';
import { setup, fakeStorage } from './test_fixtures.js';

const ticks = (p, s) => { for (let i = 0; i < Math.round(s / DT); i++) propTick(p, DT); };
const strip = (list) => list.map(({ kind, region, ref, sub }) => ({ kind, region, ref, sub }));

/** Do everything twice; the journal must hold each discovery exactly once. */
function playAll() {
  for (let pass = 0; pass < 2; pass++) {
    enterRegion(Region.MOON);
    for (let i = 0; i < 240; i++) if (update(Btn.RIGHT, 0) & EVT.FACT) acknowledgeFact();
    markAsked(Robot.LRV, 2);
    collectBlueprint(Blueprint.LRV);
    propOpen(Prop.LRV_NAV); propAction(Prop.LRV_NAV, A.NAV_SELECT, 0); propAction(Prop.LRV_NAV, A.NAV_PLAY);
    ticks(Prop.LRV_NAV, 432 * 60 / PROP_TUNING.NAV_COMPRESS + 0.2);
    propAction(Prop.LRV_BATTERY, A.BAT_LOAD_TEST, 1); ticks(Prop.LRV_BATTERY, PROP_TUNING.BAT_LOAD_TEST_S + 0.1);
    propAction(Prop.LRV_CAMERA, A.CAM_LIFTOFF); ticks(Prop.LRV_CAMERA, 2 + PROP_TUNING.CAM_LIFTOFF_HOLD_S + 0.1);
    enterRegion(Region.MARS);
    markAsked(Robot.SOJOURNER, 0);
    propAction(Prop.SOJ_APXS, A.APXS_DEPLOY, 1); ticks(Prop.SOJ_APXS, PROP_TUNING.APXS_COMPRESSED_S + 0.1);
    propAction(Prop.SOJ_HAZARD, A.HAZ_SCAN); ticks(Prop.SOJ_HAZARD, PROP_TUNING.HAZ_SCAN_S + 0.1);
    propAction(Prop.SOJ_DRIVE, A.DRIVE_SELECT, 2); propAction(Prop.SOJ_DRIVE, A.DRIVE_PLAY);
    ticks(Prop.SOJ_DRIVE, PROP_TUNING.DRIVE_REPLAY_S + 0.1);
    collectBlueprint(Blueprint.SOJOURNER);
  }
}

const EXPECTED = [
  { kind: 'fact', region: Region.MOON, ref: 0, sub: null },
  { kind: 'answer', region: Region.MOON, ref: Robot.LRV, sub: 2 },
  { kind: 'blueprint', region: Region.MOON, ref: Blueprint.LRV, sub: null },
  { kind: 'finding', region: Region.MOON, ref: Prop.LRV_NAV, sub: 0 },
  { kind: 'finding', region: Region.MOON, ref: Prop.LRV_BATTERY, sub: 'loadTest' },
  { kind: 'finding', region: Region.MOON, ref: Prop.LRV_CAMERA, sub: 'liftoff' },
  { kind: 'answer', region: Region.MARS, ref: Robot.SOJOURNER, sub: 0 },
  { kind: 'finding', region: Region.MARS, ref: Prop.SOJ_APXS, sub: 1 },
  { kind: 'finding', region: Region.MARS, ref: Prop.SOJ_HAZARD, sub: 'scan' },
  { kind: 'finding', region: Region.MARS, ref: Prop.SOJ_DRIVE, sub: 2 },
  { kind: 'blueprint', region: Region.MARS, ref: Blueprint.SOJOURNER, sub: null },
];

test('notes: every kind recorded once, in discovery order, no duplicates on repeats', () => {
  setup();
  newGame(Mode.EXPLORER);
  assert.deepEqual(notes(), []);
  playAll();
  const list = notes();
  assert.deepEqual(strip(list), EXPECTED);
  assert.deepEqual(list.map((e) => e.n), EXPECTED.map((_, i) => i + 1));
  // repeated actions/answers/blueprints add nothing
  markAsked(Robot.LRV, 2); collectBlueprint(Blueprint.LRV);
  assert.equal(notes().length, EXPECTED.length);
  // a different sub is a new note
  markAsked(Robot.LRV, 3);
  assert.deepEqual(notes().at(-1), { kind: 'answer', region: Region.MOON, ref: Robot.LRV, sub: 3, n: EXPECTED.length + 1 });
  // copies only
  notes()[0].kind = 'x';
  assert.equal(notes()[0].kind, 'fact');
});

test('notes: aborted / unfinished prop runs are not findings', () => {
  setup();
  newGame(Mode.EXPLORER);
  propAction(Prop.SOJ_APXS, A.APXS_DEPLOY, 0); ticks(Prop.SOJ_APXS, 1); propAction(Prop.SOJ_APXS, A.APXS_ABORT);
  propAction(Prop.LRV_NAV, A.NAV_PLAY); ticks(Prop.LRV_NAV, 1); propAction(Prop.LRV_NAV, A.NAV_RESET);
  propAction(Prop.SOJ_HAZARD, A.HAZ_SCAN); ticks(Prop.SOJ_HAZARD, 0.5);
  assert.deepEqual(notes(), []);
});

test('notes: persist across a reload, autosave, cleared by newGame', () => {
  setup();
  const ls = fakeStorage();
  globalThis.localStorage = ls;
  try {
    newGame(Mode.ARCHIVIST);
    markAsked(Robot.SOJOURNER, 4);
    assert.deepEqual(JSON.parse(ls.getItem(SAVE_KEY)).notes, [{ kind: 'answer', region: Region.MARS, ref: Robot.SOJOURNER, sub: 4, n: 1 }]);
    playAll();
    const before = notes();
    _resetMemorySave();
    init();
    assert.deepEqual(notes(), before);
    newGame(Mode.EXPLORER);
    assert.deepEqual(notes(), []);
  } finally { delete globalThis.localStorage; }
});

test('notes: old saves load with []; bad entries dropped and renumbered', () => {
  setup();
  const ls = fakeStorage();
  globalThis.localStorage = ls;
  try {
    const base = { v: 1, blueprints: 1, robotsTalked: 0, asked: [0, 0], mode: 0, flags: 0 };
    ls.setItem(SAVE_KEY, JSON.stringify(base));
    assert.equal(hasSave(), true);
    assert.equal(loadSave(), true);
    assert.deepEqual(notes(), []);
    ls.setItem(SAVE_KEY, JSON.stringify({ ...base, notes: [
      { kind: 'fact', region: 1, ref: 0, sub: null, n: 7 },
      { kind: 'evil', region: 1, ref: 0, sub: null, n: 2 },
      { kind: 'fact', region: 1, ref: 0, n: 3 },             // duplicate (sub missing = null)
      { kind: 'finding', region: 9, ref: 5, sub: 0, n: 4 },  // bad region
      { kind: 'finding', region: 2, ref: 5, sub: 1, n: 5 },
      'junk', null,
    ] }));
    assert.equal(loadSave(), true);
    assert.deepEqual(notes(), [
      { kind: 'fact', region: 1, ref: 0, sub: null, n: 1 },
      { kind: 'finding', region: 2, ref: 5, sub: 1, n: 2 },
    ]);
    ls.setItem(SAVE_KEY, JSON.stringify({ ...base, notes: 'nope' }));
    assert.equal(loadSave(), true);
    assert.deepEqual(notes(), []);
  } finally { delete globalThis.localStorage; }
});
