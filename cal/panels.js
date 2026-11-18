/* Chronology S — collapsible regions 2 and 3, resizable by dragging, and the
   region-3 events panel.
   Rule: only ONE of the two is open at a time; both may be closed.
   Default: region 2 (calendars) open, region 3 (events) closed. */
(() => {
  const $ = id => document.getElementById(id);
  const KEY = 'chronologyX.panels';
  const MIN = 180, MAX = 560;

  function state() {
    try { return JSON.parse(localStorage.getItem(KEY)) || null; } catch (e) { return null; }
  }
  function save(s) { localStorage.setItem(KEY, JSON.stringify(s)); }
  const def = () => ({ side: true, ev: false, sideW: 284, evW: 260 });

  function apply(s, persist = true) {
    if (s.side && s.ev) s.ev = false;                 // never both open
    $('sidePanel').style.display = s.side ? '' : 'none';
    $('sidePanel').style.width = s.sideW + 'px';
    $('sidePanel').style.flexBasis = s.sideW + 'px';
    $('railSide').hidden = s.side;
    $('evPanel').style.display = s.ev ? '' : 'none';
    $('evPanel').style.width = s.evW + 'px';
    $('evPanel').style.flexBasis = s.evW + 'px';
    $('railEv').hidden = s.ev;
    // the arrow points the way the panel will open
    $('railSide').querySelector('.rail-arrow').textContent = '‹';
    $('railEv').querySelector('.rail-arrow').textContent = '›';
    if (persist) save(s);
    window.dispatchEvent(new Event('panels-changed'));
  }

  function current() { return Object.assign(def(), state() || {}); }

  function toggle(which) {
    const s = current();
    if (s[which]) { s[which] = false; }               // close; both may be closed
    else { s.side = which === 'side'; s.ev = which === 'ev'; }  // opening closes the other
    apply(s);
  }

  $('railSide').onclick = () => toggle('side');
  $('railEv').onclick = () => toggle('ev');

  /* ---- drag to resize ---- */
  function drag(bar, panel, key) {
    bar.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      bar.classList.add('on');
      const startX = e.clientX;
      const startW = panel.getBoundingClientRect().width;
      const move = (ev) => {
        const s = current();
        const w = Math.min(MAX, Math.max(MIN, startW + (ev.clientX - startX)));
        s[key] = w;
        panel.style.width = w + 'px';
        panel.style.flexBasis = w + 'px';
        window.dispatchEvent(new Event('panels-changed'));
      };
      const up = () => {
        bar.classList.remove('on');
        const s = current();
        save(s);
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', up);
      };
      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', up);
    });
  }
  drag($('dragSide'), $('sidePanel'), 'sideW');
  drag($('dragEv'), $('evPanel'), 'evW');

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
    box.innerHTML = rows.map(({ e }) => {
      const c = S.calendars.find(x => x.id === e.calId);
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
      };
    });
  }

  const sel = document.getElementById('evFilter');
  if (sel) sel.onchange = (e) => { filter = e.target.value; render(); };
  const add = document.getElementById('evAddBtn');
  if (add) add.onclick = () => { if (window.EventEditor) window.EventEditor.open(null); };

  ['cal-changed', 'cal-visibility', 'panels-changed'].forEach(ev =>
    window.addEventListener(ev, refresh));

  render();
  return { render, refresh };
})();
