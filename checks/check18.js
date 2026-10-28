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
  const out = {};
  await page.click('[data-act="mode"][data-v="system"]');
  out.palette = await page.$$eval('[data-act="add-part"]', (b) => b.map((x) => x.textContent));
  for (const k of ['phone', 'laptop', 'tablet']) { await page.click('[data-act="add-part"][data-v="' + k + '"]'); await page.keyboard.press('Escape'); }
  out.nodes = await page.$$eval('#stage [data-node]', (n) => n.map((x) => x.getAttribute('data-node')));
  await page.screenshot({ path: 'shots/q8-devices.png' });
  out.errors = errors;
  console.log(JSON.stringify(out));
  await browser.close();
})();
