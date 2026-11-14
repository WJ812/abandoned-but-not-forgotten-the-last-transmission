/**
 * ?mock=1 dev mock of the engine and data barrels (contract sections 5, 8, 9).
 * Lets every screen be exercised before the real modules exist. Frontend-owned,
 * deliberately simple, NOT the real physics or content.
 */
import {
  Region, Station, Blueprint, Robot, Mission, Pack, Mode, Surface, Prop, PropAction, HotspotKind, Trigger, Dir, EVT, GF, Collect,
  BP_ALL_MASK, BP_COUNT, CANVAS_W, CANVAS_H, PLAYER, INTERACT_RANGE_PX, HEADLAMP, PHYSICS_DEFAULTS, LATENCY, DT, SAVE_KEY, SAVE_VERSION, PROP_COUNT, Btn,
} from '../contract.js';

const R = (x, y, w, h) => ({ x, y, w, h });
const hs = (id, kind, rect, ref, label, extra = {}) => ({ id, kind, rect, trigger: kind === 'returnPad' ? Trigger.STEP : Trigger.PRESS, ref, solid: false, label, ...extra });
const W = (x, y, w, h) => R(x, y, w, h);

const SCENES = {
  [Region.HUB]: { region: 0, name: 'NASA Archives', w: CANVAS_W, h: CANVAS_H, background: 'scene_hub', surface: Surface.WOOD, spawn: { x: 168, y: 100, facing: Dir.DOWN }, solids: [], shadows: [], facts: [], walkable: W(8, 62, 344, 114),
    hotspots: [
      hs('hub.portal', 'portal', R(160, 34, 40, 24), 0, 'Portal: Moon / Mars', { solid: true }),
      hs('hub.computer', 'station', R(300, 30, 36, 30), Station.ARCHIVE_COMPUTER, 'Archive Computer', { solid: true }),
    ] },
  [Region.MOON]: { region: 1, name: 'Taurus-Littrow', w: CANVAS_W, h: CANVAS_H, background: 'scene_moon', surface: Surface.REGOLITH, spawn: { x: 150, y: 120, facing: Dir.UP }, solids: [R(260, 120, 20, 12)], shadows: [R(200, 66, 100, 50), R(30, 124, 70, 40)], walkable: W(6, 56, 348, 120),
    facts: [0, 1, 2].map((i) => ({ id: i, rect: R(60 + i * 90, 100 + (i % 2) * 20, 24, 20), title: `Moon fact ${i + 1}`, explorer: 'The Moon has 1/6 of Earth gravity, so hops carry you high and slow.', archivist: 'g = 1.62 m/s2.' })),
    hotspots: [
      hs('moon.lrv', 'robot', R(110, 56, 74, 30), Robot.LRV, 'Lunar Rover', { solid: true }),
      hs('moon.nav', 'prop', R(112, 90, 14, 10), Prop.LRV_NAV, 'Nav console'), hs('moon.bat', 'prop', R(130, 90, 14, 10), Prop.LRV_BATTERY, 'Battery panel'),
      hs('moon.cam', 'prop', R(148, 90, 14, 10), Prop.LRV_CAMERA, 'TV camera'), hs('moon.fender', 'prop', R(166, 90, 14, 10), Prop.LRV_FENDER, 'Fender'),
      hs('moon.bp', 'blueprint', R(228, 82, 12, 12), Blueprint.LRV, 'LRV blueprint'), hs('moon.pad', 'returnPad', R(20, 90, 24, 12), 0, 'Return pad'),
    ] },
  [Region.MARS]: { region: 2, name: 'Ares Vallis', w: CANVAS_W, h: CANVAS_H, background: 'scene_mars', surface: Surface.SAND, spawn: { x: 40, y: 120, facing: Dir.RIGHT }, solids: [R(200, 100, 20, 14), R(90, 100, 16, 10)], shadows: [], walkable: W(6, 56, 348, 120),
    facts: [0, 1, 2].map((i) => ({ id: i, rect: R(70 + i * 80, 130, 24, 20), title: `Mars fact ${i + 1}`, explorer: 'Mars has 0.38 g and a thin carbon dioxide atmosphere.', archivist: 'g = 3.72 m/s2.' })),
    hotspots: [
      hs('mars.sojourner', 'robot', R(140, 90, 24, 14), Robot.SOJOURNER, 'Sojourner'),
      hs('mars.solar', 'prop', R(120, 112, 14, 10), Prop.SOJ_SOLAR, 'Solar panel'), hs('mars.apxs', 'prop', R(88, 112, 14, 10), Prop.SOJ_APXS, 'Rock: Barnacle Bill'),
      hs('mars.haz', 'prop', R(160, 112, 14, 10), Prop.SOJ_HAZARD, 'Hazard sensors'), hs('mars.drive', 'prop', R(178, 112, 14, 10), Prop.SOJ_DRIVE, 'Drive console'),
      hs('mars.bp', 'blueprint', R(262, 124, 12, 12), Blueprint.SOJOURNER, 'Sojourner blueprint'), hs('mars.pad', 'returnPad', R(20, 90, 24, 12), 0, 'Return pad'),
    ] },
};

