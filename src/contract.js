/**
 * contract.js -- ABANDONED BUT NOT FORGOTTEN - THE LAST TRANSMISSION
 *
 * SHARED CONTRACT between all modules. OWNED BY THE LEAD ARCHITECT.
 * The three engineers build in parallel against THIS FILE ALONE.
 * Subagents MUST NOT edit it. If you need a change, report it in your final
 * summary instead and code around it in your own folder in the meantime.
 *
 * Runtime: modern desktop browsers, vanilla ES modules, no build step, no npm
 * deps, keyboard only (no touch, no gamepad). Served by `npm start`
 * (tools/serve.mjs) at http://localhost:8080. Tests: `npm test` (node:test).
 *
 * Module graph (imports go ONE direction only):
 *
 *   src/main.js + src/ui/ + src/gfx/  ──>  src/engine/index.js  ──>  src/data/index.js
 *            └──────────────────────────────────────────────────────────^
 *                     everyone ──> src/contract.js, src/assets.js
 *
 *   src/data   (backend-engineer)   pure content + scene layout. Imports only
 *                                   contract.js (+ assets.js for AssetIds).
 *                                   No DOM, no state, no side effects.
 *   src/engine (engine-engineer)    rules, physics, triggers, prop simulations,
 *                                   progress, save. Imports contract.js + data.
 *                                   No DOM, no canvas; runs headless under Node 22.
 *                                   Only module touching localStorage, and only
 *                                   through a guarded `globalThis.localStorage`.
 *   src/gfx + src/ui + src/main.js  canvas renderer, HTML/CSS UI, keyboard,
 *   (frontend-engineer)             screens, effects, WebAudio. Only module that
 *                                   touches the DOM. Loads art ONLY via assets.js.
 *
 * `data/index.js` and `engine/index.js` are barrels and MUST export exactly the
 * names documented in sections 5 and 8.
 *
 * Coordinates: scene pixels, origin top-left, y down. Every scene is exactly one
 * CANVAS_W x CANVAS_H screen; there is no camera.
 * Units: px, seconds (fixed step DT), degrees for angles.
 */

/* ========================================================================
 * 0. IDENTITY
 * ====================================================================== */
export const GAME_TITLE = 'Abandoned but not Forgotten';
export const GAME_SUBTITLE = 'The Last Transmission';
export const GAME_FULL_TITLE = `${GAME_TITLE} - ${GAME_SUBTITLE}`;
export const PACKAGE_SLUG = 'abandoned-but-not-forgotten-the-last-transmission';

/* ========================================================================
 * 1. VIEW & TIME
 * One 360x180 (2:1) logical canvas (matches the Hub art), integer-scaled with crisp pixels.
 * The HTML/CSS UI overlays it. Scenes are single screens, no scrolling.
 * ====================================================================== */
export const CANVAS_W = 360;
export const CANVAS_H = 180;
export const FPS = 60;
export const DT = 1 / FPS;             // engine fixed step, seconds

/* ========================================================================
 * 2. IDS
 * ====================================================================== */
export const Region = Object.freeze({ HUB: 0, MOON: 1, MARS: 2 });
export const REGION_COUNT = 3;

/** Hub stations. EXPANSION_BAY is DECORATIVE: no menu, caption only. */
export const Station = Object.freeze({
  STAR_MAP: 0, PORTAL: 1, ARCHIVE_COMPUTER: 2, NOTEBOOK: 3, EXPANSION_BAY: 4,
});

export const Blueprint = Object.freeze({ LRV: 0, SOJOURNER: 1 });
export const BP_COUNT = 2;
export const BP_ALL_MASK = 0b11;
export const bpRegion = (bp) => (bp === Blueprint.LRV ? Region.MOON : Region.MARS);

export const Robot = Object.freeze({ LRV: 0, SOJOURNER: 1 });
export const ROBOT_COUNT = 2;
export const robotRegion = (r) => (r === Robot.LRV ? Region.MOON : Region.MARS);

/** Expansion packs and their catalog-only missions (Archive Computer roadmap). */
export const Pack = Object.freeze({ LUNAR_LEGACY: 0, MARTIAN_FRONTIERS: 1, DEEP_SPACE: 2 });
export const PACK_COUNT = 3;
export const Mission = Object.freeze({
  SURVEYOR3: 0, APOLLO_LM_DESCENT: 1, ALSEP: 2,                 // Pack.LUNAR_LEGACY
  PATHFINDER_AIRBAGS: 3, INSIGHT_SEIS: 4, INGENUITY: 5,          // Pack.MARTIAN_FRONTIERS
  NEAR_SHOEMAKER: 6, VOYAGER1: 7,                                // Pack.DEEP_SPACE
});
export const MISSION_COUNT = 8;
export const missionPack = (m) => (m < 3 ? Pack.LUNAR_LEGACY : m < 6 ? Pack.MARTIAN_FRONTIERS : Pack.DEEP_SPACE);

