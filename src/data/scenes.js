/**
 * scenes.js -- the three single-screen scenes (contract section 4, SceneDef).
 *
 * PLACEHOLDER GEOMETRY: Artwork/Scenes/ is empty, so every rect below is a
 * plausible layout for the frontend's placeholder renderer. When the real
 * 320x180 paintings arrive, retarget by editing ONLY the named rect constants
 * at the top of each block; hotspots, solids, and prop obstacles reference them.
 *
 * Conventions (all scene px, top-left origin):
 *   - walkable: the box the player's FEET HITBOX (PLAYER.HIT_*) must stay in.
 *     The band above it is the painted horizon / back wall.
 *   - spawn: player sprite top-left; its hitbox never touches a solid,
 *     a STEP hotspot, or a fact zone.
 *   - Hardware bodies are in `solids`; PRESS hotspots sit just outside them so
 *     the player can stand next to the object. Only DECOR/STATION hotspots that
 *     ARE the object are marked solid.
 */
import {
  Region, Station, Robot, Blueprint, Prop, HotspotKind as K, Trigger as T, Dir, Surface,
  CANVAS_W, CANVAS_H,
} from '../contract.js';
import { deepFreeze, R } from './util.js';

const hs = (id, kind, rect, trigger, ref, solid, label, extra = {}) =>
  ({ id, kind, rect, trigger, ref, solid, label, ...extra });

/* =====================================================================
 * HUB: NASA Archives, orbital observation room (spec section 3 layout)
 *   [STAR MAP]   [PORTAL]   [ARCHIVE COMP]
 *               (astronaut)
 *   [NOTEBOOK]            [EXPANSION BAY]
 * ===================================================================== */
const HUB_WALKABLE = R(8, 44, 304, 128);          // back wall + window above y=44
const HUB_STAR_MAP = R(24, 28, 40, 30);           // wall console, protrudes to y=58
const HUB_PORTAL = R(140, 54, 40, 24);            // floor pad (step on)
const HUB_COMPUTER = R(256, 28, 40, 30);          // wall console, protrudes to y=58
const HUB_NOTEBOOK = R(24, 136, 32, 24);          // desk with the notebook
const HUB_EXPANSION = R(252, 130, 56, 32);        // sealed crates (decor)
const HUB_PLANTER_L = R(100, 44, 16, 12);         // hydroponics planters by the wall
const HUB_PLANTER_R = R(204, 44, 16, 12);

const HUB = {
  region: Region.HUB,
  name: 'NASA Archives',
  w: CANVAS_W, h: CANVAS_H,
  background: 'scene_hub',
  surface: Surface.WOOD,
  spawn: { x: 148, y: 120, facing: Dir.UP },
  walkable: HUB_WALKABLE,
  solids: [HUB_PLANTER_L, HUB_PLANTER_R],
  shadows: [],
  hotspots: [
    hs('hub.starmap', K.STATION, HUB_STAR_MAP, T.PRESS, Station.STAR_MAP, true, 'Star Map'),
    hs('hub.portal', K.PORTAL, HUB_PORTAL, T.STEP, 0, false, 'Portal: Moon / Mars'),
    hs('hub.computer', K.STATION, HUB_COMPUTER, T.PRESS, Station.ARCHIVE_COMPUTER, true, 'Archive Computer'),
    hs('hub.notebook', K.STATION, HUB_NOTEBOOK, T.PRESS, Station.NOTEBOOK, true, 'Explorer Notebook'),
    hs('hub.expansion', K.DECOR, HUB_EXPANSION, T.PRESS, Station.EXPANSION_BAY, true, 'Expansion Bay',
      { caption: 'Sealed crates: Lunar Legacy, Martian Frontiers, Deep Space. Coming soon.' }),
  ],
  facts: [],
};

/* =====================================================================
 * MOON: Taurus-Littrow, Apollo 17. Massifs painted above y=56.
 * LRV drawn ~2x hero scale (3.1 m * 12 px/m * 2 = ~74 px long).
 * Its interactables sit around the body, one per side/corner, spaced so
 * that only one is in range at a time.
 * ===================================================================== */
const MOON_WALKABLE = R(4, 56, 312, 120);
const MOON_LRV_BODY = R(152, 98, 72, 28);         // chassis + wheels (solid)
const MOON_LRV_TALK = R(140, 100, 12, 24);        // front end: the rover "faces" left
const MOON_LRV_NAV = R(152, 88, 20, 10);          // console, top-left of the body
const MOON_LRV_CAMERA = R(204, 88, 20, 10);       // GCTA mast, top-right
const MOON_LRV_BATTERY = R(152, 126, 20, 10);     // battery panel, bottom-left
const MOON_LRV_FENDER = R(204, 126, 20, 10);      // right-rear fender, bottom-right
const MOON_BLUEPRINT = R(250, 140, 12, 12);
const MOON_RETURN = R(16, 152, 24, 12);
const MOON_BOULDER = R(108, 140, 22, 14);         // split boulder (North Massif debris)
const MOON_ROCK_A = R(284, 150, 18, 12);
const MOON_ROCK_B = R(12, 64, 14, 10);
const MOON_CRATER_BIG = R(36, 62, 60, 30);        // shadowed crater, walkable
const MOON_CRATER_SMALL = R(272, 112, 38, 24);    // "Shorty"-style crater, walkable