const BP = [
  { id: 0, name: 'Lunar Roving Vehicle (LRV)', subsystem: 'Mobility & Battery System', dates: 'Apollo 17 - December 1972', schematic: 'schematic_lrv', explorerPages: ['The LRV carried two astronauts across Taurus-Littrow, extending their reach to 7.6 km from the lander.', 'Its non-rechargeable batteries are spent now.'], archivistPages: ['Dual 36 V silver-zinc batteries, four 0.25 hp wheel motors.'], telemetry: [{ label: 'Dry mass', value: '210 kg' }, { label: 'Payload', value: '490 kg' }, { label: 'Top speed', value: '18 km/h' }], trueScale: [{ label: 'Length', value: '3.1 m' }] },
  { id: 1, name: 'Sojourner Rover', subsystem: 'Rocker-Bogie Mobility System', dates: 'Mars Pathfinder - July 1997', schematic: 'schematic_sojourner', explorerPages: ['Sojourner was the first wheeled rover on Mars and worked 83 sols instead of the planned 7.'], archivistPages: ['16 W GaAs solar panel with LiSOCl2 backup cells.'], telemetry: [{ label: 'Mass', value: '10.5 kg' }, { label: 'Wheels', value: '6' }], trueScale: [{ label: 'Size', value: '0.65 x 0.48 x 0.30 m' }] },
];
const qs = (n, p) => Array.from({ length: n }, (_, i) => ({ id: i, label: `${p} question ${i + 1}?`, answer: [`This is the answer to question ${i + 1}. It is a mock page of text, shown by the typewriter.`, 'A second page, so advancing is exercised.'], archivist: [`Archivist data ${i + 1}: verified numbers go here.`] }));
const DIAL = [
  { robot: 0, name: 'LRV-3', location: 'Taurus-Littrow, Moon', portrait: 'portrait_lrv', latency: false, greeting: ['Telemetry static... Wheel encoders idle since December 14, 1972. Welcome to Taurus-Littrow, Explorer.'], greetingAgain: ['Back again. I am still here.'], questions: qs(5, 'LRV'), goodbye: ['Signal fading. Remember us.'] },
  { robot: 1, name: 'Sojourner', location: 'Ares Vallis, Mars', portrait: 'portrait_sojourner', latency: true, greeting: ['Beep... Earth signal latency: 11 mins... Wait, a human archivist right here in Ares Vallis!'], greetingAgain: ['Beep. Welcome back, Archivist.'], questions: qs(6, 'Soj'), goodbye: ['End of transmission.'] },
];
const CAT = Array.from({ length: 8 }, (_, i) => ({ id: i, pack: i < 3 ? 0 : i < 6 ? 1 : 2, name: ['Surveyor 3', 'Apollo LM Descent', 'ALSEP', 'Pathfinder Airbags', 'InSight SEIS', 'Ingenuity', 'NEAR Shoemaker', 'Voyager 1'][i], body: i < 3 ? 'Moon' : i < 6 ? 'Mars' : 'Deep space', site: 'Mock site', dates: '19xx', icon: 'icon_surveyor3', summary: 'Catalog-only mission, coming in a future expansion pack.', archivist: 'Archivist: more verified detail later.' }));
const PACKS = [{ pack: 0, name: 'Lunar Legacy', subtitle: 'Moon', missions: [0, 1, 2] }, { pack: 1, name: 'Martian Frontiers', subtitle: 'Mars', missions: [3, 4, 5] }, { pack: 2, name: 'Deep Space', subtitle: 'Beyond', missions: [6, 7] }];
const STATS = [null,
  { region: 1, name: 'The Moon', site: 'Taurus-Littrow', gravityG: 0.166, gravityMps2: 1.62, atmosphere: 'none (airless regolith)', rover: 'LRV - battery-powered, crewed', rows: [{ label: 'Day', value: '~29.5 Earth days' }] },
  { region: 2, name: 'Mars', site: 'Ares Vallis', gravityG: 0.38, gravityMps2: 3.72, atmosphere: 'thin CO2', rover: 'Sojourner - solar-powered, autonomous', rows: [{ label: 'Day', value: '24 h 39 min' }] }];

