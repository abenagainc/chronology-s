/* Layout audit over CDP: catches visual defects a stub can't — overflow,
   clipping, zero-size elements, off-canvas content, unstyled text. */
const http = require('http');
const PORT = process.env.CDP_PORT || 9223;

function getJSON(path) {
  return new Promise((resolve, reject) => {
    http.get({ host: '127.0.0.1', port: PORT, path }, (res) => {
      let b = ''; res.on('data', (c) => { b += c; });
      res.on('end', () => { try { resolve(JSON.parse(b)); } catch (e) { reject(e); } });
    }).on('error', reject);
  });
}

async function main() {
  const targets = await getJSON('/json/list');
  const page = targets.find((t) => t.type === 'page');
  const WebSocket = require('ws');
  const ws = new WebSocket(page.webSocketDebuggerUrl, { perMessageDeflate: false });
  await new Promise((r) => ws.on('open', r));
  let id = 0; const pending = new Map();
  ws.on('message', (raw) => {
    const m = JSON.parse(raw);
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
  });
  const send = (method, params = {}) => new Promise((res) => {
    const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params }));
  });
  const ev = async (expr) => {
    const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true });
    if (r.result?.exceptionDetails) throw new Error(JSON.stringify(r.result.exceptionDetails.exception?.description || r.result.exceptionDetails));
    return r.result?.result?.value;
  };
  await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 1600, height: 1000, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url: process.argv[2] || 'http://127.0.0.1:8012/index.html' });
  await new Promise((r) => setTimeout(r, 2500));

  const out = await ev(`(() => {
    const issues = [];
    const q = s => document.querySelector(s);
    const qa = s => [...document.querySelectorAll(s)];
    const cs = el => getComputedStyle(el);

    // 1. every element must be inside the viewport horizontally
    const W = document.documentElement.clientWidth;
    for (const el of qa('body *')) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 && r.height === 0) continue;
      if (r.right > W + 2 && !el.closest('#vt-scroll') && !el.closest('.body')) {
        issues.push('overflow-right: ' + (el.className || el.tagName) + ' right=' + r.right.toFixed(0) + ' w=' + W);
      }
    }

    // 2. text clipping in headers
    for (const h of qa('.col-head, .cal-item .t, .cal-item .s')) {
      if (h.scrollWidth > h.clientWidth + 1) {
        issues.push('clipped: ' + h.className + ' "' + h.textContent.trim().slice(0,30) + '" scroll=' + h.scrollWidth + ' client=' + h.clientWidth);
      }
    }

    // 3. contrast sanity: text must not be near-invisible on its panel
    const lum = c => { const m = c.match(/\\d+/g).map(Number); return 0.2126*m[0]+0.7152*m[1]+0.0722*m[2]; };
    for (const sel of ['.brand .name', '.side .label', '.tl-range .range', '.col-head', '.ruler-lab', '.legend']) {
      const el = q(sel); if (!el) { issues.push('missing: ' + sel); continue; }
      const s = cs(el);
      const fg = lum(s.color), bgc = lum(s.backgroundColor === 'rgba(0, 0, 0, 0)' ? '0,0,0' : s.backgroundColor);
      if (Math.abs(fg - bgc) < 12) issues.push('low-contrast: ' + sel + ' color=' + s.color + ' bg=' + s.backgroundColor);
    }

    // 4. sidebar and main must not overlap
    const side = q('.side').getBoundingClientRect();
    const main = q('.main').getBoundingClientRect();
    if (main.left < side.right - 1) issues.push('overlap: main.left=' + main.left.toFixed(0) + ' < side.right=' + side.right.toFixed(0));

    // 5. timeline scroll area must be visible and sized
    const sc = q('#vt-scroll').getBoundingClientRect();
    if (sc.height < 50) issues.push('timeline too short: h=' + sc.height.toFixed(0));
    if (sc.bottom > window.innerHeight + 1) issues.push('timeline below fold: bottom=' + sc.bottom.toFixed(0) + ' vh=' + window.innerHeight);

    // 6. computed palette matches the design tokens
    const root = cs(document.documentElement);
    const toks = {};
    for (const k of ['--bg','--panel','--text','--muted','--accent']) toks[k] = root.getPropertyValue(k).trim();
    const want = {'--bg':'#181818','--panel':'#282c28','--text':'#edefe8','--muted':'#a5aaa0','--accent':'#afc8ac'}; for (const [k,v] of Object.entries(want)) if (toks[k] !== v) issues.push('token '+k+'='+toks[k]+' want '+v);

    // 7. events visible
    const evs = qa('.ev');
    if (!evs.length) issues.push('no events rendered');

    return { issues, toks, counts: {
      calItems: qa('.cal-item').length,
      columns: qa('#vt-inner .col').length,
      events: evs.length,
      ruler: qa('.ruler-lab').length,
    }, sizes: {
      sideW: side.width.toFixed(0), mainW: main.width.toFixed(0),
      scH: sc.height.toFixed(0), scW: sc.width.toFixed(0),
    }};
  })()`);

  console.log('palette tokens:', JSON.stringify(out.toks));
  console.log('counts:', JSON.stringify(out.counts));
  console.log('sizes:', JSON.stringify(out.sizes));
  console.log('');
  if (out.issues.length === 0) console.log('NO LAYOUT ISSUES');
  else { console.log(out.issues.length + ' ISSUE(S):'); out.issues.forEach((i) => console.log('  - ' + i)); }
  ws.close();
}
main().catch((e) => { console.error('ERROR', e.message); process.exit(1); });
