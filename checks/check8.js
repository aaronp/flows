const { chromium } = require('playwright');
const fs = require('fs');
const libs = { 'js-yaml': 'node_modules/js-yaml/dist/js-yaml.min.js', 'marked': 'node_modules/marked/marked.min.js', 'dompurify': 'node_modules/dompurify/dist/purify.min.js' };
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.route('**/*', (route) => { const u = route.request().url(); for (const [k, f] of Object.entries(libs)) if (u.includes('cdnjs') && u.includes(k)) return route.fulfill({ body: fs.readFileSync(f), contentType: 'application/javascript' }); return u.startsWith('file:') ? route.continue() : route.abort(); });
  fs.writeFileSync('page.html', '<!doctype html><html><head><meta charset="utf-8"></head><body>' + fs.readFileSync('flows.html', 'utf8') + '</body></html>');
  await page.goto('file://' + process.cwd() + '/page.html');
  await page.waitForTimeout(300);
  const order = () => page.$$eval('#left li[data-chain="A"] .t', (xs) => xs.map((x) => x.textContent));
  const out = { start: await order() };
  // drag "Order confirmed" (4) onto the top half of "Authorise payment" (3)
  await page.dragAndDrop('#left li[data-drag-n="4"]', '#left li[data-drag-n="3"]', { targetPosition: { x: 40, y: 4 } });
  out.afterDrag = await order();
  out.selected = await page.textContent('#right .nb');
  // keyboard: move it back down
  await page.focus('#left [data-act="pick-step"][data-v="3"]');
  await page.keyboard.press('Alt+ArrowDown');
  out.afterKey = await order();
  out.focused = await page.evaluate(() => document.activeElement.getAttribute('data-v'));
  // cross-chain drop does nothing
  await page.dragAndDrop('#left li[data-drag-n="5"]', '#left li[data-drag-n="2"]');
  out.afterCross = await order();
  await page.click('[data-act="md"]');
  out.mermaidHasNew = (await page.inputValue('#md-text')).includes('order_service->>payments__gateway_api: 3 · Authorise payment');
  out.errors = errors;
  console.log(JSON.stringify(out, null, 1));
  await browser.close();
})();
