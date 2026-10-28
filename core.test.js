// Self-contained tests for core.js. Each test builds its own inputs; no shared state.
'use strict';
const assert = require('node:assert/strict');
const { test } = require('node:test');
const C = require('./core.js');

const roundTrip = (m) => C.parse(C.serialize(m));
const lib = () => new Map(C.sampleLibrary().map((m) => [m.system.slug, m]));
const at = (items, k) => {
  const it = items.find((i) => i.key === k);
  if (!it) throw new Error('no item ' + k);
  return it;
};

/* ---------- round-trip ---------- */

test('every sample system survives serialize → parse unchanged', () => {
  C.sampleLibrary().forEach((m) => assert.deepEqual(roundTrip(m), m));
});

test('serialize is stable (canonical writer)', () => {
  const md = C.serialize(C.sampleModel());
  assert.equal(C.serialize(C.parse(md)), md);
});

test('empty model round-trips and omits includes', () => {
  const m = C.emptyModel();
  assert.deepEqual(roundTrip(m), m);
  assert.ok(!C.serialize(m).includes('includes'));
});

test('awkward text round-trips: semicolons, hashes, backticks, colons', () => {
  let m = C.sampleModel();
  m = C.updateStep(m, 'checkout', 1, { label: 'Pay; then #ship: now', description: 'Code:\n```js\nx()\n```\nend' });
  m = C.updateParticipant(m, 'shopper', { title: 'Shopper: #1; VIP' }).model;
  assert.deepEqual(roundTrip(m), m);
});

test('older files without result or includes still read', () => {
  const md = C.serialize(C.sampleModel()).replace(/^result: .*\n/gm, '');
  assert.ok(C.parse(md).flows[0].steps.every((s) => s.result === null));
});

/* ---------- participants & slugs ---------- */

test('slug follows title until set by hand', () => {
  const r1 = C.updateParticipant(C.sampleModel(), 'order-service', { title: 'Order Management Service API' });
  assert.equal(r1.slug, 'order-management-service');
  assert.ok(r1.model.flows[0].steps.every((s) => s.from !== 'order-service' && s.to !== 'order-service'));
  const r2 = C.updateParticipant(r1.model, r1.slug, { slug: 'oms' });
  assert.equal(C.updateParticipant(r2.model, 'oms', { title: 'Something else' }).slug, 'oms');
});

test('duplicate titles get -2 suffix and keep following', () => {
  const m = C.addParticipant(C.emptyModel(), 'service', 'Worker').model;
  const r = C.addParticipant(m, 'service', 'Worker');
  assert.equal(r.slug, 'worker-2');
  assert.ok(C.slugFollows('worker-2', 'Worker'));
});

test('swap keeps every participant, changes slots', () => {
  const m = C.swapParticipants(C.sampleModel(), 'inventory', 'web-app');
  assert.deepEqual(m.system.participants.map((p) => p.slug), ['shopper', 'inventory', 'order-service', 'web-app']);
});

test('removeParticipant removes its steps', () => {
  const m = C.removeParticipant(C.sampleModel(), 'inventory');
  assert.equal(m.flows[0].steps.length, 5);
  assert.deepEqual(roundTrip(m), m);
});

/* ---------- steps, chains, timeline ---------- */

test('fork: chain B after step 2 plays alongside step 3', () => {
  const tl = C.timeline(C.sampleModel().flows[0]);
  assert.equal(tl.slot.get(3), tl.slot.get(5));
  assert.deepEqual(tl.order, [1, 2, 3, 5, 4, 6, 7, 8]);
  assert.equal(tl.length, 5);
});

test('self-message: from === to round-trips and loops toward the centre', () => {
  const m = C.sampleModel();
  const s6 = C.findStep(m.flows[0], 6);
  assert.equal(s6.from, s6.to);
  const L = C.ringLayout(4, 640);
  const loop = C.selfLoop(L.pos[3], L.nr, L.R, 0.35);
  const dCentre = (q) => Math.hypot(q.x - L.c, q.y - L.c);
  assert.ok(loop.pts.length > 6);
  assert.ok(dCentre(loop.apex) < dCentre(L.pos[3]));
});

test('removeStep renumbers and reconnects followers', () => {
  const m = C.removeStep(C.sampleModel(), 'checkout', 5);
  const f = m.flows[0];
  assert.deepEqual(f.steps.map((s) => s.n), [1, 2, 3, 4, 5, 6, 7]);
  assert.equal(C.findStep(f, 5).label, 'Check reorder level');
  assert.equal(C.findStep(f, 5).after, 2);
  assert.deepEqual(roundTrip(m), m);
});

