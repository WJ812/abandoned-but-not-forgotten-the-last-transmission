/**
 * props.js -- PropSpecs for the 8 real-hardware interactables (contract section 9).
 *
 * Numbers are real hardware values. Where a value is an estimate or a game
 * choice (not a hardware number), the field name or the archivist text says so.
 *
 * Sources: NASA NSSDCA LRV fact sheet; LRV Operations Handbook (Boeing, 1971);
 * Apollo 17 Mission Report (MSC-07904) and Apollo Lunar Surface Journal (ALSJ);
 * RCA GCTA documentation as summarized in the ALSJ; NASA/JPL Mars Pathfinder
 * press kit and rover fact sheets; Landis & Jenkins (1997) Materials Adherence
 * Experiment; Rieder et al., Science 278, 1771 (1997) APXS results.
 */
import { Prop } from '../contract.js';
import { deepFreeze } from './util.js';
import { MARS_OBSTACLES, MARS_LANDER_POS } from './scenes.js';

/* ---------- LRV_NAV: traverse replays on the nav mini-map ----------
 * Map fractions, north up, LM near the valley center. Geometry follows the
 * Apollo 17 traverse map (shape and relative directions, not survey-exact):
 * EVA-1 south to Station 1; EVA-2 west-southwest to Nansen at the foot of
 * the South Massif, back east via Lara, Shorty, Camelot; EVA-3 north to the
 * North Massif, east to the Sculptured Hills, back via Van Serg. */
const LM = { x: 0.56, y: 0.5 };

/** Build {path, stations} with `at` = fraction of path length at a vertex. */
function traverse(points, stationAt) {
  const path = [LM, ...points, LM];
  const cum = [0];
  for (let i = 1; i < path.length; i++) {
    cum.push(cum[i - 1] + Math.hypot(path[i].x - path[i - 1].x, path[i].y - path[i - 1].y));
  }
  const total = cum[cum.length - 1];
  const stations = stationAt.map(([name, idx]) => ({ name, at: Math.round((cum[idx] / total) * 1000) / 1000 }));
  return { path, stations };
}

const EVA1 = traverse(
  [{ x: 0.585, y: 0.47 }, { x: 0.59, y: 0.53 }, { x: 0.575, y: 0.585 }, { x: 0.555, y: 0.54 }],
  [['ALSEP site', 1], ['Station 1 (near Steno)', 3]],
);
const EVA2 = traverse(
  [{ x: 0.42, y: 0.57 }, { x: 0.25, y: 0.66 }, { x: 0.13, y: 0.72 }, { x: 0.29, y: 0.63 },
    { x: 0.38, y: 0.59 }, { x: 0.47, y: 0.55 }],
  [['Station 2 (Nansen)', 3], ['Station 3 (Lara)', 4], ['Station 4 (Shorty)', 5], ['Station 5 (Camelot)', 6]],
);
const EVA3 = traverse(
  [{ x: 0.54, y: 0.35 }, { x: 0.52, y: 0.2 }, { x: 0.565, y: 0.18 }, { x: 0.78, y: 0.29 },
    { x: 0.64, y: 0.4 }],
  [['Station 6 (split boulder)', 2], ['Station 7 (North Massif)', 3], ['Station 8 (Sculptured Hills)', 4], ['Station 9 (Van Serg)', 5]],
);

const LRV_NAV = {
  prop: Prop.LRV_NAV,
  title: 'LRV Navigation Console',
  blurb: 'The odometer still reads 35.9 km. Pick one of the three real Apollo 17 drives and replay it: watch the heading, the distance, and the arrow pointing home to the lander.',
  archivist: 'Dead reckoning: a directional gyro for heading plus wheel odometer pulses, processed into bearing and range to the LM. Drive legs from the Apollo 17 Mission Report; map paths are traced, not surveyed.',
  odometerKm: 35.9,
  maxRangeFromLmKm: 7.6,
  navSystem: 'Directional gyro, wheel odometers, signal processing unit, sun-shadow device for gyro alignment',
  lm: LM,
  evas: [
    { id: 0, label: 'EVA-1', dateUtc: '1972-12-11T23:54Z', distanceKm: 3.3, durationMin: 432, maxRangeKm: 1.1, ...EVA1 },
    { id: 1, label: 'EVA-2', dateUtc: '1972-12-12T23:28Z', distanceKm: 20.3, durationMin: 457, maxRangeKm: 7.6, ...EVA2 },
    { id: 2, label: 'EVA-3', dateUtc: '1972-12-13T22:25Z', distanceKm: 12.1, durationMin: 435, maxRangeKm: 4.2, ...EVA3 },
  ],
};

