const { chromium } = require('playwright');
const fs = require('fs');
const libs = {
  'js-yaml': 'node_modules/js-yaml/dist/js-yaml.min.js',
  'marked': 'node_modules/marked/marked.min.js',
  'dompurify': 'node_modules/dompurify/dist/purify.min.js'
};
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/fonts\.g/.test(m.text())) errors.push('console: ' + m.text()); });
  await page.route('**/*', (route) => {
    const u = route.request().url();
    for (const [k, f] of Object.entries(libs)) if (u.includes('cdnjs') && u.includes(k)) return route.fulfill({ body: fs.readFileSync(f), contentType: 'application/javascript' });
    if (u.startsWith('file:')) return route.continue();
    return route.abort();
  });
  const html = '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body>' + fs.readFileSync('flows.html', 'utf8') + '</body></html>';
  fs.writeFileSync('page.html', html);
  await page.goto('file://' + process.cwd() + '/page.html');
  await page.waitForTimeout(400);
  await page.screenshot({ path: 'shots/1-flow.png', fullPage: true });
  // flow mode: click web-app, then shopper (adds step 9), then the self-message on shopper
  const node = (slug) => page.locator('[data-node="' + slug + '"] circle.hitc');
  const at = async (loc) => { const b = await loc.boundingBox(); await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2); await page.waitForTimeout(60); };
  await at(node('web-app')); await at(node('shopper')); await at(node('shopper'));
  const s9 = await page.locator('[data-badge]').count();
  await at(page.locator('[data-badge="2"]')); await at(node('payment-gateway'));
  const steps = await page.locator('#left [data-act="pick-step"]').count();
  await page.fill('#st-label', 'Notify fraud team');
  await page.keyboard.press('Escape');
  await page.screenshot({ path: 'shots/2-flow-added.png', fullPage: true });
  // system mode: drag inventory onto payment-gateway, add a participant
  await page.click('[data-act="mode"][data-v="system"]');
  const a = await node('inventory').boundingBox(), b = await node('payment-gateway').boundingBox();
  await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2); await page.mouse.down();
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 8 }); await page.mouse.up();
  await page.click('[data-act="add-part"][data-v="queue"]');
  await page.fill('#pt-title', 'Event Bus Main');
  await page.screenshot({ path: 'shots/3-system.png', fullPage: true });
  // play
  await page.click('[data-act="mode"][data-v="play"]');
  await page.click('[data-act="pick-flow"][data-v="checkout"]');
  await page.click('[data-act="jump"][data-v="3"] >> nth=0');
  await page.screenshot({ path: 'shots/4-play-orbit.png', fullPage: true });
  await page.click('[data-act="view"][data-v="sequence"]');
  await page.screenshot({ path: 'shots/5-play-seq.png', fullPage: true });
  await page.click('[data-act="view"][data-v="slides"]');
  await page.keyboard.press('ArrowRight');
  await page.screenshot({ path: 'shots/6-slides.png', fullPage: true });
  // markdown: open, break it, fix it
  await page.click('[data-act="md"]');
  const md = await page.inputValue('#md-text');
  await page.fill('#md-text', md.replace('# Storefront', '# Storefront').replace('chain: A', 'chain: 7'));
  await page.waitForTimeout(500);
  const msg1 = await page.textContent('#md-msg');
  await page.fill('#md-text', md.replace('Place order', 'Place an order'));
  await page.waitForTimeout(500);
  const msg2 = await page.textContent('#md-msg');
  await page.screenshot({ path: 'shots/7-markdown.png', fullPage: false });
  // phone width
  await page.setViewportSize({ width: 400, height: 900 });
  await page.click('#drawer [data-act="md"]');
  await page.click('[data-act="mode"][data-v="flow"]');
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  await page.screenshot({ path: 'shots/8-phone.png', fullPage: false });
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.screenshot({ path: 'shots/9-dark.png', fullPage: false });
  console.log(JSON.stringify({ errors, s9, steps, msg1, msg2, overflow }, null, 1));
  await browser.close();
})();
