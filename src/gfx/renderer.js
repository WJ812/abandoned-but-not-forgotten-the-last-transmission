/**
 * World renderer: scene, hotspot art (placeholder-aware), astronaut with walk bob,
 * hop lift and ground shadow, rover overlays driven by prop state, Moon shadow
 * mask with the headlamp cone, Mars dust, floating [!].
 */
import {
  CANVAS_W, CANVAS_H, Region, HotspotKind, Robot, Station, Prop, Dir, DUST, PLAYER,
} from '../contract.js';
import { ASTRO_BY_DIR } from '../assets.js';
import { ctx } from './ctx.js';
import { drawLabelBox } from './pixfont.js';

const sceneCache = new Map();
export const getSceneCached = (region) => {
  if (!sceneCache.has(region)) sceneCache.set(region, ctx.data.getScene(region));
  return sceneCache.get(region);
};

const STATION_ASSET = ['station_star_map', 'station_portal', 'station_computer', 'station_notebook', 'station_expansion_bay'];
const KIND_COLOR = { robot: '#8d939c', station: '#2b6cb0', prop: '#2f7f6d', decor: '#4a5568', blueprint: '#ffd166', portal: '#3dd6f5', returnPad: '#3dd6f5' };

export const rectCenter = (r) => ({ x: r.x + r.w / 2, y: r.y + r.h / 2 });
export function findHotspot(scene, pred) { return scene.hotspots.find(pred) || null; }

/* ---------- small pixel helpers ---------- */
function pixEllipse(g, cx, cy, rx, ry, color, alpha) {
  g.globalAlpha = alpha; g.fillStyle = color;
  for (let y = -ry; y <= ry; y++) {
    const w = Math.round(rx * Math.sqrt(Math.max(0, 1 - (y * y) / (ry * ry + 0.0001))));
    if (w > 0) g.fillRect(Math.round(cx - w), Math.round(cy + y), w * 2, 1);
  }
  g.globalAlpha = 1;
}

/* ---------- Mars dust ---------- */
let dust = null;
function initDust() {
  dust = [];
  for (let i = 0; i < DUST.COUNT; i++) {
    dust.push({
      x: Math.random() * CANVAS_W, y: Math.random() * CANVAS_H,
      vx: DUST.WIND_PX_S[0] + Math.random() * (DUST.WIND_PX_S[1] - DUST.WIND_PX_S[0]),
      ph: Math.random() * 6.28, s: Math.random() < 0.25 ? 2 : 1, c: DUST.COLORS[i % DUST.COLORS.length], a: 0.4 + Math.random() * 0.5,
    });
  }
}
export function updateDust(dt) {
  if (!dust) initDust();
  for (const p of dust) {
    p.x += p.vx * dt; p.y += Math.sin(ctx.time * 0.8 + p.ph) * DUST.DRIFT_PX_S * dt;
    if (p.x < -3) { p.x = CANVAS_W + 2; p.y = Math.random() * CANVAS_H; }
    if (p.y < -3) p.y = CANVAS_H; else if (p.y > CANVAS_H + 3) p.y = -2;
  }
}
function drawDust(g) {
  if (!dust) initDust();
  g.fillStyle = 'rgba(193,68,14,0.07)'; g.fillRect(0, 0, CANVAS_W, CANVAS_H);
  for (const p of dust) { g.globalAlpha = p.a; g.fillStyle = p.c; g.fillRect(Math.round(p.x), Math.round(p.y), p.s, p.s); }
  g.globalAlpha = 1;
}

