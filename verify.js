/* End-to-end verification for Chronology Tool S.
   Runs the real page scripts in a DOM and checks geometry + CRUD.
   Run:  node verify.js          (from the project root) */
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const ROOT = __dirname;
let failures = 0;
const ok = (cond, label, detail = '') => {
  console.log(`${cond ? '  ok  ' : ' FAIL '} ${label}${detail ? '  — ' + detail : ''}`);
  if (!cond) failures++;
};

function makePage(pageFile) {
  const html = fs.readFileSync(path.join(ROOT, pageFile), 'utf8');
  const dom = new JSDOM(html, { url: 'http://127.0.0.1:8012/', runScripts: 'outside-only', pretendToBeVisual: true });
  const { window } = dom;

  // jsdom has no layout engine: model just enough geometry for the page.
  window.HTMLElement.prototype.getBoundingClientRect = function () {
    const top = parseFloat((this.style && this.style.top) || 0);
    const h = parseFloat((this.style && this.style.height) || 0);
    return { top, left: 0, right: 0, bottom: top + (h || 1), width: 100, height: h || 1, x: 0, y: top };
  };
  Object.defineProperty(window.HTMLElement.prototype, 'clientHeight', { get() { return 800; }, configurable: true });
  Object.defineProperty(window.HTMLElement.prototype, 'clientWidth', { get() { return 1200; }, configurable: true });
  Object.defineProperty(window.HTMLElement.prototype, 'scrollTop', {
    get() { return this._st || 0; }, set(v) { this._st = v; }, configurable: true });
  Object.defineProperty(window.HTMLElement.prototype, 'scrollLeft', {
    get() { return this._sl || 0; }, set(v) { this._sl = v; }, configurable: true });
  window.HTMLElement.prototype.scrollBy = function () {};
  window.confirm = () => true;
  window.alert = () => {};
  window.localStorage = (() => { let v = null;
    return { getItem: () => v, setItem: (k, x) => { v = x; }, removeItem: () => { v = null; } }; })();
  return { window, doc: window.document };
}

function load(page, files) {
  // Expose the const/let bindings to the window by appending an explicit export.
  // BY_ID is a `let` that registerCalendars REASSIGNS, so expose a live getter
  // rather than a snapshot (a snapshot goes stale on the next registration).
  const combined = files.map(f => fs.readFileSync(path.join(ROOT, f), 'utf8')).join('\n;\n')
    + `\n;window.__x = { Store, gregorianCal, julianCal, hijriCal, presetCal, dayToDate,
       dateToDay, dayToJulian, julianToDay, gregorianToJdn, gregorianToDay, DAY0, calReady,
       safeFormatDay, formatDay, registerCalendars, validDate, daysInYear,
       daysInMonth, yearLabel };
       Object.defineProperty(window.__x, 'BY_ID', { get: () => BY_ID, configurable: true });`;
  page.window.eval(combined);
  return page.window.__x;
}

const ENGINE = ['cal/engine.js', 'cal/store.js'];

/* ========================================================================== */
console.log('\n[1] Timeline geometry (index.html)');
{
  const page = makePage('index.html');
  load(page, [...ENGINE, 'cal/timeline.js', 'cal/editor.js', 'cal/eventeditor.js',
               'cal/panels.js', 'cal/sidebar.js']);
  const d = page.doc;

  const ruler = [...d.querySelectorAll('.mark.lab')];
  const cols = [...d.querySelectorAll('#vt-inner .col')];
  ok(ruler.length > 0, 'year ruler draws labels', ruler.length + ' labels');
  ok(cols.length === 2, 'one column per calendar', cols.length + ' columns');

  // ruler labels must be Gregorian years; column labels too
  const rtexts = ruler.map(e => e.textContent.trim());
  ok(/BCE/.test(rtexts[0]), 'ruler starts at the deep past', rtexts[0]);
  const colLabs = [...cols[0].querySelectorAll('.mark.lab')].map(e => e.textContent.trim());
  ok(colLabs.length > 0, 'Gregorian column has year labels', colLabs.length + ' labels');

  // THE core check: the same year must sit at the same pixel in ruler and column.
  // Compare the inline 'top' styles (the source of truth), not getBoundingClientRect.
  const rtop = new Map(ruler.map(e => [e.textContent.trim(), parseFloat(e.style.top)]));
  const ctop = new Map([...cols[0].querySelectorAll('.mark.lab')].map(e => [e.textContent.trim(), parseFloat(e.style.top)]));
  let worst = 0, n = 0;
  for (const [t, y] of rtop) { if (!ctop.has(t)) continue; n++; worst = Math.max(worst, Math.abs(y - ctop.get(t))); }
  ok(n > 3, 'ruler and column share comparable year labels', n + ' shared');
  ok(worst < 0.001, 'ruler is pixel-aligned to the Gregorian column', 'worst ' + worst.toFixed(4) + ' px');

  ok(d.querySelectorAll('.ev').length > 0, 'events render', d.querySelectorAll('.ev').length + ' events');
  ok(!/NaN/.test(d.getElementById('readout').textContent), 'readout has no NaN');
  console.log('        readout: ' + d.getElementById('readout').textContent);
  console.log('        range:   ' + d.getElementById('range').textContent.trim());
}

