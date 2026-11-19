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
    // 'builtin' and 'clone' both have FROZEN rules; only 'custom' is editable.
    const built = c.type === 'builtin' || c.type === 'clone' || c.kind === 'builtin';
    const el = document.createElement('div');
    el.className = 'cal-item' + (isOff ? ' off' : '');
    el.innerHTML = `
      <button class="cb" role="checkbox" aria-checked="${!isOff}"
              title="${isOff ? 'Show on timeline' : 'Hide from timeline'}"></button>
      <span class="t">${esc(c.name)}</span>
      <span class="bound" title="Validity range">${esc(boundLabel(c))}</span>
      <span class="acts">
        <input type="color" class="swatch" data-a="colour" value="${esc(c.color || '#4f7cdf')}"
               title="Colour and format">
        ${built
          ? `<button class="btn ghost" data-a="cfmt" title="Colour and format">✎</button>`
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
    /* BUILT-IN: display-only. Editable = colour + date format. Everything else
       (rules, epoch, months, leap, bounds) is frozen, per the ruling. */
    const cfmt = el.querySelector('[data-a=cfmt]');
    if (cfmt) cfmt.onclick = (e) => openCalPop(e.currentTarget, c);
    /* CUSTOM: full editor, including its data variables. */
    const edit = el.querySelector('[data-a=edit]');
    if (edit) edit.onclick = () => CalEditor.open(c);
    /* DUPLICATE offers two labelled choices (ruling 2026-11-19):
         Create Clone  -> rules frozen, display editable, added immediately
         Create Custom -> the same copy opened in the drawer with every
                          variable pre-filled, ready to adjust            */
    el.querySelector('[data-a=dup]').onclick = async () => {
      const copy = JSON.parse(JSON.stringify(c));
      copy.type = 'clone';
      copy.kind = 'clone';
      copy.name = c.name.replace(/\s*\((copy|clone)\)$/i, '') + ' (clone)';
      const choice = await dupChoice(copy.name);
      if (choice === 'clone') {
        Store.addCalendar(S, copy);
        refresh(); render();
      } else if (choice === 'custom') {
        copy.type = 'custom'; copy.kind = 'custom';
        copy.name = copy.name.replace(/\s*\(clone\)$/i, '') + ' (custom)';
        CalEditor.open({ ...copy, id: undefined });
      }
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

  /** Duplicate choice: two LABELLED actions, not OK/Cancel.
     Returns 'clone' | 'custom' | null. */
  function dupChoice(name) {
    const old = $('dupPop');
    if (old) old.remove();
    const pop = document.createElement('div');
    pop.className = 'popover pop-dup';
    pop.id = 'dupPop';
    pop.innerHTML = `
      <div class="pop-title">Duplicate “${esc(name)}”</div>
      <button class="btn sm" id="dupClone">Create Clone</button>
      <button class="btn sm ghost" id="dupCustom">Create Custom</button>
      <div class="pop-hint">Clone — same rules, display editable, can hold events.<br>
        Custom — every variable adjustable.</div>`;
    pop.style.position = 'fixed';
    pop.style.top = '50%'; pop.style.left = '50%';
    pop.style.transform = 'translate(-50%,-50%)';
    document.body.appendChild(pop);
    return new Promise(res => {
      pop.querySelector('#dupClone').onclick = () => { pop.remove(); res('clone'); };
      pop.querySelector('#dupCustom').onclick = () => { pop.remove(); res('custom'); };
      const kill = (e) => { if (e.target === pop) { pop.remove(); res(null); } };
      pop.addEventListener('click', kill);
      setTimeout(() => { if (pop.isConnected) { pop.remove(); res(null); } }, 8000);
    });
  }

  /** Popover for a built-in's colour + date format. */
  function openCalPop(anchor, c) {
    const old = $('calPop');
    if (old) old.remove();
    const pop = document.createElement('div');
    pop.className = 'popover pop-cal';
    pop.id = 'calPop';
    const r = anchor.getBoundingClientRect();
    pop.style.position = 'fixed';
    pop.style.top = Math.min(r.bottom + 6, window.innerHeight - 150) + 'px';
    pop.style.left = Math.max(8, Math.min(r.left - 190, window.innerWidth - 230)) + 'px';
    pop.innerHTML = `
      <div class="pop-row">
        <span class="pop-lab">Colour</span>
        <input type="color" id="cpColor" value="${esc(c.color || '#4f7cdf')}">
      </div>
      <div class="pop-row">
        <span class="pop-lab">Format</span>
        <input id="cpFmt" type="text" value="${esc(c.format || 'YYYY-MM-DD')}" style="width:110px">
      </div>
      <div class="pop-hint">tokens: YYYY&middot;MM&middot;DD — applies to this calendar's labels</div>
      <div class="pop-hint" style="margin-top:6px">validity: <b>${esc(boundLabel(c))}</b>
        &middot; rules are fixed for built-ins</div>`;
    document.body.appendChild(pop);
    pop.querySelector('#cpColor').oninput = (e) => {
      Store.updateCalendar(S, c.id, { color: e.target.value });
      refresh(); render();
    };
    pop.querySelector('#cpFmt').onchange = (e) => {
      Store.updateCalendar(S, c.id, { format: e.target.value.trim() || 'YYYY-MM-DD' });
      refresh(); render();
    };
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
    const builtins = S.calendars.filter(c => c.type === 'builtin' || c.type === 'clone');
    const customs = S.calendars.filter(c => !(c.type === 'builtin' || c.type === 'clone'));
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
    const cp = $('calPop');
    if (cp && !e.target.closest('#calPop') && !e.target.closest('[data-a=cfmt]')) cp.remove();
  });

  /* a calendar added/edited/deleted in a drawer must show up here without a reload */
  window.addEventListener('cal-changed', () => { S = Store.load(); render(); });
  window.addEventListener('cal-visibility', () => { S = Store.load(); render(); });

  render();
})();
