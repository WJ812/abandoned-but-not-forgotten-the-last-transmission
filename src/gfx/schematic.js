/**
 * Procedural pixel wireframes for the blueprint cards (1 px lines, no scaling blur).
 * drawSchematic(g, bp, x, y, w, h, color) draws into the box; designed on a 160x80 grid
 * and drawn at integer pixel positions via a translated origin.
 */
import { Blueprint } from '../contract.js';
import { drawText } from './pixfont.js';

function pl(g, x0, y0, x1, y1) {   // Bresenham 1 px line
  x0 |= 0; y0 |= 0; x1 |= 0; y1 |= 0;
  const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  for (;;) {
    g.fillRect(x0, y0, 1, 1);
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x0 += sx; }
    if (e2 <= dx) { err += dx; y0 += sy; }
  }
}
function circ(g, cx, cy, r) {      // midpoint circle outline
  let x = r, y = 0, err = 1 - r;
  while (x >= y) {
    for (const [a, b] of [[x, y], [y, x], [-y, x], [-x, y], [-x, -y], [-y, -x], [y, -x], [x, -y]]) g.fillRect(cx + a, cy + b, 1, 1);
    y++; if (err < 0) err += 2 * y + 1; else { x--; err += 2 * (y - x) + 1; }
  }
}
const rect = (g, x, y, w, h) => { pl(g, x, y, x + w, y); pl(g, x, y + h, x + w, y + h); pl(g, x, y, x, y + h); pl(g, x + w, y, x + w, y + h); };
function meshWheel(g, cx, cy, r) {
  circ(g, cx, cy, r); circ(g, cx, cy, Math.max(1, r - 3));
  for (let i = 0; i < 8; i++) { const a = (i * Math.PI) / 4; pl(g, cx + Math.cos(a) * (r - 3), cy + Math.sin(a) * (r - 3), cx + Math.cos(a) * r, cy + Math.sin(a) * r); }
  g.fillRect(cx, cy, 1, 1);
}

function lrv(g) {
  // rear pair (offset, dimmer) then front pair: 4 mesh wheels
  g.globalAlpha = 0.55; meshWheel(g, 40, 56, 10); meshWheel(g, 118, 56, 10); g.globalAlpha = 1;
  meshWheel(g, 32, 62, 11); meshWheel(g, 126, 62, 11);
  rect(g, 28, 44, 104, 8);                       // chassis frame
  pl(g, 32, 44, 40, 38); pl(g, 126, 44, 118, 38); pl(g, 40, 38, 118, 38); // upper frame
  rect(g, 60, 26, 14, 12); pl(g, 60, 26, 56, 20); pl(g, 74, 26, 78, 20); pl(g, 56, 20, 78, 20);   // seat 1
  rect(g, 84, 26, 14, 12); pl(g, 84, 26, 80, 20); pl(g, 98, 26, 102, 20); pl(g, 80, 20, 102, 20); // seat 2
  pl(g, 42, 38, 42, 22); pl(g, 42, 22, 48, 22); pl(g, 48, 22, 48, 26);   // control T-handle
  pl(g, 118, 38, 118, 6); circ(g, 118, 5, 5); pl(g, 113, 5, 123, 5); pl(g, 118, 0, 118, 10); // antenna dish on mast
  pl(g, 28, 44, 20, 30); rect(g, 12, 22, 12, 8); circ(g, 12, 26, 2); pl(g, 20, 30, 20, 30);    // TV camera on front mast
  drawText(g, 'WHEEL', 2, 74, '#fff'); drawText(g, 'HGA', 126, 12, '#fff'); drawText(g, 'TV', 10, 14, '#fff'); drawText(g, 'SEAT', 64, 14, '#fff');
}

function sojourner(g) {
  rect(g, 44, 28, 72, 16);                      // warm electronics box body
  pl(g, 44, 36, 116, 36);
  pl(g, 40, 24, 120, 24); pl(g, 40, 18, 120, 18); pl(g, 40, 18, 40, 24); pl(g, 120, 18, 120, 24); // solar panel top
  for (let x = 40; x <= 120; x += 10) pl(g, x, 18, x, 24);
  pl(g, 100, 18, 100, 6); pl(g, 98, 8, 104, 8);   // antenna
  // rocker-bogie: rocker (long) and bogie (short) links on one side, mirrored visually by offset
  for (const [ox, a] of [[0, 1], [10, 0.45]]) {
    g.globalAlpha = a;
    pl(g, 62 + ox, 44, 38 + ox, 62); pl(g, 62 + ox, 44, 96 + ox, 58); pl(g, 96 + ox, 58, 80 + ox, 66); pl(g, 96 + ox, 58, 116 + ox, 66);
    meshWheel(g, 38 + ox, 64, 7); meshWheel(g, 80 + ox, 70, 7); meshWheel(g, 116 + ox, 68, 7);
  }
  g.globalAlpha = 1;
  pl(g, 44, 40, 30, 46); rect(g, 24, 44, 6, 6);   // APXS arm and head
  drawText(g, '6 WHEELS', 2, 74, '#fff'); drawText(g, 'SOLAR', 126, 18, '#fff'); drawText(g, 'APXS', 8, 36, '#fff');
}

/** Draw a wireframe centered in the (x,y,w,h) box on its native 160x80 grid, with a small dot grid. */
export function drawSchematic(g, bp, x, y, w, h, color = '#7fd0ff') {
  const ox = Math.round(x + (w - 160) / 2), oy = Math.round(y + (h - 80) / 2);
  g.save();
  g.fillStyle = 'rgba(127,208,255,0.22)';
  for (let gx = 0; gx <= 160; gx += 10) for (let gy = 0; gy <= 80; gy += 10) g.fillRect(ox + gx, oy + gy, 1, 1);
  g.translate(ox, oy); g.fillStyle = color;
  (bp === Blueprint.LRV ? lrv : sojourner)(g);
  g.restore();
}
