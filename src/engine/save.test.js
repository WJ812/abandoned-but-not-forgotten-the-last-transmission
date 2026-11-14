import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SAVE_KEY, SAVE_VERSION, Mode, GF, Collect, Blueprint, Robot, EVT, Region } from '../contract.js';
import {
  game, init, newGame, collectBlueprint, markRobotTalked, markAsked, hasAsked, setMode, toggleMode,
  markIntroSeen, markEndingSeen, completion, hasSave, loadSave, writeSave, eraseSave, enterRegion,
} from './core.js';
import { setup, fakeStorage } from './test_fixtures.js';

function makeProgress() {
  newGame(Mode.ARCHIVIST);
  collectBlueprint(Blueprint.SOJOURNER);
  markRobotTalked(Robot.LRV);
  markAsked(Robot.LRV, 2);
  markAsked(Robot.SOJOURNER, 5);
  markIntroSeen();
}

function expectProgress() {
  assert.equal(game.blueprints, 1 << Blueprint.SOJOURNER);
  assert.equal(game.robotsTalked, 1 << Robot.LRV);
  assert.deepEqual(game.asked, [1 << 2, 1 << 5]);
  assert.equal(game.mode, Mode.ARCHIVIST);
  assert.equal(game.flags, GF.INTRO_SEEN);
}

test('save round-trip through localStorage', () => {
  setup();
  const ls = fakeStorage();
  globalThis.localStorage = ls;
  try {
    assert.equal(hasSave(), false);
    makeProgress();
    assert.equal(hasSave(), true);
    const raw = JSON.parse(ls.getItem(SAVE_KEY));
    assert.deepEqual(Object.keys(raw).sort(), ['asked', 'blueprints', 'flags', 'mode', 'robotsTalked', 'v']);
    assert.equal(raw.v, SAVE_VERSION);
    init();                                       // fresh session restores the save
    expectProgress();
    assert.equal(game.region, Region.HUB);
    eraseSave();
    assert.equal(hasSave(), false);
    assert.equal(ls.getItem(SAVE_KEY), null);
  } finally { delete globalThis.localStorage; }
});

test('save round-trip without localStorage (in-memory fallback, no throw)', () => {
  setup();
  assert.equal(globalThis.localStorage, undefined);
  assert.equal(hasSave(), false);
  makeProgress();
  assert.equal(hasSave(), true);
  init();
  expectProgress();
  eraseSave();
  assert.equal(hasSave(), false);
});

test('a throwing localStorage (disabled / SecurityError) is survived', () => {
  setup();
  const bad = { getItem() { throw new Error('denied'); }, setItem() { throw new Error('quota'); }, removeItem() { throw new Error('x'); } };
  globalThis.localStorage = bad;
  try {
    assert.doesNotThrow(() => makeProgress());
    assert.equal(hasSave(), true);
    init();
    expectProgress();
    assert.doesNotThrow(() => eraseSave());
    assert.equal(hasSave(), false);
  } finally { delete globalThis.localStorage; }
  // a getter that throws on access
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, get() { throw new Error('SecurityError'); } });
  try {
    assert.doesNotThrow(() => { writeSave(); hasSave(); eraseSave(); });
  } finally { delete globalThis.localStorage; }
});

test('malformed or wrong-version saves are rejected', () => {
  setup();
  const ls = fakeStorage();
  globalThis.localStorage = ls;
  try {
    for (const bad of ['{', 'null', '[]', JSON.stringify({ v: 2, blueprints: 0, robotsTalked: 0, asked: [0, 0], mode: 0, flags: 0 }),
      JSON.stringify({ v: 1, blueprints: 0, robotsTalked: 0, asked: [0], mode: 0, flags: 0 }),
      JSON.stringify({ v: 1, blueprints: 0, robotsTalked: 0, asked: [0, 0], mode: 7, flags: 0 })]) {
      ls.setItem(SAVE_KEY, bad);
      assert.equal(hasSave(), false, bad);
      assert.equal(loadSave(), false, bad);
    }
  } finally { delete globalThis.localStorage; }
});

test('progress, mode, completion and the 2/2 ending unlock', () => {
  setup();
  newGame(Mode.EXPLORER);
  assert.deepEqual(completion(), { count: 0, total: 2, percent: 0 });
  assert.equal(collectBlueprint(Blueprint.LRV), Collect.NEW);
  assert.equal(collectBlueprint(Blueprint.LRV), Collect.ALREADY);
  assert.deepEqual(completion(), { count: 1, total: 2, percent: 50 });
  enterRegion(Region.MARS);
  assert.equal(collectBlueprint(Blueprint.SOJOURNER), Collect.COMPLETE);
  assert.ok(game.events & EVT.BLUEPRINT_COMPLETE);
  assert.ok(game.flags & GF.ENDING_UNLOCKED);
  assert.deepEqual(completion(), { count: 2, total: 2, percent: 100 });
  markEndingSeen();
  assert.ok(game.flags & GF.ENDING_SEEN);
  assert.equal(hasAsked(Robot.LRV, 0), false);
  markAsked(Robot.LRV, 0);
  assert.equal(hasAsked(Robot.LRV, 0), true);
  assert.equal(hasAsked(Robot.SOJOURNER, 0), false);
  toggleMode();
  assert.equal(game.mode, Mode.ARCHIVIST);
  setMode(Mode.EXPLORER);
  assert.equal(game.mode, Mode.EXPLORER);
  setMode(42);
  assert.equal(game.mode, Mode.EXPLORER);
  // newGame clears everything and writes the save
  newGame(Mode.ARCHIVIST);
  assert.equal(game.blueprints, 0);
  assert.equal(game.flags, 0);
  assert.deepEqual(game.asked, [0, 0]);
  init();
  assert.equal(game.mode, Mode.ARCHIVIST);
});
