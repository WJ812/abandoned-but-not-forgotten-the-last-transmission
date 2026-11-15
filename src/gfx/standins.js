/**
 * Procedural pixel stand-ins for art that has not been delivered yet. The asset loader uses a drawer here
 * ONLY when the manifest file is missing; a real PNG always replaces it. Slots without a drawer keep the
 * labeled-box fallback. Style: chunky 1 px pixels and a small palette matching the user's rover sprites.
 * Each drawer paints ONE frame in local coordinates: (c, w, h, frameIndex, slot).
 */
import { drawText, textWidth } from './pixfont.js';

const PAL = {
  ink: '#2a2a40', navy: '#3a4a78', navy2: '#56699c', orange: '#e07a3a', orange2: '#f0a060', rust: '#b3532a',
  white: '#eef0f4', grey: '#c8ccd4', grey2: '#9aa0ae', grey3: '#6c7284', cream: '#f4e8c8', gold: '#e0a84a', gold2: '#7a5a2a',
  cyan: '#3dd6f5', cyan2: '#a8f0ff', blue: '#3b5bdb', blue2: '#7fd0ff', purple: '#2a1426', plum: '#8c4660', yellow: '#ffd166',
};
const R = (c, col, x, y, w, h) => { c.fillStyle = col; c.fillRect(x, y, w, h); };
const px = (c, col, x, y) => { c.fillStyle = col; c.fillRect(x, y, 1, 1); };
function disc(c, col, cx, cy, r) {
  c.fillStyle = col;
  for (let y = -r; y <= r; y++) { const w = Math.round(Math.sqrt(r * r + 0.25 - y * y)); if (w > 0) c.fillRect(cx - w, cy + y, w * 2, 1); }
}
function ellipse(c, col, cx, cy, rx, ry) {
  c.fillStyle = col;
  for (let y = -ry; y <= ry; y++) { const w = Math.round(rx * Math.sqrt(Math.max(0, 1 - (y * y) / (ry * ry + 0.01)))); if (w > 0) c.fillRect(cx - w, cy + y, w * 2, 1); }
}
function line(c, col, x0, y0, x1, y1) {
  c.fillStyle = col; x0 |= 0; y0 |= 0; x1 |= 0; y1 |= 0;
  const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1; let e = dx + dy;
  for (;;) { c.fillRect(x0, y0, 1, 1); if (x0 === x1 && y0 === y1) break; const e2 = 2 * e; if (e2 >= dy) { e += dy; x0 += sx; } if (e2 <= dx) { e += dx; y0 += sy; } }
}
function rng(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }

