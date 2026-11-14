/**
 * util.js -- tiny pure helpers shared by the data tables.
 * No state, no side effects beyond freezing the module's own constants.
 */

/** Recursively freeze a plain object/array tree and return it. */
export function deepFreeze(o) {
  if (o && typeof o === 'object' && !Object.isFrozen(o)) {
    Object.freeze(o);
    for (const k of Object.keys(o)) deepFreeze(o[k]);
  }
  return o;
}

/** Rect shorthand, scene px, top-left origin. */
export const R = (x, y, w, h) => ({ x, y, w, h });

/** Look up `table[id]` or throw a RangeError naming the getter. */
export function pick(table, id, what) {
  const v = Number.isInteger(id) ? table[id] : undefined;
  if (v === undefined) throw new RangeError(`${what}: unknown id ${String(id)}`);
  return v;
}
