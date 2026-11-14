/**
 * Keyboard input. WASD primary, arrows secondary, Space/Enter/E interact, N/B
 * notebook, P/Esc pause, F headlamp. Keyboard only (no touch, no gamepad).
 * Menu actions are delivered event-style; world bits are accumulated per frame.
 */
import { Btn } from '../contract.js';
import { ctx } from './ctx.js';

const KEYS = {
  KeyD: ['right', Btn.RIGHT], ArrowRight: ['right', Btn.RIGHT],
  KeyA: ['left', Btn.LEFT], ArrowLeft: ['left', Btn.LEFT],
  KeyW: ['up', Btn.UP], ArrowUp: ['up', Btn.UP],
  KeyS: ['down', Btn.DOWN], ArrowDown: ['down', Btn.DOWN],
  Space: ['confirm', Btn.INTERACT], Enter: ['confirm', Btn.INTERACT], NumpadEnter: ['confirm', Btn.INTERACT], KeyE: ['confirm', Btn.INTERACT],
  KeyN: ['notebook', Btn.NOTEBOOK], KeyB: ['notebook', Btn.NOTEBOOK],
  KeyP: ['pause', Btn.PAUSE], Escape: ['pause', Btn.PAUSE],
  KeyF: ['lamp', Btn.HEADLAMP], Tab: ['tab', 0],
};
const REPEATABLE = new Set(['up', 'down', 'left', 'right']);

let held = 0, pressed = 0;

export function initInput(dispatch) {
  window.addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    ctx.audio.unlock();
    let entry = KEYS[e.code]; let action = entry?.[0]; const bit = entry?.[1] || 0;
    let digit = 0;
    if (!entry && /^(Digit|Numpad)[1-9]$/.test(e.code)) { action = 'num'; digit = +e.code.slice(-1); }
    if (!action) return;
    e.preventDefault();
    if (bit) held |= bit;
    if (e.repeat && !REPEATABLE.has(action)) return;
    if (bit && !e.repeat && ctx.isWorld()) pressed |= bit;
    dispatch(action, { digit, code: e.code, repeat: e.repeat });
  });
  window.addEventListener('keyup', (e) => { const entry = KEYS[e.code]; if (entry) held &= ~entry[1]; });
  window.addEventListener('blur', () => { held = 0; pressed = 0; });
  window.addEventListener('pointerdown', () => ctx.audio.unlock());
}

/** Per-step snapshot for engine.update(held, pressed). */
export function takeFrame() {
  const f = { held, pressed }; pressed = 0; return f;
}
export function clearInput() { held = 0; pressed = 0; }
export function clearPressed() { pressed = 0; }