const path = (...p) => p.map(([x, y]) => ({ x, y }));
const PROPSPEC = {
  [Prop.LRV_NAV]: { title: 'Nav Console', blurb: 'Replay the three real EVA drives.', archivist: 'Navigation used a directional gyro and odometer.', odometerKm: 35.9, maxRangeFromLmKm: 7.6, navSystem: 'gyro + odometer', lm: { x: 0.5, y: 0.5 }, evas: [
    { id: 0, label: 'EVA 1', dateUtc: '1972-12-11', distanceKm: 3.5, durationMin: 262, maxRangeKm: 2.0, path: path([0.5, 0.5], [0.6, 0.4], [0.75, 0.45], [0.7, 0.65], [0.5, 0.5]), stations: [{ name: 'Station 1', at: 0.4 }] },
    { id: 1, label: 'EVA 2', dateUtc: '1972-12-12', distanceKm: 20.1, durationMin: 441, maxRangeKm: 7.6, path: path([0.5, 0.5], [0.3, 0.3], [0.15, 0.5], [0.3, 0.75], [0.5, 0.5]), stations: [{ name: 'Station 4', at: 0.5 }] },
    { id: 2, label: 'EVA 3', dateUtc: '1972-12-13', distanceKm: 12.2, durationMin: 439, maxRangeKm: 4.0, path: path([0.5, 0.5], [0.55, 0.2], [0.85, 0.3], [0.9, 0.7], [0.5, 0.5]), stations: [{ name: 'Station 8', at: 0.6 }] }] },
  [Prop.LRV_BATTERY]: { title: 'Battery Panel', blurb: 'Silver-zinc cells, now at 0%.', archivist: 'Not rechargeable.', count: 2, voltageV: 36, capacityAh: 121, chemistry: 'silver-zinc', rechargeable: false, energyWh: 8712, motors: { count: 4, hp: 0.25, watts: 186 }, topSpeedKmh: 18, evaDrawWh: [1500, 5200, 3400], chargeHistory: [{ label: 'Landing', dateUtc: '1972-12-11', pct: 100, estimated: false }, { label: 'EVA 1', dateUtc: '1972-12-11', pct: 82, estimated: false }, { label: 'EVA 2', dateUtc: '1972-12-12', pct: 40, estimated: false }, { label: 'EVA 3', dateUtc: '1972-12-13', pct: 8, estimated: false }, { label: 'Left behind', dateUtc: '1972-12-14', pct: 5, estimated: true }, { label: 'Today', dateUtc: '2026-11-14', pct: 0, estimated: true }], whyDead: 'Silver-zinc cells cannot be recharged.' },
  [Prop.LRV_CAMERA]: { title: 'TV Camera (GCTA)', blurb: 'Commands reach the Moon after a delay.', archivist: 'Earth-Moon light time ~1.3 s.', panMinDeg: -180, panMaxDeg: 180, tiltMinDeg: -15, tiltMaxDeg: 85, zoomMin: 1, zoomMax: 6, panStepDeg: 15, tiltStepDeg: 10, commandDelayS: 1.3, liftoffUtc: '1972-12-14 22:54 UTC', liftoffSequence: [{ atS: 0, tiltDeg: 0 }, { atS: 3, tiltDeg: 40 }, { atS: 6, tiltDeg: 70 }], operator: 'Ed Fendell' },
  [Prop.LRV_FENDER]: { title: 'Fender Repair', blurb: 'Taped maps saved the day.', archivist: 'Duct tape and maps.', brokenDate: 'Dec 11, 1972', fixDate: 'Dec 12, 1972', fixMaterials: 'maps, duct tape, clamps', wheelDiameterCm: 81.8, wheelMaterial: 'zinc-coated woven steel mesh', dustWithoutFender: 'a dust rooster tail covers the crew', dustWithFender: 'dust stays mostly down' },
  [Prop.SOJ_SOLAR]: { title: 'Solar Panel', blurb: 'A 16 W panel, dimmed by dust.', archivist: 'GaAs cells.', panelW: 16, panelAreaM2: 0.2, cellType: 'GaAs', batteryChemistry: 'LiSOCl2', batteryRechargeable: false, solHours: 24.66, dustLossPerSol: 0.0027, missionSols: 83, plannedSols: 7, nightPowerSource: 'non-rechargeable batteries' },
  [Prop.SOJ_APXS]: { title: 'APXS Spectrometer', blurb: 'Reads rock chemistry.', archivist: 'Integration takes ~10 hours.', integrationHours: 10, targets: [
    { id: 0, name: 'Barnacle Bill', sol: 4, rockType: 'andesite-like', composition: [{ element: 'O', pct: 45 }, { element: 'Si', pct: 25 }, { element: 'Al', pct: 8 }, { element: 'Fe', pct: 7 }], finding: 'Silica-rich, like volcanic rock.' },
    { id: 1, name: 'Yogi', sol: 10, rockType: 'basaltic', composition: [{ element: 'O', pct: 44 }, { element: 'Si', pct: 20 }, { element: 'Fe', pct: 12 }, { element: 'Mg', pct: 8 }], finding: 'More basalt-like.' }] },
  [Prop.SOJ_HAZARD]: { title: 'Hazard Sensors', blurb: 'Five laser stripes and two cameras.', archivist: 'Onboard hazard avoidance.', laserStripes: 5, cameras: 2, wheelDiameterCm: 13, hazardHeightCm: 20, scanRangeCm: 50, decision: 'The computer compares stripe heights and picks the clear side.', obstacles: [R(170, 92, 16, 14), R(200, 100, 20, 14)] },
  [Prop.SOJ_DRIVE]: { title: 'Drive Console', blurb: 'Pick a waypoint. Commands cross ~11 minutes of space.', archivist: 'Max speed about 1 cm/s.', maxSpeedCmS: 1, totalTraverseM: 100, maxFromLanderM: 12, landerPos: { x: 90, y: 84 }, commandNote: 'Waypoints are sent in advance.', obstacles: [R(170, 92, 16, 14), R(200, 100, 20, 14)] },
};

