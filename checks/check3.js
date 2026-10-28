const { chromium } = require('playwright');
const fs = require('fs');
const libs = { 'js-yaml': 'node_modules/js-yaml/dist/js-yaml.min.js', 'marked': 'node_modules/marked/marked.min.js', 'dompurify': 'node_modules/dompurify/dist/purify.min.js' };
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/ERR_FAILED/.test(m.text())) errors.push('console: ' + m.text()); });
  await page.route('**/*', (route) => {
    const u = route.request().url();
    for (const [k, f] of Object.entries(libs)) if (u.includes('cdnjs') && u.includes(k)) return route.fulfill({ body: fs.readFileSync(f), contentType: 'application/javascript' });
    if (u.startsWith('file:')) return route.continue();
    return route.abort();
  });
  fs.writeFileSync('page.html', '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body>' + fs.readFileSync('flows.html', 'utf8') + '</body></html>');
  await page.goto('file://' + process.cwd() + '/page.html');
  await page.waitForTimeout(400);
  const out = {};
  await page.click('#left [data-act="pick-step"][data-v="2"]');
  out.pill2 = await page.textContent('.typepill .tp-link');
  // open the schema editor from the pill, add a field with a new nested type
  await page.click('.typepill .tp-link');
  out.modalRows = await page.locator('#modal .frow:not(.lbl)').count();
  await page.click('[data-act="sf-add"]');
  out.focusAfterAdd = await page.evaluate(() => document.activeElement.id);
  await page.keyboard.type('total');
  out.focusWhileTyping = await page.evaluate(() => document.activeElement.id);
  await page.selectOption('#sf-type-2', '__new');
  out.nestedLink = await page.locator('#modal .tp-link.sub').allTextContents();
  // invalid name keeps focus and shows an error
  await page.fill('#sf-name-0', '');
  await page.focus('#sf-name-0');
  await page.keyboard.type('1x');
  out.invalidErr = await page.textContent('#modal p.err');
  out.focusInvalid = await page.evaluate(() => document.activeElement.id);
  await page.fill('#sf-name-0', 'orderId');
  // rename the type itself
  await page.fill('#sc-title', 'Order request');
  out.slugFollowed = await page.inputValue('#sc-slug');
  await page.click('#modal footer [data-act="sc-close"]');
  out.pillRenamed = await page.textContent('.typepill .tp-link');
  // step 4: clear its message type, create a new one from the picker
  await page.click('#left [data-act="pick-step"][data-v="4"]');
  await page.click('.typepill .tp-x');
  await page.click('#tp-message');
  await page.keyboard.type('shipment notice');
  out.focusPicker = await page.evaluate(() => document.activeElement.id);
  out.options = await page.locator('.tp-list .tp-opt').allTextContents();
  await page.screenshot({ path: 'shots/s1-picker.png' });
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  out.modalTitle = await page.textContent('#sc-heading');
  await page.click('[data-act="sf-add"]');
  await page.keyboard.type('trackingId');
  await page.screenshot({ path: 'shots/s2-editor.png' });
  await page.keyboard.press('Escape');
  out.filledData = await page.inputValue('#st-data');
  out.pill4 = await page.textContent('.typepill .tp-link');
  // result picker sees types from included systems
  await page.click('#tp-result');
  await page.keyboard.type('pay');
  out.resultOptions = await page.locator('.tp-list .tp-opt').allTextContents();
  await page.keyboard.press('Escape');
  // step 3 data matches its type; break it and fill
  await page.click('#left [data-act="pick-step"][data-v="3"]');
  out.check3 = await page.locator('#right .hint').allTextContents().then((xs) => xs.filter((x) => /Matches|match/.test(x)));
  await page.fill('#st-data', 'orderId: ord_9');
  await page.waitForTimeout(100);
  out.check3b = await page.locator('#right li.hint, #right ul.hint li').allTextContents();
  await page.click('[data-act="fill-data"]');
  out.afterFill = await page.inputValue('#st-data');
  await page.click('[data-act="md"]');
  const md = await page.inputValue('#md-text');
  out.mdTypes = md.slice(md.indexOf('## Types'), md.indexOf('## Flow'));
  out.mdMsg = (md.match(/message: [a-z-]+/g) || []).slice(0, 4);
  out.mdHasTypes = md.includes('## Types') && md.includes('order-request:\n    title: Order request') && md.includes('shipment-notice:') && md.includes('total: total') && md.includes('message: order-request');
  out.errors = errors;
  console.log(JSON.stringify(out, null, 1));
  await browser.close();
})();
