/**
 * assets.js -- ASSET MANIFEST. OWNED BY THE LEAD ARCHITECT.
 *
 * Every piece of art and sound the game can show or play has a slot here.
 * Art lives in `Artwork/` (the user's folder; agents never write there).
 *
 * Rules for the frontend loader:
 *   - Try `src`. If the file is missing or fails to decode, generate a
 *     PLACEHOLDER canvas of exactly w x h (times frames in `layout`) filled with
 *     placeholder.color, a 1px outline, and placeholder.label drawn in it.
 *   - Never crash on a missing file; never hard-code a path outside this file.
 *   - Dropping a correctly named PNG into Artwork/ must replace its placeholder
 *     with no code change.
 *   - Sprite sheets are strips: layout 'h' = frames side by side (sheet width
 *     = w * frames), 'v' = stacked (sheet height = h * frames). frames = 1 => single image.
 *
 * Rules for the backend: reference art only by AssetId (the keys of ASSETS).
 *
 * The astronaut slots point at REAL files (verified 24x24 RGBA). Everything
 * else is a placeholder until the user drops the art in. Canvas is 320x180.
 * See assets/README.md for the artist brief.
 */

/** @typedef {{src:string, w:number, h:number, frames:number, layout:'h'|'v', kind:string, placeholder:{color:string, label:string}, note?:string}} AssetSlot */

const A = 'Artwork/';

