/**
 * contract.js -- ABANDONED BUT NOT FORGOTTEN (web edition)
 *
 * SHARED CONTRACT between all modules. OWNED BY THE LEAD ARCHITECT.
 * Subagents MUST NOT edit this file. If you need a change, report it in your
 * final summary instead.
 *
 * Runtime: modern browsers, vanilla ES modules, no build step, no npm deps.
 * Served by `npm start` (tools/serve.mjs) at http://localhost:8080.
 *
 * Module graph (one direction only):
 *
 *   src/main.js + src/gfx/  ──>  src/engine/index.js  ──>  src/data/index.js
 *            └──────────────────────────────────────────────^
 *                  everyone ──> src/contract.js
 *
 *   src/data   (backend-engineer)  pure content + layout. Imports only contract.js.
 *                                  No DOM, no state, no side effects.
 *   src/engine (engine-engineer)   rules, physics, triggers, save/password.
 *                                  Imports contract.js + data. No DOM, no canvas,
 *                                  must run headless under Node 22 for tests.
 *                                  Only module that touches localStorage
 *                                  (via globalThis.localStorage, guarded).
 *   src/gfx + src/main.js          canvas, input, scenes, effects, audio.
 *   (frontend-engineer)            Only module that touches the DOM.
 *
 * Each of data/ and engine/ MUST expose its full public API from its
 * `index.js` barrel with exactly the names documented below.
 */

/* ========================================================================
 * 1. SCREEN & TEXT
 * Retro look: the game renders to a 160x144 internal canvas (20x18 tiles of
 * 8x8 px) which the frontend scales up by an integer factor, pixelated.
 * ====================================================================== */
export const SCREEN_W = 160;
export const SCREEN_H = 144;
export const TILE = 8;
export const SCREEN_W_TILES = 20;
export const SCREEN_H_TILES = 18;
export const FPS = 60;                 // fixed simulation step

export const TEXT_COLS = 18;           // chars per line in a dialogue page
export const TEXT_ROWS = 3;            // lines per page
export const CHOICE_LABEL_MAX = 16;    // drawn as "> label"
export const SHORT_NAME_MAX = 14;      // drawn as "[X] name"
/** All game text is printable ASCII 0x20..0x7E only (8x8 bitmap font). */

/**
 * A Page is an array of 1..3 strings, each <= 18 chars.
 * @typedef {string[]} Page
 */

/* ========================================================================
 * 2. REGIONS, MAP GEOMETRY, HUB
 * ====================================================================== */
export const Region = Object.freeze({ HUB: 0, MOON: 1, MARS: 2, DEEP_SPACE: 3 });
export const REGION_COUNT = 4;

/** Expedition regions = 2x2 screens, flip-screen. screen = sy*2 + sx (0 NW,1 NE,2 SW,3 SE). */
export const REGION_W_TILES = 40;
export const REGION_H_TILES = 36;
export const REGION_W_PX = 320;
export const REGION_H_PX = 288;

export const Station = Object.freeze({ STAR_MAP: 0, PORTAL: 1, ARCHIVE_COMPUTER: 2, NOTEBOOK: 3 });

/** Hub = single 20x18 room. Row 0, row 17, col 0, col 19 are solid walls.
 *  Rects are in TILES. Frontend draws exactly here; engine collides/interacts here. */
export const HUB = Object.freeze({
  STAR_MAP: { tx: 1,  ty: 1,  w: 4, h: 3, solid: true },   // interact with A
  PORTAL:   { tx: 8,  ty: 2,  w: 4, h: 3, solid: false },  // STEP ON -> EVT.ON_PORTAL
  COMPUTER: { tx: 15, ty: 1,  w: 4, h: 3, solid: true },   // interact with A
  NOTEBOOK: { tx: 1,  ty: 13, w: 4, h: 3, solid: true },   // interact with A (or B anywhere)
  WINDOW:   { tx: 12, ty: 0,  w: 3, h: 1, solid: true },   // Earth window in top wall (ending pan)
  SPAWN:    { tx: 9,  ty: 8 },                             // top-left of 16x16 player sprite
});

