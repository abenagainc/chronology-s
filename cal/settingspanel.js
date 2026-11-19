/* Chronology S — the ⚙ global settings panel.
   Timeline VIEW variables only: widths, tick thresholds/colours, per-unit label
   size + format, and calendar ordering. */
window.SettingsPanel = (() => {
  const $ = id => document.getElementById(id);
  const esc = s => String(s ?? '').replace(/[&<>"]/g,
    c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const UNITS = [
    ['millennium', 'Millennium'], ['century', 'Century'], ['decade', 'Decade'],
    ['year', 'Year'], ['month', 'Month'], ['day', 'Day'],
  ];
  const NUM = (v, lo, hi) => Math.min(Math.max(Number(v) || lo, lo), hi);

  function build() {
    const st = Settings.get();
    const col = (label, id, type, attrs = '') =>
      `<label class="gs-row"><span>${esc(label)}</span>` +
      `<input id="${id}" type="${type}" ${attrs}></label>`;

    const unitRows = UNITS.map(([key, label]) => {
      const u = st.units[key] || {};
      const fmtOpts = key === 'month'
        ? `<option value="name"${u.fmt === 'name' ? ' selected' : ''}>month name</option>
           <option value="MM"${u.fmt === 'MM' ? ' selected' : ''}>MM</option>`
        : `<option value="${esc(u.fmt || 'YYYY')}" selected>${esc(u.fmt || 'YYYY')}</option>`;
      return `<div class="gs-unit">
        <span class="gs-unit-name">${esc(label)}</span>
        <input id="gs_size_${key}" type="number" min="6" max="24" step="0.5"
               value="${esc(u.size)}" title="label size (px)">
        <select id="gs_fmt_${key}">${fmtOpts}</select>
      </div>`;
    }).join('');

    $('settingsBody').innerHTML = `
      <div class="gs-sec">Layout</div>
      ${col('Calendar width', 'gs_calWidth', 'number', 'min="120" max="400" step="10"')}
      ${col('Ruler width', 'gs_rulerWidth', 'number', 'min="40" max="160" step="1"')}

      <div class="gs-sec">Minor ticks (no label)</div>
      ${col('Shown at or above', 'gs_minorLimit', 'number', 'min="1" max="60" step="1"')}
      ${col('Colour', 'gs_minorColor', 'color', 'class="gs-color"')}
      ${col('Thickness', 'gs_minorThickness', 'number', 'min="1" max="5" step="1"')}

      <div class="gs-sec">Major ticks (with label)</div>
      ${col('Labelled at or above', 'gs_majorLimit', 'number', 'min="5" max="400" step="5"')}
      ${col('Colour', 'gs_majorColor', 'color', 'class="gs-color"')}
      ${col('Thickness', 'gs_majorThickness', 'number', 'min="1" max="6" step="1"')}

      <div class="gs-sec">Time units — label size &amp; format</div>
      ${unitRows}

      <div class="gs-sec">Calendar order <span class="gs-hint">drag to reorder</span></div>
      <div id="gs_order" class="gs-order"></div>`;

    // wire the numeric/colour inputs
    const bind = (id, path, lo, hi) => {
      const el = $(id); if (!el) return;
      el.onchange = () => { Settings.set(path, NUM(el.value, lo, hi)); window.dispatchEvent(new Event('cal-changed')); };
    };
    bind('gs_calWidth', 'calWidth', 120, 400);
    bind('gs_rulerWidth', 'rulerWidth', 40, 160);
    bind('gs_minorLimit', 'minorLimitPx', 1, 60);
    bind('gs_minorThickness', 'minorThickness', 1, 5);
    bind('gs_majorLimit', 'majorLimitPx', 5, 400);
    bind('gs_majorThickness', 'majorThickness', 1, 6);
    [['gs_minorColor', 'minorColor'], ['gs_majorColor', 'majorColor']].forEach(([id, p]) => {
      const el = $(id); if (!el) return;
      el.oninput = () => { Settings.set(p, el.value); window.dispatchEvent(new Event('cal-changed')); };
    });
    UNITS.forEach(([key]) => {
      const sz = $('gs_size_' + key), fm = $('gs_fmt_' + key);
      if (sz) sz.onchange = () => { Settings.set(`units.${key}.size`, NUM(sz.value, 6, 24)); window.dispatchEvent(new Event('cal-changed')); };
      if (fm) fm.onchange = () => { Settings.set(`units.${key}.fmt`, fm.value); window.dispatchEvent(new Event('cal-changed')); };
    });

    renderOrder();
  }

  /** Draggable ordered list of calendars. */
  function renderOrder() {
    const box = $('gs_order');
    if (!box) return;
    const cals = Settings.ordered(Store.load().calendars);
    box.innerHTML = cals.map(c =>
      `<div class="gs-cal" draggable="true" data-id="${esc(c.id)}">
         <span class="gs-grip">⠿</span>
         <span class="gs-dot" style="background:${esc(c.color || '#888')}"></span>
         <span class="gs-name">${esc(c.name)}</span>
         <span class="gs-type">${esc(c.type || 'builtin')}</span>
       </div>`).join('');

    let dragId = null;
    box.querySelectorAll('.gs-cal').forEach(el => {
      el.addEventListener('dragstart', () => { dragId = el.dataset.id; el.classList.add('dragging'); });
      el.addEventListener('dragend', () => { el.classList.remove('dragging'); });
      el.addEventListener('dragover', e => { e.preventDefault(); el.classList.add('over'); });
      el.addEventListener('dragleave', () => el.classList.remove('over'));
      el.addEventListener('drop', e => {
        e.preventDefault(); el.classList.remove('over');
        if (!dragId || dragId === el.dataset.id) return;
        const ids = [...box.querySelectorAll('.gs-cal')].map(x => x.dataset.id);
        const from = ids.indexOf(dragId), to = ids.indexOf(el.dataset.id);
        ids.splice(from, 1); ids.splice(to, 0, dragId);
        Settings.setOrder(ids);
        renderOrder();
        window.dispatchEvent(new Event('cal-changed'));
      });
    });
  }

  function sync() {
    const st = Settings.get();
    const put = (id, v) => { const el = $(id); if (el && el.value != v) el.value = v; };
    put('gs_calWidth', st.calWidth); put('gs_rulerWidth', st.rulerWidth);
    put('gs_minorLimit', st.minorLimitPx); put('gs_majorLimit', st.majorLimitPx);
    put('gs_minorThickness', st.minorThickness); put('gs_majorThickness', st.majorThickness);
    put('gs_minorColor', st.minorColor); put('gs_majorColor', st.majorColor);
    UNITS.forEach(([key]) => {
      const u = st.units[key] || {};
      put('gs_size_' + key, u.size);
      const fm = $('gs_fmt_' + key);
      if (fm && fm.value !== (u.fmt || '')) fm.value = u.fmt || 'YYYY';
    });
  }

  function open() { build(); $('settingsPanel').hidden = false; }
  function close() { $('settingsPanel').hidden = true; }
  function toggle() { const p = $('settingsPanel'); p.hidden ? open() : close(); }

  function bindGear() {
    const gear = $('gearBtn');
    if (gear) gear.onclick = (e) => { e.stopPropagation(); toggle(); };
    const panel = $('settingsPanel');
    if (panel) panel.addEventListener('click', e => e.stopPropagation());
    const x = $('settingsClose');
    if (x) x.onclick = close;
    document.addEventListener('click', () => { const p = $('settingsPanel'); if (p && !p.hidden) close(); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });
  }

  return { bindGear, open, close, toggle, sync, renderOrder };
})();