test('renaming a flow updates local triggers that point at it', () => {
  let m = C.addFlow(C.sampleModel(), 'Retry').model;
  m = C.updateStep(m, 'checkout', 5, { triggers: 'retry' });
  const r = C.renameFlow(m, 'retry', 'Retry payment');
  assert.equal(r.slug, 'retry-payment');
  assert.equal(C.findStep(r.model.flows[0], 5).triggers, 'retry-payment');
});

test('addStep numbers after the highest step', () => {
  assert.equal(C.addStep(C.sampleModel(), 'checkout', { from: 'web-app', to: 'shopper', chain: 'A', after: 4 }).n, 9);
});

test('mermaid line without a step block continues chain A', () => {
  const md = C.serialize(C.sampleModel()).replace('  par chain A', '  web_app->>shopper: 9 · Show receipt\n  par chain A');
  const s9 = C.findStep(C.parse(md).flows[0], 9);
  assert.equal(s9.chain, 'A');
  assert.equal(s9.after, 8);
});

test('parse errors carry line numbers', () => {
  const md = C.serialize(C.sampleModel());
  const bad = md.replace('shopper->>web_app: 1 · Place order', 'shopper->>nobody: 1 · Place order');
  const line = bad.split('\n').findIndex((l) => l.includes('nobody')) + 1;
  assert.throws(() => C.parse(bad), (e) => e instanceof C.FlowParseError && e.line === line);
  assert.throws(() => C.parse(md.replace('```step', '```state')), /not supported yet/);
  assert.throws(() => C.parse(md.replace('web_app: 1 · Place order', 'web_app: Place order')), /step number/);
  assert.throws(() => C.parse(md.replace('chain: B', 'chain: B\nbogus: 1')), /unknown key "bogus"/);
  assert.throws(() => C.parse('hello'), C.FlowParseError);
});

/* ---------- galaxy ---------- */

test('cross-system refs use system__slug ids in Mermaid', () => {
  const mm = C.mermaidFor(C.sampleModel(), C.sampleModel().flows[0]);
  assert.match(mm, /order_service->>payments__gateway_api: 3 · Authorise payment/);
  assert.match(mm, /participant payments__gateway_api as payments\.gateway-api/);
});

test('galaxyProblems finds refs the other file no longer has; renames fix them', () => {
  const l = lib();
  assert.deepEqual(C.galaxyProblems(C.sampleModel(), l), []);
  l.set('payments', C.updateParticipant(l.get('payments'), 'gateway-api', { title: 'Payments API' }).model);
  assert.equal(C.galaxyProblems(C.sampleModel(), l).length, 1);
  const fixed = C.renameExternalParticipant(C.sampleModel(), 'payments', 'gateway-api', 'payments-api');
  assert.deepEqual(C.galaxyProblems(fixed, l), []);
});

test('renaming an included system rewrites includes, refs and triggers', () => {
  const m = C.renameSystemRefs(C.sampleModel(), 'payments', 'billing');
  assert.deepEqual(m.system.includes, ['billing', 'fulfilment']);
  assert.equal(C.findStep(m.flows[0], 3).to, 'billing.gateway-api');
  assert.equal(C.findStep(m.flows[0], 3).triggers, 'billing/authorise-payment');
  assert.deepEqual(roundTrip(m), m);
});

test('removing an include removes its cross-system steps and renumbers', () => {
  const m = C.removeInclude(C.sampleModel(), 'payments');
  assert.equal(m.flows[0].steps.length, 7);
  assert.ok(m.flows[0].steps.every((s) => !s.from.startsWith('payments.') && !s.to.startsWith('payments.')));
  assert.deepEqual(roundTrip(m), m);
});

test('include rules: not itself, not twice, both ends not in one other system', () => {
  assert.throws(() => C.includeSystem(C.sampleModel(), 'storefront'), C.UserError);
  assert.throws(() => C.includeSystem(C.sampleModel(), 'payments'), C.UserError);
  assert.throws(() => C.addStep(C.sampleModel(), 'checkout', { from: 'payments.ledger', to: 'payments.gateway-api', chain: 'A', after: 1 }), C.UserError);
  const md = C.serialize(C.sampleModel()).replace('includes:\n  - payments\n  - fulfilment', 'includes:\n  - fulfilment');
  assert.throws(() => C.parse(md), /included system/);
});