/* ========================================================================
 * 3. CONTENT IDS
 * ====================================================================== */
export const Blueprint = Object.freeze({
  SURVEYOR3_SCOOP: 0,    // Moon
  APOLLO_LM_DESCENT: 1,  // Moon
  ALSEP: 2,              // Moon
  LRV: 3,                // Moon
  PATHFINDER_AIRBAGS: 4, // Mars
  SOJOURNER_ROCKER: 5,   // Mars
  INSIGHT_SEIS: 6,       // Mars
  INGENUITY_ROTOR: 7,    // Mars
  NEAR_SHOEMAKER: 8,     // Deep Space
  VOYAGER1_RECORD: 9,    // Deep Space
});
export const BP_COUNT = 10;
export const BP_ALL_MASK = 0x3ff;
export const bpRegion = (bp) => (bp < 4 ? Region.MOON : bp < 8 ? Region.MARS : Region.DEEP_SPACE);
export const regionBlueprints = (r) =>
  r === Region.MOON ? [0, 1, 2, 3] : r === Region.MARS ? [4, 5, 6, 7] : r === Region.DEEP_SPACE ? [8, 9] : [];

export const Robot = Object.freeze({
  SURVEYOR3: 0,        // Moon - Oceanus Procellarum
  APOLLO17: 1,         // Moon - Taurus-Littrow (LRV & ALSEP)
  SOJOURNER: 2,        // Mars - Ares Vallis
  INSIGHT: 3,          // Mars - Elysium Planitia
  NEAR_SHOEMAKER: 4,   // Deep Space - 433 Eros
  VOYAGER1: 5,         // Deep Space - interstellar boundary
});
export const ROBOT_COUNT = 6;
export const robotRegion = (r) => (r >> 1) + 1;

export const Archive = Object.freeze({ DAWN: 0, KEPLER_K2: 1 });
export const ARCHIVE_COUNT = 2;

/* ========================================================================
 * 4. TEXT DATABASE  -- data/index.js
 *
 *   getText(kind, id, part) -> Page[]     ([] if that part doesn't exist)
 *
 *   TextKind.BLUEPRINT (id = Blueprint)
 *     TITLE      1 page: [name line 1, name line 2 or "", active years]
 *     SHORT      1 page: [checklist name <= 14]
 *     EXPLORER   n pages: history & aim, ages 9-12 (shown in BOTH modes)
 *     ARCHIVIST  n pages: mass/power/dates/formulas, ages 13-18 (Archivist mode only)
 *   TextKind.ROBOT (id = Robot)
 *     TITLE      1 page: [display name, location]
 *     SHORT      1 page: [transcript list name <= 14]
 *     GREETING   n pages
 *     CHOICES    1 page: [choice A label <= 16, choice B label <= 16]
 *     ANSWER_A   n pages
 *     ANSWER_B   n pages
 *     ARCHIVIST  n pages: telemetry appended after an answer (Archivist mode only)
 *   TextKind.ARCHIVE (id = Archive): TITLE, SHORT, EXPLORER, ARCHIVIST
 *   TextKind.FACT (id = 0..getFactCount()-1): SHORT (popup heading <= 14), EXPLORER, ARCHIVIST?
 *   TextKind.REGION (id = Region incl. HUB)
 *     TITLE      1 page: [region name, subtitle]
 *     EXPLORER   n pages: Notebook physics stats ("g = 1.62 m/s2" ...)
 *     SCREEN     4 pages (Hub: 1): page N = [location name of screen N]
 *   TextKind.ENDING (id = 0)
 *     RECAP      n pages: chronological terminal readout, 3 regions / 10 artifacts
 *     MONTAGE    exactly 4 pages: captions for frames 0 InSight dust, 1 LRV under
 *                black sky, 2 NEAR on Eros, 3 Voyager 1 gliding
 *     CLOSING    n pages: closing quote, final words "...but never forgotten."
 * ====================================================================== */
