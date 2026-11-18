/* Chronology S — collapsible regions 2 and 3, and the region-3 events panel.
   Rule: only ONE of the two is open at a time; both may be closed.
   Default: region 2 (calendars) open, region 3 (events) closed. */
(() => {
  const $ = id => document.getElementById(id);
  const KEY = 'chronologyX.panels';

  function state() {
    try { return JSON.parse(localStorage.getItem(KEY)) || null; } catch (e) { return null; }
  }
  function save(s) { localStorage.setItem(KEY, JSON.stringify(s)); }

  /** s = { side: bool, ev: bool } — enforcing one-open-at-a-time. */
  function apply(s, persist = true) {
    // invariant: never both open
    if (s.side && s.ev) s.ev = false;
    $('sidePanel').style.display = s.side ? '' : 'none';
    $('railSide').hidden = s.side;
    $('evPanel').style.display = s.ev ? '' : 'none';
    $('railEv').hidden = s.ev;
    if (persist) save(s);
    window.dispatchEvent(new Event('panels-changed'));
  }

  function current() {
    const s = state();
    return s || { side: true, ev: false };        // default: calendars open
  }

  function toggle(which) {
    const s = current();
    const want = !s[which];
    if (want) {                                    // opening one closes the other
      s.side = which === 'side';
      s.ev = which === 'ev';
    } else {
      s[which] = false;                            // closing: both may be closed
    }
    apply(s);
  }

  $('collapseSide').onclick = () => toggle('side');
  $('collapseEv').onclick = () => toggle('ev');
  $('railSide').onclick = () => toggle('side');
  $('railEv').onclick = () => toggle('ev');

  apply(current(), false);
})();

/* Region 3 contents: the events list — compact rows, chronological, filterable. */
window.EventsPanel = (() => {
  const esc = s => String(s ?? '').replace(/[&<>"]/g,
    c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  let S = Store.load();
  let filter = '';

  function refresh() { S = Store.load(); render(); }

  function renderFilter() {
    const sel = document.getElementById('evFilter');
    const list = S.calendars.map(c =>
      `<option value="${esc(c.id)}"${c.id === filter ? ' selected' : ''}>${esc(c.name)}</option>`).join('');
    sel.innerHTML = `<option value="">All events</option>` + list;
  }

  function render() {
    const box = document.getElementById('evList');
    if (!box) return;
    renderFilter();
    const rows = S.events
      .map(e => ({ e, day: Store.eventDay(S, e) }))
      .filter(r => r.day !== null)
      .filter(r => !filter || r.e.calId === filter)
      .sort((a, b) => a.day - b.day);

    if (!rows.length) {
      box.innerHTML = '<div class="sec-empty">no events</div>';
      return;
    }
    box.innerHTML = rows.map(({ e, day }) => {
      const c = S.calendars.find(x => x.id === e.calId);
      const d = e.date || {};
      const native = c ? safeFormatDay(Store.eventDay(S, e), c) : '—';
      return `<div class="ev-card">
        <div class="t">${esc(e.title || '(untitled)')}</div>
        <div class="d">${esc(native)} · ${esc(c ? c.name : '?')}</div>
        <div class="row">
          <span class="sp"></span>
          <button class="btn ghost" data-a="edit" title="Edit">✎</button>
          <button class="btn ghost" data-a="del" title="Delete">✕</button>
        </div>
      </div>`;
    }).join('');

    box.querySelectorAll('.ev-card').forEach((card, i) => {
      const { e } = rows[i];
      card.querySelector('[data-a=edit]').onclick = () => {
        if (window.EventEditor) window.EventEditor.open(e);
      };
      card.querySelector('[data-a=del]').onclick = () => {
        if (!confirm(`Delete "${e.title || 'event'}"?`)) return;
        Store.deleteEvent(S, e.id);
        refresh();
        window.dispatchEvent(new Event('cal-visibility'));
      };
    });
  }

  const sel = document.getElementById('evFilter');
  if (sel) sel.onchange = (e) => { filter = e.target.value; render(); };

  window.addEventListener('cal-changed', refresh);
  window.addEventListener('cal-visibility', refresh);
  window.addEventListener('panels-changed', refresh);

  render();
  return { render, refresh };
})();
