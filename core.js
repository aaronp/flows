/* Flows core — pure model operations, timeline maths and the .flow.md round-trip.
 * No DOM, no clock, no unseeded randomness: every function returns the same
 * output for the same input. The UI shell does all IO. */
'use strict';
const YAML = typeof jsyaml !== 'undefined' ? jsyaml : require('js-yaml');

/* ---------------------------------------------------------------------------
 * Data model (documented here because the page has no schema library).
 *
 * Model
 *   system  System    The system this file describes.
 *   schemas Schema[]  Message and result types defined in this file, in file order.
 *                     Steps of this system and of systems that include it can use them.
 *   flows   Flow[]    Named sequences of steps through the system, in file order.
 *
 * Schema (a message or result type)
 *   slug     string   Kebab-case id, unique in the file, e.g. "payment-requested". Steps
 *                     (message, result) and fields refer to it. Follows `title` like
 *                     participant slugs. Never a built-in type name (see BASE_TYPES).
 *   title    string   Display name, e.g. "Payment requested".
 *   summary  string   One line on what the type is for; "" when not given.
 *   fields   Field[]  In order. Field: { name, type, repeated }
 *            name     identifier, e.g. "orderId"
 *            type     a built-in type or another type's slug. Built in (BASE_TYPES):
 *                     "string"  one line of text, e.g. "ord_1042"
 *                     "text"    multi-line text, e.g. a gift note
 *                     "number"  any finite number, integer or decimal, e.g. 59.98
 *                     "boolean" true or false
 *                     "date"    an ISO 8601 date or date-time string, e.g. "2026-01-15"
 *                               or "2026-01-15T09:30:00Z"; JSON has no date, so it travels as text
 *                     "object"  any mapping whose shape this file doesn't pin down, e.g.
 *                               metadata passed through untouched; use a defined type when it does
 *            repeated true = a list of that type (written "line-item[]")
 * Older files used PascalCase type names (PaymentRequested); they are read as
 * payment-requested titled "Payment requested", wherever they appear.
 *
 * System
 *   slug         string   Stable id, kebab-case. Follows `label` while it still
 *                         equals the slug derived from it, e.g. "storefront".
 *   label        string   Text in the centre of the ring, e.g. "Storefront".
 *   fill         string   Ring colour as #rrggbb, e.g. "#dbe4ff".
 *   opacity      number   0–1. How strongly the ring colour is painted.
 *   selfReach    number   (0,1) exclusive. How far a self-message loop travels
 *                         toward the centre, as a fraction of the ring radius.
 *   participants Participant[]  Clockwise from 12 o'clock; index = ring slot,
 *                         so reordering the array is how participants move.
 *   includes     string[] Slugs of other saved systems in this system's galaxy,
 *                         clockwise from 12 o'clock around it (index = galaxy slot).
 *                         Live references: each stays its own saved file.
 *                         Optional in the file; written only when non-empty.
 *
 * Participant
 *   slug   string  Id used by steps and (with "-" → "_") by Mermaid,
 *                  e.g. "order-service". Follows `title` like System.slug.
 *   title  string  Name drawn on the ring, e.g. "Order Service".
 *   kind   Kind    One of KIND_NAMES. Only affects icon and default colour.
 *   fill   string  Node colour as #rrggbb.
 *   description string  Markdown notes. Optional in the file; written only when non-empty.
 *
 * Flow
 *   slug   string  Id used by `triggers`, e.g. "checkout". Follows `name`.
 *   name   string  Display name, e.g. "Checkout".
 *   steps  Step[]  Sorted by n.
 *
 * Step
 *   n           number       Step number, unique in the flow. Forked chains
 *                            carry on the main numbering. Order of play is
 *                            decided by `after`, not by n.
 *   from, to    Ref          Participant references. A bare slug ("order-service")
 *                            is in this system; "<system>.<slug>" ("payments.gateway-api")
 *                            is a participant of an included system. from === to is a
 *                            self-message: the participant is sender and receiver.
 *   label       string       Message label, e.g. "Place order".
 *   chain       string       "A".."Z". A = main chain; each fork gets the next letter.
 *   after       number|null  The step this one follows. null = starts the flow.
 *                            A fork is a step whose `after` is a step in another chain.
 *   message     string|null  Message type name, e.g. "PaymentRequested".
 *   tags        string[]     Free-text tags, unique, e.g. ["async", "pci"].
 *   triggers    string|null  Flow slug this step starts, e.g. "authorise-payment",
 *                            or "<system>/<flow>" for another system (phase 2).
 *   data        object       Example payload, any JSON-compatible mapping.
 *   description string       Markdown, shown in the editor and on slides.
 *   result      string|null  The receiver's reply, e.g. "PaymentResult": a request/response.
 *                            On an ordinary step it plays as a reply from `to` back to `from`
 *                            (n↩) and the steps after it wait for it. On a self-step of the
 *                            flow's entry participant (where the flow starts) it is the flow's
 *                            result: when another step triggers this flow, it goes back to that
 *                            caller, which waits for it (synchronous). One such per flow. A
 *                            triggered flow without one ends when its last step does.
 *   async       boolean      Whether the sender carries on without waiting for this step's task.
 *                            Why: a web-service call blocks its caller, a queued event does not.
 *                            false (sync, Mermaid "->>"): the steps after it wait until the
 *                            receiver's task is done — the triggered flow's last step and any
 *                            reply. true (async, Mermaid "-)"): the steps after it go on the next
 *                            beat, while the task (and any reply) plays alongside.
 *                            The sequence view draws the task as an activation box on the
 *                            receiver's lifeline, dashed when async. e.g. false.
 * ------------------------------------------------------------------------- */

// Devices (phone, laptop, tablet) are where a user's request starts or a notification lands.
const KIND_NAMES = ['user', 'phone', 'laptop', 'tablet', 'service', 'database', 'queue', 'external', 'fn', 'script', 'command', 'job', 'timer', 'system'];
const KIND_FILLS = {
  user: '#ffec99', phone: '#fcc2d7', laptop: '#dee2e6', tablet: '#99e9f2', service: '#a5d8ff', database: '#ffd8a8', queue: '#c3fae8',
  external: '#ffc9c9', fn: '#b2f2bb', script: '#fcc2d7', command: '#dee2e6', job: '#99e9f2', timer: '#eebefa', system: '#d0bfff'
};
const KIND_TITLES = {
  user: 'User', phone: 'Phone', laptop: 'Laptop', tablet: 'Tablet', service: 'Service', database: 'Database', queue: 'Queue',
  external: 'External API', fn: 'Function', script: 'Script', command: 'Command', job: 'Job', timer: 'Timer', system: 'Sub-system'
};
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const HEX_RE = /^#[0-9a-fA-F]{6}$/;
const CHAIN_RE = /^[A-Z]$/;
const REF_RE = /^([a-z0-9]+(?:-[a-z0-9]+)*)\.([a-z0-9]+(?:-[a-z0-9]+)*)$/;

/** "payments.gateway-api" → { system: "payments", slug: "gateway-api" }; "order-service" → { system: null, slug }. */
function parseRef(ref) {
  if (typeof ref !== 'string') throw new Error('bug: ref must be a string');
  if (!ref.includes('.')) return { system: null, slug: ref };
  const m = REF_RE.exec(ref);
  if (!m) throw new Error('bug: malformed ref "' + ref + '"');
  return { system: m[1], slug: m[2] };
}
const isExternal = (ref) => ref.includes('.');
/** Fully qualified ref, as seen from system `sys`. */
const absRef = (sys, ref) => (isExternal(ref) ? ref : sys + '.' + ref);

/** Input the person can fix (shown to them); everything else thrown is a bug. */
class UserError extends Error {}
/** A problem in a .flow.md file. `line` is 1-based. */
class FlowParseError extends Error {
  constructor(line, message) { super('Line ' + line + ': ' + message); this.line = line; this.detail = message; }
}

/* ---------- slugs ---------- */

/** First three words of `text`, kebab-case: "Order Service API v2" → "order-service-api". */
function slugify(text) {
  return String(text).toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ').trim().split(' ').filter(Boolean).slice(0, 3).join('-');
}
function uniqueSlug(base, taken) {
  if (!base) throw new UserError('Give it a name with at least one letter or digit.');
  if (!taken.has(base)) return base;
  for (let i = 2; i < 10000; i++) if (!taken.has(base + '-' + i)) return base + '-' + i;
  throw new Error('bug: could not find a free slug for ' + base);
}
/** True while `slug` is still the one derived from `text` (or its -2, -3 … variant). */
function slugFollows(slug, text) {
  const base = slugify(text);
  return base !== '' && (slug === base || (slug.startsWith(base + '-') && /^\d+$/.test(slug.slice(base.length + 1))));
}
function checkSlug(slug) {
  if (!SLUG_RE.test(slug)) throw new UserError('Slugs use lower-case letters, digits and single dashes, e.g. "order-service".');
  return slug;
}

/* ---------- small pure helpers ---------- */

const isPlainObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
function findFlow(model, slug) {
  const i = model.flows.findIndex((f) => f.slug === slug);
  if (i < 0) throw new Error('bug: no flow "' + slug + '"');
  return i;
}
function findStep(flow, n) {
  const s = flow.steps.find((x) => x.n === n);
  if (!s) throw new Error('bug: flow "' + flow.slug + '" has no step ' + n);
  return s;
}
function participantIndex(model, slug) {
  const i = model.system.participants.findIndex((p) => p.slug === slug);
  if (i < 0) throw new Error('bug: no participant "' + slug + '"');
  return i;
}
const replaceAt = (arr, i, v) => arr.map((x, k) => (k === i ? v : x));

/* ---------- system & participants ---------- */

function emptyModel() {
  return {
    system: { slug: 'my-system', label: 'My system', fill: '#e9ecef', opacity: 0.6, selfReach: 0.35, participants: [], includes: [] },
    schemas: [],
    flows: [{ slug: 'main', name: 'Main', steps: [] }]
  };
}