export const Mode = Object.freeze({ EXPLORER: 0, ARCHIVIST: 1 });   // ages 9-12 / 13-18

/** Walking surface -> footstep sound. One per scene (Scene.surface). */
export const Surface = Object.freeze({ WOOD: 'wood', REGOLITH: 'regolith', SAND: 'sand' });

/** Interactable hardware props painted into / overlaid on the scenes. */
export const Prop = Object.freeze({
  LRV_NAV: 0,      // Moon: nav console, odometer, EVA traverse replays
  LRV_BATTERY: 1,  // Moon: silver-zinc battery panel (reads 0%)
  LRV_CAMERA: 2,   // Moon: GCTA TV camera pan/tilt/zoom with Earth command delay
  LRV_FENDER: 3,   // Moon: taped-map fender repair, dust rooster tail
  SOJ_SOLAR: 4,    // Mars: 16 W GaAs panel vs sun angle and dust
  SOJ_APXS: 5,     // Mars: spectrometer deploy on a rock, timed integration
  SOJ_HAZARD: 6,   // Mars: 5 laser stripes + 2 cameras hazard scan
  SOJ_DRIVE: 7,    // Mars: waypoint command, SIGNAL bar, 1 cm/s rocker-bogie crawl
});
export const PROP_COUNT = 8;
export const propRegion = (p) => (p < 4 ? Region.MOON : Region.MARS);

/* ========================================================================
 * 3. TEXT RULES
 * Text is prose. The UI wraps it responsively; there is no fixed column grid.
 * ====================================================================== */
export const TEXT_MAX = 220;          // chars per dialogue/card page string
export const LABEL_MAX = 40;          // question labels, hotspot labels, telemetry labels
export const VALUE_MAX = 32;          // telemetry values
export const QUESTIONS_MIN = 5;       // per robot (plus the implicit "Goodbye")
export const QUESTIONS_MAX = 6;
export const FACTS_MIN = 3;           // fact pop-ups per expedition region
export const FACTS_MAX = 6;
/** All text is UTF-8 prose; keep to common punctuation so the pixel font renders it. */

/* ========================================================================
 * 4. GEOMETRY TYPES
 * ====================================================================== */
/** @typedef {{x:number, y:number, w:number, h:number}} Rect  scene px, top-left */
/** @typedef {{x:number, y:number}} Point */
export const Dir = Object.freeze({ DOWN: 0, UP: 1, LEFT: 2, RIGHT: 3 });

export const HotspotKind = Object.freeze({
  ROBOT: 'robot',          // ref = Robot. Press INTERACT -> Screen.DIALOGUE.
  BLUEPRINT: 'blueprint',  // ref = Blueprint. Press -> collectBlueprint -> Screen.BLUEPRINT_CARD.
  STATION: 'station',      // ref = Station (STAR_MAP, ARCHIVE_COMPUTER, NOTEBOOK). Press.
  PORTAL: 'portal',        // ref = 0. STEP ON -> EVT.ON_PORTAL -> Screen.PORTAL_MENU.
  RETURN_PAD: 'returnPad', // ref = 0. STEP ON -> EVT.ON_RETURN_PAD -> enterRegion(HUB).
  PROP: 'prop',            // ref = Prop. Press -> Screen.PROP_PANEL.
  DECOR: 'decor',          // ref = Station.EXPANSION_BAY or -1. Press -> caption only.
});
export const Trigger = Object.freeze({ PRESS: 'press', STEP: 'step' });

/**
 * @typedef {Object} Hotspot
 * @property {string}  id       unique within the scene, e.g. 'moon.lrv'
 * @property {string}  kind     HotspotKind
 * @property {Rect}    rect     interaction rect. For PRESS kinds the player's
 *                              hitbox must be within INTERACT_RANGE_PX of it.
 * @property {string}  trigger  Trigger
 * @property {number}  ref      id of the referenced thing (see HotspotKind)
 * @property {boolean} solid    true if the rect also blocks movement
 * @property {number}  [facing] Dir the player must face (omit = any)
 * @property {string}  label    <= LABEL_MAX, shown as the floating prompt
 * @property {string}  [caption] DECOR only: one line shown on press
 * @property {*}       [arg]    optional prop argument to preselect (e.g. APXS target index);
 *                              findInteract() passes it through unchanged
 */

/**
 * Fact pop-up zone. Fires once per region visit when the hitbox enters rect.
 * @typedef {Object} FactZone
 * @property {number} id        0-based, unique within the region
 * @property {Rect}   rect
 * @property {string} title     <= LABEL_MAX
 * @property {string} explorer  <= TEXT_MAX
 * @property {string} [archivist] <= TEXT_MAX, appended in Archivist mode
 */