export const TextKind = Object.freeze({ BLUEPRINT: 0, ROBOT: 1, ARCHIVE: 2, FACT: 3, REGION: 4, ENDING: 5 });
export const Part = Object.freeze({
  TITLE: 'title', SHORT: 'short', EXPLORER: 'explorer', ARCHIVIST: 'archivist',
  GREETING: 'greeting', CHOICES: 'choices', ANSWER_A: 'answerA', ANSWER_B: 'answerB',
  SCREEN: 'screen', RECAP: 'recap', MONTAGE: 'montage', CLOSING: 'closing',
});
export const MONTAGE_FRAMES = 4;
export const FACT_MAX = 32;

/* ========================================================================
 * 5. WORLD LAYOUT  -- data/index.js
 *
 *   getEntities(region) -> WorldEntity[]   (Hub: [])
 *   getZones(region)    -> WorldZone[]     (Hub: [])
 *   getFactCount()      -> number          (<= FACT_MAX)
 *   INSIGHT_POWER       -> readonly array of exactly INSIGHT_DUST_STEPS
 *                          { label: string (<=18), whPerSol: number }
 *                          from landing (Nov 2018) to last contact (Dec 2022)
 *
 * Coordinates are REGION TILES (0..39, 0..35). Frontend must draw ZONE.SOLID
 * as rocks/rims, ZONE.SHADOW as black (unless lit), and every entity.
 * ====================================================================== */
export const Ent = Object.freeze({
  ROBOT: 'robot',          // id = Robot. Solid. Interact with A. Typically 2x2.
  BLUEPRINT: 'blueprint',  // id = Blueprint. Not solid. Interact with A. 1x1.
  RETURN_PAD: 'returnPad', // id = 0. Not solid. Step on -> EVT.ON_RETURN_PAD.
                           // Exactly one per expedition region; player spawns just below it.
});
export const Zone = Object.freeze({
  SOLID: 'solid',          // blocks movement
  SHADOW: 'shadow',        // Moon: black until headlamp
  FACT: 'fact',            // param = fact id; entering -> EVT.FACT
});
/** @typedef {{type:string, id:number, tx:number, ty:number, w:number, h:number}} WorldEntity */
/** @typedef {{type:string, param:number, tx:number, ty:number, w:number, h:number}} WorldZone */

/* ========================================================================
 * 6. PHYSICS  (floats; units = px and frames at 60 FPS)
 *
 * Hop axis z (px above ground). Gravity scale: 1 g == G_EARTH px/frame^2.
 * Region gravities use the real ratios. Hop height = v^2/(2g), airtime = 2v/g.
 *   Moon  0.166 g: 0.75^2/(2*0.0415) ~ 6.8 px, ~36 frames  (floaty bounding)
 *   Mars  0.38 g : 0.50^2/(2*0.095)  ~ 1.3 px, ~11 frames  (moderate stride)
 * Engine owns the final table and may tune +/-25%.
 * ====================================================================== */
export const G_EARTH = 0.25;
export const GRAVITY_RATIO = Object.freeze({ HUB: 1.0, MOON: 0.166, MARS: 0.38, DEEP_SPACE: 0.0001 });

export const RF = Object.freeze({
  HOP: 1, FOOTPRINTS: 2, SHADOWS: 4, DUST: 8, INERTIA: 16, LATENCY: 32,
});
export const REGION_FLAGS = Object.freeze([
  0,                                       // HUB
  RF.HOP | RF.FOOTPRINTS | RF.SHADOWS,     // MOON
  RF.HOP | RF.DUST | RF.LATENCY,           // MARS (Sojourner ~11 min delay)
  RF.INERTIA | RF.LATENCY,                 // DEEP SPACE
]);