function updateSystem(model, patch) {
  const allowed = ['label', 'slug', 'fill', 'opacity', 'selfReach'];
  Object.keys(patch).forEach((k) => { if (!allowed.includes(k)) throw new Error('bug: updateSystem got "' + k + '"'); });
  const s = model.system;
  let slug = s.slug;
  if (patch.slug !== undefined) slug = checkSlug(patch.slug);
  else if (patch.label !== undefined && slugFollows(s.slug, s.label)) slug = slugify(patch.label) || s.slug;
  if (patch.fill !== undefined && !HEX_RE.test(patch.fill)) throw new Error('bug: fill must be #rrggbb');
  if (patch.opacity !== undefined && !(patch.opacity >= 0 && patch.opacity <= 1)) throw new Error('bug: opacity out of range');
  if (patch.selfReach !== undefined && !(patch.selfReach > 0 && patch.selfReach < 1)) throw new Error('bug: selfReach out of range');
  return { ...model, system: { ...s, ...patch, slug } };
}

/** Appends a participant of `kind`. Returns { model, slug }. */
function addParticipant(model, kind, title) {
  if (!KIND_NAMES.includes(kind)) throw new Error('bug: unknown kind ' + kind);
  const parts = model.system.participants;
  const taken = new Set(parts.map((p) => p.slug));
  let t = title;
  if (t === undefined) {
    const same = parts.filter((p) => p.kind === kind).length;
    t = KIND_TITLES[kind] + (same ? ' ' + (same + 1) : '');
  }
  const slug = uniqueSlug(slugify(t), taken);
  const p = { slug, title: t, kind, fill: KIND_FILLS[kind], description: '' };
  return { model: { ...model, system: { ...model.system, participants: [...parts, p] } }, slug };
}

function renameParticipantRefs(flows, from, to) {
  if (from === to) return flows;
  return flows.map((f) => ({ ...f, steps: f.steps.map((s) => ({ ...s, from: s.from === from ? to : s.from, to: s.to === from ? to : s.to })) }));
}

/** Patch title / slug / kind / fill / description. Slug follows the title unless it was set by hand. Returns { model, slug }. */
function updateParticipant(model, slug, patch) {
  const allowed = ['title', 'slug', 'kind', 'fill', 'description'];
  Object.keys(patch).forEach((k) => { if (!allowed.includes(k)) throw new Error('bug: updateParticipant got "' + k + '"'); });
  const i = participantIndex(model, slug);
  const p = model.system.participants[i];
  const taken = new Set(model.system.participants.filter((_, k) => k !== i).map((x) => x.slug));
  let next = p.slug;
  if (patch.slug !== undefined) {
    next = checkSlug(patch.slug);
    if (taken.has(next)) throw new UserError('Another participant already uses "' + next + '".');
  } else if (patch.title !== undefined && slugFollows(p.slug, p.title) && slugify(patch.title)) {
    next = uniqueSlug(slugify(patch.title), taken);
  }
  if (patch.kind !== undefined && !KIND_NAMES.includes(patch.kind)) throw new Error('bug: unknown kind');
  if (patch.fill !== undefined && !HEX_RE.test(patch.fill)) throw new Error('bug: fill must be #rrggbb');
  const np = { ...p, ...patch, slug: next };
  return {
    model: { ...model, system: { ...model.system, participants: replaceAt(model.system.participants, i, np) }, flows: renameParticipantRefs(model.flows, p.slug, next) },
    slug: next
  };
}

/** Swap the ring slots of two participants; spacing stays even because slots are array indices. */
function swapParticipants(model, a, b) {
  const parts = model.system.participants;
  const i = participantIndex(model, a), j = participantIndex(model, b);
  const next = parts.slice();
  next[i] = parts[j]; next[j] = parts[i];
  return { ...model, system: { ...model.system, participants: next } };
}

/** Steps that would be removed together with a participant. */
function stepsUsing(model, slug) {
  return model.flows.flatMap((f) => f.steps.filter((s) => s.from === slug || s.to === slug).map((s) => ({ flow: f.slug, n: s.n })));
}
function removeParticipant(model, slug) {
  participantIndex(model, slug);
  let m = { ...model, system: { ...model.system, participants: model.system.participants.filter((p) => p.slug !== slug) } };
  stepsUsing(model, slug).reverse().forEach(({ flow, n }) => { m = removeStep(m, flow, n); });
  return m;
}

/* ---------- galaxy: included systems ---------- */

function includeSystem(model, slug) {
  checkSlug(slug);
  if (slug === model.system.slug) throw new UserError('A system cannot include itself.');
  if (model.system.includes.includes(slug)) throw new UserError('"' + slug + '" is already in this galaxy.');
  return { ...model, system: { ...model.system, includes: [...model.system.includes, slug] } };
}
const refUsesSystem = (ref, sys) => isExternal(ref) && parseRef(ref).system === sys;
const triggerUsesSystem = (t, sys) => typeof t === 'string' && t.startsWith(sys + '/');
/** Steps of this system that reach into included system `sys` (as endpoints or triggers). */
function includeUsage(model, sys) {
  return model.flows.flatMap((f) => f.steps.filter((s) => refUsesSystem(s.from, sys) || refUsesSystem(s.to, sys) || triggerUsesSystem(s.triggers, sys)).map((s) => ({ flow: f.slug, n: s.n })));
}
/** Drops `sys` from the galaxy: its cross-system steps are removed and triggers into it cleared. */
function removeInclude(model, sys) {
  if (!model.system.includes.includes(sys)) throw new Error('bug: "' + sys + '" is not included');
  let m = { ...model, system: { ...model.system, includes: model.system.includes.filter((x) => x !== sys) } };
  m = { ...m, flows: m.flows.map((f) => ({ ...f, steps: f.steps.map((s) => (triggerUsesSystem(s.triggers, sys) ? { ...s, triggers: null } : s)) })) };
  model.flows.forEach((f) => {
    f.steps.filter((s) => refUsesSystem(s.from, sys) || refUsesSystem(s.to, sys)).map((s) => s.n).reverse().forEach((n) => { m = removeStep(m, f.slug, n); });
  });
  return m;
}
/**
 * Who would be affected if system `sys` were deleted: every other saved system that
 * includes it, with the steps that would go. Why: deleting is only safe once you can
 * see what breaks elsewhere.
 * `library` maps slug → Model. Returns [{ system, label, steps }] in label order, where
 * steps are [{ flow, flowName, n, label, effect }]: effect 'removed' when the step's
 * sender or receiver is in `sys` (removeInclude drops it), 'untriggered' when it only
 * starts a flow there (the trigger is cleared, the step stays).
 * e.g. [{ system: 'storefront', label: 'Storefront', steps: [{ flow: 'checkout', flowName: 'Checkout', n: 3, label: 'Authorise payment', effect: 'removed' }] }]
 */
function systemReferences(library, sys) {
  return [...library.values()]
    .filter((m) => m.system.slug !== sys && m.system.includes.includes(sys))
    .map((m) => ({
      system: m.system.slug,
      label: m.system.label,
      steps: m.flows.flatMap((f) => f.steps.flatMap((s) => {
        const removed = refUsesSystem(s.from, sys) || refUsesSystem(s.to, sys);
        if (!removed && !triggerUsesSystem(s.triggers, sys)) return [];
        return [{ flow: f.slug, flowName: f.name, n: s.n, label: s.label, effect: removed ? 'removed' : 'untriggered' }];
      })),
    }))
    .sort((a, b) => a.label.localeCompare(b.label));
}
function swapIncludes(model, a, b) {
  const inc = model.system.includes, i = inc.indexOf(a), j = inc.indexOf(b);
  if (i < 0 || j < 0) throw new Error('bug: swapIncludes with a system that is not included');
  const next = inc.slice();
  next[i] = b; next[j] = a;
  return { ...model, system: { ...model.system, includes: next } };
}
/** Another system was renamed: rewrite this system's includes, refs and triggers. */
function renameSystemRefs(model, from, to) {
  if (from === to || !model.system.includes.includes(from)) return model;
  const ref = (r) => (refUsesSystem(r, from) ? to + '.' + parseRef(r).slug : r);
  return {
    ...model,
    system: { ...model.system, includes: model.system.includes.map((x) => (x === from ? to : x)) },
    flows: model.flows.map((f) => ({ ...f, steps: f.steps.map((s) => ({ ...s, from: ref(s.from), to: ref(s.to), triggers: triggerUsesSystem(s.triggers, from) ? to + s.triggers.slice(from.length) : s.triggers })) }))
  };
}
/** A participant of included system `sys` was renamed. */
function renameExternalParticipant(model, sys, from, to) {
  const a = sys + '.' + from, b = sys + '.' + to;
  if (a === b) return model;
  return { ...model, flows: model.flows.map((f) => ({ ...f, steps: f.steps.map((s) => ({ ...s, from: s.from === a ? b : s.from, to: s.to === a ? b : s.to })) })) };
}
/** A flow of included system `sys` was renamed. */
function renameExternalFlow(model, sys, from, to) {
  const a = sys + '/' + from, b = sys + '/' + to;
  return { ...model, flows: model.flows.map((f) => ({ ...f, steps: f.steps.map((s) => (s.triggers === a ? { ...s, triggers: b } : s)) })) };
}
/** from/to must be a participant here or "<included system>.<slug>"; existence in the other file is checked by galaxyProblems. */
function checkEndpoints(model, from, to) {
  [from, to].forEach((r) => {
    if (!isExternal(r)) { participantIndex(model, r); return; }
    const { system } = parseRef(r);
    if (!model.system.includes.includes(system)) throw new Error('bug: "' + r + '" names a system that is not included');
  });
  if (isExternal(from) && isExternal(to) && parseRef(from).system === parseRef(to).system) {
    throw new UserError('Steps between two participants of ' + parseRef(from).system + ' belong in that system\'s own flows.');
  }
}

/* ---------- schemas (message and result types) ---------- */

