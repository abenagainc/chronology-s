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
  /* widths come from global settings (timeline view variables) */
  const RULER_W = () => (window.Settings ? Settings.get().rulerWidth : 78);
  const COLW = () => (window.Settings ? Settings.get().calWidth : 210);
  const EVLH = 16;

  /* visibility: ONE source of truth, shared by the sidebar and the timeline.
     Both modules previously kept their own copy and their own localStorage
     closure, so the checkbox updated the filter but the timeline never redrew. */
  const HIDE_KEY = 'chronologyX.hidden';
  function hiddenIds() {
    try { return new Set(JSON.parse(localStorage.getItem(HIDE_KEY) || '[]')); }
    catch (e) { return new Set(); }
  }
  function setHidden(ids) { localStorage.setItem(HIDE_KEY, JSON.stringify([...ids])); }

  let S = Store.load();
  /* Exposed for the sidebar and for verification. Assigned AFTER S/PPD/day2px
     exist — putting this above the `let` declarations made the closures capture
     bindings before initialisation and threw on first call. */
  window.calVisible = () => S.calendars.filter(c => !hiddenIds().has(c.id));
  window.hiddenIds = hiddenIds;
  window.setHidden = setHidden;
  let PPD = 0.006;                                 // pixels per DAY — the one zoom knob
  let LAST_CROSS_DAY = null;    // crosshair's day (drives the bubbles + ruler date)
  let LAST_CURSOR_DAY = null;   // mouse's day (drives row 3)

  /* Tick / label settings, driven by the popover. */
  /* Tick density and label frequency are FIXED at 1 — no user control for now,
     so the ticks can be judged visually without sliders in the way. */
  const TICK_DENSITY = 1;
  const LABEL_EVERY = 1;
  let LABEL_SIZE = 10;       // px
  let SHOW_LABELS = true;
  let REF_ID = 'gregorian';  // which calendar the RULER shows

  const $ = id => document.getElementById(id);
  const sc = () => $('vt-scroll');

  /* =====================================================================
     THE COORDINATE MODEL — the only place it is defined.

     ONE space: CONTENT. A day maps to a content-y via day2px(). Content-y is
     measured from the TOP OF #vt-inner (the scrollable content), so content-y 0
     is the first pixel you would see if scrolled to the very top.

     Viewport-y = content-y - scrollTop + HEAD_H
       (HEAD_H because the column bodies start one header below #vt-inner's top)

     Nothing else in this file may call getBoundingClientRect or read
     scrollTop to derive a day. Everything goes through:
        day2px / px2day     content <-> day
        contentToView()     content -> viewport
        viewToContent()     viewport -> content
     Previously bodyOffset() mixed the two spaces and ~10 call sites were wrong.
     ===================================================================== */
  const HEAD_H = 46;
  /* DIRECTION: +1 = past on top (later days further down), -1 = future on top.
     The ONLY place the axis direction is expressed — every other function reads
     it, so the timeline can be flipped without touching scroll/crosshair/events. */
  let DIRECTION = 1;
  const day2px = day => DIRECTION * (day - DAY_TOP) * PPD;
  const px2day = px => DAY_TOP + DIRECTION * px / PPD;
  const contentToView = (contentY) => contentY - sc().scrollTop + HEAD_H;
  const viewToContent = (viewY) => viewY + sc().scrollTop - HEAD_H;

  const bodyH = () => DAYS_TOTAL * PPD;
  const scrollH = () => bodyH() + HEAD_H;

  /* The visible window in DAY indices, with a margin so ticks appear just
     before they scroll in. The single source for every mark generator. */
  function visibleWindow(marginPx = 400) {
    const s = sc();
    const topContent = s.scrollTop - marginPx;
    const botContent = s.scrollTop + (s.clientHeight || 600) + marginPx;
    return { lo: px2day(topContent), hi: px2day(botContent) };
  }

  /* Year step for the marks: the smallest step whose spacing is >= MIN_PX apart.
     Returns {step, majorEvery} where majorEvery is how many steps make a labelled
     (major) mark — so a label always exists, whatever the zoom. */
  /* Two separate budgets, deliberately:
     TICK_PX  — how far apart ticks must be to be DRAWN (minor-tick spacing).
     LABEL_PX — how far apart LABELS must be to be legible.
     Decoupling these is what lets "many ticks, few labels". */
  /* Hard ceiling: browsers cap scrollable height at 2^24 px. Beyond that
     scrollTop clamps and the view lands in the wrong era. The largest scale we
     can represent is therefore (2^24 / total days). Coded as a SETTING so it is
     visible and adjustable rather than a hidden constant. */
  const MAX_SCROLL_PX = 16777216;
  let MAX_PPD = MAX_SCROLL_PX / DAYS_TOTAL;   // ~6.5 px/day
  const MIN_PPD = 0.0008;
  const clampPPD = v => Math.min(Math.max(v, MIN_PPD), MAX_PPD);
  /* exposed for verification: the module's own coordinate map, so tests do not
     reconstruct days from rounded readouts. */
  window._geom = { day2px, px2day, calHasDay, boundDay };
  const TICK_PX = 6;
  const LABEL_PX = 80;

  /* Which tier is shown is decided by the VISIBLE SPAN, not by a pixel budget —
     so the thresholds are meaningful and editable in the popover:
       span < thDay years      → days
       < thMonth               → months
       < thYear                → years
       < thDecade              → decades
       < thCentury             → centuries
       otherwise               → millennia                                        */
  /* TICK THRESHOLDS (px per unit) — Abe's model:
       px < 5   → hide that tier
       5 ≤ px < 30 → ticks, no labels
       px ≥ 30  → ticks + labels
     Every tier is judged independently, and LABELS NEST: the coarsest tier that
     qualifies labels a position; finer tiers supply ticks. So a label is always
     exactly one of day / month / year, at a real boundary, in the corner of its
     block. */
  /* Thresholds come from global settings when present (timeline view vars). */
  const tickMinPx = () => (window.Settings ? Settings.get().minorLimitPx : 5);
  const labelMinPx = () => (window.Settings ? Settings.get().majorLimitPx : 30);

  /* Approximate unit lengths in days, for the px-per-unit test. */
  const UNIT_DAYS = { day: 1, month: 30.4375, year: 365.2425,
                      decade: 3652.425, century: 36524.25, millennium: 365242.5 };
  const TIER_ORDER = ['day', 'month', 'year', 'decade', 'century', 'millennium'];

  /* Which tiers are visible at the current zoom, and which of those label. */
  function tierState() {
    const out = {};
    for (const t of TIER_ORDER) out[t] = { px: UNIT_DAYS[t] * PPD, show: false, label: false };
    for (const t of TIER_ORDER) {
      const px = out[t].px;
      if (px < tickMinPx()) continue;
      out[t].show = true;
      if (px >= labelMinPx()) out[t].label = true;
    }
    return out;
  }

  /* Label for a tick at a given tier. */
  function tierLabel(day, cal, tier) {
    const d = dayToDate(day, cal);
    if (tier === 'millennium') return yearLabel(Math.floor(d.y / 1000) * 1000, cal);
    if (tier === 'century') return yearLabel(Math.floor(d.y / 100) * 100, cal);
    if (tier === 'decade') return yearLabel(Math.floor(d.y / 10) * 10, cal);
    if (tier === 'year') return yearLabel(d.y, cal);
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
    const st = tierState();
    const show = SHOW_LABELS;
    const density = TICK_DENSITY;

    /* Only generate marks for the VISIBLE window (+ margin). Looping the whole
       7000-year range produced ~2.5M marks and hung the page.
       `lo`/`hi` are DAY INDICES (0 = 1 Oct 2026), NOT years — they must be
       converted to calendar dates before being used as a year bound. */
    const s = sc();
    const margin = 400;
    const lo = px2day(s.scrollTop - margin);
    const hi = px2day(s.scrollTop + (s.clientHeight || 600) + margin);
    const inView = (day) => day >= lo && day <= hi;
    const loY = Math.min(dayToDate(lo, cal).y, dayToDate(hi, cal).y);
    const hiY = Math.max(dayToDate(lo, cal).y, dayToDate(hi, cal).y);

    /* --- DAY ticks --- */
    if (st.day.show) {
      const step = Math.max(1, Math.round(1 / density));
      let i = 0;
      for (let d = Math.ceil(lo / step) * step; d <= hi; d += step, i++) {
        if (!calHasDay(cal, d)) continue;          // outside this calendar's bounds
        out.push({ px: day2px(d), tier: 'day', major: false,
                   label: (show && st.day.label) ? tierLabel(d, cal, 'day') : '' });
      }
    }

    /* --- MONTH ticks, at real month boundaries --- */
    if (st.month.show) {
      /* With density fixed at 1 every month is labelled. The old
         `round(12/density)` gave 12, i.e. ONE month per year — the visible
         symptom was a single month label that changed as you scrolled. */
      let i = 0;
      for (let y = loY - 1; y <= hiY + 1; y++) {
        for (let m = 1; m <= cal.months.length; m++) {
          const day = dateToDay(y, m, 1, cal);
          if (!inView(day) || !calHasDay(cal, day)) continue;
          out.push({ px: day2px(day), tier: 'month', major: false,
                     label: (show && st.month.label) ? tierLabel(day, cal, 'month') : '' });
          i++;
        }
      }
    }

    /* --- YEAR and coarser ticks --- */
    const spans = { year: 1, decade: 10, century: 100, millennium: 1000 };
    for (const tier of ['year', 'decade', 'century', 'millennium']) {
      if (!st[tier].show) continue;
      const span = spans[tier];
      let i = 0;
      const yStart = Math.max(MINY, loY - span);
      /* bound by the DATA range. DAY_BOT is a day INDEX (822), not a year —
         dividing it by 365 produced MAXY_DATA=3 and the loop never ran. */
      const yEnd = Math.min(hiY + span, MAXY);
      const start = Math.ceil(yStart / span) * span;
      for (let y = start; y <= yEnd; y += span, i++) {
        const day = dateToDay(y, 1, 1, cal);
        if (!calHasDay(cal, day)) continue;
        /* clamp to the column: the visible window carries a 400px margin, so
           the loop can run past DAY_BOT and emit marks BEYOND the body — those
           overflowed the column by 16,000px and extended the scroll range to
           year 2545. */
        const px = day2px(day);
        if (px < 0 || px > bodyH()) continue;
        out.push({ px, tier, major: false,
                   label: (show && st[tier].label) ? tierLabel(day, cal, tier) : '' });
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
    applyTickSettings();
    const frag = document.createDocumentFragment();

    /* --- year ruler: sticky, labels only, same map as the columns ---
       It carries a col-head the same height as the calendar columns' headers,
       so its body starts at the same y and the labels line up exactly. */
    const ruler = document.createElement('div');
    ruler.className = 'ruler';
    ruler.style.width = RULER_W() + 'px';
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
    // the ruler draws the SAME marks as the columns — ticks AND labels
    for (const m of rulerMarks()) {
      const t = document.createElement('div');
      t.className = 'mark ' + m.tier;
      t.style.top = m.px + 'px';
      rb.appendChild(t);
      if (!m.label) continue;
      const l = document.createElement('div');
      l.className = 'mark lab ' + m.tier;
      l.style.top = m.px + 'px';
      l.style.fontSize = 'var(--label-' + m.tier + ', 10px)';
      l.textContent = m.label;
      rb.appendChild(l);
    }
    ruler.appendChild(rb);
    // bold date in the ruler, at the crosshair's height (not a bubble)
    const rd = document.createElement('div');
    rd.className = 'ruler-date';
    rd.id = 'rulerDate';
    ruler.appendChild(rd);
    frag.appendChild(ruler);

    /* --- one column per VISIBLE calendar, in the configured order --- */
    const visible = visibleCals();
    for (const cal of visible) {
      const col = document.createElement('div');
      col.className = 'col';
      col.dataset.cal = cal.id;
      col.style.width = COLW() + 'px';
      const ready = calReady(cal);
      col.innerHTML = `<div class="col-head"><span class="dot" style="background:${cal.color}"></span>
        ${esc(cal.name)}<span class="tag">${cal.months.length} mo</span>
        <span class="sub">${esc(cal.format || '')} · ${cal.era === 'astro' ? 'astro' : 'CE/BCE'}</span>
        ${ready ? '' : '<span class="sub" style="color:var(--danger)">epoch unresolved</span>'}</div>`;
      const body = document.createElement('div');
      body.className = 'col-body';
      body.style.height = H + 'px';

      /* Out-of-bounds shading: darker than the in-bounds area, with no ticks.
         Drawn as a full-height base plus darker bands where the calendar has
         no validity, so a bounded calendar reads as "outside" at a glance. */
      if (ready) {
        const lo = boundDay(cal, 'from'), hi = boundDay(cal, 'to');
        if (lo !== null || hi !== null) {
          const band = document.createElement('div');
          band.className = 'oob';
          band.style.top = '0px';
          band.style.height = H + 'px';
          body.appendChild(band);
          for (const [d0, d1] of [[null, lo], [hi, null]]) {
            if (d0 === null && d1 === null) continue;
            /* clamp to the column: day2px() can be negative (a date before
               DAY_TOP) or exceed H, and an unclamped band made the column
               scrollHeight 16,000px taller than its body — the scroll range
               ran past the data end (year 2545 instead of 2028). */
            const topPx = Math.min(Math.max(day2px(d0 === null ? DAY_TOP : d0), 0), H);
            const botPx = Math.min(Math.max(day2px(d1 === null ? DAY_BOT : d1), 0), H);
            if (botPx <= topPx) continue;
            const b = document.createElement('div');
            b.className = 'oob-band';
            b.style.top = topPx + 'px';
            b.style.height = (botPx - topPx) + 'px';
            body.appendChild(b);
          }
        }
      }

      if (ready) {
        for (const m of marksFor(cal)) {
          const el = document.createElement('div');
          el.className = 'mark ' + (m.tier || (m.major ? 'year' : 'dec'));
          el.style.top = m.px + 'px';
          body.appendChild(el);
          // a label is emitted where the mark carries one — `major` is no longer
          // the gate (every tier can label now).
          if (m.label) {
            const lab = document.createElement('div');
            lab.className = 'mark lab ' + (m.tier || '');
            lab.style.top = m.px + 'px';
            lab.style.fontSize = 'var(--label-' + (m.tier || 'year') + ', 10px)';
            lab.textContent = m.label;
            body.appendChild(lab);
          }
        }
        for (const e of S.events) {
          if (e.calId !== cal.id) continue;
          const d1 = Store.eventDay(S, e), d2 = Store.eventEndDay(S, e);
          if (d1 === null || !calHasDay(cal, d1)) continue;   // outside bounds: not drawn
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

    renderCrossBubbles();
    renderCoords();
    updateRange();
    moveCrosshair();
  }

  /* Row 3 = the CURSOR coordinates: one date per visible calendar, each laid out
     over its own column so it lines up with the crosshair bubbles above. */
  function renderCoords() {
    const row = $('coordRow');
    if (!row) return;
    const vis = visibleCals();
    const cells = [`<span class="cx cx-ruler"><i class="sw" style="background:#8e8e93"></i><span
        class="cxv" id="cxRuler">—</span></span>`]
      .concat(vis.map(c =>
        `<span class="cx" style="width:${COLW()}px"><i class="sw" style="background:${c.color}"></i>
           <span class="cxv" data-cal="${esc(c.id)}">—</span></span>`));
    row.innerHTML = cells.join('');
    row.style.paddingLeft = RULER_W() + 'px';
    updateCursorCoords(LAST_CURSOR_DAY);
  }

  /* The crosshair readout: a thin bubble ON the line, one date per calendar,
     positioned over its own column. Plus a bold date inside the ruler. */
  function renderCrossBubbles() {
    /* The bubble strip lives in #vt-scroll's VIEWPORT layer, next to the
       crosshair — NOT in #vt-inner. Inside #vt-inner it inherited the full
       content height (218,000px) and became a band instead of a bubble. */
    const host = sc();
    let b = $('crossBubbles');
    if (b) b.remove();
    b = document.createElement('div');
    b.id = 'crossBubbles';
    b.className = 'cross-bubbles';
    const vis = visibleCals();
    b.innerHTML = [`<span class="cb" style="width:${RULER_W()}px"><span class="cbv" id="cbRuler"></span></span>`]
      .concat(vis.map(c =>
        `<span class="cb" style="width:${COLW()}px"><span class="cbv" data-cal="${esc(c.id)}">—</span></span>`))
      .join('');
    host.appendChild(b);
    updateCrossBubbles(LAST_CROSS_DAY);
  }

  function updateCrossBubbles(day) {
    const b = $('crossBubbles');
    if (b) {
      // sit on the crosshair line, in VIEWPORT space
      const c = $('cross');
      b.style.top = c ? c.style.top : '0px';
      b.querySelectorAll('.cbv').forEach(el => {
        const c2 = BY_ID[el.dataset.cal] || S.calendars.find(x => x.id === el.dataset.cal);
        el.textContent = (c2 && day !== null) ? safeFormatDay(day, c2) : '—';
      });
      const cr = $('cbRuler');
      const ref0 = BY_ID[REF_ID] || BY_ID.gregorian;
      if (cr && ref0) cr.textContent = day === null ? '—' : safeFormatDay(day, ref0);
    }
    // bold date inside the ruler, at the crosshair's y
    const rd = $('rulerDate');
    const refC = BY_ID[REF_ID] || BY_ID.gregorian;
    if (rd && refC) {
      rd.textContent = day === null ? '' : safeFormatDay(day, refC);
      const c = $('cross');
      if (c) rd.style.top = c.style.top;
    }
  }

  function updateCursorCoords(day) {
    const row = $('coordRow');
    if (!row) return;
    const ref = BY_ID[REF_ID] || BY_ID.gregorian;
    const rr = $('cxRuler');
    if (rr && ref) rr.textContent = day === null ? '—' : safeFormatDay(day, ref);
    row.querySelectorAll('.cxv[data-cal]').forEach(el => {
      const c = BY_ID[el.dataset.cal] || S.calendars.find(x => x.id === el.dataset.cal);
      el.textContent = (c && day !== null) ? safeFormatDay(day, c) : '—';
    });
  }

  /** Apply the global tick settings once per render. */
  function applyTickSettings() {
    const st = window.Settings ? Settings.get() : null;
    if (!st) return;
    const rs = document.documentElement.style;
    rs.setProperty('--tick-minor', st.minorColor);
    rs.setProperty('--tick-major', st.majorColor);
    rs.setProperty('--tick-minor-w', st.minorThickness + 'px');
    rs.setProperty('--tick-major-w', st.majorThickness + 'px');
    for (const [k, u] of Object.entries(st.units || {})) {
      rs.setProperty('--label-' + k, (u.size || 9) + 'px');
    }
  }

  /** Push the label-size setting onto every label element. */
  function applyLabelSize() {
    document.documentElement.style.setProperty('--label-px', LABEL_SIZE + 'px');
  }

  function updateRange() {
    const s = sc();
    const d1 = px2day(s.scrollTop), d2 = px2day(s.scrollTop + s.clientHeight);
    const ref = BY_ID.gregorian;
    $('range').textContent =
      `viewing ${safeFormatDay(Math.round(d1), ref)} → ${safeFormatDay(Math.round(d2), ref)}` +
      `  ·  ${PPD.toFixed(3)} px/day  ·  ${(PPD * 365.2425).toFixed(1)} px/year`;
  }

  /** Calendars to draw, in the configured left-to-right order. */
  function visibleCals() {
    const list = window.calVisible ? window.calVisible() : S.calendars;
    return window.Settings ? Settings.ordered(list) : list;
  }

  function moveCrosshair() {
    const s = sc();
    const c = ensureCrosshair();
    /* #vt-scroll is a scroll container, so an `absolute` child's `top` is in
       CONTENT coordinates, not viewport — the visible box is offset by
       scrollTop. Hence top = scrollTop + half. The day comes from the same
       content position, so viewToContent() must NOT be applied on top of it:
       contentY = top, so day = px2day(viewY - HEAD_H). */
    const viewY = s.scrollTop + s.clientHeight / 2;
    c.style.top = viewY + 'px';
    c.style.display = '';
    const day = Math.round(px2day(viewY - HEAD_H));
    LAST_CROSS_DAY = day;
    updateCrossBubbles(day);
  }

  /** Place the crosshair at the vertical centre of the VIEWPORT.
     `top` is in viewport space, so scrollTop must NOT be part of it. */
  function placeCrosshair() {
    const s = sc();
    const c = ensureCrosshair();
    c.style.top = (s.clientHeight / 2) + 'px';
    c.style.display = '';
    moveCrosshair();
  }

  function esc(s) {
    return String(s ?? '').replace(/[&<>"]/g,
      c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  }

  /* Assign scrollTop WITHOUT triggering a re-render. NOTE: the SELF_SCROLL
     guard this relies on was reverted — see docs/batch5.md. Presets that set
     scrollTop after render() are currently unreliable. */
  function setScrollTop(px) {
    const s = sc();
    s.scrollTop = Math.max(px, 0);
  }

  function zoom(factor) {
    const s = sc();
    // keep the day under the viewport centre fixed across the zoom
    const midDay = px2day(viewToContent(s.clientHeight / 2));
    PPD = clampPPD(PPD * factor);
    render();
    setScrollTop(day2px(midDay) + HEAD_H - s.clientHeight / 2);
    updateRange(); placeCrosshair();
  }

  /* Presets are defined in PIXELS PER UNIT at the label threshold: each
     preset is the zoom where that unit just starts labelling. "fit" fits all. */
  function setZoom(preset) {
    const s = sc();
    const n = new Date();
    const today = gregorianToDay(n.getFullYear(), n.getMonth() + 1, n.getDate());
    if (preset === 'fit') {
      PPD = Math.max((s.clientHeight - 60) / DAYS_TOTAL, 0.0008);
    } else {
      const unitDays = { days: 1, months: 30.4375, years: 365.2425,
                         decades: 3652.425, centuries: 36524.25, millennia: 365242.5 }[preset];
      PPD = (unitDays ? labelMinPx() / unitDays : 0.002);
    }
    PPD = clampPPD(PPD);
    render();
    /* fit also needs its scroll position set: leaving the old scrollTop with a
       new (much smaller) scale put the view years past the data. */
    setScrollTop(preset === 'fit'
      ? 0
      : day2px(today) + HEAD_H - s.clientHeight / 2);
    updateRange(); placeCrosshair();
  }

  function bind() {
    const s = sc();
    $('zin').onclick   = () => zoom(1.5);
    $('zout').onclick  = () => zoom(1 / 1.5);
    $('up').onclick    = () => s.scrollBy({ top: -s.clientHeight * .8, behavior: 'smooth' });
    $('down').onclick  = () => s.scrollBy({ top:  s.clientHeight * .8, behavior: 'smooth' });
    $('left').onclick  = () => s.scrollBy({ left: -COLW(), behavior: 'smooth' });
    $('right').onclick = () => s.scrollBy({ left:  COLW(), behavior: 'smooth' });
    $('todayBtn').onclick = () => setZoom('years');
    $('zoomSel').onchange = () => setZoom($('zoomSel').value);

    // sidebar changes (visibility, add/edit/delete) -> redraw
    window.addEventListener('cal-visibility', () => { S = Store.load(); render(); });
    window.addEventListener('cal-changed', () => { S = Store.load(); render(); });

    /* --- tick / label settings now live in the ⚙ global settings panel --- */
    function updateTierActive() {
      const el = $('tierActive');
      if (!el) return;
      const st = tierState();
      const txt = TIER_ORDER.filter(t => st[t].show)
        .map(t => `${t} ${st[t].label ? 'labelled' : 'ticks'}`).join(' · ');
      el.textContent = txt ? `now: ${txt}` : 'now: nothing visible';
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
      /* marks are generated for the VISIBLE window, so they must be
         regenerated on scroll — otherwise they only exist for the window that
         was visible when render() last ran (they "appear and disappear"). */
      render();
      placeCrosshair();
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
    /* Two independent readouts:
       - pointermove drives ROW 3 (the cursor coordinates)
       - scroll/zoom drives the CROSSHAIR bubbles
       The crosshair is NOT moved by the mouse, and it never disappears. */
    s.addEventListener('pointermove', e => {
      // pointer -> viewport y (relative to the scroll box) -> content -> day.
      // viewToContent() already adds scrollTop, so use the raw viewport y.
      const r = s.getBoundingClientRect();
      const viewY = e.clientY - r.top;
      const day = Math.round(px2day(viewToContent(viewY)));
      LAST_CURSOR_DAY = day;
      updateCursorCoords(day);
    });
    s.addEventListener('pointerleave', () => {
      // keep the crosshair; just stop tracking the cursor
      moveCrosshair();
    });
  }

  function init() {
    ensureCrosshair();
    const s = sc();
    const n = new Date();
    const today = gregorianToDay(n.getFullYear(), n.getMonth() + 1, n.getDate());
    // default = the "30 px / year" preset, i.e. years just start labelling.
    // 30px / 365.2425d lands at 29.98px for a 365-day year — a hair under the
    // label threshold — so aim slightly above it.
    PPD = (labelMinPx() + 1) / 365.2425;
    render();
    setScrollTop(contentToView(day2px(today)) - s.clientHeight * .35);
    bind();
    placeCrosshair();
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