export const data = {
  getScene: (r) => SCENES[r], getBlueprint: (i) => BP[i], getDialogue: (r) => DIAL[r], getCatalog: () => CAT, getPackInfo: (p) => PACKS[p], getRegionStats: (r) => STATS[r],
  getStarMap: () => ({ bodies: [
    { id: 'earth', name: 'Earth', x: 0.2, y: 0.55, r: 0.04, color: '#3a78c8', beacons: [] },
    { id: 'moon', name: 'Moon', x: 0.4, y: 0.35, r: 0.025, color: '#aab0ba', beacons: [{ label: 'LRV', region: 1, locked: false }, { label: 'Lunar Legacy', pack: 0, locked: true }] },
    { id: 'mars', name: 'Mars', x: 0.65, y: 0.6, r: 0.03, color: '#c1440e', beacons: [{ label: 'Sojourner', region: 2, locked: false }, { label: 'Martian Frontiers', pack: 1, locked: true }] },
    { id: 'voyager', name: 'Deep space', x: 0.88, y: 0.3, r: 0.015, color: '#8794a8', beacons: [{ label: 'Voyager 1', pack: 2, locked: true }] }] }),
  getEnding: () => ({ comparison: [{ label: 'Gravity', moon: '0.166 g', mars: '0.38 g' }, { label: 'Air', moon: 'none', mars: 'thin CO2' }, { label: 'Rover power', moon: 'battery (crewed)', mars: 'solar (autonomous)' }],
    montage: [{ art: 'montage_lrv', caption: 'The LRV, parked in Taurus-Littrow.' }, { art: 'montage_sojourner', caption: 'Sojourner, beside Pathfinder.' }],
    closing: ['Though their batteries fade, their solar panels cover with dust, and their wheels fall silent across the planetary voids... these robotic pioneers carry human curiosity into the dark.', 'They remain abandoned on other worlds, but never forgotten.'] }),
  getPropSpec: (p) => ({ prop: p, ...PROPSPEC[p] }),
  getTitleText: () => ({ tagline: 'Abandoned, but not forgotten.', continueLabel: 'CONTINUE', newGameLabel: 'NEW GAME', modeLabels: ['EXPLORER 9-12', 'ARCHIVIST 13-18'], modeBlurbs: ['Story-first dialogue and intuitive visuals.', 'Adds verified telemetry and formulas.'] }),
};

/* ---------------- mock engine ---------------- */
const mem = {};
const store = () => globalThis.localStorage ?? { getItem: (k) => mem[k] ?? null, setItem: (k, v) => { mem[k] = v; }, removeItem: (k) => { delete mem[k]; } };
export const game = {
  blueprints: 0, robotsTalked: 0, asked: [0, 0], mode: Mode.EXPLORER, flags: 0, region: Region.HUB,
  player: { x: 148, y: 100, vx: 0, vy: 0, z: 0, vz: 0, facing: Dir.DOWN, anim: 0, moving: false, airborne: false },
  events: 0, frame: 0, time: 0, headlampOn: false, inShadow: false, nearHotspot: null, pendingFact: -1, factsSeen: 0,
  latency: { active: false, progress: 0, elapsed: 0 }, props: {},
};
const ov = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
const hit = (p) => ({ x: p.x + PLAYER.HIT_X, y: p.y + PLAYER.HIT_Y, w: PLAYER.HIT_W, h: PLAYER.HIT_H });
let wasOnPortal = false, wasOnPad = false, stepT = 0, prevNear = null;
const save = () => store().setItem(SAVE_KEY, JSON.stringify({ v: SAVE_VERSION, blueprints: game.blueprints, robotsTalked: game.robotsTalked, asked: game.asked, mode: game.mode, flags: game.flags }));

