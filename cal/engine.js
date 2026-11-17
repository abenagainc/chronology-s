/* Chronology S — date math for the UI prototype.
   The DAY is the only unit shared between calendars.
   Axis: absolute integer day, 0 = the fixed anchor (1 Oct 2026 Gregorian).
   Custom calendars are anchored to another calendar's date (epochCal), so no
   calendar ever needs to know the Gregorian formula. */

const MONTH_NAMES_GREG = ['January','February','March','April','May','June','July',
                          'August','September','October','November','December'];
const MONTH_NAMES_HIJRI = ['Muharram','Safar','Rabiʻ I','Rabiʻ II','Jumada I','Jumada II',
                           'Rajab','Shaʻban','Ramadan','Shawwal','Dhu al-Qiʻdah','Dhu al-Hijjah'];
// Tabular Islamic leap years within a 30-year cycle (the standard set, and the
// one used by every conversion table). Note: this set does NOT reproduce the
// observational civil dates (e.g. 1 Muharram 1446 AH is observed as 7 Jul 2024);
// the tabular calendar runs ~2 months ahead of the moon-sighted one. That gap is
// the whole reason the tabular variant is only a diagrammatic convention.
const HIJRI_LEAP = [2,5,7,10,13,16,18,21,24,26,29];
const ANCHOR_JDN = 2461300;                              // 1 Oct 2026 (Gregorian)

/* --- fixed reference calendars (pure formulas, no state) ----------------- */
function gregorianToJdn(y, m, d) {
  const a = Math.floor((14 - m) / 12), y2 = y + 4800 - a, m2 = m + 12 * a - 3;
  return d + Math.floor((153 * m2 + 2) / 5) + 365 * y2 + Math.floor(y2 / 4)
       - Math.floor(y2 / 100) + Math.floor(y2 / 400) - 32045;
}
function jdnToGregorian(jdn) {
  const a = jdn + 32044, b = Math.floor((4 * a + 3) / 146097), c = a - Math.floor(146097 * b / 4);
  const dd = Math.floor((4 * c + 3) / 1461), e = c - Math.floor(1461 * dd / 4);
  const mm = Math.floor((5 * e + 2) / 153);
  return [100 * b + dd - 4800 + Math.floor(mm / 10), mm + 3 - 12 * Math.floor(mm / 10),
          e - Math.floor((153 * mm + 2) / 5) + 1];
}
function julianToJdn(y, m, d) {
  const a = Math.floor((14 - m) / 12), y2 = y + 4800 - a, m2 = m + 12 * a - 3;
  return d + Math.floor((153 * m2 + 2) / 5) + 365 * y2 + Math.floor(y2 / 4) - 32083;
}
function jdnToJulian(jdn) {
  const c = jdn + 32082, d = Math.floor((4 * c + 3) / 1461), e = c - Math.floor(1461 * d / 4);
  const mm = Math.floor((5 * e + 2) / 153);
  return [d - 4800 + Math.floor(mm / 10), mm + 3 - 12 * Math.floor(mm / 10),
          e - Math.floor((153 * mm + 2) / 5) + 1];
}

/* --- generic rule engine -------------------------------------------------- */
function isLeapYear(y, cal) {
  const r = cal.leap;
  if (!r || r.kind === 'none') return false;
  if (r.kind === 'every4') {
    if (r.gregorianCentury) return y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0);
    return y % 4 === 0;
  }
  if (r.kind === 'custom') {
    const cyc = r.cycle || 30;
    // Cycle position: year 1 is position 1, year 30 is position 30, year 31 is
    // position 1 again. `((y-1) % cyc) + 1` gives that; `(y % cyc) + 1` is
    // off by one and marks year 1 as leap.
    const pos = ((y - 1) % cyc + cyc) % cyc + 1;
    return (r.years || []).includes(pos);
  }
  return false;
}
function daysInYear(y, cal) {
  let t = 0;
  for (const m of cal.months) t += m.days;
  for (const lm of (cal.leapMonths || [])) if (isLeapYear(y, cal)) t += lm.days;
  return t;
}
function daysInMonth(y, mIdx, cal) {
  const m = cal.months[mIdx];
  if (!m) return 0;
  // `afterMonth` is the 0-based index of the month the leap day extends.
  for (const lm of (cal.leapMonths || [])) {
    if (lm.afterMonth === mIdx && isLeapYear(y, cal)) {
      // extend THIS month rather than replacing it: the month keeps its own
      // length and gains the leap day
      return m.days + lm.days;
    }
  }
  return m.days;
}
/** days from the calendar's epoch to y/m/d (may be negative). */
function daysFromEpoch(y, m, d, cal) {
  const ey = cal.epoch[0];
  let days = 0;
  const step = y >= ey ? 1 : -1;
  for (let yy = ey; yy !== y; yy += step) days += step * daysInYear(yy, cal);
  for (let mi = 0; mi < m - 1; mi++) days += daysInMonth(y, mi, cal);
  return days + (d - 1);
}
function dateToDay(y, m, d, cal) {
  return cal.epochDay + daysFromEpoch(y, m, d, cal);
}
function dayToDate(day, cal) {
  let y = cal.epoch[0], base = cal.epochDay;
  if (day >= base) { while (day >= base + daysInYear(y, cal)) { base += daysInYear(y, cal); y++; } }
  else { while (day < base) { y--; base -= daysInYear(y, cal); } }
  let rest = day - base, m = 1;
  while (m <= cal.months.length && rest >= daysInMonth(y, m - 1, cal)) { rest -= daysInMonth(y, m - 1, cal); m++; }
  return { y, m, d: rest + 1 };
}
/** Does y/m/d exist in this calendar? */
function validDate(y, m, d, cal) {
  if (!Number.isInteger(y) || !Number.isInteger(m) || !Number.isInteger(d)) return false;
  if (m < 1 || m > cal.months.length) return false;
  return d >= 1 && d <= daysInMonth(y, m - 1, cal);
}

