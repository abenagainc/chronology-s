/* Chronology S — left sidebar (region 2): the calendar list.
   Two always-present sections — CALENDARS (built-ins) and CUSTOM — each with its
   own add button. Built-ins are immutable: hide, colour and format only; to
   change the RULES you duplicate into a custom calendar.

   Visibility state lives in timeline.js (window.calVisible / hiddenIds /
   setHidden) so the sidebar and the timeline cannot disagree. */
(() => {
  const $ = id => document.getElementById(id);
  const esc = s => String(s ?? '').replace(/[&<>"]/g,
    c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  let S = Store.load();
  const refresh = () => { S = Store.load(); window.dispatchEvent(new CustomEvent('cal-visibility')); };

  /** Popover listing the built-in presets. */
  function openPresetPicker(anchor) {
    let pop = $('presetPop');
    if (pop) { pop.remove(); return; }              // toggle
    pop = document.createElement('div');
    pop.className = 'popover pop-side';
    pop.id = 'presetPop';
    pop.style.position = 'fixed';
    pop.style.top = anchor.getBoundingClientRect().bottom + 6 + 'px';
    pop.style.left = Math.min(anchor.getBoundingClientRect().left, window.innerWidth - 240) + 'px';
    pop.innerHTML = PRESETS.filter(p => p.id !== 'blank').map(p =>
      `<div class="pop-opt" data-p="${p.id}">${esc(p.label)}</div>`).join('');
    document.body.appendChild(pop);
    pop.addEventListener('click', (e) => {
      const o = e.target.closest('.pop-opt');
      if (!o) return;
      const p = presetCal(o.dataset.p);
      p.kind = 'builtin';
      Store.addCalendar(S, p);
      refresh(); render();
      pop.remove();
    });
  }

  function item(c) {
    const isOff = window.hiddenIds().has(c.id);
    const built = c.kind === 'builtin';
    const el = document.createElement('div');
    el.className = 'cal-item' + (isOff ? ' off' : '');
    el.innerHTML = `
      <button class="cb" role="checkbox" aria-checked="${!isOff}"
              title="${isOff ? 'Show on timeline' : 'Hide from timeline'}"></button>
      <span class="t">${esc(c.name)}</span>
      <span class="acts">
        <input type="color" class="swatch" data-a="colour" value="${esc(c.color || '#4f7cdf')}"
               title="Colour">
        ${built
          ? `<button class="btn ghost fmt" data-a="fmt" title="Date format">${esc(c.format || 'YYYY-MM-DD')}</button>`
          : '<button class="btn ghost" data-a="edit" title="Edit rules">✎</button>'}
        <button class="btn ghost" data-a="dup" title="Duplicate to custom">⧉</button>
        ${built ? '' : '<button class="btn ghost" data-a="del" title="Delete">✕</button>'}
      </span>`;
    el.querySelector('.cb').onclick = () => {
      const set = window.hiddenIds();
      if (set.has(c.id)) set.delete(c.id); else set.add(c.id);
      window.setHidden(set);
      render();
      window.dispatchEvent(new CustomEvent('cal-visibility'));
    };
    el.querySelector('[data-a=colour]').oninput = (e) => {
      Store.updateCalendar(S, c.id, { color: e.target.value });
      refresh(); render();
    };
    const fmt = el.querySelector('[data-a=fmt]');
    if (fmt) fmt.onclick = () => {
      const v = prompt('Date format (tokens: YYYY MM DD)', c.format || 'YYYY-MM-DD');
      if (v === null) return;
      Store.updateCalendar(S, c.id, { format: v.trim() || 'YYYY-MM-DD' });
      refresh(); render();
    };
    const edit = el.querySelector('[data-a=edit]');
    if (edit) edit.onclick = () => CalEditor.open(c);
    el.querySelector('[data-a=dup]').onclick = () => {
      const copy = JSON.parse(JSON.stringify(c));
      copy.kind = 'custom';
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
    h.querySelector('button').onclick = (e) => {
      if (addKind === 'builtin') openPresetPicker(e.currentTarget);
      else CalEditor.open(null);
    };
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

  function render() {
    const list = $('calList');
    list.innerHTML = '';
    const builtins = S.calendars.filter(c => c.kind === 'builtin');
    const customs = S.calendars.filter(c => c.kind !== 'builtin');
    list.appendChild(section('Calendars', builtins, 'Add built-in calendar', 'builtin'));
    list.appendChild(section('Custom', customs, 'Add custom calendar', 'custom'));

    const off = window.hiddenIds();
    const shown = S.calendars.filter(c => !off.has(c.id)).length;
    $('viewCount').textContent = `${shown} of ${S.calendars.length} shown`;
    $('viewRange').textContent = `${builtins.length} built-in · ${customs.length} custom`;
  }

  $('resetBtn').onclick = () => {
    if (!confirm('Reset all dummy data to the original seed?')) return;
    localStorage.removeItem('chronologyX.hidden');
    S = Store.reset();
    window.dispatchEvent(new Event('cal-visibility'));
    render();
  };

  document.addEventListener('click', (e) => {
    const pop = $('presetPop');
    if (pop && !e.target.closest('#presetPop') && !e.target.closest('.sec-head .btn')) pop.remove();
  });

  render();
})();
