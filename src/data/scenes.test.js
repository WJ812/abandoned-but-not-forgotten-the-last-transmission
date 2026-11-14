/* Scene geometry tests: rects inside the canvas, spawn clear, every hotspot
 * and fact zone reachable from the spawn by the player's feet hitbox. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  Region, CANVAS_W, CANVAS_H, PLAYER, INTERACT_RANGE_PX, Trigger, HotspotKind,
  FACTS_MIN, FACTS_MAX, LABEL_MAX, TEXT_MAX, Surface, Dir, Prop,
} from '../contract.js';
import { hasAsset } from '../assets.js';
import { getScene, getPropSpec } from './index.js';

const REGIONS = [Region.HUB, Region.MOON, Region.MARS];
const hit = (x, y) => ({ x: x + PLAYER.HIT_X, y: y + PLAYER.HIT_Y, w: PLAYER.HIT_W, h: PLAYER.HIT_H });
const overlap = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
const inside = (a, b) => a.x >= b.x && a.y >= b.y && a.x + a.w <= b.x + b.w && a.y + a.h <= b.y + b.h;
const gap = (a, b) => Math.max(
  Math.max(0, b.x - (a.x + a.w), a.x - (b.x + b.w)),
  Math.max(0, b.y - (a.y + a.h), a.y - (b.y + b.h)),
);
const CANVAS = { x: 0, y: 0, w: CANVAS_W, h: CANVAS_H };
const isRect = (r) => r && ['x', 'y', 'w', 'h'].every((k) => Number.isInteger(r[k])) && r.w > 0 && r.h > 0;

function blockers(s) {
  return [...s.solids, ...s.hotspots.filter((h) => h.solid).map((h) => h.rect)];
}
function free(s, x, y) {
  const hb = hit(x, y);
  return inside(hb, s.walkable) && !blockers(s).some((b) => overlap(hb, b));
}
/** BFS over integer player positions (4-neighbour, 1 px steps). */
function reachable(s) {
  const seen = new Uint8Array(CANVAS_W * CANVAS_H);
  const out = [];
  const q = [[s.spawn.x, s.spawn.y]];
  seen[s.spawn.y * CANVAS_W + s.spawn.x] = 1;
  while (q.length) {
    const [x, y] = q.pop();
    out.push(hit(x, y));
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx; const ny = y + dy;
      if (nx < -PLAYER.HIT_X || ny < -PLAYER.HIT_Y || nx >= CANVAS_W || ny >= CANVAS_H) continue;
      const k = ny * CANVAS_W + nx;
      if (nx < 0 || ny < 0 || seen[k] || !free(s, nx, ny)) continue;
      seen[k] = 1; q.push([nx, ny]);
    }
  }
  return out;
}

