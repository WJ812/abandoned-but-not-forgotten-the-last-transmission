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
 * MOON: Taurus-Littrow. REAL ART: 'Artwork/Scenes/moon_location.png', 360x180.
 * Horizon at y~80 (Earth in the sky). Crater dark interiors are SHADOW zones
 * (walkable; black until the headlamp is on). LRV = 'rover_lrv' 70x70 sprite,
 * drawn bottom-aligned on its hotspot; its footprint is solid and is the ONE
 * LRV hotspot (dialogue + nav/battery/camera/fender on one combined screen).
 * Clickables: LRV, blueprint (inside the right-lower crater shadow), return pad.
 * ===================================================================== */
const MOON_WALKABLE = R(4, 92, 352, 86);
const MOON_LRV = R(200, 116, 70, 24);             // bottom 70x24 of the 70x70 sprite
const MOON_BLUEPRINT = R(300, 147, 12, 12);       // inside the right-lower crater shadow
const MOON_RETURN = R(170, 162, 24, 12);
const MOON_SH_BIG = R(22, 125, 83, 35);           // big crater interior (rim 15-150, 115-165)
const MOON_SH_TOPLEFT = R(37, 90, 43, 10);
const MOON_SH_TOPMID = R(135, 95, 35, 8);
const MOON_SH_MID = R(110, 125, 30, 23);
const MOON_SH_RIGHTLOW = R(283, 144, 47, 18);
const MOON_SH_FARRIGHT = R(318, 84, 32, 8);

const MOON = {
  region: Region.MOON,
  name: 'Taurus-Littrow',
  w: CANVAS_W, h: CANVAS_H,
  background: 'scene_moon',
  surface: Surface.REGOLITH,
  spawn: { x: 200, y: 148, facing: Dir.UP },
  walkable: MOON_WALKABLE,
  solids: [],
  shadows: [MOON_SH_BIG, MOON_SH_TOPLEFT, MOON_SH_TOPMID, MOON_SH_MID, MOON_SH_RIGHTLOW, MOON_SH_FARRIGHT],
  hotspots: [
    hs('moon.lrv', K.ROBOT, MOON_LRV, T.PRESS, Robot.LRV, true, 'LRV-3'),
    hs('moon.blueprint', K.BLUEPRINT, MOON_BLUEPRINT, T.PRESS, Blueprint.LRV, false, 'Scan LRV blueprint'),
    hs('moon.return', K.RETURN_PAD, MOON_RETURN, T.PRESS, 0, false, 'Return to Hub'),
  ],
  facts: [
    {
      id: 0, rect: R(276, 96, 40, 16), title: 'Earth in a black sky',
      explorer: 'With no air to scatter sunlight, the sky is black even in daytime. Earth hangs in nearly the same spot all the time, because the Moon always keeps the same face toward us.',
      archivist: 'Tidal locking: the Moon spins once per orbit, every 27.3 days. From Taurus-Littrow, on the near side, Earth stays high in the sky and only wobbles slightly.',
    },
    {
      id: 1, rect: R(30, 130, 60, 24), title: 'A big impact crater',
      explorer: 'Craters like this one were blasted out by asteroids and comets. With no wind or rain to wear them down, they can last for billions of years.',
      archivist: 'At Taurus-Littrow the crew sampled craters of many sizes. Impacts dig up deeper material; Shorty crater, about 110 m across, exposed buried orange volcanic glass.',
    },
    {
      id: 2, rect: R(112, 128, 26, 18), title: 'Darker than night',
      explorer: 'With no air to scatter sunlight, shadows on the Moon are pitch black. Press F to switch on your headlamp and see what hides inside.',
      archivist: 'On Earth, air scatters sunlight into every shadow. In the Moon\'s near-vacuum, shadows only get light reflected off nearby ground, so they look black beside the sunlit regolith.',
    },
    {
      id: 3, rect: R(38, 93, 40, 12), title: 'Craters on craters',
      explorer: 'Space rocks hit the Moon all the time, leaving craters of every size, from bowls you could step over to basins hundreds of kilometers wide.',
      archivist: 'Constant small impacts slowly churn the top layer of soil, called gardening. Counting craters tells scientists roughly how old a surface is: more craters, older surface.',
    },
    {
      id: 4, rect: R(146, 108, 44, 18), title: 'Regolith',
      explorer: 'The gray ground is regolith: rock dust and broken pieces made by billions of years of impacts. It is fine like flour, sharp, and clings to everything, including spacesuits.',
      archivist: 'Regolith grains stay jagged because no wind or water rounds them. Apollo crews found the dust scratched visors, clogged seals, and stuck to every surface it touched.',
    },
    {
      id: 5, rect: R(236, 150, 40, 22), title: 'Taurus-Littrow valley',
      explorer: 'This valley is walled by mountains called massifs, taller than the Grand Canyon is deep. Apollo 17 landed here in December 1972 to study old mountain rock and volcanic soil.',
      archivist: 'The massifs are crust uplifted by the impact that formed the Serenitatis basin. The valley floor is dark volcanic basalt about 3.7 to 3.8 billion years old.',
    },
  ],
};

