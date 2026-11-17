/* Real-browser verification for Chronology Tool S.
   Drives the actual page in Chrome and measures REAL rendered pixels.
   Run:  node verify-browser.js
   Requires: puppeteer-core (npm i puppeteer-core) and Chrome. */
const puppeteer = require('puppeteer-core');

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const URL = process.env.URL || 'http://127.0.0.1:8012/index.html';
const PORT = process.env.PORT || '9333';

let failures = 0;
const ok = (cond, label, detail = '') => {
  console.log(`${cond ? '  ok  ' : ' FAIL '} ${label}${detail ? '  — ' + detail : ''}`);
  if (!cond) failures++;
};

(async () => {
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: 'new',
    args: [`--remote-debugging-port=${PORT}`, '--no-first-run', '--no-default-browser-check'],
  });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 900 });

    const errs = [];
    page.on('pageerror', e => errs.push('pageerror: ' + e.message));
    page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()); });

    await page.goto(URL, { waitUntil: 'networkidle0' });
    await page.evaluate(() => localStorage.removeItem('chronologyX.v1'));
    await page.reload({ waitUntil: 'networkidle0' });
    await new Promise(r => setTimeout(r, 600));

    console.log('\n[A] Real rendered geometry — ' + URL);

    const geo = await page.evaluate(() => {
      const r = el => { const b = el.getBoundingClientRect(); return { top: b.top, left: b.left, h: b.height, w: b.width }; };
      const ruler = document.querySelector('.ruler');
      const rulerHead = ruler && ruler.querySelector('.col-head');
      const rulerBody = ruler && ruler.querySelector('.ruler-body');
      const cols = [...document.querySelectorAll('#vt-inner .col')];
      const firstColHead = cols[0] && cols[0].querySelector('.col-head');
      const firstColBody = cols[0] && cols[0].querySelector('.col-body');
      const rulerLabs = [...(ruler ? ruler.querySelectorAll('.ruler-lab') : [])];
      const colLabs = [...(cols[0] ? cols[0].querySelectorAll('.mark.lab') : [])];
      return {
        ruler: ruler ? r(ruler) : null,
        rulerHead: rulerHead ? r(rulerHead) : null,
        rulerBody: rulerBody ? r(rulerBody) : null,
        colHead: firstColHead ? r(firstColHead) : null,
        colBody: firstColBody ? r(firstColBody) : null,
        rulerLabCount: rulerLabs.length,
        colLabCount: colLabs.length,
        colCount: cols.length,
        rulerLabs: rulerLabs.slice(0, 400).map(e => ({ t: e.textContent.trim(), top: e.getBoundingClientRect().top })),
        colLabs: colLabs.slice(0, 400).map(e => ({ t: e.textContent.trim(), top: e.getBoundingClientRect().top })),
        readout: document.getElementById('readout').textContent,
        range: document.getElementById('range').textContent.trim(),
        bodyH: firstColBody ? firstColBody.getBoundingClientRect().height : null,
      };
    });

    ok(geo.ruler && geo.rulerHead, 'ruler has a header bar like the columns');
    ok(geo.rulerHead && geo.colHead &&
       Math.abs(geo.rulerHead.h - geo.colHead.h) < 1.0,
       'ruler header height matches column header',
       geo.rulerHead && geo.colHead ? geo.rulerHead.h.toFixed(1) + ' vs ' + geo.colHead.h.toFixed(1) : 'n/a');
    ok(geo.rulerBody && geo.colBody &&
       Math.abs(geo.rulerBody.top - geo.colBody.top) < 1.0,
       'ruler body starts at the same y as column bodies',
       geo.rulerBody && geo.colBody ? geo.rulerBody.top.toFixed(1) + ' vs ' + geo.colBody.top.toFixed(1) : 'n/a');

    // THE core check, on REAL pixels: same year -> same y in ruler and column.
    // Both are translateY(-50%) labels, so compare their body-relative tops.
    const rBody = geo.rulerBody;
    const cBody = geo.colBody;
    const rel = (t, bodyTop) => t - bodyTop;
    const rmap = new Map(geo.rulerLabs.map(x => [x.t, rel(x.top, rBody.top)]));
    let worst = 0, n = 0, worstYear = null;
    for (const { t, top } of geo.colLabs) {
      if (!rmap.has(t)) continue;
      n++;
      const d = Math.abs(rmap.get(t) - rel(top, cBody.top));
      if (d > worst) { worst = d; worstYear = t; }
    }
    ok(n > 3, 'ruler and Gregorian column share year labels', n + ' shared');
    ok(worst < 1.5, 'REAL pixels: ruler aligned to Gregorian column',
       'worst ' + worst.toFixed(2) + ' px' + (worstYear ? ' at ' + worstYear : ''));

    ok(geo.colLabCount > 0, 'column year labels are visible', geo.colLabCount + ' labels');
    ok(geo.rulerLabCount > 0, 'ruler labels are visible', geo.rulerLabCount + ' labels');
    ok(geo.colCount === 2, 'exactly 2 calendar columns', geo.colCount + ' columns');
    ok(!/NaN/.test(geo.readout), 'readout has no NaN', geo.readout);
    console.log('        range:   ' + geo.range);
    console.log('        readout: ' + geo.readout);

    // ---- the same day must sit at the same height in every column ----------
    const align = await page.evaluate(() => {
      // pick a distinctive event present in the Gregorian column, then find the
      // vertical position of the crosshair-relative day in each column's marks.
      const cols = [...document.querySelectorAll('#vt-inner .col')];
      // Compute, for each column, the y of its year-2000 mark (or nearest), and
      // compare against the ruler's year-2000 label.
      const rulerLabs = [...document.querySelectorAll('.ruler-lab')];
      const pick = (arr, txt) => arr.find(e => e.textContent.trim() === txt);
      const out = [];
      for (const y of ['1000', '1500', '2000']) {
        const rl = pick(rulerLabs, y);
        const ys = [];
        for (const c of cols) {
          const l = pick([...c.querySelectorAll('.mark.lab')], y);
          if (!l) { ys.push(null); continue; }
          const rb = rl.getBoundingClientRect();
          const lb = l.getBoundingClientRect();
          // normalise by the column's own body top so sticky offsets cancel
          const cbody = c.querySelector('.col-body').getBoundingClientRect().top;
          ys.push((lb.top - cbody) - (rb.top - rl.getBoundingClientRect().top));
        }
        out.push({ year: y, offsets: ys });
      }
      return out;
    });
    console.log('\n[B] Cross-column day alignment (normalised px offsets):');
    for (const a of align) {
      console.log('        year ' + a.year + ': ' + a.offsets.map(o => o === null ? 'n/a' : o.toFixed(2)).join(', '));
    }

    // ---- [C] the today button ---------------------------------------------
    console.log('\n[C] "today" button');
    await page.evaluate(() => { document.getElementById('vt-scroll').scrollTop = 0; });
    await new Promise(r => setTimeout(r, 300));
    const before = await page.evaluate(() => document.getElementById('range').textContent.trim());
    await page.click('#today');
    await new Promise(r => setTimeout(r, 800));
    const after = await page.evaluate(() => {
      const sc = document.getElementById('vt-scroll');
      const cross = document.getElementById('cross');
      const ev = [...document.querySelectorAll('.ev')].find(e => e.textContent.includes('Today'));
      const r = el => { const b = el.getBoundingClientRect();
        return { top: b.top, left: b.left, w: b.width, h: b.height, bottom: b.bottom }; };
      return {
        range: document.getElementById('range').textContent.trim(),
        readout: document.getElementById('readout').textContent,
        scrollTop: sc.scrollTop,
        cross: cross ? r(cross) : null,
        viewportMid: sc.getBoundingClientRect().top + sc.clientHeight / 2,
        todayBox: ev ? { ...r(ev), text: ev.textContent.replace(/\s+/g, ' ').trim() } : null,
      };
    });

    console.log('        before: ' + before);
    console.log('        after:  ' + after.range);
    console.log('        readout: ' + after.readout);
    ok(before !== after.range, 'clicking today changes the view');
    ok(after.todayBox, 'the "Today" event box is rendered',
       after.todayBox ? after.todayBox.text : 'not found');
    if (after.todayBox && after.cross) {
      // the crosshair is a 1px line; the event box has height. Compare the
      // crosshair to the TOP of the box (where the day is anchored), which is
      // the meaningful alignment.
      const gap = Math.abs(after.cross.top - after.todayBox.top);
      ok(gap < 3, 'crosshair sits on the Today event row', 'gap ' + gap.toFixed(1) + ' px');
    }
    ok(Math.abs(after.cross.top - after.viewportMid) < 2, 'crosshair centred in viewport',
       after.cross ? after.cross.top.toFixed(1) + ' vs ' + after.viewportMid.toFixed(1) : 'no crosshair');
    ok(!/NaN/.test(after.readout), 'readout sane after today', after.readout);

    // the readout must name today's date
    const todayStr = await page.evaluate(() => {
      const n = new Date();
      return n.getFullYear() + '-' + String(n.getMonth() + 1).padStart(2, '0') + '-' + String(n.getDate()).padStart(2, '0');
    });
    ok(after.readout.startsWith(todayStr), 'readout names today', todayStr + ' vs ' + after.readout);

    // zoom sanity: the today view must be readable, not absurdly close/far
    const ppm = after.range.match(/([\d.]+) px\/day/);
    if (ppm) {
      const ppd = parseFloat(ppm[1]);
      ok(ppd > 0.5 && ppd < 40, 'today zoom shows a usable span', ppd.toFixed(3) + ' px/day');
      const daysVisible = 900 / ppd;
      ok(daysVisible > 60 && daysVisible < 4000, 'visible span is a sensible window',
         '≈' + Math.round(daysVisible) + ' days');
    }

    const realErrs = errs.filter(e => !/favicon|\b404\b/.test(e));
    ok(realErrs.length === 0, 'no page errors', realErrs.join(' | ') || 'none');
    if (errs.length) console.log('        (ignored: ' + errs.join(' | ') + ')');

    await page.screenshot({ path: 'verify-screenshot.png', fullPage: false });
    console.log('\n        screenshot: verify-screenshot.png');
  } finally {
    await browser.close();
  }
  console.log('\n' + (failures === 0 ? 'BROWSER CHECKS PASS' : failures + ' BROWSER CHECK(S) FAILED'));
  process.exit(failures === 0 ? 0 : 1);
})();
