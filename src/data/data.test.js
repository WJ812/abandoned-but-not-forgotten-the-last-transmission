/* Content tests: API surface, text limits, required fields, question counts,
 * AssetIds, PropSpec shapes and key verified numbers. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as C from '../contract.js';
import { hasAsset } from '../assets.js';
import * as data from './index.js';

const {
  Blueprint, Robot, Region, Pack, Prop, Mission, MISSION_COUNT, PROP_COUNT,
  TEXT_MAX, LABEL_MAX, VALUE_MAX, QUESTIONS_MIN, QUESTIONS_MAX,
} = C;

const pages = (arr, min, max, what) => {
  assert.ok(Array.isArray(arr), what);
  assert.ok(arr.length >= min && arr.length <= max, `${what}: ${arr.length} pages`);
  for (const p of arr) {
    assert.equal(typeof p, 'string', what);
    assert.ok(p.length > 0 && p.length <= TEXT_MAX, `${what} (${p.length}): ${p}`);
  }
};
const rows = (arr, what) => {
  assert.ok(arr.length > 0, what);
  for (const r of arr) {
    assert.ok(r.label.length > 0 && r.label.length <= LABEL_MAX, `${what} label: ${r.label}`);
    assert.ok(r.value.length > 0 && r.value.length <= VALUE_MAX, `${what} value: ${r.value}`);
  }
};
/** Every string anywhere in a tree is <= TEXT_MAX and uses printable chars. */
const allStrings = (o, what) => {
  if (typeof o === 'string') {
    assert.ok(o.length <= TEXT_MAX, `${what} (${o.length}): ${o}`);
    assert.ok(!/[\u0000-\u001f]/.test(o), `${what}: control char`);
  } else if (o && typeof o === 'object') {
    for (const [k, v] of Object.entries(o)) allStrings(v, `${what}.${k}`);
  }
};

test('data barrel exports exactly the contract section 5 API', () => {
  assert.deepEqual(Object.keys(data).sort(), [
    'getBlueprint', 'getCatalog', 'getDialogue', 'getEnding', 'getPackInfo',
    'getPropSpec', 'getRegionStats', 'getScene', 'getStarMap', 'getTitleText',
  ]);
});

test('blueprint cards', () => {
  for (const id of Object.values(Blueprint)) {
    const b = data.getBlueprint(id);
    assert.equal(b.id, id);
    for (const k of ['name', 'subsystem', 'dates']) assert.ok(b[k].length > 0 && b[k].length <= LABEL_MAX, k);
    assert.ok(hasAsset(b.schematic), b.schematic);
    pages(b.explorerPages, 1, 3, `bp${id}.explorer`);
    pages(b.archivistPages, 1, 3, `bp${id}.archivist`);
    rows(b.telemetry, `bp${id}.telemetry`);
    rows(b.trueScale, `bp${id}.trueScale`);
    assert.ok(Object.isFrozen(b));
  }
  assert.equal(data.getBlueprint(Blueprint.LRV).name, 'Lunar Roving Vehicle (LRV)');
  assert.equal(data.getBlueprint(Blueprint.LRV).subsystem, 'Mobility & Battery System');
  assert.equal(data.getBlueprint(Blueprint.LRV).dates, 'Apollo 17 - December 1972');
});

test('dialogues: 5-6 questions, pages within limits, last-transmission framing', () => {
  for (const r of Object.values(Robot)) {
    const d = data.getDialogue(r);
    assert.equal(d.robot, r);
    assert.ok(hasAsset(d.portrait), d.portrait);
    assert.equal(d.latency, r === Robot.SOJOURNER);
    pages(d.greeting, 1, 4, 'greeting');
    pages(d.greetingAgain, 1, 4, 'greetingAgain');
    pages(d.goodbye, 1, 2, 'goodbye');
    assert.ok(d.questions.length >= QUESTIONS_MIN && d.questions.length <= QUESTIONS_MAX);
    d.questions.forEach((q, i) => {
      assert.equal(q.id, i);
      assert.ok(q.label.length > 0 && q.label.length <= LABEL_MAX, q.label);
      assert.ok(q.prompt.length > 0 && q.prompt.length <= TEXT_MAX);
      pages(q.answer, 1, 4, `q${i}.answer`);
      pages(q.archivist, 1, 2, `q${i}.archivist`); // every answer has a telemetry page
    });
    assert.match(d.greeting.join(' '), /last transmission/i);
    assert.match(d.goodbye.join(' '), /end of transmission/i);
  }
});

test('dialogues use the spec greeting and question wording verbatim', () => {
  const lrv = data.getDialogue(Robot.LRV);
  const soj = data.getDialogue(Robot.SOJOURNER);
  assert.equal(lrv.greeting[0], 'Telemetry static... Wheel encoders idle since December 14, 1972. Welcome to Taurus-Littrow, Explorer.');
  assert.equal(soj.greeting[0], 'Beep... Earth signal latency: 11 mins... Wait—a human archivist right here in Ares Vallis!');
  const prompts = (d) => d.questions.map((q) => q.prompt);
  assert.ok(prompts(lrv).includes('How far did you carry the astronauts?'));
  assert.ok(prompts(lrv).includes('Why were you left behind on the Moon?'));
  assert.ok(prompts(soj).includes("What was it like being Mars' first rover?"));
  assert.ok(prompts(soj).includes('How did you navigate rocks without live steering?'));
});