const MOON = {
  region: Region.MOON,
  name: 'Taurus-Littrow',
  w: CANVAS_W, h: CANVAS_H,
  background: 'scene_moon',
  surface: Surface.REGOLITH,
  spawn: { x: 52, y: 136, facing: Dir.RIGHT },
  walkable: MOON_WALKABLE,
  solids: [MOON_LRV_BODY, MOON_BOULDER, MOON_ROCK_A, MOON_ROCK_B],
  shadows: [MOON_CRATER_BIG, MOON_CRATER_SMALL, R(152, 126, 72, 4) /* LRV underbody */],
  hotspots: [
    hs('moon.lrv', K.ROBOT, MOON_LRV_TALK, T.PRESS, Robot.LRV, false, 'Talk to LRV-3'),
    hs('moon.lrv.nav', K.PROP, MOON_LRV_NAV, T.PRESS, Prop.LRV_NAV, false, 'Nav console'),
    hs('moon.lrv.camera', K.PROP, MOON_LRV_CAMERA, T.PRESS, Prop.LRV_CAMERA, false, 'TV camera (GCTA)'),
    hs('moon.lrv.battery', K.PROP, MOON_LRV_BATTERY, T.PRESS, Prop.LRV_BATTERY, false, 'Battery panel'),
    hs('moon.lrv.fender', K.PROP, MOON_LRV_FENDER, T.PRESS, Prop.LRV_FENDER, false, 'Repaired fender'),
    hs('moon.blueprint', K.BLUEPRINT, MOON_BLUEPRINT, T.PRESS, Blueprint.LRV, false, 'Scan LRV blueprint'),
    hs('moon.return', K.RETURN_PAD, MOON_RETURN, T.STEP, 0, false, 'Return to Hub'),
  ],
  facts: [
    {
      id: 0, rect: R(44, 66, 44, 22), title: 'Darker than night',
      explorer: 'With no air to scatter sunlight, shadows on the Moon are pitch black. Press F to switch on your headlamp and see what hides inside.',
      archivist: 'On Earth, air scatters sunlight into every shadow. In the Moon\'s near-vacuum, shadows only get light reflected off nearby ground, so they look black next to the 120 C sunlit regolith.',
    },
    {
      id: 1, rect: R(96, 128, 50, 44), title: 'Boulders from the mountains',
      explorer: 'Boulders like this one rolled down from the North Massif. At Station 6 the crew sampled a giant boulder that had split apart.',
      archivist: 'The North Massif boulders are breccias: older rocks smashed and welded together by huge impacts. Their ages helped date the impact that formed the Serenitatis basin.',
    },
    {
      id: 2, rect: R(262, 106, 54, 36), title: 'Orange soil',
      explorer: 'At Shorty crater, Jack Schmitt shouted that the ground was orange! The color came from tiny beads of volcanic glass, sprayed out by ancient fire fountains.',
      archivist: 'Shorty is about 110 m across. Its orange and black glass beads formed in volcanic fire fountains about 3.6 billion years ago; the impact that made Shorty dug them up.',
    },
    {
      id: 3, rect: R(232, 56, 64, 20), title: 'Earth in the sky',
      explorer: 'Look up! From here, Earth hangs in nearly the same spot in the sky all the time, because the Moon always keeps the same face turned toward us.',
      archivist: 'Tidal locking: the Moon spins once per orbit, every 27.3 days. From Taurus-Littrow, on the near side, Earth stays high in the sky and only wobbles slightly.',
    },
  ],
};

/* =====================================================================
 * MARS: Ares Vallis, Mars Pathfinder. Twin Peaks painted above y=60.
 * Sojourner is a SPRITE (sojourner_body), not painted in; its hotspots below
 * mark its starting position near the lander ramp. Solar / hazard props are
 * on the rover itself and are told apart by the facing the player needs.
 * ===================================================================== */
const MARS_WALKABLE = R(4, 60, 312, 116);
const MARS_LANDER = R(36, 66, 60, 34);            // Pathfinder + petals (solid)
const MARS_RELAY = R(96, 84, 10, 14);             // lander side: drive command relay
const MARS_ROVER = R(160, 120, 24, 14);           // Sojourner start (sprite area)
const MARS_SOLAR = R(160, 112, 24, 8);            // top of rover, seen from above
const MARS_HAZARD = R(184, 120, 6, 14);           // front laser windows
const MARS_BARNACLE_BILL = R(112, 104, 16, 12);   // right by the ramp, as on sol 3
const MARS_BB_APXS = R(112, 116, 16, 8);
const MARS_YOGI = R(232, 78, 28, 18);             // larger rock a few m away
const MARS_YOGI_APXS = R(232, 96, 28, 8);
const MARS_ROCK_FRONT = R(206, 122, 12, 10);      // rock ahead of the rover (hazard demo)
const MARS_ROCK_B = R(196, 152, 14, 10);
const MARS_ROCK_C = R(130, 160, 12, 8);
const MARS_BLUEPRINT = R(276, 146, 12, 12);
const MARS_RETURN = R(16, 156, 24, 12);