function blocked(sc, p) {
  const b = hit(p), w = sc.walkable;
  if (b.x < w.x || b.y < w.y || b.x + b.w > w.x + w.w || b.y + b.h > w.y + w.h) return true;
  return sc.solids.some((s) => ov(b, s)) || sc.hotspots.some((h) => h.solid && ov(b, h.rect));
}

export const engine = {
  game,
  init() { if (engine.hasSave()) engine.loadSave(); engine.enterRegion(Region.HUB); },
  newGame(mode) { game.blueprints = 0; game.robotsTalked = 0; game.asked = [0, 0]; game.flags = 0; game.mode = mode; game.props = {}; save(); engine.enterRegion(Region.HUB); },
  enterRegion(r) {
    const sc = SCENES[r]; game.region = r; Object.assign(game.player, { x: sc.spawn.x, y: sc.spawn.y, vx: 0, vy: 0, z: 0, vz: 0, facing: sc.spawn.facing, anim: 0, moving: false, airborne: false });
    game.factsSeen = 0; game.pendingFact = -1; game.headlampOn = false; game.latency = { active: false, progress: 0, elapsed: 0 }; game.nearHotspot = null; game.inShadow = false;
    wasOnPortal = sc.hotspots.some((h) => h.kind === 'portal' && h.trigger === Trigger.STEP && ov(hit(game.player), h.rect)); wasOnPad = true;
  },
  getPhysics: (r) => PHYSICS_DEFAULTS[r],
  update(held, pressed) {
    const p = game.player, ph = PHYSICS_DEFAULTS[game.region], sc = SCENES[game.region];
    game.events = 0; game.frame++; game.time += DT;
    let dx = (held & Btn.RIGHT ? 1 : 0) - (held & Btn.LEFT ? 1 : 0), dy = (held & Btn.DOWN ? 1 : 0) - (held & Btn.UP ? 1 : 0);
    const len = Math.hypot(dx, dy) || 1; dx /= len; dy /= len;
    const tx = dx * ph.maxSpeed, ty = dy * ph.maxSpeed, a = (dx || dy ? ph.accel : ph.friction) * DT;
    p.vx += Math.max(-a, Math.min(a, tx - p.vx)); p.vy += Math.max(-a, Math.min(a, ty - p.vy));
    const moving = !!(dx || dy); p.moving = moving;
    if (moving) { p.facing = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? Dir.RIGHT : Dir.LEFT) : (dy > 0 ? Dir.DOWN : Dir.UP); p.anim += DT; }
    const nx = { ...p, x: p.x + p.vx * DT }; if (!blocked(sc, nx)) p.x = nx.x; else { p.vx = 0; game.events |= EVT.BUMP; }
    const ny = { ...p, y: p.y + p.vy * DT }; if (!blocked(sc, ny)) p.y = ny.y; else { p.vy = 0; game.events |= EVT.BUMP; }
    if (ph.hop) {
      if (p.z <= 0 && !p.airborne && moving) { p.vz = ph.hopImpulse; p.airborne = true; }
      if (p.airborne) { p.z += p.vz * DT; p.vz -= ph.gravityZ * DT; if (p.z <= 0) { p.z = 0; p.vz = 0; p.airborne = false; game.events |= EVT.LANDED; } }
    } else if (moving) { stepT += DT; if (stepT > 0.32) { stepT = 0; game.events |= EVT.STEP; } }
    if (pressed & Btn.HEADLAMP && sc.shadows.length) { game.headlampOn = !game.headlampOn; game.events |= EVT.HEADLAMP; }
    const b = hit(p);
    // nearest press hotspot in range and faced (facing ignored in the mock)
    let best = null, bd = 1e9;
    for (const h of sc.hotspots) {
      if (h.trigger !== Trigger.PRESS) continue;
      if (h.kind === 'blueprint' && game.blueprints & (1 << h.ref) && false) continue;
      const r = h.rect, ddx = Math.max(r.x - (b.x + b.w), b.x - (r.x + r.w), 0), ddy = Math.max(r.y - (b.y + b.h), b.y - (r.y + r.h), 0), d = Math.hypot(ddx, ddy);
      if (d <= INTERACT_RANGE_PX && d < bd) { bd = d; best = h; }
    }
    if ((best?.id ?? null) !== (prevNear?.id ?? null)) game.events |= best ? EVT.ENTERED_HOTSPOT : EVT.LEFT_HOTSPOT;
    game.nearHotspot = prevNear = best;
    const onPortal = sc.hotspots.some((h) => h.kind === 'portal' && h.trigger === Trigger.STEP && ov(b, h.rect)); if (onPortal && !wasOnPortal) game.events |= EVT.ON_PORTAL; wasOnPortal = onPortal;
    const onPad = sc.hotspots.some((h) => h.kind === 'returnPad' && ov(b, h.rect)); if (onPad && !wasOnPad) game.events |= EVT.ON_RETURN_PAD; wasOnPad = onPad;
    for (const f of sc.facts) if (!(game.factsSeen & (1 << f.id)) && ov(b, f.rect)) { game.factsSeen |= 1 << f.id; game.pendingFact = f.id; game.events |= EVT.FACT; break; }
    const was = game.inShadow; game.inShadow = sc.shadows.some((s) => ov(b, s)) && !engine.isLit(b.x + 6, b.y + 4);
    if (was !== game.inShadow) game.events |= EVT.SHADOW_CHANGED;
  },
  findInteract: () => game.nearHotspot,
  collectBlueprint(bp) {
    if (game.blueprints & (1 << bp)) return Collect.ALREADY;
    game.blueprints |= 1 << bp; save();
    if (game.blueprints === BP_ALL_MASK) { game.flags |= GF.ENDING_UNLOCKED; game.events |= EVT.BLUEPRINT_COMPLETE; return Collect.COMPLETE; }
    return Collect.NEW;
  },
  markRobotTalked(r) { game.robotsTalked |= 1 << r; save(); },
  markAsked(r, q) { game.asked[r] |= 1 << q; save(); }, hasAsked: (r, q) => !!(game.asked[r] & (1 << q)),
  setMode(m) { game.mode = m; save(); }, toggleMode() { game.mode = game.mode === Mode.EXPLORER ? Mode.ARCHIVIST : Mode.EXPLORER; save(); },
  markIntroSeen() { game.flags |= GF.INTRO_SEEN; save(); }, markEndingSeen() { game.flags |= GF.ENDING_SEEN; save(); },
  completion() { const c = [0, 1].reduce((n, b) => n + ((game.blueprints >> b) & 1), 0); return { count: c, total: BP_COUNT, percent: Math.round((c / BP_COUNT) * 100) }; },
  headlampCone() { const p = game.player; const ang = [90, 270, 180, 0][p.facing]; return { x: p.x + 12, y: p.y + 12 - p.z, dir: p.facing, angleDeg: ang, radius: HEADLAMP.RADIUS_PX, coneDeg: HEADLAMP.CONE_DEG, ambient: HEADLAMP.AMBIENT_PX, on: game.headlampOn }; },
  isLit(x, y) {
    const sc = SCENES[game.region]; if (!sc.shadows.some((s) => x >= s.x && x < s.x + s.w && y >= s.y && y < s.y + s.h)) return true;
    const c = engine.headlampCone(), d = Math.hypot(x - c.x, y - c.y); if (d <= c.ambient) return true; if (!c.on || d > c.radius) return false;
    let da = Math.abs((((Math.atan2(y - c.y, x - c.x) * 180) / Math.PI - c.angleDeg + 540) % 360) - 180); return da <= c.coneDeg / 2;
  },
  latencyStart() { game.latency = { active: true, progress: 0, elapsed: 0 }; },
  latencyTick(dt) { const l = game.latency; if (!l.active) return l.progress; l.elapsed += dt; l.progress = Math.min(1, l.elapsed / LATENCY.GAUGE_REAL_S); if (l.progress >= 1) l.active = false; return l.progress; },
  latencyProgress: () => game.latency.progress, latencyActive: () => game.latency.active,
  acknowledgeFact() { game.pendingFact = -1; },
  propOpen(p) { const s = (game.props[p] ||= initProp(p)); s.open = true; return s; },
  propState: (p) => game.props[p] || null,
  propClose(p) { if (game.props[p]) game.props[p].open = false; },
  propAction(p, action, arg) { const s = engine.propOpen(p); doAction(p, s, action, arg); return s; },
  propTick(p, dt) { const s = engine.propOpen(p); tickProp(p, s, dt); return s; },
  hasSave() { try { const j = JSON.parse(store().getItem(SAVE_KEY)); return !!j && j.v === SAVE_VERSION; } catch { return false; } },
  loadSave() { try { const j = JSON.parse(store().getItem(SAVE_KEY)); if (!j || j.v !== SAVE_VERSION) return false; Object.assign(game, { blueprints: j.blueprints | 0, robotsTalked: j.robotsTalked | 0, asked: j.asked || [0, 0], mode: j.mode | 0, flags: j.flags | 0 }); return true; } catch { return false; } },
  writeSave: save, eraseSave() { store().removeItem(SAVE_KEY); },
};
export const { getScene } = data;