const BASE_TYPES = ['string', 'text', 'number', 'boolean', 'date', 'object'];
/** Example value for a "date" field. Fixed so example data is the same on every run. */
const EXAMPLE_DATE = '2026-01-15';
/** ISO 8601 calendar date, optionally with a time and offset: 2026-01-15, 2026-01-15T09:30Z, 2026-01-15T09:30:00.250+01:00. */
const DATE_RE = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])(T([01]\d|2[0-3]):[0-5]\d(:[0-5]\d(\.\d+)?)?(Z|[+-]([01]\d|2[0-3]):?[0-5]\d)?)?$/;
/** Example value of one built-in type for field `name`. */
function baseExample(type, name) {
  switch (type) {
    case 'string': case 'text': return '<' + name + '>';
    case 'number': return 0;
    case 'boolean': return false;
    case 'date': return EXAMPLE_DATE;
    case 'object': return {};
    default: throw new Error('bug: "' + type + '" is not a built-in type');
  }
}
/** Problems with value `v` of built-in `type` at `path`; [] when it fits. */
function baseProblems(type, v, path) {
  switch (type) {
    case 'string': case 'text': return typeof v === 'string' ? [] : [path + ' should be text'];
    case 'number': return typeof v === 'number' && Number.isFinite(v) ? [] : [path + ' should be a number'];
    case 'boolean': return typeof v === 'boolean' ? [] : [path + ' should be true or false'];
    case 'date': return typeof v === 'string' && DATE_RE.test(v) ? [] : [path + ' should be a date like ' + EXAMPLE_DATE];
    case 'object': return isPlainObject(v) ? [] : [path + ' should be a mapping of field: value'];
    default: throw new Error('bug: "' + type + '" is not a built-in type');
  }
}
const FIELD_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;
const FIELD_TYPE_RE = /^([a-z0-9]+(?:-[a-z0-9]+)*)(\[\])?$/;
const PASCAL_RE = /^[A-Z][A-Za-z0-9]*$/;

/** Words of a name, splitting camel/PascalCase too: "PaymentRequested" → ["Payment", "Requested"]. */
const words = (text) => String(text).normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2').split(/[^A-Za-z0-9]+/).filter(Boolean);
/** "PaymentRequested" → "payment-requested" (every word, so older names never collide). */
const kebab = (text) => words(text).map((w) => w.toLowerCase()).join('-');
/** "PaymentRequested" → "Payment requested". */
const sentence = (text) => { const w = words(text).map((x) => x.toLowerCase()); return w.length ? w[0][0].toUpperCase() + w[0].slice(1) + (w.length > 1 ? ' ' + w.slice(1).join(' ') : '') : ''; };
/** A type reference as stored: older PascalCase names become kebab-case; kebab ones are kept. */
const typeRef = (name) => (PASCAL_RE.test(name) ? kebab(name) : name);

const findSchema = (model, slug) => model.schemas.find((x) => x.slug === slug) || null;

/** Problem with a schema as edited, or null. `orig` is its current slug (null for a new one). */
function schemaError(model, orig, draft) {
  if (!draft.title.trim()) return 'Give the type a title.';
  if (!SLUG_RE.test(draft.slug)) return 'Type ids use lower-case letters, digits and single dashes, e.g. payment-requested.';
  if (BASE_TYPES.includes(draft.slug)) return '"' + draft.slug + '" is a built-in type; pick another id.';
  if (draft.slug !== orig && findSchema(model, draft.slug)) return 'There is already a type with the id ' + draft.slug + '.';
  const seen = new Set();
  for (const f of draft.fields) {
    if (!FIELD_RE.test(f.name)) return 'Field names start with a letter and use letters, digits and _, e.g. orderId.' + (f.name ? ' "' + f.name + '" does not.' : ' One is empty.');
    if (seen.has(f.name)) return 'Two fields are called ' + f.name + '.';
    seen.add(f.name);
    if (!BASE_TYPES.includes(f.type) && !SLUG_RE.test(f.type)) return 'Field ' + f.name + ' needs a type.';
    if (typeof f.repeated !== 'boolean') throw new Error('bug: repeated must be a boolean');
  }
  return null;
}
/** The id a title gives, unique in this file (and among `extraTaken`, e.g. types seen from included systems). */
function typeSlugFor(model, title, extraTaken) {
  const taken = new Set([...model.schemas.map((x) => x.slug), ...BASE_TYPES, ...(extraTaken || [])]);
  return uniqueSlug(slugify(title), taken);
}
/** New empty type from a title. Returns { model, slug }. */
function addSchema(model, title, extraTaken) {
  const t = String(title).trim();
  if (!t) throw new UserError('Give the type a title.');
  const draft = { slug: typeSlugFor(model, t, extraTaken), title: t, summary: '', fields: [] };
  const err = schemaError(model, null, draft);
  if (err) throw new UserError(err);
  return { model: { ...model, schemas: [...model.schemas, draft] }, slug: draft.slug };
}
/** Define a type under an id steps may already use (e.g. an older name never defined). */
/**
 * The draft as it is saved: fields with no name yet are left out. Why: the editor adds a
 * blank row to type into (Enter on a field), and an unfinished row shouldn't block saving
 * or end up in the file as an invalid field. e.g. fields [orderId, ""] → [orderId].
 */
function namedFields(draft) {
  return { ...draft, fields: draft.fields.filter((f) => f.name.trim() !== '').map((f) => ({ ...f, name: f.name.trim() })) };
}
function defineSchema(model, draft) {
  const err = schemaError(model, null, draft);
  if (err) throw new UserError(err);
  return { ...model, schemas: [...model.schemas, { slug: draft.slug, title: draft.title.trim(), summary: draft.summary.trim(), fields: draft.fields.map((f) => ({ name: f.name, type: f.type, repeated: f.repeated })) }] };
}
/** The id after a title edit: follows the title while it still matches the old one. */
function followTypeSlug(model, orig, oldTitle, newTitle) {
  if (!slugFollows(orig, oldTitle) || !slugify(newTitle)) return orig;
  const taken = new Set([...model.schemas.filter((x) => x.slug !== orig).map((x) => x.slug), ...BASE_TYPES]);
  return uniqueSlug(slugify(newTitle), taken);
}
/** Replace schema `orig` with `draft`; a new id follows into steps and other schemas' fields. */
function updateSchema(model, orig, draft) {
  if (!findSchema(model, orig)) throw new Error('bug: no type ' + orig);
  const err = schemaError(model, orig, draft);
  if (err) throw new UserError(err);
  const clean = { slug: draft.slug, title: draft.title.trim(), summary: draft.summary.trim(), fields: draft.fields.map((f) => ({ name: f.name, type: f.type, repeated: f.repeated })) };
  const ren = (t) => (t === orig ? draft.slug : t);
  return {
    ...model,
    schemas: model.schemas.map((x) => (x.slug === orig ? clean : x)).map((x) => ({ ...x, fields: x.fields.map((f) => ({ ...f, type: ren(f.type) })) })),
    flows: orig === draft.slug ? model.flows : model.flows.map((f) => ({ ...f, steps: f.steps.map((s) => ({ ...s, message: s.message === orig ? draft.slug : s.message, result: s.result === orig ? draft.slug : s.result })) }))
  };
}
/** Where type `slug` is used in this file: steps (as message or result) and other types' fields. */
function schemaUsage(model, slug) {
  const steps = model.flows.flatMap((f) => f.steps.flatMap((s) => [s.message === slug ? { flow: f.slug, flowName: f.name, n: s.n, as: 'message' } : null, s.result === slug ? { flow: f.slug, flowName: f.name, n: s.n, as: 'result' } : null].filter(Boolean)));
  const fields = model.schemas.flatMap((x) => x.fields.filter((f) => f.type === slug).map((f) => ({ schema: x.slug, field: f.name })));
  return { steps, fields };
}
/** Removes the definition; steps and fields that use the id keep it (shown as not defined). */
function removeSchema(model, slug) {
  if (!findSchema(model, slug)) throw new Error('bug: no type ' + slug);
  return { ...model, schemas: model.schemas.filter((x) => x.slug !== slug) };
}
/** Every type visible from `home`: its own first, then each included system's, in galaxy order. slug → { system, schema, local }. */
function typeIndex(home, library) {
  const idx = new Map();
  home.schemas.forEach((x) => idx.set(x.slug, { system: home.system.slug, schema: x, local: true }));
  home.system.includes.forEach((sys) => {
    const m = library.get(sys);
    if (m) m.schemas.forEach((x) => { if (!idx.has(x.slug)) idx.set(x.slug, { system: sys, schema: x, local: false }); });
  });
  return idx;
}
/** Title for a type id: its definition's, or one made from the id when it isn't defined. */
const typeTitle = (index, slug) => (index.has(slug) ? index.get(slug).schema.title : sentence(slug));
/** Example payload for a type: placeholders for text, false for booleans, nested types filled in. Pure. */
function exampleData(index, slug, seen) {
  const e = index.get(slug);
  const path = seen || [];
  if (!e || path.includes(slug)) return null;
  const one = (f) => (BASE_TYPES.includes(f.type) ? baseExample(f.type, f.name) : exampleData(index, f.type, [...path, slug]));
  return Object.fromEntries(e.schema.fields.map((f) => [f.name, f.repeated ? [one(f)] : one(f)]));
}
/** `data` with any missing fields of `slug` added from the example; existing values are kept. */
function fillData(index, slug, data) {
  const ex = exampleData(index, slug) || {};
  const out = {};
  Object.keys(ex).forEach((k) => { out[k] = k in data ? data[k] : ex[k]; });
  Object.keys(data).forEach((k) => { if (!(k in out)) out[k] = data[k]; });
  return out;
}
/** How `data` differs from type `slug`: missing, unexpected and wrongly typed fields (with paths). */
function checkData(index, slug, data, prefix) {
  const e = index.get(slug);
  if (!e) return [];
  const at = (k) => (prefix ? prefix + '.' + k : k);
  const out = [];
  const okValue = (f, v, path) => {
    if (BASE_TYPES.includes(f.type)) return baseProblems(f.type, v, path);
    if (!index.has(f.type)) return [];
    return v !== null && typeof v === 'object' && !Array.isArray(v) ? checkData(index, f.type, v, path) : [path + ' should be a ' + index.get(f.type).schema.title];
  };
  e.schema.fields.forEach((f) => {
    if (!(f.name in data)) { out.push(at(f.name) + ' is missing'); return; }
    const v = data[f.name];
    if (f.repeated) {
      if (!Array.isArray(v)) out.push(at(f.name) + ' should be a list');
      else v.forEach((x, i) => okValue(f, x, at(f.name) + '[' + i + ']').forEach((p) => out.push(p)));
    } else okValue(f, v, at(f.name)).forEach((p) => out.push(p));
  });
  Object.keys(data).forEach((k) => { if (!e.schema.fields.some((f) => f.name === k)) out.push(at(k) + ' is not in ' + e.schema.title); });
  return out;
}