/* ========================================================================== */
console.log('\n[2] Calendar CRUD (drawer on index.html)');
{
  const page = makePage('index.html');
  const X = load(page, [...ENGINE, 'cal/timeline.js', 'cal/editor.js', 'cal/eventeditor.js',
                        'cal/panels.js', 'cal/sidebar.js']);
  page.window.CalEditor.bind();
  const d = page.doc, w = page.window;

  const before = d.querySelectorAll('#calList .cal-item').length;
  ok(before === 2, 'seed shows 2 calendars', before + ' rows');

  // create through the CUSTOM section's add button
  d.querySelectorAll('.sec-head .btn')[1].click();
  ok(d.getElementById('drawer').hidden === false, 'editor opens');
  d.getElementById('fName').value = 'Test Republic';
  d.getElementById('fName').dispatchEvent(new w.Event('input', { bubbles: true }));
  d.getElementById('saveBtn').click();
  const after = d.querySelectorAll('#calList .cal-item').length;
  ok(after === before + 1, 'create adds a calendar without a reload', after + ' rows (was ' + before + ')');
  ok(!/epoch date is not valid/.test(d.getElementById('fErr').textContent), 'no epoch error on save');

  const saved = X.Store.load().calendars;
  const created = saved.find(c => c.name === 'Test Republic');
  ok(!!created, 'created calendar persisted');
  if (created) {
    ok(Number.isFinite(created.epochDay), 'created epoch resolves to a finite day', 'epochDay=' + created.epochDay);
    ok(created.months.length > 0, 'created calendar has months', created.months.length + ' months');
    X.registerCalendars(X.Store.load().calendars);
    const live = X.BY_ID[created.id];
    let probe; try { probe = JSON.stringify(X.dayToDate(created.epochDay, live)); }
    catch (e) { probe = 'THREW ' + e.message; }
    ok(!/THREW/.test(probe), 'created calendar converts', probe);
  }

  // edit
  const idx = saved.findIndex(c => c.name === 'Test Republic');
  const editBtn = [...d.querySelectorAll('#calList .cal-item')][idx]?.querySelector('[data-a=edit]');
  ok(!!editBtn, 'edit button present for new calendar');
  if (editBtn) {
    editBtn.click();
    d.getElementById('fName').value = 'Test Republic v2';
    d.getElementById('fName').dispatchEvent(new w.Event('input', { bubbles: true }));
    d.getElementById('saveBtn').click();
    const names = X.Store.load().calendars.map(c => c.name);
    ok(names.includes('Test Republic v2'), 'edit renames the calendar', names.join(', '));
  }

  // delete
  const afterEdit = [...d.querySelectorAll('#calList .cal-item')];
  const delBtn = afterEdit.find(c => c.querySelector('.t').textContent === 'Test Republic v2')?.querySelector('[data-a=del]');
  ok(!!delBtn, 'delete button present');
  if (delBtn) {
    delBtn.click();
    const names = X.Store.load().calendars.map(c => c.name);
    ok(!names.includes('Test Republic v2'), 'delete removes the calendar', names.join(', '));
  }
}