test('catalog: 8 missions by id, packs consistent, icons exist', () => {
  const cat = data.getCatalog();
  assert.equal(cat.length, MISSION_COUNT);
  cat.forEach((m, i) => {
    assert.equal(m.id, i);
    assert.equal(m.pack, C.missionPack(i));
    for (const k of ['name', 'body', 'site', 'dates']) assert.ok(m[k].length > 0 && m[k].length <= LABEL_MAX, `${k}: ${m[k]}`);
    assert.ok(hasAsset(m.icon), m.icon);
    pages([m.summary], 1, 1, `mission ${i} summary`);
    pages([m.archivist], 1, 1, `mission ${i} archivist`);
  });
  const all = [];
  for (const p of Object.values(Pack)) {
    const info = data.getPackInfo(p);
    assert.equal(info.pack, p);
    assert.ok(info.name.length <= LABEL_MAX && info.subtitle.length <= LABEL_MAX);
    for (const m of info.missions) assert.equal(C.missionPack(m), p);
    all.push(...info.missions);
  }
  assert.deepEqual(all.sort((a, b) => a - b), Object.values(Mission).sort((a, b) => a - b));
});

test('region stats', () => {
  for (const r of Object.values(Region)) {
    const s = data.getRegionStats(r);
    assert.equal(s.region, r);
    assert.equal(s.gravityG, C.GRAVITY_G[r]);
    assert.equal(s.gravityMps2, C.G_MPS2[r]);
    for (const k of ['name', 'site', 'atmosphere', 'rover']) assert.ok(s[k].length > 0 && s[k].length <= LABEL_MAX, k);
    for (const row of s.rows) {
      assert.ok(row.label.length <= LABEL_MAX && row.value.length <= VALUE_MAX, row.label);
    }
  }
  assert.equal(data.getRegionStats(Region.MOON).site, 'Taurus-Littrow');
  assert.equal(data.getRegionStats(Region.MARS).site, 'Ares Vallis');
});

