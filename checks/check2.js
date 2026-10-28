const { chromium } = require('playwright');
const fs = require('fs');
const libs = { 'js-yaml': 'node_modules/js-yaml/dist/js-yaml.min.js', 'marked': 'node_modules/marked/marked.min.js', 'dompurify': 'node_modules/dompurify/dist/purify.min.js' };
const legacy = JSON.parse(fs.readFileSync('dbcopy/systems/current.json', 'utf8'));
const legacyData = legacy.data || legacy;
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
  // In-memory stand-in for the artifact db, seeded with a copy of the real legacy document.
  await page.addInitScript((seed) => {
    const store = new Map([['systems/current', seed]]);
    window.__store = store;
    const snap = (id, v) => ({ id, exists: v !== undefined, data: () => v });
    const db = {
      doc: (p) => ({ get: async () => snap(p.split('/').pop(), store.get(p)), set: async (v) => { store.set(p, JSON.parse(JSON.stringify(v))); }, delete: async () => { store.delete(p); } }),
      collection: (c) => ({ get: async () => ({ docs: [...store.entries()].filter(([k]) => k.startsWith(c + '/') && k.split('/').length === 2).map(([k, v]) => snap(k.split('/')[1], v)) }) })
    };
    window.claude = { use: async (n) => (n === 'db' ? db : n === 'user' ? { canEdit: async () => true } : null) };
  }, legacyData);
  const html = '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body>' + fs.readFileSync('flows.html', 'utf8') + '</body></html>';
  fs.writeFileSync('page.html', html);
  await page.goto('file://' + process.cwd() + '/page.html');
  await page.waitForTimeout(600);
  const keys1 = await page.evaluate(() => [...window.__store.keys()]);
  const picker1 = await page.$$eval('#sys-pick option', (os) => os.map((o) => o.textContent));
  await page.screenshot({ path: 'shots/g0-migrated.png' });
  // Galaxy mode: add examples, include both
  await page.click('[data-act="mode"][data-v="galaxy"]');
  await page.click('[data-act="add-examples"]');
  await page.click('[data-act="include"][data-v="payments"]');
  await page.click('[data-act="include"][data-v="fulfilment"]');
  await page.waitForTimeout(900);
  await page.screenshot({ path: 'shots/g1-galaxy.png' });
  const shaded = await page.$$eval('#orbit g.shaded', (xs) => xs.length);
  // drag payments ring onto fulfilment's slot
  const ring = (s) => page.locator('[data-ring="' + s + '"]');
  const a = await ring('payments').boundingBox(), b = await ring('fulfilment').boundingBox();
  await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2); await page.mouse.down();
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 10 }); await page.mouse.up();
  await page.waitForTimeout(100);
  const order = await page.$$eval('[data-act="pick-ring"]', (bs) => bs.map((x) => x.getAttribute('data-v')));
  // Flow mode: cross-system step from order-service to payments.gateway-api, then trigger
  await page.click('[data-act="mode"][data-v="flow"]');
  const at = async (sel) => { const bb = await page.locator(sel).first().boundingBox(); await page.mouse.click(bb.x + bb.width / 2, bb.y + bb.height / 2); await page.waitForTimeout(80); };
  await at('[data-node="payment-system.order-service"] circle.hitc');
  await at('[data-node="payments.gateway-api"] circle.hitc');
  await page.selectOption('#st-trig', 'payments/authorise-payment');
  await page.fill('#st-label', 'Take payment');
  await at('[data-node="payments.ledger"] circle.hitc'); // pending continues from gateway-api → ledger: both in payments → refused
  const toast = await page.textContent('#toast');
  await page.keyboard.press('Escape');
  await page.screenshot({ path: 'shots/g2-flow.png' });
  await page.click('#left [data-act="pick-step"][data-v="2"]');
  const resultEnabled = await page.isEnabled('#tp-result');
  await page.click('#tp-result'); await page.keyboard.type('OrderId'); await page.keyboard.press('Enter');
  await page.keyboard.press('Escape');
  const resultHint = await page.evaluate(() => document.getElementById('tp-result').closest('.f').nextElementSibling.textContent);
  // Play expanded, then collapsed
  await page.click('[data-act="mode"][data-v="play"]');
  const keys = await page.$$eval('#left [data-act="jump"]', (bs) => bs.map((x) => x.getAttribute('data-v')));
  await page.click('#left [data-act="jump"][data-v="12.3"]');
  await page.screenshot({ path: 'shots/g3-play.png' });
  const retBadge = await page.$$eval('#orbit .badge-tx', (xs) => xs.map((x) => x.textContent).filter((t) => t.includes('↩')));
  const hint = await page.evaluate(() => document.body.innerText.includes('Synchronous'));
  await page.check('#play-collapse');
  await page.screenshot({ path: 'shots/g4-collapsed.png' });
  await page.uncheck('#play-collapse');
  await page.click('[data-act="view"][data-v="sequence"]');
  await page.screenshot({ path: 'shots/g5-seq.png', fullPage: true });
  await page.click('[data-act="view"][data-v="slides"]');
  await page.screenshot({ path: 'shots/g6-slides.png' });
  // Rename payments' participant from inside payments → payment-system follows
  await page.selectOption('#sys-pick', 'payments');
  await page.click('[data-act="mode"][data-v="system"]');
  await at('[data-node="payments.gateway-api"] circle.hitc');
  await page.fill('#pt-title', 'Payments API');
  await page.waitForTimeout(1200);
  const md = await page.evaluate(() => window.__store.get('systems/payment-system').markdown);
  const followed = md.includes('payments__payments_api') && !md.includes('payments__gateway_api');
  await page.selectOption('#sys-pick', 'payment-system');
  await page.click('[data-act="mode"][data-v="galaxy"]');
  const probs = await page.$$eval('#left .err', (xs) => xs.map((x) => x.textContent));
  const keys2 = await page.evaluate(() => [...window.__store.keys()]);
  const converted = await page.evaluate(() => { const m = window.__store.get('systems/payment-system').markdown; return m.includes('message: checkout-submitted') && !m.includes('CheckoutSubmitted'); });
  console.log(JSON.stringify({ converted, resultEnabled, resultHint, reply2: keys.includes('2.r'), shaded, retBadge, errors, keys1, picker1, order, toast, playKeys: keys.slice(0, 20), followed, probs, keys2 }, null, 1));
  await browser.close();
})();
