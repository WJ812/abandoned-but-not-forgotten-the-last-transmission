/* 3x5 pixel font for crisp placeholder labels and in-canvas tags. Upper-case only. */
const G = {
  A: '25755', B: '65656', C: '34443', D: '65556', E: '74647', F: '74644', G: '34553', H: '55755',
  I: '72227', J: '11152', K: '55655', L: '44447', M: '57755', N: '65555', O: '25552', P: '65644',
  Q: '25573', R: '65655', S: '34216', T: '72222', U: '55557', V: '55552', W: '55775', X: '55255',
  Y: '55222', Z: '71247',
  0: '75557', 1: '26227', 2: '61247', 3: '61216', 4: '55711', 5: '74616', 6: '34757', 7: '71222',
  8: '75757', 9: '75716',
  '.': '00002', ',': '00024', '-': '00700', '!': '22202', '?': '61202', ':': '02020', '/': '11244',
  '+': '02720', '~': '03600', '%': '51245', "'": '22000', '(': '12221', ')': '42224', '_': '00007',
  '*': '52725', '[': '32223', ']': '62226', '#': '57575', '=': '07070', '>': '42124', '<': '12421',
  ' ': '00000',
};
export const GLYPH_W = 4;   // 3 + 1 spacing
export const GLYPH_H = 6;   // 5 + 1 spacing

export const textWidth = (s, scale = 1) => Math.max(0, s.length * GLYPH_W - 1) * scale;

export function drawText(c, str, x, y, color = '#fff', scale = 1) {
  c.fillStyle = color;
  let cx = x;
  for (const ch of String(str).toUpperCase()) {
    const rows = G[ch] || G['?'];
    for (let r = 0; r < 5; r++) {
      const bits = +rows[r];
      for (let b = 0; b < 3; b++) if (bits & (4 >> b)) c.fillRect(cx + b * scale, y + r * scale, scale, scale);
    }
    cx += GLYPH_W * scale;
  }
}

/** Greedy word wrap into lines of at most `cols` glyphs. */
export function wrapLabel(str, cols) {
  const out = []; let line = '';
  for (const w of String(str).split(/\s+/)) {
    if (!line) line = w;
    else if ((line + ' ' + w).length <= cols) line += ' ' + w;
    else { out.push(line); line = w; }
  }
  if (line) out.push(line);
  return out.flatMap((l) => (l.length > cols ? l.match(new RegExp(`.{1,${Math.max(1, cols)}}`, 'g')) : [l]));
}

/** Draw wrapped, centered label text inside a w x h box at (x,y). Returns lines drawn. */
export function drawLabelBox(c, label, x, y, w, h, color = '#fff') {
  const cols = Math.max(1, Math.floor((w - 2 + 1) / GLYPH_W));
  const rowsMax = Math.max(1, Math.floor((h - 2) / GLYPH_H));
  const lines = wrapLabel(label, cols).slice(0, rowsMax);
  const total = lines.length * GLYPH_H - 1;
  let cy = y + Math.floor((h - total) / 2);
  for (const l of lines) {
    drawText(c, l, x + Math.floor((w - textWidth(l)) / 2), cy, color);
    cy += GLYPH_H;
  }
  return lines.length;
}