export const ASSETS = Object.freeze({
  /* ---- Astronaut (REAL FILES). One frame per facing; walk bob, hop lift and
   *      ground shadow are animated in code. ---- */
  astro_front: { src: `${A}Sprites/Astronaut/astronaut_front.png`, w: 24, h: 24, frames: 1, layout: 'h', kind: 'sprite', placeholder: { color: '#e6edf5', label: 'F' } },
  astro_back:  { src: `${A}Sprites/Astronaut/astronaut_back.png`,  w: 24, h: 24, frames: 1, layout: 'h', kind: 'sprite', placeholder: { color: '#e6edf5', label: 'B' } },
  astro_left:  { src: `${A}Sprites/Astronaut/astronaut_left.png`,  w: 24, h: 24, frames: 1, layout: 'h', kind: 'sprite', placeholder: { color: '#e6edf5', label: 'L' } },
  astro_right: { src: `${A}Sprites/Astronaut/astronaut_right.png`, w: 24, h: 24, frames: 1, layout: 'h', kind: 'sprite', placeholder: { color: '#e6edf5', label: 'R' } },

  /* ---- Scenes: full 320x180 backgrounds with props painted in.
   *      Artwork/Scenes/ is empty as of 2026-11-14; filenames below are the
   *      expected ones. ---- */
  scene_hub:  { src: `${A}Scenes/The Hub (INTERACTIVE).png`, w: 360, h: 180, frames: 1, layout: 'h', kind: 'scene', placeholder: { color: '#0b3d91', label: 'NASA ARCHIVES HUB' } },
  scene_moon: { src: `${A}Scenes/moon_taurus_littrow.png`, w: 360, h: 180, frames: 1, layout: 'h', kind: 'scene', placeholder: { color: '#5a5e66', label: 'MOON - TAURUS-LITTROW' } },
  scene_mars: { src: `${A}Scenes/mars_location.png`,        w: 360, h: 180, frames: 1, layout: 'h', kind: 'scene', placeholder: { color: '#9a4a1e', label: 'MARS - ARES VALLIS' } },

  /* ---- Title screen (art supplied by the user; buttons coded by frontend).
   *      Button strips: 3 states stacked vertically = normal, focused, pressed. ---- */
  title_bg:            { src: `${A}UI/title_bg.png`,            w: 360, h: 180, frames: 1, layout: 'v', kind: 'scene',  placeholder: { color: '#061a3a', label: 'TITLE' } },
  title_logo:          { src: `${A}UI/title_logo.png`,          w: 240, h: 64,  frames: 1, layout: 'v', kind: 'ui',     placeholder: { color: '#0b3d91', label: 'ABANDONED BUT NOT FORGOTTEN / THE LAST TRANSMISSION' }, note: 'optional if the logo is painted into title_bg' },
  btn_continue:        { src: `${A}UI/btn_continue.png`,        w: 96,  h: 18,  frames: 3, layout: 'v', kind: 'button', placeholder: { color: '#1f4e9a', label: 'CONTINUE' } },
  btn_new_game:        { src: `${A}UI/btn_new_game.png`,        w: 96,  h: 18,  frames: 3, layout: 'v', kind: 'button', placeholder: { color: '#1f4e9a', label: 'NEW GAME' } },
  btn_mode_explorer:   { src: `${A}UI/btn_mode_explorer.png`,   w: 96,  h: 18,  frames: 3, layout: 'v', kind: 'button', placeholder: { color: '#2a7a4b', label: 'EXPLORER 9-12' } },
  btn_mode_archivist:  { src: `${A}UI/btn_mode_archivist.png`,  w: 96,  h: 18,  frames: 3, layout: 'v', kind: 'button', placeholder: { color: '#7a4b2a', label: 'ARCHIVIST 13-18' } },
  btn_mode_selected:   { src: `${A}UI/btn_mode_selected.png`,   w: 96,  h: 18,  frames: 1, layout: 'v', kind: 'ui',     placeholder: { color: '#ffd166', label: '' }, note: 'overlay frame drawn on the currently chosen mode button' },

  /* ---- Robot portraits: 2 frames side by side (idle, talking). ---- */
  portrait_lrv:       { src: `${A}Sprites/Robots/lrv_portrait.png`,       w: 48, h: 48, frames: 2, layout: 'h', kind: 'portrait', placeholder: { color: '#8d939c', label: 'LRV' } },
  portrait_sojourner: { src: `${A}Sprites/Robots/sojourner_portrait.png`, w: 48, h: 48, frames: 2, layout: 'h', kind: 'portrait', placeholder: { color: '#c1440e', label: 'SOJ' } },

  /* ---- Rover overlays (drawn over the scene at ~2x hero scale).
   *      LRV may be painted into the Moon background, but its TV camera head is a
   *      separate sprite so it can pan. Sojourner must NOT be painted into the Mars
   *      background: it is a sprite so it can crawl. ---- */
  lrv_gcta:        { src: `${A}Sprites/Robots/lrv_gcta.png`,        w: 12, h: 12, frames: 8, layout: 'h', kind: 'sprite', placeholder: { color: '#cfd4da', label: 'C' }, note: '8 pan frames, 45 deg apart, starting facing right' },
  lrv_wheel:       { src: `${A}Sprites/Robots/lrv_wheel.png`,       w: 12, h: 12, frames: 4, layout: 'h', kind: 'sprite', placeholder: { color: '#b8bec6', label: 'W' }, note: 'wire-mesh wheel, 4 rotation frames (fender demo)' },
  lrv_fender:      { src: `${A}Sprites/Robots/lrv_fender.png`,      w: 16, h: 8,  frames: 2, layout: 'h', kind: 'sprite', placeholder: { color: '#d9dde2', label: 'FE' }, note: 'frame 0 original fender, frame 1 taped-map repair' },
  sojourner_body:  { src: `${A}Sprites/Robots/sojourner.png`,       w: 24, h: 14, frames: 2, layout: 'h', kind: 'sprite', placeholder: { color: '#d8a24a', label: 'SOJ' }, note: 'frame 0 level, frame 1 rocker-bogie tilted over a rock; facing right, flipped in code' },
  sojourner_apxs:  { src: `${A}Sprites/Robots/sojourner_apxs.png`,  w: 8,  h: 8,  frames: 2, layout: 'h', kind: 'sprite', placeholder: { color: '#e0c38a', label: 'X' }, note: 'APXS head stowed / deployed' },
  pathfinder_lander: { src: `${A}Sprites/Robots/pathfinder_lander.png`, w: 48, h: 28, frames: 1, layout: 'h', kind: 'sprite', placeholder: { color: '#b07a4a', label: 'PATHFINDER' }, note: 'optional scenery if not painted into the Mars background' },

  /* ---- Blueprint schematics: wireframe on transparent, drawn on the UI's grid. ---- */
  schematic_lrv:       { src: `${A}Blueprints/lrv_schematic.png`,       w: 160, h: 100, frames: 1, layout: 'h', kind: 'schematic', placeholder: { color: '#0b3d91', label: 'LRV SCHEMATIC' } },
  schematic_sojourner: { src: `${A}Blueprints/sojourner_schematic.png`, w: 160, h: 100, frames: 1, layout: 'h', kind: 'schematic', placeholder: { color: '#0b3d91', label: 'SOJOURNER SCHEMATIC' } },

  /* ---- Hub station glows: optional 2-frame overlays (idle, active) if the
   *      stations are painted into hub.png and need a highlight. ---- */
  station_star_map:      { src: `${A}Scenes/hub_stations/star_map.png`,      w: 32, h: 32, frames: 2, layout: 'h', kind: 'sprite', placeholder: { color: '#2b6cb0', label: 'MAP' } },
  station_portal:        { src: `${A}Scenes/hub_stations/portal.png`,        w: 40, h: 24, frames: 2, layout: 'h', kind: 'sprite', placeholder: { color: '#3dd6f5', label: 'PORTAL' } },
  station_computer:      { src: `${A}Scenes/hub_stations/computer.png`,      w: 32, h: 32, frames: 2, layout: 'h', kind: 'sprite', placeholder: { color: '#2b6cb0', label: 'COMP' } },
  station_notebook:      { src: `${A}Scenes/hub_stations/notebook.png`,      w: 24, h: 24, frames: 2, layout: 'h', kind: 'sprite', placeholder: { color: '#2b6cb0', label: 'NOTE' } },
  station_expansion_bay: { src: `${A}Scenes/hub_stations/expansion_bay.png`, w: 48, h: 32, frames: 1, layout: 'h', kind: 'sprite', placeholder: { color: '#4a5568', label: 'COMING SOON' } },

  /* ---- Pickups and FX ---- */
  blueprint_pickup: { src: `${A}Sprites/FX/blueprint_pickup.png`, w: 12, h: 12, frames: 4, layout: 'h', kind: 'sprite', placeholder: { color: '#ffd166', label: 'BP' }, note: 'floating data-chip, 4 bob/glint frames' },
  return_pad:       { src: `${A}Sprites/FX/return_pad.png`,       w: 24, h: 12, frames: 2, layout: 'h', kind: 'sprite', placeholder: { color: '#3dd6f5', label: 'PAD' } },
  fx_scan:          { src: `${A}Sprites/FX/scan.png`,             w: 16, h: 16, frames: 4, layout: 'h', kind: 'sprite', placeholder: { color: '#3dd6f5', label: '*' } },
  fx_alert:         { src: `${A}Sprites/FX/alert.png`,            w: 8,  h: 8,  frames: 2, layout: 'h', kind: 'sprite', placeholder: { color: '#ffd166', label: '!' } },
  fx_dust:          { src: `${A}Sprites/FX/dust.png`,             w: 3,  h: 3,  frames: 1, layout: 'h', kind: 'sprite', placeholder: { color: '#e07a3a', label: '' }, note: 'Mars dust mote; the frontend may draw dust procedurally instead' },

  /* ---- Catalog icons (Archive Computer roadmap), by Mission id order ---- */
  icon_surveyor3:          { src: `${A}Icons/surveyor3.png`,          w: 16, h: 16, frames: 1, layout: 'h', kind: 'icon', placeholder: { color: '#8d939c', label: 'S3' } },
  icon_apollo_lm_descent:  { src: `${A}Icons/apollo_lm_descent.png`,  w: 16, h: 16, frames: 1, layout: 'h', kind: 'icon', placeholder: { color: '#8d939c', label: 'LM' } },
  icon_alsep:              { src: `${A}Icons/alsep.png`,              w: 16, h: 16, frames: 1, layout: 'h', kind: 'icon', placeholder: { color: '#8d939c', label: 'AL' } },
  icon_pathfinder_airbags: { src: `${A}Icons/pathfinder_airbags.png`, w: 16, h: 16, frames: 1, layout: 'h', kind: 'icon', placeholder: { color: '#c1440e', label: 'PF' } },
  icon_insight_seis:       { src: `${A}Icons/insight_seis.png`,       w: 16, h: 16, frames: 1, layout: 'h', kind: 'icon', placeholder: { color: '#c1440e', label: 'IN' } },
  icon_ingenuity:          { src: `${A}Icons/ingenuity.png`,          w: 16, h: 16, frames: 1, layout: 'h', kind: 'icon', placeholder: { color: '#c1440e', label: 'IG' } },
  icon_near_shoemaker:     { src: `${A}Icons/near_shoemaker.png`,     w: 16, h: 16, frames: 1, layout: 'h', kind: 'icon', placeholder: { color: '#4a5568', label: 'NE' } },
  icon_voyager1:           { src: `${A}Icons/voyager1.png`,           w: 16, h: 16, frames: 1, layout: 'h', kind: 'icon', placeholder: { color: '#4a5568', label: 'V1' } },

  /* ---- Ending montage: 2 full frames ---- */
  montage_lrv:       { src: `${A}Montage/lrv_taurus_littrow.png`,     w: 360, h: 180, frames: 1, layout: 'h', kind: 'scene', placeholder: { color: '#3a3d44', label: 'LRV PARKED IN TAURUS-LITTROW' } },
  montage_sojourner: { src: `${A}Montage/sojourner_beside_pathfinder.png`, w: 360, h: 180, frames: 1, layout: 'h', kind: 'scene', placeholder: { color: '#7a3a14', label: 'SOJOURNER BESIDE PATHFINDER' } },

  /* ---- HUD ---- */
  hud_icons: { src: `${A}UI/hud_icons.png`, w: 10, h: 10, frames: 6, layout: 'h', kind: 'icon', placeholder: { color: '#e6edf5', label: 'H' }, note: 'frames: blueprint, notebook, headlamp, mute, explorer, archivist' },
});