/* ========================================================================== */
console.log('\n[3] Event CRUD (drawer on index.html)');
{
  const page = makePage('index.html');
  page.doc.body.insertAdjacentHTML('beforeend',
    fs.readFileSync(path.join(ROOT, 'cal/event-drawer.html'), 'utf8'));
  const X = load(page, [...ENGINE, 'cal/timeline.js', 'cal/editor.js', 'cal/eventeditor.js',
                        'cal/panels.js', 'cal/sidebar.js']);
  page.window.CalEditor.bind();
  page.window.EventEditor.bind();
  const d = page.doc, w = page.window;

  const before = d.querySelectorAll('.ev-card').length;
  ok(before > 0, 'events panel renders', before + ' cards');

  d.getElementById('evAddBtn').click();
  d.getElementById('etitle').value = 'Verification event';
  d.getElementById('ey').value = '2000';
  d.getElementById('ed').value = '1';
  d.getElementById('etitle').dispatchEvent(new w.Event('input', { bubbles: true }));
  d.getElementById('ey').dispatchEvent(new w.Event('input', { bubbles: true }));
  d.getElementById('esaveBtn').click();

  const evs = X.Store.load().events;
  const made = evs.find(e => e.title === 'Verification event');
  ok(!!made, 'event created', evs.length + ' events');
  ok(made && made.date.y === 2000, 'event stores the native year');
  ok(!/NaN/.test(d.getElementById('econv').textContent || ''), 'conversion preview has no NaN');
  const after = d.querySelectorAll('.ev-card').length;
  ok(after === before + 1, 'new event appears in the panel', after + ' cards');
}

/* ========================================================================== */
console.log('\n[4] Conversion correctness (published reference points)');
{
  const page = makePage('index.html');
  const X = load(page, ENGINE);
  X.registerCalendars([X.gregorianCal(), X.julianCal(), X.hijriCal()]);
  const G = X.BY_ID.gregorian, J = X.BY_ID.julian, H = X.BY_ID.hijri;
  const jdn = (y, m, d) => X.gregorianToJdn(y, m, d);
  ok(jdn(2026, 10, 1) === X.DAY0, 'anchor 2026-10-01 is day 0', 'DAY0=' + X.DAY0);
  ok(JSON.stringify(X.dayToDate(0, G)) === JSON.stringify({ y: 2026, m: 10, d: 1 }), 'day 0 → 2026-10-01');
  // Published JDN values (Meeus ch.7): the engine must reproduce these EXACTLY.
  ok(X.gregorianToJdn(2000, 1, 1) === 2451545, '2000-01-01 = JDN 2451545', 'got ' + X.gregorianToJdn(2000, 1, 1));
  ok(X.gregorianToJdn(1987, 1, 27) === 2446823, '1987-01-27 = JDN 2446823', 'got ' + X.gregorianToJdn(1987, 1, 27));
  ok(X.gregorianToJdn(1582, 10, 15) === 2299161, '1582-10-15 = JDN 2299161', 'got ' + X.gregorianToJdn(1582, 10, 15));
  ok(X.gregorianToJdn(2026, 10, 1) === 2461315, 'anchor 2026-10-01 = JDN 2461315', 'got ' + X.gregorianToJdn(2026, 10, 1));
  // Derived offset: anchor - 2000-01-01 = 2461315 - 2451545
  ok(X.gregorianToDay(2000, 1, 1) === 2451545 - 2461315, '2000-01-01 offset from anchor',
     'got ' + X.gregorianToDay(2000, 1, 1));
  ok(X.julianToDay(1582, 10, 4) + 1 === X.gregorianToDay(1582, 10, 15), 'Julian 1582-10-04 → Gregorian 1582-10-15');
  // X is a live view of engine.js; julianToDay is exported there
  ok(typeof X.julianToDay === 'function', 'julianToDay exported');
  const ah1 = X.dateToDay(1, 1, 1, H);
  ok(JSON.stringify(X.dayToJulian(ah1)) === JSON.stringify([622, 7, 16]), 'AH 1/1/1 = Julian 622-07-16');
  ok(X.calReady(G) && X.calReady(H), 'both built-ins report ready');
}

/* ========================================================================== */
console.log('\n[5] Event conversion through a custom calendar (regression)');
{
  const page = makePage('index.html');
  const X = load(page, ENGINE);
  const g = X.gregorianCal(), h = X.hijriCal(), j = X.julianCal();
  const c = X.presetCal('egyptian'); c.id = 'c1';
  const R = X.registerCalendars([g, h, j, c]);
  const day = X.dateToDay(2000, 1, 1, R.c1);
  const gy = X.dayToDate(day, R.gregorian).y;
  const hy = X.dayToDate(day, R.hijri).y;
  // Egyptian 1/1/1 = 284-08-29 (Julian), so Egyptian 2000 lands ~2282 CE
  ok(gy > 2200 && gy < 2400, 'custom-calendar event converts to ~2282, not thousands off', String(gy));
  ok(hy > 1600 && hy < 1800, 'hijri conversion plausible', String(hy));
  ok(Number.isFinite(R.c1.epochDay), 'custom epochDay finite', String(R.c1.epochDay));
}

console.log('\n' + (failures === 0 ? 'ALL CHECKS PASS' : failures + ' CHECK(S) FAILED'));
process.exit(failures === 0 ? 0 : 1);