/* ---------- flows ---------- */

function addFlow(model, name) {
  const taken = new Set(model.flows.map((f) => f.slug));
  const nm = name ?? 'Flow ' + (model.flows.length + 1);
  const slug = uniqueSlug(slugify(nm), taken);
  return { model: { ...model, flows: [...model.flows, { slug, name: nm, steps: [] }] }, slug };
}
function renameFlow(model, slug, name) {
  const i = findFlow(model, slug);
  const f = model.flows[i];
  const taken = new Set(model.flows.filter((_, k) => k !== i).map((x) => x.slug));
  const next = slugFollows(f.slug, f.name) && slugify(name) ? uniqueSlug(slugify(name), taken) : f.slug;
  const flows = replaceAt(model.flows, i, { ...f, name, slug: next })
    .map((g) => ({ ...g, steps: g.steps.map((s) => (s.triggers === f.slug ? { ...s, triggers: next } : s)) }));
  return { model: { ...model, flows }, slug: next };
}
function removeFlow(model, slug) {
  findFlow(model, slug);
  if (model.flows.length === 1) throw new UserError('A system keeps at least one flow.');
  const flows = model.flows.filter((f) => f.slug !== slug)
    .map((g) => ({ ...g, steps: g.steps.map((s) => (s.triggers === slug ? { ...s, triggers: null } : s)) }));
  return { ...model, flows };
}

/* ---------- steps ---------- */

/** Last step (highest n) of `chain`, or null when the chain has no steps yet. */
function chainTail(flow, chain) {
  const xs = flow.steps.filter((s) => s.chain === chain);
  return xs.length ? xs[xs.length - 1].n : null;
}
function nextChain(flow) {
  const used = new Set(flow.steps.map((s) => s.chain));
  for (let c = 65; c <= 90; c++) if (!used.has(String.fromCharCode(c))) return String.fromCharCode(c);
  throw new UserError('A flow can have at most 26 chains.');
}

/** Appends a step numbered after the highest existing number. Returns { model, n }. */
function addStep(model, flowSlug, { from, to, chain, after }) {
  checkEndpoints(model, from, to);
  if (!CHAIN_RE.test(chain)) throw new Error('bug: chain must be A–Z');
  const fi = findFlow(model, flowSlug);
  const f = model.flows[fi];
  if (after !== null) findStep(f, after);
  const n = f.steps.reduce((mx, s) => Math.max(mx, s.n), 0) + 1;
  const step = { n, from, to, label: '', chain, after, message: null, tags: [], triggers: null, data: {}, description: '', result: null, async: false };
  return { model: { ...model, flows: replaceAt(model.flows, fi, { ...f, steps: [...f.steps, step] }) }, n };
}

function updateStep(model, flowSlug, n, patch) {
  const allowed = ['from', 'to', 'label', 'message', 'tags', 'triggers', 'data', 'description', 'result', 'async'];
  Object.keys(patch).forEach((k) => { if (!allowed.includes(k)) throw new Error('bug: updateStep got "' + k + '"'); });
  const fi = findFlow(model, flowSlug);
  const f = model.flows[fi];
  const s = findStep(f, n);
  if (patch.from !== undefined || patch.to !== undefined) checkEndpoints(model, patch.from ?? s.from, patch.to ?? s.to);
  if (patch.tags !== undefined && (!Array.isArray(patch.tags) || new Set(patch.tags).size !== patch.tags.length)) throw new Error('bug: tags must be unique strings');
  if (patch.async !== undefined && typeof patch.async !== 'boolean') throw new Error('bug: async must be a boolean');
  if (patch.data !== undefined && !isPlainObject(patch.data)) throw new UserError('Data must be a mapping of field: value.');
  if (patch.triggers) {
    if (patch.triggers.includes('/')) {
      if (!model.system.includes.includes(patch.triggers.split('/')[0])) throw new Error('bug: trigger into a system that is not included');
    } else findFlow(model, patch.triggers);
  }
  const next = { ...s, ...patch };
  if (patch.label !== undefined) next.label = patch.label.replace(/\s+/g, ' ').trim();
  if (patch.message !== undefined) next.message = patch.message && patch.message.trim() ? checkTypeRef(patch.message.trim()) : null;
  if (patch.result !== undefined) next.result = patch.result && patch.result.trim() ? checkTypeRef(patch.result.trim()) : null;
  if (next.result) {
    const steps = f.steps.map((x) => (x.n === n ? next : x));
    const entry = flowEntry({ steps });
    const isFlowResult = (x) => x.result && x.from === x.to && x.to === entry;
    const other = isFlowResult(next) ? steps.find((x) => x.n !== n && isFlowResult(x)) : null;
    if (other) throw new UserError('Step ' + other.n + ' already returns this flow\'s result to its callers; a flow returns one result.');
  }
  return { ...model, flows: replaceAt(model.flows, fi, { ...f, steps: f.steps.map((x) => (x.n === n ? next : x)) }) };
}

function checkTypeRef(t) {
  if (!SLUG_RE.test(t)) throw new Error('bug: type id must be kebab-case, got "' + t + '"');
  return t;
}
/** Removes step n; steps that followed it now follow its predecessor. Renumbers 1..N. */
function removeStep(model, flowSlug, n) {
  const fi = findFlow(model, flowSlug);
  const f = model.flows[fi];
  const gone = findStep(f, n);
  const kept = f.steps.filter((s) => s.n !== n).map((s) => (s.after === n ? { ...s, after: gone.after } : s));
  const renum = new Map(kept.map((s, k) => [s.n, k + 1]));
  const steps = kept.map((s) => ({ ...s, n: renum.get(s.n), after: s.after === null ? null : renum.get(s.after) }));
  return { ...model, flows: replaceAt(model.flows, fi, { ...f, steps }) };
}

/** The participant a flow starts from (its first step's sender), or null for an empty flow. */
function flowEntry(flow) {
  const first = flow.steps.find((s) => s.after === null);
  return first ? first.from : null;
}
/**
 * A step's result after its triggered flow changes: it defaults to the new flow's result.
 * A result the person chose is kept; one that was only the old flow's default follows
 * the new flow (and clears when the new flow returns nothing).
 */
function resultAfterTrigger(current, oldFlowResult, newFlowResult) {
  if (current && current !== oldFlowResult) return current;
  return newFlowResult || null;
}
/** The flow's result for callers: a self-step with a result on the entry participant. */
function flowResult(flow) {
  const entry = flowEntry(flow);
  return flow.steps.find((s) => s.result && s.from === s.to && s.to === entry) || null;
}

/** Steps of `chain` in the order they play: its first step, then each step that follows the last. */
function chainSequence(flow, chain) {
  const xs = flow.steps.filter((s) => s.chain === chain);
  const inChain = new Set(xs.map((s) => s.n));
  const heads = xs.filter((s) => s.after === null || !inChain.has(s.after));
  const seq = [];
  if (heads.length === 1) {
    for (let cur = heads[0]; cur; ) {
      seq.push(cur);
      const nexts = xs.filter((s) => s.after === cur.n);
      if (nexts.length > 1) break;
      cur = nexts[0] || null;
    }
  }
  if (seq.length !== xs.length) throw new UserError('Chain ' + chain + ' isn\'t a single line of steps, so it can\'t be reordered here. Its "after" values can be edited in the Markdown.');
  return seq;
}
/**
 * Move step n to position `to` (0-based) within its chain. The chain is re-linked in the
 * new order and keeps its numbers, which follow the new positions; chains forked from a
 * step stay with that step. If that would number a step before the one it follows, the
 * flow is renumbered in play order. Returns { model, n } with the moved step's new number.
 */
function moveStep(model, flowSlug, n, to) {
  const fi = findFlow(model, flowSlug);
  const f = model.flows[fi];
  const moving = findStep(f, n);
  const seq = chainSequence(f, moving.chain);
  if (!Number.isInteger(to) || to < 0 || to >= seq.length) throw new Error('bug: move to ' + to + ' outside chain ' + moving.chain);
  const anchor = seq[0].after;
  const order = seq.filter((s) => s.n !== n);
  order.splice(to, 0, moving);
  if (order.every((s, i) => s === seq[i])) return { model, n };
  // re-link the chain, and give its numbers (in their old order) to its new order
  const nums = seq.map((s) => s.n);
  const renum = new Map(order.map((s, i) => [s.n, nums[i]]));
  const relinked = new Map(order.map((s, i) => [s.n, i === 0 ? anchor : order[i - 1].n]));
  const ren = (x) => (x === null ? null : renum.has(x) ? renum.get(x) : x);
  let steps = f.steps.map((s) => (renum.has(s.n) ? { ...s, after: ren(relinked.get(s.n)), n: renum.get(s.n) } : { ...s, after: ren(s.after) }));
  // play order: a step must come after the one it follows; renumber 1..N if needed, keeping numbers as close as possible
  const byN = new Map(steps.map((s) => [s.n, s]));
  const placed = new Map();
  let next = 1;
  while (placed.size < steps.length) {
    const ready = steps.filter((s) => !placed.has(s.n) && (s.after === null || placed.has(s.after))).sort((a, b) => a.n - b.n);
    if (!ready.length) throw new Error('bug: steps follow each other in a loop');
    placed.set(ready[0].n, next++);
  }
  steps = steps.map((s) => ({ ...s, n: placed.get(s.n), after: s.after === null ? null : placed.get(s.after) })).sort((a, b) => a.n - b.n);
  if (!byN.size) throw new Error('bug: empty flow');
  return { model: { ...model, flows: replaceAt(model.flows, fi, { ...f, steps }) }, n: placed.get(renum.get(n)) };
}