/**
 * One painted scene. Exactly CANVAS_W x CANVAS_H.
 * @typedef {Object} SceneDef
 * @property {number}    region      Region
 * @property {string}    name        'NASA Archives' | 'Taurus-Littrow' | 'Ares Vallis'
 * @property {number}    w           == CANVAS_W
 * @property {number}    h           == CANVAS_H
 * @property {string}    background  AssetId (assets.js) of the scene image
 * @property {string}    surface     Surface (footstep sound)
 * @property {{x:number,y:number,facing:number}} spawn   player top-left + Dir
 * @property {Rect[]}    solids      walls, rocks, hardware bodies (blocks movement)
 * @property {Rect[]}    shadows     Moon only: pure black unless headlamp-lit
 * @property {Hotspot[]} hotspots
 * @property {FactZone[]} facts      [] for the Hub, FACTS_MIN..FACTS_MAX otherwise
 * @property {{x:number,y:number,w:number,h:number}} walkable  outer bounds the hitbox may occupy
 */

/* ========================================================================
 * 5. DATA API  -- src/data/index.js must export exactly these:
 *
 *   getScene(region)       -> SceneDef
 *   getBlueprint(id)       -> BlueprintCard
 *   getDialogue(robot)     -> Dialogue
 *   getCatalog()           -> MissionEntry[]   (MISSION_COUNT entries, by Mission id)
 *   getPackInfo(pack)      -> {pack, name, subtitle, missions:number[]}
 *   getRegionStats(region) -> RegionStats
 *   getStarMap()           -> StarMap
 *   getEnding()            -> Ending
 *   getPropSpec(prop)      -> PropSpec (shape per prop in section 9)
 *   getTitleText()         -> {tagline:string, continueLabel, newGameLabel, modeLabels:[string,string], modeBlurbs:[string,string]}
 *
 * All getters are pure and return frozen or fresh objects. Backend verifies
 * every fact against NASA sources and lists corrections in its summary.
 * ====================================================================== */

/**
 * @typedef {Object} BlueprintCard
 * @property {number} id            Blueprint
 * @property {string} name          'Lunar Roving Vehicle (LRV)'
 * @property {string} subsystem     'Mobility & Battery System'
 * @property {string} dates         'Apollo 17 - December 1972'
 * @property {string} schematic     AssetId of the wireframe image
 * @property {string[]} explorerPages  page 2 prose, both modes (1..3 strings <= TEXT_MAX)
 * @property {string[]} archivistPages Archivist-only extra pages (1..3)
 * @property {{label:string, value:string}[]} telemetry   Archivist table (mass, power, dates...)
 * @property {{label:string, value:string}[]} trueScale   real dimensions (rovers are drawn ~2x)
 */

/**
 * Pokemon-style question menu. Questions can be picked in any order and again.
 * "Goodbye" is implicit: the UI always appends it as the last menu entry.
 * Framing: this is the rover's LAST TRANSMISSION, its memories told before it
 * falls silent. Greeting text from the spec is used verbatim.
 * @typedef {Object} Question
 * @property {number}   id          index 0..QUESTIONS_MAX-1 (bit in game.asked[robot])
 * @property {string}   label       <= LABEL_MAX (menu text; may be a shortened form)
 * @property {string}   [prompt]    full question wording verbatim from the spec, when
 *                                  it is longer than LABEL_MAX (shown as the asked line)
 * @property {string[]} answer      1..4 pages <= TEXT_MAX
 * @property {string[]} archivist   0..2 extra pages shown after answer in Archivist mode
 *
 * @typedef {Object} Dialogue
 * @property {number}   robot       Robot
 * @property {string}   name        'LRV-3' / 'Sojourner'
 * @property {string}   location    'Taurus-Littrow, Moon'
 * @property {string}   portrait    AssetId
 * @property {boolean}  latency     true => SIGNAL bar before every answer (Sojourner)
 * @property {string[]} greeting    first-time greeting pages (spec wording)
 * @property {string[]} greetingAgain  shorter pages on later visits
 * @property {Question[]} questions QUESTIONS_MIN..QUESTIONS_MAX
 * @property {string[]} goodbye     1..2 pages, the "last transmission" sign-off
 */

/**
 * @typedef {Object} MissionEntry
 * @property {number} id        Mission
 * @property {number} pack      Pack
 * @property {string} name      'Surveyor 3 Scoop & Camera'
 * @property {string} body      'Moon'
 * @property {string} site      'Oceanus Procellarum'
 * @property {string} dates     '1967'
 * @property {string} icon      AssetId
 * @property {string} summary   <= TEXT_MAX
 * @property {string} archivist <= TEXT_MAX
 */

/**
 * @typedef {Object} RegionStats     (Notebook + ending comparison + portal menu)
 * @property {number} region
 * @property {string} name          'The Moon'
 * @property {string} site          'Taurus-Littrow'
 * @property {number} gravityG      0.166
 * @property {number} gravityMps2   1.62
 * @property {string} atmosphere    'none (airless regolith)'
 * @property {string} rover         'LRV - battery-powered, crewed'
 * @property {{label:string, value:string}[]} rows   extra comparison rows
 */

/** @typedef {{bodies:{id:string, name:string, x:number, y:number, r:number, color:string,
 *   beacons:{label:string, region?:number, pack?:number, locked:boolean}[]}[]}} StarMap
 *  x,y,r are fractions 0..1 of the map panel. */