test('star map: fractions in 0..1, beacons reference real regions/packs', () => {
  const { bodies } = data.getStarMap();
  assert.ok(bodies.length >= 4);
  for (const b of bodies) {
    for (const k of ['x', 'y', 'r']) assert.ok(b[k] >= 0 && b[k] <= 1, `${b.id}.${k}`);
    assert.match(b.color, /^#[0-9a-f]{6}$/i);
    for (const be of b.beacons) {
      assert.ok(be.label.length <= LABEL_MAX);
      assert.equal(typeof be.locked, 'boolean');
      if (be.region !== undefined) assert.ok(Object.values(Region).includes(be.region));
      if (be.pack !== undefined) assert.ok(Object.values(Pack).includes(be.pack));
    }
  }
  const unlocked = bodies.flatMap((b) => b.beacons).filter((b) => !b.locked).map((b) => b.region);
  assert.ok(unlocked.includes(Region.MOON) && unlocked.includes(Region.MARS));
});

test('ending: comparison, 2-frame montage, closing quote verbatim', () => {
  const e = data.getEnding();
  for (const row of e.comparison) {
    assert.ok(row.label.length <= LABEL_MAX && row.moon.length <= VALUE_MAX && row.mars.length <= VALUE_MAX, row.label);
  }
  assert.equal(e.montage.length, 2);
  assert.deepEqual(e.montage.map((m) => m.art), ['montage_lrv', 'montage_sojourner']);
  for (const m of e.montage) { assert.ok(hasAsset(m.art)); pages([m.caption], 1, 1, 'caption'); }
  pages(e.closing, 2, 2, 'closing');
  assert.equal(e.closing[1], 'They remain abandoned on other worlds, but never forgotten.');
});

test('title text', () => {
  const t = data.getTitleText();
  for (const k of ['continueLabel', 'newGameLabel']) assert.ok(t[k].length > 0 && t[k].length <= LABEL_MAX);
  assert.ok(t.tagline.length <= TEXT_MAX);
  assert.equal(t.modeLabels.length, 2);
  assert.equal(t.modeBlurbs.length, 2);
  t.modeLabels.forEach((l) => assert.ok(l.length <= LABEL_MAX));
  pages(t.modeBlurbs, 2, 2, 'modeBlurbs');
});

test('every string in every getter is within TEXT_MAX', () => {
  for (const id of Object.values(Blueprint)) allStrings(data.getBlueprint(id), 'bp');
  for (const id of Object.values(Robot)) allStrings(data.getDialogue(id), 'dlg');
  for (const id of Object.values(Prop)) allStrings(data.getPropSpec(id), 'prop');
  for (const id of Object.values(Region)) { allStrings(data.getScene(id), 'scene'); allStrings(data.getRegionStats(id), 'stats'); }
  allStrings(data.getCatalog(), 'catalog');
  allStrings(data.getEnding(), 'ending');
  allStrings(data.getStarMap(), 'starmap');
  allStrings(data.getTitleText(), 'title');
});

test('prop specs: shapes and verified hardware values', () => {
  for (let p = 0; p < PROP_COUNT; p++) {
    const s = data.getPropSpec(p);
    assert.equal(s.prop, p);
    assert.ok(s.title.length <= LABEL_MAX, s.title);
    for (const k of ['blurb', 'archivist']) assert.ok(s[k].length > 0 && s[k].length <= TEXT_MAX);
    assert.ok(Object.isFrozen(s));
  }
  const nav = data.getPropSpec(Prop.LRV_NAV);
  assert.equal(nav.odometerKm, 35.9);
  assert.equal(nav.maxRangeFromLmKm, 7.6);
  assert.equal(nav.evas.length, 3);
  const inUnit = (pt) => pt.x >= 0 && pt.x <= 1 && pt.y >= 0 && pt.y <= 1;
  assert.ok(inUnit(nav.lm));
  for (const e of nav.evas) {
    assert.ok(e.path.length >= 4 && e.path.every(inUnit));
    assert.ok(e.stations.length > 0);
    let last = 0;
    for (const st of e.stations) { assert.ok(st.at > 0 && st.at < 1 && st.at >= last); last = st.at; }
    assert.ok(e.maxRangeKm <= nav.maxRangeFromLmKm);
    assert.ok(!Number.isNaN(Date.parse(e.dateUtc)));
  }
  assert.deepEqual(nav.evas.map((e) => e.distanceKm), [3.3, 20.3, 12.1]);

  const bat = data.getPropSpec(Prop.LRV_BATTERY);
  assert.equal(bat.count, 2); assert.equal(bat.voltageV, 36); assert.equal(bat.capacityAh, 121);
  assert.equal(bat.chemistry, 'silver-zinc'); assert.equal(bat.rechargeable, false);
  assert.equal(bat.energyWh, 2 * 36 * 121);
  assert.deepEqual([bat.motors.count, bat.motors.hp], [4, 0.25]);
  assert.equal(bat.topSpeedKmh, 18);
  assert.equal(bat.evaDrawWh.length, 3);
  assert.ok(bat.evaDrawWh.reduce((a, b) => a + b, 0) < bat.energyWh);

  const cam = data.getPropSpec(Prop.LRV_CAMERA);
  assert.equal(cam.commandDelayS, 1.3);
  assert.deepEqual([cam.zoomMin, cam.zoomMax], [1, 6]);
  assert.ok(cam.panMinDeg < 0 && cam.panMaxDeg > 0 && cam.tiltMinDeg < 0 && cam.tiltMaxDeg > 0);
  let t = -1;
  for (const k of cam.liftoffSequence) {
    assert.ok(k.atS > t && k.tiltDeg >= cam.tiltMinDeg && k.tiltDeg <= cam.tiltMaxDeg); t = k.atS;
  }

  assert.equal(data.getPropSpec(Prop.LRV_FENDER).wheelDiameterCm, 81.8);

  const sol = data.getPropSpec(Prop.SOJ_SOLAR);
  assert.equal(sol.panelW, 16); assert.equal(sol.cellType, 'GaAs');
  assert.equal(sol.batteryChemistry, 'LiSOCl2'); assert.equal(sol.batteryRechargeable, false);
  assert.equal(sol.solHours, 24.66); assert.equal(sol.missionSols, 83); assert.equal(sol.plannedSols, 7);
  assert.ok(sol.dustLossPerSol > 0 && sol.dustLossPerSol < 0.01);

  const apxs = data.getPropSpec(Prop.SOJ_APXS);
  assert.ok(apxs.targets.length >= 2);
  const names = apxs.targets.map((x) => x.name);
  assert.ok(names.includes('Barnacle Bill') && names.includes('Yogi'));
  for (const x of apxs.targets) {
    const sum = x.composition.reduce((a, c) => a + c.pct, 0);
    assert.ok(sum > 0 && sum <= 100, `${x.name} composition sums to ${sum}`);
    assert.ok(x.sol >= 1 && x.sol <= 83);
  }

  const haz = data.getPropSpec(Prop.SOJ_HAZARD);
  assert.deepEqual([haz.laserStripes, haz.cameras, haz.wheelDiameterCm], [5, 2, 13]);

  const drv = data.getPropSpec(Prop.SOJ_DRIVE);
  assert.equal(drv.maxSpeedCmS, 1);
  assert.ok(drv.totalTraverseM >= 90 && drv.totalTraverseM <= 110);
  assert.equal(drv.maxFromLanderM, 12);
});

test('unknown ids throw RangeError', () => {
  assert.throws(() => data.getBlueprint(5), RangeError);
  assert.throws(() => data.getDialogue(-1), RangeError);
  assert.throws(() => data.getPropSpec(8), RangeError);
  assert.throws(() => data.getPackInfo(3), RangeError);
  assert.throws(() => data.getRegionStats('x'), RangeError);
});