/* ---------- LRV_BATTERY ---------- */
const BAT_V = 36;
const BAT_AH = 121;
const BAT_COUNT = 2;
const ENERGY_WH = BAT_COUNT * BAT_V * BAT_AH;              // 8,712 Wh
const DESIGN_RANGE_KM = 92;                                // LRV Operations Handbook, 57 statute miles
const WH_PER_KM_EST = ENERGY_WH / DESIGN_RANGE_KM;         // ~95 Wh/km design-average estimate

const LRV_BATTERY = {
  prop: Prop.LRV_BATTERY,
  title: 'LRV Battery Panel',
  blurb: 'Two silver-zinc batteries, 36 volts each. They were never meant to be recharged, and they have read 0% since December 1972. Run a load test to see what one drive used.',
  archivist: 'Each battery: 36 V, 121 Ah, 23 silver-zinc cells in KOH. Load-test draws are estimates from the 92 km design range (about 95 Wh/km), not telemetry. The crews finished every mission with charge to spare.',
  count: BAT_COUNT,
  voltageV: BAT_V,
  capacityAh: BAT_AH,
  chemistry: 'silver-zinc',
  rechargeable: false,
  energyWh: ENERGY_WH,
  motors: { count: 4, hp: 0.25, watts: 186 },              // watts per motor (0.25 hp = 186 W)
  topSpeedKmh: 18,                                         // recorded by Cernan, Apollo 17
  designSpeedKmh: 13,                                      // extra field: design speed on level ground
  evaDrawWh: LRV_NAV.evas.map((e) => Math.round(e.distanceKm * WH_PER_KM_EST)),
  whyDead: 'Silver-zinc primary cells give their energy once and cannot be recharged. Their energy was used up long ago, and nothing on the Moon can refill them.',
};

/* ---------- LRV_CAMERA (GCTA) ---------- */
const LRV_CAMERA = {
  prop: Prop.LRV_CAMERA,
  title: 'Ground-Commanded TV Camera',
  blurb: 'Houston steered this camera by radio. Every command takes about 1.3 seconds to reach the Moon, so you have to plan ahead. Try to replay the famous liftoff shot!',
  archivist: 'RCA GCTA: color TV, 6:1 zoom, pan about 340 degrees, tilt +85 to -45 degrees. Ed Fendell sent the liftoff tilt commands early to cover the delay. Liftoff replay keyframes are a reconstruction.',
  panMinDeg: -170,
  panMaxDeg: 170,
  tiltMinDeg: -45,
  tiltMaxDeg: 85,
  zoomMin: 1,
  zoomMax: 6,
  panStepDeg: 15,           // game step per command (not a hardware value)
  tiltStepDeg: 5,           // game step per command (not a hardware value)
  commandDelayS: 1.3,
  liftoffUtc: '1972-12-14T22:54:37Z',
  liftoffSequence: [
    { atS: 0, tiltDeg: 0 },
    { atS: 2, tiltDeg: 6 },
    { atS: 4, tiltDeg: 15 },
    { atS: 7, tiltDeg: 28 },
    { atS: 11, tiltDeg: 42 },
    { atS: 16, tiltDeg: 55 },
  ],
  operator: 'Ed Fendell, Mission Control, Houston',
};

/* ---------- LRV_FENDER ---------- */
const LRV_FENDER = {
  prop: Prop.LRV_FENDER,
  title: 'Repaired Right-Rear Fender',
  blurb: 'Four map pages, duct tape, and two lamp clamps. Spin the wheel with and without this fix and watch the dust fly.',
  archivist: 'Broken during EVA-1 when a hammer handle caught it; a first tape repair failed in the dust. The map fix, worked out overnight on Earth, was fitted at the start of EVA-2 and held for the rest of the mission.',
  brokenDate: '1972-12-11 (EVA-1)',
  fixDate: '1972-12-12 (start of EVA-2)',
  fixMaterials: 'Four laminated maps, duct tape, and two clamps from the LM portable utility lights',
  wheelDiameterCm: 81.8,
  wheelMaterial: 'Woven zinc-coated steel wire mesh with titanium chevron treads',
  dustWithoutFender: 'A rooster tail of dark dust sprays over the crew, the seats, and the batteries, soaking up sunlight and heat.',
  dustWithFender: 'The fender catches the spray and the dust drops close to the wheel.',
};

/* ---------- SOJ_SOLAR ---------- */
const SOJ_SOLAR = {
  prop: Prop.SOJ_SOLAR,
  title: 'Sojourner Solar Panel',
  blurb: 'About 16 watts at noon from a panel smaller than a school desk. Watch the power rise and fall with the Sun, and fade as dust settles sol after sol.',
  archivist: 'About 0.22 m2 of GaAs cells, about 16 W peak. Pathfinder\'s Materials Adherence Experiment measured dust cutting output by about 0.28% per sol. Primary LiSOCl2 batteries (about 150 Wh) were the backup.',
  panelW: 16,
  panelAreaM2: 0.22,
  cellType: 'GaAs',
  batteryChemistry: 'LiSOCl2',
  batteryRechargeable: false,
  solHours: 24.66,
  dustLossPerSol: 0.0028,
  missionSols: 83,
  plannedSols: 7,
  nightPowerSource: 'Asleep at night: no driving. Non-rechargeable LiSOCl2 battery for keep-alive; 3 radioisotope heater units warmed the electronics box.',
};

