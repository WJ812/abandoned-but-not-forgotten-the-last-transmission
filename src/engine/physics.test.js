import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Region, Btn, EVT, DT, gPx, hopHeightPx, hopAirtimeS, walkPx, hopTakeoffPx, CANVAS_W, CANVAS_H, Dir } from '../contract.js';
import { game, enterRegion, update, getPhysics, hitbox } from './core.js';
import { setup } from './test_fixtures.js';

/** Walk until the first complete hop lands; returns peak z and airtime. */
function measureHop(region) {
  setup();
  enterRegion(region);
  let maxZ = 0, airFrames = 0, landed = false, started = false;
  for (let i = 0; i < 600 && !landed; i++) {
    const ev = update(Btn.DOWN, i === 0 ? Btn.DOWN : 0);
    if (game.player.airborne) { started = true; airFrames++; maxZ = Math.max(maxZ, game.player.z); }
    if (started && (ev & EVT.LANDED)) landed = true;
  }
  assert.ok(landed, 'hop must land');
  // airborne frames + the landing frame = elapsed flight time in steps
  return { maxZ, airtime: (airFrames + 1) * DT };
}

test('gravity is exact and walk/takeoff stay within +/-25%', () => {
  for (const r of [Region.HUB, Region.MOON, Region.MARS]) {
    const p = getPhysics(r);
    assert.equal(p.gravityZ, gPx(r));
    assert.ok(Math.abs(p.maxSpeed / walkPx(r) - 1) <= 0.25);
    if (p.hop) assert.ok(Math.abs(p.hopImpulse / hopTakeoffPx() - 1) <= 0.25);
  }
  assert.equal(getPhysics(Region.HUB).hop, false);
});

test('Moon hops are higher and floatier than Mars, ratio ~2.3', () => {
  const moon = measureHop(Region.MOON);
  const mars = measureHop(Region.MARS);
  assert.ok(Math.abs(moon.maxZ - hopHeightPx(Region.MOON)) < 0.1, `moon height ${moon.maxZ}`);
  assert.ok(Math.abs(mars.maxZ - hopHeightPx(Region.MARS)) < 0.1, `mars height ${mars.maxZ}`);
  assert.ok(Math.abs(moon.airtime - hopAirtimeS(Region.MOON)) <= 2 * DT, `moon airtime ${moon.airtime}`);
  assert.ok(Math.abs(mars.airtime - hopAirtimeS(Region.MARS)) <= 2 * DT, `mars airtime ${mars.airtime}`);
  const hr = moon.maxZ / mars.maxZ, tr = moon.airtime / mars.airtime;
  assert.ok(Math.abs(hr - 2.3) < 0.05, `height ratio ${hr}`);
  assert.ok(Math.abs(tr - 2.3) < 0.15, `airtime ratio ${tr}`);
  assert.ok(moon.maxZ > 8 && mars.maxZ > 3);
});

test('hops are automatic while moving and stop when idle; none in the Hub', () => {
  setup();
  enterRegion(Region.MOON);
  let landings = 0;
  for (let i = 0; i < 180; i++) if (update(Btn.DOWN, 0) & EVT.LANDED) landings++;
  assert.ok(landings >= 3, `landings ${landings}`);
  for (let i = 0; i < 120; i++) update(0, 0);
  assert.equal(game.player.airborne, false);
  assert.equal(game.player.z, 0);
  enterRegion(Region.HUB);
  let steps = 0;
  for (let i = 0; i < 60; i++) {
    const ev = update(Btn.LEFT, 0);
    assert.equal(game.player.z, 0);
    assert.equal(ev & EVT.LANDED, 0);
    if (ev & EVT.STEP) steps++;
  }
  assert.ok(steps >= 2, `hub steps ${steps}`);
});

test('wall sliding: blocked on one axis, keeps moving on the other', () => {
  setup();
  enterRegion(Region.HUB);
  const p = game.player;
  // Solid at x 200..220, y 100..140. Hitbox 4 px left of it, overlapping in y.
  p.x = 200 - 6 - 12 - 4; p.y = 92;
  const x0 = p.x, y0 = p.y;
  let bumped = false;
  for (let i = 0; i < 40; i++) if (update(Btn.RIGHT | Btn.DOWN, 0) & EVT.BUMP) bumped = true;
  const hb = hitbox();
  assert.ok(bumped);
  assert.ok(hb.x + hb.w <= 200 + 1e-9, 'never penetrates the wall');
  assert.ok(p.x > x0, 'moved up to the wall');
  assert.ok(p.y > y0 + 10, 'slid down along the wall');
  assert.equal(p.vx, 0);
});

test('walkable bounds clamp the hitbox', () => {
  setup();
  enterRegion(Region.HUB);
  for (let i = 0; i < 600; i++) update(Btn.UP | Btn.LEFT, 0);
  const hb = hitbox();
  assert.ok(Math.abs(hb.x - 10) < 1e-6 && Math.abs(hb.y - 40) < 1e-6, JSON.stringify(hb));
});

test('a player overlapping a solid can walk out of it', () => {
  setup();
  enterRegion(Region.HUB);
  const p = game.player;
  p.x = 205 - 6; p.y = 110 - 16;              // hitbox inside the solid
  for (let i = 0; i < 120; i++) update(Btn.LEFT, 0);
  assert.ok(hitbox().x + 12 <= 200, 'escaped');
});

test('facing follows input; player stays on the canvas', () => {
  setup();
  enterRegion(Region.MARS);
  update(Btn.UP, Btn.UP);
  assert.equal(game.player.facing, Dir.UP);
  update(Btn.UP | Btn.LEFT, Btn.LEFT);
  assert.equal(game.player.facing, Dir.LEFT);
  update(Btn.UP | Btn.LEFT, 0);
  assert.equal(game.player.facing, Dir.LEFT);
  for (let i = 0; i < 2000; i++) update(Btn.UP | Btn.LEFT, 0);
  assert.ok(game.player.x + 6 >= 0 && game.player.y + 16 >= 0 && game.player.x < CANVAS_W && game.player.y < CANVAS_H);
});
