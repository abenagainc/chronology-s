/* Position-based geometry checks for Chronology S.
   verify.js asserts COUNTS and passes while the page is visibly broken.
   This asserts POSITIONS: marks inside the viewport, crosshair inside the
   viewport, bubbles a sane height, and a sane year in the range readout.

   Run: node verify_position.js   (needs Chrome on :9223 and the server on :8012) */
const http = require('http');
const WS = require('ws');

function req(method, path) {
  return new Promise((resolve, reject) => {
    const r = http.request({ host: '127.0.0.1', port: 9223, path, method }, x => {
      let b = ''; x.on('data', c => b += c);
      x.on('end', () => { try { resolve(JSON.parse(b)); } catch (e) { reject(new Error(b.slice(0, 80))); } });
    });
    r.on('error', reject); r.end();
  });
}

let pass = 0, fail = 0;
function ok(cond, label, detail = '') {
  if (cond) { pass++; console.log(`  ok   ${label}${detail ? '  — ' + detail : ''}`); }
  else { fail++; console.log(`  FAIL ${label}${detail ? '  — ' + detail : ''}`); }
}

(async () => {
  const tgt = await req('PUT', '/json/new?http://127.0.0.1:8012/index.html?cb=pos1');
  const ws = new WS(tgt.webSocketDebuggerUrl);
  await new Promise(r => ws.on('open', r));
  let id = 0; const pending = new Map();
  ws.on('message', r => {
    const m = JSON.parse(r);
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
  });
  const send = (method, params = {}) => new Promise(r => {
    const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params }));
  });
  const ev = async (expr) => {
    for (let attempt = 0; attempt < 3; attempt++) {
      const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, timeout: 10000 });
      if (r && r.result) {
        if (r.result.exceptionDetails) throw new Error(
          (r.result.exceptionDetails.exception?.description || '').slice(0, 200));
        return r.result.result.value;
      }
      await new Promise(res => setTimeout(res, 300));   // CDP dropped the reply; retry
    }
    throw new Error('no CDP reply after 3 attempts');
  };
  await send('Runtime.enable'); await send('Page.enable');
  /* Start from a clean store. Without this the harness inherits whatever the
     last probe left in localStorage (extra calendars, hidden ids), and results
     stop being reproducible. Must clear on the APP's origin, so load it first,
     clear, then reload. */
  await send('Page.navigate', { url: 'http://127.0.0.1:8012/index.html?cb=pos0' });
  await new Promise(r => setTimeout(r, 1500));
  await send('Runtime.evaluate', { expression: `localStorage.clear(); 'cleared'` });
  await send('Page.navigate', { url: 'http://127.0.0.1:8012/index.html?cb=pos1' });
  await new Promise(r => setTimeout(r, 3000));

  const PROBE = `(() => {
    const sc = document.querySelector('#vt-scroll');
    if (!sc) return { err: 'no #vt-scroll' };
    const box = sc.getBoundingClientRect();
    const inView = el => { const r = el.getBoundingClientRect();
      return r.bottom > box.top && r.top < box.bottom; };
    const marks = [...document.querySelectorAll('.col-body .mark')];
    const cross = document.querySelector('#cross');
    const bub = document.querySelector('#crossBubbles');
    const range = document.querySelector('#range').textContent;
    const years = (range.match(/-?\\d{3,}/g) || []).map(Number);
    return {
      scrollTop: Math.round(sc.scrollTop),
      scrollH: sc.scrollHeight,
      clientH: sc.clientHeight,
      vTop: Math.round(box.top), vBot: Math.round(box.bottom),
      marksTotal: marks.length,
      marksInView: marks.filter(inView).length,
      crossTop: cross ? Math.round(cross.getBoundingClientRect().top) : null,
      bubH: bub ? Math.round(bub.getBoundingClientRect().height) : null,
      rangeYears: years,
      range,
    };
  })()`;

  const saneYear = y => Number.isFinite(y) && Math.abs(y) < 10000;

  console.log('\n[position] initial load');
  let o = await ev(PROBE);
  ok(!o.err, 'timeline rendered', o.err || '');
  ok(o.rangeYears.length > 0 && o.rangeYears.every(saneYear),
     'range shows sane years', o.rangeYears.join(', '));
  ok(o.marksInView > 0, 'marks exist inside the viewport', `${o.marksInView}/${o.marksTotal}`);
  ok(o.crossTop !== null && o.crossTop >= o.vTop && o.crossTop <= o.vBot,
     'crosshair is inside the viewport', `cross ${o.crossTop} in [${o.vTop},${o.vBot}]`);
  ok(o.bubH !== null && o.bubH < 40, 'bubble strip is a sane height', `${o.bubH}px`);

  for (const [label, script] of [
    ['top',    'sc.scrollTop = 0'],
    ['middle', 'sc.scrollTop = sc.scrollHeight / 2'],
    ['bottom', 'sc.scrollTop = sc.scrollHeight'],
  ]) {
    console.log(`\n[position] scrolled to ${label}`);
    await send('Runtime.evaluate', { expression:
      `(() => { const sc = document.querySelector('#vt-scroll'); ${script};
         sc.dispatchEvent(new Event('scroll')); })()` });
    await new Promise(r => setTimeout(r, 500));
    o = await ev(PROBE);
    ok(o.marksInView > 0, `marks in view at ${label}`, `${o.marksInView}/${o.marksTotal}`);
    ok(o.crossTop >= o.vTop && o.crossTop <= o.vBot,
       `crosshair in viewport at ${label}`, `cross ${o.crossTop}`);
    ok(o.rangeYears.every(saneYear), `sane years at ${label}`, o.rangeYears.join(', '));
  }

  console.log('\n[position] zoom presets');
  for (const z of ['fit', 'millennia', 'centuries', 'decades', 'years', 'months', 'days']) {
    await send('Runtime.evaluate', { expression:
      `(() => { const s = document.querySelector('#zoomSel'); s.value = '${z}';
         s.dispatchEvent(new Event('change', { bubbles: true })); })()` });
    await new Promise(r => setTimeout(r, 450));
    o = await ev(PROBE);
    const okZoom = o.rangeYears.every(saneYear) && o.marksInView >= 0 && o.scrollTop >= 0;
    ok(okZoom, `preset '${z}' produces a sane view`,
       `scrollTop ${o.scrollTop}, marks ${o.marksInView}, years ${o.rangeYears.join(',')}`);
  }

  console.log('\n[position] Today');
  await send('Runtime.evaluate', { expression: `document.querySelector('#todayBtn').click()` });
  /* Today re-renders; reading the DOM in the same instant sees an empty column
     (0 marks) and reports a false failure. Let the rebuild settle. */
  await new Promise(r => setTimeout(r, 900));
  o = await ev(PROBE);
  const cur = new Date().getFullYear();
  ok(o.scrollTop > 0, 'Today moves the scroll position', `scrollTop ${o.scrollTop}`);
  /* the current year must fall INSIDE the displayed span (the span is wide) */
  const [a, b] = o.rangeYears;
  const lo = Math.min(a, b), hi = Math.max(a, b);
  ok(cur >= lo - 1 && cur <= hi + 1, 'Today shows the current era',
     `span ${lo}..${hi} (now ${cur})`);
  ok(o.marksInView > 0, 'marks in view after Today', `${o.marksInView}/${o.marksTotal}`);

  console.log(`\n${fail === 0 ? 'ALL POSITION CHECKS PASS' : fail + ' POSITION CHECK(S) FAILED'}  (${pass} passed)`);
  ws.close();
  process.exit(fail === 0 ? 0 : 1);
})().catch(e => { console.error('HARNESS ERROR', e.message); process.exit(2); });