/* ---------------- sprites ---------------- */
function pathfinderLander(c, w, h) {
  // airbag bulges (deflated, bunched at the base)
  for (const [x, y, r] of [[7, 23, 4], [13, 25, 3], [35, 24, 4], [41, 23, 3], [24, 26, 3]]) { disc(c, PAL.grey, x, y, r); disc(c, PAL.white, x - 1, y - 1, Math.max(1, r - 2)); }
  R(c, PAL.grey3, 2, 26, 44, 1);
  // open petals with solar cells (left and right), tilted
  for (const s of [-1, 1]) {
    const x0 = s < 0 ? 17 : 31;
    for (let k = 0; k < 11; k++) {
      const x = x0 + s * k, yTop = 20 - Math.round(k * 0.75);
      R(c, PAL.ink, x, yTop - 4, 1, 6);
      if (k > 0) { R(c, k % 3 === 0 ? PAL.navy2 : PAL.navy, x, yTop - 3, 1, 4); }
    }
    px(c, PAL.gold, x0 + s * 5, 14); px(c, PAL.gold, x0 + s * 8, 12);
  }
  // central base and front petal
  R(c, PAL.ink, 18, 15, 12, 8); R(c, PAL.grey, 19, 16, 10, 6); R(c, PAL.gold, 21, 17, 6, 2); R(c, PAL.grey2, 19, 20, 10, 2);
  px(c, PAL.ink, 18, 15); px(c, PAL.ink, 29, 15);
  // mast with small dish
  R(c, PAL.grey2, 24, 6, 1, 9); R(c, PAL.ink, 22, 4, 5, 1); R(c, PAL.white, 22, 5, 5, 1); px(c, PAL.orange, 24, 3);
}
function returnPad(c, w, h, i) {
  const glow = i === 1 ? PAL.cyan2 : PAL.cyan;
  ellipse(c, glow, 12, 6, 11, 5); ellipse(c, '#0b2a4a', 12, 6, 9, 3);
  ellipse(c, i === 1 ? '#1a5a82' : '#12466a', 12, 6, 6, 2);
  px(c, PAL.white, 4, 5); px(c, PAL.white, 19, 7); if (i === 1) { px(c, PAL.white, 12, 2); px(c, PAL.white, 9, 10); }
}
function blueprintPickup(c, w, h, i) {
  const bob = [0, 0, 0, 0][i];
  R(c, PAL.ink, 1, 3 + bob, 10, 7); R(c, PAL.blue, 2, 4 + bob, 8, 5); R(c, PAL.blue2, 2, 4 + bob, 8, 1); R(c, '#2a3fa0', 2, 8 + bob, 8, 1);
  R(c, PAL.cream, 0, 3 + bob, 2, 7); R(c, PAL.cream, 10, 3 + bob, 2, 7); R(c, PAL.grey, 0, 6 + bob, 2, 1); R(c, PAL.grey, 10, 6 + bob, 2, 1);
  R(c, PAL.blue2, 4, 6 + bob, 4, 1);                       // a line of "writing"
  const g = [[8, 2], [9, 1], [8, 0], [7, 1]][i];           // soft glint stepping around the corner
  px(c, PAL.white, g[0], g[1]); if (i % 2) { px(c, PAL.cyan2, g[0] - 1, g[1]); px(c, PAL.cyan2, g[0] + 1, g[1]); px(c, PAL.cyan2, g[0], g[1] + 1); }
}
function fxAlert(c, w, h, i) {
  R(c, PAL.ink, 1, 0, 6, 8); R(c, PAL.ink, 0, 1, 8, 6);
  R(c, i ? PAL.yellow : PAL.gold, 1, 1, 6, 6);
  R(c, PAL.ink, 3, 1, 2, 3); R(c, PAL.ink, 3, 5, 2, 1);
}
function lrvWheel(c, w, h, i) {
  disc(c, PAL.ink, 6, 6, 6); disc(c, PAL.grey, 6, 6, 5); disc(c, PAL.grey3, 6, 6, 3);
  const a0 = (i * Math.PI) / 8;
  for (let k = 0; k < 8; k++) { const a = a0 + (k * Math.PI) / 4; line(c, PAL.white, 6 + Math.cos(a) * 1, 6 + Math.sin(a) * 1, 6 + Math.cos(a) * 5, 6 + Math.sin(a) * 5); }
  disc(c, PAL.ink, 6, 6, 1);
}
function lrvFender(c, w, h, i) {
  // curved fender arc over the wheel (16x8)
  for (let x = 0; x < 16; x++) { const y = Math.round(6 - Math.sin((x / 15) * Math.PI) * 5); R(c, PAL.ink, x, y, 1, 2); R(c, i ? PAL.cream : PAL.white, x, y + 1 - (i ? 0 : 1), 1, 1); if (!i) px(c, PAL.grey2, x, y + 1); }
  if (i) {   // taped-map repair: cream map patch with grid lines and silver tape
    for (let x = 3; x < 13; x++) { const y = Math.round(6 - Math.sin((x / 15) * Math.PI) * 5); R(c, PAL.cream, x, y, 1, 2); px(c, PAL.rust, x, y + 1); }
    R(c, PAL.grey2, 5, 3, 1, 4); R(c, PAL.grey2, 10, 3, 1, 4); px(c, PAL.blue, 7, 2); px(c, PAL.blue, 8, 3);
  }
}
function lrvGcta(c, w, h, i) {
  R(c, PAL.ink, 3, 3, 6, 6); R(c, PAL.grey, 4, 4, 4, 4);
  const a = (i * Math.PI) / 4; const lx = Math.round(6 + Math.cos(a) * 4), ly = Math.round(6 + Math.sin(a) * 4);
  R(c, PAL.ink, lx - 1, ly - 1, 3, 3); px(c, PAL.cyan, lx, ly);
}
function sojApxs(c, w, h, i) {
  R(c, PAL.ink, 1, 1, 6, 5); R(c, PAL.grey, 2, 2, 4, 3); R(c, PAL.ink, 3, 6, 2, 2);
  if (i) { px(c, PAL.cyan, 3, 7); px(c, PAL.cyan2, 4, 7); R(c, PAL.orange, 2, 2, 4, 1); } else R(c, PAL.grey2, 2, 2, 4, 1);
}

