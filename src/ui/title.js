/** Title screen: Continue (only if a save exists), New Game, mode picker. */
import { GAME_TITLE, GAME_SUBTITLE, Mode, Screen, Region, Sfx } from '../contract.js';
import { ctx } from '../gfx/ctx.js';
import { h, mount, unmount, spriteCanvas, redrawSprite } from './dom.js';

let root, btns, rows, focus, selMode, armed, blurb, notice, busy;

function makeBtn(assetId, label, activate) {
  const real = ctx.assets.isReal(assetId) || ctx.assets.hasStandin(assetId);
  const b = { id: assetId, activate, real };
  if (real) {
    b.cv = spriteCanvas(assetId, 0, 'tbtn-art');
    b.el = h('div', { class: 'tbtn sprite', onclick: () => activate() }, b.cv, h('span', { class: 'sr' }, label));
  } else {
    b.el = h('div', { class: 'tbtn', onclick: () => activate() }, h('span', { class: 'lb' }, label));
  }
  return b;
}

function refresh() {
  rows.forEach((row, ri) => row.forEach((b, ci) => {
    const focused = ri === focus.r && ci === focus.c;
    b.el.classList.toggle('focus', focused);
    if (b.real) redrawSprite(b.cv, b.pressed ? 2 : focused ? 1 : 0);
    if (b.mode != null) {
      const chosen = b.mode === selMode;
      b.el.classList.toggle('chosen', chosen);
      if (b.real) {
        b.el.querySelector('.sel-art')?.remove();
        if (chosen && (ctx.assets.isReal('btn_mode_selected') || ctx.assets.hasStandin('btn_mode_selected'))) b.el.appendChild(spriteCanvas('btn_mode_selected', 0, 'sel-art'));
      }
    }
  }));
  const tt = ctx.data.getTitleText();
  blurb.textContent = notice || tt.modeBlurbs[focus.r === rows.length - 1 ? rows[focus.r][focus.c].mode ?? selMode : selMode] || '';
}

function press(b, fn) {
  if (busy) return;
  busy = true; b.pressed = true; refresh();
  ctx.audio.play(Sfx.CONFIRM);
  setTimeout(() => { b.pressed = false; busy = false; fn(); if (ctx.name === Screen.TITLE) refresh(); }, 130);
}

function startGame() {
  ctx.flash('cyan');
  ctx.engine.enterRegion(Region.HUB);
  ctx.go(Screen.HUB);
}

export const title = {
  enter() {
    const E = ctx.engine; const tt = ctx.data.getTitleText();
    const hasSave = E.hasSave();
    selMode = E.game.mode ?? Mode.EXPLORER; armed = false; notice = ''; busy = false;
    const cont = hasSave ? makeBtn('btn_continue', tt.continueLabel || 'CONTINUE', () => press(cont, () => {
      E.loadSave(); if (E.game.mode !== selMode) E.setMode(selMode); startGame();
    })) : null;
    const ng = makeBtn('btn_new_game', tt.newGameLabel || 'NEW GAME', () => {
      if (hasSave && !armed) { armed = true; notice = 'A save exists. Press New Game again to erase it and start over.'; ctx.audio.play(Sfx.CURSOR); refresh(); return; }
      press(ng, () => { E.newGame(selMode); ctx.flash('cyan'); E.enterRegion(Region.HUB); ctx.go('controls', { after: Screen.HUB }); });
    });
    const mk = (m, id) => {
      const b = makeBtn(id, tt.modeLabels[m], () => { selMode = m; notice = ''; ctx.audio.play(Sfx.CONFIRM); refresh(); });
      b.mode = m; return b;
    };
    const ex = mk(Mode.EXPLORER, 'btn_mode_explorer'); const ar = mk(Mode.ARCHIVIST, 'btn_mode_archivist');
    rows = [cont ? [cont, ng] : [ng], [ex, ar]];
    focus = { r: 0, c: cont ? 0 : 0 };
    blurb = h('p', { class: 'title-blurb' });
    const showHtmlLogo = !ctx.assets.isReal('title_logo') && !ctx.assets.isReal('title_bg');
    root = h('div', { class: 'screen title' },
      showHtmlLogo ? h('div', { class: 'title-logo' },
        h('div', { class: 'kicker' }, 'NASA ARCHIVES  //  TRANSMISSION LOG'),
        h('h1', null, GAME_TITLE), h('h2', null, GAME_SUBTITLE),
        h('p', { class: 'tag' }, tt.tagline)) : h('p', { class: 'tag tag-solo' }, tt.tagline),
      h('div', { class: 'title-btns' },
        h('div', { class: 'trow' }, rows[0].map((b) => b.el)),
        h('div', { class: 'trow mode' }, rows[1].map((b) => b.el))),
      blurb,
      h('p', { class: 'title-hint' }, 'W A S D / Arrows - move    Space / Enter - select'));
    mount(root);
    refresh();
  },
  exit() { unmount(root); },
  update() {},
  action(a) {
    if (busy) return;
    const move = (dr, dc) => {
      let r = focus.r + dr, c = focus.c + dc;
      r = Math.max(0, Math.min(rows.length - 1, r));
      c = Math.max(0, Math.min(rows[r].length - 1, c));
      if (r !== focus.r || c !== focus.c) { focus = { r, c }; armed = false; notice = ''; ctx.audio.play(Sfx.CURSOR); refresh(); }
    };
    if (a === 'up') move(-1, 0); else if (a === 'down') move(1, 0);
    else if (a === 'left') move(0, -1); else if (a === 'right') move(0, 1);
    else if (a === 'confirm') rows[focus.r][focus.c].activate();
  },
  drawBackdrop(g) {
    ctx.assets.draw(g, 'title_bg', 0, 0, 0);
    if (ctx.assets.isReal('title_logo')) ctx.assets.draw(g, 'title_logo', 0, 60, 10);
    return true;
  },
};
