/**
 * src/data/index.js -- DATA API barrel (contract section 5). Exports exactly:
 *   getScene, getBlueprint, getDialogue, getCatalog, getPackInfo,
 *   getRegionStats, getStarMap, getEnding, getPropSpec, getTitleText
 *
 * Pure: every getter returns a deeply frozen object and has no side effects.
 * An unknown id throws a RangeError.
 */
import { SCENES } from './scenes.js';
import { BLUEPRINTS } from './blueprints.js';
import { DIALOGUES } from './dialogue.js';
import { CATALOG, PACKS } from './catalog.js';
import { REGION_STATS, STAR_MAP, ENDING, TITLE_TEXT } from './world.js';
import { PROP_SPECS } from './props.js';
import { pick } from './util.js';

export const getScene = (region) => pick(SCENES, region, 'getScene');
export const getBlueprint = (id) => pick(BLUEPRINTS, id, 'getBlueprint');
export const getDialogue = (robot) => pick(DIALOGUES, robot, 'getDialogue');
export const getCatalog = () => CATALOG;
export const getPackInfo = (pack) => pick(PACKS, pack, 'getPackInfo');
export const getRegionStats = (region) => pick(REGION_STATS, region, 'getRegionStats');
export const getStarMap = () => STAR_MAP;
export const getEnding = () => ENDING;
export const getPropSpec = (prop) => pick(PROP_SPECS, prop, 'getPropSpec');
export const getTitleText = () => TITLE_TEXT;