/* ---------------- portraits (48x48, 2 frames: idle, talking) ---------------- */
function portraitFrame(c, w, h, i, sky) {
  R(c, PAL.purple, 0, 0, w, h); R(c, sky, 2, 2, w - 4, h - 4);
  R(c, '#fffbe8', 0, 0, w, 1); R(c, '#fffbe8', 0, h - 1, w, 1); R(c, '#fffbe8', 0, 0, 1, h); R(c, '#fffbe8', w - 1, 0, 1, h);
  R(c, PAL.ink, 2, 36, w - 4, 1); R(c, '#5a4a6a', 2, 37, w - 4, h - 39);
}
function portraitLrv(c, w, h, i) {
  portraitFrame(c, w, h, i, '#14182c');
  for (let k = 0; k < 10; k++) px(c, PAL.white, (k * 17) % 44 + 2, (k * 7) % 22 + 3);
  // dish on a mast, camera head, seats, chassis, front wheels (front view)
  line(c, PAL.grey2, 34, 30, 34, 14); ellipse(c, PAL.ink, 34, 12, 6, 4); ellipse(c, PAL.white, 34, 12, 5, 3); px(c, PAL.grey3, 34, 12);
  R(c, PAL.ink, 10, 16, 9, 7); R(c, PAL.grey, 11, 17, 7, 5); disc(c, i ? PAL.cyan2 : PAL.cyan, 14, 19, 2); if (i) px(c, PAL.white, 14, 19);
  line(c, PAL.grey2, 14, 23, 14, 28);
  R(c, PAL.ink, 17, 22, 14, 9); R(c, PAL.grey, 18, 23, 12, 7); R(c, PAL.white, 18, 23, 12, 2); R(c, PAL.grey2, 20, 26, 3, 4); R(c, PAL.grey2, 25, 26, 3, 4);
  R(c, PAL.ink, 8, 29, 32, 5); R(c, PAL.grey, 9, 30, 30, 3); R(c, PAL.rust, 9, 33, 30, 1);
  for (const x of [5, 35]) { R(c, PAL.ink, x, 26, 8, 13); R(c, PAL.rust, x + 1, 27, 6, 11); for (let y = 28; y < 38; y += 3) R(c, PAL.orange, x + 1, y, 6, 1); R(c, PAL.ink, x + 3, 27, 1, 11); }
}
function portraitSoj(c, w, h, i) {
  portraitFrame(c, w, h, i, '#8a4a2a');
  R(c, '#c8703c', 2, 24, w - 4, 12); R(c, '#e8a060', 2, 24, w - 4, 1);
  // solar panel on top, orange body, antenna, two front wheels visible
  R(c, PAL.ink, 8, 12, 32, 9); R(c, PAL.navy, 9, 13, 30, 7); for (let x = 12; x < 38; x += 6) R(c, PAL.navy2, x, 13, 1, 7); R(c, PAL.navy2, 9, 16, 30, 1);
  line(c, PAL.grey2, 36, 12, 38, 4); px(c, i ? PAL.yellow : PAL.orange, 38, 3);
  R(c, PAL.ink, 11, 21, 26, 14); R(c, PAL.orange, 12, 22, 24, 12); R(c, PAL.orange2, 12, 22, 24, 2); R(c, PAL.rust, 12, 32, 24, 2);
  R(c, PAL.ink, 18, 25, 12, 6); R(c, '#14182c', 19, 26, 10, 4); px(c, i ? PAL.cyan2 : PAL.cyan, 21, 28); px(c, i ? PAL.cyan2 : PAL.cyan, 26, 28);
  for (const x of [4, 36]) { R(c, PAL.ink, x, 28, 8, 12); R(c, PAL.white, x + 1, 29, 6, 10); for (let y = 30; y < 38; y += 2) R(c, PAL.grey, x + 1, y, 6, 1); R(c, PAL.ink, x + 3, 29, 1, 10); }
  R(c, PAL.ink, 11, 36, 4, 2); R(c, PAL.ink, 33, 36, 4, 2);
}

