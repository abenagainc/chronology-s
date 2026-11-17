/* Verify the timeline's ruler/column/zoom behaviour WITHOUT a browser.
   Runs the real timeline.js against a DOM stub and inspects the generated
   DOM + inline geometry — the same values the browser renders from. */
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');
const ROOT = __dirname;

const dom = new JSDOM(fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8'),
  { url: 'http://127.0.0.1:8012/', runScripts: 'outside-only', pretendToBeVisual: true });
const { window } = dom;

let failures = 0;
const ok = (c, l, d = '') => { console.log(`${c ? '  ok  ' : ' FAIL '} ${l}${d ? '  — ' + d : ''}`); if (!c) failures++; };

// jsdom has no layout engine. Model the one thing that matters for the readout:
// a column BODY sits HEADER_H below the scroll-content origin, so
// bodyOffset() = HEADER_H. (bodyOffset() measures body.top - scroll.top + scrollTop.)
const HEADER_H = 46;
let scrollTop = 0;
window.HTMLElement.prototype.getBoundingClientRect = function () {
  const el = this;
  const top = parseFloat((el.style && el.style.top) || 0);
  const h = parseFloat((el.style && el.style.height) || 0);
  // a .col-body is a child of a .col, whose header occupies the first HEADER_H px
  if (el.classList && el.classList.contains('col-body')) {
    return { top: HEADER_H + scrollTop, left: 0, right: 0, bottom: HEADER_H + scrollTop + h,
             width: 100, height: h || 1, x: 0, y: HEADER_H + scrollTop };
  }
  return { top, left: 0, right: 0, bottom: top + (h || 1), width: 100, height: h || 1, x: 0, y: top };
};
Object.defineProperty(window.HTMLElement.prototype, 'clientHeight', { get() { return 800; }, configurable: true });
Object.defineProperty(window.HTMLElement.prototype, 'clientWidth', { get() { return 1200; }, configurable: true });
Object.defineProperty(window.HTMLElement.prototype, 'scrollTop', {
  get() { return scrollTop; }, set(v) { scrollTop = v; }, configurable: true });
window.HTMLElement.prototype.scrollBy = function () {};
window.confirm = () => true;
window.localStorage = (() => { let v = null;
  return { getItem: () => v, setItem: (k, x) => { v = x; }, removeItem: () => { v = null; } }; })();

const combined = ['cal/engine.js', 'cal/store.js', 'cal/timeline.js']
  .map(f => fs.readFileSync(path.join(ROOT, f), 'utf8')).join('\n;\n');
window.eval(combined);

const doc = window.document;

console.log('[ruler vs columns]');
const ruler = [...doc.querySelectorAll('.ruler-lab')];
const cols = [...doc.querySelectorAll('#vt-inner .col')];
ok(ruler.length > 0, 'ruler draws labels', ruler.length);
ok(cols.length === 2, 'one column per calendar', cols.length);
ok(!!doc.querySelector('.ruler .col-head'), 'ruler has a header (the offset fix)');
ok(doc.querySelector('.ruler .col-head').textContent.includes('Gregorian'),
   'ruler header names the reference');

// THE core check: same year -> same y in ruler and Gregorian column.
// Compare inline `top` values: these ARE the coordinates the browser uses.
const rtop = new Map(ruler.map(e => [e.textContent.trim(), parseFloat(e.style.top)]));
const ctop = new Map([...cols[0].querySelectorAll('.mark.lab')].map(e => [e.textContent.trim(), parseFloat(e.style.top)]));
let worst = 0, n = 0, worstYear = null;
for (const [t, y] of rtop) {
  if (!ctop.has(t)) continue;
  n++;
  const d = Math.abs(y - ctop.get(t));
  if (d > worst) { worst = d; worstYear = t; }
}
ok(n > 3, 'ruler and column share comparable year labels', n + ' shared');
ok(worst < 0.001, 'ruler pixel-aligned to Gregorian column', `worst ${worst.toFixed(4)}px (year ${worstYear})`);

// every column's marks must sit inside its body
const col0 = cols[0].querySelector('.col-body');
const bodyH = parseFloat(col0.style.height);
const marksInside = [...cols[0].querySelectorAll('.mark')].every(m => parseFloat(m.style.top) <= bodyH + 1);
ok(marksInside, 'all marks inside the column body', 'bodyH=' + Math.round(bodyH) + 'px');

console.log('\n[zoom]');
const range = doc.getElementById('range').textContent;
const ppd = parseFloat(/([0-9.]+) px\/day/.exec(range)?.[1] || 'NaN');
ok(Number.isFinite(ppd), 'range reports a px/day scale', String(ppd));
ok(ppd > 0.001 && ppd < 0.05, 'zoom is a sane overview scale (not 0.001, not 1.85)', ppd.toFixed(6) + ' px/day');
const yearsVisible = 800 / (ppd * 365.2425);
ok(yearsVisible > 1 && yearsVisible < 2000, 'a sensible span visible in an 800px pane',
   yearsVisible.toFixed(0) + ' years');

console.log('\n[readout]');
const ro = doc.getElementById('readout').textContent;
ok(!/NaN/.test(ro), 'readout has no NaN');
ok(/2026/.test(ro), 'readout includes the current year', ro);
ok((ro.split('·').length === 2), 'readout lists exactly the 2 calendars', ro);

console.log('\n[events]');
const evs = [...doc.querySelectorAll('.ev')];
ok(evs.length === 13, 'all 13 seed events render', evs.length);
const todayBox = evs.find(e => e.textContent.includes('Today'));
ok(!!todayBox, 'the "Today" event renders');
ok(/2026-11-17/.test(todayBox.textContent), 'Today box shows the real date', todayBox.textContent.replace(/\s+/g, ' '));

console.log('\n' + (failures === 0 ? 'PASS' : failures + ' FAILED'));
process.exit(failures ? 1 : 0);
