/** Shared frontend context (singleton). Filled in by main.js. */
export const ctx = {
  engine: null,      // engine/index.js namespace (or mock)
  data: null,        // data/index.js namespace (or mock)
  assets: null,      // assetloader namespace
  audio: null,       // audio.js instance
  canvas: null, g: null,
  stage: null, ui: null, fx: null,
  scale: 1,
  screens: {},
  current: null, name: null,
  time: 0,
  mock: false,
  // set by main.js
  go() {}, back() {}, flash() {}, toast() {}, isWorld() { return false; },
  worldName() { return 'hub'; },
};
