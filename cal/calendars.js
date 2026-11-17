/* Chronology X — calendar CRUD + rule editor */
(() => {
  let S = Store.load();
  let editing = null;          // calendar being edited
  let draft = null;            // working copy in the drawer

  const $ = id => document.getElementById(id);
  const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));

  /* ---------------- list ---------------- */
  function render() {
    const list = $('calList');
    list.innerHTML = '';
    $('empty').hidden = S.calendars.length > 0;

    for (const c of S.calendars) {
      const y1 = dayToDate(gregorianToDay(1, 1, 1), c);          // its own 1/1/1
      const card = document.createElement('div');
      card.className = 'card';
      card.innerHTML = `
        <div class="top-row">
          <span class="dot" style="background:${c.color}"></span>
          <span class="name">${esc(c.name)}</span>
          <span class="kind">${esc(c.kind)}</span>
        </div>
        <div class="desc">${esc(c.note || summary(c))}</div>
        <div class="meta">
          <span>${c.months.length} months</span>
          <span>year ${daysInYear(1, c)} d${isLeapYear(1, c) ? ' (leap)' : ''}</span>
          <span>epoch ${esc(c.epoch.join('/'))}${c.epochCal ? ' (' + esc(c.epochCal) + ')' : ''}</span>
          <span>fmt ${esc(c.format || '')}</span>
          <span>leap ${esc(leapText(c.leap))}</span>
        </div>
        <div class="acts">
          <button class="btn sm" data-a="edit">edit</button>
          <button class="btn sm ghost" data-a="dup">duplicate</button>
          <button class="btn sm danger" data-a="del">delete</button>
        </div>`;
      card.querySelector('[data-a=edit]').onclick = () => openEditor(c);
      card.querySelector('[data-a=dup]').onclick = () => {
        const copy = JSON.parse(JSON.stringify(c));
        copy.name = c.name + ' (copy)';
        Store.addCalendar(S, copy);
        S = Store.load(); render();
      };
      card.querySelector('[data-a=del]').onclick = () => {
        if (!confirm(`Delete "${c.name}" and its ${S.events.filter(e => e.calId === c.id).length} event(s)?`)) return;
        Store.deleteCalendar(S, c.id);
        S = Store.load(); render();
      };
      list.appendChild(card);
    }
    $('storeChip').textContent = `${S.calendars.length} calendars · ${S.events.length} events`;
  }
  function summary(c) {
    const mn = c.months.map(m => m.name.slice(0, 3)).join(' ');
    return `${mn} — ${c.months.reduce((a, m) => a + m.days, 0)} days/year base`;
  }
  function leapText(l) {
    if (!l || l.kind === 'none') return 'none';
    if (l.kind === 'every4') return l.gregorianCentury ? '4/100/400' : 'every 4';
    return `${l.years.length} in ${l.cycle}`;
  }

  /* ---------------- editor ---------------- */
  function openEditor(cal) {
    editing = cal;
    draft = JSON.parse(JSON.stringify(cal || presetCal('blank')));
    draft.id = undefined;                        // assigned on save
    $('drawerTitle').textContent = cal ? 'Edit calendar' : 'New calendar';
    $('delBtn').hidden = !cal;
    $('drawer').hidden = false;
    $('drawer').style.display = 'flex';
    $('scrim').hidden = false;
    fillEpochOptions();
    fillEditor();
    preview();
  }
  function closeEditor() {
    $('drawer').hidden = true; $('drawer').style.display = 'none';
    $('scrim').hidden = true; editing = null; draft = null;
  }

  function fillEpochOptions() {
    $('fEpochCal').innerHTML = S.calendars.map(c =>
      `<option value="${esc(c.id)}">${esc(c.name)}</option>`).join('');
  }
  /** Populate the epoch month/day selects from the chosen epoch calendar. */
  function fillEpochDateOptions() {
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
    $('fName').value = draft.name || '';
    $('fEra').value = draft.era || 'ce';
    $('fFmt').value = draft.format || 'YYYY-MM-DD';
    $('fColor').value = draft.color || '#4f7cdf';
    // epoch: stated in another calendar
    if (draft.epochCal && S.calendars.some(c => c.id === draft.epochCal)) {
      $('fEpochCal').value = draft.epochCal;
    } else {
      $('fEpochCal').value = S.calendars.find(c => c.id !== draft.id)?.id || S.calendars[0]?.id || '';
    }
    const ed = draft.epochDate || draft.epoch || [1, 1, 1];
    $('fEpochY').value = ed[0];
    // months
    const tb = $('monthTable').querySelector('tbody');
    tb.innerHTML = '';
    draft.months.forEach((m, i) => addMonthRow(m.name, m.days, i));
    // leap
    const lk = draft.leap?.kind || 'none';
    document.querySelector(`input[name=leap][value="${lk}"]`).checked = true;
    $('fLeapCycle').value = draft.leap?.cycle || 30;
    $('fLeapYears').value = (draft.leap?.years || []).join(',');
    // presets
    $('presets').innerHTML = PRESETS.map(p =>
      `<button class="preset" data-p="${p.id}">${p.label}</button>`).join('');
    $('presets').querySelectorAll('.preset').forEach(b => b.onclick = () => applyPreset(b.dataset.p));
    fillEpochDateOptions();
  }

  function addMonthRow(name, days, idx) {
    const tb = $('monthTable').querySelector('tbody');
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${idx + 1}</td>
      <td class="nm"><input type="text" value="${esc(name)}"></td>
      <td class="dy"><input type="number" min="1" max="40" value="${days}"></td>
      <td><button class="btn x" title="remove">✕</button></td>`;
    tr.querySelector('.x').onclick = () => tr.remove();
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
    draft.months = [...$('monthTable').querySelectorAll('tbody tr')].map(tr => ({
      name: tr.querySelector('.nm input').value.trim() || 'Month',
      days: Math.max(1, +tr.querySelector('.dy input').value || 1),
    }));
    const lk = document.querySelector('input[name=leap]:checked').value;
    if (lk === 'none') draft.leap = { kind: 'none' };
    else if (lk === 'every4') draft.leap = { kind: 'every4', gregorianCentury: true };
    else draft.leap = { kind: 'custom', cycle: +$('fLeapCycle').value || 30,
                        years: $('fLeapYears').value.split(',').map(s => parseInt(s, 10)).filter(n => n > 0) };
    // leap month placeholder: a leap day after the last month
    draft.leapMonths = (draft.leap?.kind && draft.leap.kind !== 'none')
      ? [{ name: 'Leap day', days: 1, afterMonth: draft.months.length - 1 }] : [];
  }

  function preview() {
    readEditor();
    const g = $('previewG'); g.innerHTML = '';
    $('fErr').textContent = ''; $('fMonthsErr').textContent = ''; $('fEpochErr').textContent = '';
    // rebuild a registry with the draft in it
    const reg = S.calendars.filter(c => c.id !== editing?.id).map(c => JSON.parse(JSON.stringify(c)));
    const d = JSON.parse(JSON.stringify(draft));
    d.id = editing?.id || 'draft';
    reg.push(d);
    registerCalendars(reg);
    const D = BY_ID[d.id];
    if (!D) { $('fErr').textContent = 'cannot resolve'; return; }
    if (!draft.months.length) { $('fMonthsErr').textContent = 'add at least one month'; return; }
    if (!validDate(d.epochDate[0], d.epochDate[1], d.epochDate[2], BY_ID[d.epochCal])) {
      $('fEpochErr').textContent = `epoch is not a valid date in ${d.epochCal}`;
    }
    // show: its own new year + a round trip + equivalent in the other calendars
    const probes = [1, 100, 500, 1000].filter(y => y <= 3000);
    let html = '';
    for (const y of probes) {
      const day = dateToDay(y, 1, 1, D);
      const back = dayToDate(day, D);
      html += `<div>${y}/1/1 → ${formatDay(day, D)} <span style="color:var(--muted)">(${back.y}/${back.m}/${back.d})</span></div>`;
    }
    for (const c of reg.filter(c => c.id !== d.id)) {
      const day = D.epochDay;
      html += `<div style="color:var(--muted)">epoch in ${esc(c.name)}: ${formatDay(day, c)}</div>`;
    }
    g.innerHTML = html;
    $('leapHint').textContent = `year length: ${daysInYear(1, D)} days (common), ${daysInYear(2, D)} in year 2`;
  }

  function save() {
    try {
      readEditor();
      if (!draft.name) { $('fErr').textContent = 'name is required'; return; }
      if (!draft.months.length) { $('fMonthsErr').textContent = 'add at least one month'; return; }
      // Resolve the epoch into an absolute day BEFORE storing. The stored
      // calendar must be self-contained: later loads must not depend on which
      // other calendars happen to exist.
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
      // dateToDay() already returns a day index (ref.epochDay is an index) —
      // subtracting DAY0 here would double-offset by 2,461,315 days.
      d.epochDay = dateToDay(d.epochDate[0], d.epochDate[1], d.epochDate[2], ref);
      const payload = { ...d };
      delete payload.id;
      if (editing) Store.updateCalendar(S, editing.id, payload);
      else Store.addCalendar(S, payload);
      S = Store.load();
      closeEditor(); render();
    } catch (e) {
      $('fErr').textContent = 'save failed: ' + e.message;
    }
  }

  /* ---------------- wire ---------------- */
  window.addEventListener('error', e => {
    const d = document.getElementById('pageErr');
    if (d) { d.hidden = false; d.textContent = 'Error: ' + e.message + ' @ ' + (e.filename || '').split('/').pop() + ':' + e.lineno; }
  });
  $('newCalBtn').onclick = () => openEditor(null);
  $('drawerClose').onclick = closeEditor;
  $('scrim').onclick = closeEditor;
  $('cancelBtn').onclick = closeEditor;
  $('saveBtn').onclick = save;
  $('delBtn').onclick = () => {
    if (!editing) return;
    if (!confirm(`Delete "${editing.name}"?`)) return;
    Store.deleteCalendar(S, editing.id); S = Store.load(); closeEditor(); render();
  };
  $('addMonth').onclick = () => addMonthRow('Month', 30);
  $('addLeapMonth').onclick = () => addMonthRow('Leap month', 5);
  $('resetBtn').onclick = () => { if (confirm('Reset all dummy data?')) { S = Store.reset(); render(); } };
  $('fEpochCal').onchange = () => { fillEpochDateOptions(); preview(); };
  document.querySelectorAll('input[name=leap]').forEach(r => r.onchange = preview);
  ['fName','fFmt','fLeapCycle','fLeapYears','fEpochY','fEpochD'].forEach(id =>
    $(id).addEventListener('input', preview));
  $('fEpochM').addEventListener('change', preview);
  $('monthTable').addEventListener('input', preview);
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !$('drawer').hidden) closeEditor(); });

  render();
})();