/* ---------- SOJ_APXS ----------
 * Oxide weight percents rounded from Rieder et al. (1997), Table 1 (APXS
 * analyses A-3 Barnacle Bill and A-7 Yogi). Later recalibrations shift them
 * by a few percent; the qualitative finding is unchanged. */
const SOJ_APXS = {
  prop: Prop.SOJ_APXS,
  title: 'Alpha Proton X-ray Spectrometer',
  blurb: 'Press the APXS head against a rock and wait. It counts particles and X-rays bouncing back, which takes about ten hours, so the rover worked through the cold night.',
  archivist: 'Curium-244 sources bombard the rock; detectors read backscattered alpha particles, protons, and X-rays to give element amounts. Values here are rounded 1997 results.',
  integrationHours: 10,
  targets: [
    {
      id: 0, name: 'Barnacle Bill', sol: 3, rockType: 'andesite-like volcanic rock',
      composition: [
        { element: 'SiO2', pct: 58.6 },
        { element: 'FeO', pct: 12.9 },
        { element: 'Al2O3', pct: 10.8 },
        { element: 'CaO', pct: 5.3 },
        { element: 'MgO', pct: 3.0 },
      ],
      finding: 'High silica, like andesite on Earth: a sign that Mars magma had changed and evolved, not just simple basalt.',
    },
    {
      id: 1, name: 'Yogi', sol: 10, rockType: 'basaltic rock with soil coating',
      composition: [
        { element: 'SiO2', pct: 55.5 },
        { element: 'FeO', pct: 13.1 },
        { element: 'Al2O3', pct: 10.6 },
        { element: 'CaO', pct: 6.6 },
        { element: 'MgO', pct: 5.9 },
      ],
      finding: 'Less silica and more magnesium than Barnacle Bill. Part of the signal is Mars soil stuck to the rock, which looked like the dust everywhere else.',
    },
  ],
};

/* ---------- SOJ_HAZARD ---------- */
const SOJ_HAZARD = {
  prop: Prop.SOJ_HAZARD,
  title: 'Laser Hazard Detection',
  blurb: 'Five lasers paint stripes on the ground and two cameras watch them. If a stripe bends or breaks, something is in the way, and Sojourner decides for itself how to go around.',
  archivist: 'Five laser stripe projectors and two black-and-white front cameras measured the terrain ahead. Hazard height and scan range here are approximate (about one wheel diameter, about one rover length).',
  laserStripes: 5,
  cameras: 2,
  wheelDiameterCm: 13,
  hazardHeightCm: 13,       // approximate: about one wheel diameter
  scanRangeCm: 30,          // approximate: about half a rover length ahead of the front
  decision: 'If a stripe showed a rock or drop ahead, the rover stopped, backed up, turned away from the side with the hazard, and tried again toward its waypoint.',
  obstacles: MARS_OBSTACLES,
};

/* ---------- SOJ_DRIVE ---------- */
const SOJ_DRIVE = {
  prop: Prop.SOJ_DRIVE,
  title: 'Drive Command Relay',
  blurb: 'Pick a spot and send Sojourner a waypoint. The command crosses about 11 minutes of space first, then the rover crawls there at 1 centimeter per second.',
  archivist: 'Drivers at JPL chose waypoints in 3-D views built from the lander stereo camera. Over 83 sols Sojourner drove about 100 m in all and never went more than about 12 m from the lander.',
  maxSpeedCmS: 1,
  totalTraverseM: 100,
  maxFromLanderM: 12,
  landerPos: MARS_LANDER_POS,
  commandNote: 'Commands went from Earth to the lander, then by UHF radio modem to the rover. No live steering: one plan per sol.',
  obstacles: MARS_OBSTACLES,
};

export const PROP_SPECS = deepFreeze({
  [Prop.LRV_NAV]: LRV_NAV,
  [Prop.LRV_BATTERY]: LRV_BATTERY,
  [Prop.LRV_CAMERA]: LRV_CAMERA,
  [Prop.LRV_FENDER]: LRV_FENDER,
  [Prop.SOJ_SOLAR]: SOJ_SOLAR,
  [Prop.SOJ_APXS]: SOJ_APXS,
  [Prop.SOJ_HAZARD]: SOJ_HAZARD,
  [Prop.SOJ_DRIVE]: SOJ_DRIVE,
});
