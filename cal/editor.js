/* Chronology S — calendar rule editor, as a drawer usable from any page.
   The timeline's sidebar opens this instead of a separate Calendars page. */
window.CalEditor = (() => {
  const $ = id => document.getElementById(id);
  const esc = s => String(s ?? '').replace(/[&<>"]/g,
    c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  let editing = null;
  let draft = null;

  function state() { return Store.load(); }

  function open(cal) {
    const S = state();
    editing = cal;
    draft = JSON.parse(JSON.stringify(cal || presetCal('blank')));
    draft.id = undefined;
    $('drawerTitle').textContent = cal ? 'Edit calendar' : 'New calendar';
    $('delBtn').hidden = !cal;
    $('drawer').hidden = false;
    $('drawer').style.display = 'flex';
    $('scrim').hidden = false;
    fillEpochOptions();
    fillEditor();
    preview();
  }
  function close() {
    $('drawer').hidden = true; $('drawer').style.display = 'none';
    $('scrim').hidden = true; editing = null; draft = null;
  }

  function fillEpochOptions() {
    const S = state();
    $('fEpochCal').innerHTML = S.calendars.map(c =>
      `<option value="${esc(c.id)}">${esc(c.name)}</option>`).join('');
  }

  /** Populate the epoch month/day selects from the chosen epoch calendar. */
  function fillEpochDateOptions() {
    const S = state();
    const c = S.calendars.find(x => x.id === $('fEpochCal').value);
    const ed = draft.epochDate || draft.epoch || [1, 1, 1];
    $('fEpochM').innerHTML = (c ? c.months : []).map((m, i) =>
      `<option value="${i + 1}">${esc(m.name)}</option>`).join('') || '<option value="1">1</option>';
    $('fEpochM').value = String(Math.min(Math.max(ed[1], 1), c ? c.months.length : 1));
    const dim = c ? daysInMonth(ed[0], $('fEpochM').value - 1, c) : 31;
    $('fEpochD').max = dim;
    $('fEpochD').value = String(Math.min(Math.max(ed[2], 1), dim));
    $('fEpochY').value = ed[0];
  }

  function fillEditor() {
    const S = state();
    $('fName').value = draft.name || '';
    $('fEra').value = draft.era || 'ce';
    $('fFmt').value = draft.format || 'YYYY-MM-DD';
    $('fColor').value = draft.color || '#4f7cdf';
    if (draft.epochCal && S.calendars.some(c => c.id === draft.epochCal)) {
      $('fEpochCal').value = draft.epochCal;
    } else {
      $('fEpochCal').value = S.calendars.find(c => c.id !== draft.id)?.id || S.calendars[0]?.id || '';
    }
    const ed = draft.epochDate || draft.epoch || [1, 1, 1];
    $('fEpochY').value = ed[0];
    const tb = $('monthTable').querySelector('tbody');
    tb.innerHTML = '';
    draft.months.forEach((m, i) => addMonthRow(m.name, m.days, i));
    const lk = draft.leap?.kind || 'none';
    const r = document.querySelector(`input[name=leap][value="${lk}"]`);
    if (r) r.checked = true;
    $('fLeapCycle').value = draft.leap?.cycle || 30;
    $('fLeapYears').value = (draft.leap?.years || []).join(',');
    $('presets').innerHTML = PRESETS.map(p =>
      `<button class="preset" data-p="${p.id}">${p.label}</button>`).join('');
    $('presets').querySelectorAll('.preset').forEach(b => b.onclick = () => applyPreset(b.dataset.p));
    fillEpochDateOptions();
    fillBoundOptions();
  }

  /* --- validity bounds (in THIS calendar's own units) ----------------- */
  /* The month lists belong to the calendar being edited, so the dropdowns are
     filled from `draft.months` and blank means "unbounded". */
  function fillBoundOptions() {
    ['From', 'To'].forEach(side => {
      const mSel = $('fBound' + side + 'M');
      if (!mSel) return;
      mSel.innerHTML = draft.months.map((m, i) =>
        `<option value="${i + 1}">${esc(m.name)}</option>`).join('');
      const b = side === 'From' ? draft.boundFrom : draft.boundTo;
      if (b && b[1] >= 1 && b[1] <= draft.months.length) {
        $('fBound' + side + 'Y').value = b[0];
        mSel.value = String(b[1]);
        $('fBound' + side + 'D').value = b[2];
        $('fBound' + side + 'D').max = daysInMonth(b[0], b[1] - 1, draft) || 31;
      } else {
        $('fBound' + side + 'Y').value = '';
        $('fBound' + side + 'D').value = '';
      }
    });
  }

  /** Read a bound field; returns [y,m,d] or null (blank = unbounded). */
  function readBound(side) {
    const y = $('fBound' + side + 'Y').value.trim();
    const d = $('fBound' + side + 'D').value.trim();
    if (!y && !d) return null;
    if (!y || !d) { $('fBound' + side + 'Err').textContent = 'enter both a year and a day, or leave both blank'; return undefined; }
    const m = +($('fBound' + side + 'M').value || 1);
    const dim = daysInMonth(+y, m - 1, draft) || 31;
    if (+d < 1 || +d > dim) { $('fBound' + side + 'Err').textContent = `day must be 1–${dim}`; return undefined; }
    $('fBound' + side + 'Err').textContent = '';
    return [+y, m, +d];
  }

  function addMonthRow(name, days, idx) {
    const tb = $('monthTable').querySelector('tbody');
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${idx + 1}</td>
      <td><input type="text" value="${esc(name)}"></td>
      <td><input type="number" min="1" max="40" value="${days}"></td>
      <td><button class="btn ghost" title="remove">✕</button></td>`;
    tr.querySelector('button').onclick = () => tr.remove();
    tb.appendChild(tr);
  }

  function applyPreset(pid) {
    const p = presetCal(pid);
    p.id = draft.id;
    p.name = draft.name || p.name;
    p.color = draft.color || p.color;
    draft = p;
    fillEditor(); preview();
  }

  function readEditor() {
    draft.name = $('fName').value.trim() || 'Untitled calendar';
    draft.era = $('fEra').value;
    draft.format = $('fFmt').value.trim() || 'YYYY-MM-DD';
    draft.color = $('fColor').value;
    draft.epochCal = $('fEpochCal').value;
    draft.epochDate = [+$('fEpochY').value, +$('fEpochM').value, +$('fEpochD').value];
    draft.epoch = [1, 1, 1];
    /* bounds: null = unbounded. readBound returns undefined on a bad entry. */
    const bf = readBound('From'), bt = readBound('To');
    if (bf !== undefined && bt !== undefined) {
      if (bf && bt && dateToDay(bt[0], bt[1], bt[2], draft) < dateToDay(bf[0], bf[1], bf[2], draft)) {
        $('fBoundToErr').textContent = 'end must be after the start';
      } else {
        draft.boundFrom = bf;
        draft.boundTo = bt;
      }
    }
    draft.months = [...$('monthTable').querySelectorAll('tbody tr')].map(tr => ({
      name: tr.querySelector('td:nth-child(2) input').value.trim() || 'Month',
      days: Math.max(1, +tr.querySelector('td:nth-child(3) input').value || 1),
    }));
    const lk = document.querySelector('input[name=leap]:checked')?.value || 'none';
    if (lk === 'none') draft.leap = { kind: 'none' };
    else if (lk === 'every4') draft.leap = { kind: 'every4', gregorianCentury: true };
    else draft.leap = {
      kind: 'custom', cycle: +$('fLeapCycle').value || 30,
      years: $('fLeapYears').value.split(',').map(s => parseInt(s, 10)).filter(n => n > 0),
    };
    draft.leapMonths = (draft.leap?.kind && draft.leap.kind !== 'none')
      ? [{ name: 'Leap day', days: 1, afterMonth: draft.months.length - 1 }] : [];
  }

  function preview() {
    readEditor();
    const g = $('previewG'); g.innerHTML = '';
    $('fErr').textContent = ''; $('fMonthsErr').textContent = ''; $('fEpochErr').textContent = '';

    const S = state();
    const reg = S.calendars.filter(c => c.id !== editing?.id).map(c => JSON.parse(JSON.stringify(c)));
    const d = JSON.parse(JSON.stringify(draft)); d.id = editing?.id || 'draft';
    reg.push(d);
    const regd = registerCalendars(reg);
    const D = regd[d.id];
    if (!draft.months.length) { $('fMonthsErr').textContent = 'add at least one month'; return; }
    const ref = regd[d.epochCal];
    if (!ref) { $('fEpochErr').textContent = `epoch calendar "${d.epochCal}" not found`; return; }
    if (!validDate(d.epochDate[0], d.epochDate[1], d.epochDate[2], ref)) {
      const dim = daysInMonth(d.epochDate[0], d.epochDate[1] - 1, ref);
      $('fEpochErr').textContent =
        `${ref.months[d.epochDate[1] - 1]?.name} ${d.epochDate[0]} has ${dim} days`;
    }
    if (!D) return;

    let html = '';
    for (const y of [1, 100, 500, 1000]) {
      const day = dateToDay(y, 1, 1, D);
      const back = dayToDate(day, D);
      html += `<div>${y}/1/1 → ${formatDay(day, D)}
        <span style="color:var(--muted)">(${back.y}/${back.m}/${back.d})</span></div>`;
    }
    html += `<div style="color:var(--muted)">year length: ${daysInYear(1, D)} days</div>`;
    g.innerHTML = html;
    $('leapHint').textContent = `epoch in ${esc(ref.name)}: ${formatDay(D.epochDay, ref)}`;
  }

  function save() {
    try {
      readEditor();
      if (!draft.name) { $('fErr').textContent = 'name is required'; return; }
      if (!draft.months.length) { $('fMonthsErr').textContent = 'add at least one month'; return; }
      const S = state();
      const reg = S.calendars.filter(c => c.id !== editing?.id).map(c => JSON.parse(JSON.stringify(c)));
      const d = JSON.parse(JSON.stringify(draft));
      d.id = editing?.id || 'new';
      reg.push(d);
      const regd = registerCalendars(reg);
      const ref = regd[d.epochCal];
      if (!ref) { $('fErr').textContent = `epoch calendar "${d.epochCal}" not found`; return; }
      if (!validDate(d.epochDate[0], d.epochDate[1], d.epochDate[2], ref)) {
        $('fErr').textContent = 'epoch date is not valid in the chosen epoch calendar'; return;
      }
      // dateToDay already returns a day index — do NOT subtract DAY0 again.
      d.epochDay = dateToDay(d.epochDate[0], d.epochDate[1], d.epochDate[2], ref);
      const payload = { ...d };
      delete payload.id;
      const S2 = Store.load();
      if (editing) Store.updateCalendar(S2, editing.id, payload);
      else Store.addCalendar(S2, payload);
      close();
      window.dispatchEvent(new CustomEvent('cal-changed'));
    } catch (e) {
      $('fErr').textContent = 'save failed: ' + e.message;
    }
  }

  function del() {
    if (!editing) return;
    const S = state();
    const n = S.events.filter(e => e.calId === editing.id).length;
    if (!confirm(`Delete "${editing.name}"${n ? ` and its ${n} event(s)` : ''}?`)) return;
    Store.deleteCalendar(S, editing.id);
    close();
    window.dispatchEvent(new CustomEvent('cal-changed'));
  }

  function bind() {
    $('drawerClose').onclick = close;
    $('scrim').onclick = close;
    $('cancelBtn').onclick = close;
    $('saveBtn').onclick = save;
    $('delBtn').onclick = del;
    $('addMonth').onclick = () => addMonthRow('Month', 30);
    $('addLeapMonth').onclick = () => addMonthRow('Leap month', 5);
    $('fEpochCal').onchange = () => { fillEpochDateOptions(); preview(); };
    document.querySelectorAll('input[name=leap]').forEach(r => r.onchange = preview);
    ['fName', 'fFmt', 'fLeapCycle', 'fLeapYears', 'fEpochY', 'fEpochD'].forEach(id =>
      $(id).addEventListener('input', preview));
    $('fEpochM').addEventListener('change', preview);
    /* bound fields re-preview; the month dropdowns are rebuilt with the draft,
       so their options follow the month table. */
    ['fBoundFromY', 'fBoundFromD', 'fBoundToY', 'fBoundToD'].forEach(id =>
      $(id).addEventListener('input', preview));
    ['fBoundFromM', 'fBoundToM'].forEach(id => $(id).addEventListener('change', preview));
    $('monthTable').addEventListener('input', () => { fillBoundOptions(); preview(); });
    $('monthTable').addEventListener('input', preview);
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && !$('drawer').hidden) close();
    });
  }

  return { open, close, bind };
})();