/**
 * @typedef {Object} Ending
 * @property {{label:string, moon:string, mars:string}[]} comparison
 * @property {{art:string, caption:string}[]} montage   exactly 2: LRV, Sojourner
 * @property {string[]} closing   the spec's closing quote, 2 pages
 */

/* ========================================================================
 * 6. PHYSICS
 * Scale is anchored on the 24x24 astronaut sprite = a 2.0 m suited astronaut,
 * so PX_PER_M = 12. TIME_SCALE compresses time so a 360 px scene is crossed in
 * ~7 s; it multiplies velocities once and accelerations twice, so hop HEIGHTS
 * are physically exact in px and the Moon/Mars ratios are the real ones.
 *
 *   gPx(r)     = G_MPS2[r] * PX_PER_M * TIME_SCALE^2        px/s^2
 *   walkPx(r)  = WALK_MPS[r] * PX_PER_M * TIME_SCALE        px/s
 *   vz0        = HOP_TAKEOFF_MPS * PX_PER_M * TIME_SCALE    px/s
 *   hopHeight  = vz0^2 / (2 gPx)      hopAirtime = 2 vz0 / gPx
 *
 *   Region  g(m/s^2)  gPx     walk px/s  hop height  airtime   hop length
 *   HUB     9.81      735.8   42.0       no hop      -         -
 *   MOON    1.62      121.5   39.0       8.3 px      0.74 s    ~29 px
 *   MARS    3.72      279.0   48.0       3.6 px      0.32 s    ~15 px
 *   Moon/Mars height ratio = 3.72/1.62 = 2.30
 *
 * Hops are AUTOMATIC: while moving on a hop region, the player takes off again
 * on the frame after landing. No jump key. The engine may tune WALK and
 * HOP_TAKEOFF by +/-25% for feel but must keep gPx exact.
 * ====================================================================== */
export const PX_PER_M = 12;
export const TIME_SCALE = 2.5;
export const G_MPS2 = Object.freeze({ [Region.HUB]: 9.81, [Region.MOON]: 1.62, [Region.MARS]: 3.72 });
export const GRAVITY_G = Object.freeze({ [Region.HUB]: 1.0, [Region.MOON]: 0.166, [Region.MARS]: 0.38 });
export const WALK_MPS = Object.freeze({ [Region.HUB]: 1.4, [Region.MOON]: 1.3, [Region.MARS]: 1.6 });
export const HOP_TAKEOFF_MPS = 1.5;
export const HOP_REGIONS = Object.freeze([Region.MOON, Region.MARS]);

export const gPx = (region) => G_MPS2[region] * PX_PER_M * TIME_SCALE * TIME_SCALE;
export const walkPx = (region) => WALK_MPS[region] * PX_PER_M * TIME_SCALE;
export const hopTakeoffPx = () => HOP_TAKEOFF_MPS * PX_PER_M * TIME_SCALE;
export const hopHeightPx = (region) => (hopTakeoffPx() ** 2) / (2 * gPx(region));
export const hopAirtimeS = (region) => (2 * hopTakeoffPx()) / gPx(region);

/** @typedef {{maxSpeed:number, accel:number, friction:number, gravityZ:number, hopImpulse:number, hop:boolean, dust:boolean, shadows:boolean, latency:boolean, surface:string}} PhysicsParams
 *  accel/friction: px/s^2 toward target velocity (engine-owned seeds below). */
export const PHYSICS_DEFAULTS = Object.freeze({
  [Region.HUB]:  { maxSpeed: walkPx(Region.HUB),  accel: 600, friction: 600, gravityZ: gPx(Region.HUB),  hopImpulse: 0,              hop: false, dust: false, shadows: false, latency: false, surface: Surface.WOOD },
  [Region.MOON]: { maxSpeed: walkPx(Region.MOON), accel: 260, friction: 160, gravityZ: gPx(Region.MOON), hopImpulse: hopTakeoffPx(), hop: true,  dust: false, shadows: true,  latency: false, surface: Surface.REGOLITH },
  [Region.MARS]: { maxSpeed: walkPx(Region.MARS), accel: 420, friction: 360, gravityZ: gPx(Region.MARS), hopImpulse: hopTakeoffPx(), hop: true,  dust: true,  shadows: false, latency: true,  surface: Surface.SAND },
});

/** Player sprite 24x24 (Artwork/Sprites/Astronaut). Position = top-left. Hitbox = feet. */
export const PLAYER = Object.freeze({ W: 24, H: 24, HIT_X: 6, HIT_Y: 16, HIT_W: 12, HIT_H: 8 });
export const INTERACT_RANGE_PX = 8;

/** Headlamp: radial cone from the player's center in the facing direction,
 *  plus a small ambient circle. Moon shadows are black outside it. */
export const HEADLAMP = Object.freeze({ RADIUS_PX: 72, CONE_DEG: 70, AMBIENT_PX: 12 });

