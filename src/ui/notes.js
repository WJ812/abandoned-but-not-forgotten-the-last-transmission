/**
 * Automatic field journal (contract 10c). Players never type: the engine appends entries as they play and
 * this module renders them from data, grouped by region in discovery order. The .txt file is created ONLY
 * when the player presses the Download button (nothing ever downloads automatically).
 */
import { Region, Mode, Prop, Robot } from '../contract.js';
import { ctx } from '../gfx/ctx.js';
import { h } from './dom.js';

const REGION_NAME = { [Region.MOON]: 'THE MOON', [Region.MARS]: 'MARS' };
const firstLine = (t) => { const s = String(t || '').replace(/\s+/g, ' ').trim(); const m = s.match(/^.*?[.!?](\s|$)/); return (m ? m[0] : s).trim(); };
const f1 = (v, n = 1) => (typeof v === 'number' ? v.toFixed(n) : String(v ?? ''));

/** {title, summary, full} for one NoteEntry, resolved through data (never throws). */
export function describeNote(e) {
  const D = ctx.data, E = ctx.engine; const arch = E.game.mode === Mode.ARCHIVIST;
  try {
    if (e.kind === 'fact') {
      const f = D.getScene(e.region).facts.find((x) => x.id === e.ref);
      return { title: f.title, summary: firstLine(f.explorer), full: [f.explorer, arch ? f.archivist : null].filter(Boolean).join('\n') };
    }
    if (e.kind === 'answer') {
      const d = D.getDialogue(e.ref); const q = d.questions.find((x) => x.id === e.sub);
      return { title: `${d.name}: ${q.label}`, summary: firstLine(q.answer[0]), full: [...q.answer, ...(arch ? (q.archivist || []) : [])].join('\n') };
    }
    if (e.kind === 'blueprint') {
      const b = D.getBlueprint(e.ref);
      return { title: `Blueprint: ${b.name}`, summary: b.dates, full: [`${b.subsystem} - ${b.dates}`, ...(b.explorerPages || []), ...(arch ? (b.archivistPages || []) : [])].join('\n') };
    }
    if (e.kind === 'finding') {
      const spec = D.getPropSpec(e.ref);
      if (e.ref === Prop.SOJ_APXS) {
        const t = spec.targets[Number(e.sub)]; const top = [...(t.composition || [])].sort((a, b) => b.pct - a.pct)[0];
        const comp = top ? `${top.element} ${f1(top.pct)}%` : '';
        return { title: `APXS on ${t.name}`, summary: `${t.rockType}${comp ? ': ' + comp + '...' : ''}`, full: [`${t.name} (sol ${t.sol}): ${t.rockType}.`, (t.composition || []).map((c) => `${c.element} ${f1(c.pct)}%`).join(', '), t.finding].filter(Boolean).join('\n') };
      }
      if (e.ref === Prop.SOJ_HAZARD) {
        const det = E.propState?.(Prop.SOJ_HAZARD)?.detour;
        return { title: 'Hazard scan', summary: det ? `Hazard scan: the 1997 software would detour ${det}` : 'Hazard scan completed', full: spec.decision || '' };
      }
      if (e.ref === Prop.LRV_NAV) { const v = spec.evas[Number(e.sub)]; return { title: `Replayed ${v.label}`, summary: `Replayed ${v.label}: ${f1(v.distanceKm)} km`, full: `${v.label} (${v.dateUtc}): ${f1(v.distanceKm)} km in ${v.durationMin} min, up to ${v.maxRangeKm} km from the LM.` }; }
      if (e.ref === Prop.SOJ_DRIVE) { const v = spec.legs[Number(e.sub)]; return { title: `Replayed ${v.label}`, summary: `Replayed ${v.label}: ${f1(v.distanceM)} m (${v.sols})`, full: `${v.label}, ${v.sols}: about ${f1(v.distanceM)} m (traced path).` }; }
      if (e.ref === Prop.LRV_BATTERY) {
        const idx = E.propState?.(Prop.LRV_BATTERY)?.loadTest?.evaIndex ?? 0; const wh = spec.evaDrawWh?.[idx];
        return { title: 'Battery load test', summary: `Battery load test: EVA-${idx + 1}${wh ? ` ~${Math.round(wh)} Wh` : ''}`, full: spec.whyDead || '' };
      }
      if (e.ref === Prop.LRV_CAMERA) return { title: 'Liftoff replay', summary: 'Watched the liftoff replay', full: `Pre-timed tilt sequence, ${spec.liftoffUtc || ''}`.trim() };
    }
  } catch { /* fall through */ }
  return { title: `${e.kind} note`, summary: '', full: '' };
}

