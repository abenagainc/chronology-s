/* Chronology S — event editor drawer, shared by the Events page and the
   region-3 events panel. Exposed as window.EventEditor. */
window.EventEditor = (() => {
  let S = Store.load();
  let editing = null;
  let draft = null;

  const $ = id => document.getElementById(id);
  const esc = s => String(s ?? '').replace(/[&<>"]/g,
    c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  function cal(id) { return BY_ID[id] || S.calendars.find(c => c.id === id); }
  function refresh() {
    S = Store.load();
    window.dispatchEvent(new CustomEvent('cal-changed'));
    window.dispatchEvent(new CustomEvent('cal-visibility'));
  }

  function open(ev) {
    S = Store.load();
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
  function close() {
    $('drawer').hidden = true; $('drawer').style.display = 'none';
    $('scrim').hidden = true; editing = null; draft = null;
  }

  function fillCalOptions() {
    S = Store.load();
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
    const payload = { ...draft };
    delete payload.id;
    if (editing) Store.updateEvent(S, editing.id, payload);
    else Store.addEvent(S, payload);
    close();
    refresh();
  }

  function del() {
    if (!editing) return;
    if (!confirm(`Delete "${editing.title}"?`)) return;
    Store.deleteEvent(S, editing.id);
    close();
    refresh();
  }

  function bind() {
    $('drawerClose').onclick = close;
    $('scrim').onclick = close;
    $('cancelBtn').onclick = close;
    $('saveBtn').onclick = save;
    $('delBtn').onclick = del;
    $('eCal').onchange = () => { fillEditor(); preview(); };
    ['eTitle', 'eNote', 'eY', 'eD', 'eY2', 'eD2'].forEach(id =>
      $(id).addEventListener('input', preview));
    ['eM', 'eM2', 'eKind'].forEach(id => $(id).addEventListener('change', preview));
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !$('drawer').hidden) close();
    });
  }

  return { open, close, bind, refresh };
})();