/* ---------- Moon shadow mask ---------- */
let maskCv = null;
function drawShadowMask(g, scene) {
  if (!scene.shadows?.length) return;
  if (!maskCv) { maskCv = document.createElement('canvas'); maskCv.width = CANVAS_W; maskCv.height = CANVAS_H; }
  const m = maskCv.getContext('2d');
  m.globalCompositeOperation = 'source-over';
  m.clearRect(0, 0, CANVAS_W, CANVAS_H);
  m.fillStyle = '#000';
  // Crater floors are round in the scene art: fill each shadow rect as an inscribed ellipse.
  for (const r of scene.shadows) {
    m.beginPath(); m.ellipse(r.x + r.w / 2, r.y + r.h / 2, r.w / 2, r.h / 2, 0, 0, 6.2832); m.fill();
  }
  const cone = ctx.engine.headlampCone();
  m.globalCompositeOperation = 'destination-out';
  m.fillStyle = '#000';
  if (cone) {
    m.beginPath(); m.arc(cone.x, cone.y, cone.ambient, 0, 6.2832); m.fill();
    if (cone.on) {
      const a = (cone.angleDeg * Math.PI) / 180, half = (cone.coneDeg * Math.PI) / 360;
      // stepped (retro) falloff: three bands of decreasing reach
      const bands = [[1.0, 0.45], [0.78, 0.8], [0.5, 1]];
      for (const [k, al] of bands) {
        m.globalAlpha = al;
        m.beginPath(); m.moveTo(cone.x, cone.y); m.arc(cone.x, cone.y, cone.radius * k, a - half, a + half); m.closePath(); m.fill();
      }
      m.globalAlpha = 1;
    }
  }
  m.globalCompositeOperation = 'source-over';
  g.drawImage(maskCv, 0, 0);
  if (cone?.on) {   // warm light tint inside the cone
    const a = (cone.angleDeg * Math.PI) / 180, half = (cone.coneDeg * Math.PI) / 360;
    g.save(); g.globalCompositeOperation = 'lighter'; g.fillStyle = 'rgba(255,240,190,0.07)';
    g.beginPath(); g.moveTo(cone.x, cone.y); g.arc(cone.x, cone.y, cone.radius, a - half, a + half); g.closePath(); g.fill(); g.restore();
  }
}

/* ---------- Hotspot art ---------- */
function drawHotspots(g, scene, bgReal, t) {
  const game = ctx.engine.game; const A = ctx.assets;
  const near = game.nearHotspot;
  for (const h of scene.hotspots) {
    const r = h.rect; const isNear = near && near.id === h.id;
    if (h.kind === HotspotKind.BLUEPRINT) {
      if (game.blueprints & (1 << h.ref)) continue;
      const c = rectCenter(r);
      const bob = Math.round(Math.sin(t * 3 + h.ref) * 2);
      pixEllipse(g, c.x, r.y + r.h + 1, 5, 2, '#000', 0.3);
      A.draw(g, 'blueprint_pickup', Math.floor(t * 8) % 4, c.x - 6, c.y - 6 + bob);
      continue;
    }
    if (h.kind === HotspotKind.RETURN_PAD) {
      const c = rectCenter(r); A.draw(g, 'return_pad', Math.floor(t * 3) % 2, c.x - 12, c.y - 6); continue;
    }
    if (h.kind === HotspotKind.ROBOT) continue;   // 70x70 rover sprite drawn by drawRover
    let asset = null;
    if (h.kind === HotspotKind.PORTAL) asset = 'station_portal';
    else if (h.kind === HotspotKind.STATION && STATION_ASSET[h.ref]) asset = STATION_ASSET[h.ref];
    else if (h.kind === HotspotKind.DECOR && h.ref === Station.EXPANSION_BAY) asset = 'station_expansion_bay';
    if (asset) {
      if (!bgReal) {
        const s = A.slotOf(asset); const c = rectCenter(r);
        A.draw(g, asset, s.frames > 1 && (isNear || h.kind === HotspotKind.PORTAL) ? 1 : 0, c.x - s.w / 2, c.y - s.h / 2);
        if (h.kind === HotspotKind.PORTAL && !bgReal) { g.fillStyle = `rgba(61,214,245,${0.15 + 0.1 * Math.sin(t * 4)})`; g.fillRect(r.x, r.y, r.w, r.h); }
      }
      continue;
    }
    if (bgReal) continue;   // painted into the scene art
    // labeled box for robots / props / decor when the scene art is a placeholder
    const col = KIND_COLOR[h.kind] || '#555';
    g.fillStyle = col; g.globalAlpha = h.kind === HotspotKind.PROP ? 0.75 : 0.95; g.fillRect(r.x, r.y, r.w, r.h); g.globalAlpha = 1;
    g.fillStyle = 'rgba(0,0,0,0.5)'; g.fillRect(r.x, r.y, r.w, 1); g.fillRect(r.x, r.y + r.h - 1, r.w, 1); g.fillRect(r.x, r.y, 1, r.h); g.fillRect(r.x + r.w - 1, r.y, 1, r.h);
    if (isNear) { g.fillStyle = '#ffd166'; g.fillRect(r.x - 1, r.y - 1, r.w + 2, 1); g.fillRect(r.x - 1, r.y + r.h, r.w + 2, 1); g.fillRect(r.x - 1, r.y, 1, r.h); g.fillRect(r.x + r.w, r.y, 1, r.h); }
    if (r.w >= 10 && r.h >= 7) drawLabelBox(g, h.label || h.id, r.x, r.y, r.w, r.h, '#fff');
  }
}

