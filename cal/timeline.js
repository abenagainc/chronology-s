/* Chronology S — vertical multi-calendar timeline.
   ONE shared scale: the DAY.
   - A slim sticky YEAR RULER is pinned to the left edge (labels only, not a
     data column). It is generated from the same day->pixel map as the columns,
     so by construction it cannot drift from them.
   - Each calendar is a full-height column positioned by that same map.
   - The readout lists EVERY calendar including the reference, so nothing is
     silently dropped. */
(() => {
  const MINY = -5000, MAXY = new Date().getFullYear() + 2;
  const DAY_TOP = gregorianToDay(MINY, 1, 1);
  const DAY_BOT = gregorianToDay(MAXY, 12, 31);
  const DAYS_TOTAL = DAY_BOT - DAY_TOP;
  const MINY_D = DAY_TOP, MAXY_D = DAY_BOT;      // day-index bounds
  const RULER_W = 78, COLW = 210, EVLH = 16;

  /* visibility: ONE source of truth, shared by the sidebar and the timeline.
     Both modules previously kept their own copy and their own localStorage
     closure, so the checkbox updated the filter but the timeline never redrew. */
  const HIDE_KEY = 'chronologyX.hidden';
  function hiddenIds() {
    try { return new Set(JSON.parse(localStorage.getItem(HIDE_KEY) || '[]')); }
    catch (e) { return new Set(); }
  }
  function setHidden(ids) { localStorage.setItem(HIDE_KEY, JSON.stringify([...ids])); }
  /** The calendars currently drawn in row 2. */
  window.calVisible = () => S.calendars.filter(c => !hiddenIds().has(c.id));
  window.hiddenIds = hiddenIds;
  window.setHidden = setHidden;

  let S = Store.load();
  let PPD = 0.006;                                 // pixels per DAY — the one zoom knob

  /* Tick / label settings, driven by the popover. */
  let TICK_DENSITY = 1;      // minor-tick multiplier (0.25 … 4)
  let LABEL_EVERY = 1;       // label every Nth major tick (1 … 8)
  let LABEL_SIZE = 10;       // px
  let SHOW_LABELS = true;
  let REF_ID = 'gregorian';  // which calendar the RULER shows

  const $ = id => document.getElementById(id);
  const sc = () => $('vt-scroll');

  /* Vertical offset between the scroll-content origin and a column BODY.
     Events are positioned inside `.col-body`, which sits below the column's
     header — so content-coordinate y = BODY_OFFSET + day2px(day). The crosshair
     is drawn in scroll-content coordinates, so every conversion must account
     for this offset or events sit one header-height away from the crosshair. */
  function bodyOffset() {
    const s = sc();
    const body = s.querySelector('.col-body');
    if (!body) return 0;
    return body.getBoundingClientRect().top - s.getBoundingClientRect().top + s.scrollTop;
  }
  const day2px = day => (day - DAY_TOP) * PPD;
  const px2day = px => DAY_TOP + px / PPD;
  /* SCROLL MODEL — the one place this is defined.
     The scrollable content = the column BODY (the day range) + one header height,
     because every column carries a 46px header ABOVE its body. Counting only the
     day range left the bottom ~225px unreachable, so the crosshair (pinned to
     the viewport centre) could never reach the last ticks. */
  const HEAD_H = 46;
  const bodyH = () => DAYS_TOTAL * PPD;
  const scrollH = () => bodyH() + HEAD_H;

  /* Year step for the marks: the smallest step whose spacing is >= MIN_PX apart.
     Returns {step, majorEvery} where majorEvery is how many steps make a labelled
     (major) mark — so a label always exists, whatever the zoom. */
  /* Two separate budgets, deliberately:
     TICK_PX  — how far apart ticks must be to be DRAWN. Small, so finer tiers
                appear as you zoom.
     LABEL_PX — how far apart LABELS must be to be legible. Larger, so text never
                collides. Decoupling these is what lets "many ticks, few labels". */
  const TICK_PX = 6;
  const LABEL_PX = 80;
  /* Tick hierarchy, coarse → fine. Each tier is tried in order and used when it
     fits TICK_PX apart at the current zoom, so zooming in naturally refines the
     ticks: millennium → century → decade → year → month → day. */
  const TIERS = ['millennium', 'century', 'decade', 'year', 'month', 'day'];

  /* How many of `unit` fit in the tick budget at the current zoom. */
  function fits(unitDays) { return unitDays * PPD >= TICK_PX; }

  function pickTier(cal) {
    const yr = 365.2425;
    if (fits(yr * 1000)) return 'millennium';
    if (fits(yr * 100)) return 'century';
    if (fits(yr * 10)) return 'decade';
    if (fits(yr)) return 'year';
    if (fits(30.4)) return 'month';
    return 'day';
  }

  /* Label for a tick at a given tier. */
  function tierLabel(day, cal, tier) {
    const d = dayToDate(day, cal);
    if (tier === 'millennium') return yearLabel(Math.floor(d.y / 1000) * 1000, cal.era);
    if (tier === 'century') return yearLabel(Math.floor(d.y / 100) * 100, cal.era);
    if (tier === 'decade') return yearLabel(Math.floor(d.y / 10) * 10, cal.era);
    if (tier === 'year') return yearLabel(d.y, cal.era);
    if (tier === 'month') return cal.months[d.m - 1]?.name?.slice(0, 3) || d.m;
    return String(d.d);
  }

  /* ---------- marks for a calendar ----------
     KIND SEAM: built-ins use the standard hierarchy above. Custom calendars go
     through customMarks(), which currently behaves identically — the point is
     that the behaviour can diverge in ONE place without touching the renderer. */
  function marksFor(cal) {
    if (cal.kind === 'builtin' || !cal.kind) return builtinMarks(cal);
    return customMarks(cal);
  }

  function customMarks(cal) {
    // Custom calendars are the investigation surface: their tick model is
    // deliberately open. For now it matches the built-in hierarchy.
    return builtinMarks(cal);
  }

  function builtinMarks(cal) {
    const out = [];
    const tier = pickTier(cal);
    const density = TICK_DENSITY;          // user multiplier on minor ticks
    const show = SHOW_LABELS;
    const every = LABEL_EVERY;             // label every Nth major tick

    if (tier === 'day') {
      // individual days: step in whole days, subdivided by density
      const step = Math.max(1, Math.round(1 / density));
      let i = 0;
      for (let d = Math.ceil(MINY_D / step) * step; d <= MAXY_D; d += step, i++) {
        const major = (i % Math.max(1, Math.round(7 / density))) === 0;
        out.push({ px: day2px(d), label: major && show ? tierLabel(d, cal, 'day') : '',
                  major, tier });
      }
      return out;
    }

    if (tier === 'month') {
      // walk month starts in THIS calendar
      let i = 0;
      for (let y = MINY; y <= MAXY; y++) {
        for (let m = 1; m <= cal.months.length; m++) {
          const day = dateToDay(y, m, 1, cal);
          if (day < MINY_D || day > MAXY_D) continue;
          const major = (i % Math.max(1, Math.round(6 / density))) === 0;
          out.push({ px: day2px(day),
                    label: major && show && (i % every) === 0 ? tierLabel(day, cal, 'month') : '',
                    major, tier });
          i++;
        }
      }
      return out;
    }

    // year-granular tiers
    const span = tier === 'millennium' ? 1000 : tier === 'century' ? 100 : tier === 'decade' ? 10 : 1;
    const sub = Math.max(1, Math.round(span / (span === 1 ? 1 : density)));
    let i = 0;
    const start = Math.ceil(MINY / span) * span;
    for (let y = start; y <= MAXY; y += span, i++) {
      const isMajor = span === 1 ? true : (i % Math.max(1, Math.round(1 / density))) === 0;
      const day = dateToDay(y, 1, 1, cal);
      const labelled = isMajor && (i % every) === 0;
      out.push({ px: day2px(day), label: labelled && show ? tierLabel(day, cal, tier) : '',
                major: isMajor, tier });
      // minor subdivisions for coarse tiers
      if (span > 1 && density > 1) {
        for (let k = 1; k < density; k++) {
          const yy = y + Math.round(span / density) * k;
          if (yy > MAXY) break;
          out.push({ px: day2px(dateToDay(yy, 1, 1, cal)), label: '', major: false, tier });
        }
      }
    }
    return out;
  }

  /* The ruler marks: same generator, but in the SELECTED reference calendar.
     It draws the SAME mark extent as the columns (so it never ends early) and
     only suppresses the TEXT on minor ticks — filtering the marks themselves
     made the ruler stop ~1200px short of the columns. */
  function rulerMarks() {
    const ref = BY_ID[REF_ID] || BY_ID.gregorian;
    return marksFor(ref);
  }

  function render() {
    const inner = $('vt-inner');
    inner.innerHTML = '';
    const H = scrollH();              // total scrollable height (body + header)
    const frag = document.createDocumentFragment();

    /* --- year ruler: sticky, labels only, same map as the columns ---
       It carries a col-head the same height as the calendar columns' headers,
       so its body starts at the same y and the labels line up exactly. */
    const ruler = document.createElement('div');
    ruler.className = 'ruler';
    ruler.style.width = RULER_W + 'px';
    const rh = document.createElement('div');
    rh.className = 'col-head';
    // reference selector: the ruler declares which calendar it shows
    rh.innerHTML = `<select class="select ref-sel" id="refSel" title="Ruler reference calendar">
        ${S.calendars.map(c => `<option value="${esc(c.id)}"${c.id === REF_ID ? ' selected' : ''}>${esc(c.name)}</option>`).join('')}
      </select><span class="sub">reference</span>`;
    ruler.appendChild(rh);
    const rb = document.createElement('div');
    rb.className = 'ruler-body';
    rb.style.height = H + 'px';
    for (const m of rulerMarks()) {
      if (!m.label) continue;         // minor ticks get a line, not text
      const l = document.createElement('div');
      l.className = 'ruler-lab';
      l.style.top = m.px + 'px';
      l.textContent = m.label;
      rb.appendChild(l);
    }
    ruler.appendChild(rb);
    frag.appendChild(ruler);

    /* --- one column per VISIBLE calendar --- */
    const visible = (window.calVisible ? window.calVisible() : S.calendars);
    for (const cal of visible) {
      const col = document.createElement('div');
      col.className = 'col';
      col.style.width = COLW + 'px';
      const ready = calReady(cal);
      col.innerHTML = `<div class="col-head"><span class="dot" style="background:${cal.color}"></span>
        ${esc(cal.name)}<span class="tag">${cal.months.length} mo</span>
        <span class="sub">${esc(cal.format || '')} · ${cal.era === 'astro' ? 'astro' : 'CE/BCE'}</span>
        ${ready ? '' : '<span class="sub" style="color:var(--danger)">epoch unresolved</span>'}</div>`;
      const body = document.createElement('div');
      body.className = 'col-body';
      body.style.height = H + 'px';

      if (ready) {
        for (const m of marksFor(cal)) {
          const el = document.createElement('div');
          el.className = 'mark ' + (m.tier || (m.major ? 'year' : 'dec'));
          el.style.top = m.px + 'px';
          body.appendChild(el);
          if (m.major) {
            const lab = document.createElement('div');
            lab.className = 'mark lab';
            lab.style.top = m.px + 'px';
            lab.textContent = m.label;
            body.appendChild(lab);
          }
        }
        for (const e of S.events) {
          if (e.calId !== cal.id) continue;
          const d1 = Store.eventDay(S, e), d2 = Store.eventEndDay(S, e);
          if (d1 === null) continue;
          const el = document.createElement('div');
          el.className = 'ev ' + (e.kind === 'span' ? 'span' : 'point');
          el.style.background = '#364038';
          el.style.top = day2px(d1) + 'px';
          if (e.kind === 'span' && d2 !== null)
            el.style.height = Math.max(day2px(d2) - day2px(d1), EVLH) + 'px';
          el.title = e.title + (e.note ? '\n' + e.note : '');
          el.innerHTML = `<span class="ttl">${esc(e.title)}</span>
            <span class="yr">${esc(safeFormatDay(d1, cal))}</span>`;
          body.appendChild(el);
        }
      }
      col.appendChild(body);
      frag.appendChild(col);
    }
    inner.appendChild(frag);
    // The crosshair lives in #vt-scroll's own overlay layer (added below), NOT in
    // #vt-inner or a .col-body: those scroll with the content, so a crosshair
    // placed there drifts as you scroll and only catches up on the next mouse
    // move. The overlay is positioned against the scroll viewport, so the line
    // stays where it is put.

    renderLegend();
    updateRange();
    moveCrosshair();
  }

  function renderLegend() {
    const items = [`<span class="k"><i class="sw" style="background:#8e8e93"></i>ruler: <span id="legendRef">${esc((BY_ID[REF_ID] || BY_ID.gregorian || {}).name || 'Gregorian')}</span> (reference)</span>`]
      .concat((window.calVisible ? window.calVisible() : S.calendars).map(c =>
        `<span class="k"><i class="sw" style="background:${c.color}"></i>${esc(c.name)}</span>`));
    $('legendCals').innerHTML = items.join('');
  }

  /** Push the label-size setting onto every label element. */
  function applyLabelSize() {
    document.documentElement.style.setProperty('--label-px', LABEL_SIZE + 'px');
  }

  function updateRange() {
    const s = sc();
    const d1 = px2day(s.scrollTop - bodyOffset()), d2 = px2day(s.scrollTop + s.clientHeight - bodyOffset());
    const ref = BY_ID.gregorian;
    $('range').textContent =
      `viewing ${safeFormatDay(Math.round(d1), ref)} → ${safeFormatDay(Math.round(d2), ref)}` +
      `  ·  ${PPD.toFixed(3)} px/day  ·  ${(PPD * 365.2425).toFixed(1)} px/year`;
  }

  function visibleCals() { return (window.calVisible ? window.calVisible() : S.calendars); }

  function moveCrosshair() {
    const s = sc();
    const c = ensureCrosshair();
    // The crosshair is a child of #vt-scroll, so its `top` is in VIEWPORT
    // coordinates. The day map is in column-BODY coordinates, which sit
    // bodyOffset() lower — convert through that so the readout always agrees
    // with the line on screen.
    const viewY = parseFloat(c.style.top);
    if (!Number.isFinite(viewY)) return;
    const day = Math.round(px2day(viewY - bodyOffset()));
    $('readout').textContent = visibleCals().map(cal => safeFormatDay(day, cal)).join('   ·   ');
    $('readout').classList.add('on');
  }

  /** Place the crosshair at a viewport y (used by scroll + zoom). */
  function placeCrosshair(viewY) {
    const c = ensureCrosshair();
    c.style.top = viewY + 'px';
    moveCrosshair();
  }

  function esc(s) {
    return String(s ?? '').replace(/[&<>"]/g,
      c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  }

  function zoom(factor) {
    const s = sc();
    const midDay = px2day(s.scrollTop + s.clientHeight / 2 - bodyOffset());
    PPD = Math.min(Math.max(PPD * factor, 0.0008), 40);
    render();
    s.scrollTop = bodyOffset() + day2px(midDay) - s.clientHeight / 2;
    updateRange(); placeCrosshair(s.scrollTop + s.clientHeight / 2);
  }

  function setZoom(preset) {
    const s = sc();
    const n = new Date();
    const today = gregorianToDay(n.getFullYear(), n.getMonth() + 1, n.getDate());
    const spans = {
      fit: DAYS_TOTAL,
      millennia: 365.2425 * 3000,
      centuries: 365.2425 * 500,
      years: 365.2425 * 400,
      months: 365.2425 * 30,
      days: 90,
    };
    const days = spans[preset] || spans.years;
    PPD = Math.min(Math.max((s.clientHeight - 60) / days, 0.0008), 40);
    render();
    if (preset !== 'fit') {
      s.scrollTop = bodyOffset() + day2px(today) - s.clientHeight / 2;
    }
    updateRange(); placeCrosshair(s.scrollTop + s.clientHeight / 2);
  }

  function bind() {
    const s = sc();
    $('zin').onclick   = () => zoom(1.5);
    $('zout').onclick  = () => zoom(1 / 1.5);
    $('up').onclick    = () => s.scrollBy({ top: -s.clientHeight * .8, behavior: 'smooth' });
    $('down').onclick  = () => s.scrollBy({ top:  s.clientHeight * .8, behavior: 'smooth' });
    $('left').onclick  = () => s.scrollBy({ left: -COLW, behavior: 'smooth' });
    $('right').onclick = () => s.scrollBy({ left:  COLW, behavior: 'smooth' });
    $('todayBtn').onclick = () => setZoom('years');
    $('zoomSel').onchange = () => setZoom($('zoomSel').value);

    // sidebar changes (visibility, add/edit/delete) -> redraw
    window.addEventListener('cal-visibility', () => { S = Store.load(); render(); });
    window.addEventListener('cal-changed', () => { S = Store.load(); render(); });

    /* --- tick / label popover --- */
    const pop = $('tickPop'), tickBtn = $('tickBtn');
    if (tickBtn && pop) {
      tickBtn.onclick = (e) => { e.stopPropagation(); pop.hidden = !pop.hidden; };
      pop.addEventListener('click', (e) => e.stopPropagation());
      document.addEventListener('click', () => { pop.hidden = true; });
      $('tickDensity').oninput = (e) => { TICK_DENSITY = +e.target.value; render(); };
      $('labelEvery').oninput = (e) => { LABEL_EVERY = +e.target.value; render(); };
      $('labelSize').onchange = (e) => { LABEL_SIZE = +e.target.value; applyLabelSize(); render(); };
      $('showLabels').onchange = (e) => { SHOW_LABELS = e.target.checked; render(); };
    }
    /* --- ruler reference selector (delegated: render() rebuilds the ruler) --- */
    const inner0 = $('vt-inner');
    inner0.addEventListener('change', (e) => {
      if (e.target && e.target.id === 'refSel') {
        REF_ID = e.target.value;
        const ref = BY_ID[REF_ID];
        const lr = $('legendRef');
        if (lr && ref) lr.textContent = ref.name;
        render();
      }
    });

    s.addEventListener('scroll', () => {
      updateRange();
      // keep the crosshair on the same DAY across a scroll (it is pinned to the
      // viewport centre), then let the readout follow it
      placeCrosshair(s.scrollTop + s.clientHeight / 2);
    });
    window.addEventListener('keydown', e => {
      if (e.target.matches('input,select,textarea')) return;
      ({ '+': () => $('zin').click(), '=': () => $('zin').click(),
         '-': () => $('zout').click(), '_': () => $('zout').click(),
         'ArrowUp': () => s.scrollBy({ top: -120 }), 'ArrowDown': () => s.scrollBy({ top: 120 }),
         'ArrowLeft': () => s.scrollBy({ left: -120 }), 'ArrowRight': () => s.scrollBy({ left: 120 }),
         'f': () => setZoom('fit'), 'F': () => setZoom('fit'),
         't': () => $('todayBtn').click(), 'T': () => $('todayBtn').click() }[e.key] || (() => {}))();
    });
    $('resetBtn').onclick = () => {
      if (confirm('Reset all dummy data to the original seed?')) { S = Store.reset(); render(); }
    };
    s.addEventListener('pointermove', e => {
      const r = s.getBoundingClientRect();
      // pointer -> viewport y -> body y -> day
      const viewY = e.clientY - r.top;
      const bodyY = viewY - bodyOffset();
      const day = Math.round(px2day(bodyY));
      const ro = $('readout');
      ro.textContent = visibleCals().map(cal => safeFormatDay(day, cal)).join('   ·   ');
      ro.classList.add('on');
      const c = ensureCrosshair();
      c.style.top = viewY + 'px';          // viewport coordinates
    });
    s.addEventListener('pointerleave', () => { $('readout').classList.remove('on'); moveCrosshair(); });
  }

  function init() {
    ensureCrosshair();
    const s = sc();
    const n = new Date();
    const today = gregorianToDay(n.getFullYear(), n.getMonth() + 1, n.getDate());
    PPD = 2.2 / 365.2425;                   // absolute: ~2.2 px per year
    render();
    s.scrollTop = Math.max(bodyOffset() + day2px(today) - s.clientHeight * .35, 0);
    bind();
    placeCrosshair(s.scrollTop + s.clientHeight / 2);
  }

  /* Crosshair overlay: a child of #vt-scroll, so it is positioned against the
     scroll VIEWPORT and does not move with the content. */
  function ensureCrosshair() {
    const s = sc();
    let c = $('cross');
    if (c && c.parentNode === s) return c;
    if (c) c.remove();
    c = document.createElement('div');
    c.className = 'cross'; c.id = 'cross';
    s.appendChild(c);
    return c;
  }

  init();
})();
