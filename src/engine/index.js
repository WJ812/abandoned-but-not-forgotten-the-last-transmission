/**
 * engine/index.js -- public barrel of the engine (contract section 8).
 * Wires the real data module into the headless core and re-exports exactly
 * the documented engine API.
 */
import * as data from '../data/index.js';
import { _setDataProvider } from './core.js';

_setDataProvider({ getScene: data.getScene, getPropSpec: data.getPropSpec });

export {
  game, init, newGame, enterRegion, update, getPhysics, findInteract,
  collectBlueprint, markRobotTalked, markAsked, hasAsked, setMode, toggleMode,
  markIntroSeen, markEndingSeen, completion, isLit, headlampCone,
  latencyStart, latencyTick, latencyProgress, latencyActive, acknowledgeFact,
  propOpen, propAction, propTick, propClose, propState,
  hasSave, loadSave, writeSave, eraseSave,
  factsLog, getSettings, setSetting, notes,
} from './core.js';