/* ---------- Rovers: 70x70 sprites, bottom-aligned and centered on the ROBOT hotspot ---------- */
/** Sojourner has been silent since 27 Sep 1997: it is ALWAYS drawn at its hotspot and never moves. */
export function sojournerPos(scene) {
  const h = findHotspot(scene, (x) => x.kind === HotspotKind.ROBOT && x.ref === Robot.SOJOURNER);
  if (h) { const c = rectCenter(h.rect); return { x: c.x, y: c.y, hot: h }; }
  return null;
}
function roverSprite(scene) {
  const robot = scene.region === Region.MOON ? Robot.LRV : scene.region === Region.MARS ? Robot.SOJOURNER : -1;
  const h = robot < 0 ? null : findHotspot(scene, (x) => x.kind === HotspotKind.ROBOT && x.ref === robot);
  if (!h) return null;
  const id = robot === Robot.LRV ? 'rover_lrv' : 'rover_sojourner'; const s = ctx.assets.slotOf(id);
  const base = h.rect.y + h.rect.h;
  return { id, x: h.rect.x + h.rect.w / 2 - s.w / 2, y: base - s.h, base, cx: h.rect.x + h.rect.w / 2, robot };
}
function drawRover(g, r, scene, t) {
  const A = ctx.assets; const E = ctx.engine;
  pixEllipse(g, r.cx, r.base - 1, 26, 3, '#000', 0.28);
  A.draw(g, r.id, 0, r.x, r.y);
  if (r.robot === Robot.LRV) {
    if (!A.isReal(r.id)) {   // placeholder only: the real 70x70 sprite carries its own camera head
      const cam = E.propState(Prop.LRV_CAMERA); const frame = ((Math.round((cam ? cam.panDeg : 0) / 45) % 8) + 8) % 8;
      A.draw(g, 'lrv_gcta', frame, r.cx + 14, r.y - 4);
    }
    const fe = E.propState(Prop.LRV_FENDER);
    if (fe && fe.dustIntensity > 0.05) {
      for (let i = 0; i < 14; i++) {
        const k = (t * 1.6 + i / 14) % 1;
        g.fillStyle = `rgba(190,190,195,${(1 - k) * fe.dustIntensity})`;
        g.fillRect(Math.round(r.cx - 20 - k * 26), Math.round(r.base - 8 - Math.sin(k * 3.14) * (8 + 14 * fe.dustIntensity)), 2, 2);
      }
    }
  } else {
    const haz = E.propState(Prop.SOJ_HAZARD);
    if (haz && (haz.scanning || haz.progress > 0)) {   // laser stripes from the PARKED rover; it never turns
      const fx = r.cx + 28;
      g.save(); g.globalAlpha = 0.5 + 0.4 * Math.sin(t * 30);
      (haz.stripes || []).forEach((s, i) => {
        const y = r.base - 30 + i * 4; const len = Math.max(4, (s.distPx ?? 40) * Math.min(1, (haz.progress || 0) * 1.5 + 0.2));
        g.fillStyle = s.hit ? '#ff3b3b' : '#ff8080'; g.fillRect(Math.round(fx), Math.round(y), Math.round(len), 1);
        if (s.hit) g.fillRect(Math.round(fx + len), Math.round(y) - 1, 2, 3);
      });
      g.restore();
    }
    const apxs = E.propState(Prop.SOJ_APXS);
    if (apxs?.deployed && !A.isReal(r.id)) A.draw(g, 'sojourner_apxs', 1, r.cx + 26, r.base - 10);
  }
}
function drawLander(g) {
  try {
    const lp = ctx.data.getPropSpec(Prop.SOJ_DRIVE)?.landerPos;
    if (lp) { const s = ctx.assets.slotOf('pathfinder_lander'); ctx.assets.draw(g, 'pathfinder_lander', 0, lp.x - s.w / 2, lp.y - s.h / 2); }
  } catch { /* spec unavailable */ }
}