/** @typedef {{maxSpeed:number, accel:number, friction:number, gravityZ:number, hopImpulse:number, flags:number}} PhysicsParams */
export const PHYSICS_DEFAULTS = Object.freeze([
  { maxSpeed: 1.0,  accel: 0.25,  friction: 0.25,  gravityZ: G_EARTH * 1.0,   hopImpulse: 0,    flags: REGION_FLAGS[0] },
  { maxSpeed: 0.75, accel: 0.125, friction: 0.06,  gravityZ: G_EARTH * 0.166, hopImpulse: 0.75, flags: REGION_FLAGS[1] },
  { maxSpeed: 0.9,  accel: 0.19,  friction: 0.19,  gravityZ: G_EARTH * 0.38,  hopImpulse: 0.5,  flags: REGION_FLAGS[2] },
  { maxSpeed: 1.5,  accel: 0,     friction: 0,     gravityZ: 0,               hopImpulse: 0,    flags: REGION_FLAGS[3] },
]);
export const SPACE_RCS_IMPULSE = 0.25;  // added to velocity per RCS puff
export const SPACE_RCS_REPEAT = 8;      // frames between puffs while held
export const SPACE_BRAKE = 0.03;        // SELECT held: decel per frame toward 0

/** Player sprite 16x16; position = top-left in region px. Hitbox = feet. */
export const PLAYER = Object.freeze({ W: 16, H: 16, HIT_X: 2, HIT_Y: 8, HIT_W: 12, HIT_H: 8 });
export const INTERACT_RANGE_PX = 6;

export const Dir = Object.freeze({ DOWN: 0, UP: 1, LEFT: 2, RIGHT: 3 });

export const FOOTPRINT_MAX = 96;        // permanent per Moon visit; stop adding when full
export const HEADLAMP_RADIUS = 2;       // tiles (square)
export const DUST_PARTICLES = 6;
export const INSIGHT_DUST_STEPS = 8;
export const LATENCY_BAR_STEPS = 16;

/* ========================================================================
 * 7. INPUT  (frontend maps keys/touch -> these bits, engine consumes them)
 *   Arrows/WASD = D-pad | Z/Space/Enter = A | X = B (Notebook)
 *   Esc/P = START (pause + mode toggle) | Shift/F = SELECT (headlamp / RCS brake)
 * ====================================================================== */
export const Btn = Object.freeze({
  RIGHT: 1, LEFT: 2, UP: 4, DOWN: 8, A: 16, B: 32, SELECT: 64, START: 128,
});

/* ========================================================================
 * 8. GAME STATE, EVENTS, INTERACTION  -- engine/index.js
 * ====================================================================== */
export const Mode = Object.freeze({ EXPLORER: 0, ARCHIVIST: 1 });   // 9-12 / 13-18

/** Event bits: engine clears game.events at the start of update(), sets them during it. */
export const EVT = Object.freeze({
  SCREEN_CHANGED: 1 << 0,  // crossed to another screen of the region
  FOOTPRINT:      1 << 1,  // new footprint = last element of game.footprints
  FACT:           1 << 2,  // entered a fact zone; id in game.pendingFact
  ON_PORTAL:      1 << 3,  // stepped onto hub portal (edge-triggered, never on spawn frame)
  ON_RETURN_PAD:  1 << 4,  // stepped onto region return pad (edge-triggered)
  HEADLAMP:       1 << 5,  // headlamp toggled
  SHADOW_CHANGED: 1 << 6,  // game.inShadow changed
  RCS_PUFF:       1 << 7,  // RCS fired, dir = game.player.thrustDir
  BRAKE:          1 << 8,  // SELECT brake in Deep Space
  LANDED:         1 << 9,  // hop touchdown
  BUMP:           1 << 10, // blocked by solid
});

export const GF = Object.freeze({ ENDING_UNLOCKED: 1, ENDING_SEEN: 2 });

/**
 * @typedef {Object} Player
 * @property {number} x  @property {number} y      region px, top-left of 16x16 sprite
 * @property {number} vx @property {number} vy     px/frame
 * @property {number} z  @property {number} vz     hop height px (>=0)
 * @property {number} facing      Dir
 * @property {number} thrustDir   Dir of last RCS puff
 * @property {number} anim        frame counter for walk/hop animation
 * @property {boolean} moving @property {boolean} airborne @property {boolean} thrusting @property {boolean} braking
 *
 * @typedef {Object} GameState            (engine exports the live singleton `game`)
 * -- persistent --
 * @property {number} blueprints     bitmask of Blueprint
 * @property {number} robotsTalked   bitmask of Robot
 * @property {number} archivesRead   bitmask of Archive
 * @property {number} mode           Mode
 * @property {number} flags          GF bits
 * -- session --
 * @property {number} region  @property {number} screen (0..3; hub 0)
 * @property {Player} player
 * @property {number} events  EVT bits  @property {number} frame
 * @property {boolean} headlampOn @property {boolean} inShadow
 * @property {number} pendingFact
 * @property {{tx:number,ty:number}[]} footprints
 * @property {{x:number,y:number,dx:number,dy:number}[]} dust   screen px, px/frame
 * @property {number} insightDustStep   0..INSIGHT_DUST_STEPS-1
 */

