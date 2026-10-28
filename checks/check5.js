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
  await page.goto('file://' + process.cwd() + '/page.html');
  await page.waitForTimeout(300);
  await page.click('#left [data-act="pick-step"][data-v="1"]');
  const firstPrevDisabled = await page.isDisabled('#right [data-act="step-nav"] >> nth=0');
  const seen = [];
  for (let k = 0; k < 8; k++) { seen.push(await page.textContent('#right .nb')); if (await page.isEnabled('#right [data-act="step-nav"] >> nth=1')) await page.click('#right [data-act="step-nav"] >> nth=1'); }
  const lastNextDisabled = await page.isDisabled('#right [data-act="step-nav"] >> nth=1');
  await page.click('#right [data-act="step-nav"] >> nth=0');
  const back = await page.textContent('#right .nb');
  await page.screenshot({ path: 'shots/n1-nav.png', clip: { x: 1040, y: 120, width: 400, height: 120 } });
  console.log(JSON.stringify({ firstPrevDisabled, seen, lastNextDisabled, back, errors }));
  await browser.close();
})();