/** Mars dust is a pure visual (frontend-owned); these are its seed parameters. */
export const DUST = Object.freeze({ COUNT: 40, WIND_PX_S: [-22, -5], DRIFT_PX_S: 6, COLORS: ['#c1440e', '#e07a3a', '#8c3a14'] });

/** Earth-Mars one-way light time, shown as "SIGNAL ~11 min". Compressed to
 *  GAUGE_REAL_S of real time. Archivist page notes it varied (~10.6 min at landing). */
export const LATENCY = Object.freeze({
  ONE_WAY_S: 684, ROUND_TRIP_S: 1368, GAUGE_REAL_S: 2.0, LABEL: 'SIGNAL ~11 min', LABEL_ROUND_TRIP: '~22 min round trip',
});

/* ========================================================================
 * 7. INPUT  (frontend maps keys -> these bits; engine consumes them)
 *   W/Up, S/Down, A/Left, D/Right = movement (WASD primary, arrows secondary)
 *   Space / Enter / E = INTERACT    N / B = NOTEBOOK
 *   P / Esc = PAUSE                 F = HEADLAMP
 * The frontend calls engine.update() ONLY while Screen.HUB or Screen.REGION is
 * active. Menu navigation is handled by the frontend, not the engine.
 * ====================================================================== */
export const Btn = Object.freeze({
  RIGHT: 1, LEFT: 2, UP: 4, DOWN: 8, INTERACT: 16, NOTEBOOK: 32, PAUSE: 64, HEADLAMP: 128,
});

/* ========================================================================
 * 8. ENGINE  -- src/engine/index.js
 * ====================================================================== */

/** Event bits: cleared at the start of update(), set during it. */
export const EVT = Object.freeze({
  LANDED:           1 << 0,  // hop touchdown (footstep thump on hop regions)
  STEP:             1 << 1,  // walk-cycle footstep tick (non-hop regions: every STEP_INTERVAL_S)
  BUMP:             1 << 2,  // blocked by a solid this frame
  ON_PORTAL:        1 << 3,  // stepped onto the hub portal (edge, never on spawn frame)
  ON_RETURN_PAD:    1 << 4,  // stepped onto a region return pad (edge)
  HEADLAMP:         1 << 5,  // headlamp toggled
  SHADOW_CHANGED:   1 << 6,  // game.inShadow changed
  ENTERED_HOTSPOT:  1 << 7,  // game.nearHotspot became non-null / changed
  LEFT_HOTSPOT:     1 << 8,  // game.nearHotspot became null
  FACT:             1 << 9,  // entered an unseen fact zone; id in game.pendingFact
  LATENCY_DONE:     1 << 10, // SIGNAL bar reached 1.0 this frame
  PROP_CHANGED:     1 << 11, // some prop state changed in a UI-relevant way
  BLUEPRINT_COMPLETE: 1 << 12, // collectBlueprint reached 2/2 (ending unlocked)
});
export const STEP_INTERVAL_S = 0.32;   // Hub footstep cadence at full speed

export const GF = Object.freeze({ ENDING_UNLOCKED: 1, ENDING_SEEN: 2, INTRO_SEEN: 4 });
export const Collect = Object.freeze({ ALREADY: 0, NEW: 1, COMPLETE: 2 }); // COMPLETE = NEW and 2/2

/**
 * @typedef {Object} Player
 * @property {number} x  @property {number} y     scene px, top-left of the 24x24 sprite
 * @property {number} vx @property {number} vy    px/s
 * @property {number} z  @property {number} vz    hop height px (>= 0), px/s
 * @property {number} facing     Dir
 * @property {number} anim       seconds spent moving (frontend derives bob/walk phase)
 * @property {boolean} moving @property {boolean} airborne
 *
 * @typedef {Object} LatencyState
 * @property {boolean} active  @property {number} progress 0..1  @property {number} elapsed seconds
 *
 * @typedef {Object} GameState            (engine exports the live singleton `game`)
 * -- persistent (saved) --
 * @property {number} blueprints     bitmask of Blueprint
 * @property {number} robotsTalked   bitmask of Robot
 * @property {number[]} asked        per Robot: bitmask of Question ids asked at least once
 * @property {number} mode           Mode
 * @property {number} flags          GF bits
 * -- session --
 * @property {number} region
 * @property {Player} player
 * @property {number} events         EVT bits for this frame
 * @property {number} frame  @property {number} time   frames / seconds since init
 * @property {boolean} headlampOn @property {boolean} inShadow
 * @property {Hotspot|null} nearHotspot   PRESS hotspot currently in range (prompt target)
 * @property {number} pendingFact    FactZone id awaiting acknowledge, or -1
 * @property {number} factsSeen      bitmask of FactZone ids seen this visit
 * @property {LatencyState} latency
 * @property {Object<number, PropState>} props   per Prop (see section 9), created lazily
 */

