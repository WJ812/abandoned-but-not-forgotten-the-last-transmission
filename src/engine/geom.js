/**
 * geom.js -- pure rect / point / ray helpers for the engine. No state.
 * Rects are {x, y, w, h} in scene px, top-left origin, y down.
 */

export const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

/** Strict overlap: rects that only touch along an edge do NOT overlap. */
export const overlaps = (a, b) =>
  a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

/** Half-open point test: [x, x+w) x [y, y+h). */
export const pointIn = (px, py, r) => px >= r.x && px < r.x + r.w && py >= r.y && py < r.y + r.h;

/** Euclidean gap between two rects (0 when they touch or overlap). */
export function rectGap(a, b) {
  const dx = Math.max(0, b.x - (a.x + a.w), a.x - (b.x + b.w));
  const dy = Math.max(0, b.y - (a.y + a.h), a.y - (b.y + b.h));
  return Math.hypot(dx, dy);
}

export const rectCenter = (r) => ({ x: r.x + r.w / 2, y: r.y + r.h / 2 });

/** Distance from a point to a rect (0 inside). */
export function pointRectDist(px, py, r) {
  const dx = Math.max(r.x - px, 0, px - (r.x + r.w));
  const dy = Math.max(r.y - py, 0, py - (r.y + r.h));
  return Math.hypot(dx, dy);
}

/**
 * Ray (ox,oy) + t*(dx,dy), |d| = 1, against a rect (slab method).
 * Returns the entry distance t in [0, maxT], or -1 if missed.
 * A ray starting inside the rect hits at t = 0.
 */
export function rayRect(ox, oy, dx, dy, r, maxT) {
  let tmin = 0;
  let tmax = maxT;
  const axes = [[ox, dx, r.x, r.x + r.w], [oy, dy, r.y, r.y + r.h]];
  for (const [o, d, lo, hi] of axes) {
    if (Math.abs(d) < 1e-12) {
      if (o < lo || o > hi) return -1;
    } else {
      let t1 = (lo - o) / d;
      let t2 = (hi - o) / d;
      if (t1 > t2) { const s = t1; t1 = t2; t2 = s; }
      if (t1 > tmin) tmin = t1;
      if (t2 < tmax) tmax = t2;
      if (tmin > tmax) return -1;
    }
  }
  return tmin;
}

/** Normalize degrees into [0, 360). */
export const norm360 = (a) => ((a % 360) + 360) % 360;

/** Signed smallest difference a - b in (-180, 180]. */
export function angleDiff(a, b) {
  let d = norm360(a - b);
  if (d > 180) d -= 360;
  return d;
}

export const DEG = Math.PI / 180;

/** Largest simulated time one tick may advance (s). Guards against tab-sleep
 *  spikes and bad callers. */
export const MAX_TICK_DT = 0.25;

/** Sanitize a tick dt: non-finite, negative or non-number -> 0; huge -> MAX_TICK_DT. */
export const sanitizeDt = (dt) =>
  (typeof dt === 'number' && Number.isFinite(dt) && dt > 0 ? Math.min(dt, MAX_TICK_DT) : 0);

export const popcount = (n) => {
  let c = 0;
  let v = n >>> 0;
  while (v) { c += v & 1; v >>>= 1; }
  return c;
};