/* =====================================================================
 * MARS: Ares Vallis. REAL ART: 'Artwork/Scenes/mars_location.png', 360x180.
 * Painted: left ridge, open dunes, Big Crater rim (right), rocks R1-R6.
 * NOT painted (drawn as sprites): Pathfinder lander, Sojourner ('rover_sojourner'
 * 70x70, bottom-aligned on its hotspot), return pad, blueprint.
 * Clickables: Sojourner (ONE combined screen: dialogue + solar, APXS, hazard,
 * drive log), the blueprint, and the return pad (PRESS). Nothing else.
 * Rock names used by the APXS panel: Barnacle Bill ~ R2, Yogi ~ R5.
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
const MARS_ROVER = R(162, 146, 70, 22);           // bottom 70x22 of the 70x70 sprite (sprite 162-232, 98-168)
const MARS_BLUEPRINT = R(300, 152, 12, 12);
const MARS_RETURN = R(4, 164, 24, 12);

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
  spawn: { x: 34, y: 150, facing: Dir.RIGHT },
  walkable: MARS_WALKABLE,
  solids: [MARS_RIDGE_BASE, MARS_CRATER_RIM, MARS_R1, MARS_R2, MARS_R4, MARS_R5, MARS_R6, MARS_LANDER],
  shadows: [],
  hotspots: [
    hs('mars.sojourner', K.ROBOT, MARS_ROVER, T.PRESS, Robot.SOJOURNER, true, 'Sojourner'),
    hs('mars.blueprint', K.BLUEPRINT, MARS_BLUEPRINT, T.PRESS, Blueprint.SOJOURNER, false, 'Scan Sojourner blueprint'),
    hs('mars.return', K.RETURN_PAD, MARS_RETURN, T.PRESS, 0, false, 'Return to Hub'),
  ],
  facts: [
    {
      id: 0, rect: R(28, 112, 50, 20), title: 'Hills on the horizon',
      explorer: 'From the Pathfinder site, two hills called the Twin Peaks stood about a kilometer away. Spotting them in pictures from orbit helped scientists find exactly where the lander sat.',
      archivist: 'Matching horizon features such as Twin Peaks and Big Crater to Viking orbiter images pinpointed the landing site. The peaks are about a kilometer from the lander.',
    },
    {
      id: 1, rect: R(64, 162, 44, 16), title: 'Rocks from a megaflood',
      explorer: 'Billions of years ago, giant floods roared through Ares Vallis. They left rounded pebbles and rocks tilted the same way, like books knocked over by a rushing river.',
      archivist: 'Ares Vallis is an outflow channel. Lander images showed imbricated rocks, stacked and tilted in the downstream direction, a classic sign of catastrophic flooding.',
    },
    {
      id: 2, rect: R(110, 152, 44, 14), title: 'Freezing cold',
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
      explorer: 'That rim belongs to a crater the team called Big Crater, a bowl about 1.5 km across, blasted out long ago when a space rock hit Mars.',
      archivist: 'Big Crater, about 1.5 km across, lies a couple of kilometers from the lander. Seen on the horizon, it helped locate the lander on Viking orbiter maps, together with Twin Peaks.',
    },
  ],
};

export const SCENES = deepFreeze({ [Region.HUB]: HUB, [Region.MOON]: MOON, [Region.MARS]: MARS });