/**
 * Engine API -- engine/index.js must export exactly:
 *
 *   game                                live GameState singleton (frontend reads it and
 *                                       mutates it ONLY through the functions below)
 *   init()                              defaults: Explorer, Hub, spawn; calls loadSave() if hasSave()
 *   newGame(mode)                       clears progress, sets mode, writes save, enters Hub
 *   enterRegion(region)                 spawn at getScene(region).spawn, reset session fx,
 *                                       clear factsSeen, headlamp off, latency idle
 *   update(held, pressed)               one fixed DT step; Btn bitmasks (held = down now,
 *                                       pressed = went down this frame). Handles movement,
 *                                       auto-hop, collision with solids + solid hotspots +
 *                                       walkable bounds, STEP triggers, nearHotspot,
 *                                       headlamp toggle, fact zones, latency tick, props tick.
 *                                       INTERACT is NOT consumed by update(): the frontend
 *                                       calls findInteract() itself when INTERACT is pressed.
 *   getPhysics(region) -> PhysicsParams
 *   findInteract() -> Hotspot|null      the PRESS hotspot in range and faced (== nearHotspot)
 *   collectBlueprint(bp) -> Collect     autosaves; sets GF.ENDING_UNLOCKED and EVT.BLUEPRINT_COMPLETE at 2/2
 *   markRobotTalked(robot)              autosaves
 *   markAsked(robot, questionId)        autosaves; hasAsked(robot, questionId) -> boolean
 *   setMode(mode) / toggleMode()        autosaves
 *   markIntroSeen() / markEndingSeen()  autosaves
 *   completion() -> {count, total: BP_COUNT, percent}
 *   isLit(x, y) -> boolean              false only for points inside a shadow rect that
 *                                       are not inside the headlamp cone/ambient circle
 *   headlampCone() -> {x, y, dir, angleDeg, radius, coneDeg, ambient, on}
 *                                       x,y = player center; angleDeg = facing (0 right, 90 down)
 *   latencyStart()                      begins the SIGNAL bar (LATENCY.GAUGE_REAL_S of real
 *                                       time); latencyTick(dt) advances it when update() is
 *                                       not running (dialogue is a UI screen) -> progress 0..1
 *   latencyProgress() -> 0..1  latencyActive() -> boolean
 *   acknowledgeFact()                   clears pendingFact
 *   propOpen(prop) -> PropState         creates/returns state; marks it open
 *   propAction(prop, action, arg) -> PropState   see section 9 actions
 *   propTick(prop, dt) -> PropState     advance a prop sim while its panel is open
 *   propClose(prop)                     marks closed (state persists for the session)
 *   propState(prop) -> PropState|null   read without side effects
 *   hasSave() -> boolean
 *   loadSave() -> boolean               localStorage -> persistent fields (validates SAVE_VERSION)
 *   writeSave()                         persistent fields -> localStorage (no-op if unavailable)
 *   eraseSave()
 */

/* ========================================================================
 * 9. PROPS: real hardware behavior
 * Data supplies PropSpec (verified numbers). Engine owns PropState and the
 * simulation. Frontend draws the panel (Screen.PROP_PANEL) and scene overlays.
 * All PropState objects carry {prop, open:boolean, changed:boolean}.
 * ====================================================================== */
export const PropAction = Object.freeze({
  // LRV_NAV: EVA traverse replay on the nav console mini-map
  NAV_SELECT: 'navSelect',     // arg = eva index 0..2
  NAV_PLAY: 'navPlay', NAV_PAUSE: 'navPause', NAV_RESET: 'navReset',
  // LRV_BATTERY: static readout; LOAD_TEST shows what one EVA would have drawn
  BAT_LOAD_TEST: 'batLoadTest',
  // LRV_CAMERA (GCTA): commands are queued and executed after the Earth delay
  CAM_PAN: 'camPan',           // arg = -1 | +1 (degrees step per command: spec.panStepDeg)
  CAM_TILT: 'camTilt',         // arg = -1 | +1
  CAM_ZOOM: 'camZoom',         // arg = -1 | +1
  CAM_LIFTOFF: 'camLiftoff',   // replay the pre-timed liftoff tilt sequence
  // LRV_FENDER
  FENDER_TOGGLE: 'fenderToggle',   // show wheel spinning with / without the repaired fender
  // SOJ_SOLAR
  SOLAR_PLAY: 'solarPlay', SOLAR_PAUSE: 'solarPause', SOLAR_SET_SOL: 'solarSetSol', // arg = sol 1..83
  // SOJ_APXS
  APXS_DEPLOY: 'apxsDeploy',   // arg = target index into spec.targets
  APXS_ABORT: 'apxsAbort',
  // SOJ_HAZARD
  HAZ_SCAN: 'hazScan',
  // SOJ_DRIVE: HISTORICAL TRAVERSE REPLAY. Sojourner has been silent since its last
  // contact (Sept 27, 1997) and NEVER moves in the game; the panel replays its real
  // 1997 drives on a mini-map, like LRV_NAV.
  DRIVE_SELECT: 'driveSelect', // arg = leg index into spec.legs
  DRIVE_PLAY: 'drivePlay', DRIVE_PAUSE: 'drivePause', DRIVE_RESET: 'driveReset',
});

