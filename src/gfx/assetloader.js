/**
 * Asset loader. Tries every manifest slot's `src`; any failure is replaced by a
 * labeled placeholder canvas of the exact sheet size. Dropping a real PNG at the
 * manifest path replaces its placeholder with no code change.
 */
import { ASSETS, sheetSize, frameRect } from '../assets.js';
import { drawLabelBox, drawText, textWidth } from './pixfont.js';
import { STANDINS } from './standins.js';

/** True when a procedural pixel stand-in exists for this slot (used while the real file is missing). */
export const hasStandin = (id) => Object.prototype.hasOwnProperty.call(STANDINS, id);

const store = new Map();   // id -> {img, real, sx, sy}

const hexRgb = (hex) => {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
const shade = (hex, k) => {
  const [r, g, b] = hexRgb(hex);
  const f = (v) => Math.max(0, Math.min(255, Math.round(k >= 0 ? v + (255 - v) * k : v * (1 + k))));
  return `rgb(${f(r)},${f(g)},${f(b)})`;
};
const lum = (hex) => { const [r, g, b] = hexRgb(hex); return (0.299 * r + 0.587 * g + 0.114 * b) / 255; };

function rng(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }

function paintScene(c, id, slot) {
  const { w, h } = slot; const col = slot.placeholder.color; const r = rng(id.length * 7919 + w);
  c.fillStyle = col; c.fillRect(0, 0, w, h);
  if (id === 'scene_hub') {
    c.fillStyle = shade(col, -0.45); c.fillRect(0, 0, w, 56);                 // back wall
    c.fillStyle = shade(col, 0.08);
    for (let x = 6; x < w; x += 36) c.fillRect(x, 6, 24, 40);                  // wall panels
    c.fillStyle = '#7a5a3a'; c.fillRect(0, 56, w, h - 56);                     // wooden floor
    c.fillStyle = '#6a4c30';
    for (let y = 60; y < h; y += 8) c.fillRect(0, y, w, 1);
    for (let y = 56, i = 0; y < h; y += 8, i++) for (let x = (i % 2) * 20; x < w; x += 40) c.fillRect(x, y, 1, 8);
    c.fillStyle = '#071a3f'; c.fillRect(0, 54, w, 2);
  } else if (id === 'scene_moon') {
    c.fillStyle = '#05060a'; c.fillRect(0, 0, w, 44);
    for (let i = 0; i < 60; i++) { c.fillStyle = r() > 0.8 ? '#fff' : '#8a93a8'; c.fillRect(Math.floor(r() * w), Math.floor(r() * 44), 1, 1); }
    c.fillStyle = shade(col, 0.1); c.fillRect(0, 44, w, h - 44);
    for (let i = 0; i < 26; i++) {
      const cx = Math.floor(r() * w), cy = 52 + Math.floor(r() * (h - 56)), rad = 3 + Math.floor(r() * 9);
      c.fillStyle = shade(col, -0.2); c.fillRect(cx - rad, cy, rad * 2, 2);
      c.fillStyle = shade(col, 0.25); c.fillRect(cx - rad, cy - 1, rad * 2, 1);
    }
    c.fillStyle = shade(col, -0.35); c.fillRect(0, 40, w, 6);
  } else if (id === 'scene_mars') {
    c.fillStyle = '#d9915a'; c.fillRect(0, 0, w, 46);
    c.fillStyle = '#e8b27c'; c.fillRect(0, 34, w, 12);
    c.fillStyle = col; c.fillRect(0, 46, w, h - 46);
    for (let i = 0; i < 22; i++) {
      const x = Math.floor(r() * w), y = 54 + Math.floor(r() * (h - 58));
      c.fillStyle = shade(col, r() > 0.5 ? 0.15 : -0.2); c.fillRect(x, y, 6 + Math.floor(r() * 18), 2);
    }
    c.fillStyle = shade(col, -0.3); c.fillRect(0, 44, w, 3);
  } else if (id === 'title_bg') {
    c.fillStyle = '#030b1e'; c.fillRect(0, 0, w, h);
    for (let i = 0; i < 140; i++) { c.fillStyle = r() > 0.85 ? '#fff' : '#4f6aa0'; c.fillRect(Math.floor(r() * w), Math.floor(r() * h), 1, 1); }
    c.fillStyle = '#0b3d91'; c.beginPath(); c.arc(w * 0.78, h * 1.35, 120, 0, 7); c.fill();
    c.fillStyle = '#2b6cb0'; c.beginPath(); c.arc(w * 0.78, h * 1.35, 112, 0, 7); c.fill();
  } else if (id.startsWith('montage')) {
    c.fillStyle = shade(col, -0.4); c.fillRect(0, 0, w, 70);
    c.fillStyle = col; c.fillRect(0, 70, w, h - 70);
    for (let i = 0; i < 50; i++) { c.fillStyle = '#ffffff'; c.fillRect(Math.floor(r() * w), Math.floor(r() * 70), 1, 1); }
  }
  // faint grid so the placeholder reads as deliberate
  c.fillStyle = 'rgba(255,255,255,0.05)';
  for (let x = 0; x < w; x += 16) c.fillRect(x, 0, 1, h);
  for (let y = 0; y < h; y += 16) c.fillRect(0, y, w, 1);
  c.strokeStyle = shade(col, 0.5); c.lineWidth = 1; c.strokeRect(0.5, 0.5, w - 1, h - 1);
  const t = id === 'title_bg' ? '' : slot.placeholder.label.toUpperCase();
  const tw = textWidth(t, 2);
  const bw = Math.min(tw, w - 8);
  const lx = Math.floor((w - bw) / 2);
  if (t) { c.fillStyle = 'rgba(0,0,0,0.55)'; c.fillRect(lx - 4, 4, bw + 8, 16); }
  if (!t) { /* no banner */ } else if (tw <= w - 8) drawText(c, t, lx, 8, '#ffffff', 2);
  else drawLabelBox(c, t, 4, 4, w - 8, 16, '#ffffff');
  drawText(c, `PLACEHOLDER ${w}X${h}  ${slot.src.replace(/^.*Artwork\//, '')}`.slice(0, 78), 4, h - 9, 'rgba(255,255,255,0.7)');
}

function makePlaceholder(id, slot) {
  const { w, h } = sheetSize(slot);
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  const c = cv.getContext('2d'); c.imageSmoothingEnabled = false;
  if (hasStandin(id)) {   // procedural stand-in; any failure falls through to the labeled box
    try {
      for (let i = 0; i < slot.frames; i++) {
        const r = frameRect(slot, i);
        c.save(); c.translate(r.x, r.y); c.beginPath(); c.rect(0, 0, r.w, r.h); c.clip();
        STANDINS[id](c, r.w, r.h, i, slot); c.restore();
      }
      return cv;
    } catch (err) { console.warn('stand-in failed for', id, err); c.clearRect(0, 0, w, h); }
  }
  if (slot.kind === 'scene' && slot.frames === 1 && slot.w >= 160) { paintScene(c, id, slot); return cv; }
  const col = slot.placeholder.color;
  const txt = lum(col) > 0.6 ? '#101820' : '#ffffff';
  for (let i = 0; i < slot.frames; i++) {
    const r = frameRect(slot, i);
    c.fillStyle = slot.frames > 1 && i % 2 ? shade(col, 0.15) : col;
    c.fillRect(r.x, r.y, r.w, r.h);
    c.fillStyle = shade(col, -0.55);
    c.fillRect(r.x, r.y, r.w, 1); c.fillRect(r.x, r.y + r.h - 1, r.w, 1);
    c.fillRect(r.x, r.y, 1, r.h); c.fillRect(r.x + r.w - 1, r.y, 1, r.h);
    let label = slot.placeholder.label;
    if (slot.kind === 'button' || slot.kind === 'ui') {
      c.fillStyle = i === 1 ? 'rgba(255,255,255,0.22)' : i === 2 ? 'rgba(0,0,0,0.25)' : 'rgba(0,0,0,0)';
      c.fillRect(r.x + 1, r.y + 1, r.w - 2, r.h - 2);
    }
    if (slot.frames > 1 && r.w >= 16 && r.h >= 16 && label) label += ` ${i + 1}`;
    if (label && r.w >= 7 && r.h >= 7) drawLabelBox(c, label, r.x, r.y, r.w, r.h, txt);
    else if (label && r.w >= 3) drawText(c, label[0], r.x + Math.floor((r.w - 3) / 2), r.y + Math.floor((r.h - 5) / 2), txt);
  }
  return cv;
}

function loadImage(src) {
  return new Promise((res) => {
    const im = new Image();
    im.onload = () => res(im.naturalWidth > 0 ? im : null);
    im.onerror = () => res(null);
    im.src = src;
  });
}

export async function loadAssets(onProgress) {
  const ids = Object.keys(ASSETS); let n = 0;
  await Promise.all(ids.map(async (id) => {
    const slot = ASSETS[id];
    const im = await loadImage(slot.src);
    if (im) {
      const sz = sheetSize(slot);
      store.set(id, { img: im, real: true, sx: im.naturalWidth / sz.w, sy: im.naturalHeight / sz.h });
    } else {
      store.set(id, { img: makePlaceholder(id, slot), real: false, sx: 1, sy: 1 });
    }
    onProgress?.(++n, ids.length);
  }));
}

export const isReal = (id) => !!store.get(id)?.real;

/** Draw frame `frame` of asset `id` at (x,y). opts: {flip, alpha, scale, w, h} */
export function draw(c, id, frame, x, y, opts) {
  const e = store.get(id); const slot = ASSETS[id];
  if (!e || !slot) return;
  const r = frameRect(slot, Math.max(0, Math.min(slot.frames - 1, frame | 0)));
  const dw = opts?.w ?? slot.w * (opts?.scale ?? 1), dh = opts?.h ?? slot.h * (opts?.scale ?? 1);
  const prevA = c.globalAlpha;
  if (opts?.alpha != null) c.globalAlpha = opts.alpha;
  if (opts?.flip) {
    c.save(); c.translate(Math.round(x) + dw, Math.round(y)); c.scale(-1, 1);
    c.drawImage(e.img, r.x * e.sx, r.y * e.sy, r.w * e.sx, r.h * e.sy, 0, 0, dw, dh); c.restore();
  } else {
    c.drawImage(e.img, r.x * e.sx, r.y * e.sy, r.w * e.sx, r.h * e.sy, Math.round(x), Math.round(y), dw, dh);
  }
  c.globalAlpha = prevA;
}

export const slotOf = (id) => ASSETS[id];
