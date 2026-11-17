/* Real-browser verification over the Chrome DevTools Protocol.
   Measures ACTUAL rendered geometry from Chrome — no jsdom, no mocks.

   Start Chrome first (separate profile, does not touch your normal Chrome):
     "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
       --remote-debugging-port=9223 \
       --user-data-dir=/tmp/chrome-hermes-test \
       --no-first-run --no-default-browser-check about:blank

   Then:  node verify_browser.js
*/
const http = require('http');
const PORT = process.env.CDP_PORT || 9223;

function getJSON(path) {
  return new Promise((resolve, reject) => {
    http.get({ host: '127.0.0.1', port: PORT, path }, (res) => {
      let b = '';
      res.on('data', (c) => { b += c; });
      res.on('end', () => {
        try { resolve(JSON.parse(b)); }
        catch (e) { reject(new Error(`GET ${path} -> HTTP ${res.statusCode}, empty/non-JSON body`)); }
      });
    }).on('error', reject);
  });
}

async function main() {
  let targets;
  try { targets = await getJSON('/json/list'); }
  catch (e) {
    console.error(`\nCannot reach Chrome on port ${PORT}.`);
    console.error('Start it with:');
    console.error('  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \\');
    console.error('    --remote-debugging-port=9223 --user-data-dir=/tmp/chrome-hermes-test \\');
    console.error('    --no-first-run --no-default-browser-check about:blank\n');
    process.exit(2);
  }
  const page = targets.find((t) => t.type === 'page');
  if (!page) { console.error('no page target'); process.exit(2); }

  const WebSocket = require('ws');
  const ws = new WebSocket(page.webSocketDebuggerUrl, { perMessageDeflate: false });
  await new Promise((res, rej) => { ws.on('open', res); ws.on('error', rej); });

  let id = 0;
  const pending = new Map();
  ws.on('message', (raw) => {
    const m = JSON.parse(raw);
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
  });
  const send = (method, params = {}) => new Promise((res) => {
    const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params }));
  });
  const ev = async (expr) => {
    const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
    if (r.result && r.result.exceptionDetails) {
      throw new Error(r.result.exceptionDetails.exception?.description || 'eval failed');
    }
    return r.result && r.result.result ? r.result.result.value : undefined;
  };

  await send('Page.enable');
  await send('Runtime.enable');
  // fresh profile -> no junk localStorage
  await send('Page.navigate', { url: 'http://127.0.0.1:8012/index.html?cb=cdp' });
  await new Promise((r) => setTimeout(r, 3000));

  let failures = 0;
  const ok = (c, l, d = '') => { console.log(`${c ? '  ok  ' : ' FAIL '} ${l}${d ? '  — ' + d : ''}`); if (!c) failures++; };

  const snap = await ev(`(() => {
    const q = s => document.querySelector(s);
    const qa = s => [...document.querySelectorAll(s)];
    const R = el => { const r = el.getBoundingClientRect(); return { top: +r.top.toFixed(2), h: +r.height.toFixed(2) }; };
    const o = {};
    o.viewportH = q('#vt-scroll').clientHeight;
    o.rulerLabels = qa('.ruler-lab').length;
    o.columns = qa('#vt-inner .col').length;
    o.rulerHasHead = !!q('.ruler .col-head');
    o.rulerHeadH = q('.ruler .col-head') ? +q('.ruler .col-head').getBoundingClientRect().height.toFixed(2) : null;
    o.colHeadH = qa('#vt-inner .col .col-head').map(h => +h.getBoundingClientRect().height.toFixed(2));

    // REAL ruler-vs-column alignment
    const ruler = new Map(qa('.ruler-lab').map(e => [e.textContent.trim(), e.getBoundingClientRect().top]));
    const gcol = qa('#vt-inner .col')[0];
    const cl = new Map([...gcol.querySelectorAll('.mark.lab')].map(e => [e.textContent.trim(), e.getBoundingClientRect().top]));
    let worst = 0, n = 0, wy = null;
    for (const [t, y] of ruler) { if (!cl.has(t)) continue; n++; const d = Math.abs(y - cl.get(t)); if (d > worst) { worst = d; wy = t; } }
    o.sharedYears = n; o.worstOffset = +worst.toFixed(2); o.worstYear = wy;

    // today
    o.rangeBefore = q('#range').textContent.trim();
    o.readoutBefore = q('#readout').textContent;
    q('#todayBtn').click();
    o.rangeAfter = q('#range').textContent.trim();
    o.readoutAfter = q('#readout').textContent;
    const cross = q('#cross');
    o.crossTop = cross ? +cross.getBoundingClientRect().top.toFixed(2) : null;
    const todayEv = qa('.ev').find(e => e.textContent.includes('Today'));
    o.todayEvTop = todayEv ? +todayEv.getBoundingClientRect().top.toFixed(2) : null;
    o.todayEvText = todayEv ? todayEv.textContent.replace(/\\s+/g, ' ').trim() : null;
    o.centre = +(q('#vt-scroll').getBoundingClientRect().top + q('#vt-scroll').clientHeight / 2).toFixed(2);
    // crosshair should sit on the Today event
    if (o.crossTop !== null && o.todayEvTop !== null) {
      o.crossVsEvent = +(o.crossTop - o.todayEvTop).toFixed(2);
    }
    o.evCount = qa('.ev').length;
    return o;
  })()`);

  console.log('\n[real browser geometry]');
  console.log('  viewport height      :', snap.viewportH);
  console.log('  ruler labels         :', snap.rulerLabels);
  console.log('  data columns         :', snap.columns);
  ok(snap.rulerHasHead, 'ruler has a header');
  ok(snap.rulerHeadH === Math.max(...snap.colHeadH),
     'ruler header height matches column headers',
     `ruler ${snap.rulerHeadH} vs columns ${snap.colHeadH}`);
  ok(snap.sharedYears > 3, 'shared year labels', snap.sharedYears);
  ok(snap.worstOffset < 1, 'ruler pixel-aligned to Gregorian column',
     `worst ${snap.worstOffset}px (year ${snap.worstYear})`);

  console.log('\n[today button]');
  console.log('  range before :', snap.rangeBefore);
  console.log('  range after  :', snap.rangeAfter);
  console.log('  readout after:', snap.readoutAfter);
  console.log('  crosshair top:', snap.crossTop, ' Today event top:', snap.todayEvTop,
              ' delta:', snap.crossVsEvent);
  ok(/2026/.test(snap.readoutAfter), 'readout shows the current year', snap.readoutAfter);
  ok(snap.crossVsEvent !== null && Math.abs(snap.crossVsEvent) < 60,
     'crosshair lands on the Today event', (snap.crossVsEvent ?? 'n/a') + 'px');
  ok(snap.evCount === 13, '13 seed events render', snap.evCount);

  console.log('\n' + (failures === 0 ? 'ALL REAL-BROWSER CHECKS PASS' : failures + ' FAILED'));
  ws.close();
  process.exit(failures ? 1 : 0);
}

main().catch((e) => { console.error('ERROR:', e.message); process.exit(1); });