/**
 * PropSpec shapes returned by data.getPropSpec(prop). Every string <= TEXT_MAX.
 * Numbers are REAL values; backend verifies them and notes any correction.
 *
 * LRV_NAV {
 *   prop, title, blurb, archivist,
 *   odometerKm: 35.7, maxRangeFromLmKm: 7.6, navSystem: string,
 *   lm: Point (minimap fraction 0..1),
 *   evas: [{ id, label, dateUtc, distanceKm, durationMin, maxRangeKm,
 *            path: Point[] (minimap fractions, >= 4 points),
 *            stations: [{name, at:number (0..1 along path)}] }] x3
 * }
 * LRV_BATTERY {
 *   prop, title, blurb, archivist,
 *   count: 2, voltageV: 36, capacityAh: 121, chemistry: 'silver-zinc', rechargeable: false,
 *   energyWh: number, motors: {count: 4, hp: 0.25, watts: number (per motor)}, topSpeedKmh: 18 (recorded),
 *   [designSpeedKmh]: 13,
 *   evaDrawWh: number[] (per EVA, for the load test), whyDead: string
 *   chargeHistory: [{ label, dateUtc, pct (0..100, both packs combined), estimated: boolean }]
 *     battery charge over time for the panel's graph: 100% before EVA-1, after each
 *     EVA (Dec 11-13, 1972), then the long discharge to today's 0%. Points that are
 *     derived rather than from telemetry MUST set estimated: true (drawn dashed).
 * }
 * LRV_CAMERA {
 *   prop, title, blurb, archivist,
 *   panMinDeg, panMaxDeg, tiltMinDeg, tiltMaxDeg, zoomMin: 1, zoomMax: 6,
 *   panStepDeg, tiltStepDeg, commandDelayS: 1.3 (one-way Earth-Moon light time),
 *   liftoffUtc: string, liftoffSequence: [{atS:number, tiltDeg:number}] (the pre-timed tilt-up),
 *   operator: string
 * }
 * LRV_FENDER {
 *   prop, title, blurb, archivist,
 *   brokenDate, fixDate, fixMaterials: string, wheelDiameterCm: 81.8, wheelMaterial: string,
 *   dustWithoutFender: string, dustWithFender: string
 * }
 * SOJ_SOLAR {
 *   prop, title, blurb, archivist,
 *   panelW: 16, panelAreaM2, cellType: 'GaAs', batteryChemistry: 'LiSOCl2', batteryRechargeable: false,
 *   solHours: 24.66, dustLossPerSol: number (fraction), missionSols: 83, plannedSols: 7,
 *   nightPowerSource: string
 * }
 * SOJ_APXS {
 *   prop, title, blurb, archivist,
 *   integrationHours: number (~10), targets: [{ id, name:'Barnacle Bill'|'Yogi'|..., sol:number|null, [sols]:string (display),
 *     rockType: string, composition: [{element:string, pct:number}], finding: string }] (>= 2)
 * }
 * SOJ_HAZARD {
 *   prop, title, blurb, archivist,
 *   laserStripes: 5, cameras: 2, wheelDiameterCm: 13, hazardHeightCm: number,
 *   scanRangeCm: number, decision: string (how the onboard computer chose a detour),
 *   obstacles: Rect[] (scene px rock rects near the rover used by the scan)
 *   The scan is a demonstration of the 1997 system: the parked rover does NOT turn or move.
 * }
 * SOJ_DRIVE {
 *   prop, title, blurb, archivist,
 *   maxSpeedCmS: 1, totalTraverseM: number (~100), maxFromLanderM: number,
 *   landerPos: Point (scene px), commandNote: string,
 *   lastContactUtc: '1997-09-27', fate: string (contingency mode, never heard again; verified wording),
 *   lander: Point (minimap fraction 0..1),
 *   legs: [{ id, label, sols: string, distanceM, path: Point[] (minimap fractions, >= 2),
 *            stops: [{name, at:number (0..1 along path)}] }] (>= 3; traced shapes may be
 *            approximate and must be labelled so in archivist text)
 * }
 */