export const Interact = Object.freeze({ NONE: 0, ROBOT: 1, BLUEPRINT: 2, STATION: 3 });
/** findInteract() -> {type: Interact, id:number} | null  (STATION ids: STAR_MAP, ARCHIVE_COMPUTER, NOTEBOOK) */

export const Collect = Object.freeze({ ALREADY: 0, NEW: 1, COMPLETE: 2 }); // COMPLETE = new AND 10/10

/**
 * Engine API -- engine/index.js must export exactly:
 *
 *   game                               live GameState singleton (frontend reads it;
 *                                      mutates it ONLY via the functions below)
 *   init()                             defaults (Explorer, Hub, spawn)
 *   newGame()                          clear progress
 *   enterRegion(region)                spawn (hub: HUB.SPAWN; else below return pad), reset fx
 *   update(held, pressed)              one 60 Hz frame; Btn bitmasks
 *   getPhysics(region) -> PhysicsParams
 *   findInteract() -> {type,id}|null
 *   collectBlueprint(bp) -> Collect    autosaves; sets GF.ENDING_UNLOCKED at 10/10
 *   markRobotTalked(robot) / markArchiveRead(archive)
 *   setMode(mode)                      autosaves
 *   markEndingSeen()                   autosaves
 *   blueprintTotal() -> 0..10
 *   regionCollected(region) -> number
 *   completionPercent() -> 0..100
 *   isLit(tx, ty) -> boolean           false only for shadow tiles not lit by headlamp
 *   latencyStart(robot)                begins light-delay bar (0 frames if no latency);
 *                                      for ROBOT.INSIGHT also resets the dust gauge
 *   latencyTick() -> 0..LATENCY_BAR_STEPS   call once per frame; == max when done
 *   insightDustTick() -> step          call once per frame during InSight dialogue
 *   hasSave() -> boolean
 *   loadSave() -> boolean              localStorage -> persistent fields
 *   writeSave()                        persistent fields -> localStorage
 *   eraseSave()
 *   passwordEncode() -> string         6 chars
 *   passwordApply(str) -> boolean      validates, applies, saves
 */

/* ========================================================================
 * 9. SAVE & PASSWORD
 * localStorage key SAVE_KEY holds JSON {v, blueprints, robotsTalked,
 * archivesRead, mode, flags}. Password = 6 chars of PASSWORD_CHARSET
 * (32 symbols, 5 bits each = 30 bits): 10 bits blueprints | 6 bits robots |
 * 1 bit mode | 1 bit ENDING_SEEN | 12-bit checksum, bit-scrambled.
 * Deterministic; case-insensitive input.
 * ====================================================================== */
export const SAVE_KEY = 'abandoned-not-forgotten.save.v1';
export const PASSWORD_LEN = 6;
export const PASSWORD_CHARSET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no I O 0 1

/* ========================================================================
 * 10. SCENES (frontend-owned state machine; listed so gfx files share names)
 * ====================================================================== */
export const Scene = Object.freeze({
  TITLE: 'title', PASSWORD_ENTRY: 'passwordEntry', HUB: 'hub', PORTAL_MENU: 'portalMenu',
  REGION: 'region', DIALOGUE: 'dialogue', FACT_POPUP: 'factPopup',
  BLUEPRINT_CARD: 'blueprintCard', NOTEBOOK: 'notebook', STAR_MAP: 'starMap',
  ARCHIVE_COMPUTER: 'archiveComputer', PAUSE: 'pause', ENDING: 'ending',
});
