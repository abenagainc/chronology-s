/* Pin down the residual 15.7px crosshair gap. */
const puppeteer = require('puppeteer-core');
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
(async () => {
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new',
    args: ['--remote-debugging-port=9335', '--no-first-run'] });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 900 });
    await page.goto('http://127.0.0.1:8012/index.html', { waitUntil: 'networkidle0' });
    await page.evaluate(() => localStorage.removeItem('chronologyX.v1'));
    await page.reload({ waitUntil: 'networkidle0' });
    await new Promise(r => setTimeout(r, 400));
    await page.click('#today');
    await new Promise(r => setTimeout(r, 800));

    const d = await page.evaluate(() => {
      const r = el => { const b = el.getBoundingClientRect(); return { top: b.top, h: b.height }; };
      const sc = document.getElementById('vt-scroll');
      const cross = document.getElementById('cross');
      const ev = [...document.querySelectorAll('.ev')].find(e => e.textContent.includes('Today'));
      const body = ev.closest('.col-body');
      return {
        scrollTop: sc.scrollTop,
        clientHeight: sc.clientHeight,
        scTop: r(sc).top,
        crossTop: r(cross).top,
        crossStyleTop: cross.style.top,
        evTop: r(ev).top,
        evH: r(ev).h,
        evStyleTop: ev.style.top,
        bodyTop: r(body).top,
        bodyStyleH: body.style.height,
      };
    });
    console.log(JSON.stringify(d, null, 2));
    console.log('');
    console.log('Today box centre in viewport = ' + (d.evTop + d.evH / 2).toFixed(2));
    console.log('crosshair in viewport        = ' + d.crossTop.toFixed(2));
    console.log('gap                          = ' + Math.abs(d.crossTop - (d.evTop + d.evH / 2)).toFixed(2));
    console.log('');
    console.log('crosshair style.top  = ' + d.crossStyleTop + '  (body coords)');
    console.log('Today  style.top     = ' + d.evStyleTop + '  (body coords)');
    console.log('=> in body coordinates the gap is ' +
      Math.abs(parseFloat(d.crossStyleTop) - parseFloat(d.evStyleTop)).toFixed(2) + ' px');
    console.log('body top in viewport = ' + d.bodyTop.toFixed(2) + '  scrollTop=' + d.scrollTop +
      '  mid=' + (d.scrollTop + d.clientHeight / 2));
  } finally { await browser.close(); }
})();