/**
 * PropState shapes (engine). Angles deg, times s, progress 0..1.
 *
 * LRV_NAV     { evaIndex, playing, t (0..1 along path), pos:Point, headingDeg,
 *               bearingToLmDeg, rangeToLmKm, distanceKm, batteryPct, station:string|null }
 * LRV_BATTERY { chargePct: 0, voltageV: 0, loadTest:{running, evaIndex, drawnWh, remainingPct} }
 * LRV_CAMERA  { panDeg, tiltDeg, zoom, queue:[{action, arg, fireAt}], nextFireIn,
 *               liftoff:{running, t, frame} }
 * LRV_FENDER  { fenderOn, wheelAngleDeg, dustIntensity (0..1) }
 * SOJ_SOLAR   { playing, sol, solTime (0..1), sunElevDeg, dustFactor, powerW, onBattery }
 * SOJ_APXS    { targetIndex, deployed, progress, result:{name, rockType, composition, finding}|null }
 * SOJ_HAZARD  { scanning, progress, stripes:[{hit, distPx}] x5, hazard, detour:'left'|'right'|null }
 *               (detour = what the 1997 software WOULD choose; the rover never turns)
 * SOJ_DRIVE   { legIndex, playing, t (0..1 along leg), pos:Point (minimap fraction),
 *               headingDeg, rangeToLanderM, distanceM, sol:string, stop:string|null }
 *   The rover sprite is ALWAYS drawn at the 'mars.sojourner' hotspot; it never moves.
 */

/* ========================================================================
 * 10. SAVE
 * localStorage[SAVE_KEY] = JSON { v: SAVE_VERSION, blueprints, robotsTalked,
 * asked:[n,n], mode, flags }. Written on every progress/mode change. There is
 * no password. Missing or malformed data => hasSave() false.
 * ====================================================================== */
export const SAVE_KEY = 'abandoned_not_forgotten_save_v1';
export const SAVE_VERSION = 1;

/* 10b. ADDITIONS (2026-11-15). Both are backward-compatible: old saves without these fields stay valid.
 *
 * FACT LOG: every fact pop-up the player has seen is remembered for the Notebook's "Facts" list.
 *   Save JSON gains an optional field `factsLog: string[]` of keys `${region}:${factId}`, in order seen, no duplicates.
 *   The engine appends the key when EVT.FACT fires (the pause box still shows as before) and autosaves.
 *   engine.factsLog() -> [{region, id}]   read-only; the frontend resolves the text through
 *   data.getScene(region).facts.find(f => f.id === id).
 *
 * SETTINGS: player preferences, stored under their OWN key so they work before any New Game
 *   and never make hasSave() true.
 *   localStorage[SETTINGS_KEY] = JSON { muted: boolean, reduceFlashing: boolean }
 *   engine.getSettings() -> {muted, reduceFlashing}   defaults {muted:false, reduceFlashing:false}
 *   engine.setSetting(name, value)                     persists immediately (guarded like the save)
 *   Effective reduce-flashing = settings.reduceFlashing OR the system's prefers-reduced-motion
 *   (computed by the frontend; safety-first: an OS reduce-motion preference always wins).
 */
export const SETTINGS_KEY = 'abandoned_not_forgotten_settings_v1';
export const SETTINGS_DEFAULTS = Object.freeze({ muted: false, reduceFlashing: false });

/** Dialogue typewriter speed: medium, Pokemon-like. The first Space finishes the line; the second continues. */
export const TEXT_CPS = 40;

/* ========================================================================
 * 11. AUDIO IDS  (frontend synthesizes with WebAudio; assets.js AUDIO slots
 * may override any id with a real file). Mute toggle in pause menu + HUD.
 * ====================================================================== */
export const Sfx = Object.freeze({
  STEP_WOOD: 'step_wood',       // Hub
  STEP_SAND: 'step_sand',       // Mars
  STEP_SUIT: 'step_suit',       // Moon: muffled suit thump heard inside the helmet
  BREATH: 'breath',             // Moon: slow breathing loop while on the surface
  TALK_LRV: 'talk_lrv',         // blip per character group while LRV speaks
  TALK_SOJ: 'talk_soj',
  CONFIRM: 'confirm', CANCEL: 'cancel', CURSOR: 'cursor',
  SCAN: 'scan', BLUEPRINT_GET: 'blueprint_get',
  STATION_COMPUTER: 'station_computer', STATION_STARMAP: 'station_starmap',
  NOTEBOOK: 'notebook', PORTAL: 'portal', RETURN_PAD: 'return_pad',
  FACT: 'fact', HEADLAMP: 'headlamp',
  SIGNAL_TICK: 'signal_tick', SIGNAL_DONE: 'signal_done',
  PROP_OPEN: 'prop_open', PROP_ACTION: 'prop_action',
  PAUSE: 'pause', ENDING: 'ending',
});

/* ========================================================================
 * 12. SCREENS (frontend-owned state machine; listed so ui files share names)
 * TITLE: Continue (only if hasSave()), New Game, mode picker. Art from assets.js.
 * PAUSE: Resume, Explorer/Archivist, Mute, Quit to title. HUD button toggles mode directly.
 * ====================================================================== */
export const Screen = Object.freeze({
  TITLE: 'title', HUB: 'hub', PORTAL_MENU: 'portalMenu', REGION: 'region',
  DIALOGUE: 'dialogue', FACT_POPUP: 'factPopup', BLUEPRINT_CARD: 'blueprintCard',
  PROP_PANEL: 'propPanel', NOTEBOOK: 'notebook', STAR_MAP: 'starMap',
  ARCHIVE_COMPUTER: 'archiveComputer', PAUSE: 'pause', ENDING: 'ending',
});
