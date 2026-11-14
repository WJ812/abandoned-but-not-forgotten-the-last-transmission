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
 * HUB: NASA Archives. REAL ART: 'Artwork/Scenes/The Hub (INTERACTIVE).png',
 * 360x180. Geometry measured from the art. Per the user's decision the ONLY
 * interactables are the portal (PRESS -> location menu) and the computer desk
 * (Archive Computer, which also holds the Notebook and Star Map).
 * ===================================================================== */
const HUB_WALKABLE = R(4, 138, 352, 40);          // floor band for the feet hitbox
const HUB_PORTAL = R(50, 118, 90, 24);            // portal ring's floor base
const HUB_PORTAL_PLINTH = R(40, 118, 110, 24);    // plinth edges either side of the base
const HUB_COMPUTER = R(142, 112, 193, 53);        // computer desk

const HUB = {
  region: Region.HUB,
  name: 'NASA Archives',
  w: CANVAS_W, h: CANVAS_H,
  background: 'scene_hub',
  surface: Surface.WOOD,
  spawn: { x: 88, y: 144, facing: Dir.UP },
  walkable: HUB_WALKABLE,
  solids: [HUB_PORTAL_PLINTH],
  shadows: [],
  hotspots: [
    hs('hub.portal', K.PORTAL, HUB_PORTAL, T.PRESS, 0, true, 'Portal'),
    hs('hub.computer', K.STATION, HUB_COMPUTER, T.PRESS, Station.ARCHIVE_COMPUTER, true, 'Archive Computer'),
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
 * MARS: Ares Vallis. REAL ART: 'Artwork/Scenes/mars_location.png', 360x180.
 * Painted: left ridge, open dunes, Big Crater rim (right), rocks R1-R6.
 * NOT painted (drawn as sprites): Pathfinder lander, Sojourner, return pad,
 * blueprint. Clickables per the user: Sojourner (talk), its hardware panels
 * (solar and hazard ride on the rover; drive is the fixed lander relay; APXS on two rocks), the
 * blueprint, and the return pad. Nothing else.
 * Barnacle Bill -> R2, Yogi -> R5 (game mapping; the real rocks sat a few m
 * from the lander).
 * ===================================================================== */
const MARS_WALKABLE = R(4, 110, 352, 68);         // ground band; sky/slopes above
const MARS_RIDGE_BASE = R(0, 105, 45, 15);        // left ridge meets the ground
const MARS_CRATER_RIM = R(265, 80, 95, 38);       // Big Crater rim, intrudes to y=118
const MARS_R1 = R(6, 125, 21, 12);
const MARS_R2 = R(51, 140, 31, 20);               // "Barnacle Bill"
const MARS_R4 = R(242, 157, 10, 9);
const MARS_R5 = R(254, 147, 36, 20);              // biggest rock, "Yogi"
const MARS_R6 = R(328, 153, 10, 7);
// R3 pebble (84-90, 150-155) is decor only: not solid, not interactive.
const MARS_LANDER = R(110, 112, 48, 28);          // pathfinder_lander sprite (48x28)
const MARS_ROVER = R(184, 140, 24, 14);           // sojourner_body sprite start
const MARS_SOLAR = R(184, 132, 24, 8);            // panel on top of the rover
const MARS_HAZARD = R(208, 140, 6, 14);           // front laser windows (right)
const MARS_DRIVE = R(158, 124, 6, 14);            // lander relay (fixed): waypoint drive
const MARS_BB_APXS = R(82, 140, 8, 20);           // R2 right (near) edge
const MARS_YOGI_APXS = R(254, 139, 36, 8);        // R5 top (near) edge
const MARS_BLUEPRINT = R(214, 120, 12, 12);
const MARS_RETURN = R(16, 160, 24, 12);

/** Lander + solid rocks the hazard scan and drive planner see (shared with props.js). */
export const MARS_OBSTACLES = deepFreeze([MARS_LANDER, MARS_R1, MARS_R2, MARS_R4, MARS_R5, MARS_R6]);
/** Lander center (drive range is measured from here). */
export const MARS_LANDER_POS = deepFreeze({ x: MARS_LANDER.x + MARS_LANDER.w / 2, y: MARS_LANDER.y + MARS_LANDER.h / 2 });

const MARS = {
  region: Region.MARS,
  name: 'Ares Vallis',
  w: CANVAS_W, h: CANVAS_H,
  background: 'scene_mars',
  surface: Surface.SAND,
  spawn: { x: 40, y: 148, facing: Dir.RIGHT },
  walkable: MARS_WALKABLE,
  solids: [MARS_RIDGE_BASE, MARS_CRATER_RIM, MARS_R1, MARS_R2, MARS_R4, MARS_R5, MARS_R6, MARS_LANDER],
  shadows: [],
  hotspots: [
    hs('mars.sojourner', K.ROBOT, MARS_ROVER, T.PRESS, Robot.SOJOURNER, false, 'Talk to Sojourner', { facing: Dir.UP }),
    hs('mars.solar', K.PROP, MARS_SOLAR, T.PRESS, Prop.SOJ_SOLAR, false, 'Solar panel', { facing: Dir.DOWN }),
    hs('mars.hazard', K.PROP, MARS_HAZARD, T.PRESS, Prop.SOJ_HAZARD, false, 'Hazard lasers', { facing: Dir.LEFT }),
    hs('mars.drive', K.PROP, MARS_DRIVE, T.PRESS, Prop.SOJ_DRIVE, false, 'Lander relay: drive rover', { facing: Dir.LEFT }),
    hs('mars.apxs.bb', K.PROP, MARS_BB_APXS, T.PRESS, Prop.SOJ_APXS, false, 'APXS: Barnacle Bill', { arg: 0 }),
    hs('mars.apxs.yogi', K.PROP, MARS_YOGI_APXS, T.PRESS, Prop.SOJ_APXS, false, 'APXS: Yogi', { arg: 1 }),
    hs('mars.blueprint', K.BLUEPRINT, MARS_BLUEPRINT, T.PRESS, Blueprint.SOJOURNER, false, 'Scan Sojourner blueprint'),
    hs('mars.return', K.RETURN_PAD, MARS_RETURN, T.STEP, 0, false, 'Return to Hub'),
  ],
  facts: [
    {
      id: 0, rect: R(28, 112, 50, 20), title: 'Hills on the horizon',
      explorer: 'From the Pathfinder site, two hills called the Twin Peaks stood about a kilometer away. Spotting them in pictures from orbit helped scientists find exactly where the lander sat.',
      archivist: 'Matching horizon features such as Twin Peaks and Big Crater to Viking orbiter images pinpointed the landing site. The peaks rise a few tens of meters above the plain.',
    },
    {
      id: 1, rect: R(64, 162, 44, 16), title: 'Rocks from a megaflood',
      explorer: 'Billions of years ago, giant floods roared through Ares Vallis. They left rounded pebbles and rocks tilted the same way, like books knocked over by a rushing river.',
      archivist: 'Ares Vallis is an outflow channel. Lander images showed imbricated rocks, stacked and tilted in the downstream direction, a classic sign of catastrophic flooding.',
    },
    {
      id: 2, rect: R(124, 160, 56, 18), title: 'Freezing cold',
      explorer: 'Even on summer afternoons the air here stayed below freezing, and nights fell to about minus 75 degrees Celsius. Thin air cannot hold on to the day\'s heat.',
      archivist: 'Pathfinder carried thermometers at three heights on its weather mast. They showed the air could change by many degrees over just one meter, and swing about 60 C from day to night.',
    },
    {
      id: 3, rect: R(168, 112, 56, 16), title: 'Dunes and dust',
      explorer: 'Mars air is very thin and mostly carbon dioxide, under 1% as thick as Earth\'s. Even so, the wind piles sand into dunes and lifts fine dust, and dust storms can cover the whole planet.',
      archivist: 'Pathfinder\'s weather mast measured a surface pressure of about 6.7 millibars and detected dust devils sweeping past the lander. Dust settling on solar panels cut their power sol by sol.',
    },
    {
      id: 4, rect: R(226, 167, 70, 11), title: 'A grab bag of rocks',
      explorer: 'Floods carried big rocks like this one down Ares Vallis from the old highlands far upstream. Scientists picked this spot so a tiny rover could study rocks from many places at once.',
      archivist: 'The site was chosen because the floods should have dumped a mix of rocks from upstream, letting one small rover sample the highlands without driving there.',
    },
    {
      id: 5, rect: R(300, 120, 56, 26), title: 'Big Crater',
      explorer: 'That rim belongs to a crater the team called Big Crater, a bowl more than a kilometer wide, blasted out long ago when a space rock hit Mars.',
      archivist: 'Big Crater lies a couple of kilometers south of the lander. Seen on the horizon, it helped locate the lander on Viking orbiter maps, together with Twin Peaks.',
    },
  ],
};

export const SCENES = deepFreeze({ [Region.HUB]: HUB, [Region.MOON]: MOON, [Region.MARS]: MARS });
