/**
 * catalog.js -- the 8-mission expansion catalog and the 3 pack descriptions
 * (Archive Computer roadmap). Catalog-only: none of these are playable.
 *
 * Sources: NASA NSSDCA mission pages (Surveyor 3, Apollo LM, ALSEP, Mars
 * Pathfinder, NEAR Shoemaker, Voyager 1); NASA/JPL InSight and Ingenuity
 * end-of-mission releases (Dec 2022, Jan 2024); JPL Voyager mission status.
 */
import { Mission, Pack } from '../contract.js';
import { MISSION_ICONS } from '../assets.js';
import { deepFreeze } from './util.js';

const entry = (id, pack, name, body, site, dates, summary, archivist) =>
  ({ id, pack, name, body, site, dates, icon: MISSION_ICONS[id], summary, archivist });

export const CATALOG = deepFreeze([
  entry(Mission.SURVEYOR3, Pack.LUNAR_LEGACY,
    'Surveyor 3 Scoop & Camera', 'Moon', 'Oceanus Procellarum', '1967 (visited 1969)',
    'Surveyor 3 landed in April 1967 and dug into the Moon with a small scoop to test the soil. Two and a half years later, Apollo 12 astronauts walked over to it and brought its camera home.',
    'Landed April 20, 1967. Its surface sampler dug trenches to measure soil strength for Apollo. Apollo 12 landed about 180 m away in Nov 1969; bacteria found in the camera are now thought to be Earth contamination.'),
  entry(Mission.APOLLO_LM_DESCENT, Pack.LUNAR_LEGACY,
    'Apollo Lunar Module Descent Stage', 'Moon', 'Six Apollo landing sites', '1969-1972',
    'Each Apollo lander came in two parts. The bottom half, the descent stage, landed the crew and then served as the launch pad for the top half. Six of them still stand on the Moon.',
    'Its throttleable descent engine gave up to about 45 kN of thrust. The descent stages of Apollo 11, 12, 14, 15, 16, and 17 remain on the surface, each carrying a plaque.'),
  entry(Mission.ALSEP, Pack.LUNAR_LEGACY,
    'ALSEP Seismic Station', 'Moon', 'Apollo 12, 14, 15, 16, 17 sites', '1969-1977',
    'Apollo crews left science stations on the Moon that kept sending data to Earth for years, feeling moonquakes and meteorite impacts, until NASA switched them off on September 30, 1977.',
    'Apollo Lunar Surface Experiments Package, powered by SNAP-27 plutonium-238 generators. Its seismometers recorded thousands of moonquakes and revealed the layers inside the Moon.'),
  entry(Mission.PATHFINDER_AIRBAGS, Pack.MARTIAN_FRONTIERS,
    'Mars Pathfinder Vectran Airbags', 'Mars', 'Ares Vallis', '1997',
    'Instead of landing legs, Pathfinder wrapped itself in giant airbags. On July 4, 1997, it bounced across Mars about 15 times before rolling to a stop, then opened up like a flower.',
    'Four airbags of six lobes each, made of Vectran fabric, inflated seconds before impact after a parachute and retrorockets slowed the lander. The same method later landed Spirit and Opportunity.'),
  entry(Mission.INSIGHT_SEIS, Pack.MARTIAN_FRONTIERS,
    'InSight Lander SEIS Seismometer', 'Mars', 'Elysium Planitia', '2018-2022',
    'InSight set a super-sensitive seismometer on the ground and listened to the inside of Mars. It heard more than 1,300 marsquakes before dust covered its solar panels.',
    'Landed Nov 26, 2018. SEIS, led by France\'s CNES, recorded 1,319 quakes, including a magnitude 4.7 in May 2022, and mapped the crust, mantle, and liquid core. The mission ended in Dec 2022.'),
  entry(Mission.INGENUITY, Pack.MARTIAN_FRONTIERS,
    'Ingenuity Mars Helicopter', 'Mars', 'Jezero Crater', '2021-2024',
    'Ingenuity was a 1.8 kg helicopter that rode to Mars under the Perseverance rover. Planned for five test flights, it flew 72 times: the first powered, controlled flights on another planet.',
    'First flight April 19, 2021. Its rotors spun at about 2,400 rpm to bite the thin air. A blade was damaged on flight 72 (Jan 18, 2024). It carries a swatch of fabric from the 1903 Wright Flyer.'),
  entry(Mission.NEAR_SHOEMAKER, Pack.DEEP_SPACE,
    'NEAR Shoemaker Asteroid Lander', 'Asteroid 433 Eros', 'Eros surface', '2000-2001',
    'NEAR Shoemaker orbited the asteroid Eros for a year. Then, though it was never built to land, it gently touched down on February 12, 2001: the first spacecraft to land on an asteroid.',
    'Eros is about 34 km long. NEAR touched down at under 2 m/s, and its gamma-ray spectrometer kept measuring the surface until the last contact on Feb 28, 2001.'),
  entry(Mission.VOYAGER1, Pack.DEEP_SPACE,
    'Voyager 1 & The Golden Record', 'Interstellar space', 'Beyond the heliosphere', '1977-present',
    'Voyager 1 launched in 1977, flew past Jupiter and Saturn, and is now in interstellar space, the farthest human-made object. It carries a Golden Record of sounds, music, and pictures of Earth.',
    'Launched Sep 5, 1977; crossed the heliopause Aug 25, 2012. In late 2026 it reaches about one light-day (about 26 billion km) from Earth, so a radio message takes a whole day each way.'),
]);

export const PACKS = deepFreeze({
  [Pack.LUNAR_LEGACY]: {
    pack: Pack.LUNAR_LEGACY, name: 'Lunar Legacy', subtitle: 'Expansion Pack 1',
    missions: [Mission.SURVEYOR3, Mission.APOLLO_LM_DESCENT, Mission.ALSEP],
  },
  [Pack.MARTIAN_FRONTIERS]: {
    pack: Pack.MARTIAN_FRONTIERS, name: 'Martian Frontiers', subtitle: 'Expansion Pack 2',
    missions: [Mission.PATHFINDER_AIRBAGS, Mission.INSIGHT_SEIS, Mission.INGENUITY],
  },
  [Pack.DEEP_SPACE]: {
    pack: Pack.DEEP_SPACE, name: 'Deep Space & Interstellar', subtitle: 'Expansion Pack 3',
    missions: [Mission.NEAR_SHOEMAKER, Mission.VOYAGER1],
  },
});
