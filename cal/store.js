/* Chronology S — dummy-data store (localStorage). One seam: swap for the DB later. */
const Store = (() => {
  const KEY = 'chronologyX.v1';
  const uid = () => 'id-' + Math.random().toString(36).slice(2, 10);

  function seed() {
    const cals = [gregorianCal(), hijriCal()];
    registerCalendars(cals);
    return { calendars: cals, events: seedEvents(), ui: {} };
  }

  function seedEvents() {
    const n = new Date();
    const E = (title, calId, y, m, d, kind, end, note) => ({
      id: uid(), title, calId, kind: kind || 'point', date: { y, m, d }, end: end || null, note: note || '',
    });
    return [
      E('Founding of Rome (legendary)', 'gregorian', -753, 4, 21, 'point', null, 'Varronian'),
      E('First Olympiad', 'gregorian', -776, 7, 1),
      E('Battle of Marathon', 'gregorian', -490, 9, 12),
      E('Alexander dies', 'gregorian', -323, 6, 10),
      E('Caesar assassinated', 'gregorian', -44, 3, 15),
      E('Hijra — epoch of the Hijri calendar', 'hijri', 1, 1, 1, 'point', null, 'AH 1/1/1'),
      E('Battle of Badr', 'hijri', 2, 3, 17, 'point', null, '17 Ramadan 2 AH'),
      E('Fall of Constantinople', 'gregorian', 1453, 5, 29),
      E('Gregorian reform', 'gregorian', 1582, 10, 15),
      E('First moon landing', 'gregorian', 1969, 7, 20),
      E('Today', 'gregorian', n.getFullYear(), n.getMonth() + 1, n.getDate()),
      E('Reign of Ramesses II', 'gregorian', -1279, 1, 1, 'span', { y: -1213, m: 1, d: 1 }, 'dummy span'),
      E('Islamic Golden Age (dummy)', 'hijri', 133, 1, 1, 'span', { y: 537, m: 1, d: 1 }),
    ];
  }

  function load() {
    let s = null;
    try { s = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { s = null; }
    if (!s || !s.calendars || !s.calendars.length) { s = seed(); save(s); }
    // deep copy: the store owns its data, registration works on copies
    s = JSON.parse(JSON.stringify(s));
    registerCalendars(s.calendars);
    // Drop calendars whose epoch cannot resolve. These only arise from data
    // written before the save guard existed; they render as blank columns with
    // an "epoch unresolved" warning, which reads as a broken calendar rather
    // than a corrupt row.
    const before = s.calendars.length;
    s.calendars = s.calendars.filter(c => {
      const live = BY_ID[c.id];
      return live && Number.isFinite(live.epochDay) && Array.isArray(live.months) && live.months.length > 0;
    });
    if (s.calendars.length !== before) {
      console.warn(`store: dropped ${before - s.calendars.length} calendar(s) with an unresolvable epoch`);
      save(s);
    }
    registerCalendars(s.calendars);
    return s;
  }
  function save(s) { localStorage.setItem(KEY, JSON.stringify(s)); }
  function reset() { localStorage.removeItem(KEY); return load(); }
  const byId = (s, id) => s.calendars.find(c => c.id === id);

  /* ---- calendar CRUD ---- */
  function addCalendar(s, c) {
    c.id = uid();
    s.calendars.push(c);
    registerCalendars(s.calendars); save(s); return c;
  }
  function updateCalendar(s, id, patch) {
    const i = s.calendars.findIndex(c => c.id === id);
    if (i < 0) return null;
    s.calendars[i] = { ...s.calendars[i], ...patch, id };
    registerCalendars(s.calendars); save(s); return s.calendars[i];
  }
  function deleteCalendar(s, id) {
    s.calendars = s.calendars.filter(c => c.id !== id);
    s.events = s.events.filter(e => e.calId !== id);
    registerCalendars(s.calendars); save(s);
  }

  /* ---- event CRUD ---- */
  function addEvent(s, e) { e.id = uid(); s.events.push(e); save(s); return e; }
  function updateEvent(s, id, patch) {
    const i = s.events.findIndex(e => e.id === id);
    if (i < 0) return null;
    s.events[i] = { ...s.events[i], ...patch, id }; save(s); return s.events[i];
  }
  function deleteEvent(s, id) { s.events = s.events.filter(e => e.id !== id); save(s); }

  /* ---- conversions ----
     Always convert through the REGISTERED calendar (BY_ID), never the raw
     stored object: registration is what computes `epochDay` for a calendar that
     states its epoch in another calendar. Using the raw object leaves epochDay
     undefined and dateToDay returns NaN -> a year in the thousands. */
  const registered = (s, id) => BY_ID[id] || byId(s, id);
  const eventDay = (s, e) => {
    const c = registered(s, e.calId);
    if (!c || !validDate(e.date.y, e.date.m, e.date.d, c)) return null;
    return dateToDay(e.date.y, e.date.m, e.date.d, c);
  };
  const eventEndDay = (s, e) => {
    const c = registered(s, e.calId);
    if (!c || !e.end || !validDate(e.end.y, e.end.m, e.end.d, c)) return null;
    return dateToDay(e.end.y, e.end.m, e.end.d, c);
  };

  return { load, save, reset, byId, addCalendar, updateCalendar, deleteCalendar,
           addEvent, updateEvent, deleteEvent, eventDay, eventEndDay };
})();
