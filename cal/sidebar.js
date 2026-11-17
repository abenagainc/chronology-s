/* Chronology S — left sidebar: the calendar list.
   Show/hide toggles the column on the timeline; edit/duplicate/delete open the
   same drawer the old Calendars page used. Lives on the timeline page now. */
(() => {
  const $ = id => document.getElementById(id);
  const esc = s => String(s ?? '').replace(/[&<>"]/g,
    c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  let S = Store.load();

  /* visibility lives outside the calendar objects: hiding a calendar is a view
     choice, not an edit to the calendar. */
  function hidden() {
    try { return new Set(JSON.parse(localStorage.getItem('chronologyX.hidden') || '[]')); }
    catch (e) { return new Set(); }
  }
  function saveHidden(set) { localStorage.setItem('chronologyX.hidden', JSON.stringify([...set])); }

  function render() {
    const list = $('calList');
    list.innerHTML = '';
    const off = hidden();

    for (const c of S.calendars) {
      const isOff = off.has(c.id);
      const item = document.createElement('div');
      item.className = 'cal-item' + (isOff ? ' off' : '');
      item.innerHTML = `
        <button class="cb" role="checkbox" aria-checked="${!isOff}"
                title="${isOff ? 'Show on timeline' : 'Hide from timeline'}"></button>
        <span class="dot" style="background:${esc(c.color)}"></span>
        <span class="txt">
          <span class="t">${esc(c.name)}</span>
          <span class="s">${esc(c.kind === 'builtin' ? 'built-in' : 'custom')} · ${c.months.length} months</span>
        </span>
        <span class="acts">
          <button class="btn ghost" data-a="edit" title="Edit">✎</button>
          <button class="btn ghost" data-a="dup" title="Duplicate">⧉</button>
          <button class="btn ghost" data-a="del" title="Delete">✕</button>
        </span>`;
      item.querySelector('.cb').onclick = () => {
        const set = hidden();
        if (set.has(c.id)) set.delete(c.id); else set.add(c.id);
        saveHidden(set);
        render();
        window.dispatchEvent(new CustomEvent('cal-visibility'));
      };
      item.querySelector('[data-a=edit]').onclick = () => CalEditor.open(c);
      item.querySelector('[data-a=dup]').onclick = () => {
        const copy = JSON.parse(JSON.stringify(c));
        copy.name = c.name + ' (copy)';
        Store.addCalendar(S, copy);
        S = Store.load();
        render();
        window.dispatchEvent(new CustomEvent('cal-visibility'));
      };
      item.querySelector('[data-a=del]').onclick = () => {
        const n = S.events.filter(e => e.calId === c.id).length;
        if (!confirm(`Delete "${c.name}"${n ? ` and its ${n} event(s)` : ''}?`)) return;
        Store.deleteCalendar(S, c.id);
        S = Store.load();
        render();
        window.dispatchEvent(new CustomEvent('cal-visibility'));
      };
      list.appendChild(item);
    }

    const shown = S.calendars.filter(c => !off.has(c.id)).length;
    $('viewCount').textContent = `${shown} of ${S.calendars.length} shown`;
  }

  /* The timeline asks us which calendars to draw. */
  window.calVisible = () => S.calendars.filter(c => !hidden().has(c.id));

  $('newCalBtn').onclick = () => CalEditor.open(null);
  $('resetBtn').onclick = () => {
    if (!confirm('Reset all dummy data to the original seed?')) return;
    localStorage.removeItem('chronologyX.hidden');
    S = Store.reset();
    render();
    window.dispatchEvent(new CustomEvent('cal-visibility'));
  };

  render();
})();