/* ---------- sub-flows: synchronous results and asynchronous calls ---------- */

test('a sub-flow with a result is synchronous: the result returns to the caller and what follows waits', () => {
  const { items, length, problems } = C.playScript(C.sampleModel(), lib(), 'checkout', true);
  assert.deepEqual(problems, []);
  assert.deepEqual(items.filter((i) => i.parent === '3' && !i.ret).map((i) => i.key), ['3.1', '3.2', '3.3', '3.4', '3.5', '3.6']);
  const ret = at(items, '3.r');
  assert.equal(ret.ret, true);
  assert.equal(ret.from, 'payments.gateway-api');
  assert.equal(ret.to, 'storefront.order-service', 'goes back to the caller');
  assert.equal(ret.label, '↩ payment-result');
  assert.equal(ret.start, at(items, '3.6').start + 1, 'returns once the result step is done');
  assert.equal(at(items, '4').start, ret.start + 1, 'the caller waits for the result');
  assert.equal(at(items, '3.5').start, at(items, '3.6').start, 'the async side step does not hold up the result');
  assert.equal(at(items, '5').start, at(items, '3').start, 'chain B still runs alongside step 3');
  assert.equal(length, Math.max(...items.map((i) => i.start + 1)));
});

test('an async step: the caller carries on while the sub-flow plays', () => {
  let m = C.sampleModel();
  m = C.addStep(m, 'checkout', { from: 'order-service', to: 'shopper', chain: 'A', after: 8 }).model;
  const { items } = C.playScript(m, lib(), 'checkout', true);
  assert.equal(at(items, '9').start, at(items, '8').start + 1, 'step 9 does not wait for dispatch');
  assert.equal(at(items, '8.1').start, at(items, '8').start + 1);
  assert.ok(at(items, '8.4').start > at(items, '9').start, 'dispatch plays on after the caller moved on');
  assert.ok(!items.some((i) => i.key === '8.r'));
});

test('a sync step with a result-less sub-flow waits for its last step', () => {
  let m = C.sampleModel();
  m = C.updateStep(m, 'checkout', 8, { async: false });
  m = C.addStep(m, 'checkout', { from: 'order-service', to: 'shopper', chain: 'A', after: 8 }).model;
  const { items } = C.playScript(m, lib(), 'checkout', true);
  const lastSub = Math.max(...items.filter((i) => i.key.startsWith('8.')).map((i) => i.start));
  assert.equal(at(items, '9').start, lastSub + 1);
});

test('an async step with a result: the reply still plays, but what follows does not wait', () => {
  let m = C.sampleModel();
  m = C.updateStep(m, 'checkout', 3, { async: true });
  const { items } = C.playScript(m, lib(), 'checkout', true);
  assert.equal(at(items, '4').start, at(items, '3').start + 1);
  assert.ok(at(items, '3.r').start > at(items, '4').start);
  assert.equal(at(items, '3').async, true);
});

test('async round-trips as Mermaid "-)"; "--)" also reads as async', () => {
  const m = C.updateStep(C.sampleModel(), 'checkout', 2, { async: true });
  const md = C.serialize(m);
  assert.match(md, /-\)[a-z_]+: 2 · /);
  assert.deepEqual(C.parse(md), m);
  assert.equal(C.findStep(C.parse(md.replace(/-\)([a-z_]+: 2 · )/, '--)$1')).flows[0], 2).async, true);
  assert.throws(() => C.updateStep(m, 'checkout', 2, { async: 'yes' }), /bug: async must be a boolean/);
});

test('collapsed: a synchronous call still shows its return, one beat later', () => {
  const { items, length } = C.playScript(C.sampleModel(), lib(), 'checkout', false);
  assert.equal(items.length, 9, '8 steps + the 3↩ return');
  assert.equal(at(items, '3.r').start, at(items, '3').start + 1);
  assert.equal(at(items, '4').start, at(items, '3.r').start + 1);
  assert.equal(length, 6);
});

