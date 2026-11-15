/**
 * Entry point: builds the DOM inside #app, loads the engine and data (or the
 * ?mock=1 dev mock), loads art through the manifest with placeholders, wires
 * keyboard and audio, and runs the fixed 60 Hz loop.
 */
import { CANVAS_W, CANVAS_H, DT, Screen, Region, Sfx } from './contract.js';
import * as assets from './gfx/assetloader.js';
import { ctx } from './gfx/ctx.js';
import { AudioEngine } from './gfx/audio.js';
import { initInput, clearPressed, clearInput } from './gfx/input.js';
import { renderWorld } from './gfx/renderer.js';
import { initHud, sync as syncHud } from './ui/hud.js';
import { h } from './ui/dom.js';
import { title } from './ui/title.js';
import { hubScreen, regionScreen, factPopup, portalMenuScreen, confirmReturn } from './ui/world.js';
import { dialogue } from './ui/dialogue.js';
import { blueprintCard } from './ui/cards.js';
import { propPanel } from './ui/props.js';
import { pause } from './ui/menus.js';
import { controlsCard } from './ui/menus.js';
import { archive, notebookScreen, starMapScreen, endingScreen } from './ui/archive.js';

const params = new URLSearchParams(location.search);

function buildDom() {
  const app = document.getElementById('app');
  const canvas = h('canvas', { class: 'main', width: CANVAS_W, height: CANVAS_H });
  const ui = h('div', { id: 'ui' });
  const fx = h('div', { id: 'fx' });
  const stage = h('div', { id: 'stage' }, canvas, ui, fx);
  app.replaceChildren(stage);
  ctx.stage = stage; ctx.canvas = canvas; ctx.ui = ui; ctx.fx = fx;
  ctx.g = canvas.getContext('2d'); ctx.g.imageSmoothingEnabled = false;
  // The stage is ALWAYS laid out at 4x logical (1440x720) so every overlay has one fixed layout; the whole
  // stage (canvas + HTML) is then scaled together to the largest size that fits the window.
  const BASE = 4;
  const resize = () => {
    const vw = document.documentElement.clientWidth || innerWidth, vh = document.documentElement.clientHeight || innerHeight;
    const f = Math.min(vw / CANVAS_W, vh / CANVAS_H);                 // px per logical pixel that fits
    let k = f;
    if (f >= 1) { const fl = Math.floor(f); if (f - fl < 0.12 * fl) k = fl; }   // crisp integer scale when (nearly) exact
    ctx.scale = k;
    stage.style.width = `${CANVAS_W * BASE}px`; stage.style.height = `${CANVAS_H * BASE}px`;
    stage.style.setProperty('--u', `${BASE}px`);
    stage.style.transform = `translate(-50%, -50%) scale(${k / BASE})`;
  };
  document.addEventListener('fullscreenchange', resize);
  addEventListener('resize', resize); resize();
}

