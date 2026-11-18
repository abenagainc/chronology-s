/* Chronology S — event editor drawer, shared by the Events page and the
   region-3 events panel. Exposed as window.EventEditor. */
window.EventEditor = (() => {
  let S = Store.load();
  let editing = null;
  let draft = null;

  const $ = id => document.getElementById(id);
  /* The event drawer has its OWN ids (e-prefixed). They used to be identical to
     the calendar drawer's, so EventEditor.bind() hijacked the calendar drawer's
     #saveBtn and "save" on a new calendar ran the EVENT save instead — which
     threw and never saved. Keep the two namespaces apart. */
  /* The event drawer's ids are e-prefixed in the markup (edrawerTitle, eTitle…).
     They used to be identical to the calendar drawer's, so EventEditor.bind()
     hijacked the calendar drawer's #saveBtn and "save" on a new calendar ran the
     EVENT save instead — which threw and never saved. Keep the namespaces apart. */
  const $e = id => document.getElementById('e' + id);
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
    $e('drawerTitle').textContent = ev ? 'Edit event' : 'New event';
    $e('delBtn').hidden = !ev;
    $e('drawer').hidden = false; $e('drawer').style.display = 'flex';
    $e('scrim').hidden = false;
    fillCalOptions();
    fillEditor();
    preview();
  }
  function close() {
    $e('drawer').hidden = true; $e('drawer').style.display = 'none';
    $e('scrim').hidden = true; editing = null; draft = null;
  }

  function fillCalOptions() {
    S = Store.load();
    $e('cal').innerHTML = S.calendars.map(c =>
      `<option value="${esc(c.id)}">${esc(c.name)}</option>`).join('');
    $e('cal').value = draft.calId;
    $e('kind').value = draft.kind;
  }
  function fillMonthOptions(sel, cur) {
    const c = cal($e('cal').value);
    sel.innerHTML = c.months.map((m, i) =>
      `<option value="${i + 1}">${esc(m.name)}</option>`).join('');
    sel.value = cur;
  }
  function fillEditor() {
    $e('title').value = draft.title || '';
    $e('note').value = draft.note || '';
    fillMonthOptions($e('m'), draft.date.m);
    fillMonthOptions($e('m2'), draft.end?.m || 1);
    $e('y').value = draft.date.y; $e('d').value = draft.date.d;
    $e('y2').value = draft.end?.y ?? draft.date.y; $e('d2').value = draft.end?.d ?? 1;
    $e('endFld').hidden = draft.kind !== 'span';
    const c = cal(draft.calId);
    $e('calName').textContent = c ? c.name : '';
    $e('hint').textContent = c ? `${c.months.length} months · year ${daysInYear(1, c)} days · ${c.format}` : '';
  }

  function preview() {
    draft.title = $e('title').value;
    draft.note = $e('note').value;
    draft.kind = $e('kind').value;
    draft.calId = $e('cal').value;
    draft.date = { y: +$e('y').value, m: +$e('m').value, d: +$e('d').value };
    draft.end = draft.kind === 'span' ? { y: +$e('y2').value, m: +$e('m2').value, d: +$e('d2').value } : null;
    $e('endFld').hidden = draft.kind !== 'span';

    const c = cal(draft.calId);
    const g = $e('conv'); g.innerHTML = '';
    $e('err').textContent = '';
    if (!c) { $e('err').textContent = 'choose a calendar'; return; }
    if (!draft.title.trim()) { $e('err').textContent = 'title is required'; return; }
    if (!validDate(draft.date.y, draft.date.m, draft.date.d, c)) {
      const dim = daysInMonth(draft.date.y, draft.date.m - 1, c);
      $e('err').textContent = `${c.months[draft.date.m - 1]?.name} ${draft.date.y} has ${dim} days`;
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
    if ($e('err').textContent) return;
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
    const need = ['drawerClose', 'scrim', 'cancelBtn', 'saveBtn', 'delBtn', 'cal'];
    const missing = need.filter(id => !document.getElementById('e' + id));
    if (missing.length) return false;      // drawer not loaded yet — caller retries
    $e('drawerClose').onclick = close;
    $e('scrim').onclick = close;
    $e('cancelBtn').onclick = close;
    $e('saveBtn').onclick = save;
    $e('delBtn').onclick = del;
    $e('cal').onchange = () => {
      // update the draft from what is on screen FIRST — fillEditor() repopulates
      // from the draft, so without this it would wipe anything already typed.
      draft.calId = $e('cal').value;
      fillEditor();
      preview();
    };
    ['title', 'note', 'y', 'd', 'y2', 'd2'].forEach(id =>
      $e(id).addEventListener('input', preview));
    ['m', 'm2', 'kind'].forEach(id => $e(id).addEventListener('change', preview));
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !$e('drawer').hidden) close();
    });
    return true;
  }

  return { open, close, bind, refresh };
})();
