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
  const RULER_W = 78, COLW = 210, EVLH = 16;

  let S = Store.load();
  let PPD = 0.006;                                 // pixels per DAY — the one zoom knob

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
  const bodyH = () => DAYS_TOTAL * PPD;

  /* Year step for the marks: the smallest step whose spacing is >= MIN_PX apart.
     Returns {step, majorEvery} where majorEvery is how many steps make a labelled
     (major) mark — so a label always exists, whatever the zoom. */
  const MIN_PX = 80;
  function yearStep() {
    const pxPerYear = 365.2425 * PPD;
    const steps = [1, 2, 5, 10, 25, 50, 100, 200, 500, 1000, 2000, 5000, 10000];
    let step = steps[steps.length - 1];
    for (const s of steps) { if (pxPerYear * s >= MIN_PX) { step = s; break; } }
    // label every Nth mark so labels stay >= MIN_PX apart
    let majorEvery = 1;
    while (pxPerYear * step * majorEvery < MIN_PX * 1.6 && majorEvery < 10) majorEvery++;
    return { step, majorEvery };
  }

  /* ---------- per-calendar year marks ---------- */
  function marksFor(cal) {
    const out = [];
    const { step, majorEvery } = yearStep();
    let i = 0;
    for (let y = Math.ceil(MINY / step) * step; y <= MAXY; y += step, i++) {
      const major = (i % majorEvery) === 0;
      out.push({ px: day2px(dateToDay(y, 1, 1, cal)), label: yearLabel(y, cal.era), major });
    }
    return out;
  }

  /* The ruler marks, in Gregorian. Derived from the SAME marksFor() the
     Gregorian column uses, so ruler and column cannot diverge. */
  function rulerMarks() {
    return marksFor(BY_ID.gregorian).filter(m => m.major);
  }

  function render() {
    const inner = $('vt-inner');
    inner.innerHTML = '';
    const H = bodyH();
    const frag = document.createDocumentFragment();

    /* --- year ruler: sticky, labels only, same map as the columns ---
       It carries a col-head the same height as the calendar columns' headers,
       so its body starts at the same y and the labels line up exactly. */
    const ruler = document.createElement('div');
    ruler.className = 'ruler';
    ruler.style.width = RULER_W + 'px';
    const rh = document.createElement('div');
    rh.className = 'col-head';
    rh.innerHTML = 'year<span class="sub">Gregorian</span>';
    ruler.appendChild(rh);
    const rb = document.createElement('div');
    rb.className = 'ruler-body';
    rb.style.height = H + 'px';
    for (const m of rulerMarks()) {
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
          el.className = 'mark ' + (m.major ? 'year' : 'dec');
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
    const ref = BY_ID.gregorian;
    const items = [`<span class="k"><i class="sw" style="background:#8e8e93"></i>ruler: Gregorian (reference)</span>`]
      .concat((window.calVisible ? window.calVisible() : S.calendars).map(c =>
        `<span class="k"><i class="sw" style="background:${c.color}"></i>${esc(c.name)}</span>`));
    $('legendCals').innerHTML = items.join('');
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
    $('todayLine').textContent =
      `${n.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
       · ${visibleCals().length} of ${S.calendars.length} calendars shown`;
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