/* ---------------- title screen ---------------- */
function titleBg(c, w, h) {
  const r = rng(2026);
  R(c, '#030b1e', 0, 0, w, h);
  for (let y = 0; y < h; y += 18) R(c, y % 36 ? '#04102a' : '#050f26', 0, y, w, 18);
  for (let i = 0; i < 170; i++) { const big = r() > 0.94; c.fillStyle = r() > 0.8 ? '#ffffff' : r() > 0.5 ? '#8fa6d8' : '#4f6aa0'; c.fillRect(Math.floor(r() * w), Math.floor(r() * h), big ? 2 : 1, big ? 2 : 1); }
  // planet limb rising from the lower right: layered atmosphere bands
  const cx = w * 0.78, cy = h * 1.42;
  for (const [rad, col] of [[150, '#2b6cb0'], [146, '#0b3d91'], [142, '#1d58b0'], [134, '#164a9a'], [124, '#2b6cb0'], [112, '#3a86c8']]) { c.fillStyle = col; c.beginPath(); c.arc(cx, cy, rad, 0, 7); c.fill(); }
  c.fillStyle = '#9ad8ff'; c.beginPath(); c.arc(cx, cy, 152, Math.PI * 1.15, Math.PI * 1.9); c.lineTo(cx, cy); c.closePath(); c.globalAlpha = 0.12; c.fill(); c.globalAlpha = 1;
  for (let i = 0; i < 40; i++) { const a = Math.PI * (1.15 + r() * 0.75), d = 60 + r() * 80; c.fillStyle = r() > 0.5 ? '#6fc08a' : '#d8e8f4'; c.fillRect(Math.round(cx + Math.cos(a) * d), Math.round(cy + Math.sin(a) * d), 2 + Math.floor(r() * 5), 1); }
  // a distant moon
  disc(c, '#aab0ba', 52, 44, 8); disc(c, '#8d939c', 55, 47, 5); disc(c, '#d4d9e0', 49, 41, 2);
}
function titleLogo(c, w, h) {
  const a = 'ABANDONED BUT NOT FORGOTTEN', b = 'THE LAST TRANSMISSION';
  drawText(c, a, Math.floor((w - textWidth(a, 2)) / 2) + 1, 11, '#0b3d91', 2); drawText(c, a, Math.floor((w - textWidth(a, 2)) / 2), 10, '#ffffff', 2);
  drawText(c, b, Math.floor((w - textWidth(b, 2)) / 2) + 1, 37, '#7a5a2a', 2); drawText(c, b, Math.floor((w - textWidth(b, 2)) / 2), 36, '#ffd166', 2);
  R(c, PAL.cyan, 20, 56, w - 40, 1);
}
function button(c, w, h, i, slot) {
  const base = slot.placeholder.color;
  const bg = i === 1 ? '#2d6acb' : i === 2 ? '#102a58' : base;
  R(c, '#061230', 0, 0, w, h); R(c, i === 1 ? PAL.yellow : '#9ab4ec', 1, 1, w - 2, h - 2); R(c, bg, 2, 2, w - 4, h - 4);
  R(c, i === 2 ? '#0a1c40' : 'rgba(255,255,255,0.18)', 2, 2, w - 4, 2); R(c, i === 2 ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.3)', 2, h - 4, w - 4, 2);
  const lab = slot.placeholder.label; const sc = textWidth(lab, 2) <= w - 10 ? 2 : 1;
  drawText(c, lab, Math.floor((w - textWidth(lab, sc)) / 2), Math.floor((h - 5 * sc) / 2) + (i === 2 ? 1 : 0), '#ffffff', sc);
}
function buttonSelected(c, w, h) {
  R(c, PAL.yellow, 0, 0, w, 2); R(c, PAL.yellow, 0, h - 2, w, 2); R(c, PAL.yellow, 0, 0, 2, h); R(c, PAL.yellow, w - 2, 0, 2, h);
  R(c, PAL.white, 0, 0, 3, 1); R(c, PAL.white, 0, 0, 1, 3); R(c, PAL.white, w - 3, h - 1, 3, 1); R(c, PAL.white, w - 1, h - 3, 1, 3);
}

