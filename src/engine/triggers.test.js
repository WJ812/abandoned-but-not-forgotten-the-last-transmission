import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Region, Btn, EVT, Dir, LATENCY, DT, HEADLAMP } from '../contract.js';
import {
  game, enterRegion, update, findInteract, acknowledgeFact, isLit, headlampCone,
  latencyStart, latencyTick, latencyProgress, latencyActive,
} from './core.js';
import { setup } from './test_fixtures.js';

const run = (n, held = 0, pressed = 0) => { let ev = 0; for (let i = 0; i < n; i++) ev |= update(held, i === 0 ? pressed : 0); return ev; };

test('STEP trigger never fires on the spawn frame, even when spawning on the pad', () => {
  setup();
  enterRegion(Region.MOON);                      // spawn overlaps moon.pad
  assert.equal(update(0, 0) & EVT.ON_RETURN_PAD, 0);
  assert.equal(update(Btn.DOWN, 0) & EVT.ON_RETURN_PAD, 0);
  assert.equal(run(30, 0) & EVT.ON_RETURN_PAD, 0);
});

test('STEP trigger fires once on entry, again only after leaving', () => {
  setup();
  enterRegion(Region.HUB);                       // spawn y=120, portal rect y 60..80 above
  let fires = 0;
  for (let i = 0; i < 120 && !fires; i++) if (update(Btn.UP, 0) & EVT.ON_PORTAL) fires++;
  assert.equal(fires, 1, 'fires on entry');
  for (let i = 0; i < 10; i++) if (update(Btn.UP, 0) & EVT.ON_PORTAL) fires++;
  for (let i = 0; i < 60; i++) if (update(0, 0) & EVT.ON_PORTAL) fires++;
  assert.equal(fires, 1, 'moving/standing on it does not refire');
  for (let i = 0; i < 60; i++) if (update(Btn.DOWN, 0) & EVT.ON_PORTAL) fires++;
  assert.ok(game.player.y + 16 >= 80, 'left the pad');
  for (let i = 0; i < 90; i++) if (update(Btn.UP, 0) & EVT.ON_PORTAL) fires++;
  assert.equal(fires, 2, 'refires after leaving and re-entering');
});

test('fact zones: fire once per visit, never on spawn, pending blocks others, reset on re-entry', () => {
  setup();
  enterRegion(Region.MOON);                      // fact 1 overlaps the spawn
  assert.equal(update(0, 0) & EVT.FACT, 0);
  assert.equal(game.pendingFact, -1);
  // walk right into fact 0 (x 100..120)
  let ev = 0;
  for (let i = 0; i < 120 && !(ev & EVT.FACT); i++) ev = update(Btn.RIGHT, 0);
  assert.ok(ev & EVT.FACT);
  assert.equal(game.pendingFact, 0);
  assert.equal(game.factsSeen & 1, 1);
  acknowledgeFact();
  assert.equal(game.pendingFact, -1);
  // walk out and back in: already seen this visit
  const fired = [];
  const step = (held) => { if (update(held, 0) & EVT.FACT) { fired.push(game.pendingFact); acknowledgeFact(); } };
  for (let i = 0; i < 120; i++) step(Btn.RIGHT);
  for (let i = 0; i < 240; i++) step(Btn.LEFT);
  for (let i = 0; i < 240; i++) step(Btn.RIGHT);
  // fact 0 never repeats; the spawn fact (1) fires exactly once, after being left and re-entered
  assert.deepEqual(fired, [1]);
  assert.equal(game.factsSeen, 3);
  // a new visit resets factsSeen
  enterRegion(Region.MOON);
  assert.equal(game.factsSeen, 0);
});

test('a pending fact holds back the next one until acknowledged', () => {
  setup();
  enterRegion(Region.MARS);
  game.pendingFact = 3;                           // pretend a popup is open
  run(120, Btn.RIGHT);                            // walks through fact 0 (x 60..80)
  assert.equal(game.factsSeen & 1, 0);
  acknowledgeFact();
  // still inside? walk back into it
  run(120, Btn.LEFT);
  assert.equal(game.factsSeen & 1, 1);
});