/* ---------- timeline ---------- */

/** Play slot of each step: a step plays one slot after the step it follows,
 *  so steps on different chains with equal slots run concurrently. */
function timeline(flow) {
  const slot = new Map();
  flow.steps.forEach((s) => {
    if (s.after === null) slot.set(s.n, 0);
    else {
      if (!slot.has(s.after)) throw new Error('bug: step ' + s.n + ' follows ' + s.after + ', which is not earlier');
      slot.set(s.n, slot.get(s.after) + 1);
    }
  });
  const length = flow.steps.length ? Math.max(...slot.values()) + 1 : 0;
  const order = flow.steps.slice().sort((a, b) => slot.get(a.n) - slot.get(b.n) || a.n - b.n).map((s) => s.n);
  return { slot, length, order };
}
/** For playhead t in [0, length]: each step's phase ('done' | 'active' | 'todo') and progress 0–1. */
function playPhases(flow, t) {
  const { slot } = timeline(flow);
  const s = Math.floor(t), frac = t - s;
  return new Map(flow.steps.map((st) => {
    const k = slot.get(st.n);
    return [st.n, k < s ? { phase: 'done', p: 1 } : k === s ? { phase: 'active', p: frac } : { phase: 'todo', p: 0 }];
  }));
}

/* ---------- ring geometry ---------- */

function ringLayout(count, size) {
  const c = size / 2, R = size * 0.34, nr = Math.max(14, size * 0.064);
  const pos = Array.from({ length: count }, (_, i) => {
    const th = -Math.PI / 2 + (i * 2 * Math.PI) / count;
    return { x: c + R * Math.cos(th), y: c + R * Math.sin(th), th };
  });
  return { c, R, nr, pos };
}

/**
 * Participants in one row through the ring, `spacing` apart, just below its centre (the
 * system's title sits above). Why: a folded system reads as its title over its entry points,
 * e.g. lineLayout(3, 480, 130). Labels go below, so th points down.
 */
function lineLayout(count, size, spacing) {
  const base = ringLayout(count, size), y = base.c + size * 0.1;
  const pos = Array.from({ length: count }, (_, i) => ({ x: base.c + (i - (count - 1) / 2) * spacing, y, th: Math.PI / 2 }));
  return { ...base, pos };
}
/** Self-message loop: an ellipse whose long axis runs from the participant toward the
 *  ring centre, reaching `reach` × R inward. Returns polyline points outside the node. */
function selfLoop(p, nr, R, reach) {
  if (!(reach > 0 && reach < 1)) throw new Error('bug: selfReach must be in (0, 1)');
  const ux = -Math.cos(p.th), uy = -Math.sin(p.th), px = -uy, py = ux;
  const near = nr * 0.35, far = nr + reach * R;
  const a = (far - near) / 2, b = Math.max(nr * 0.6, a * 0.55);
  const ex = p.x + ux * (near + a), ey = p.y + uy * (near + a);
  const at = (t) => ({ x: ex + ux * a * Math.cos(t) + px * b * Math.sin(t), y: ey + uy * a * Math.cos(t) + py * b * Math.sin(t) });
  const all = Array.from({ length: 73 }, (_, i) => at(-Math.PI + (i / 72) * 2 * Math.PI));
  const outside = (q, gap) => Math.hypot(q.x - p.x, q.y - p.y) > nr + gap;
  const first = all.findIndex((q) => outside(q, 4));
  let last = all.length - 1;
  while (last > first && !outside(all[last], 10)) last--;
  if (first < 0 || last - first < 6) throw new Error('bug: self loop never leaves the node');
  return { pts: all.slice(first, last + 1), apex: at(0) };
}

/* ---------- markdown: write ---------- */

