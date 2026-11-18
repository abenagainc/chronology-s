/* Chronology S — left sidebar (region 2): the calendar list.
   Two always-present sections — CALENDARS (built-ins) and CUSTOM — each with its
   own add button. Built-ins are immutable: hide, colour and format only; to
   change the RULES you duplicate into a custom calendar. */
(() => {
  const $ = id => document.getElementById(id);
  const esc = s => String(s ?? '').replace(/[&<>"]/g,
    c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  let S = Store.load();

  function hidden() {
    try { return new Set(JSON.parse(localStorage.getItem('chronologyX.hidden') || '[]')); }
    catch (e) { return new Set(); }
  }
  function saveHidden(set) { localStorage.setItem('chronologyX.hidden', JSON.stringify([...set])); }
  function refresh() { S = Store.load(); window.dispatchEvent(new CustomEvent('cal-visibility')); }

  function item(c) {
    const isOff = hidden().has(c.id);
    const built = c.kind === 'builtin';
    const el = document.createElement('div');
    el.className = 'cal-item' + (isOff ? ' off' : '');
    el.innerHTML = `
      <button class="cb" role="checkbox" aria-checked="${!isOff}"
              title="${isOff ? 'Show on timeline' : 'Hide from timeline'}"></button>
      <span class="dot" style="background:${esc(c.color)}"></span>
      <span class="t">${esc(c.name)}</span>
      <span class="acts">
        <button class="btn ghost" data-a="colour" title="Colour">●</button>
        ${built ? '' : '<button class="btn ghost" data-a="edit" title="Edit rules">✎</button>'}
        <button class="btn ghost" data-a="dup" title="Duplicate to custom">⧉</button>
        ${built ? '' : '<button class="btn ghost" data-a="del" title="Delete">✕</button>'}
      </span>`;
    el.querySelector('.cb').onclick = () => {
      const set = hidden();
      if (set.has(c.id)) set.delete(c.id); else set.add(c.id);
      saveHidden(set); render();
    };
    el.querySelector('[data-a=colour]').onclick = () => {
      const v = prompt('Colour (hex)', c.color || '#4f7cdf');
      if (!v) return;
      Store.updateCalendar(S, c.id, { color: v.trim() });
      refresh(); render();
    };
    const edit = el.querySelector('[data-a=edit]');
    if (edit) edit.onclick = () => CalEditor.open(c);
    el.querySelector('[data-a=dup]').onclick = () => {
      const copy = JSON.parse(JSON.stringify(c));
      copy.kind = 'custom';                       // a copy is yours, not history
      copy.name = c.name.replace(/\s*\(copy\)$/i, '') + ' (copy)';
      Store.addCalendar(S, copy);
      refresh(); render();
    };
    const del = el.querySelector('[data-a=del]');
    if (del) del.onclick = () => {
      const n = S.events.filter(e => e.calId === c.id).length;
      if (!confirm(`Delete "${c.name}"${n ? ` and its ${n} event(s)` : ''}?`)) return;
      Store.deleteCalendar(S, c.id);
      refresh(); render();
    };
    return el;
  }

  function section(title, list, addLabel, addKind) {
    const wrap = document.createElement('div');
    const h = document.createElement('div');
    h.className = 'sec-head';
    h.innerHTML = `<span class="label">${esc(title)}</span>
                   <button class="btn ghost sm" title="${esc(addLabel)}">＋</button>`;
    h.querySelector('button').onclick = () => addKind === 'builtin' ? pickPreset() : CalEditor.open(null);
    wrap.appendChild(h);
    const box = document.createElement('div');
    box.className = 'sec-list';
    if (!list.length) {
      const e = document.createElement('div');
      e.className = 'sec-empty';
      e.textContent = addKind === 'builtin' ? 'none added' : 'none yet';
      box.appendChild(e);
    }
    list.forEach(c => box.appendChild(item(c)));
    wrap.appendChild(box);
    return wrap;
  }

  /** Preset picker for a built-in. */
  function pickPreset() {
    const opts = PRESETS.filter(p => p.id !== 'blank');
    const names = opts.map((p, i) => `${i + 1}. ${p.label}`).join('\n');
    const ans = prompt(`Add a built-in calendar:\n${names}\n\nEnter a number`, '1');
    if (ans === null) return;
    const i = parseInt(ans, 10) - 1;
    if (!(i >= 0 && i < opts.length)) { alert('No such preset.'); return; }
    const p = presetCal(opts[i].id);
    p.kind = 'builtin';
    Store.addCalendar(S, p);
    refresh(); render();
  }

  function render() {
    const list = $('calList');
    list.innerHTML = '';
    const builtins = S.calendars.filter(c => c.kind === 'builtin');
    const customs = S.calendars.filter(c => c.kind !== 'builtin');
    list.appendChild(section('Calendars', builtins, 'Add built-in calendar', 'builtin'));
    list.appendChild(section('Custom', customs, 'Add custom calendar', 'custom'));

    const off = hidden();
    const shown = S.calendars.filter(c => !off.has(c.id)).length;
    $('viewCount').textContent = `${shown} of ${S.calendars.length} shown`;
    $('viewRange').textContent =
      `${builtins.length} built-in · ${customs.length} custom`;
  }

  window.calVisible = () => S.calendars.filter(c => !hidden().has(c.id));

  $('resetBtn').onclick = () => {
    if (!confirm('Reset all dummy data to the original seed?')) return;
    localStorage.removeItem('chronologyX.hidden');
    S = Store.reset();
    window.dispatchEvent(new CustomEvent('cal-visibility'));
    render();
  };

  render();
})();
