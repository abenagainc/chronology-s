/* Chronology S — event CRUD. An event lives in ONE calendar; the UI shows the
   equivalent day in every other calendar. */
(() => {
  let S = Store.load();
  let editing = null;
  let draft = null;

  const $ = id => document.getElementById(id);
  const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));

  /* Resolve a calendar for CONVERSION: registration computes `epochDay` for a
     calendar that states its epoch in another calendar, so the raw stored
     object can have epochDay undefined and convert to a year in the thousands. */
  function cal(id) { return BY_ID[id] || S.calendars.find(c => c.id === id); }

  /* ---------------- table ---------------- */
  function render() {
    const tb = $('evtTable').querySelector('tbody');
    tb.innerHTML = '';
    const q = ($('q').value || '').toLowerCase();
    const rows = S.events
      .map(e => ({ e, day: Store.eventDay(S, e) }))
      .filter(r => r.day !== null)
      .filter(r => !q || r.e.title.toLowerCase().includes(q) || (r.e.note || '').toLowerCase().includes(q))
      .sort((a, b) => a.day - b.day);

    $('empty').hidden = rows.length > 0;
    for (const { e } of rows) {
      const c = cal(e.calId);
      const tr = document.createElement('tr');
      const others = S.calendars.filter(x => x.id !== e.calId);
      const day = Store.eventDay(S, e);
      const endDay = Store.eventEndDay(S, e);
      tr.innerHTML = `
        <td class="grow"><div class="ttl">${esc(e.title)}</div>
          ${e.note ? `<div class="note">${esc(e.note)}</div>` : ''}</td>
        <td><span class="dot" style="display:inline-block;width:9px;height:9px;border-radius:2px;background:${c?.color};margin-right:.3rem"></span>${esc(c?.name || '?')}</td>
        <td class="mono">${esc(formatDay(day, c))}${e.kind === 'span' && endDay ? `<br><span class="note">→ ${esc(formatDay(endDay, c))}</span>` : ''}</td>
        <td><div class="other">${others.map(o =>
          `<div class="line"><i class="sw" style="background:${o.color}"></i>${esc(formatDay(day, o))}<span class="note">${esc(o.name)}</span></div>`).join('')}
        </div></td>
        <td class="acts"><button class="btn sm" data-a="edit">edit</button>
          <button class="btn sm danger" data-a="del">delete</button></td>`;
      tr.querySelector('[data-a=edit]').onclick = () => openEditor(e);
      tr.querySelector('[data-a=del]').onclick = () => {
        if (confirm(`Delete "${e.title}"?`)) { Store.deleteEvent(S, e.id); S = Store.load(); render(); }
      };
      tb.appendChild(tr);
    }
    $('storeChip').textContent = `${S.calendars.length} calendars · ${S.events.length} events`;
  }

  /* ---------------- editor ---------------- */
  function openEditor(ev) {
    editing = ev;
    draft = JSON.parse(JSON.stringify(ev || {
      title: '', calId: S.calendars[0]?.id, kind: 'point',
      date: { y: 1, m: 1, d: 1 }, end: null, note: '',
    }));
    $('drawerTitle').textContent = ev ? 'Edit event' : 'New event';
    $('delBtn').hidden = !ev;
    $('drawer').hidden = false; $('drawer').style.display = 'flex';
    $('scrim').hidden = false;
    fillCalOptions();
    fillEditor();
    preview();
  }
  function closeEditor() {
    $('drawer').hidden = true; $('drawer').style.display = 'none';
    $('scrim').hidden = true; editing = null; draft = null;
  }

  function fillCalOptions() {
    $('eCal').innerHTML = S.calendars.map(c =>
      `<option value="${esc(c.id)}">${esc(c.name)}</option>`).join('');
    $('eCal').value = draft.calId;
    $('eKind').value = draft.kind;
  }
  function fillMonthOptions(sel, cur) {
    const c = cal($('eCal').value);
    sel.innerHTML = c.months.map((m, i) =>
      `<option value="${i + 1}">${esc(m.name)}</option>`).join('');
    sel.value = cur;
  }
  function fillEditor() {
    $('eTitle').value = draft.title || '';
    $('eNote').value = draft.note || '';
    fillMonthOptions($('eM'), draft.date.m);
    fillMonthOptions($('eM2'), draft.end?.m || 1);
    $('eY').value = draft.date.y; $('eD').value = draft.date.d;
    $('eY2').value = draft.end?.y ?? draft.date.y; $('eD2').value = draft.end?.d ?? 1;
    $('eEndFld').hidden = draft.kind !== 'span';
    const c = cal(draft.calId);
    $('eCalName').textContent = c ? c.name : '';
    $('eHint').textContent = c ? `${c.months.length} months · year ${daysInYear(1, c)} days · ${c.format}` : '';
  }

  function preview() {
    draft.title = $('eTitle').value;
    draft.note = $('eNote').value;
    draft.kind = $('eKind').value;
    draft.calId = $('eCal').value;
    draft.date = { y: +$('eY').value, m: +$('eM').value, d: +$('eD').value };
    draft.end = draft.kind === 'span' ? { y: +$('eY2').value, m: +$('eM2').value, d: +$('eD2').value } : null;
    $('eEndFld').hidden = draft.kind !== 'span';

    const c = cal(draft.calId);
    const g = $('eConv'); g.innerHTML = '';
    $('eErr').textContent = '';
    if (!c) { $('eErr').textContent = 'choose a calendar'; return; }
    if (!draft.title.trim()) { $('eErr').textContent = 'title is required'; return; }
    if (!validDate(draft.date.y, draft.date.m, draft.date.d, c)) {
      const dim = daysInMonth(draft.date.y, draft.date.m - 1, c);
      $('eErr').textContent = `${c.months[draft.date.m - 1]?.name} ${draft.date.y} has ${dim} days`;
      return;
    }
    const day = dateToDay(draft.date.y, draft.date.m, draft.date.d, c);
    let html = `<div class="line"><i class="sw" style="background:${c.color}"></i>
      <b>${esc(formatDay(day, c))}</b><span class="nm">${esc(c.name)} (native)</span></div>`;
    for (const o of S.calendars.filter(x => x.id !== c.id)) {
      html += `<div class="line"><i class="sw" style="background:${o.color}"></i>
        ${esc(formatDay(day, o))}<span class="nm">${esc(o.name)}</span></div>`;
    }
    g.innerHTML = html;
  }

  function save() {
    preview();
    if ($('eErr').textContent) return;
    const payload = { ...draft, id: undefined };
    delete payload.id;
    if (editing) Store.updateEvent(S, editing.id, payload);
    else Store.addEvent(S, payload);
    S = Store.load(); closeEditor(); render();
  }

  /* ---------------- wire ---------------- */
  $('newEvtBtn').onclick = () => openEditor(null);
  $('drawerClose').onclick = closeEditor;
  $('scrim').onclick = closeEditor;
  $('cancelBtn').onclick = closeEditor;
  $('saveBtn').onclick = save;
  $('delBtn').onclick = () => {
    if (!editing) return;
    if (confirm(`Delete "${editing.title}"?`)) { Store.deleteEvent(S, editing.id); S = Store.load(); closeEditor(); render(); }
  };
  $('q').oninput = render;
  $('eCal').onchange = () => { fillEditor(); preview(); };
  ['eTitle','eNote','eY','eD','eY2','eD2'].forEach(id => $(id).addEventListener('input', preview));
  ['eM','eM2','eKind'].forEach(id => $(id).addEventListener('change', preview));
  $('resetBtn').onclick = () => { if (confirm('Reset all dummy data?')) { S = Store.reset(); render(); } };
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !$('drawer').hidden) closeEditor(); });

  render();
})();