/* --- formatting ----------------------------------------------------------- */
function yearLabel(y, era) {
  if (era === 'astro') return String(y);
  if (y >= 1) return String(y);
  return (1 - y) + ' BCE';          // era 'ce': no suffix duplication — the caller owns it
}
function formatDate(y, m, d, cal) {
  let s = cal.format || 'YYYY-MM-DD';
  const pad = (n, w) => String(n).padStart(w, '0');
  const MMM = (cal.months[m - 1] ? cal.months[m - 1].name : '').slice(0, 3);
  s = s.replace(/YYYY/g, pad(Math.abs(y), 4)).replace(/YY/g, pad(Math.abs(y) % 100, 2));
  s = s.replace(/MMM/g, MMM).replace(/MM/g, pad(m, 2)).replace(/M\b/g, String(m));
  s = s.replace(/DD/g, pad(d, 2)).replace(/D\b/g, String(d));
  return s;                                   // era suffix is a display-layer choice
}
/** Render a date in a calendar's own format, with the era named explicitly. */
function formatDay(day, cal) {
  const r = dayToDate(day, cal);
  const s = formatDate(r.y, r.m, r.d, cal);
  if (cal.era === 'ce' && r.y < 1) return s + ' BCE';
  return s;
}

/* --- built-ins ------------------------------------------------------------ */
function gregorianCal() {
  return { id: 'gregorian', name: 'Proleptic Gregorian', kind: 'builtin', color: '#4f7cdf',
    era: 'ce', format: 'YYYY-MM-DD',
    months: MONTH_NAMES_GREG.map((n, i) => ({ name: n, days: [31,28,31,30,31,30,31,31,30,31,30,31][i] })),
    leapMonths: [{ name: 'Leap day', days: 1, afterMonth: 1 }],
    leap: { kind: 'every4', gregorianCentury: true },
    epoch: [1, 1, 1], epochDay: gregorianToJdn(1, 1, 1) - gregorianToJdn(2026, 10, 1) };
}
function julianCal() {
  const c = gregorianCal();
  c.id = 'julian'; c.name = 'Proleptic Julian'; c.color = '#c25f0e';
  c.leap = { kind: 'every4', gregorianCentury: false };
  c.epoch = [1, 1, 1]; c.epochDay = julianToJdn(1, 1, 1) - gregorianToJdn(2026, 10, 1);
  return c;                                   // inherits no flag; epochDay is an index
}
function hijriCal() {
  const months = MONTH_NAMES_HIJRI.map((n, i) => ({ name: n, days: (i % 2 === 0 ? 30 : 29) }));
  return { id: 'hijri', name: 'Proleptic Hijri (tabular)', kind: 'builtin', color: '#3f9d6b',
    note: 'Tabular (arithmetic) Islamic calendar — not moon-sighted; runs ahead of observed dates.',
    era: 'ce', format: 'DD/MM/YYYY',
    months, leapMonths: [{ name: 'Leap day', days: 1, afterMonth: 11 }],
    leap: { kind: 'custom', cycle: 30, years: HIJRI_LEAP },
    // AH 1/1/1 = 16 July 622 CE *Julian* (civil epoch). Stated as a JDN so this
    // calendar is anchored even when the Julian calendar is not in the registry.
    epoch: [1, 1, 1], epochDay: julianToJdn(622, 7, 16) - gregorianToJdn(2026, 10, 1) };
}
const BUILTINS = { gregorian: gregorianCal, julian: julianCal, hijri: hijriCal };

/* --- registry: resolve epochs against each other, then expose converters -- */
let BY_ID = {};
/** Absolute day index. Day 0 = the fixed anchor, 1 Oct 2026 (Gregorian).
    NOT a Julian Day Number — JDN is noon-based and starts at −4712, which only
    confuses a day scale. */