/* ---------------- catalog icons (16x16, transparent) ---------------- */
function iconSurveyor(c) {   // tripod lander with a dish
  R(c, PAL.ink, 6, 5, 4, 4); R(c, PAL.grey, 7, 6, 2, 2); line(c, PAL.grey2, 8, 5, 8, 2); R(c, PAL.white, 6, 1, 5, 1); px(c, PAL.cyan, 8, 3);
  line(c, PAL.grey2, 6, 9, 2, 14); line(c, PAL.grey2, 9, 9, 13, 14); line(c, PAL.grey2, 8, 9, 8, 14); R(c, PAL.grey, 1, 14, 3, 1); R(c, PAL.grey, 12, 14, 3, 1); R(c, PAL.grey, 7, 14, 3, 1);
}
function iconLm(c) {         // gold octagonal descent stage, 4 legs
  R(c, PAL.ink, 4, 3, 8, 7); R(c, PAL.gold, 5, 4, 6, 5); R(c, PAL.gold2, 5, 8, 6, 1); R(c, '#f4cf7a', 5, 4, 6, 1); px(c, PAL.ink, 4, 3); px(c, PAL.ink, 11, 3);
  line(c, PAL.grey2, 4, 9, 1, 14); line(c, PAL.grey2, 11, 9, 14, 14); line(c, PAL.grey2, 6, 10, 5, 14); line(c, PAL.grey2, 9, 10, 10, 14);
  R(c, PAL.white, 0, 14, 3, 1); R(c, PAL.white, 13, 14, 3, 1); R(c, PAL.white, 4, 14, 3, 1); R(c, PAL.white, 9, 14, 3, 1);
}
function iconAlsep(c) {      // central station, RTG and antenna
  R(c, PAL.ink, 5, 7, 6, 5); R(c, PAL.grey, 6, 8, 4, 3); R(c, PAL.gold, 6, 8, 4, 1);
  R(c, PAL.ink, 12, 9, 3, 5); R(c, PAL.grey3, 13, 10, 1, 3); px(c, PAL.orange, 13, 9); line(c, PAL.grey2, 11, 10, 12, 10);
  line(c, PAL.grey2, 8, 7, 8, 2); line(c, PAL.white, 6, 2, 10, 2); px(c, PAL.cyan, 8, 1); R(c, PAL.grey2, 2, 13, 11, 1);
}
function iconAirbags(c) {    // cluster of white airbag balls
  for (const [x, y, r] of [[5, 10, 4], [11, 10, 4], [8, 5, 4], [8, 12, 3]]) { disc(c, PAL.grey2, x, y, r); disc(c, PAL.white, x - 1, y - 1, Math.max(1, r - 1)); }
  px(c, PAL.white, 6, 3); px(c, PAL.grey, 10, 13);
}
function iconInsight(c) {    // lander, two round solar panels, a dome
  disc(c, PAL.ink, 3, 7, 3); disc(c, PAL.navy, 3, 7, 2); disc(c, PAL.navy2, 2, 6, 1);
  disc(c, PAL.ink, 12, 7, 3); disc(c, PAL.navy, 12, 7, 2); disc(c, PAL.navy2, 11, 6, 1);
  R(c, PAL.ink, 5, 8, 6, 4); R(c, PAL.grey, 6, 9, 4, 2); R(c, PAL.gold, 6, 9, 4, 1);
  disc(c, PAL.ink, 8, 5, 3); disc(c, PAL.white, 8, 5, 2); px(c, PAL.grey2, 9, 6);
  line(c, PAL.grey2, 5, 12, 3, 14); line(c, PAL.grey2, 10, 12, 12, 14);
}
function iconIngenuity(c) {  // helicopter with stacked rotors
  R(c, PAL.ink, 1, 2, 14, 1); R(c, PAL.white, 2, 2, 12, 1); R(c, PAL.ink, 2, 5, 12, 1); R(c, PAL.white, 3, 5, 10, 1); R(c, PAL.grey2, 8, 3, 1, 4);
  R(c, PAL.ink, 6, 7, 4, 4); R(c, PAL.white, 7, 8, 2, 2); R(c, PAL.navy, 6, 7, 4, 1); px(c, PAL.orange, 8, 10);
  line(c, PAL.grey2, 6, 11, 4, 14); line(c, PAL.grey2, 9, 11, 11, 14); line(c, PAL.grey2, 10, 7, 14, 6); R(c, PAL.navy, 12, 6, 3, 1);
}
function iconNear(c) {       // octagonal body with 4 solar panels
  for (const [x, y] of [[0, 2], [11, 2], [0, 10], [11, 10]]) { R(c, PAL.ink, x, y, 5, 4); R(c, PAL.navy, x + 1, y + 1, 3, 2); px(c, PAL.navy2, x + 1, y + 1); }
  R(c, PAL.ink, 5, 4, 6, 8); R(c, PAL.ink, 4, 5, 8, 6); R(c, PAL.gold, 5, 5, 6, 6); R(c, '#f4cf7a', 5, 5, 6, 1); disc(c, PAL.white, 8, 8, 1); px(c, PAL.ink, 8, 8);
  line(c, PAL.grey2, 5, 5, 3, 4); line(c, PAL.grey2, 10, 5, 12, 4); line(c, PAL.grey2, 5, 10, 3, 11); line(c, PAL.grey2, 10, 10, 12, 11);
}
function iconVoyager(c) {    // big white dish with booms
  disc(c, PAL.ink, 8, 5, 6); disc(c, PAL.white, 8, 5, 5); disc(c, PAL.grey, 8, 6, 3); px(c, PAL.grey3, 8, 5); R(c, PAL.grey2, 8, 1, 1, 1);
  line(c, PAL.grey2, 8, 10, 8, 12); R(c, PAL.ink, 6, 11, 5, 3); R(c, PAL.gold, 7, 12, 3, 1);
  line(c, PAL.grey2, 6, 13, 1, 15); line(c, PAL.grey2, 10, 13, 15, 12); px(c, PAL.orange, 1, 15); R(c, PAL.ink, 13, 11, 2, 2);
}

export const STANDINS = {
  pathfinder_lander: pathfinderLander, return_pad: returnPad, blueprint_pickup: blueprintPickup, fx_alert: fxAlert,
  lrv_wheel: lrvWheel, lrv_fender: lrvFender, lrv_gcta: lrvGcta, sojourner_apxs: sojApxs,
  icon_surveyor3: iconSurveyor, icon_apollo_lm_descent: iconLm, icon_alsep: iconAlsep, icon_pathfinder_airbags: iconAirbags,
  icon_insight_seis: iconInsight, icon_ingenuity: iconIngenuity, icon_near_shoemaker: iconNear, icon_voyager1: iconVoyager,
  portrait_lrv: portraitLrv, portrait_sojourner: portraitSoj,
  title_bg: titleBg, title_logo: titleLogo,
  btn_continue: button, btn_new_game: button, btn_mode_explorer: button, btn_mode_archivist: button, btn_mode_selected: buttonSelected,
};
