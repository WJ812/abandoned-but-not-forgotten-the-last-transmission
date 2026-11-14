/** Contract 10b: persistent fact log + settings. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Region, Btn, EVT, Mode, SAVE_KEY, SETTINGS_KEY, SETTINGS_DEFAULTS } from '../contract.js';
import {
  game, init, newGame, enterRegion, update, acknowledgeFact, factsLog, hasSave, loadSave, eraseSave,
  getSettings, setSetting, _resetMemorySave,
} from './core.js';
import { setup, fakeStorage } from './test_fixtures.js';

/** Walk on the Moon fixture until fact 0 fires (it lies right of the spawn). */
function seeMoonFact0() {
  enterRegion(Region.MOON);
  let fired = 0;
  for (let i = 0; i < 240; i++) {
    if (update(Btn.RIGHT, 0) & EVT.FACT) { fired++; acknowledgeFact(); }
  }
  return fired;
}

test('fact log: appended once per fact, persists across a reload, cleared by newGame', () => {
  setup();
  const ls = fakeStorage();
  globalThis.localStorage = ls;
  try {
    newGame(Mode.EXPLORER);
    assert.deepEqual(factsLog(), []);
    assert.equal(seeMoonFact0(), 1);
    assert.deepEqual(factsLog(), [{ region: Region.MOON, id: 0 }]);
    assert.deepEqual(JSON.parse(ls.getItem(SAVE_KEY)).factsLog, [`${Region.MOON}:0`], 'autosaved');
    // a second visit fires the pop-up again but does not duplicate the log
    assert.equal(seeMoonFact0(), 1);
    assert.equal(factsLog().length, 1);
    enterRegion(Region.MARS);
    for (let i = 0; i < 240; i++) if (update(Btn.RIGHT, 0) & EVT.FACT) acknowledgeFact();
    assert.deepEqual(factsLog(), [{ region: Region.MOON, id: 0 }, { region: Region.MARS, id: 0 }]);
    // reload (fresh memory) restores it from storage
    _resetMemorySave();
    init();
    assert.deepEqual(factsLog(), [{ region: Region.MOON, id: 0 }, { region: Region.MARS, id: 0 }]);
    const copy = factsLog(); copy.push({ region: 9, id: 9 });
    assert.equal(factsLog().length, 2, 'read-only copy');
    newGame(Mode.EXPLORER);
    assert.deepEqual(factsLog(), []);
  } finally { delete globalThis.localStorage; }
});

test('fact log: old saves without the field load with []; bad entries are dropped', () => {
  setup();
  const ls = fakeStorage();
  globalThis.localStorage = ls;
  try {
    ls.setItem(SAVE_KEY, JSON.stringify({ v: 1, blueprints: 1, robotsTalked: 0, asked: [0, 0], mode: 1, flags: 0 }));
    assert.equal(hasSave(), true);
    assert.equal(loadSave(), true);
    assert.equal(game.blueprints, 1);
    assert.deepEqual(factsLog(), []);
    ls.setItem(SAVE_KEY, JSON.stringify({ v: 1, blueprints: 0, robotsTalked: 0, asked: [0, 0], mode: 0, flags: 0,
      factsLog: ['1:2', 'x', 5, '1:2', '2:0', '__proto__'] }));
    assert.equal(loadSave(), true);
    assert.deepEqual(factsLog(), [{ region: 1, id: 2 }, { region: 2, id: 0 }]);
    ls.setItem(SAVE_KEY, JSON.stringify({ v: 1, blueprints: 0, robotsTalked: 0, asked: [0, 0], mode: 0, flags: 0, factsLog: 'nope' }));
    assert.equal(loadSave(), true);
    assert.deepEqual(factsLog(), []);
  } finally { delete globalThis.localStorage; }
});

test('settings: defaults, round-trip, survive eraseSave, never make hasSave true', () => {
  setup();
  const ls = fakeStorage();
  globalThis.localStorage = ls;
  try {
    assert.deepEqual(getSettings(), { ...SETTINGS_DEFAULTS });
    assert.equal(setSetting('muted', true), true);
    assert.equal(setSetting('reduceFlashing', true), true);
    assert.equal(hasSave(), false, 'settings are not a save');
    assert.equal(ls.getItem(SAVE_KEY), null);
    assert.deepEqual(JSON.parse(ls.getItem(SETTINGS_KEY)), { muted: true, reduceFlashing: true });
    _resetMemorySave();                           // reload
    assert.deepEqual(getSettings(), { muted: true, reduceFlashing: true });
    newGame(Mode.ARCHIVIST);
    eraseSave();
    assert.equal(hasSave(), false);
    assert.deepEqual(getSettings(), { muted: true, reduceFlashing: true }, 'eraseSave keeps settings');
    const g = getSettings(); g.muted = false;
    assert.equal(getSettings().muted, true, 'getSettings returns a copy');
  } finally { delete globalThis.localStorage; }
});

test('settings: unknown keys and non-boolean values are rejected', () => {
  setup();
  for (const [k, v] of [['volume', true], ['__proto__', true], ['toString', true], ['muted', 1], ['muted', 'true'], ['muted', null], [7, true]]) {
    assert.equal(setSetting(k, v), false, `${String(k)}=${String(v)}`);
  }
  assert.deepEqual(getSettings(), { ...SETTINGS_DEFAULTS });
  assert.deepEqual(Object.keys(getSettings()).sort(), Object.keys(SETTINGS_DEFAULTS).sort());
  // garbage in storage falls back to defaults per key
  globalThis.localStorage = fakeStorage();
  try {
    globalThis.localStorage.setItem(SETTINGS_KEY, JSON.stringify({ muted: 'yes', reduceFlashing: true, extra: true }));
    assert.deepEqual(getSettings(), { muted: false, reduceFlashing: true });
    globalThis.localStorage.setItem(SETTINGS_KEY, '{bad');
    assert.deepEqual(getSettings(), { ...SETTINGS_DEFAULTS });
  } finally { delete globalThis.localStorage; }
});

test('settings work with no storage, and with storage that throws', () => {
  setup();
  assert.equal(globalThis.localStorage, undefined);
  assert.equal(setSetting('muted', true), true);
  assert.equal(getSettings().muted, true);
  assert.equal(hasSave(), false);
  setup();
  globalThis.localStorage = { getItem() { throw new Error('denied'); }, setItem() { throw new Error('quota'); }, removeItem() {} };
  try {
    assert.doesNotThrow(() => setSetting('reduceFlashing', true));
    assert.equal(getSettings().reduceFlashing, true);
    assert.equal(hasSave(), false);
  } finally { delete globalThis.localStorage; }
});
