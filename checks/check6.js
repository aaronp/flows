const { chromium } = require('playwright');
const fs = require('fs');
const libs = { 'js-yaml': 'node_modules/js-yaml/dist/js-yaml.min.js', 'marked': 'node_modules/marked/marked.min.js', 'dompurify': 'node_modules/dompurify/dist/purify.min.js' };
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.route('**/*', (route) => { const u = route.request().url(); for (const [k, f] of Object.entries(libs)) if (u.includes('cdnjs') && u.includes(k)) return route.fulfill({ body: fs.readFileSync(f), contentType: 'application/javascript' }); return u.startsWith('file:') ? route.continue() : route.abort(); });
  fs.writeFileSync('page.html', '<!doctype html><html><head><meta charset="utf-8"></head><body>' + fs.readFileSync('flows.html', 'utf8') + '</body></html>');
  const base = 'file://' + process.cwd() + '/page.html';
  const out = {};
  // a link straight to a flow in another system
  await page.goto(base + '#open-payments--refund');
  await page.waitForTimeout(400);
  out.deep = { sys: await page.$eval('#sys-pick', (s) => s.selectedOptions[0].textContent), flow: await page.textContent('#left [aria-current="true"] .t'), hash: await page.evaluate(() => location.hash) };
  // the link under "Sub-flow to start"
  await page.goto(base);
  await page.waitForTimeout(400);
  out.hashAtStart = await page.evaluate(() => location.hash);
  await page.click('#left [data-act="pick-step"][data-v="3"]');
  out.linkText = await page.textContent('#right a.sublink');
  await page.click('#right a.sublink');
  await page.waitForTimeout(200);
  out.afterLink = { sys: await page.$eval('#sys-pick', (s) => s.selectedOptions[0].textContent), flow: await page.textContent('#left [aria-current="true"] .t'), hash: await page.evaluate(() => location.hash) };
  await page.goBack();
  await page.waitForTimeout(200);
  out.afterBack = { sys: await page.$eval('#sys-pick', (s) => s.selectedOptions[0].textContent), hash: await page.evaluate(() => location.hash) };
  // centre label of an included system
  out.ringLinks = await page.$$eval('#orbit a.ring-link', (as) => as.map((a) => a.getAttribute('href')));
  await page.click('#orbit a.ring-link >> nth=1');
  await page.waitForTimeout(200);
  out.afterRing = await page.$eval('#sys-pick', (s) => s.selectedOptions[0].textContent);
  await page.goto(base + '#open-nowhere');
  await page.waitForTimeout(400);
  out.unknown = await page.textContent('#toast');
  out.errors = errors;
  console.log(JSON.stringify(out, null, 1));
  await browser.close();
})();
