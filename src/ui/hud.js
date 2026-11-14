/** HUD bar: region, blueprint count, headlamp, direct mode toggle, mute. */
import { Region, Mode, Screen, BP_COUNT, Sfx } from '../contract.js';
import { ctx } from '../gfx/ctx.js';
import { h, spriteCanvas } from './dom.js';

let root, regionEl, bpEl, lampEl, modeBtn, muteBtn, last = '';
const HIDE = new Set([Screen.TITLE, Screen.ENDING, Screen.ARCHIVE_COMPUTER, Screen.NOTEBOOK, Screen.STAR_MAP]);
const MODE_FALLBACK = ['EXPLORER 9-12', 'ARCHIVIST 13-18'];

export const modeLabels = () => {
  try { return ctx.data.getTitleText().modeLabels; } catch { return MODE_FALLBACK; }
};

function icon(frame, fallback) {
  if (ctx.assets.isReal('hud_icons')) {
    const c = spriteCanvas('hud_icons', frame, 'hud-ico'); return c;
  }
  return h('span', { class: 'hud-glyph' }, fallback);
}

export function initHud() {
  const noFocus = (e) => e.preventDefault();
  regionEl = h('span', { class: 'hud-region' });
  bpEl = h('span', { class: 'hud-chip hud-bp' });
  lampEl = h('span', { class: 'hud-chip hud-lamp' });
  modeBtn = h('button', {
    class: 'hud-btn', tabindex: '-1', title: 'Switch mode (also in the pause menu)', onmousedown: noFocus,
    onclick: (e) => { e.currentTarget.blur(); ctx.audio.unlock(); ctx.audio.play(Sfx.CONFIRM); ctx.engine.toggleMode(); sync(true); },
  });
  muteBtn = h('button', {
    class: 'hud-btn', tabindex: '-1', title: 'Mute / unmute', onmousedown: noFocus,
    onclick: (e) => { e.currentTarget.blur(); ctx.audio.unlock(); ctx.audio.toggleMute(); if (!ctx.audio.muted) ctx.audio.play(Sfx.CONFIRM); sync(true); },
  });
  root = h('div', { class: 'hud hidden' },
    h('div', { class: 'hud-left' }, regionEl, bpEl, lampEl),
    h('div', { class: 'hud-right' }, h('span', { class: 'hud-keys' }, 'N Notebook  P Pause'), modeBtn, muteBtn));
  ctx.stage.appendChild(root);
}

export function sync(force) {
  const game = ctx.engine.game;
  const hidden = HIDE.has(ctx.name);
  root.classList.toggle('hidden', hidden);
  if (hidden) return;
  let regionName = 'NASA Archives';
  try { regionName = ctx.data.getScene(game.region).name; } catch { /* data not ready */ }
  const bpN = [0, 1].reduce((n, b) => n + ((game.blueprints >> b) & 1), 0);
  const key = [regionName, bpN, game.mode, ctx.audio.muted, game.headlampOn, game.region, force].join('|');
  if (key === last && !force) return;
  last = key;
  regionEl.textContent = regionName.toUpperCase();
  bpEl.replaceChildren(icon(0, 'BP'), ` ${bpN}/${BP_COUNT}`);
  bpEl.classList.toggle('done', bpN === BP_COUNT);
  lampEl.style.display = game.region === Region.MOON ? '' : 'none';
  lampEl.replaceChildren(icon(2, 'F'), game.headlampOn ? ' LAMP ON' : ' LAMP OFF [F]');
  lampEl.classList.toggle('on', !!game.headlampOn);
  modeBtn.replaceChildren(icon(game.mode === Mode.ARCHIVIST ? 5 : 4, game.mode === Mode.ARCHIVIST ? '◆' : '◎'), ' ' + (modeLabels()[game.mode] || ''));
  modeBtn.classList.toggle('arch', game.mode === Mode.ARCHIVIST);
  muteBtn.replaceChildren(icon(3, ctx.audio.muted ? '✕' : '♪'), ctx.audio.muted ? ' MUTED' : ' SOUND');
  muteBtn.classList.toggle('off', ctx.audio.muted);
}