for (const region of REGIONS) {
  const s = getScene(region);
  test(`scene ${s.name}: shape and asset`, () => {
    assert.equal(s.region, region);
    assert.equal(s.w, CANVAS_W);
    assert.equal(s.h, CANVAS_H);
    assert.ok(hasAsset(s.background), s.background);
    assert.ok(Object.values(Surface).includes(s.surface));
    assert.ok(Object.values(Dir).includes(s.spawn.facing));
    assert.ok(Object.isFrozen(s) && Object.isFrozen(s.hotspots[0].rect));
    if (region === Region.HUB) assert.equal(s.facts.length, 0);
    else {
      assert.ok(s.facts.length >= FACTS_MIN && s.facts.length <= FACTS_MAX);
      s.facts.forEach((f, i) => {
        assert.equal(f.id, i);
        assert.ok(f.title.length <= LABEL_MAX && f.explorer.length <= TEXT_MAX);
        assert.ok(!f.archivist || f.archivist.length <= TEXT_MAX);
      });
    }
    if (region !== Region.MOON) assert.equal(s.shadows.length, 0);
    else assert.ok(s.shadows.length > 0);
  });

  test(`scene ${s.name}: every rect is inside the canvas`, () => {
    const rects = [s.walkable, ...s.solids, ...s.shadows, ...s.hotspots.map((h) => h.rect), ...s.facts.map((f) => f.rect)];
    for (const r of rects) {
      assert.ok(isRect(r), JSON.stringify(r));
      assert.ok(inside(r, CANVAS), `outside canvas: ${JSON.stringify(r)}`);
    }
  });

  test(`scene ${s.name}: hotspots well-formed`, () => {
    const ids = new Set();
    for (const h of s.hotspots) {
      assert.ok(!ids.has(h.id), `duplicate ${h.id}`); ids.add(h.id);
      assert.ok(Object.values(HotspotKind).includes(h.kind));
      assert.ok(Object.values(Trigger).includes(h.trigger));
      assert.ok(Number.isInteger(h.ref) && typeof h.solid === 'boolean');
      assert.ok(h.label.length > 0 && h.label.length <= LABEL_MAX, h.label);
      const step = h.kind === HotspotKind.PORTAL || h.kind === HotspotKind.RETURN_PAD;
      assert.equal(h.trigger, step ? Trigger.STEP : Trigger.PRESS, h.id);
      if (step) assert.equal(h.solid, false);
      if (h.kind === HotspotKind.DECOR) assert.ok(h.caption && h.caption.length <= TEXT_MAX);
    }
    const kinds = s.hotspots.map((h) => h.kind);
    if (region === Region.HUB) assert.ok(kinds.includes(HotspotKind.PORTAL));
    else {
      for (const k of [HotspotKind.ROBOT, HotspotKind.BLUEPRINT, HotspotKind.RETURN_PAD]) assert.ok(kinds.includes(k), k);
    }
  });

  test(`scene ${s.name}: spawn is free and does not start on a trigger`, () => {
    assert.ok(free(s, s.spawn.x, s.spawn.y), 'spawn hitbox blocked or outside walkable');
    const hb = hit(s.spawn.x, s.spawn.y);
    for (const h of s.hotspots) if (h.trigger === Trigger.STEP) assert.ok(!overlap(hb, h.rect), h.id);
    for (const f of s.facts) assert.ok(!overlap(hb, f.rect), `fact ${f.id}`);
  });

  test(`scene ${s.name}: every hotspot and fact zone is reachable from spawn`, () => {
    const spots = reachable(s);
    const range = INTERACT_RANGE_PX / 2; // stricter than the engine's range
    for (const h of s.hotspots) {
      const ok = h.trigger === Trigger.STEP
        ? spots.some((hb) => overlap(hb, h.rect))
        : spots.some((hb) => gap(hb, h.rect) <= range);
      assert.ok(ok, `unreachable hotspot ${h.id}`);
    }
    for (const f of s.facts) assert.ok(spots.some((hb) => overlap(hb, f.rect)), `unreachable fact ${f.id}`);
  });
}

test('every Prop has exactly one region scene hotspot family', () => {
  const props = [Region.MOON, Region.MARS].flatMap((r) =>
    getScene(r).hotspots.filter((h) => h.kind === HotspotKind.PROP).map((h) => h.ref));
  for (const p of Object.values(Prop)) assert.ok(props.includes(p), `no hotspot for prop ${p}`);
});

test('Mars prop obstacles are scene solids inside the canvas', () => {
  const s = getScene(Region.MARS);
  for (const p of [Prop.SOJ_HAZARD, Prop.SOJ_DRIVE]) {
    for (const r of getPropSpec(p).obstacles) {
      assert.ok(isRect(r) && inside(r, CANVAS));
      assert.ok(s.solids.some((b) => b.x === r.x && b.y === r.y && b.w === r.w && b.h === r.h));
    }
  }
  const lp = getPropSpec(Prop.SOJ_DRIVE).landerPos;
  assert.ok(lp.x >= 0 && lp.x <= CANVAS_W && lp.y >= 0 && lp.y <= CANVAS_H);
});

test('APXS hotspots preselect their rock; lander is an obstacle', () => {
  const s = getScene(Region.MARS);
  const targets = getPropSpec(Prop.SOJ_APXS).targets.map((t) => t.name);
  const arg = (id) => s.hotspots.find((h) => h.id === id).arg;
  assert.equal(targets[arg('mars.apxs.bb')], 'Barnacle Bill');
  assert.equal(targets[arg('mars.apxs.yogi')], 'Yogi');
  for (const p of [Prop.SOJ_HAZARD, Prop.SOJ_DRIVE]) {
    assert.ok(getPropSpec(p).obstacles.some((r) => r.x === 36 && r.y === 66 && r.w === 60 && r.h === 34));
  }
});

test('unknown region throws', () => {
  assert.throws(() => getScene(9), RangeError);
});