/**
 * Optional sound files. The frontend synthesizes every Sfx id with WebAudio;
 * if a file listed here loads, it replaces the synthesized sound. Keys are
 * Sfx ids from contract.js. `loop` marks ambient loops.
 * @typedef {{src:string, loop:boolean, note:string}} AudioSlot
 */
const S = 'Artwork/Audio/';
export const AUDIO = Object.freeze({
  step_wood:        { src: `${S}step_wood.ogg`,        loop: false, note: 'Hub floor, short dry knock' },
  step_sand:        { src: `${S}step_sand.ogg`,        loop: false, note: 'Mars, soft gritty crunch' },
  step_suit:        { src: `${S}step_suit.ogg`,        loop: false, note: 'Moon, muffled thump felt through the suit' },
  breath:           { src: `${S}breath.ogg`,           loop: true,  note: 'Moon, slow breathing inside the helmet' },
  talk_lrv:         { src: `${S}talk_lrv.ogg`,         loop: false, note: 'low static blip per text chunk' },
  talk_soj:         { src: `${S}talk_soj.ogg`,         loop: false, note: 'higher beep per text chunk' },
  confirm:          { src: `${S}confirm.ogg`,          loop: false, note: '' },
  cancel:           { src: `${S}cancel.ogg`,           loop: false, note: '' },
  cursor:           { src: `${S}cursor.ogg`,           loop: false, note: 'menu move' },
  scan:             { src: `${S}scan.ogg`,             loop: false, note: 'blueprint scan sweep' },
  blueprint_get:    { src: `${S}blueprint_get.ogg`,    loop: false, note: 'blueprint recovered chime' },
  station_computer: { src: `${S}station_computer.ogg`, loop: false, note: 'CRT power-up' },
  station_starmap:  { src: `${S}station_starmap.ogg`,  loop: false, note: 'radar ping' },
  notebook:         { src: `${S}notebook.ogg`,         loop: false, note: 'page flip' },
  portal:           { src: `${S}portal.ogg`,           loop: false, note: 'teleport rise' },
  return_pad:       { src: `${S}return_pad.ogg`,       loop: false, note: 'teleport fall' },
  fact:             { src: `${S}fact.ogg`,             loop: false, note: '[!] pop' },
  headlamp:         { src: `${S}headlamp.ogg`,         loop: false, note: 'click' },
  signal_tick:      { src: `${S}signal_tick.ogg`,      loop: false, note: 'SIGNAL bar tick' },
  signal_done:      { src: `${S}signal_done.ogg`,      loop: false, note: 'SIGNAL received' },
  prop_open:        { src: `${S}prop_open.ogg`,        loop: false, note: 'panel open' },
  prop_action:      { src: `${S}prop_action.ogg`,      loop: false, note: 'switch / command sent' },
  pause:            { src: `${S}pause.ogg`,            loop: false, note: '' },
  ending:           { src: `${S}ending.ogg`,           loop: true,  note: 'soft pad under the montage' },
});

