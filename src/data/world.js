/**
 * world.js -- region stats (Notebook / ending / portal menu), the star map,
 * the ending sequence, and the title-screen text.
 *
 * Sources: NASA Moon and Mars fact sheets (NSSDCA planetary fact sheets);
 * Mars Pathfinder ASI/MET results (Schofield et al., Science 1997).
 */
import { Region, Pack, GRAVITY_G, G_MPS2 } from '../contract.js';
import { deepFreeze } from './util.js';

export const REGION_STATS = deepFreeze({
  [Region.HUB]: {
    region: Region.HUB,
    name: 'NASA Archives',
    site: 'Orbital observation room',
    gravityG: GRAVITY_G[Region.HUB],
    gravityMps2: G_MPS2[Region.HUB],
    atmosphere: 'pressurized cabin air',
    rover: 'none - archive stations only',
    rows: [
      { label: 'Core blueprints', value: 'LRV, Sojourner' },
      { label: 'Expansion packs', value: '3 sealed (coming soon)' },
    ],
  },
  [Region.MOON]: {
    region: Region.MOON,
    name: 'The Moon',
    site: 'Taurus-Littrow',
    gravityG: GRAVITY_G[Region.MOON],
    gravityMps2: G_MPS2[Region.MOON],
    atmosphere: 'none (airless regolith)',
    rover: 'LRV - battery-powered, crewed',
    rows: [
      { label: 'Length of day', value: 'about 29.5 Earth days' },
      { label: 'Surface temperature', value: 'about +120 C to -170 C' },
      { label: 'Signal delay from Earth', value: 'about 1.3 s one way' },
      { label: 'Average distance', value: '384,400 km' },
      { label: 'Landing', value: 'Apollo 17, Dec 11, 1972' },
    ],
  },
  [Region.MARS]: {
    region: Region.MARS,
    name: 'Mars',
    site: 'Ares Vallis',
    gravityG: GRAVITY_G[Region.MARS],
    gravityMps2: G_MPS2[Region.MARS],
    atmosphere: 'thin CO2 (under 1% of Earth)',
    rover: 'Sojourner - solar-powered, autonomous',
    rows: [
      { label: 'Length of day', value: '1 sol = 24 h 39 min' },
      { label: 'Air pressure (Pathfinder)', value: 'about 6.7 millibars' },
      { label: 'Temperature (Pathfinder)', value: 'about -75 C to -10 C' },
      { label: 'Signal delay from Earth', value: '~11 min (3 to 22 min)' },
      { label: 'Landing', value: 'Mars Pathfinder, Jul 4, 1997' },
    ],
  },
});

/** x, y, r are fractions of the map panel. */
export const STAR_MAP = deepFreeze({
  bodies: [
    { id: 'sun', name: 'Sun', x: 0.07, y: 0.5, r: 0.07, color: '#ffd166', beacons: [] },
    { id: 'earth', name: 'Earth', x: 0.28, y: 0.52, r: 0.03, color: '#3d7bd9',
      beacons: [{ label: 'NASA ARCHIVES', region: Region.HUB, locked: false }] },
    { id: 'moon', name: 'Moon', x: 0.33, y: 0.38, r: 0.015, color: '#c9ccd1',
      beacons: [
        { label: 'MOON: LRV', region: Region.MOON, locked: false },
        { label: 'LUNAR LEGACY', pack: Pack.LUNAR_LEGACY, locked: true },
      ] },
    { id: 'mars', name: 'Mars', x: 0.5, y: 0.64, r: 0.025, color: '#c1440e',
      beacons: [
        { label: 'MARS: SOJOURNER', region: Region.MARS, locked: false },
        { label: 'MARTIAN FRONTIERS', pack: Pack.MARTIAN_FRONTIERS, locked: true },
      ] },
    { id: 'eros', name: '433 Eros', x: 0.62, y: 0.34, r: 0.01, color: '#a08060',
      beacons: [{ label: 'EROS: NEAR SHOEMAKER', pack: Pack.DEEP_SPACE, locked: true }] },
    { id: 'voyager1', name: 'Voyager 1', x: 0.94, y: 0.14, r: 0.01, color: '#e6edf5',
      beacons: [{ label: 'VOYAGER 1', pack: Pack.DEEP_SPACE, locked: true }] },
  ],
});

export const ENDING = deepFreeze({
  comparison: [
    { label: 'Gravity', moon: '0.166 g (1.62 m/s2)', mars: '0.38 g (3.72 m/s2)' },
    { label: 'Atmosphere', moon: 'None, airless regolith', mars: 'Thin CO2, under 1% of Earth' },
    { label: 'Rover', moon: 'LRV, crewed', mars: 'Sojourner, robotic' },
    { label: 'Power', moon: 'Silver-zinc batteries', mars: '16 W solar panel + battery' },
    { label: 'Who steered', moon: 'Astronauts on board', mars: 'Itself, between commands' },
    { label: 'Signal delay', moon: 'about 1.3 s', mars: 'about 11 min' },
    { label: 'Mass', moon: '210 kg', mars: 'about 10.5 kg' },
    { label: 'Speed', moon: '18 km/h recorded', mars: '1 cm/s' },
    { label: 'Distance driven', moon: 'about 35.7 km', mars: 'about 100 m' },
    { label: 'Active', moon: 'Dec 11-14, 1972', mars: 'Jul 5 - Sep 27, 1997' },
  ],
  montage: [
    { art: 'montage_lrv', caption: 'LRV-3, parked east of the Challenger landing site in Taurus-Littrow. December 1972.' },
    { art: 'montage_sojourner', caption: 'Sojourner beside the Pathfinder lander in Ares Vallis. Last full transmission: September 27, 1997.' },
  ],
  closing: [
    'Though their batteries fade, their solar panels cover with dust, and their wheels fall silent across the planetary voids... these robotic pioneers carry human curiosity into the dark.',
    'They remain abandoned on other worlds, but never forgotten.',
  ],
});

export const TITLE_TEXT = deepFreeze({
  tagline: 'The missions ended. The knowledge they brought did not.',
  continueLabel: 'Continue',
  newGameLabel: 'New Game',
  modeLabels: ['Explorer (Ages 9-12)', 'Archivist (Ages 13-18)'],
  modeBlurbs: [
    'Stories, history, and simple physics. Meet two rovers and hear their last transmissions.',
    'Everything in Explorer, plus telemetry pages: real NASA masses, power, dates, and formulas.',
  ],
});