test('any step can carry a result: the receiver replies and what follows waits', () => {
  let m = C.updateStep(C.sampleModel(), 'checkout', 2, { result: 'order-id' });
  assert.deepEqual(roundTrip(m), m);
  const { items } = C.playScript(m, lib(), 'checkout', true);
  const r = at(items, '2.r');
  assert.equal(r.from, 'storefront.order-service');
  assert.equal(r.to, 'storefront.web-app');
  assert.equal(r.label, '↩ order-id');
  assert.equal(r.start, at(items, '2').start + 1);
  assert.equal(at(items, '3').start, r.start + 1, 'step 3 waits for the reply');
  assert.equal(at(items, '5').start, r.start + 1, 'so does the fork from step 2');
});

test('the entry self-step result is the flow result for callers, and only callers see it', () => {
  const pay = lib().get('payments');
  assert.equal(C.flowResult(pay.flows[0]).n, 6);
  // played on its own there is nobody to reply to
  const own = C.playScript(pay, lib(), 'authorise-payment', true);
  assert.ok(!own.items.some((i) => i.ret));
  // a self-step elsewhere is not a flow result: the call becomes asynchronous
  let moved = C.updateStep(pay, 'authorise-payment', 6, { result: null });
  moved = C.addStep(moved, 'authorise-payment', { from: 'ledger', to: 'ledger', chain: 'B', after: 5 }).model;
  moved = C.updateStep(moved, 'authorise-payment', 7, { result: 'noted' });
  assert.equal(C.flowResult(moved.flows[0]), null);
  const l = lib(); l.set('payments', moved);
  assert.ok(!C.playScript(C.sampleModel(), l, 'checkout', true).items.some((i) => i.key === '3.r'));
});

test('the calling step can name the reply itself; otherwise it carries the flow result', () => {
  const m = C.updateStep(C.sampleModel(), 'checkout', 3, { result: 'auth-outcome' });
  const r = at(C.playScript(m, lib(), 'checkout', true).items, '3.r');
  assert.equal(r.label, '↩ auth-outcome');
  assert.equal(r.start, at(C.playScript(m, lib(), 'checkout', true).items, '3.6').start + 1, 'still waits for the flow result');
});

test('one flow result per flow: a second entry self-step result is refused', () => {
  let pay = lib().get('payments');
  pay = C.addStep(pay, 'authorise-payment', { from: 'gateway-api', to: 'gateway-api', chain: 'A', after: 6 }).model;
  assert.throws(() => C.updateStep(pay, 'authorise-payment', 7, { result: 'again' }), C.UserError);
  assert.doesNotThrow(() => C.updateStep(pay, 'authorise-payment', 4, { result: 'ack' }), 'ordinary replies are not limited');
  const md = C.serialize(lib().get('payments'));
  assert.deepEqual(C.parse(md), lib().get('payments'));
});

test('a flow that triggers itself is reported, not expanded forever', () => {
  const m = C.updateStep(C.sampleModel(), 'checkout', 4, { triggers: 'checkout' });
  assert.ok(C.playScript(m, lib(), 'checkout', true).problems.some((p) => /already running/.test(p)));
});

test('flowEntry is the first step\'s sender', () => {
  assert.equal(C.flowEntry(lib().get('payments').flows[0]), 'gateway-api');
  assert.equal(C.flowEntry({ steps: [] }), null);
});

/* ---------- schemas ---------- */
const pay = () => lib().get('payments');