const DAY0 = gregorianToJdn(2026, 10, 1);
function registerCalendars(cals) {
  // Pass 1: copy every calendar into the registry. Copies matter — registration
  // computes `epochDay` and must not mutate the caller's stored objects.
  BY_ID = {};
  for (const src of cals) BY_ID[src.id] = { ...src };

  // Pass 2: resolve epochs. Done in a SEPARATE pass over the completed registry,
  // so a calendar can reference any other calendar regardless of array order.
  // (Resolving inside pass 1 made it depend on registration order, and silently
  // left epochDay undefined for anything not first.)
  // Iterate to a fixed point so chains (A in B, B in C) resolve too.
  for (let pass = 0; pass < 8; pass++) {
    let progressed = false;
    for (const c of Object.values(BY_ID)) {
      if (!c.epochCal) continue;                    // already anchored (built-in)
      const ref = BY_ID[c.epochCal];
      if (!ref || !Number.isFinite(ref.epochDay)) continue;   // ref not ready yet
      c.epochDay = dateToDay(c.epochDate[0], c.epochDate[1], c.epochDate[2], ref);
      c.epochCalResolved = true;
      progressed = true;
    }
    if (!progressed) break;
  }
  for (const c of Object.values(BY_ID)) {
    if (c.epochCal && !Number.isFinite(c.epochDay)) {
      console.warn(`calendar ${c.id}: epoch calendar "${c.epochCal}" not found`);
    }
  }
  return BY_ID;
}
/** Absolute day index → Julian calendar date (the fixed reference). */
function dayToJulian(day) { return jdnToJulian(day + DAY0); }
/** Absolute day index → Gregorian (used by the shared axis). */
function dayToGregorian(day) { return jdnToGregorian(day + DAY0); }
function gregorianToDay(y, m, d) { return gregorianToJdn(y, m, d) - DAY0; }
function julianToDay(y, m, d) { return julianToJdn(y, m, d) - DAY0; }

/** Is this calendar usable? Its epoch must resolve to a finite day. */
function calReady(cal) {
  return cal && Array.isArray(cal.months) && cal.months.length > 0 &&
         Number.isFinite(cal.epochDay);
}
/** Guard a date conversion — a calendar with a broken epoch yields null, not NaN. */
function safeFormatDay(day, cal) {
  if (!calReady(cal)) return '—';
  try { const r = dayToDate(day, cal);
    if (!r || !Number.isFinite(r.y)) return '—';
    return formatDay(day, cal);
  } catch (e) { return '—'; }
}

/* --- editor presets ------------------------------------------------------- */
const PRESETS = [
  { id: 'gregorian', label: 'Gregorian' }, { id: 'julian', label: 'Julian' },
  { id: 'hijri', label: 'Hijri' }, { id: 'egyptian', label: 'Egyptian' },
  { id: 'mayan', label: 'Maya Haab' }, { id: 'blank', label: 'Blank' },
];
function presetCal(id) {
  if (id === 'egyptian') {
    const names = ['Thoth','Phaphon','Hathyr','Choiak','Tybi','Mechir','Phamenoth','Pharmouthi',
                   'Pachon','Payni','Epiphi','Mesori','Epagomenae'];
    return { id: 'custom', name: 'Egyptian (civil)', kind: 'custom', color: '#b45309', era: 'ce',
      format: 'DD/MM/YYYY', epochCal: 'julian', epochDate: [284, 8, 29], epoch: [1, 1, 1],
      months: names.map(n => ({ name: n, days: n === 'Epagomenae' ? 5 : 30 })),
      leapMonths: [], leap: { kind: 'none' } };
  }
  if (id === 'mayan') {
    const names = ['Pop','Wo','Sip','Sotz','Sek','Xul','Yaxkin','Mol','Chen','Yax','Sak','Keh',
                   'Mak','Kankin','Muwan','Pax','Kayab','Kumku','Wayeb'];
    return { id: 'custom', name: 'Maya Haab', kind: 'custom', color: '#7c3aed', era: 'ce',
      format: 'D MMM YYYY', epochCal: 'gregorian', epochDate: [1, 1, 1], epoch: [1, 1, 1],
      months: names.map(n => ({ name: n, days: n === 'Wayeb' ? 5 : 20 })),
      leapMonths: [], leap: { kind: 'none' } };
  }
  if (id === 'blank') {
    return { id: 'custom', name: 'Custom calendar', kind: 'custom', color: '#64748b', era: 'ce',
      format: 'DD/MM/YYYY', epochCal: 'gregorian', epochDate: [1, 1, 1], epoch: [1, 1, 1],
      months: MONTH_NAMES_GREG.map(n => ({ name: n, days: 30 })),
      leapMonths: [], leap: { kind: 'none' } };
  }
  const b = BUILTINS[id]();
  const c = { ...b, id: 'custom', name: b.name + ' (copy)', kind: 'custom' };
  delete c.epochDay; delete c.epochCal; delete c.epochDate;
  c.epochCal = 'gregorian'; c.epochDate = [1, 1, 1];
  return c;
}