export function notesList() {
  let list = []; try { list = ctx.engine.notes?.() ?? []; } catch { list = []; }
  return [...list].sort((a, b) => a.n - b.n);
}

/** Plain-text journal. */
export function notesText() {
  const lines = ['ABANDONED BUT NOT FORGOTTEN - THE LAST TRANSMISSION', 'Field notes', new Date().toISOString().slice(0, 10), ''];
  const all = notesList();
  for (const region of [Region.MOON, Region.MARS]) {
    const part = all.filter((e) => e.region === region); if (!part.length) continue;
    lines.push(`== ${REGION_NAME[region]} ==`);
    for (const e of part) { const d = describeNote(e); lines.push(`${e.n}. ${d.title}${d.summary && d.summary !== d.title ? ' - ' + d.summary : ''}`); if (d.full) lines.push('   ' + d.full.replace(/\n/g, '\n   ')); }
    lines.push('');
  }
  return lines.join('\n');
}

/** Download button handler: only ever called from a click. */
export function downloadNotes() {
  const blob = new Blob([notesText()], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob); const a = document.createElement('a');
  a.href = url; a.download = 'field-notes.txt'; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** {el, move(d)}: grouped list + detail; W/S select. */
export function buildNotes() {
  const entries = notesList().map((e) => ({ e, d: describeNote(e) }));
  let sel = 0;
  const list = h('div', { class: 'nb-flist notes-list' }); const det = h('div', { class: 'nb-fdet notes-det' });
  const render = () => {
    list.textContent = '';
    if (!entries.length) { list.append(h('div', { class: 'dim' }, 'No notes yet. Explore the Moon and Mars.')); det.textContent = ''; return; }
    let last = -1;
    entries.forEach((x, i) => {
      if (x.e.region !== last) { last = x.e.region; list.append(h('div', { class: 'grp' }, REGION_NAME[x.e.region] || 'ELSEWHERE')); }
      list.append(h('div', { class: `fi${i === sel ? ' sel' : ''}` }, `${x.e.n}. ${x.d.title}`, x.d.summary && x.d.summary !== x.d.title ? h('em', null, ` - ${x.d.summary}`) : null));
    });
    list.querySelector('.sel')?.scrollIntoView({ block: 'nearest' });
    const x = entries[sel];
    det.replaceChildren(h('div', { class: 'who' }, x.d.title), ...x.d.full.split('\n').map((t) => h('p', null, t)));
  };
  render();
  const btn = h('button', { class: 'pxbtn dl', tabindex: '-1', disabled: entries.length ? null : true, onmousedown: (ev) => ev.preventDefault(), onclick: (ev) => { ev.currentTarget.blur(); downloadNotes(); } }, 'Download notes (.txt)');
  return { el: h('div', { class: 'notes-pane' }, h('div', { class: 'nb-facts notes-grid' }, h('div', null, h('div', { class: 'tbl-title' }, `FIELD JOURNAL ${entries.length}`), list, btn), det)), move(d) { if (!entries.length) return; sel = (sel + d + entries.length) % entries.length; ctx.audio.play('cursor'); render(); } };
}