test('types have a title and a kebab id; they round-trip in a ## Types block', () => {
  const md = C.serialize(C.sampleModel());
  assert.match(md, /## Types\n\n```schema\ncheckout-submitted:\n  title: Checkout submitted\n  summary: The basket the shopper confirmed\n  fields:\n    basketId: string\n    items: line-item\[\]/);
  C.sampleLibrary().forEach((m) => assert.deepEqual(roundTrip(m), m));
});

test('older PascalCase names are read as kebab ids everywhere', () => {
  const md = C.serialize(pay())
    .replace('payment-requested:\n  title: Payment requested\n', 'PaymentRequested:\n')
    .replace('amount: money', 'amount: Money')
    .replace('money:\n  title: Money\n', 'Money:\n')
    .replace('result: payment-result', 'result: PaymentResult');
  const m = C.parse(md);
  assert.equal(C.findSchema(m, 'payment-requested').title, 'Payment requested');
  assert.equal(C.findSchema(m, 'payment-requested').fields[1].type, 'money');
  assert.equal(C.findStep(m.flows[0], 6).result, 'payment-result');
  assert.deepEqual(m, pay());
  assert.equal(C.kebab('CheckoutSubmitted'), 'checkout-submitted');
  assert.equal(C.kebab('HTTPRequestSent'), 'http-request-sent');
  assert.equal(C.sentence('PaymentRequested'), 'Payment requested');
});

test('legacy message names used in steps but never defined still convert', () => {
  const md = C.serialize(C.sampleModel()).replace('message: order-confirmed', 'message: OrderConfirmed');
  assert.equal(C.findStep(C.parse(md).flows[0], 4).message, 'order-confirmed');
});

test('addSchema makes an id from the title; the id follows title edits until set by hand', () => {
  const r = C.addSchema(C.emptyModel(), 'Shipment notice');
  assert.equal(r.slug, 'shipment-notice');
  assert.equal(C.findSchema(r.model, 'shipment-notice').title, 'Shipment notice');
  assert.equal(C.followTypeSlug(r.model, 'shipment-notice', 'Shipment notice', 'Dispatch notice'), 'dispatch-notice');
  assert.equal(C.followTypeSlug(r.model, 'ship-note', 'Shipment notice', 'Dispatch notice'), 'ship-note');
  assert.equal(C.addSchema(r.model, 'Shipment notice').slug, 'shipment-notice-2');
  assert.equal(C.addSchema(C.emptyModel(), 'String').slug, 'string-2', 'never a built-in type');
});

test('schema rules: ids, titles, duplicates, field names and types', () => {
  const m = pay();
  const ok = { slug: 'money', title: 'Money', summary: '', fields: [{ name: 'value', type: 'string', repeated: false }] };
  assert.equal(C.schemaError(m, 'money', ok), null);
  assert.match(C.schemaError(m, 'money', { ...ok, slug: 'Money' }), /lower-case/);
  assert.match(C.schemaError(m, 'money', { ...ok, slug: 'payment-result' }), /already/);
  assert.match(C.schemaError(m, 'money', { ...ok, slug: 'text' }), /built-in/);
  assert.match(C.schemaError(m, 'money', { ...ok, title: ' ' }), /title/);
  assert.match(C.schemaError(m, 'money', { ...ok, fields: [ok.fields[0], ok.fields[0]] }), /Two fields/);
  assert.match(C.schemaError(m, 'money', { ...ok, fields: [{ name: '', type: 'string', repeated: false }] }), /empty/);
});

test('changing a type id follows into steps and other types\' fields', () => {
  let m = C.updateStep(pay(), 'authorise-payment', 1, { message: 'money' });
  const r = C.updateSchema(m, 'money', { ...C.findSchema(m, 'money'), slug: 'amount', title: 'Amount' });
  assert.equal(C.findSchema(r, 'payment-requested').fields.find((f) => f.name === 'amount').type, 'amount');
  assert.equal(C.findStep(r.flows[0], 1).message, 'amount');
  assert.deepEqual(C.schemaUsage(r, 'amount').fields, [{ schema: 'payment-requested', field: 'amount' }]);
  assert.deepEqual(roundTrip(r), r);
});

test('typeIndex sees included systems\' types; typeTitle falls back to the id', () => {
  const idx = C.typeIndex(C.sampleModel(), lib());
  assert.equal(idx.get('payment-requested').system, 'payments');
  assert.equal(idx.get('payment-requested').local, false);
  assert.equal(idx.get('line-item').local, true);
  assert.equal(C.typeTitle(idx, 'payment-result'), 'Payment result');
  assert.equal(C.typeTitle(idx, 'order-confirmed'), 'Order confirmed');
});

test('example data fills nested types and lists; fillData keeps existing values', () => {
  const idx = C.typeIndex(C.sampleModel(), lib());
  assert.deepEqual(C.exampleData(idx, 'payment-requested'), { orderId: '<orderId>', amount: { value: 0, currency: '<currency>' }, captureLater: false });
  assert.deepEqual(C.exampleData(idx, 'checkout-submitted').items, [{ sku: '<sku>', qty: '<qty>' }]);
  assert.deepEqual(C.fillData(idx, 'payment-requested', { orderId: 'ord_1', extra: 1 }), { orderId: 'ord_1', amount: { value: 0, currency: '<currency>' }, captureLater: false, extra: 1 });
});

test('a type that contains itself stops instead of looping', () => {
  let { model: m } = C.addSchema(C.emptyModel(), 'Node');
  m = C.updateSchema(m, 'node', { slug: 'node', title: 'Node', summary: '', fields: [{ name: 'next', type: 'node', repeated: false }] });
  assert.deepEqual(C.exampleData(C.typeIndex(m, new Map()), 'node'), { next: null });
});

test('checkData lists missing, unexpected and wrongly typed fields', () => {
  const idx = C.typeIndex(C.sampleModel(), lib());
  assert.deepEqual(C.checkData(idx, 'payment-requested', { orderId: 'x', amount: { value: '1', currency: 7 }, captureLater: true }), ['amount.value should be a number', 'amount.currency should be text']);
  assert.deepEqual(C.checkData(idx, 'payment-requested', { orderId: 'x', foo: 1 }), ['amount is missing', 'captureLater is missing', 'foo is not in Payment requested']);
  assert.deepEqual(C.checkData(idx, 'checkout-submitted', { basketId: 'b', items: {}, giftNote: '' }), ['items should be a list']);
  assert.deepEqual(C.checkData(idx, 'unknown', { a: 1 }), []);
  const s3 = C.findStep(C.sampleModel().flows[0], 3);
  assert.deepEqual(C.checkData(idx, s3.message, s3.data), []);
});

test('bad schema blocks report clearly', () => {
  const md = C.serialize(pay());
  assert.throws(() => C.parse(md.replace('currency: string', 'currency: number$')), /use string, text, number, boolean, date, object or a type id/);
  assert.throws(() => C.parse(md.replace('money:\n  title: Money', 'text:\n  title: Money')), /built-in/);
});

test('a step\'s result defaults to its sub-flow\'s result; a chosen one is kept', () => {
  assert.equal(C.resultAfterTrigger(null, null, 'payment-result'), 'payment-result', 'empty takes the flow result');
  assert.equal(C.resultAfterTrigger('payment-result', 'payment-result', 'refund-result'), 'refund-result', 'a default follows the new flow');
  assert.equal(C.resultAfterTrigger('payment-result', 'payment-result', null), null, 'and clears when the new flow returns nothing');
  assert.equal(C.resultAfterTrigger('auth-outcome', 'payment-result', 'refund-result'), 'auth-outcome', 'a chosen result is kept');
  assert.equal(C.resultAfterTrigger(null, null, null), null);
});

/* ---------- reordering ---------- */
const labels = (f, chain) => C.chainSequence(f, chain).map((s) => s.n + ' ' + s.label);

test('moving a step within its chain re-links it and its numbers follow the new order', () => {
  const r = C.moveStep(C.sampleModel(), 'checkout', 4, 2);
  const f = r.model.flows[0];
  assert.deepEqual(labels(f, 'A'), ['1 Place order', '2 Create order', '3 Order confirmed', '4 Authorise payment', '8 Ship order']);
  assert.equal(r.n, 3, 'the moved step\'s new number');
  assert.equal(C.findStep(f, 3).after, 2);
  assert.equal(C.findStep(f, 8).after, 4);
  assert.equal(C.findStep(f, 4).triggers, 'payments/authorise-payment', 'the step\'s details move with it');
  assert.deepEqual(labels(f, 'B'), ['5 Reserve stock', '6 Check reorder level', '7 Stock reserved'], 'other chains are untouched');
  assert.deepEqual(roundTrip(r.model), r.model);
});

test('a fork stays with its step; numbers are redone when play order needs it', () => {
  const r = C.moveStep(C.sampleModel(), 'checkout', 2, 4);
  const f = r.model.flows[0];
  assert.deepEqual(labels(f, 'A'), ['1 Place order', '2 Authorise payment', '3 Order confirmed', '4 Ship order', '5 Create order']);
  assert.deepEqual(labels(f, 'B'), ['6 Reserve stock', '7 Check reorder level', '8 Stock reserved']);
  assert.equal(C.findStep(f, 6).after, 5, 'chain B still forks from Create order');
  assert.equal(r.n, 5);
  assert.ok(f.steps.every((s) => s.after === null || s.after < s.n));
  assert.deepEqual(roundTrip(r.model), r.model);
});

test('moving to the same place changes nothing; a branching chain refuses to reorder', () => {
  const m = C.sampleModel();
  assert.equal(C.moveStep(m, 'checkout', 3, 2).model, m);
  let odd = C.addStep(m, 'checkout', { from: 'web-app', to: 'shopper', chain: 'A', after: 2 }).model;
  assert.throws(() => C.moveStep(odd, 'checkout', 1, 1), C.UserError);
});

test('systemReferences lists includers and what deleting would do to their steps', () => {
  const l = lib();
  const refs = C.systemReferences(l, 'payments');
  assert.deepEqual(refs.map((r) => r.system), ['storefront']);
  const s3 = refs[0].steps.find((x) => x.n === 3);
  assert.equal(s3.effect, 'removed');
  // Apply what deleteHome does and confirm the listed steps really go.
  const after = C.removeInclude(l.get('storefront'), 'payments');
  const before = l.get('storefront').flows.reduce((k, f) => k + f.steps.length, 0);
  const left = after.flows.reduce((k, f) => k + f.steps.length, 0);
  assert.equal(before - left, refs[0].steps.filter((x) => x.effect === 'removed').length);
  assert.deepEqual(C.systemReferences(l, 'storefront'), [], 'nothing includes the home system');
});

test('number, date and object are built-in types: examples, checks and round-trip', () => {
  let m = C.sampleModel();
  m = C.defineSchema(m, { slug: 'audit-entry', title: 'Audit entry', summary: '', fields: [
    { name: 'total', type: 'number', repeated: false },
    { name: 'at', type: 'date', repeated: false },
    { name: 'meta', type: 'object', repeated: false },
    { name: 'scores', type: 'number', repeated: true },
  ] });
  const idx = C.typeIndex(m, new Map());
  const ex = C.exampleData(idx, 'audit-entry');
  assert.deepEqual(ex, { total: 0, at: '2026-01-15', meta: {}, scores: [0] });
  assert.deepEqual(C.checkData(idx, 'audit-entry', ex), []);
  assert.deepEqual(C.checkData(idx, 'audit-entry', { total: '3', at: '15/01/2026', meta: [], scores: [1, Infinity] }),
    ['total should be a number', 'at should be a date like 2026-01-15', 'meta should be a mapping of field: value', 'scores[1] should be a number']);
  ['2026-01-15', '2026-01-15T09:30Z', '2026-01-15T09:30:00.250+01:00'].forEach((d) => assert.deepEqual(C.checkData(idx, 'audit-entry', { ...ex, at: d }), [], d));
  m = C.updateStep(m, 'checkout', 1, { message: 'audit-entry', data: { total: 59.98, at: '2026-01-15T09:30:00Z', meta: { source: 'web' }, scores: [1, 2.5] } });
  assert.deepEqual(roundTrip(m), m, 'dates stay strings, numbers stay numbers');
  assert.equal(C.schemaError(m, null, { slug: 'date', title: 'Date', summary: '', fields: [] }), '"date" is a built-in type; pick another id.');
});

test('lineLayout puts participants in one centred row below the middle, labels down', () => {
  const L = C.lineLayout(3, 480, 130);
  assert.deepEqual(L.pos.map((p) => p.x), [L.c - 130, L.c, L.c + 130]);
  assert.ok(L.pos.every((p) => p.y === L.pos[0].y && p.y > L.c && p.th === Math.PI / 2));
  assert.equal(C.lineLayout(1, 320, 130).pos[0].x, 160);
});

test('namedFields drops rows with no name yet, so they never block or reach the file', () => {
  const draft = { slug: 'thing', title: 'Thing', summary: '', fields: [{ name: 'a', type: 'string', repeated: false }, { name: '  ', type: 'number', repeated: false }, { name: ' b ', type: 'date', repeated: true }] };
  const clean = C.namedFields(draft);
  assert.deepEqual(clean.fields.map((f) => f.name), ['a', 'b']);
  assert.equal(draft.fields.length, 3, 'the draft itself is untouched');
  assert.equal(C.schemaError(C.emptyModel(), null, draft) !== null, true, 'raw draft with a blank is an error');
  assert.equal(C.schemaError(C.emptyModel(), null, clean), null);
  assert.deepEqual(roundTrip(C.defineSchema(C.emptyModel(), clean)), C.defineSchema(C.emptyModel(), clean));
});

test('device kinds (phone, laptop, tablet) add with their own title and colour, and round-trip', () => {
  let m = C.emptyModel();
  ['phone', 'laptop', 'tablet', 'phone'].forEach((k) => { m = C.addParticipant(m, k).model; });
  assert.deepEqual(m.system.participants.map((p) => [p.slug, p.kind]), [['phone', 'phone'], ['laptop', 'laptop'], ['tablet', 'tablet'], ['phone-2', 'phone']]);
  assert.equal(m.system.participants[0].fill, C.KIND_FILLS.phone);
  assert.deepEqual(roundTrip(m), m);
});
