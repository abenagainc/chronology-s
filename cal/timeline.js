/* Chronology X — vertical multi-calendar timeline.
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

    /* --- one column per calendar --- */
    for (const cal of S.calendars) {
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
          el.style.borderColor = cal.color;
          el.style.borderLeft = '3px solid ' + cal.color;
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
    // The crosshair spans EVERY column, so it lives in #vt-inner (which is as wide
    // as all the columns together) — not inside one column's body.
    const cross = document.createElement('div');
    cross.className = 'cross'; cross.id = 'cross';
    inner.appendChild(cross);

    renderLegend();
    updateRange();
    moveCrosshair();
  }

  function renderLegend() {
    const ref = BY_ID.gregorian;
    const items = [`<span class="k"><i class="sw" style="background:#9ca3af"></i>ruler: Gregorian (reference)</i></span>`]
      .concat(S.calendars.map(c =>
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

  function moveCrosshair() {
    const s = sc(), mid = s.scrollTop + s.clientHeight / 2;
    // crosshair lives in the column-body coordinate space
    const c = $('cross');
    if (c) c.style.top = (mid - bodyOffset()) + 'px';
    const day = Math.round(px2day(mid - bodyOffset()));
    $('readout').textContent = S.calendars.map(cal => safeFormatDay(day, cal)).join('   ·   ');
    $('readout').classList.add('on');
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
    updateRange(); moveCrosshair();
  }

  function bind() {
    const s = sc();
    $('zin').onclick   = () => zoom(1.5);
    $('zout').onclick  = () => zoom(1 / 1.5);
    $('up').onclick    = () => s.scrollBy({ top: -s.clientHeight * .8, behavior: 'smooth' });
    $('down').onclick  = () => s.scrollBy({ top:  s.clientHeight * .8, behavior: 'smooth' });
    $('left').onclick  = () => s.scrollBy({ left: -COLW, behavior: 'smooth' });
    $('right').onclick = () => s.scrollBy({ left:  COLW, behavior: 'smooth' });
    $('fit').onclick   = () => {
      PPD = Math.max((s.clientHeight - 30) / DAYS_TOTAL, 0.0008);
      render();
      updateRange(); moveCrosshair();
    };
    $('today').onclick = () => {
      const n = new Date();
      const day = gregorianToDay(n.getFullYear(), n.getMonth() + 1, n.getDate());
      // PPD is an ABSOLUTE scale (pixels per day), so set it directly rather than
      // deriving it from clientHeight — in an embedded pane clientHeight can be
      // 0 or a stub, which made this zoom to 0.001 px/day.
      PPD = 2.2 / 365.2425;                 // ~2.2 px per year
      render();
      // scroll so the events row for today lands mid-view
      s.scrollTop = bodyOffset() + day2px(day) - s.clientHeight / 2;
      updateRange(); moveCrosshair();
    };
    s.addEventListener('scroll', () => { updateRange(); moveCrosshair(); });
    window.addEventListener('keydown', e => {
      if (e.target.matches('input,select,textarea')) return;
      ({ '+': () => $('zin').click(), '=': () => $('zin').click(),
         '-': () => $('zout').click(), '_': () => $('zout').click(),
         'ArrowUp': () => s.scrollBy({ top: -120 }), 'ArrowDown': () => s.scrollBy({ top: 120 }),
         'ArrowLeft': () => s.scrollBy({ left: -120 }), 'ArrowRight': () => s.scrollBy({ left: 120 }),
         'f': () => $('fit').click(), 'F': () => $('fit').click(),
         't': () => $('today').click(), 'T': () => $('today').click() }[e.key] || (() => {}))();
    });
    $('resetBtn').onclick = () => {
      if (confirm('Reset all dummy data to the original seed?')) { S = Store.reset(); render(); }
    };
    s.addEventListener('pointermove', e => {
      const r = s.getBoundingClientRect();
      // pointer y -> content y (minus the body offset) -> day
      const day = Math.round(px2day(s.scrollTop + (e.clientY - r.top) - bodyOffset()));
      const ro = $('readout');
      ro.textContent = S.calendars.map(cal => safeFormatDay(day, cal)).join('   ·   ');
      ro.classList.add('on');
      const c = $('cross'); if (c) c.style.top = (e.clientY - r.top - bodyOffset()) + 'px';
    });
    s.addEventListener('pointerleave', () => { $('readout').classList.remove('on'); moveCrosshair(); });
  }

  function init() {
    const s = sc();
    const n = new Date();
    const today = gregorianToDay(n.getFullYear(), n.getMonth() + 1, n.getDate());
    PPD = 2.2 / 365.2425;                   // absolute: ~2.2 px per year
    render();
    s.scrollTop = Math.max(bodyOffset() + day2px(today) - s.clientHeight * .35, 0);
    bind();
    moveCrosshair();
  }
  init();
})();