/** Mermaid ids can't contain "-" or ".": "order-service" → order_service, "payments.gateway-api" → payments__gateway_api. */
const mermaidId = (ref) => { const r = parseRef(ref); return (r.system ? r.system.replace(/-/g, '_') + '__' : '') + r.slug.replace(/-/g, '_'); };
const mermaidEscape = (t) => String(t).replace(/#/g, '#35;').replace(/;/g, '#59;');
const mermaidUnescape = (t) => t.replace(/#59;/g, ';').replace(/#35;/g, '#');

function yamlBlock(obj, flowLevel) {
  return YAML.dump(obj, { lineWidth: -1, noRefs: true, flowLevel, sortKeys: false, schema: YAML.JSON_SCHEMA }).replace(/\n$/, '');
}
function fenceFor(text) {
  const runs = text.match(/`{3,}/g) || [];
  return '`'.repeat(Math.max(3, ...runs.map((r) => r.length + 1)));
}

/** Mermaid lines for a flow. Chain A runs up to the first fork; the rest become
 *  par / and branches so concurrent chains read as concurrent in any renderer. */
function mermaidFor(model, flow) {
  const out = ['sequenceDiagram'];
  model.system.participants.forEach((p) => out.push('  participant ' + mermaidId(p.slug) + ' as ' + mermaidEscape(p.title)));
  const externals = [];
  flow.steps.forEach((s) => [s.from, s.to].forEach((r) => { if (isExternal(r) && !externals.includes(r)) externals.push(r); }));
  externals.forEach((r) => out.push('  participant ' + mermaidId(r) + ' as ' + r));
  const line = (s, ind) => ind + mermaidId(s.from) + (s.async ? '-)' : '->>') + mermaidId(s.to) + ': ' + s.n + ' · ' + mermaidEscape(s.label);
  const chains = [];
  flow.steps.forEach((s) => { if (!chains.includes(s.chain)) chains.push(s.chain); });
  if (chains.length <= 1) { flow.steps.forEach((s) => out.push(line(s, '  '))); return out.join('\n'); }
  const byN = new Map(flow.steps.map((s) => [s.n, s]));
  const firstOf = (c) => flow.steps.find((s) => s.chain === c);
  const forkPoints = chains.filter((c) => c !== 'A').map((c) => firstOf(c).after).filter((a) => a !== null && byN.get(a).chain === 'A');
  const cut = forkPoints.length ? Math.min(...forkPoints) : 0;
  const head = flow.steps.filter((s) => s.chain === 'A' && s.n <= cut);
  head.forEach((s) => out.push(line(s, '  ')));
  const branches = chains.map((c) => ({ c, steps: flow.steps.filter((s) => s.chain === c && !(c === 'A' && s.n <= cut)) })).filter((b) => b.steps.length);
  const caption = (b) => 'chain ' + b.c + (b.c === 'A' || b.steps[0].after === null ? '' : ' · forked from ' + b.steps[0].after);
  if (branches.length === 1) { branches[0].steps.forEach((s) => out.push(line(s, '  '))); return out.join('\n'); }
  branches.forEach((b, k) => {
    out.push('  ' + (k === 0 ? 'par ' : 'and ') + caption(b));
    b.steps.forEach((s) => out.push(line(s, '    ')));
  });
  out.push('  end');
  return out.join('\n');
}

const F = '```';
function serialize(model) {
  const s = model.system;
  const out = ['---', 'flows: 1', '---', '', '# ' + s.label, ''];
  out.push(F + 'system', yamlBlock({
    slug: s.slug, label: s.label, fill: s.fill, opacity: s.opacity, selfReach: s.selfReach,
    ...(s.includes.length ? { includes: s.includes } : {})
  }, 2), F);
  s.participants.forEach((p) => {
    out.push('', '## Participant: ' + p.title, '', F + 'participant', yamlBlock({ slug: p.slug, kind: p.kind, fill: p.fill }, -1), F);
    if (p.description !== '') { const fence = fenceFor(p.description); out.push('', '### Description', '', fence + 'md', p.description, fence); }
  });
  if (model.schemas.length) {
    out.push('', '## Types', '', F + 'schema', yamlBlock(Object.fromEntries(model.schemas.map((x) => [x.slug, {
      title: x.title,
      ...(x.summary ? { summary: x.summary } : {}),
      fields: Object.fromEntries(x.fields.map((f) => [f.name, f.type + (f.repeated ? '[]' : '')]))
    }])), -1), F);
  }
  model.flows.forEach((f) => {
    out.push('', '## Flow: ' + f.name + ' {#' + f.slug + '}', '', F + 'mermaid', mermaidFor(model, f), F);
    f.steps.forEach((st) => {
      const block = { n: st.n, chain: st.chain, after: st.after };
      if (st.message) block.message = st.message;
      if (st.tags.length) block.tags = st.tags;
      if (st.triggers) block.triggers = st.triggers;
      if (Object.keys(st.data).length) block.data = st.data;
      if (st.result) block.result = st.result;
      out.push('', '### ' + st.n + ' · ' + (st.label || '(no label)'), '', F + 'step', yamlBlock(block, 1), F);
      if (st.description !== '') { const fence = fenceFor(st.description); out.push('', fence + 'md', st.description, fence); }
    });
  });
  return out.join('\n') + '\n';
}

/* ---------- markdown: read ---------- */

function loadYaml(text, firstLine) {
  try { return YAML.load(text, { schema: YAML.JSON_SCHEMA }); }
  catch (e) {
    const ln = e.mark && typeof e.mark.line === 'number' ? firstLine + e.mark.line : firstLine;
    throw new FlowParseError(ln, 'YAML: ' + (e.reason || e.message));
  }
}
function checkKeys(obj, required, optional, line, what) {
  if (!isPlainObject(obj)) throw new FlowParseError(line, what + ' must be a mapping of key: value lines.');
  Object.keys(obj).forEach((k) => { if (!required.includes(k) && !optional.includes(k)) throw new FlowParseError(line, what + ' has an unknown key "' + k + '". Allowed: ' + required.concat(optional).join(', ') + '.'); });
  required.forEach((k) => { if (!(k in obj)) throw new FlowParseError(line, what + ' is missing "' + k + '".'); });
}
const need = (cond, line, msg) => { if (!cond) throw new FlowParseError(line, msg); };

function readSystem(raw, line) {
  checkKeys(raw, ['slug', 'label', 'fill', 'opacity', 'selfReach'], ['includes', 'participants'], line, 'The system block');
  const includes = raw.includes ?? [];
  need(Array.isArray(includes) && includes.every((x) => typeof x === 'string' && SLUG_RE.test(x)), line, '"includes" must be a list of system slugs, e.g. [payments, fulfilment].');
  need(new Set(includes).size === includes.length, line, '"includes" lists the same system twice.');
  need(!includes.includes(raw.slug), line, 'A system cannot include itself.');
  need(typeof raw.label === 'string' && raw.label.trim() !== '', line, 'System "label" must be text.');
  need(typeof raw.slug === 'string' && SLUG_RE.test(raw.slug), line, 'System "slug" must be kebab-case, e.g. "storefront".');
  need(typeof raw.fill === 'string' && HEX_RE.test(raw.fill), line, 'System "fill" must be a colour like "#dbe4ff".');
  need(typeof raw.opacity === 'number' && raw.opacity >= 0 && raw.opacity <= 1, line, '"opacity" must be a number from 0 to 1.');
  need(typeof raw.selfReach === 'number' && raw.selfReach > 0 && raw.selfReach < 1, line, '"selfReach" must be a number between 0 and 1, e.g. 0.35.');
  // Older files list participants here; newer ones give each its own "## Participant:" section.
  const participants = raw.participants ?? [];
  need(Array.isArray(participants), line, '"participants" must be a list.');
  participants.forEach((p, k) => checkKeys(p, ['slug', 'title', 'kind', 'fill'], ['description'], line, 'Participant ' + (k + 1)));
  return { slug: raw.slug, label: raw.label, fill: raw.fill, opacity: raw.opacity, selfReach: raw.selfReach, participants, includes };
}

function readParticipant(p, line, what) {
  need(typeof p.slug === 'string' && SLUG_RE.test(p.slug), line, what + ' slug must be kebab-case, e.g. "order-service".');
  need(typeof p.title === 'string' && p.title.trim() !== '', line, what + ' needs a title.');
  need(KIND_NAMES.includes(p.kind), line, what + ' kind must be one of ' + KIND_NAMES.join(', ') + '.');
  need(typeof p.fill === 'string' && HEX_RE.test(p.fill), line, what + ' fill must be a colour like "#b2f2bb".');
  need(p.description === undefined || typeof p.description === 'string', line, what + ' description must be text.');
  return { slug: p.slug, title: p.title, kind: p.kind, fill: p.fill, description: p.description || '' };
}

function readSchemas(raw, line) {
  need(isPlainObject(raw), line, 'The schema block maps type ids to their fields, e.g. "payment-requested:".');
  const seen = new Set();
  return Object.keys(raw).map((key) => {
    const slug = typeRef(key);
    need(SLUG_RE.test(slug), line, 'Type id "' + key + '" must be kebab-case, e.g. payment-requested.');
    need(!BASE_TYPES.includes(slug), line, '"' + slug + '" is a built-in type and cannot be defined.');
    need(!seen.has(slug), line, 'Two types have the id ' + slug + '.');
    seen.add(slug);
    const v = raw[key];
    checkKeys(v, [], ['title', 'summary', 'fields'], line, 'Type ' + key);
    need(v.title === undefined || (typeof v.title === 'string' && v.title.trim() !== ''), line, 'Type ' + key + ': "title" must be text.');
    need(v.summary === undefined || typeof v.summary === 'string', line, 'Type ' + key + ': "summary" must be text.');
    const fields = v.fields ?? {};
    need(isPlainObject(fields), line, 'Type ' + key + ': "fields" maps field names to types, e.g. orderId: string.');
    return {
      slug, title: v.title ?? sentence(key), summary: v.summary ?? '',
      fields: Object.keys(fields).map((f) => {
        need(FIELD_RE.test(f), line, 'Type ' + key + ': field "' + f + '" must start with a letter and use letters, digits and _.');
        const raw2 = typeof fields[f] === 'string' ? fields[f].replace(/^([A-Za-z0-9]+)/, (n) => typeRef(n)) : null;
        const m = raw2 ? FIELD_TYPE_RE.exec(raw2) : null;
        need(m, line, 'Type ' + key + ': field ' + f + ' has type "' + fields[f] + '"; use ' + BASE_TYPES.join(', ') + ' or a type id, with [] for a list.');
        return { name: f, type: m[1], repeated: Boolean(m[2]) };
      })
    };
  });
}

function readMermaid(body, firstLine, refOf) {
  const msgs = [];
  body.split('\n').forEach((raw, k) => {
    const ln = firstLine + k;
    const t = raw.trim();
    if (t === '' || t.startsWith('%%') || t === 'sequenceDiagram' || t === 'end' || /^(par|and)(\s|$)/.test(t)) return;
    const p = /^participant\s+([A-Za-z0-9_]+)(\s+as\s+.*)?$/.exec(t);
    if (p) { need(refOf(p[1]) !== null, ln, 'Mermaid participant "' + p[1] + '" is not in the system block or an included system (ids are slugs with "-" written as "_", other systems as system__slug).'); return; }
    const m = /^([A-Za-z0-9_]+)\s*(-->>|->>|--\)|-\))\s*([A-Za-z0-9_]+)\s*:\s?(.*)$/.exec(t);
    need(m, ln, 'Unsupported Mermaid line "' + t + '". Use "from->>to: 3 · Label" (sync), "from-)to: 3 · Label" (async), "participant", or par / and / end.');
    need(refOf(m[1]) !== null, ln, '"' + m[1] + '" is not a participant here or in an included system.');
    need(refOf(m[3]) !== null, ln, '"' + m[3] + '" is not a participant here or in an included system.');
    const lab = /^(\d+)\s*·\s*(.*)$/.exec(m[4]);
    need(lab, ln, 'Messages need a step number before the label, e.g. "9 · Notify shopper".');
    msgs.push({ n: Number(lab[1]), from: refOf(m[1]), to: refOf(m[3]), label: mermaidUnescape(lab[2]).trim(), async: m[2].endsWith(')'), line: ln });
  });
  return msgs;
}

/** Parse a .flow.md document into a Model. Throws FlowParseError (with a 1-based line) on anything it can't read. */
function parse(text) {
  const lines = String(text).replace(/\r\n?/g, '\n').split('\n');
  need(lines[0] === '---', 1, 'The file must start with front matter: "---", "flows: 1", "---".');
  const fmEnd = lines.indexOf('---', 1);
  need(fmEnd > 0, 1, 'Front matter is not closed with a "---" line.');
  const fm = loadYaml(lines.slice(1, fmEnd).join('\n'), 2);
  checkKeys(fm, ['flows'], [], 2, 'Front matter');
  need(fm.flows === 1, 2, 'This version reads "flows: 1" files only.');

  let system = null;
  let schemas = null;
  const flows = [];
  let cur = null;      // flow being read: { name, slug, line, mermaid, blocks }
  let lastStep = null; // step or participant block an ```md block may attach to
  const parts = [];    // "## Participant:" sections: { title, line, p, description }
  let curPart = null;
  let i = fmEnd + 1;
  while (i < lines.length) {
    const ln = i + 1;
    const line = lines[i];
    const fence = /^(`{3,})([A-Za-z0-9_-]*)\s*$/.exec(line);
    if (fence) {
      let j = i + 1;
      while (j < lines.length && lines[j].trimEnd() !== fence[1]) j++;
      need(j < lines.length, ln, 'This code block is never closed (expected a line with ' + fence[1] + ').');
      const body = lines.slice(i + 1, j).join('\n');
      const info = fence[2];
      if (info === 'system') {
        need(system === null, ln, 'Only one system block is allowed per file.');
        need(flows.length === 0, ln, 'The system block must come before the first flow.');
        system = readSystem(loadYaml(body, ln + 1), ln);
        system.participants.forEach((p, k) => parts.push({ line: ln, p: readParticipant(p, ln, 'Participant ' + (k + 1)), description: null }));
        lastStep = null;
      } else if (info === 'participant') {
        need(curPart !== null, ln, 'A participant block must sit under a "## Participant: Title" heading.');
        need(curPart.p === null, ln, 'Participant "' + curPart.title + '" has two participant blocks.');
        const raw = loadYaml(body, ln + 1);
        checkKeys(raw, ['slug', 'kind', 'fill'], [], ln, 'The participant block');
        curPart.p = readParticipant({ ...raw, title: curPart.title }, ln, 'Participant "' + curPart.title + '"');
        lastStep = curPart;
      } else if (info === 'mermaid') {
        need(cur !== null, ln, 'A mermaid block must sit under a "## Flow: Name {#slug}" heading.');
        need(cur.mermaid === null, ln, 'Flow "' + cur.name + '" has two mermaid blocks.');
        cur.mermaid = { body, line: ln + 1 };
        lastStep = null;
      } else if (info === 'schema') {
        need(system !== null, ln, 'The schema block must come after the system block.');
        need(flows.length === 0, ln, 'The schema block must come before the first flow.');
        need(schemas === null, ln, 'Only one schema block is allowed per file.');
        schemas = readSchemas(loadYaml(body, ln + 1), ln);
        lastStep = null;
      } else if (info === 'step') {
        need(cur !== null, ln, 'A step block must sit under a "## Flow: Name {#slug}" heading.');
        const raw = loadYaml(body, ln + 1);
        checkKeys(raw, ['n'], ['chain', 'after', 'message', 'tags', 'triggers', 'data', 'result'], ln, 'The step block');
        lastStep = { raw, line: ln, description: null };
        cur.blocks.push(lastStep);
      } else if (info === 'md') {
        need(lastStep !== null, ln, 'An md description block must come straight after a step or participant block.');
        need(lastStep.description === null, ln, 'Block on line ' + lastStep.line + ' already has a description.');
        lastStep.description = body;
      } else if (info === '') {
        lastStep = null; // a plain code block in the prose
      } else {
        throw new FlowParseError(ln, '"' + info + '" blocks are not supported yet. This version reads system, participant, mermaid, schema, step and md blocks.');
      }
      i = j + 1;
      continue;
    }
    if (/^##\s+Types\s*$/.test(line)) { lastStep = null; i++; continue; }
    const pm = /^##\s+Participant:\s*(.*?)\s*$/.exec(line);
    if (pm) {
      need(pm[1] !== '', ln, 'Participant headings look like "## Participant: Order Service".');
      need(system !== null, ln, 'The system block must come before the participants.');
      need(flows.length === 0, ln, 'Participants must come before the first flow.');
      curPart = { title: pm[1], line: ln, p: null, description: null };
      parts.push(curPart);
      lastStep = null;
    } else if (/^##\s/.test(line)) {
      curPart = null;
      const m = /^##\s+Flow:\s*(.*?)\s*\{#([^}]*)\}\s*$/.exec(line);
      need(m && m[1] !== '', ln, 'Flow headings look like "## Flow: Checkout {#checkout}".');
      need(SLUG_RE.test(m[2]), ln, 'Flow id "' + m[2] + '" must be kebab-case, e.g. {#checkout}.');
      need(system !== null, ln, 'The system block must come before the first flow.');
      need(!flows.some((f) => f.slug === m[2]), ln, 'Two flows use the id "' + m[2] + '".');
      cur = { name: m[1], slug: m[2], line: ln, mermaid: null, blocks: [] };
      flows.push(cur);
      lastStep = null;
    } else if (line.trim() !== '' && !/^###\s/.test(line)) {
      lastStep = null; // prose between blocks is allowed and ignored
    }
    i++;
  }
  need(system !== null, lines.length, 'No system block found.');
  const seen = new Set();
  system.participants = parts.map((x) => {
    need(x.p !== null, x.line, 'Participant "' + x.title + '" needs a participant block with its slug, kind and fill.');
    need(!seen.has(x.p.slug), x.line, 'Two participants use the slug "' + x.p.slug + '".');
    seen.add(x.p.slug);
    return x.description === null ? x.p : { ...x.p, description: x.description };
  });
  need(flows.length > 0, lines.length, 'Add at least one flow: "## Flow: Main {#main}".');

  const idToSlug = new Map(system.participants.map((p) => [mermaidId(p.slug), p.slug]));
  const refOf = (id) => {
    if (!id.includes('__')) return idToSlug.has(id) ? idToSlug.get(id) : null;
    const [sysId, slugId] = id.split('__');
    const sys = sysId.replace(/_/g, '-'), slug = (slugId || '').replace(/_/g, '-');
    return system.includes.includes(sys) && SLUG_RE.test(slug) ? sys + '.' + slug : null;
  };
  const flowSlugs = new Set(flows.map((f) => f.slug));
  const out = flows.map((f) => {
    const msgs = f.mermaid ? readMermaid(f.mermaid.body, f.mermaid.line, refOf) : [];
    const byN = new Map();
    msgs.forEach((m) => { need(!byN.has(m.n), m.line, 'Step ' + m.n + ' appears twice in flow "' + f.name + '".'); byN.set(m.n, m); });
    const blockByN = new Map();
    f.blocks.forEach((b) => {
      need(Number.isInteger(b.raw.n) && b.raw.n > 0, b.line, '"n" must be a whole step number.');
      need(byN.has(b.raw.n), b.line, 'Step ' + b.raw.n + ' has a step block but no message line in the mermaid block.');
      need(!blockByN.has(b.raw.n), b.line, 'Step ' + b.raw.n + ' has two step blocks.');
      blockByN.set(b.raw.n, b);
    });
    const steps = [];
    msgs.slice().sort((a, b) => a.n - b.n).forEach((m) => {
      const b = blockByN.get(m.n);
      const raw = b ? b.raw : {};
      const ln = b ? b.line : m.line;
      need(!(m.from.includes('.') && m.to.includes('.') && m.from.split('.')[0] === m.to.split('.')[0]), ln, 'Both ends of step ' + m.n + ' are in ' + m.from.split('.')[0] + '; that step belongs in its own file.');
      const chain = raw.chain ?? 'A';
      need(typeof chain === 'string' && CHAIN_RE.test(chain), ln, '"chain" must be one capital letter, A–Z.');
      // No step block: the step continues chain A after the previous chain-A step.
      const after = b && 'after' in raw ? raw.after : (steps.filter((s) => s.chain === chain).pop() || { n: null }).n;
      need(after === null || (Number.isInteger(after) && steps.some((s) => s.n === after)), ln, '"after" must be null or the number of an earlier step in this flow.');
      const tags = raw.tags ?? [];
      need(Array.isArray(tags) && tags.every((t) => typeof t === 'string' && t !== ''), ln, '"tags" must be a list of words, e.g. [async, pci].');
      need(new Set(tags).size === tags.length, ln, '"tags" lists the same tag twice.');
      const message = raw.message === undefined || raw.message === null ? null : typeof raw.message === 'string' ? typeRef(raw.message) : raw.message;
      need(message === null || (typeof message === 'string' && SLUG_RE.test(message)), ln, '"message" must be a type id, e.g. payment-requested.');
      const triggers = raw.triggers ?? null;
      need(triggers === null || (typeof triggers === 'string' && (flowSlugs.has(triggers) || (triggers.includes('/') && system.includes.includes(triggers.split('/')[0])))), ln, '"triggers" must name a flow in this file (e.g. ' + [...flowSlugs][0] + ') or "<included system>/<flow>".');
      const data = raw.data ?? {};
      need(isPlainObject(data), ln, '"data" must be a mapping of field: value.');
      const result = raw.result === undefined || raw.result === null ? null : typeof raw.result === 'string' ? typeRef(raw.result) : raw.result;
      need(result === null || (typeof result === 'string' && SLUG_RE.test(result)), ln, '"result" must be a type id, e.g. payment-result.');
      steps.push({ n: m.n, from: m.from, to: m.to, label: m.label, chain, after, message, tags, triggers, data, description: b && b.description !== null ? b.description : '', result, async: m.async });
    });
    const results = steps.filter((x) => x.result && x.from === x.to && x.to === flowEntry({ steps }));
    need(results.length <= 1, f.line, 'Flow "' + f.name + '" has ' + results.length + ' self-steps on ' + flowEntry({ steps }) + ' that return a result; a flow returns one result to its callers.');
    return { slug: f.slug, name: f.name, steps };
  });
  return { system, schemas: schemas || [], flows: out };
}

/* ---------- galaxy: cross-file checks & play script ---------- */

/** Problems that only show up against other saved files: included systems that
 *  don't exist, participants or flows they no longer have. `library` maps slug → Model. */
function galaxyProblems(home, library) {
  const out = [];
  home.system.includes.forEach((sys) => { if (!library.has(sys)) out.push({ flow: null, n: null, message: 'Included system "' + sys + '" is not in your saved systems.' }); });
  home.flows.forEach((f) => f.steps.forEach((s) => {
    [s.from, s.to].filter(isExternal).forEach((r) => {
      const { system, slug } = parseRef(r);
      const m = library.get(system);
      if (m && !m.system.participants.some((p) => p.slug === slug)) out.push({ flow: f.slug, n: s.n, message: f.name + ' step ' + s.n + ': ' + system + ' has no participant "' + slug + '".' });
    });
    if (s.triggers && s.triggers.includes('/')) {
      const [system, fl] = s.triggers.split('/');
      const m = library.get(system);
      if (m && !m.flows.some((g) => g.slug === fl)) out.push({ flow: f.slug, n: s.n, message: f.name + ' step ' + s.n + ': ' + system + ' has no flow "' + fl + '".' });
    }
  }));
  return out;
}

/**
 * Everything that plays when `flowSlug` of `home` runs, with triggered flows expanded
 * in place (unless `expand` is false). A step takes one beat; a step that triggers a
 * flow is followed by that flow's steps, numbered under it (3 → 3.1, 3.2 …), and the
 * steps after it wait until the sub-flow finishes. Only systems in this galaxy expand.
 * Item: { key, depth, parent, system, flow, step, from, to, chain, start, lane, ret, async, result?, label }
 * (`ret` marks a reply n.r; `async` copies the step's flag; a sync step's followers wait for its task)
 * (from/to fully qualified "<system>.<slug>").
 */
function playScript(home, library, flowSlug, expand) {
  const homeSlug = home.system.slug;
  const visible = new Set([homeSlug, ...home.system.includes]);
  const modelOf = (sys) => (sys === homeSlug ? home : library.get(sys) || null);
  const items = [], problems = [];
  // Returns when each step of `flow` finishes (n → beat), so a caller can wait for a result.
  const run = (sys, model, flow, t0, prefix, depth, parent, stack) => {
    const ends = new Map();
    flow.steps.forEach((s) => {
      const start = s.after === null ? t0 : ends.get(s.after);
      if (start === undefined) throw new Error('bug: step ' + s.n + ' follows a later step');
      const key = prefix + s.n;
      const lane = (parent || '') + '|' + sys + '/' + flow.slug + '|' + s.chain;
      items.push({ key, depth, parent, system: sys, flow: flow.slug, step: s, from: absRef(sys, s.from), to: absRef(sys, s.to), chain: s.chain, start, lane, ret: false, async: s.async, label: s.label });
      let stepEnd = start + 1;
      let reply = null; // { at, label, step, system, flow, depth }
      if (s.triggers) {
        const [tSys, tFlow] = s.triggers.includes('/') ? s.triggers.split('/') : [sys, s.triggers];
        const tModel = modelOf(tSys);
        const target = tModel ? tModel.flows.find((g) => g.slug === tFlow) : null;
        const id = tSys + '/' + tFlow;
        if (!target) problems.push('Step ' + key + ' triggers ' + id + ', which is not in your saved systems.');
        else if (stack.includes(id)) problems.push('Step ' + key + ' triggers ' + id + ', which is already running, so it is not expanded again.');
        else {
          const R = flowResult(target);
          let at = start + 1; // collapsed: the call comes back on the next beat
          if (expand && visible.has(tSys)) {
            const subEnds = run(tSys, tModel, target, start + 1, key + '.', depth + 1, key, [...stack, id]);
            if (R) at = subEnds.get(R.n);
            // The task ends with the sub-flow's last step.
            stepEnd = Math.max(stepEnd, ...subEnds.values());
          }
          // The flow's result goes back to the caller.
          if (R) reply = { at, label: s.result || R.result, step: R, system: tSys, flow: target.slug, depth: depth + 1 };
        }
      }
      // A plain request/response: the receiver replies to the sender.
      if (!reply && s.result && s.from !== s.to) reply = { at: start + 1, label: s.result, step: s, system: sys, flow: flow.slug, depth };
      if (reply) {
        items.push({ key: key + '.r', depth: reply.depth, parent: key, system: reply.system, flow: reply.flow, step: reply.step, from: absRef(sys, s.to), to: absRef(sys, s.from), chain: s.chain, start: reply.at, lane, ret: true, async: false, result: reply.label, label: '↩ ' + reply.label });
        stepEnd = Math.max(stepEnd, reply.at + 1);
      }
      // Async: the sender carries on next beat; the task above still plays alongside.
      ends.set(s.n, s.async ? start + 1 : stepEnd);
    });
    return ends;
  };
  const f = home.flows[findFlow(home, flowSlug)];
  run(homeSlug, home, f, 0, '', 0, null, [homeSlug + '/' + flowSlug]);
  const length = items.reduce((m, it) => Math.max(m, it.start + 1), 0);
  items.sort((a, b) => a.start - b.start || a.depth - b.depth || a.key.localeCompare(b.key, undefined, { numeric: true }));
  return { items, length, problems };
}
/** Phase of each item at playhead t: before its beat 'todo', during it 'active' (p = 0–1), after it 'done'. */
function phasesAt(items, t) {
  return new Map(items.map((it) => [it.key, t < it.start ? { phase: 'todo', p: 0 } : t < it.start + 1 ? { phase: 'active', p: t - it.start } : { phase: 'done', p: 1 }]));
}

/* ---------- sample ---------- */

const S_ = (n, from, to, label, chain, after, extra) => ({ n, from, to, label, chain, after, message: null, tags: [], triggers: null, data: {}, description: '', result: null, async: false, ...(extra || {}) });
const P_ = (slug, title, kind, fill) => ({ slug, title, kind, fill, description: '' });

/** Example "Payments" and "Fulfilment" systems, offered so a galaxy has something to include. */
function exampleSystems() {
  return [
    {
      schemas: [
        { slug: 'payment-requested', title: 'Payment requested', summary: 'Ask the gateway to hold funds for an order', fields: [{ name: 'orderId', type: 'string', repeated: false }, { name: 'amount', type: 'money', repeated: false }, { name: 'captureLater', type: 'boolean', repeated: false }] },
        { slug: 'money', title: 'Money', summary: '', fields: [{ name: 'value', type: 'number', repeated: false }, { name: 'currency', type: 'string', repeated: false }] },
        { slug: 'payment-result', title: 'Payment result', summary: 'What the gateway answers its caller', fields: [{ name: 'approved', type: 'boolean', repeated: false }, { name: 'holdId', type: 'string', repeated: false }, { name: 'reason', type: 'text', repeated: false }] }
      ],
      system: {
        slug: 'payments', label: 'Payments', fill: '#e5dbff', opacity: 0.6, selfReach: 0.35, includes: [],
        participants: [P_('gateway-api', 'Gateway API', 'service', '#d0bfff'), P_('fraud-check', 'Fraud Check', 'fn', '#ffc9c9'), P_('card-network', 'Card Network', 'external', '#c3fae8'), P_('ledger', 'Ledger', 'database', '#fff3bf')]
      },
      flows: [
        {
          slug: 'authorise-payment', name: 'Authorise payment', steps: [
            S_(1, 'gateway-api', 'fraud-check', 'Score risk', 'A', null, { message: 'risk-check' }),
            S_(2, 'fraud-check', 'gateway-api', 'Risk: low', 'A', 1),
            S_(3, 'gateway-api', 'card-network', 'Authorise amount', 'A', 2, { tags: ['pci'] }),
            S_(4, 'card-network', 'gateway-api', 'Approved', 'A', 3),
            S_(5, 'gateway-api', 'ledger', 'Record hold', 'B', 4, { async: true, description: 'Fire-and-forget: the ledger records the hold while the gateway answers its caller.' }),
            S_(6, 'gateway-api', 'gateway-api', 'Build response', 'A', 4, { result: 'payment-result', description: 'The gateway answers the call that started this flow: whoever called it waits for this **payment result**.' })
          ]
        },
        { slug: 'refund', name: 'Refund', steps: [S_(1, 'gateway-api', 'card-network', 'Refund amount', 'A', null), S_(2, 'gateway-api', 'ledger', 'Record refund', 'A', 1)] }
      ]
    },
    {
      schemas: [],
      system: {
        slug: 'fulfilment', label: 'Fulfilment', fill: '#d3f9d8', opacity: 0.7, selfReach: 0.35, includes: [],
        participants: [P_('warehouse', 'Warehouse', 'database', '#b2f2bb'), P_('courier', 'Courier', 'external', '#ffd8a8'), P_('notifier', 'Notifier', 'queue', '#c3fae8')]
      },
      flows: [{
        slug: 'dispatch', name: 'Dispatch', steps: [
          S_(1, 'warehouse', 'warehouse', 'Pick and pack', 'A', null, { tags: ['self'] }),
          S_(2, 'warehouse', 'courier', 'Book collection', 'A', 1),
          S_(3, 'courier', 'warehouse', 'Collection booked', 'A', 2),
          S_(4, 'warehouse', 'notifier', 'Shipped event', 'A', 3, { message: 'order-shipped' })
        ]
      }]
    }
  ];
}

/** The sample galaxy a first-time viewer sees: Storefront, including Payments and Fulfilment. */
function sampleLibrary() {
  const storefront = {
    schemas: [
      { slug: 'checkout-submitted', title: 'Checkout submitted', summary: 'The basket the shopper confirmed', fields: [{ name: 'basketId', type: 'string', repeated: false }, { name: 'items', type: 'line-item', repeated: true }, { name: 'giftNote', type: 'text', repeated: false }] },
      { slug: 'line-item', title: 'Line item', summary: '', fields: [{ name: 'sku', type: 'string', repeated: false }, { name: 'qty', type: 'string', repeated: false }] },
      { slug: 'order-requested', title: 'Order requested', summary: '', fields: [{ name: 'orderId', type: 'string', repeated: false }, { name: 'items', type: 'line-item', repeated: true }] }
    ],
    system: {
      slug: 'storefront', label: 'Storefront', fill: '#dbe4ff', opacity: 0.55, selfReach: 0.35, includes: ['payments', 'fulfilment'],
      participants: [P_('shopper', 'Shopper', 'user', '#ffec99'), P_('web-app', 'Web App', 'service', '#a5d8ff'), P_('order-service', 'Order Service', 'service', '#b2f2bb'), P_('inventory', 'Inventory', 'database', '#ffd8a8')]
    },
    flows: [{
      slug: 'checkout', name: 'Checkout', steps: [
        S_(1, 'shopper', 'web-app', 'Place order', 'A', null, { message: 'checkout-submitted', tags: ['ui'], description: 'The shopper confirms the basket and delivery address.' }),
        S_(2, 'web-app', 'order-service', 'Create order', 'A', 1, { message: 'order-requested', tags: ['http'], data: { orderId: 'ord_1042', items: 2 } }),
        S_(3, 'order-service', 'payments.gateway-api', 'Authorise payment', 'A', 2, {
          message: 'payment-requested', tags: ['sync', 'pci'], triggers: 'payments/authorise-payment',
          data: { orderId: 'ord_1042', amount: { value: 59.98, currency: 'GBP' }, captureLater: true },
          description: 'A synchronous call: **Payments** runs its *Authorise payment* flow as 3.1–3.6 and returns a payment result (3↩). Order service waits for it before confirming.'
        }),
        S_(4, 'order-service', 'web-app', 'Order confirmed', 'A', 3, { message: 'order-confirmed', tags: ['http'] }),
        S_(5, 'order-service', 'inventory', 'Reserve stock', 'B', 2, { message: 'stock-reservation', tags: ['db'], description: 'Runs alongside payment so a failed card never blocks the warehouse.' }),
        S_(6, 'inventory', 'inventory', 'Check reorder level', 'B', 5, { tags: ['self'] }),
        S_(7, 'inventory', 'order-service', 'Stock reserved', 'B', 6, { message: 'stock-reserved' }),
        S_(8, 'order-service', 'fulfilment.warehouse', 'Ship order', 'A', 4, { async: true, triggers: 'fulfilment/dispatch', message: 'ship-order', description: 'Asynchronous (`-)` in Mermaid): order service hands the order to the warehouse and carries on; Dispatch plays alongside whatever follows.' })
      ]
    }]
  };
  return [storefront, ...exampleSystems()];
}
/** Single-system sample (kept for tests and as the first-run home). */
function sampleModel() { return sampleLibrary()[0]; }

const FlowsCore = {
  KIND_NAMES, KIND_FILLS, KIND_TITLES, UserError, FlowParseError,
  slugify, uniqueSlug, slugFollows, emptyModel, sampleModel, sampleLibrary, exampleSystems,
  parseRef, isExternal, absRef,
  BASE_TYPES, kebab, sentence, typeRef, typeTitle, typeSlugFor, followTypeSlug, defineSchema, findSchema, schemaError, addSchema, updateSchema, schemaUsage, removeSchema, typeIndex, exampleData, fillData, checkData,
  updateSystem, addParticipant, updateParticipant, swapParticipants, stepsUsing, removeParticipant,
  includeSystem, includeUsage, removeInclude, swapIncludes, renameSystemRefs, renameExternalParticipant, renameExternalFlow,
  addFlow, renameFlow, removeFlow, chainTail, nextChain, addStep, updateStep, removeStep, chainSequence, moveStep,
  systemReferences, namedFields, lineLayout, timeline, playPhases, playScript, flowEntry, flowResult, resultAfterTrigger, phasesAt, galaxyProblems, ringLayout, selfLoop, mermaidFor, serialize, parse, findFlow, findStep, participantIndex
};
if (typeof module !== 'undefined') module.exports = FlowsCore;
