/** Fixture scenes and prop specs for the engine tests (not a test file itself). */
import { Region, Dir, HotspotKind, Trigger, Prop, Robot, Station, CANVAS_W, CANVAS_H } from '../contract.js';
import { _setDataProvider, init, _resetMemorySave } from './core.js';

const full = { x: 0, y: 0, w: CANVAS_W, h: CANVAS_H };

export const SCENES = {
  [Region.HUB]: {
    region: Region.HUB, name: 'NASA Archives', w: CANVAS_W, h: CANVAS_H, background: 'scene_hub', surface: 'wood',
    spawn: { x: 148, y: 120, facing: Dir.UP },
    walkable: { x: 10, y: 40, w: 300, h: 130 },
    solids: [{ x: 200, y: 100, w: 20, h: 40 }],
    shadows: [],
    hotspots: [
      { id: 'hub.portal', kind: HotspotKind.PORTAL, rect: { x: 140, y: 60, w: 40, h: 20 }, trigger: Trigger.STEP, ref: 0, solid: false, label: 'Portal' },
      { id: 'hub.computer', kind: HotspotKind.STATION, rect: { x: 260, y: 40, w: 40, h: 20 }, trigger: Trigger.PRESS, ref: Station.ARCHIVE_COMPUTER, solid: true, facing: Dir.UP, label: 'Archive Computer' },
      { id: 'hub.notebook', kind: HotspotKind.STATION, rect: { x: 20, y: 140, w: 20, h: 20 }, trigger: Trigger.PRESS, ref: Station.NOTEBOOK, solid: true, label: 'Notebook' },
    ],
    facts: [],
  },
  [Region.MOON]: {
    region: Region.MOON, name: 'Taurus-Littrow', w: CANVAS_W, h: CANVAS_H, background: 'scene_moon', surface: 'regolith',
    spawn: { x: 40, y: 120, facing: Dir.RIGHT },
    walkable: full,
    solids: [],
    shadows: [{ x: 200, y: 20, w: 100, h: 60 }],
    hotspots: [
      // The spawn sits ON the return pad: it must not fire on the spawn frame.
      { id: 'moon.pad', kind: HotspotKind.RETURN_PAD, rect: { x: 40, y: 130, w: 30, h: 20 }, trigger: Trigger.STEP, ref: 0, solid: false, label: 'Return' },
      { id: 'moon.lrv', kind: HotspotKind.ROBOT, rect: { x: 140, y: 40, w: 40, h: 24 }, trigger: Trigger.PRESS, ref: Robot.LRV, solid: true, label: 'LRV' },
    ],
    facts: [
      { id: 0, rect: { x: 100, y: 120, w: 20, h: 40 }, title: 'Regolith', explorer: 'Dust.' },
      { id: 1, rect: { x: 40, y: 125, w: 40, h: 20 }, title: 'Spawn fact', explorer: 'Overlaps the spawn.' },
    ],
  },
  [Region.MARS]: {
    region: Region.MARS, name: 'Ares Vallis', w: CANVAS_W, h: CANVAS_H, background: 'scene_mars', surface: 'sand',
    spawn: { x: 20, y: 120, facing: Dir.RIGHT },
    walkable: full,
    solids: [],
    shadows: [],
    hotspots: [
      { id: 'mars.sojourner', kind: HotspotKind.ROBOT, rect: { x: 148, y: 83, w: 24, h: 14 }, trigger: Trigger.PRESS, ref: Robot.SOJOURNER, solid: true, label: 'Sojourner' },
    ],
    facts: [{ id: 0, rect: { x: 60, y: 120, w: 20, h: 40 }, title: 'Dust', explorer: 'Red.' }],
  },
};

export const SPECS = {
  [Prop.LRV_NAV]: { odometerKm: 35.9, maxRangeFromLmKm: 7.6, lm: { x: 0.5, y: 0.5 },
    evas: [
      { id: 0, label: 'EVA-1', distanceKm: 3.3, durationMin: 432, maxRangeKm: 1.0,
        path: [{ x: 0.5, y: 0.5 }, { x: 0.5, y: 0.3 }, { x: 0.7, y: 0.3 }, { x: 0.5, y: 0.5 }], stations: [{ name: 'ALSEP', at: 0.5 }] },
      { id: 1, label: 'EVA-2', distanceKm: 20.3, durationMin: 457, maxRangeKm: 7.6,
        path: [{ x: 0.5, y: 0.5 }, { x: 0.1, y: 0.9 }, { x: 0.2, y: 0.9 }, { x: 0.5, y: 0.5 }], stations: [] },
      { id: 2, label: 'EVA-3', distanceKm: 12.1, durationMin: 435, maxRangeKm: 4.2,
        path: [{ x: 0.5, y: 0.5 }, { x: 0.8, y: 0.2 }, { x: 0.9, y: 0.3 }, { x: 0.5, y: 0.5 }], stations: [] },
    ] },
  [Prop.LRV_BATTERY]: { count: 2, voltageV: 36, capacityAh: 121, energyWh: 8712, evaDrawWh: [300, 1500, 900] },
  [Prop.LRV_CAMERA]: { panMinDeg: -90, panMaxDeg: 90, tiltMinDeg: -30, tiltMaxDeg: 60, zoomMin: 1, zoomMax: 6,
    panStepDeg: 15, tiltStepDeg: 10, commandDelayS: 1.3,
    liftoffSequence: [{ atS: 0, tiltDeg: 0 }, { atS: 1, tiltDeg: 20 }, { atS: 2, tiltDeg: 40 }] },
  [Prop.LRV_FENDER]: { wheelDiameterCm: 81.8 },
  [Prop.SOJ_SOLAR]: { panelW: 16, dustLossPerSol: 0.003, missionSols: 83, solHours: 24.66 },
  [Prop.SOJ_APXS]: { integrationHours: 10, targets: [
    { id: 0, name: 'Barnacle Bill', sol: 3, rockType: 'andesite-like', composition: [{ element: 'Si', pct: 25 }], finding: 'High silica.' },
    { id: 1, name: 'Yogi', sol: 9, rockType: 'basalt-like', composition: [{ element: 'Si', pct: 21 }], finding: 'Less silica.' }] },
  [Prop.SOJ_HAZARD]: { laserStripes: 5, cameras: 2, wheelDiameterCm: 13, hazardHeightCm: 13, scanRangeCm: 30,
    obstacles: [{ x: 190, y: 82, w: 12, h: 16 }] },
  [Prop.SOJ_DRIVE]: { maxSpeedCmS: 1, totalTraverseM: 100, maxFromLanderM: 12, landerPos: { x: 120, y: 90 },
    obstacles: [{ x: 190, y: 82, w: 12, h: 16 }] },
};

/** Inject fixtures, remove any storage, clear the memory save, init(). */
export function setup({ scenes = SCENES, specs = SPECS } = {}) {
  _setDataProvider({ getScene: (r) => scenes[r], getPropSpec: (p) => specs[p] });
  delete globalThis.localStorage;
  _resetMemorySave();
  init();
}

/** Map-backed localStorage stand-in. */
export function fakeStorage() {
  const m = new Map();
  return {
    map: m,
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => { m.set(k, String(v)); },
    removeItem: (k) => { m.delete(k); },
    clear: () => m.clear(),
  };
}