/* ---- Helpers (pure; usable from Node and the browser) ---- */

/** Sheet pixel size for a slot. */
export const sheetSize = (slot) => (slot.layout === 'v'
  ? { w: slot.w, h: slot.h * slot.frames }
  : { w: slot.w * slot.frames, h: slot.h });

/** Source rect of frame i within the sheet. */
export const frameRect = (slot, i) => (slot.layout === 'v'
  ? { x: 0, y: slot.h * i, w: slot.w, h: slot.h }
  : { x: slot.w * i, y: 0, w: slot.w, h: slot.h });

/** Astronaut slot for a Dir (contract.Dir: DOWN 0, UP 1, LEFT 2, RIGHT 3). */
export const ASTRO_BY_DIR = Object.freeze(['astro_front', 'astro_back', 'astro_left', 'astro_right']);

/** Mission id (contract.Mission order) -> icon AssetId. */
export const MISSION_ICONS = Object.freeze([
  'icon_surveyor3', 'icon_apollo_lm_descent', 'icon_alsep',
  'icon_pathfinder_airbags', 'icon_insight_seis', 'icon_ingenuity',
  'icon_near_shoemaker', 'icon_voyager1',
]);

export const assetIds = () => Object.keys(ASSETS);
export const audioIds = () => Object.keys(AUDIO);
export const hasAsset = (id) => Object.prototype.hasOwnProperty.call(ASSETS, id);
