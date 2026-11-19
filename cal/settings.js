/* Chronology S — global settings: timeline VIEW variables.
   One place owns them, and they persist to Store.ui.
   Abe's rule: calendar RULES live in code, calendar DATA in the store, calendar
   VIEW per instance, and TIMELINE VIEW here. */
window.Settings = (() => {
  const DEFAULTS = {
    calWidth: 210,          // every column the same; the ruler is exempt
    rulerWidth: 78,         // Abe: keep 78, but editable
    minorLimitPx: 5,        // below this a tier is hidden
    majorLimitPx: 30,       // at/above this a tier is labelled
    minorColor: '#3a3f3a',
    minorThickness: 1,
    majorColor: '#6b716b',
    majorThickness: 2,
    // per-unit font size (px) and format
    units: {
      millennium: { size: 12,   fmt: 'YYYY' },
      century:    { size: 10.5, fmt: 'YYYY' },
      decade:     { size: 9,    fmt: 'YYYY' },
      year:       { size: 9,    fmt: 'YYYY' },
      month:      { size: 9,    fmt: 'name' },   // 'name' | 'MM'
      day:        { size: 9,    fmt: 'DD' },
    },
    order: [],              // calendar ids, left to right ([] = store order)
    direction: 1,           // +1 = past on top, -1 = future on top
  };

  let S = null;

  function load() {
    S = Store.load();
    S.ui = S.ui || {};
    // shallow-merge so new keys appear without losing saved values
    S.ui.settings = Object.assign({}, DEFAULTS, S.ui.settings || {});
    S.ui.settings.units = Object.assign({}, DEFAULTS.units,
      (S.ui.settings.units || {}));
    return S.ui.settings;
  }

  function get() {
    /* Always read the CURRENT store: timeline.js reloads its own copy on
       cal-changed, and caching S here made a settings write clobber those
       changes (the calendar order silently never persisted). */
    const cur = Store.load();
    cur.ui = cur.ui || {};
    cur.ui.settings = Object.assign({}, DEFAULTS, cur.ui.settings || {});
    cur.ui.settings.units = Object.assign({}, DEFAULTS.units,
      (cur.ui.settings.units || {}));
    S = cur;
    return cur.ui.settings;
  }

  /** Persist the CURRENT store with our settings merged in — never write a
     stale snapshot over someone else's changes. */
  function save() {
    const cur = Store.load();
    cur.ui = cur.ui || {};
    cur.ui.settings = Object.assign({}, DEFAULTS, get());
    Store.save(cur);
  }

  /** Set one top-level value, or a nested one as 'units.month.fmt'.
     Writes straight into the STORE: mutating the merged copy returned by get()
     never persisted (the same defect that broke setOrder). */
  function set(path, value) {
    const cur = Store.load();
    cur.ui = cur.ui || {};
    cur.ui.settings = Object.assign({}, DEFAULTS, cur.ui.settings || {});
    cur.ui.settings.units = Object.assign({}, DEFAULTS.units,
      (cur.ui.settings.units || {}));
    const parts = path.split('.');
    let o = cur.ui.settings;
    for (let i = 0; i < parts.length - 1; i++) o = o[parts[i]] = o[parts[i]] || {};
    o[parts[parts.length - 1]] = value;
    Store.save(cur);
  }

  function setOrder(ids) {
    /* Write straight to the store — set() mutates a throw-away merged copy, so
       the value never reached localStorage. */
    const cur = Store.load();
    cur.ui = cur.ui || {};
    cur.ui.settings = Object.assign({}, DEFAULTS, cur.ui.settings || {});
    cur.ui.settings.order = ids.slice();
    Store.save(cur);
  }

  /** Calendars in the configured order; unknown ids are appended. */
  function ordered(list) {
    const ord = get().order || [];
    if (!ord.length) return list.slice();
    const byId = new Map(list.map(c => [c.id, c]));
    const out = [];
    for (const id of ord) if (byId.has(id)) { out.push(byId.get(id)); byId.delete(id); }
    for (const c of byId.values()) out.push(c);   // new/unknown calendars last
    return out;
  }

  return { DEFAULTS, load, get, set, save, setOrder, ordered };
})();