function initProp(p) {
  const base = { prop: p, open: true, changed: false };
  const sc = SCENES[Region.MARS]; const soj = sc.hotspots[0].rect;
  switch (p) {
    case Prop.LRV_NAV: return { ...base, evaIndex: 0, playing: false, t: 0, pos: { ...PROPSPEC[p].lm }, headingDeg: 0, bearingToLmDeg: 0, rangeToLmKm: 0, distanceKm: 0, batteryPct: 100, station: null };
    case Prop.LRV_BATTERY: return { ...base, chargePct: 0, voltageV: 0, loadTest: { running: false, evaIndex: 0, drawnWh: 0, remainingPct: 0 } };
    case Prop.LRV_CAMERA: return { ...base, panDeg: 0, tiltDeg: 0, zoom: 1, queue: [], nextFireIn: 0, liftoff: { running: false, t: 0, frame: 0 } };
    case Prop.LRV_FENDER: return { ...base, fenderOn: false, wheelAngleDeg: 0, dustIntensity: 1 };
    case Prop.SOJ_SOLAR: return { ...base, playing: false, sol: 1, solTime: 0.25, sunElevDeg: 30, dustFactor: 1, powerW: 8, onBattery: false };
    case Prop.SOJ_APXS: return { ...base, targetIndex: 0, deployed: false, progress: 0, result: null };
    case Prop.SOJ_HAZARD: return { ...base, scanning: false, progress: 0, stripes: Array.from({ length: 5 }, () => ({ hit: false, distPx: 40 })), hazard: false, detour: null };
    default: return { ...base, phase: 'idle', signal: 0, pos: { x: soj.x + soj.w / 2, y: soj.y + soj.h / 2 }, target: null, tiltDeg: 0, odometerM: 0, speedPxS: 0 };
  }
}
function doAction(p, s, a, arg) {
  const spec = PROPSPEC[p];
  if (a === PropAction.NAV_SELECT) { s.evaIndex = arg; s.t = 0; s.playing = false; } else if (a === PropAction.NAV_PLAY) s.playing = true; else if (a === PropAction.NAV_PAUSE) s.playing = false; else if (a === PropAction.NAV_RESET) { s.t = 0; s.playing = false; }
  else if (a === PropAction.BAT_LOAD_TEST) s.loadTest = { running: true, evaIndex: arg, drawnWh: 0, remainingPct: 0 };
  else if (a === PropAction.CAM_PAN || a === PropAction.CAM_TILT || a === PropAction.CAM_ZOOM) s.queue.push({ action: a, arg, fireAt: spec.commandDelayS });
  else if (a === PropAction.CAM_LIFTOFF) s.liftoff = { running: true, t: 0, frame: 0 };
  else if (a === PropAction.FENDER_TOGGLE) s.fenderOn = !s.fenderOn;
  else if (a === PropAction.SOLAR_PLAY) s.playing = true; else if (a === PropAction.SOLAR_PAUSE) s.playing = false; else if (a === PropAction.SOLAR_SET_SOL) s.sol = arg;
  else if (a === PropAction.APXS_DEPLOY) { s.targetIndex = arg; s.deployed = true; s.progress = 0; s.result = null; } else if (a === PropAction.APXS_ABORT) { s.deployed = false; s.progress = 0; }
  else if (a === PropAction.HAZ_SCAN) { s.scanning = true; s.progress = 0; s.detour = null; }
  else if (a === PropAction.DRIVE_GOTO) { s.phase = 'signal'; s.signal = 0; s.target = { ...arg }; } else if (a === PropAction.DRIVE_STOP) { s.phase = 'idle'; s.target = null; s.speedPxS = 0; }
}
function tickProp(p, s, dt) {
  const spec = PROPSPEC[p];
  if (p === Prop.LRV_NAV) {
    if (s.playing) { s.t += dt / 25; if (s.t >= 1) { s.t = 1; s.playing = false; } }
    const eva = spec.evas[s.evaIndex], pts = eva.path, k = s.t * (pts.length - 1), i = Math.min(pts.length - 2, Math.floor(k)), f = k - i;
    s.pos = { x: pts[i].x + (pts[i + 1].x - pts[i].x) * f, y: pts[i].y + (pts[i + 1].y - pts[i].y) * f };
    s.headingDeg = (Math.atan2(pts[i + 1].y - pts[i].y, pts[i + 1].x - pts[i].x) * 180) / Math.PI;
    s.bearingToLmDeg = (Math.atan2(spec.lm.y - s.pos.y, spec.lm.x - s.pos.x) * 180) / Math.PI; s.rangeToLmKm = Math.hypot(s.pos.x - spec.lm.x, s.pos.y - spec.lm.y) * 10;
    s.distanceKm = s.t * eva.distanceKm; s.batteryPct = 100 - s.t * 55; s.station = eva.stations.find((st) => Math.abs(st.at - s.t) < 0.05)?.name ?? null;
  } else if (p === Prop.LRV_BATTERY) {
    const lt = s.loadTest; if (lt.running) { const tot = spec.evaDrawWh[lt.evaIndex]; lt.drawnWh = Math.min(tot, lt.drawnWh + (tot / 3) * dt); lt.remainingPct = Math.max(0, 100 - (lt.drawnWh / spec.energyWh) * 100); if (lt.drawnWh >= tot) lt.running = false; }
  } else if (p === Prop.LRV_CAMERA) {
    s.queue.forEach((c) => { c.fireAt -= dt; }); s.nextFireIn = s.queue[0]?.fireAt ?? 0;
    while (s.queue.length && s.queue[0].fireAt <= 0) { const c = s.queue.shift(); if (c.action === 'camPan') s.panDeg = Math.max(-180, Math.min(180, s.panDeg + c.arg * spec.panStepDeg)); else if (c.action === 'camTilt') s.tiltDeg = Math.max(spec.tiltMinDeg, Math.min(spec.tiltMaxDeg, s.tiltDeg + c.arg * spec.tiltStepDeg)); else s.zoom = Math.max(1, Math.min(6, s.zoom + c.arg)); }
    if (s.liftoff.running) { s.liftoff.t += dt; const seq = spec.liftoffSequence; for (const q of seq) if (s.liftoff.t >= q.atS) s.tiltDeg = q.tiltDeg; if (s.liftoff.t > 8) s.liftoff.running = false; }
  } else if (p === Prop.LRV_FENDER) { s.wheelAngleDeg += 300 * dt; s.dustIntensity = s.fenderOn ? 0.12 : 1; }
  else if (p === Prop.SOJ_SOLAR) {
    if (s.playing) { s.solTime += dt / 6; if (s.solTime >= 1) { s.solTime = 0; s.sol = Math.min(83, s.sol + 1); } }
    const e = Math.sin(Math.PI * s.solTime); s.sunElevDeg = e * 60; s.dustFactor = Math.pow(1 - spec.dustLossPerSol, s.sol); s.powerW = Math.max(0, e) * spec.panelW * s.dustFactor; s.onBattery = s.sunElevDeg < 3;
  } else if (p === Prop.SOJ_APXS) {
    if (s.deployed && !s.result) { s.progress = Math.min(1, s.progress + dt / 6); if (s.progress >= 1) { const t = spec.targets[s.targetIndex]; s.result = { name: t.name, rockType: t.rockType, composition: t.composition, finding: t.finding }; } }
  } else if (p === Prop.SOJ_HAZARD) {
    if (s.scanning) { s.progress += dt / 2; s.stripes = s.stripes.map((_, i) => ({ hit: i > 1 && i < 4, distPx: 24 + ((i * 11) % 20) })); if (s.progress >= 1) { s.scanning = false; s.hazard = true; s.detour = 'left'; } }
  } else if (p === Prop.SOJ_DRIVE) {
    if (s.phase === 'signal') { s.signal += dt / LATENCY.GAUGE_REAL_S; if (s.signal >= 1) { s.signal = 1; s.phase = 'moving'; } }
    else if (s.phase === 'moving' && s.target) {
      const dx = s.target.x - s.pos.x, dy = s.target.y - s.pos.y, d = Math.hypot(dx, dy), v = 18;
      if (d < 1.5) { s.phase = 'arrived'; s.speedPxS = 0; s.target = null; } else { s.pos.x += (dx / d) * v * dt; s.pos.y += (dy / d) * v * dt; s.odometerM += 0.01 * v * dt; s.speedPxS = v; s.tiltDeg = Math.sin(s.odometerM * 40) * 10; }
    }
  }
}