function note(text) {
  let n = ctx.stage.querySelector('.loading');
  if (!n) { n = h('div', { class: 'loading', style: { position: 'absolute', inset: '0', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#3dd6f5', fontFamily: 'monospace', letterSpacing: '0.2em', zIndex: 60 } }); ctx.stage.appendChild(n); }
  n.textContent = text;
  return n;
}

async function loadModules() {
  if (params.get('mock') === '1') { const m = await import('./gfx/mock.js'); ctx.mock = 'asked'; return m; }
  try {
    const [engine, data] = await Promise.all([import('./engine/index.js'), import('./data/index.js')]);
    return { engine, data };
  } catch (err) {
    console.warn('Engine/data modules unavailable, falling back to the dev mock.', err);
    const m = await import('./gfx/mock.js'); ctx.mock = 'fallback'; return m;
  }
}

/* ---------------- screen machine ---------------- */
const worldScreens = new Set([Screen.HUB, Screen.REGION]);
const quiet = new Set([Screen.TITLE, Screen.PAUSE, Screen.ENDING, Screen.HUB]);

ctx.isWorld = () => worldScreens.has(ctx.name);
ctx.worldName = () => (ctx.engine.game.region === Region.HUB ? Screen.HUB : Screen.REGION);
ctx.go = (name, p) => {
  ctx.current?.exit?.();
  ctx.name = name; ctx.current = ctx.screens[name];
  clearPressed();
  ctx.current.enter?.(p || {});
  syncHud(true);
  const breath = ctx.engine.game.region === Region.MOON && !quiet.has(name);
  if (breath) ctx.audio.startLoop(Sfx.BREATH); else ctx.audio.stopLoop(Sfx.BREATH);
};
ctx.back = () => ctx.go(ctx.worldName());
/* settings: mute is remembered; reduce-flashing = setting OR the OS reduced-motion preference */
ctx.reduceFlash = () => {
  let s = false; try { s = !!ctx.engine.getSettings?.().reduceFlashing; } catch { /* old engine */ }
  let m = false; try { m = !!globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches; } catch { /* none */ }
  return s || m;
};
ctx.applyReduce = () => ctx.stage.classList.toggle('reduce-flash', ctx.reduceFlash());
ctx.setSetting = (name, value) => { try { ctx.engine.setSetting?.(name, value); } catch { /* old engine */ } ctx.applyReduce(); };
ctx.toggleMute = () => { const m = ctx.audio.toggleMute(); ctx.setSetting('muted', m); return m; };
ctx.flash = (kind = 'cyan') => { const f = ctx.fx; f.className = ''; void f.offsetWidth; f.className = ctx.reduceFlash() ? `soft-${kind}` : `flash-${kind}`; };
ctx.toast = (text, ms = 2400) => {
  const t = h('div', { class: 'toast' }, text); ctx.stage.appendChild(t);
  requestAnimationFrame(() => requestAnimationFrame(() => t.classList.add('in')));
  setTimeout(() => { t.classList.remove('in'); setTimeout(() => t.remove(), 250); }, ms);
};

ctx.screens = {
  confirmReturn, controls: controlsCard,
  [Screen.TITLE]: title, [Screen.HUB]: hubScreen, [Screen.REGION]: regionScreen, [Screen.PORTAL_MENU]: portalMenuScreen,
  [Screen.DIALOGUE]: dialogue, [Screen.FACT_POPUP]: factPopup, [Screen.BLUEPRINT_CARD]: blueprintCard,
  [Screen.PROP_PANEL]: propPanel, [Screen.NOTEBOOK]: notebookScreen, [Screen.STAR_MAP]: starMapScreen,
  [Screen.ARCHIVE_COMPUTER]: archive, [Screen.PAUSE]: pause, [Screen.ENDING]: endingScreen,
};

/* ---------------- loop ---------------- */
function startLoop() {
  let last = performance.now(), acc = 0;
  const g = ctx.g;
  const frame = (now) => {
    requestAnimationFrame(frame);
    const dt = Math.min(0.25, (now - last) / 1000); last = now; acc += dt;
    let n = 0;
    while (acc >= DT && n++ < 10) { ctx.time += DT; acc -= DT; ctx.current.update?.(DT); }
    g.clearRect(0, 0, CANVAS_W, CANVAS_H);
    if (!ctx.current.drawBackdrop?.(g)) renderWorld(g, dt);
    ctx.current.drawOver?.(g);
    syncHud(false);
  };
  requestAnimationFrame(frame);
}

/** Dev shortcut: ?go=hub|moon|mars|dialogue_moon|dialogue_mars|notebook|starmap|archive|pause|ending|prop<N>|fact|portal|bp */
function devJump(go) {
  if (!go) return;
  const E = ctx.engine;
  E.newGame(params.get('mode') === '1' ? 1 : 0);
  if (go === 'ending' || go === 'archive') { E.collectBlueprint(0); E.collectBlueprint(1); }
  const reg = go === 'moon' || go === 'ret' || go.startsWith('bp') || go.endsWith('moon') || (go.startsWith('prop') && +go.slice(4) < 4) ? Region.MOON : (go === 'hub' || ['notebook', 'starmap', 'archive', 'pause', 'portal', 'ending', 'notes'].includes(go) ? Region.HUB : Region.MARS);
  E.enterRegion(reg);
  const to = (s, p) => ctx.go(s, p);
  if (go === 'hub' || go === 'moon' || go === 'mars') to(reg === Region.HUB ? Screen.HUB : Screen.REGION);
  else if (go.startsWith('dialogue')) { to(Screen.DIALOGUE, { robot: reg === Region.MOON ? 0 : 1 }); if (params.get('menu')) ctx.current.action('pause'); }
  else if (go === 'notes') {
    if (params.get('seed')) { E.markAsked(0, 0); E.markAsked(1, 2); E.collectBlueprint(0); E.propOpen(5); E.propAction(5, 'apxsDeploy', 0); for (let i = 0; i < 700; i++) E.propTick(5, 1 / 60); E.propOpen(6); E.propAction(6, 'hazScan'); for (let i = 0; i < 300; i++) E.propTick(6, 1 / 60); }
    to(Screen.ARCHIVE_COMPUTER, { tab: params.get('tab') || 'notes' });
  }
  else if (go === 'notebook') to(Screen.NOTEBOOK); else if (go === 'starmap') to(Screen.STAR_MAP); else if (go === 'archive') to(Screen.ARCHIVE_COMPUTER);
  else if (go === 'pause') to(Screen.PAUSE); else if (go === 'ending') to(Screen.ENDING); else if (go === 'portal') to(Screen.PORTAL_MENU);
  else if (go === 'ret') to('confirmReturn');
  else if (go === 'fact') to(Screen.FACT_POPUP, { fact: ctx.data.getScene(reg).facts[0] });
  else if (go === 'bp' || go === 'bp2' || go === 'bp3') to(Screen.BLUEPRINT_CARD, { bp: go === 'bp3' ? 1 : 0, result: go === 'bp' ? 1 : 0 });
  else if (go.startsWith('prop')) to(Screen.PROP_PANEL, { prop: +go.slice(4) });
}

async function boot() {
  buildDom();
  ctx.audio = new AudioEngine(); ctx.assets = assets;
  note('LOADING ARCHIVE...');
  const mods = await loadModules();
  ctx.engine = mods.engine; ctx.data = mods.data;
  await assets.loadAssets((n, t) => note(`LOADING ARCHIVE ${n}/${t}`));
  ctx.stage.querySelector('.loading')?.remove();
  ctx.engine.init();
  try { if (ctx.engine.getSettings?.().muted) ctx.audio.setMuted(true); } catch { /* sound stays on */ }
  ctx.applyReduce();
  initHud();
  initInput((action, e) => ctx.current?.action?.(action, e));
  ctx.go(Screen.TITLE);
  devJump(params.get('go'));
  if (ctx.mock) ctx.toast(ctx.mock === 'asked' ? 'Dev mock active: engine and data are simulated.' : 'Game engine or data could not be loaded, so placeholder content is shown.', 4500);
  startLoop();
}

boot().catch((err) => {
  console.error(err);
  const app = document.getElementById('app');
  app.textContent = `Failed to start: ${err?.message || err}`;
  app.style.color = '#fc3d21'; app.style.fontFamily = 'monospace';
});