/** Rocks the hazard scan and drive planner see (shared with props.js). */
export const MARS_OBSTACLES = deepFreeze([MARS_BARNACLE_BILL, MARS_ROCK_FRONT, MARS_YOGI, MARS_ROCK_B, MARS_ROCK_C]);
/** Lander center (drive range is measured from here). */
export const MARS_LANDER_POS = deepFreeze({ x: MARS_LANDER.x + MARS_LANDER.w / 2, y: MARS_LANDER.y + MARS_LANDER.h / 2 });

const MARS = {
  region: Region.MARS,
  name: 'Ares Vallis',
  w: CANVAS_W, h: CANVAS_H,
  background: 'scene_mars',
  surface: Surface.SAND,
  spawn: { x: 48, y: 136, facing: Dir.RIGHT },
  walkable: MARS_WALKABLE,
  solids: [MARS_LANDER, MARS_BARNACLE_BILL, MARS_YOGI, MARS_ROCK_FRONT, MARS_ROCK_B, MARS_ROCK_C],
  shadows: [],
  hotspots: [
    hs('mars.sojourner', K.ROBOT, MARS_ROVER, T.PRESS, Robot.SOJOURNER, false, 'Talk to Sojourner', { facing: Dir.UP }),
    hs('mars.solar', K.PROP, MARS_SOLAR, T.PRESS, Prop.SOJ_SOLAR, false, 'Solar panel', { facing: Dir.DOWN }),
    hs('mars.hazard', K.PROP, MARS_HAZARD, T.PRESS, Prop.SOJ_HAZARD, false, 'Hazard lasers', { facing: Dir.LEFT }),
    hs('mars.apxs.bb', K.PROP, MARS_BB_APXS, T.PRESS, Prop.SOJ_APXS, false, 'APXS: Barnacle Bill'),
    hs('mars.apxs.yogi', K.PROP, MARS_YOGI_APXS, T.PRESS, Prop.SOJ_APXS, false, 'APXS: Yogi'),
    hs('mars.drive', K.PROP, MARS_RELAY, T.PRESS, Prop.SOJ_DRIVE, false, 'Lander relay: drive rover'),
    hs('mars.blueprint', K.BLUEPRINT, MARS_BLUEPRINT, T.PRESS, Blueprint.SOJOURNER, false, 'Scan Sojourner blueprint'),
    hs('mars.return', K.RETURN_PAD, MARS_RETURN, T.STEP, 0, false, 'Return to Hub'),
  ],
  facts: [
    {
      id: 0, rect: R(14, 102, 44, 24), title: 'Landing on airbags',
      explorer: 'Pathfinder landed wrapped in giant airbags. It bounced across the ground about 15 times before rolling to a stop, then pulled in the bags and opened its petals.',
      archivist: 'Pathfinder flew straight into the atmosphere from its cruise path, slowed with a heat shield, parachute, and retrorockets, then cut loose inside 24 Vectran airbag lobes.',
    },
    {
      id: 1, rect: R(112, 136, 72, 30), title: 'A flood plain',
      explorer: 'Billions of years ago, giant floods roared through Ares Vallis. They left rounded pebbles and rocks tilted the same way, like books knocked over by a rushing river.',
      archivist: 'Ares Vallis is an outflow channel. Lander images showed imbricated rocks, stacked and tilted in the downstream direction, a classic sign of catastrophic flooding.',
    },
    {
      id: 2, rect: R(140, 60, 72, 20), title: 'Twin Peaks',
      explorer: 'The two hills on the horizon are the Twin Peaks, about a kilometer away. Spotting them in pictures from orbit helped scientists find exactly where Pathfinder landed.',
      archivist: 'Matching horizon features like Twin Peaks and Big Crater to Viking orbiter images placed the lander to within about 100 m. The peaks are a few tens of meters tall.',
    },
    {
      id: 3, rect: R(252, 106, 56, 32), title: 'Thin, cold air',
      explorer: 'Mars air is very thin and mostly carbon dioxide. Even on summer afternoons here it stayed below freezing, and nights fell to about minus 75 degrees Celsius.',
      archivist: 'Pathfinder\'s weather mast measured a surface pressure of about 6.7 millibars, under 1% of Earth\'s, and detected dust devils sweeping past the lander.',
    },
  ],
};

export const SCENES = deepFreeze({ [Region.HUB]: HUB, [Region.MOON]: MOON, [Region.MARS]: MARS });
