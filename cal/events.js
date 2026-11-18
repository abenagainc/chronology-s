/* Chronology S — event CRUD. An event lives in ONE calendar; the UI shows the
   equivalent day in every other calendar.
   The drawer itself lives in cal/eventeditor.js (shared with the region-3
   events panel); this file owns the full-page table. */
(() => {
  let S = Store.load();

  const $ = id => document.getElementById(id);
  const esc = s => String(s ?? '').replace(/[&<>"]/g,
    c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  function cal(id) { return BY_ID[id] || S.calendars.find(c => c.id === id); }

  function render() {
    S = Store.load();
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
      tr.innerHTML = `
        <td class="grow"><div class="ttl">${esc(e.title || '(untitled)')}</div>
          ${e.note ? `<div class="note">${esc(e.note)}</div>` : ''}</td>
        <td>${c ? `<i class="sw" style="background:${c.color}"></i> ${esc(c.name)}` : '—'}</td>
        <td class="mono">${c ? esc(safeFormatDay(day, c)) : '—'}</td>
        <td>${others.length ? `<div class="other">${others.map(o =>
          `<div class="line"><i class="sw" style="background:${o.color}"></i>${esc(formatDay(day, o))}
           <span class="nm">${esc(o.name)}</span></div>`).join('')}</div>` : '—'}</td>
        <td><button class="btn ghost sm" data-a="edit">✎</button>
            <button class="btn ghost sm" data-a="del">✕</button></td>`;
      tr.querySelector('[data-a=edit]').onclick = () => window.EventEditor.open(e);
      tr.querySelector('[data-a=del]').onclick = () => {
        if (!confirm(`Delete "${e.title || 'event'}"?`)) return;
        Store.deleteEvent(S, e.id);
        render();
        window.dispatchEvent(new CustomEvent('cal-visibility'));
      };
      tb.appendChild(tr);
    }
  }

  $('newEvtBtn').onclick = () => window.EventEditor.open(null);
  $('q').oninput = render;
  $('resetBtn').onclick = () => {
    if (confirm('Reset all dummy data?')) { Store.reset(); render(); }
  };
  window.addEventListener('cal-changed', render);
  window.addEventListener('cal-visibility', render);

  render();
})();