/* ---------- Player ---------- */
export function drawPlayer(g, t) {
  const p = ctx.engine.game.player; const A = ctx.assets;
  const z = Math.max(0, p.z || 0);
  const bob = p.moving && !p.airborne && z < 0.5 ? (Math.floor(p.anim * 9) % 2 ? 0 : -1) : 0;
  const sx = p.x + PLAYER.W / 2, sy = p.y + PLAYER.H - 2;
  pixEllipse(g, sx, sy, Math.max(3, 8 - z * 0.45), 2, '#000', Math.max(0.12, 0.38 - z * 0.025));
  const lean = p.moving && (p.facing === Dir.LEFT || p.facing === Dir.RIGHT) ? (Math.floor(p.anim * 9) % 2) : 0;
  A.draw(g, ASTRO_BY_DIR[p.facing] || 'astro_front', 0, p.x + (lean && p.facing === Dir.RIGHT ? 0 : 0), p.y - z + bob);
}

/* ---------- Floating [!] ---------- */
export function drawAlert(g, cx, topY, t) {
  const b = Math.round(Math.abs(Math.sin(t * 4)) * 3);
  ctx.assets.draw(g, 'fx_alert', Math.floor(t * 4) % 2, Math.round(cx - 4), Math.round(topY - 10 - b));
}

/* ---------- Main ---------- */
export function renderWorld(g, dt) {
  const game = ctx.engine.game; const t = ctx.time;
  const scene = getSceneCached(game.region);
  const bgReal = ctx.assets.isReal(scene.background);
  ctx.assets.draw(g, scene.background, 0, 0, 0);
  if (!bgReal) {
    g.fillStyle = 'rgba(0,0,0,0.28)';
    for (const r of scene.solids || []) { g.fillRect(r.x, r.y, r.w, r.h); }
  }
  drawHotspots(g, scene, bgReal, t);
  if (scene.region === Region.MARS) drawLander(g);
  const near = game.nearHotspot;
  // depth sort the astronaut against the rover by baseline
  const rv = roverSprite(scene); const pBase = game.player.y + PLAYER.H;
  if (rv && pBase < rv.base) { drawPlayer(g, t); drawRover(g, rv, scene, t); } else { if (rv) drawRover(g, rv, scene, t); drawPlayer(g, t); }
  if (scene.region === Region.MOON) drawShadowMask(g, scene);
  if (scene.region === Region.MARS) { updateDust(dt); drawDust(g); }
  if (near && near.rect) drawAlert(g, near.rect.x + near.rect.w / 2, near.rect.y, t);
  else if (game.pendingFact >= 0) drawAlert(g, game.player.x + 12, game.player.y - game.player.z, t);
  return scene;
}
