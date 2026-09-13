/* Run with Playwright available: node tools/test_dialogs.cjs */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { chromium } = require('playwright');

const root = path.resolve(__dirname, '..');
const server = http.createServer((req, res) => {
  const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  let file = path.resolve(root, '.' + pathname);
  if (file !== root && !file.startsWith(root + path.sep)) { res.writeHead(403).end(); return; }
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
  if (!fs.existsSync(file)) { res.writeHead(404).end(); return; }
  const type = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json' }[path.extname(file)];
  res.setHeader('Content-Type', (type || 'text/plain') + '; charset=utf-8');
  res.end(fs.readFileSync(file));
});

(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = 'http://127.0.0.1:' + server.address().port;
  let browser;
  try {
    browser = await chromium.launch({ headless: true, channel: process.env.TEST_BROWSER_CHANNEL || 'chrome' });
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('https://cdn.jsdelivr.net/**', route => route.abort());

    await page.goto(base + '/c/W1.1.1/');
    await page.evaluate(() => {
      const atoms = [...document.querySelectorAll('.atom')];
      atoms.slice(2).forEach(atom => atom.remove());
      atoms.slice(0, 2).forEach(atom => {
        atom.querySelector('.atom-body').setAttribute('data-drill', '공공조달은 공공구매의 기준이다');
      });
    });
    const start = page.getByRole('button', { name: '이 절 빈칸 암기', exact: true });
    await start.click();
    assert.equal(await page.getByRole('dialog').count(), 1);
    await page.locator('#ppmIn').fill('공공조달 공공구매');
    await page.evaluate(() => { ppmDrillCheck(); ppmDrillCheck(); ppmDrillReveal(); });
    assert.equal(await page.locator('#ppmFb').textContent(), '맞았습니다 (2/2)');
    assert.equal(await page.locator('#ppmCheck').isDisabled(), true);
    await page.locator('#ppmNext').click();
    assert.match(await page.locator('.modal-top').textContent(), /2 \/ 2.*맞힘 1/);
    await page.locator('#ppmReveal').click();
    await page.evaluate(() => { document.getElementById('ppmIn').value = '공공조달 공공구매'; ppmDrillCheck(); });
    await page.locator('#ppmNext').click();
    assert.match(await page.locator('#ppmModal').textContent(), /2장 중 1장을 한 번에 맞혔습니다/);
    await page.keyboard.press('Shift+Tab');
    assert.equal(await page.evaluate(() => document.activeElement.textContent), '닫기');
    await page.keyboard.press('Tab');
    assert.equal(await page.evaluate(() => document.activeElement.textContent), '다시');
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('#ppmModal').isHidden(), true);
    assert.equal(await start.evaluate(el => el === document.activeElement), true);
    assert.equal(await page.evaluate(() => document.documentElement.style.overflow), '');

    // A correct prefix with an extra answer must not count as correct.
    await start.click();
    await page.locator('#ppmIn').fill('공공조달 공공구매 추가답');
    await page.locator('#ppmCheck').click();
    assert.match(await page.locator('#ppmFb').getAttribute('class'), /\bno\b/);
    await page.keyboard.press('Escape');

    await page.goto(base + '/news/?private=must-not-be-shared');
    await page.evaluate(() => { window.open = url => { window.openedReport = url; return null; }; });
    const reportLinks = page.locator('.foot-report');
    assert.ok(await reportLinks.count() >= 2);
    for (let i = 0; i < await reportLinks.count(); i++) {
      await reportLinks.nth(i).click();
      assert.equal(await page.getByRole('dialog', { name: '오류 신고' }).count(), 1);
      await page.keyboard.press('Escape');
      assert.equal(await reportLinks.nth(i).evaluate(el => el === document.activeElement), true);
    }
    await reportLinks.last().click();
    assert.equal(await page.locator('label[for="repQuote"]').count(), 1);
    assert.match(await page.locator('#repHelp').textContent(), /계정명은 공개/);
    assert.equal(await page.locator('#repNameRow').isHidden(), true);
    await page.locator('#repSend').click();
    assert.equal(await page.locator('#repQuote').getAttribute('aria-invalid'), 'true');
    await page.locator('#repQuote').fill('틀린 내용입니다.');
    await page.locator('#repSend').click();
    const issue = new URL(await page.evaluate(() => window.openedReport));
    assert.equal(issue.hostname, 'github.com');
    assert.ok(!issue.searchParams.get('body').includes('must-not-be-shared'));
    assert.match(issue.searchParams.get('body'), /틀린 내용입니다/);
    assert.equal(await page.locator('#repMsg a').getAttribute('href'), issue.href);
    await page.locator('.rep-news').focus();
    await page.keyboard.press('Tab');
    assert.equal(await page.evaluate(() => document.activeElement.className), 'rep-x');
    await page.keyboard.press('Shift+Tab');
    assert.equal(await page.evaluate(() => document.activeElement.className), 'rep-news');
    await page.keyboard.press('Escape');

    // Pending requests cannot duplicate, clear new form state, or close a reopened dialog.
    await page.evaluate(() => {
      window.PPM_SUPABASE = { url: 'https://report.invalid', anon: 'test' };
      window.reportRequests = [];
      window.fetch = (url, options) => new Promise(resolve => {
        window.reportRequests.push({ url, options });
        window.resolveReport = resolve;
      });
      localStorage.setItem('ppm.reporter.v1', '이전 이름');
    });
    await reportLinks.last().click();
    await page.locator('#repQuote').fill('직접 접수 테스트');
    await page.locator('#repName').fill('');
    await page.evaluate(() => { document.getElementById('repSend').onclick(); document.getElementById('repSend').onclick(); });
    assert.equal(await page.evaluate(() => window.reportRequests.length), 1);
    assert.equal(await page.evaluate(() => localStorage.getItem('ppm.reporter.v1')), null);
    await page.keyboard.press('Escape');
    await reportLinks.last().click();
    await page.locator('#repQuote').fill('새 신고 작성 중');
    await page.evaluate(() => window.resolveReport({ ok: true }));
    assert.equal(await page.locator('.rep-mask').isVisible(), true);
    assert.equal(await page.locator('#repQuote').inputValue(), '새 신고 작성 중');
    assert.equal(await page.locator('#repMsg').textContent(), '');
    assert.equal(await page.locator('#repSend').isEnabled(), true);
    assert.deepEqual(errors, []);
    console.log('PASS: drill scoring, reveal lock, keyboard focus, report fallback, privacy, and async lifecycle');
  } finally {
    if (browser) await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