test('nearHotspot / findInteract: PRESS only, range + facing, ENTERED/LEFT events', () => {
  setup();
  enterRegion(Region.HUB);
  const p = game.player;
  // Notebook at 20..40 x 140..160; place hitbox 4 px right of it.
  p.x = 44 - 6; p.y = 140 - 16; p.facing = Dir.LEFT;
  let ev = update(0, 0);
  assert.equal(game.nearHotspot?.id, 'hub.notebook');
  assert.ok(ev & EVT.ENTERED_HOTSPOT);
  assert.equal(findInteract()?.id, 'hub.notebook');
  p.x += 20;
  ev = update(0, 0);
  assert.equal(game.nearHotspot, null);
  assert.ok(ev & EVT.LEFT_HOTSPOT);
  // Computer requires facing UP. Below it at y 60.
  p.x = 270 - 6; p.y = 62 - 16; p.facing = Dir.DOWN;
  update(0, 0);
  assert.equal(findInteract(), null);
  update(Btn.UP, Btn.UP);
  assert.equal(findInteract()?.id, 'hub.computer');
});

test('headlamp cone and isLit geometry', () => {
  setup();
  enterRegion(Region.MOON);
  const p = game.player;
  p.x = 160; p.y = 40; p.facing = Dir.RIGHT;     // center (172, 52), shadow x 200..300 y 20..80
  const c = headlampCone();
  assert.deepEqual([c.x, c.y, c.angleDeg, c.radius, c.coneDeg, c.on], [172, 52, 0, HEADLAMP.RADIUS_PX, HEADLAMP.CONE_DEG, false]);
  assert.equal(isLit(10, 10), true, 'outside shadows always lit');
  assert.equal(isLit(220, 52), false, 'in shadow, lamp off');
  const ev = update(0, Btn.HEADLAMP);
  assert.ok(ev & EVT.HEADLAMP);
  assert.equal(game.headlampOn, true);
  assert.equal(isLit(220, 52), true, 'on the axis, inside radius');
  assert.equal(isLit(172 + 71, 52), true);
  assert.equal(isLit(172 + 73, 52), false, 'beyond radius');
  const half = HEADLAMP.CONE_DEG / 2;
  const at = (deg, r) => [172 + r * Math.cos(deg * Math.PI / 180), 52 + r * Math.sin(deg * Math.PI / 180)];
  assert.equal(isLit(...at(half - 2, 40)), true, 'just inside the cone edge');
  assert.equal(isLit(...at(-(half - 2), 40)), true);
  assert.equal(isLit(...at(half + 3, 40)), false, 'just outside the cone edge');
  p.facing = Dir.LEFT;
  assert.equal(isLit(220, 52), false, 'facing away');
  p.x = 210; p.y = 40;                            // center (222, 52) inside the shadow
  assert.equal(isLit(222 + 5, 52 + 5), true, 'ambient circle');
  assert.equal(headlampCone().angleDeg, 180);
  p.facing = Dir.UP; assert.equal(headlampCone().angleDeg, 270);
  p.facing = Dir.DOWN; assert.equal(headlampCone().angleDeg, 90);
});

test('inShadow + SHADOW_CHANGED; headlamp is off after enterRegion and inert in the Hub', () => {
  setup();
  enterRegion(Region.MOON);
  const p = game.player;
  p.x = 230 - 6; p.y = 50 - 16 - 4;
  const ev = update(0, 0);
  assert.equal(game.inShadow, true);
  assert.ok(ev & EVT.SHADOW_CHANGED);
  update(0, Btn.HEADLAMP);
  enterRegion(Region.MOON);
  assert.equal(game.headlampOn, false);
  enterRegion(Region.HUB);
  assert.equal(update(0, Btn.HEADLAMP) & EVT.HEADLAMP, 0);
  assert.equal(game.headlampOn, false);
});

test('SIGNAL latency reaches 1.0 in exactly LATENCY.GAUGE_REAL_S', () => {
  setup();
  enterRegion(Region.MARS);
  latencyStart();
  assert.equal(latencyActive(), true);
  const frames = Math.round(LATENCY.GAUGE_REAL_S / DT);
  let doneAt = -1;
  for (let i = 1; i <= frames + 5; i++) {
    const ev = update(0, 0);
    if (ev & EVT.LATENCY_DONE) { assert.equal(doneAt, -1, 'fires once'); doneAt = i; }
    if (i === frames - 1) assert.ok(latencyProgress() < 1);
  }
  assert.equal(doneAt, frames);
  assert.equal(latencyProgress(), 1);
  assert.equal(latencyActive(), false);
  // latencyTick() drives it while update() is not running (dialogue screen)
  latencyStart();
  let p = 0;
  for (let i = 0; i < frames; i++) p = latencyTick(DT);
  assert.equal(p, 1);
  assert.ok(game.events & EVT.LATENCY_DONE);
  latencyStart();
  assert.equal(latencyTick(LATENCY.GAUGE_REAL_S / 2), 0.5);
  enterRegion(Region.MARS);
  assert.equal(latencyActive(), false);
  assert.equal(latencyProgress(), 0);
});
