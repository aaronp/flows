/* Flows UI shell — all IO lives here: DOM, pointer and keyboard input, the play clock, storage. */
'use strict';
(function main() {
const C = FlowsCore;
const SIZE = 640;          // home ring, world units
const INC_SIZE = 480;      // included rings
const FOLD_SIZE = 320;     // included rings folded down to their entry/exit participants (Flow mode)
const SLOT_SECONDS = 1.6;
const CHAINS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const chainColor = (c) => {
  const i = CHAINS.indexOf(c);
  if (i < 0) throw new Error('bug: bad chain ' + c);
  return 'var(--chain-' + (i % 5) + ')';
};
const ICONS = {
  user: 'M10 10a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM3.5 18c.8-3.6 3.4-5.5 6.5-5.5s5.7 1.9 6.5 5.5',
  phone: 'M7.5 2.5h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-5a1 1 0 0 1-1-1v-13a1 1 0 0 1 1-1zM9.25 15h1.5',
  laptop: 'M5 4.5h10a1 1 0 0 1 1 1V13H4V5.5a1 1 0 0 1 1-1zM2 13h16l-1 2.5H3z',
  tablet: 'M5 2.5h10a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-13a1 1 0 0 1 1-1zM9 15h2',
  service: 'M3 4h14v12H3zM3 8h14M6 6h1',
  database: 'M4 5c0-1.4 2.7-2.5 6-2.5s6 1.1 6 2.5-2.7 2.5-6 2.5S4 6.4 4 5zM4 5v10c0 1.4 2.7 2.5 6 2.5s6-1.1 6-2.5V5M4 10c0 1.4 2.7 2.5 6 2.5s6-1.1 6-2.5',
  queue: 'M2 6h4v8H2zM8 6h4v8H8zM14 6h4v8h-4z',
  external: 'M10 17.5a7.5 7.5 0 1 0 0-15 7.5 7.5 0 0 0 0 15zM2.5 10h15M10 2.5c2 2.2 3 4.7 3 7.5s-1 5.3-3 7.5c-2-2.2-3-4.7-3-7.5s1-5.3 3-7.5z',
  fn: 'M7 17c2 0 2.5-1.5 3-4l1.5-7c.5-2.5 1-3.5 3-3.5M6 9h7',
  timer: 'M10 17.5a6.5 6.5 0 1 0 0-13 6.5 6.5 0 0 0 0 13zM10 7.5V11l2 1.5M8 2.5h4',
  system: 'M10 17.5a7.5 7.5 0 1 0 0-15 7.5 7.5 0 0 0 0 15zM10 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
  undo: 'M7 5 3 9l4 4M3 9h9a5 5 0 0 1 0 10h-2', redo: 'm13 5 4 4-4 4M17 9H8a5 5 0 0 0 0 10h2',
  play: 'M5 3.5v13l11-6.5z', pause: 'M6 4h3v12H6zM11 4h3v12h-3z', prev: 'M5 4v12M16 4 8 10l8 6z', next: 'M15 4v12M4 4l8 6-8 6z',
  fork: 'M6 3v14M6 11a4 4 0 0 0 4 4h6M13 12l3 3-3 3', link: 'M8.5 11.5a3.5 3.5 0 0 0 5 0l2.5-2.5a3.5 3.5 0 0 0-5-5l-1 1M11.5 8.5a3.5 3.5 0 0 0-5 0L4 11a3.5 3.5 0 0 0 5 5l1-1',
  trash: 'M4 6h12M8 6V4h4v2M6 6l1 11h6l1-11M9 9v5M11 9v5',
  list: 'M8 5h9M8 10h9M8 15h9M4 5h.01M4 10h.01M4 15h.01', file: 'M5 2.5h7l3.5 3.5v11.5H5zM12 2.5V6h3.5', down: 'M10 3v10M6 9l4 4 4-4M4 17h12', up: 'M10 13V3M6 7l4-4 4 4M4 17h12',
  fit: 'M3 7V3h4M13 3h4v4M17 13v4h-4M7 17H3v-4', chevL: 'M12.5 4.5 7 10l5.5 5.5', chevR: 'M7.5 4.5 13 10l-5.5 5.5', plus: 'M10 4v12M4 10h12', minus: 'M4 10h12'
};
C.KIND_NAMES.forEach((k) => { if (!ICONS[k]) throw new Error('bug: no palette icon for kind "' + k + '"'); });
const icon = (k, fill) => {
  if (!ICONS[k]) throw new Error('bug: no icon ' + k);
  return '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="' + ICONS[k] + '" fill="' + (fill ? 'currentColor' : 'none') + '" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>';
};
const SWATCHES = [['Fog', '#e9ecef'], ['Indigo', '#dbe4ff'], ['Sky', '#d0ebff'], ['Mint', '#d3f9d8'], ['Butter', '#fff3bf'], ['Peach', '#ffe8cc'], ['Rose', '#ffe3e3'], ['Lilac', '#e5dbff']];
const NODE_FILLS = [['Butter', '#ffec99'], ['Sky', '#a5d8ff'], ['Mint', '#b2f2bb'], ['Lilac', '#d0bfff'], ['Peach', '#ffd8a8'], ['Aqua', '#c3fae8'], ['Rose', '#ffc9c9'], ['Orchid', '#eebefa'], ['Pink', '#fcc2d7'], ['Cyan', '#99e9f2'], ['Silver', '#dee2e6']];
// Every kind's default colour is offered as a swatch, so it shows as picked.
C.KIND_NAMES.forEach((k) => { if (!NODE_FILLS.some(([, c]) => c === C.KIND_FILLS[k])) throw new Error('bug: no swatch for kind "' + k + '"'); });

const $ = (id) => {
  const el = document.getElementById(id);
  if (!el) throw new Error('bug: missing #' + id);
  return el;
};
const esc = (s) => String(s).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
const f1 = (v) => v.toFixed(1);
const plural = (n, w) => n + ' ' + w + (n === 1 ? '' : 's');
/** How a play item's number is shown: a result going back to its caller ("3.r") reads "3↩". */
const dk = (it) => (it.ret ? it.parent + '↩' : it.key);

/* ---------- state ---------- */
/** Saved systems, keyed by the id they are stored under. Entry: { model | null, text, error | null, sample }. */
const library = new Map();
let model = null;           // the home system being edited (live copy of library.get(ui.homeDoc).model)
const ui = {
  homeDoc: null,            // store id the home system lives under (differs from its slug until a rename is saved)
  mode: 'flow', flow: null, sel: null, chain: 'A',
  pending: null, cursor: null, press: null, drag: null, ringDrag: null, cam: null,
  playT: 0, playing: false, speed: 1, playView: 'orbit', collapse: false, scrubbing: false, slideK: undefined,
  descPreview: false, trigAll: false, drafts: {}, confirm: null,
  fileMenu: false,
  msgOpen: true,     // step editor: the "Message & data" section is expanded
  sysDel: null,      // open "Delete system" dialog: { opener } — the element focus returns to on Cancel   // the header's File menu (New system, Open file, Download) is open
  folded: new Set(), // Flow mode: included systems shown with only the participants flows start or finish at
  flowView: 'orbit', // Flow mode canvas: 'orbit' (the system ring) or 'sequence'
  tp: null,       // open type picker: { kind: 'message' | 'result', q, hi }
  schema: null,   // open schema editor: { orig, draft, readOnly, system, error, confirmDel }
  mdOpen: false, mdText: '', mdError: null, isSample: false,
  store: { state: 'loading', msg: 'Loading…' }, savePaused: false
};
const hist = { past: [], future: [], key: null, at: 0 };

function seedSamples() {
  library.clear();
  C.sampleLibrary().forEach((m) => library.set(m.system.slug, { model: m, text: null, error: null, sample: true }));
  ui.isSample = true;
  openHome('storefront', { keepMode: true });
}

const flow = () => model.flows[C.findFlow(model, ui.flow)];
const homeSlug = () => model.system.slug;
/** Slug → Model for every saved system that reads cleanly, with the home system's live copy. */
function libModels() {
  const m = new Map();
  library.forEach((e, id) => { if (e.model && id !== ui.homeDoc) m.set(e.model.system.slug, e.model); });
  m.set(homeSlug(), model);
  return m;
}
const allTags = () => [...new Set(model.flows.flatMap((f) => f.steps.flatMap((s) => s.tags)))].sort();
const allMessages = () => [...new Set(model.flows.flatMap((f) => f.steps.flatMap((s) => [s.message, s.result]).filter(Boolean)))].sort();
const toLocal = (ref) => (ref.startsWith(homeSlug() + '.') ? ref.slice(homeSlug().length + 1) : ref);
function titleOfRef(ref) {
  const abs = C.absRef(homeSlug(), ref);
  const { system, slug } = C.parseRef(abs);
  const m = libModels().get(system);
  const p = m ? m.system.participants.find((x) => x.slug === slug) : null;
  const t = p ? p.title : slug;
  return system === homeSlug() ? t : t + ' (' + (m ? m.system.label : system) + ')';
}
const startsAt = (f) => { const first = f.steps.find((x) => x.after === null); return first ? first.from : null; };

function normaliseUi() {
  if (!model.flows.some((f) => f.slug === ui.flow)) ui.flow = model.flows[0].slug;
  const f = flow();
  const slugs = new Set(model.system.participants.map((p) => p.slug));
  if (ui.sel && ui.sel.type === 'step' && !f.steps.some((s) => s.n === ui.sel.n)) ui.sel = null;
  if (ui.sel && ui.sel.type === 'participant' && !slugs.has(ui.sel.slug)) ui.sel = null;
  if (ui.sel && ui.sel.type === 'system' && !model.system.includes.includes(ui.sel.slug)) ui.sel = null;
  if (ui.pending && ((!C.isExternal(ui.pending.from) && !slugs.has(ui.pending.from)) || (C.isExternal(ui.pending.from) && !model.system.includes.includes(C.parseRef(ui.pending.from).system)) || (ui.pending.after !== null && !f.steps.some((s) => s.n === ui.pending.after)))) ui.pending = null;
  ui.playT = Math.min(Math.max(ui.playT, 0), script().length);
}

/* ---------- commits & history ---------- */
function commit(next, opts) {
  const o = opts || {};
  if (next === model) return;
  const now = performance.now();
  if (!(o.key && o.key === hist.key && now - hist.at < 1500)) {
    hist.past.push(model);
    if (hist.past.length > 200) hist.past.shift();
  }
  hist.future = [];
  hist.key = o.key || null;
  hist.at = now;
  setHome(next);
  afterModelChange(o.skip || []);
}
/** Keep the home system's slug unique in the library, then store the live copy. */
function setHome(next) {
  let m = next;
  const taken = new Set([...library.entries()].filter(([id]) => id !== ui.homeDoc).map(([id, e]) => (e.model ? e.model.system.slug : id)));
  if (taken.has(m.system.slug)) m = C.updateSystem(m, { slug: C.uniqueSlug(m.system.slug, taken) });
  model = m;
  const e = library.get(ui.homeDoc);
  library.set(ui.homeDoc, { model: m, text: null, error: null, sample: e ? e.sample : false });
  markDirty(ui.homeDoc);
}
function afterModelChange(skip) {
  normaliseUi();
  if (!ui.mdError) ui.mdText = C.serialize(model);
  render({ skip });
}
function undo() {
  if (!hist.past.length) return;
  hist.future.push(model);
  const prev = hist.past.pop();
  hist.key = null; ui.mdError = null;
  setHome(prev);
  afterModelChange([]);
}
function redo() {
  if (!hist.future.length) return;
  hist.past.push(model);
  const next = hist.future.pop();
  hist.key = null; ui.mdError = null;
  setHome(next);
  afterModelChange([]);
}
/** Apply `fn` to every other saved system that includes the home system (renames reach across files). */
function propagateToIncluders(fn) {
  library.forEach((e, id) => {
    if (id === ui.homeDoc || !e.model || !e.model.system.includes.includes(homeSlug())) return;
    const next = fn(e.model);
    if (next !== e.model) { library.set(id, { ...e, model: next }); markDirty(id); }
  });
}
/** Run a model operation; a UserError becomes a toast, anything else is a bug and is rethrown. */
function attempt(fn) {
  try { return fn(); }
  catch (e) {
    if (e instanceof C.UserError) { toast(e.message); return undefined; }
    throw e;
  }
}

/* ---------- links: #open-<system>--<flow> ----------
 * The artifact viewer only passes a plain #name to the page (no query strings), so a
 * system/flow link is a fragment of letters, digits and dashes. Slugs never contain "--". */
const routeHash = (sys, fl) => '#open-' + sys + (fl ? '--' + fl : '');
function parseRoute(hash) {
  const m = /^#open-([a-z0-9]+(?:-[a-z0-9]+)*)(?:--([a-z0-9]+(?:-[a-z0-9]+)*))?$/.exec(hash || '');
  return m ? { system: m[1], flow: m[2] || null } : null;
}
let routeReady = false;
/** Open the system (and flow) a link names. Unknown names say so rather than guessing. */
function applyRoute(hash) {
  const r = parseRoute(hash);
  routeReady = true;
  if (!r) { syncHash(); return; }
  if (hash === currentRoute()) return; // our own address update: nothing to open
  const found = [...library.entries()].find(([id, e]) => (e.model ? e.model.system.slug : id) === r.system);
  if (!found) { toast('No saved system called "' + r.system + '".'); syncHash(); return; }
  if (found[0] !== ui.homeDoc) openHome(found[0]);
  if (r.flow) {
    if (model.flows.some((f) => f.slug === r.flow)) { ui.flow = r.flow; ui.sel = null; ui.pending = null; ui.chain = 'A'; ui.playT = 0; }
    else toast(model.system.label + ' has no flow "' + r.flow + '".');
  }
  if (r.flow && ui.mode !== 'play') ui.mode = 'flow'; // a flow link shows the flow; a system link keeps the mode
  render();
}
const currentRoute = () => routeHash(homeSlug(), ui.mode === 'flow' || ui.mode === 'play' ? ui.flow : null);
/** Keep the address in step with what is open, so it can be bookmarked and Back works. */
function syncHash() {
  if (!routeReady || !model) return;
  const h = currentRoute();
  if (location.hash === h) return;
  try { location.hash = h; } catch (e) { /* some views don't allow it; links still work */ }
}
window.addEventListener('hashchange', () => applyRoute(location.hash));
const initialHash = location.hash;

/* ---------- switching systems ---------- */
function openHome(id, opts) {
  const e = library.get(id);
  if (!e) throw new Error('bug: no saved system ' + id);
  stopPlay();
  ui.homeDoc = id;
  hist.past = []; hist.future = []; hist.key = null;
  ui.sel = null; ui.pending = null; ui.cursor = null; ui.confirm = null; ui.cam = null; ui.chain = 'A'; ui.playT = 0; ui.slideK = undefined; ui.drafts = {};
  if (!(opts && opts.keepMode)) ui.mode = 'flow';
  if (e.model) {
    model = e.model;
    ui.mdError = null; ui.savePaused = false; ui.mdText = C.serialize(model);
  } else {
    // The saved file doesn't read: show it in the Markdown pane and pause saving until it does.
    model = C.updateSystem(C.emptyModel(), { slug: id, label: id });
    ui.mdOpen = true; ui.mdText = e.text; ui.mdError = e.error; ui.savePaused = true;
  }
  ui.flow = model.flows[0].slug;
  savePointer();
}
function newSystem() {
  const taken = new Set([...library.entries()].map(([id, e]) => (e.model ? e.model.system.slug : id)));
  let label = 'New system';
  for (let i = 2; taken.has(C.slugify(label)); i++) label = 'New system ' + i;
  const m = C.updateSystem(C.emptyModel(), { label });
  library.set(m.system.slug, { model: m, text: null, error: null, sample: false });
  persistSamples();
  markDirty(m.system.slug);
  openHome(m.system.slug);
  ui.mode = 'system';
  render();
  // Ready to name: focus the centre label with its text selected, so typing replaces it.
  const input = $('sys-label');
  input.focus();
  input.select();
  toast('Created ' + label + '. Type its name, then add participants from the palette.');
}
function deleteHome() {
  const gone = ui.homeDoc, slug = homeSlug();
  library.forEach((e, id) => {
    if (id !== gone && e.model && e.model.system.includes.includes(slug)) { library.set(id, { ...e, model: C.removeInclude(e.model, slug) }); markDirty(id); }
  });
  library.delete(gone);
  dirty.delete(gone);
  if (db && !ui.isSample) db.doc('systems/' + gone).delete().catch((err) => setStore('error', 'Not deleted: ' + ((err && err.message) || err.code)));
  if (!library.size) { newSystem(); return; }
  openHome(firstId());
  render();
  toast('Deleted ' + slug + '.');
}
const firstId = () => [...library.entries()].sort((a, b) => labelOf(a).localeCompare(labelOf(b)))[0][0];
const labelOf = ([id, e]) => (e.model ? e.model.system.label : id);

/* ---------- toast ---------- */
let toastTimer = null;
function toast(msg) {
  const t = $('toast');
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.hidden = true; }, 3600);
}

/* ---------- hand-drawn primitives (seeded, so shapes don't shimmer between renders) ---------- */
function hash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
function rng(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
function rLine(x1, y1, x2, y2, r) {
  const dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy) || 1, nx = -dy / len, ny = dx / len, amp = Math.min(2.4, len * 0.02);
  const pass = () => {
    const j = () => (r() - 0.5) * amp;
    const t = 0.42 + r() * 0.16, bow = (r() - 0.5) * amp * 2.2;
    return 'M' + f1(x1 + j()) + ' ' + f1(y1 + j()) + ' Q' + f1(x1 + dx * t + nx * bow) + ' ' + f1(y1 + dy * t + ny * bow) + ' ' + f1(x2 + j()) + ' ' + f1(y2 + j());
  };
  return pass() + ' ' + pass();
}
function rEllipse(cx, cy, rx, ry, r) {
  const pass = (grow) => {
    const start = r() * Math.PI * 2, phase = r() * Math.PI * 2, over = 1.05 + r() * 0.07;
    let d = '';
    for (let i = 0; i <= 36; i++) {
      const a = start + (i / 36) * Math.PI * 2 * over, w = 1 + grow + 0.018 * Math.sin(2 * a + phase);
      d += (i ? ' L' : 'M') + f1(cx + Math.cos(a) * rx * w) + ' ' + f1(cy + Math.sin(a) * ry * w);
    }
    return d;
  };
  return pass(0) + ' ' + pass(0.014);
}
function rHead(hx, hy, ux, uy, r) {
  return [0.45, -0.45].map((a) => {
    const bx = -(ux * Math.cos(a) - uy * Math.sin(a)), by = -(ux * Math.sin(a) + uy * Math.cos(a));
    return rLine(hx + bx * 12, hy + by * 12, hx, hy, r);
  }).join(' ');
}
function rPoly(pts, px, py) {
  const pass = (k) => pts.map((q, i) => (i ? 'L' : 'M') + f1(q.x + px * k) + ' ' + f1(q.y + py * k)).join(' ');
  return pass(0) + ' ' + pass(0.9);
}

/* ---------- scene: home ring at the centre, included systems evenly around it ---------- */
/**
 * rings: { slug, model|null, cx, cy, size, home, collapsed, missing, L, ox, oy }
 * nodes: absRef → { x, y, th, nr, R, reach, collapsed, ring, p }
 * Included rings sit clockwise from 12 o'clock, like participants on a ring.
 */
/**
 * Participants of included system `sys` (model `m`) that a folded ring keeps: where its
 * flows start or finish, plus any the home system's steps already reach, so no arrow loses its end.
 */
function foldedParticipants(sys, m) {
  const keep = new Set(C.flowEndpoints(m));
  model.flows.forEach((f) => f.steps.forEach((s) => [s.from, s.to].forEach((r) => {
    if (C.isExternal(r) && C.parseRef(r).system === sys) keep.add(C.parseRef(r).slug);
  })));
  return m.system.participants.filter((p) => keep.has(p.slug));
}
/** fold: Set of included system slugs to draw folded (Flow mode); other modes pass an empty set. */
function buildScene(withIncludes, collapse, fold) {
  if (!(fold instanceof Set)) throw new Error('bug: buildScene needs a fold set');
  const rings = [{ slug: homeSlug(), model, cx: 0, cy: 0, size: SIZE, home: true, collapsed: false, missing: false, folded: false }];
  if (withIncludes) {
    const inc = model.system.includes, k = inc.length;
    const lib = libModels();
    inc.forEach((slug, i) => {
      const a = -Math.PI / 2 + (i * 2 * Math.PI) / k;
      const m = lib.get(slug) || null;
      const folded = Boolean(m) && !collapse && fold.has(slug);
      const size = folded ? FOLD_SIZE : INC_SIZE, G = SIZE / 2 + size / 2 + 90;
      const drag = ui.ringDrag && ui.ringDrag.slug === slug;
      rings.push({ slug, model: m, cx: drag ? ui.ringDrag.x : G * Math.cos(a), cy: drag ? ui.ringDrag.y : G * Math.sin(a), slotX: G * Math.cos(a), slotY: G * Math.sin(a), size, home: false, collapsed: collapse || !m, missing: !m, folded });
    });
  }
  const nodes = new Map();
  rings.forEach((r) => {
    const parts = !r.model ? [] : r.folded ? foldedParticipants(r.slug, r.model) : r.model.system.participants;
    r.shown = parts.length;
    // A folded ring gathers its participants on the side facing the home system.
    const L = r.folded ? C.arcLayout(parts.length, r.size, Math.atan2(-r.cy, -r.cx), 0.75) : C.ringLayout(parts.length, r.size);
    r.L = L; r.ox = r.cx - r.size / 2; r.oy = r.cy - r.size / 2;
    r.starters = new Set(r.model ? r.model.flows.map(C.flowEntry).filter(Boolean) : []);
    parts.forEach((p, i) => {
      const ref = r.slug + '.' + p.slug;
      if (r.collapsed) nodes.set(ref, { x: r.cx, y: r.cy, th: 0, nr: L.R, collapsed: true, ring: r, p });
      else nodes.set(ref, { x: r.ox + L.pos[i].x, y: r.oy + L.pos[i].y, th: L.pos[i].th, nr: L.nr, R: L.R, reach: r.model.system.selfReach, collapsed: false, ring: r, p });
    });
  });
  return { rings, nodes };
}
function sceneBounds(scene) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  scene.rings.forEach((r) => {
    const cx = r.slotX !== undefined ? r.slotX : r.cx, cy = r.slotY !== undefined ? r.slotY : r.cy;
    x0 = Math.min(x0, cx - r.size / 2 - 130); x1 = Math.max(x1, cx + r.size / 2 + 130);
    y0 = Math.min(y0, cy - r.size / 2 - 24); y1 = Math.max(y1, cy + r.size / 2 + 24);
  });
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

/** Arrow geometry for each item ({key, from, to, chain} with fully qualified refs). Items whose ends aren't on the canvas are skipped. */
function arrowGeometry(scene, items) {
  const pk = (it) => [it.from, it.to].sort().join('|');
  const count = {}, seen = {};
  items.forEach((it) => { if (it.from !== it.to) count[pk(it)] = (count[pk(it)] || 0) + 1; });
  const out = [];
  items.forEach((it) => {
    const A = scene.nodes.get(it.from), B = scene.nodes.get(it.to);
    if (!A || !B) return;
    const r = rng(hash('a' + it.key + it.from + it.to));
    if (it.from === it.to) {
      if (A.collapsed) return;
      const loop = C.selfLoop(A, A.nr, A.R, A.reach);
      const pts = loop.pts, end = pts[pts.length - 1], prev = pts[pts.length - 4];
      const hl = Math.hypot(end.x - prev.x, end.y - prev.y);
      const ux = -Math.cos(A.th), uy = -Math.sin(A.th);
      out.push({ it, d: rPoly(pts, -uy, ux) + ' ' + rHead(end.x, end.y, (end.x - prev.x) / hl, (end.y - prev.y) / hl, r), hit: 'M' + pts.map((q) => f1(q.x) + ' ' + f1(q.y)).join(' L'), pts, mid: loop.apex });
      return;
    }
    const k = pk(it);
    seen[k] = (seen[k] === undefined ? -1 : seen[k]) + 1;
    const [lo, hi] = it.from < it.to ? [A, B] : [B, A];
    const len = Math.hypot(hi.x - lo.x, hi.y - lo.y) || 1, nx = -(hi.y - lo.y) / len, ny = (hi.x - lo.x) / len;
    const off = (seen[k] - (count[k] - 1) / 2) * 18;
    const ux = (B.x - A.x) / len, uy = (B.y - A.y) / len;
    const x1 = A.x + ux * (A.nr + 6) + nx * off, y1 = A.y + uy * (A.nr + 6) + ny * off;
    const x2 = B.x - ux * (B.nr + 10) + nx * off, y2 = B.y - uy * (B.nr + 10) + ny * off;
    out.push({ it, d: rLine(x1, y1, x2, y2, r) + ' ' + rHead(x2, y2, ux, uy, r), hit: 'M' + f1(x1) + ' ' + f1(y1) + ' L' + f1(x2) + ' ' + f1(y2), pts: [{ x: x1, y: y1 }, { x: x2, y: y2 }], mid: { x: (x1 + x2) / 2, y: (y1 + y2) / 2 } });
  });
  return out;
}
function along(pts, t) {
  if (pts.length === 2) return { x: pts[0].x + (pts[1].x - pts[0].x) * t, y: pts[0].y + (pts[1].y - pts[0].y) * t };
  return pts[Math.min(pts.length - 1, Math.round(t * (pts.length - 1)))];
}

/**
 * opts: items, stateOf(key) → 'normal'|'sel'|'active'|'dim', labels(key), dots [{key,p}],
 * selectedNode(ref), selectedRing(slug), pending {from, next}, cursor, drag {ref,x,y,target},
 * nodeHits, ringHits, badgeAct ('fork'|'jump'), sublabel(ring)
 */
function sceneSvg(scene, opts) {
  const o = [];
  const items = opts.items || [];
  const stateOf = opts.stateOf || (() => 'normal');
  scene.rings.forEach((r) => {
    const k = r.size / SIZE;
    const R = r.L.R;
    const sys = r.model ? r.model.system : null;
    const fill = sys ? sys.fill : '#e9ecef', op = sys ? sys.opacity : 0.4;
    o.push('<circle cx="' + f1(r.cx) + '" cy="' + f1(r.cy) + '" r="' + f1(R) + '" style="fill:' + fill + ';fill-opacity:calc(var(--disc-k) * ' + op + ')"/>');
    o.push('<path class="disc-line' + (r.collapsed ? ' collapsed' : '') + (opts.selectedRing && opts.selectedRing(r.slug) ? ' ring-sel' : '') + '" d="' + rEllipse(r.cx, r.cy, R, R, rng(hash('disc' + r.slug))) + '"/>');
    if (opts.ringHits && !r.home) o.push('<circle class="ring-hit" data-ring="' + esc(r.slug) + '" cx="' + f1(r.cx) + '" cy="' + f1(r.cy) + '" r="' + f1(R + r.L.nr) + '"/>');
    const big = r.collapsed ? 1.6 : 1;
    const centre = '<text class="centre" style="font-size:' + f1(32 * k * big) + 'px" x="' + f1(r.cx) + '" y="' + f1(r.cy - 4 * k) + '" text-anchor="middle">' + esc(sys ? sys.label : r.slug) + '</text>';
    o.push(!r.home && sys ? '<a class="ring-link" href="' + routeHash(r.slug, null) + '" aria-label="Open ' + esc(sys.label) + '">' + centre + '</a>' : centre);
    const sub = r.missing ? 'not in your saved systems' : r.collapsed ? plural(sys.participants.length, 'participant') + ' · collapsed' : r.folded ? r.shown + ' of ' + plural(sys.participants.length, 'participant') : opts.sublabel ? opts.sublabel(r) : '';
    o.push('<text class="centre-sub" style="font-size:' + f1(Math.max(11, 12 * k * big)) + 'px" x="' + f1(r.cx) + '" y="' + f1(r.cy + 20 * k * big) + '" text-anchor="middle">' + esc(sub) + '</text>');
    if (opts.foldToggles && !r.home && sys) {
      // Expand / collapse this system: a small button on the ring's rim, top right.
      const bx = r.cx + R * Math.SQRT1_2 + 10, by = r.cy - R * Math.SQRT1_2 - 10;
      o.push('<g class="fold-btn" data-act="fold" data-v="' + esc(r.slug) + '" role="button" tabindex="0" aria-pressed="' + !r.folded + '" aria-label="' + (r.folded ? 'Expand ' : 'Collapse ') + esc(sys.label) + '"><title>' + (r.folded ? 'Show all of ' : 'Show only where flows start or finish in ') + esc(sys.label) + '</title>'
        + '<circle cx="' + f1(bx) + '" cy="' + f1(by) + '" r="20"/><path d="M' + f1(bx - 8) + ' ' + f1(by) + 'h16' + (r.folded ? 'M' + f1(bx) + ' ' + f1(by - 8) + 'v16' : '') + '"/></g>');
    }
    if (r.home && !sys.participants.length) o.push('<text class="empty-tx" x="0" y="48" text-anchor="middle">Add participants from the palette</text>');
  });
  const geo = arrowGeometry(scene, items);
  geo.forEach((g) => {
    const st = stateOf(g.it.key);
    o.push('<g data-step="' + esc(g.it.key) + '"><path class="hit" d="' + g.hit + '"/><path class="arrow ' + (st === 'normal' ? '' : st) + (g.it.ret ? ' ret' : g.it.depth ? ' sub' : '') + '" style="stroke:' + chainColor(g.it.chain) + '" d="' + g.d + '"/></g>');
  });
  if (opts.labels) {
    geo.filter((g) => opts.labels(g.it.key)).forEach((g) => {
      const text = dk(g.it) + ' · ' + (g.it.label || '(no label)');
      const w = text.length * 7.6 + 12;
      o.push('<rect class="alabel-bg" x="' + f1(g.mid.x - w / 2) + '" y="' + f1(g.mid.y - 11) + '" width="' + f1(w) + '" height="22" rx="6"/>');
      o.push('<text class="alabel" x="' + f1(g.mid.x) + '" y="' + f1(g.mid.y + 5) + '" text-anchor="middle">' + esc(text) + '</text>');
    });
  }
  const drag = opts.drag;
  if (drag) {
    const from = scene.nodes.get(drag.ref);
    o.push('<path class="ghost" d="' + rEllipse(from.x, from.y, from.nr, from.nr, rng(7)) + '"/>');
    if (drag.target) { const t = scene.nodes.get(drag.target); o.push('<path class="target" d="' + rEllipse(t.x, t.y, t.nr + 8, t.nr + 8, rng(8)) + '"/>'); }
  }
  if (ui.ringDrag && ui.ringDrag.target) {
    const t = scene.rings.find((r) => r.slug === ui.ringDrag.target);
    o.push('<path class="target" d="' + rEllipse(t.slotX, t.slotY, t.L.R + 14, t.L.R + 14, rng(8)) + '"/>');
  }
  // participants (dragged one last so it draws on top)
  const nodeList = [...scene.nodes.entries()].filter(([, n]) => !n.collapsed);
  nodeList.sort((a, b) => (drag && a[0] === drag.ref ? 1 : 0) - (drag && b[0] === drag.ref ? 1 : 0));
  nodeList.forEach(([ref, n]) => {
    const q = drag && drag.ref === ref ? { x: drag.x, y: drag.y } : n;
    const r = rng(hash('n' + ref));
    const sel = opts.selectedNode && opts.selectedNode(ref);
    const sc = (n.nr * 1.05) / 20;
    const idle = opts.shadeIdle && !n.ring.home && !n.ring.starters.has(n.p.slug);
    o.push('<g class="' + (opts.nodeHits ? '' : 'nofx') + (idle ? ' shaded' : '') + '"' + (opts.nodeHits ? ' data-node="' + esc(ref) + '" role="button" aria-label="' + esc(n.p.title) + (idle ? ', starts no flow' : '') + '"' : '') + '>');
    if (opts.nodeHits) o.push('<circle class="hitc" cx="' + f1(q.x) + '" cy="' + f1(q.y) + '" r="' + f1(n.nr + 6) + '"/>');
    o.push('<circle cx="' + f1(q.x) + '" cy="' + f1(q.y) + '" r="' + f1(n.nr) + '" style="fill:' + n.p.fill + '"/>');
    o.push('<path class="nline' + (sel ? ' sel' : '') + '" d="' + rEllipse(q.x, q.y, n.nr, n.nr, r) + (n.p.kind === 'system' ? ' ' + rEllipse(q.x, q.y, n.nr + 5, n.nr + 5, r) : '') + '"/>');
    o.push('<path class="kind-ic" vector-effect="non-scaling-stroke" transform="translate(' + f1(q.x - 10 * sc) + ' ' + f1(q.y - 10 * sc) + ') scale(' + sc.toFixed(3) + ')" d="' + ICONS[n.p.kind] + '"/>');
    o.push('</g>');
  });
  // badges at the receiving participant, fanned out away from its ring's centre
  const byNode = new Map();
  items.forEach((it) => { const n = scene.nodes.get(it.to); if (n && !n.collapsed) { if (!byNode.has(it.to)) byNode.set(it.to, []); byNode.get(it.to).push(it); } });
  byNode.forEach((list, ref) => {
    const q = scene.nodes.get(ref), dist = q.nr + 18;
    let acc = -(list.reduce((s, it) => s + 14 + dk(it).length * 7, 0) + (list.length - 1) * 5) / 2;
    list.forEach((it) => {
      const w = 14 + dk(it).length * 7;
      const a = q.th + (acc + w / 2) / dist;
      acc += w + 5;
      const x = q.x + Math.cos(a) * dist, y = q.y + Math.sin(a) * dist;
      const st = stateOf(it.key);
      const act = opts.badgeAct === 'fork' && !it.depth ? 'fork a new chain from here' : 'jump here';
      o.push('<g class="badge ' + (st === 'sel' || st === 'active' ? 'sel' : st === 'dim' ? 'dim' : '') + '" data-badge="' + esc(it.key) + '" role="button" aria-label="Step ' + esc(it.key) + ': ' + act + '" transform="translate(' + f1(x) + ' ' + f1(y) + ')">');
      o.push('<rect class="badge-bg" x="' + f1(-w / 2) + '" y="-11" width="' + w + '" height="22" rx="11" style="fill:' + chainColor(it.chain) + '"/>');
      o.push('<text class="badge-tx" x="0" y="4" text-anchor="middle">' + esc(dk(it)) + '</text></g>');
    });
  });
  // participant labels, pushed out past the badges
  nodeList.forEach(([ref, n]) => {
    const k = n.ring.size / SIZE;
    const gap = byNode.has(ref) ? n.nr + 38 : n.nr + 14;
    const x = n.x + Math.cos(n.th) * gap, y = n.y + Math.sin(n.th) * gap;
    const cs = Math.cos(n.th), sn = Math.sin(n.th);
    const anchor = cs > 0.35 ? 'start' : cs < -0.35 ? 'end' : 'middle';
    const dy = Math.abs(cs) > 0.35 ? 0 : sn < 0 ? -14 * k : 14 * k;
    const idleLabel = opts.shadeIdle && !n.ring.home && !n.ring.starters.has(n.p.slug) ? ' shaded' : '';
    o.push('<text class="ptitle' + idleLabel + '" style="font-size:19px" x="' + f1(x) + '" y="' + f1(y + dy) + '" text-anchor="' + anchor + '">' + esc(n.p.title) + '</text>');
    o.push('<text class="pslug' + idleLabel + '" x="' + f1(x) + '" y="' + f1(y + dy + 14) + '" text-anchor="' + anchor + '">' + esc(ref.startsWith(homeSlug() + '.') ? n.p.slug : ref) + '</text>');
  });
  (opts.dots || []).forEach((dt) => {
    const g = geo.find((x) => x.it.key === dt.key);
    if (!g) return; // its ends aren't on this canvas (e.g. a system outside the galaxy)
    const q = along(g.pts, dt.p);
    o.push('<circle class="dot-halo" cx="' + f1(q.x) + '" cy="' + f1(q.y) + '" r="13"/><circle class="dot" cx="' + f1(q.x) + '" cy="' + f1(q.y) + '" r="7"/>');
  });
  if (opts.pending) {
    const A = scene.nodes.get(opts.pending.from);
    if (!A) throw new Error('bug: pending from a node that is not drawn');
    if (opts.cursor) {
      const cur = opts.cursor, len = Math.hypot(cur.x - A.x, cur.y - A.y);
      if (len > A.nr + 8) o.push('<path class="pending" d="' + rLine(A.x + ((cur.x - A.x) / len) * (A.nr + 6), A.y + ((cur.y - A.y) / len) * (A.nr + 6), cur.x, cur.y, rng(3)) + '"/>');
      o.push('<text class="pending-tx" x="' + f1(cur.x + 14) + '" y="' + f1(cur.y + 26) + '">→ step ' + opts.pending.next + '</text>');
    } else o.push('<path class="target" d="' + rEllipse(A.x, A.y, A.nr + 8, A.nr + 8, rng(9)) + '"/>');
  }
  const vb = ui.cam || sceneBounds(scene);
  return '<svg class="orbit" id="orbit" viewBox="' + [vb.x, vb.y, vb.w, vb.h].map(f1).join(' ') + '" role="img" aria-label="' + (scene.rings.length > 1 ? 'Galaxy' : 'System ring') + '">' + o.join('') + '</svg>';
}

/* ---------- play script (memoised per model / flow / collapse) ---------- */
let scriptCache = { key: null, value: null };
function script() {
  const lib = libModels();
  const key = [model, ui.flow, ui.collapse, ...[...lib.values()]];
  if (scriptCache.key && scriptCache.key.length === key.length && scriptCache.key.every((x, i) => x === key[i])) return scriptCache.value;
  const s = C.playScript(model, lib, ui.flow, !ui.collapse);
  scriptCache = { key, value: { ...s, items: titledReturns(s.items, lib) } };
  return scriptCache.value;
}
/** Return items read as their type's title, e.g. "↩ Payment result". */
function titledReturns(items, lib) {
  const idx = C.typeIndex(model, lib);
  return items.map((it) => (it.ret ? { ...it, label: '↩ ' + C.typeTitle(idx, it.result) } : it));
}
/** This flow's own steps with their replies (n↩), sub-flows collapsed: what the editing sequence view draws. */
function flowSeqItems(f) {
  const lib = libModels();
  return titledReturns(C.playScript(model, lib, f.slug, false).items, lib);
}
const homeItems = (f) => f.steps.map((s) => ({ key: String(s.n), n: s.n, depth: 0, from: C.absRef(homeSlug(), s.from), to: C.absRef(homeSlug(), s.to), chain: s.chain, label: s.label, step: s }));

/* ---------- sequence view ---------- */
/** opts.editable: every participant of this system gets a lane, headings are clickable, opts.pendingFrom is marked. */
function seqSvg(items, stateOf, compact, opts) {
  const so = opts || {};
  const lib = libModels();
  // Participants that take part (all of this system's when editing), home ones in ring order first, then other systems' in order of appearance.
  const used = new Set(items.flatMap((it) => [it.from, it.to]));
  const lanes = model.system.participants.map((p) => homeSlug() + '.' + p.slug).filter((r) => so.editable || used.has(r));
  items.forEach((it) => [it.from, it.to].forEach((r) => { if (!lanes.includes(r)) lanes.push(r); }));
  if (!lanes.length) return '<p class="hint">Add participants first.</p>';
  const info = (ref) => {
    const { system, slug } = C.parseRef(ref);
    const m = lib.get(system);
    const p = m ? m.system.participants.find((x) => x.slug === slug) : null;
    return { title: p ? p.title : slug, fill: p ? p.fill : '#e9ecef', system: system === homeSlug() ? null : (m ? m.system.label : system) };
  };
  const colW = compact ? 132 : 170, padL = compact ? 96 : 120, rowH = compact ? 40 : 48;
  const W = padL * 2 + Math.max(0, lanes.length - 1) * colW, H = 104 + items.length * rowH + 40;
  const xs = new Map(lanes.map((r, i) => [r, padL + i * colW]));
  const o = [];
  lanes.forEach((ref) => {
    const x = xs.get(ref), r = rng(hash('l' + ref)), p = info(ref), bw = Math.min(colW - 14, 150);
    o.push('<path class="life" d="' + rLine(x, 70, x, H - 12, r) + '"/>');
    if (so.editable) o.push('<g data-node="' + esc(ref) + '" role="button" aria-label="' + esc(p.title) + '" style="cursor:pointer">');
    if (p.system) o.push('<text class="sys-tx" x="' + x + '" y="10" text-anchor="middle">' + esc(p.system) + '</text>');
    if (so.pendingFrom === ref) o.push('<rect x="' + f1(x - bw / 2 - 6) + '" y="10" width="' + (bw + 12) + '" height="60" rx="14" class="seq-pending"/>');
    o.push('<rect x="' + f1(x - bw / 2) + '" y="16" width="' + bw + '" height="48" rx="10" style="fill:' + p.fill + '"/>');
    o.push('<path class="nline" d="' + rLine(x - bw / 2, 16, x + bw / 2, 16, r) + rLine(x + bw / 2, 16, x + bw / 2, 64, r) + rLine(x + bw / 2, 64, x - bw / 2, 64, r) + rLine(x - bw / 2, 64, x - bw / 2, 16, r) + '"' + (p.system ? ' style="stroke-dasharray:6 5"' : '') + '/>');
    o.push('<text class="head-tx" x="' + x + '" y="40" text-anchor="middle">' + esc(p.title.length > 18 ? p.title.slice(0, 17) + '…' : p.title) + '</text>');
    o.push('<text class="head-slug" x="' + x + '" y="56" text-anchor="middle">' + esc(C.parseRef(ref).slug) + '</text>');
    if (so.editable) o.push('</g>');
  });
  const last = padL + (lanes.length - 1) * colW;
  o.push(activations(items, xs, (k) => 112 + k * rowH));
  items.forEach((it, k) => {
    const y = 112 + k * rowH, st = stateOf(it.key), r = rng(hash('q' + it.key + it.from + it.to));
    const stroke = st === 'dim' ? 'var(--dim)' : st === 'sel' || st === 'active' ? 'var(--accent)' : chainColor(it.chain);
    const sw = st === 'sel' || st === 'active' ? 3 : 1.7;
    const x1 = xs.get(it.from), x2 = xs.get(it.to);
    let d, lx, anchor, head;
    if (it.from === it.to) {
      const side = x1 === last ? -1 : 1, lw = 40, top = y - 12, bot = y + 10;
      d = rLine(x1 + side * 4, top, x1 + side * lw, top, r) + rLine(x1 + side * lw, top, x1 + side * lw, bot, r) + rLine(x1 + side * lw, bot, x1 + side * 3, bot, r);
      head = [[x1 + side * 14, bot - 6], [x1 + side * 3, bot], [x1 + side * 14, bot + 6]];
      lx = x1 + side * (lw + 8); anchor = side > 0 ? 'start' : 'end';
    } else {
      const dir = Math.sign(x2 - x1);
      d = rLine(x1 + dir * 4, y, x2 - dir * 3, y, r);
      head = [[x2 - dir * 13, y - 6], [x2 - dir * 2, y], [x2 - dir * 13, y + 6]];
      lx = (x1 + x2) / 2; anchor = 'middle';
    }
    const collapsedTrigger = ui.collapse && it.step.triggers ? '  ▸ ' + it.step.triggers : '';
    o.push('<g data-step="' + esc(it.key) + '" style="cursor:pointer"><path d="' + d + '" fill="none" stroke-linecap="round" style="stroke:' + stroke + ';stroke-width:' + sw + (it.ret ? ';stroke-dasharray:2 5' : it.depth ? ';stroke-dasharray:7 5' : '') + '"/>');
    // Mermaid style: a sync call ("->>") has a filled head; async ("-)") and replies an open one.
    const [h1, h2, h3] = head;
    o.push(it.async || it.ret
      ? '<path d="' + rLine(h1[0], h1[1], h2[0], h2[1], r) + rLine(h3[0], h3[1], h2[0], h2[1], r) + '" fill="none" stroke-linecap="round" style="stroke:' + stroke + ';stroke-width:' + sw + '"/>'
      : '<path d="M' + f1(h1[0]) + ' ' + f1(h1[1]) + 'L' + f1(h2[0]) + ' ' + f1(h2[1]) + 'L' + f1(h3[0]) + ' ' + f1(h3[1]) + 'Z" stroke-linejoin="round" style="fill:' + stroke + ';stroke:' + stroke + ';stroke-width:1"/>');
    o.push('<text class="lbl-tx" x="' + f1(lx) + '" y="' + f1(it.from === it.to ? y + 5 : y - 8) + '" text-anchor="' + anchor + '" style="' + (st === 'dim' ? 'fill:var(--muted)' : st === 'sel' || st === 'active' ? 'fill:var(--accent-ink);font-weight:700' : '') + '">' + esc(dk(it) + ' · ' + ((it.ret ? it.label.replace(/^↩ /, '') : it.label) || '(no label)') + collapsedTrigger) + '</text></g>');
    o.push('<text class="chain-tx" x="' + (8 + it.depth * 10) + '" y="' + f1(y + 4) + '" style="fill:' + chainColor(it.chain) + '">' + (it.depth ? '↳' : '') + it.chain + '</text>');
  });
  const size = compact ? 'style="width:max(100%, ' + Math.round(W * 0.8) + 'px);max-width:' + W + 'px;height:auto"' : 'width="' + W + '" height="' + H + '" style="max-width:none"';
  return '<div class="seqwrap"><svg class="seq" viewBox="0 0 ' + W + ' ' + H + '" ' + size + ' role="img" aria-label="Sequence diagram">' + o.join('') + '</svg></div>';
}

/**
 * Activation boxes (Mermaid's activate/deactivate): while a step's task runs — its
 * sub-flow and any reply, i.e. the items keyed under it — the receiver is busy, so a
 * box covers its lifeline from the arriving arrow to the last of those items. Nested
 * tasks on the same lifeline step right. Sync boxes are solid, async ones dashed.
 * Steps with nothing under them get no box.
 */
function activations(items, xs, rowY) {
  const row = new Map(items.map((it, k) => [it.key, k]));
  const boxes = items.filter((it) => !it.ret).map((it) => {
    const under = items.filter((x) => x.key.startsWith(it.key + '.'));
    const top = rowY(row.get(it.key));
    // A collapsed sub-flow with no reply still gets a short box: the receiver starts a task.
    if (!under.length) return it.step.triggers ? { it, lane: it.to, top, bot: top + 10 } : null;
    return { it, lane: it.to, top, bot: Math.max(...under.map((x) => rowY(row.get(x.key)))) };
  }).filter(Boolean);
  return boxes.map((b) => {
    const level = boxes.filter((o) => o !== b && o.lane === b.lane && b.it.key.startsWith(o.it.key + '.')).length;
    const x = xs.get(b.lane);
    if (x === undefined) throw new Error('bug: activation on a lane that is not drawn');
    const r = rng(hash('act' + b.it.key)), bx = x - 6 + level * 6, y0 = b.top - 2, y1 = b.bot + 8;
    return '<path class="act' + (b.it.async ? ' async' : '') + '" data-act-for="' + esc(b.it.key) + '" d="M' + f1(bx) + ' ' + f1(y0) + 'h12v' + f1(y1 - y0) + 'h-12Z"/>'
      + '<path class="act-line" d="' + rLine(bx, y0, bx + 12, y0, r) + rLine(bx + 12, y0, bx + 12, y1, r) + rLine(bx + 12, y1, bx, y1, r) + rLine(bx, y1, bx, y0, r) + '" style="stroke:' + chainColor(b.it.chain) + (b.it.async ? ';stroke-dasharray:4 4' : '') + '"/>';
  }).join('');
}

/* ---------- markdown rendering ---------- */
function md(text) {
  if (!text) return '<p class="hint">No description.</p>';
  return DOMPurify.sanitize(marked.parse(text, { mangle: false, headerIds: false }));
}

/* ---------- render: header ---------- */
function renderHeader() {
  const st = ui.store;
  const cls = st.state === 'saved' ? 'ok' : st.state === 'error' || st.state === 'paused' || st.state === 'none' ? 'bad' : '';
  const entries = [...library.entries()].sort((a, b) => labelOf(a).localeCompare(labelOf(b)));
  $('top').innerHTML =
    '<div class="brand"><svg width="28" height="28" viewBox="0 0 28 28" aria-hidden="true"><circle cx="14" cy="14" r="9" fill="#dbe4ff" stroke="#1e1e1e" stroke-width="1.6"/><circle cx="14" cy="5" r="3.2" fill="#ffec99" stroke="#1e1e1e" stroke-width="1.4"/><circle cx="22" cy="18" r="3.2" fill="#b2f2bb" stroke="#1e1e1e" stroke-width="1.4"/><circle cx="6" cy="18" r="3.2" fill="#d0bfff" stroke="#1e1e1e" stroke-width="1.4"/></svg>Flows</div>'
    + '<div class="row"><label for="sys-pick" class="lbl" style="position:absolute;left:-9999px">System</label><select class="field" id="sys-pick" style="width:auto;min-height:36px;font-weight:800">'
    + entries.map(([id, e]) => '<option value="' + esc(id) + '"' + (id === ui.homeDoc ? ' selected' : '') + '>' + esc(e.model ? e.model.system.label : id) + (e.model ? '' : ' (has errors)') + '</option>').join('')
    + '</select>' + (ui.isSample ? '<span class="chip">Sample</span>' : '') + '</div>'
    + '<div class="seg" role="group" aria-label="Mode">'
    + ['system', 'flow', 'galaxy', 'play'].map((m) => '<button type="button" data-act="mode" data-v="' + m + '" aria-pressed="' + (ui.mode === m) + '">' + m[0].toUpperCase() + m.slice(1) + '</button>').join('')
    + '</div><div class="spacer"></div>'
    + '<span class="status ' + cls + '" title="' + esc(st.msg) + '"><span class="dot"></span>' + esc(st.msg) + '</span>'
    + '<div class="row">'
    + '<button type="button" class="btn icon" data-act="undo" aria-label="Undo" ' + (hist.past.length ? '' : 'disabled') + '>' + icon('undo') + '</button>'
    + '<button type="button" class="btn icon" data-act="redo" aria-label="Redo" ' + (hist.future.length ? '' : 'disabled') + '>' + icon('redo') + '</button>'
    + '<button type="button" class="btn" data-act="md" aria-pressed="' + ui.mdOpen + '">' + icon('file') + 'Markdown</button>'
    + '<div class="menuwrap" id="file-menu-wrap"><button type="button" class="btn" id="file-menu-btn" data-act="file-menu" aria-haspopup="menu" aria-expanded="' + ui.fileMenu + '" aria-controls="file-menu">File <span aria-hidden="true" class="caret">▾</span></button>'
    + (ui.fileMenu ? '<div class="menu" id="file-menu" role="menu" aria-labelledby="file-menu-btn">'
      + [['new-sys', 'plus', 'New system'], ['load', 'up', 'Open file…'], ['download', 'down', 'Download Markdown'], ['sys-del', 'trash', 'Delete system…']].map(([a, ic, n]) => (a === 'sys-del' ? '<hr role="separator">' : '') + '<button type="button" role="menuitem" tabindex="-1" data-act="' + a + '"' + (a === 'sys-del' ? ' class="danger"' : '') + '>' + icon(ic) + n + '</button>').join('')
      + '</div>' : '')
    + '</div></div>';
  const b = $('banner');
  b.innerHTML = ui.savePaused ? '<div class="banner">This system\'s saved file has an error, so saving is paused. Fix it in the Markdown pane and saving resumes.</div>' : '';
}

/* ---------- render: left ---------- */
function problemsHtml() {
  const probs = C.galaxyProblems(model, libModels()).map((p) => p.message);
  if (ui.mode === 'play') script().problems.forEach((p) => probs.push(p));
  if (!probs.length) return '';
  return '<section class="sec"><h2 class="lbl" style="color:var(--err-ink)">Needs fixing</h2><ul class="list">' + probs.map((p) => '<li class="err" style="font-weight:600">' + esc(p) + '</li>').join('') + '</ul></section>';
}
function renderLeft() {
  const el = $('left');
  if (ui.mode === 'system') {
    const s = model.system;
    el.innerHTML =
      '<section class="sec"><h2 class="lbl">Palette</h2><div class="palette">'
      + C.KIND_NAMES.map((k) => '<button type="button" class="btn" data-act="add-part" data-v="' + k + '"><span class="kicon" style="background:' + C.KIND_FILLS[k] + '">' + icon(k) + '</span>' + C.KIND_TITLES[k] + '</button>').join('')
      + '</div><p class="hint">Adds a participant to the ring. Drag one participant onto another to swap places.</p></section>'
      + '<section class="sec"><h2 class="lbl">System</h2>'
      + '<label class="f">Centre label<input class="field" id="sys-label" value="' + esc(s.label) + '"></label>'
      + '<label class="f">Slug<input class="field mono" id="sys-slug" value="' + esc(s.slug) + '"></label>'
      + '<div class="f"><span>Fill</span><div class="swatches">' + SWATCHES.map(([n, c]) => '<button type="button" class="swatch" data-act="sys-fill" data-v="' + c + '" aria-label="' + n + '" aria-pressed="' + (s.fill === c) + '" style="background:' + c + '"></button>').join('') + '</div></div>'
      + '<label class="f"><span class="row" style="justify-content:space-between">Opacity <span class="mono" id="sys-op-v">' + Math.round(s.opacity * 100) + '%</span></span><input type="range" id="sys-opacity" min="0" max="100" value="' + Math.round(s.opacity * 100) + '"></label>'
      + '<label class="f"><span class="row" style="justify-content:space-between">Self-message reach <span class="mono" id="sys-sr-v">' + Math.round(s.selfReach * 100) + '%</span></span><input type="range" id="sys-reach" min="10" max="90" step="5" value="' + Math.round(s.selfReach * 100) + '"></label>'
      + '<p class="hint">How far a self-message loop travels toward the centre, as a share of the ring radius.</p></section>'
      + '<section class="sec"><button type="button" class="btn danger" data-act="sys-del">Delete this system…</button></section>';
    return;
  }
  if (ui.mode === 'galaxy') { el.innerHTML = galaxyLeft() + problemsHtml(); return; }
  const f = flow();
  const flowsHtml = '<section class="sec"><div class="row" style="justify-content:space-between"><h2 class="lbl">Flows</h2>' + (ui.mode === 'flow' ? '<button type="button" class="btn sm" data-act="add-flow">+ New flow</button>' : '') + '</div><ul class="list">'
    + model.flows.map((g) => '<li><button type="button" class="item" data-act="pick-flow" data-v="' + esc(g.slug) + '" aria-current="' + (g.slug === ui.flow) + '"><span class="body"><span class="t">' + esc(g.name) + '</span><span class="s">' + esc(g.slug) + '</span><span class="hint">' + (startsAt(g) ? 'starts at ' + esc(startsAt(g)) + ' · ' : '') + plural(g.steps.length, 'step') + '</span></span></button></li>').join('') + '</ul></section>';
  if (ui.mode === 'play') {
    const views = [['orbit', 'Orbit'], ['sequence', 'Sequence'], ['slides', 'Slides']];
    el.innerHTML = flowsHtml + '<section class="sec"><h2 class="lbl">View</h2><div class="seg" role="group" aria-label="Play view">'
      + views.map(([v, n]) => '<button type="button" data-act="view" data-v="' + v + '" aria-pressed="' + (ui.playView === v) + '">' + n + '</button>').join('') + '</div>'
      + (model.system.includes.length ? '<label class="row" style="font-weight:700;font-size:13px"><input type="checkbox" id="play-collapse"' + (ui.collapse ? ' checked' : '') + ' style="accent-color:var(--accent)"> Collapse included systems</label><p class="hint">Collapsed, a step that triggers a sub-flow plays as one step.</p>' : '') + '</section>'
      + '<section class="sec"><h2 class="lbl">Steps</h2>' + playList() + '</section>' + problemsHtml();
    return;
  }
  el.innerHTML = flowsHtml + '<section class="sec"><div class="row" style="justify-content:space-between"><h2 class="lbl">Steps in ' + esc(f.name) + '</h2><span class="chip" style="color:' + chainColor(ui.chain) + '">adding to chain ' + ui.chain + '</span></div>' + stepList(f) + '</section>'
    + problemsHtml()
    + '<section class="sec"><h2 class="lbl">Clicking around</h2><p class="hint">Click a participant, then another, to add the next step: participants of included systems work too. Click the same participant twice for a self-message. Click a step number on the ring to fork a new chain from it. Drag a step in this list (or press <kbd>Alt</kbd>+<kbd>↑</kbd>/<kbd>↓</kbd>) to move it within its chain. Drag the background to pan when the galaxy is showing. <kbd>Esc</kbd> cancels, <kbd>Delete</kbd> removes the selected step.</p></section>';
}
function galaxyLeft() {
  const inc = model.system.includes;
  const lib = libModels();
  const others = [...library.entries()].filter(([id, e]) => id !== ui.homeDoc && e.model && !inc.includes(e.model.system.slug));
  const examples = C.exampleSystems().filter((m) => !lib.has(m.system.slug));
  return '<section class="sec"><h2 class="lbl">In this galaxy</h2>'
    + (inc.length ? '<ul class="list">' + inc.map((slug) => {
      const m = lib.get(slug);
      const used = C.includeUsage(model, slug).length;
      return '<li><button type="button" class="item" data-act="pick-ring" data-v="' + esc(slug) + '" aria-current="' + (ui.sel && ui.sel.type === 'system' && ui.sel.slug === slug) + '"><span class="kicon" style="background:' + (m ? m.system.fill : 'transparent') + '">' + icon('system') + '</span><span class="body"><span class="t">' + esc(m ? m.system.label : slug) + '</span><span class="hint">' + (m ? plural(m.system.participants.length, 'participant') + ' · ' + plural(m.flows.length, 'flow') + ' · ' + plural(used, 'step') + ' here' : 'not in your saved systems') + '</span></span></button></li>';
    }).join('') + '</ul>' : '<p class="hint">Nothing included yet. Included systems sit evenly around ' + esc(model.system.label) + ', and their participants become targets for steps.</p>')
    + '<p class="hint">Drag a system onto another to swap places.</p></section>'
    + '<section class="sec"><h2 class="lbl">Include a saved system</h2>'
    + (others.length ? '<ul class="list">' + others.map(([id, e]) => '<li class="row" style="justify-content:space-between;flex-wrap:nowrap"><span style="min-width:0"><strong>' + esc(e.model.system.label) + '</strong> <span class="mono" style="color:var(--muted)">' + esc(e.model.system.slug) + '</span></span><button type="button" class="btn sm" data-act="include" data-v="' + esc(e.model.system.slug) + '">Include</button></li>').join('') + '</ul>' : '<p class="hint">' + (library.size > 1 ? 'Every other saved system is already in this galaxy.' : 'No other saved systems yet. Make one with <strong>+ New system</strong>.') + '</p>')
    + (examples.length ? '<button type="button" class="btn" data-act="add-examples">Add example systems (' + esc(examples.map((m) => m.system.label).join(', ')) + ')</button>' : '')
    + '</section>';
}
function stepList(f) {
  if (!f.steps.length) return '<p class="hint">No steps yet. Click a participant on the ring to start.</p>';
  const chains = [];
  f.steps.forEach((s) => { if (!chains.includes(s.chain)) chains.push(s.chain); });
  return chains.map((c) => {
    let steps;
    try { steps = C.chainSequence(f, c); } catch (e) { if (!(e instanceof C.UserError)) throw e; steps = f.steps.filter((s) => s.chain === c); }
    const fork = steps[0].after !== null && C.findStep(f, steps[0].after).chain !== c ? ' · forked from ' + steps[0].after : '';
    return '<div class="chainhead"><i style="background:' + chainColor(c) + '"></i>Chain ' + c + (c === 'A' ? ' · main' : '') + fork + '</div><ul class="list">'
      + steps.map((s) => {
        const cur = ui.sel && ui.sel.type === 'step' && ui.sel.n === s.n;
        return '<li class="steprow" draggable="true" data-drag-n="' + s.n + '" data-chain="' + c + '"><span class="grip" aria-hidden="true">⋮⋮</span><button type="button" class="item" data-act="pick-step" data-v="' + s.n + '" aria-current="' + cur + '" aria-keyshortcuts="Alt+ArrowUp Alt+ArrowDown">'
          + '<span class="nb" style="background:' + (cur ? 'var(--accent)' : chainColor(s.chain)) + '">' + s.n + '</span><span class="body"><span class="t">' + esc(s.label || '(no label)') + '</span>'
          + '<span class="s">' + esc(s.from) + ' → ' + esc(s.to) + (s.from === s.to ? ' (self)' : '') + '</span>'
          + '<span class="row" style="gap:4px">' + (s.message ? '<span class="chip type" title="' + esc(s.message) + '">' + esc(tt(s.message)) + '</span>' : '') + s.tags.map((t) => '<span class="chip">#' + esc(t) + '</span>').join('') + (s.triggers ? '<span class="chip trig">triggers ' + esc(s.triggers) + '</span>' : '') + (s.result ? '<span class="chip ret" title="' + esc(s.result) + '">returns ' + esc(tt(s.result)) + '</span>' : '') + '</span>'
          + '</span></button><button type="button" class="asyncbtn" data-act="row-async" data-v="' + s.n + '" aria-pressed="' + s.async + '" title="Step ' + s.n + ' is ' + (s.async ? 'async: click for sync' : 'sync: click for async') + '">' + (s.async ? 'async' : 'sync') + '</button></li>';
      }).join('') + '</ul>';
  }).join('');
}
function playList() {
  const sc = script();
  if (!sc.items.length) return '<p class="hint">No steps yet. Add some in Flow mode.</p>';
  const ph = C.phasesAt(sc.items, ui.playT);
  return '<ul class="list">' + sc.items.map((it) => {
    const p = ph.get(it.key).phase;
    const bg = p === 'todo' ? '' : 'background:' + (p === 'active' ? 'var(--accent)' : chainColor(it.chain));
    return '<li style="padding-left:' + it.depth * 16 + 'px"><button type="button" class="item" data-act="jump" data-v="' + esc(it.key) + '" aria-current="' + (p === 'active') + '">'
      + '<span class="nb' + (p === 'todo' ? ' todo' : '') + '" style="' + bg + '">' + esc(dk(it)) + '</span><span class="body"><span class="t">' + esc(it.label || '(no label)') + '</span>'
      + '<span class="s">' + esc(toLocal(it.from)) + ' → ' + esc(toLocal(it.to)) + '</span>' + (it.depth ? '<span class="hint">in ' + esc(it.system) + ' · ' + esc(it.flow) + '</span>' : '') + '</span></button></li>';
  }).join('') + '</ul>';
}

/* ---------- render: right ---------- */
function renderRight() {
  const el = $('right');
  if (ui.mode === 'system') { el.innerHTML = participantPanel(); return; }
  if (ui.mode === 'galaxy') { el.innerHTML = systemPanel(); return; }
  if (ui.mode === 'play') { el.innerHTML = playPanel(); return; }
  const f = flow();
  if (ui.sel && ui.sel.type === 'step') { el.innerHTML = stepEditor(f, C.findStep(f, ui.sel.n)); return; }
  const next = f.steps.reduce((m, s) => Math.max(m, s.n), 0) + 1;
  el.innerHTML = '<section class="sec"><h2 class="lbl">Flow</h2>'
    + '<label class="f">Name<input class="field" id="flow-name" value="' + esc(f.name) + '"></label>'
    + '<div class="f"><span>Slug</span><span class="mono" id="flow-slug">' + esc(f.slug) + '</span></div>'
    + (ui.confirm && ui.confirm.kind === 'flow' ? '<div class="confirm">Delete "' + esc(f.name) + '" and its ' + plural(f.steps.length, 'step') + '? <button type="button" class="btn sm danger" data-act="flow-del-yes">Delete</button><button type="button" class="btn sm" data-act="confirm-no">Cancel</button></div>'
      : '<button type="button" class="btn danger" data-act="flow-del" ' + (model.flows.length > 1 ? '' : 'disabled') + '>Delete flow</button>')
    + '</section><section class="sec"><h2 class="lbl">Next</h2><p class="hint">' + (ui.pending ? 'Click where step ' + next + ' goes from <strong>' + esc(titleOfRef(ui.pending.from)) + '</strong>.' : 'Click a participant to start step ' + next + ' on chain ' + ui.chain + '.') + ' Select a step to edit it.</p></section>';
}

function participantPanel() {
  const parts = model.system.participants;
  if (!(ui.sel && ui.sel.type === 'participant')) {
    return '<section class="sec"><h2 class="lbl">Participants</h2>' + (parts.length ? '<ul class="list">' + parts.map((p, i) => '<li><button type="button" class="item" data-act="pick-part" data-v="' + esc(p.slug) + '"><span class="kicon" style="background:' + p.fill + '">' + icon(p.kind) + '</span><span class="body"><span class="t">' + esc(p.title) + '</span><span class="s">' + esc(p.slug) + ' · slot ' + (i + 1) + '</span></span></button></li>').join('') + '</ul>' : '<p class="hint">None yet. Pick a kind from the palette.</p>') + '</section>';
  }
  const i = C.participantIndex(model, ui.sel.slug), p = parts[i];
  const used = C.stepsUsing(model, p.slug).length;
  return '<section class="sec"><div class="row"><span class="kicon" style="background:' + p.fill + ';width:34px;height:34px">' + icon(p.kind) + '</span><div style="flex:1 1 auto;min-width:0"><div style="font-weight:800;font-size:16px">' + esc(p.title) + '</div><div class="hint">Slot ' + (i + 1) + ' of ' + parts.length + ' · used by ' + plural(used, 'step') + '</div></div><button type="button" class="btn icon" data-act="desel" aria-label="Close">×</button></div>'
    + '<label class="f">Title<input class="field" id="pt-title" value="' + esc(p.title) + '"></label>'
    + '<label class="f">Slug<input class="field mono" id="pt-slug" value="' + esc(p.slug) + '"></label>'
    + '<p class="hint">Follows the first three words of the title until you type your own. Steps follow renames, including steps in systems that include this one.</p>'
    + '<label class="f">Kind<select class="field" id="pt-kind">' + C.KIND_NAMES.map((k) => '<option value="' + k + '"' + (k === p.kind ? ' selected' : '') + '>' + C.KIND_TITLES[k] + '</option>').join('') + '</select></label>'
    + '<div class="f"><span>Colour</span><div class="swatches">' + NODE_FILLS.map(([n, c]) => '<button type="button" class="swatch" data-act="pt-fill" data-v="' + c + '" aria-label="' + n + '" aria-pressed="' + (p.fill === c) + '" style="background:' + c + '"></button>').join('') + '</div></div>'
    + '<div class="f"><span>Position</span><div class="row"><button type="button" class="btn" data-act="pt-move" data-v="-1">‹ Anticlockwise</button><button type="button" class="btn" data-act="pt-move" data-v="1">Clockwise ›</button></div></div>'
    + '</section><section class="sec">'
    + (ui.confirm && ui.confirm.kind === 'part' ? '<div class="confirm">Remove ' + esc(p.title) + (used ? ' and its ' + plural(used, 'step') : '') + '? <button type="button" class="btn sm danger" data-act="pt-del-yes">Remove</button><button type="button" class="btn sm" data-act="confirm-no">Cancel</button></div>'
      : '<button type="button" class="btn danger" data-act="pt-del">Remove from system</button>')
    + '</section>';
}

function systemPanel() {
  if (!(ui.sel && ui.sel.type === 'system')) {
    return '<section class="sec"><h2 class="lbl">Galaxy</h2><p class="hint">' + esc(model.system.label) + ' sits in the middle. Select an included system to see its participants and flows, or open it to edit.</p><p class="hint">In Flow mode, steps can go to any participant you can see. A step can trigger one of that system\'s flows, which then plays as numbered sub-steps (3.1, 3.2 …).</p></section>';
  }
  const slug = ui.sel.slug, m = libModels().get(slug);
  const used = C.includeUsage(model, slug).length;
  const id = [...library.entries()].find(([, e]) => e.model && e.model.system.slug === slug);
  return '<section class="sec"><div class="row"><span class="kicon" style="background:' + (m ? m.system.fill : 'transparent') + ';width:34px;height:34px">' + icon('system') + '</span><div style="flex:1 1 auto;min-width:0"><div style="font-weight:800;font-size:16px">' + esc(m ? m.system.label : slug) + '</div><div class="mono" style="color:var(--muted)">' + esc(slug) + '</div></div><button type="button" class="btn icon" data-act="desel" aria-label="Close">×</button></div>'
    + (m ? '<div class="f"><span>Participants</span><ul class="list">' + m.system.participants.map((p) => '<li class="row"><span class="kicon" style="background:' + p.fill + '">' + icon(p.kind) + '</span>' + esc(p.title) + ' <span class="mono" style="color:var(--muted)">' + esc(p.slug) + '</span></li>').join('') + '</ul></div>'
      + '<div class="f"><span>Flows it can run</span><ul class="list">' + m.flows.map((g) => '<li class="hint"><strong style="color:var(--ink)">' + esc(g.name) + '</strong> · starts at ' + esc(startsAt(g) || '—') + ' · ' + plural(g.steps.length, 'step') + '</li>').join('') + '</ul></div>'
      : '<p class="err">This system is not in your saved systems. Remove it, or create a system with the slug "' + esc(slug) + '".</p>')
    + '<div class="f"><span>Position · slot ' + (model.system.includes.indexOf(slug) + 1) + ' of ' + model.system.includes.length + '</span><div class="row"><button type="button" class="btn" data-act="sys-move" data-v="-1"' + (model.system.includes.length > 1 ? '' : ' disabled') + '>‹ Anticlockwise</button><button type="button" class="btn" data-act="sys-move" data-v="1"' + (model.system.includes.length > 1 ? '' : ' disabled') + '>Clockwise ›</button></div></div>'
    + (id ? '<button type="button" class="btn primary" data-act="open-sys" data-v="' + esc(id[0]) + '">Open ' + esc(m.system.label) + ' to edit</button>' : '')
    + '</section><section class="sec">'
    + (ui.confirm && ui.confirm.kind === 'exclude' ? '<div class="confirm">Remove ' + esc(m ? m.system.label : slug) + ' from this galaxy' + (used ? ' and delete the ' + plural(used, 'step') + ' that reach into it' : '') + '? <button type="button" class="btn sm danger" data-act="exclude-yes">Remove</button><button type="button" class="btn sm" data-act="confirm-no">Cancel</button></div>'
      : '<button type="button" class="btn danger" data-act="exclude">Remove from galaxy</button>')
    + '</section>';
}

function endpointOptions(value) {
  const lib = libModels();
  const local = '<optgroup label="' + esc(model.system.label) + '">' + model.system.participants.map((p) => '<option value="' + esc(p.slug) + '"' + (p.slug === value ? ' selected' : '') + '>' + esc(p.title) + '</option>').join('') + '</optgroup>';
  const ext = model.system.includes.map((sys) => {
    const m = lib.get(sys);
    const opts = m ? m.system.participants.map((p) => sys + '.' + p.slug) : [];
    if (C.isExternal(value) && C.parseRef(value).system === sys && !opts.includes(value)) opts.push(value);
    return '<optgroup label="' + esc(m ? m.system.label : sys) + '">' + opts.map((r) => '<option value="' + esc(r) + '"' + (r === value ? ' selected' : '') + '>' + esc(titleOfRef(r).replace(/ \(.*\)$/, '')) + '</option>').join('') + '</optgroup>';
  }).join('');
  return local + ext;
}
function triggerCandidates(f, s) {
  const lib = libModels();
  const target = C.isExternal(s.to) ? C.parseRef(s.to) : { system: null, slug: s.to };
  const out = [];
  const add = (sys, g) => out.push({ value: sys ? sys + '/' + g.slug : g.slug, label: (sys ? (lib.get(sys) ? lib.get(sys).system.label : sys) + ' · ' : '') + g.name + ' (' + plural(g.steps.length, 'step') + ')', starts: startsAt(g) });
  model.flows.filter((g) => g.slug !== f.slug).forEach((g) => add(null, g));
  model.system.includes.forEach((sys) => { const m = lib.get(sys); if (m) m.flows.forEach((g) => add(sys, g)); });
  const fits = (c) => (target.system ? c.value.startsWith(target.system + '/') : !c.value.includes('/')) && c.starts === target.slug;
  const shown = out.filter((c) => ui.trigAll || fits(c) || c.value === s.triggers);
  if (s.triggers && !shown.some((c) => c.value === s.triggers)) shown.push({ value: s.triggers, label: s.triggers + ' (not found)' });
  return { shown, hidden: out.length - shown.length };
}

/** The flow a trigger names ("flow" here, or "system/flow"), or null when it isn't saved. */
function triggerTarget(trig) {
  const [sys, fl] = trig.includes('/') ? trig.split('/') : [homeSlug(), trig];
  const m = libModels().get(sys);
  return m ? m.flows.find((g) => g.slug === fl) || null : null;
}
/** "<system> : <flow>" link that opens the triggered flow. */
function triggerLink(s) {
  if (!s.triggers) return '';
  const [sys, fl] = s.triggers.includes('/') ? s.triggers.split('/') : [homeSlug(), s.triggers];
  const m = libModels().get(sys), t = m ? m.flows.find((g) => g.slug === fl) : null;
  if (!t) return '';
  return '<a class="sublink" href="' + routeHash(sys, fl) + '">' + esc(m.system.label) + ' : ' + esc(t.name) + ' →</a>';
}
function triggerHint(s) {
  if (!s.triggers) return '';
  const t = triggerTarget(s.triggers);
  if (!t) return '';
  const R = C.flowResult(t);
  const reply = tt(s.result || (R && R.result) || '');
  return R
    ? '<p class="hint"><strong>Synchronous.</strong> Plays as ' + s.n + '.1, ' + s.n + '.2 …, then ' + esc(reply) + ' comes back to ' + esc(s.from) + ' (' + s.n + '↩). The steps after this one wait for it.</p>'
    : '<p class="hint"><strong>Asynchronous.</strong> ' + esc(t.name) + ' returns no result, so it plays as ' + s.n + '.1, ' + s.n + '.2 … alongside the steps that follow' + (s.result ? '; ' + esc(s.to) + ' replies ' + esc(tt(s.result)) + ' straight away' : ' this one') + '.</p>';
}
/** What a result on this step means, so the hint can say it in place. */
function resultField(f, s) {
  const entry = C.flowEntry(f);
  const self = s.from === s.to;
  const isFlowResult = self && s.to === entry;
  const other = isFlowResult ? f.steps.find((x) => x.n !== s.n && x.result && x.from === x.to && x.to === entry) : null;
  const t = s.triggers ? triggerTarget(s.triggers) : null;
  const R = t ? C.flowResult(t) : null;
  const hint = other ? 'Step ' + other.n + ' already returns this flow\'s result to its callers; clear it there first.'
    : isFlowResult ? 'This is the flow\'s result: when another step calls this flow, it goes back to that caller, which waits for it (a synchronous call).'
    : self ? 'A self-step\'s result only goes back to a caller when it\'s on ' + esc(entry) + ', where this flow starts. Here it is a note.'
    : R && s.result === R.result ? 'Set from ' + esc(t.name) + '\'s result. Pick another type to name the reply differently.'
    : R ? 'Leave empty to reply with ' + esc(t.name) + '\'s result, ' + esc(tt(R.result)) + '. Pick a type here to name the reply instead.'
    : esc(s.to) + ' replies to ' + esc(s.from) + ' with this (' + s.n + '↩), and the steps after this one wait for the reply.';
  return other ? '<div class="f"><span>Result <span class="hint" style="font-weight:400">optional · the reply</span></span>' + (s.result ? typePill('result', s.result) : '') + '</div><p class="hint">' + hint + '</p>'
    : typePicker('result', 'Result', 'optional · the reply', s.result, R && !self ? tt(R.result) : null) + '<p class="hint">' + hint + '</p>';
}
/* ---------- type picker: filter or create, one pill below ---------- */
const types = () => C.typeIndex(model, libModels());
/** A type id as people read it: its title. */
const tt = (slug) => C.typeTitle(types(), slug);
/** Redraw only the inspector, keeping focus and caret (the picker redraws as you type). */
const refreshRight = () => render({ skip: ['header', 'left', 'stage', 'playbar', 'modal'] });
function typeOptions(kind, q) {
  const idx = types();
  const used = new Set(model.flows.flatMap((f) => f.steps.flatMap((s) => [s.message, s.result]).filter(Boolean)));
  const names = [...new Set([...idx.keys(), ...used])];
  const ql = q.trim().toLowerCase();
  const opts = names.filter((n) => !ql || n.includes(ql) || C.typeTitle(idx, n).toLowerCase().includes(ql) || n.includes(C.slugify(ql) || ql))
    .sort((a, b) => (idx.has(b) && idx.get(b).local) - (idx.has(a) && idx.get(a).local) || a.localeCompare(b))
    .slice(0, 8)
    .map((n) => ({ name: n, title: C.typeTitle(idx, n), create: false, meta: n + (idx.has(n) ? ' · ' + plural(idx.get(n).schema.fields.length, 'field') + (idx.get(n).local ? '' : ' · ' + idx.get(n).system) : ' · not defined yet') }));
  const title = q.trim() ? q.trim()[0].toUpperCase() + q.trim().slice(1) : '';
  if (title && C.slugify(title) && !opts.some((o) => o.title.toLowerCase() === title.toLowerCase())) {
    opts.push({ name: title, title, create: true, meta: C.typeSlugFor(model, title, [...idx.keys()]) + ' · new in ' + model.system.label });
  }
  return opts;
}
function typePill(kind, name) {
  const e = types().get(name);
  const meta = name + ' · ' + (e ? plural(e.schema.fields.length, 'field') + (e.local ? '' : ' · from ' + e.system) : 'not defined yet: click to define');
  const title = tt(name);
  return '<div class="row" style="gap:8px"><span class="typepill' + (e ? '' : ' undef') + '"><button type="button" class="tp-link" data-act="open-schema" data-v="' + esc(name) + '" title="Open the ' + esc(title) + ' type">' + esc(title) + '</button><button type="button" class="tp-x" data-act="tp-clear" data-v="' + kind + '" aria-label="Remove ' + esc(title) + '">×</button></span><span class="hint">' + esc(meta) + '</span></div>';
}
function typePicker(kind, label, sub, value, placeholder) {
  const open = ui.tp && ui.tp.kind === kind;
  const opts = open ? typeOptions(kind, ui.tp.q) : [];
  const hi = open ? Math.min(ui.tp.hi, Math.max(0, opts.length - 1)) : 0;
  return '<div class="f"><label for="tp-' + kind + '">' + label + ' <span class="hint" style="font-weight:400">' + sub + '</span></label>'
    + '<div class="tp"><input class="field mono" id="tp-' + kind + '" value="' + esc(open ? ui.tp.q : '') + '" placeholder="' + esc(value ? 'Change type…' : placeholder ? 'Filter or create… (' + placeholder + ' if empty)' : 'Filter or create a type…') + '" autocomplete="off" role="combobox" aria-expanded="' + open + '" aria-controls="tp-list-' + kind + '">'
    + (open && opts.length ? '<ul class="tp-list" id="tp-list-' + kind + '" role="listbox">' + opts.map((o, k) => '<li role="option" aria-selected="' + (k === hi) + '"><button type="button" class="tp-opt' + (k === hi ? ' hi' : '') + '" data-act="tp-pick" data-k="' + kind + '" data-v="' + esc(o.name) + '" data-new="' + (o.create ? 1 : 0) + '">' + (o.create ? '<span>Create <strong>' + esc(o.title) + '</strong></span>' : '<span>' + esc(o.title) + '</span>') + '<span class="hint">' + esc(o.meta) + '</span></button></li>').join('') + '</ul>' : '')
    + '</div>' + (value ? typePill(kind, value) : '') + '</div>';
}
function chooseType(kind, name, create) {
  const f = flow(), s = C.findStep(f, ui.sel.n);
  let m = model;
  let slug = name;
  if (create) {
    const r = attempt(() => C.addSchema(model, name, [...types().keys()]));
    if (!r) return;
    m = r.model; slug = r.slug;
  }
  m = C.updateStep(m, f.slug, s.n, { [kind]: slug });
  if (kind === 'message' && !Object.keys(s.data).length) {
    const ex = C.exampleData(C.typeIndex(m, libModels()), slug);
    if (ex && Object.keys(ex).length) m = C.updateStep(m, f.slug, s.n, { data: ex });
  }
  ui.tp = null;
  ui.drafts.data = null;
  // Leave the picker so the redraw doesn't hand focus back to it (which would reopen its list).
  if (document.activeElement && document.activeElement.closest('.tp')) document.activeElement.blur();
  commit(m);
  if (create) openSchema(slug);
}
function dataCheck(s) {
  if (!s.message) return '';
  const idx = types(), e = idx.get(s.message);
  if (!e) return '';
  const probs = C.checkData(idx, s.message, s.data);
  return '<div class="row" style="justify-content:space-between">' + (probs.length ? '<span class="hint" style="color:var(--warn-ink)">Doesn\'t match ' + esc(tt(s.message)) + ' yet</span>' : '<span class="hint" style="color:var(--ok)">Matches ' + esc(tt(s.message)) + '</span>')
    + (e.schema.fields.length ? '<button type="button" class="btn sm" data-act="fill-data">Fill from ' + esc(tt(s.message)) + '</button>' : '') + '</div>'
    + (probs.length ? '<ul class="hint" style="margin:0;padding-left:18px">' + probs.slice(0, 6).map((p) => '<li>' + esc(p) + '</li>').join('') + (probs.length > 6 ? '<li>…and ' + (probs.length - 6) + ' more</li>' : '') + '</ul>' : '');
}

/* ---------- schema editor ---------- */
function openSchema(name) {
  const e = types().get(name);
  ui.tp = null;
  ui.schema = {
    orig: e && e.local ? name : null,
    draft: e ? JSON.parse(JSON.stringify(e.schema)) : { slug: name, title: C.sentence(name), summary: '', fields: [] },
    readOnly: Boolean(e && !e.local), system: e ? e.system : homeSlug(), error: null, confirmDel: false
  };
  // A type you can edit always opens with a field to type into: an empty one gets field1, selected.
  if (!ui.schema.readOnly && !ui.schema.draft.fields.length) { addDraftField(); return; }
  render();
  $(ui.schema.readOnly ? 'sc-close' : 'sc-title').focus();
}
/** Hint after each built-in type in the field type menu; every BASE_TYPES entry needs one. */
const BASE_HINTS = { string: '', text: ' (multi-line)', number: ' (e.g. 59.98)', boolean: ' (true / false)', date: ' (2026-01-15)', object: ' (any mapping)' };
C.BASE_TYPES.forEach((t) => { if (!(t in BASE_HINTS)) throw new Error('bug: no hint for built-in type "' + t + '"'); });
/** Next unused "fieldN" name in `fields`, e.g. field1, then field2. */
const nextFieldName = (fields) => {
  for (let i = fields.length + 1; ; i++) if (!fields.some((x) => x.name === 'field' + i)) return 'field' + i;
};
/**
 * Adds a string field to the open schema draft at index `at` (default: the end), saves,
 * and selects its name for typing. `name` '' gives a blank row, which saving skips until named.
 */
function addDraftField(name, at) {
  const fs = ui.schema.draft.fields;
  const i = at === undefined ? fs.length : at;
  if (!(i >= 0 && i <= fs.length)) throw new Error('bug: addDraftField at ' + at);
  fs.splice(i, 0, { name: name === undefined ? nextFieldName(fs) : name, type: 'string', repeated: false });
  applySchemaDraft();
  const el = $('sf-name-' + i);
  if (!el) throw new Error('bug: the new field\'s name input was not rendered');
  el.focus(); el.select();
}
function closeSchema() {
  const name = ui.schema.orig;
  ui.schema = null;
  // A step that was waiting on this type for its example data gets it now.
  if (name && ui.mode === 'flow' && ui.sel && ui.sel.type === 'step') {
    const f = flow(), s = C.findStep(f, ui.sel.n);
    const ex = s.message === name && !Object.keys(s.data).length ? C.exampleData(types(), name) : null;
    if (ex && Object.keys(ex).length) { commit(C.updateStep(model, f.slug, s.n, { data: ex })); return; }
  }
  render();
}
/** Validate the draft; commit it when it reads cleanly, otherwise show why. */
function applySchemaDraft(skipModal) {
  const sc = ui.schema;
  const saved = C.namedFields(sc.draft); // blank rows are still being typed: leave them out
  sc.error = C.schemaError(model, sc.orig, saved);
  if (sc.error) { if (skipModal) renderModalHeader(); else render(); return; }
  const m = sc.orig ? C.updateSchema(model, sc.orig, saved) : C.defineSchema(model, saved);
  sc.orig = sc.draft.slug;
  commit(m, { key: 'schema', skip: skipModal ? ['modal'] : [] });
  if (skipModal) renderModalHeader();
}
/** The draft as it will be written in the file. */
const schemaPreview = (d) => '```schema\n' + jsyaml.dump({ [d.slug || '?']: { title: d.title, ...(d.summary ? { summary: d.summary } : {}), fields: Object.fromEntries(C.namedFields(d).fields.map((f) => [f.name, f.type + (f.repeated ? '[]' : '')])) } }, { lineWidth: -1 }) + '```';
function renderModalHeader() {
  const pv = document.getElementById('sc-preview');
  if (pv && ui.schema) pv.textContent = schemaPreview(ui.schema.draft);
  const h = document.getElementById('sc-heading');
  if (h && ui.schema) h.innerHTML = (ui.schema.orig || ui.schema.readOnly ? 'Type' : 'New type') + ' ' + esc(ui.schema.draft.title) + ' <span class="mono" style="font-size:13px;color:var(--muted)">' + esc(ui.schema.draft.slug) + '</span>';
  const err = ui.schema && ui.schema.error;
  const box = document.querySelector('#modal .dialog-main');
  if (!box) return;
  let p = box.querySelector('p.err');
  if (err && !p) { p = document.createElement('p'); p.className = 'err'; p.setAttribute('role', 'alert'); box.appendChild(p); }
  if (p) { p.textContent = err ? err + ' Not saved until this is fixed.' : ''; p.hidden = !err; }
}
function closeSysDel() {
  const back = ui.sysDel.opener;
  ui.sysDel = null;
  renderModal();
  (back.isConnected ? back : $('file-menu-btn')).focus();
}
/** The "Delete system" dialog: what goes, and what changes in the systems that include this one. */
function sysDelDialog() {
  const s = model.system;
  const refs = C.systemReferences(libModels(), s.slug);
  const nSteps = model.flows.reduce((k, f) => k + f.steps.length, 0);
  const affected = refs.filter((r) => r.steps.length);
  return '<div class="scrim" data-act="sys-del-no"></div><div class="dialog narrow" role="alertdialog" aria-modal="true" aria-labelledby="sd-heading" aria-describedby="sd-body">'
    + '<header><h2 id="sd-heading" style="margin:0;font-size:18px">Delete ' + esc(s.label) + '?</h2></header>'
    + '<div id="sd-body" class="dialog-main">'
    + '<p style="margin:0">This deletes the system <span class="mono">' + esc(s.slug) + '</span> with its ' + model.system.participants.length + ' participants, ' + model.flows.length + ' flow' + (model.flows.length === 1 ? '' : 's') + ', ' + nSteps + ' step' + (nSteps === 1 ? '' : 's') + ' and ' + model.schemas.length + ' type' + (model.schemas.length === 1 ? '' : 's') + '. You can\'t undo this.</p>'
    + (refs.length
      ? '<div class="warnbox" role="note"><strong>' + esc(s.label) + ' is used by ' + refs.length + ' other system' + (refs.length === 1 ? '' : 's') + '.</strong> It will be removed from ' + (refs.length === 1 ? 'it' : 'each') + (affected.length ? ', and these steps change:' : '; no steps use it.') + '</div>'
        + affected.map((r) => '<section><h3 class="lbl" style="margin:0 0 6px">' + esc(r.label) + '</h3><ul class="list sd-list">'
          + r.steps.map((x) => '<li><span class="mono">' + esc(x.flowName) + ' · ' + x.n + '</span> ' + esc(x.label || '(no label)') + ' <span class="chip' + (x.effect === 'removed' ? ' bad' : '') + '">' + (x.effect === 'removed' ? 'step deleted' : 'trigger cleared') + '</span></li>').join('')
          + '</ul></section>').join('')
        + (affected.some((r) => r.steps.some((x) => x.effect === 'removed')) ? '<p class="hint" style="margin:0">Steps after a deleted one are renumbered.</p>' : '')
      : '<p class="hint" style="margin:0">No other system includes it.</p>')
    + '</div><footer class="row"><span class="spacer"></span><button type="button" class="btn" id="sd-cancel" data-act="sys-del-no">Cancel</button><button type="button" class="btn danger" data-act="sys-del-yes">Delete ' + esc(s.label) + '</button></footer></div>';
}
function renderModal() {
  const el = $('modal');
  if (ui.sysDel) { el.hidden = false; el.innerHTML = sysDelDialog(); return; }
  const sc = ui.schema;
  el.hidden = !sc;
  if (!sc) { el.innerHTML = ''; return; }
  const idx = types();
  const ro = sc.readOnly;
  const dis = ro ? ' disabled' : '';
  const typeNames = [...new Set([...idx.keys(), ...sc.draft.fields.map((f) => f.type).filter((t) => !C.BASE_TYPES.includes(t))])].sort((a, b) => C.typeTitle(idx, a).localeCompare(C.typeTitle(idx, b)));
  const usage = sc.orig ? C.schemaUsage(model, sc.orig) : { steps: [], fields: [] };
  const preview = schemaPreview(sc.draft);
  const sysLabel = (libModels().get(sc.system) || model).system.label;
  el.innerHTML = '<div class="scrim" data-act="sc-close"></div><div class="dialog" role="dialog" aria-modal="true" aria-labelledby="sc-heading">'
    + '<header class="row" style="flex-wrap:nowrap"><div style="flex:1 1 auto;min-width:0"><h2 id="sc-heading" style="margin:0;font-size:18px">' + (sc.orig || ro ? 'Type' : 'New type') + ' ' + esc(sc.draft.title) + ' <span class="mono" style="font-size:13px;color:var(--muted)">' + esc(sc.draft.slug) + '</span></h2><div class="hint">' + (ro ? 'Defined in ' + esc(sysLabel) + '. Open it to make changes.' : sc.orig ? 'Defined in ' + esc(model.system.label) + '. Changes save as you type.' : 'Not defined yet. Give it fields to define it in ' + esc(model.system.label) + '.') + '</div></div><button type="button" class="btn icon" id="sc-close" data-act="sc-close" aria-label="Close">×</button></header>'
    + '<div class="dialog-body"><div class="dialog-main">'
    + '<div class="row" style="flex-wrap:nowrap;align-items:flex-end"><label class="f" style="flex:3 1 0">Title<input class="field" id="sc-title" value="' + esc(sc.draft.title) + '"' + dis + '></label><label class="f" style="flex:2 1 0">Id<input class="field mono" id="sc-slug" value="' + esc(sc.draft.slug) + '"' + dis + '></label></div>'
    + '<p class="hint">' + (sc.orig ? 'The id follows the title until you type your own. Steps and fields refer to it, and follow when it changes.' : 'Steps already use the id ' + esc(sc.draft.slug) + ', so it stays as it is.') + '</p>'
    + '<label class="f">Summary<input class="field" id="sc-summary" value="' + esc(sc.draft.summary) + '" placeholder="What this type is for"' + dis + '></label>'
    + '<div class="fields"><div class="frow lbl"><span>Field</span><span>Type</span><span>List</span><span></span></div>'
    + sc.draft.fields.map((f, i) => {
      const nested = !C.BASE_TYPES.includes(f.type);
      return '<div class="frow"><label><span class="sr">Field name</span><input class="field mono" id="sf-name-' + i + '" value="' + esc(f.name) + '" placeholder="fieldName" enterkeyhint="next"' + dis + '></label>'
        + '<label><span class="sr">Type of ' + esc(f.name) + '</span><select class="field" id="sf-type-' + i + '"' + dis + '>'
        + '<optgroup label="Built in">' + C.BASE_TYPES.map((t) => '<option value="' + t + '"' + (t === f.type ? ' selected' : '') + '>' + t + BASE_HINTS[t] + '</option>').join('') + '</optgroup>'
        + '<optgroup label="Types">' + typeNames.map((t) => '<option value="' + esc(t) + '"' + (t === f.type ? ' selected' : '') + '>' + esc(C.typeTitle(idx, t)) + (idx.has(t) ? '' : ' (not defined)') + '</option>').join('') + '<option value="__new">+ New type…</option></optgroup></select></label>'
        + '<label class="ck"><span class="sr">' + esc(f.name) + ' is a list</span><input type="checkbox" id="sf-rep-' + i + '"' + (f.repeated ? ' checked' : '') + dis + '></label>'
        + (ro ? '<span></span>' : '<button type="button" class="btn icon" data-act="sf-del" data-v="' + i + '" aria-label="Delete field ' + esc(f.name) + '">×</button>')
        + (nested ? '<button type="button" class="tp-link sub" data-act="open-schema" data-v="' + esc(f.type) + '">' + (idx.has(f.type) ? 'Open ' : 'Define ') + esc(C.typeTitle(idx, f.type)) + ' →</button>' : '')
        + '</div>';
    }).join('')
    + (sc.draft.fields.length ? '' : '<p class="hint">No fields yet.</p>')
    + (ro ? '' : '<button type="button" class="btn" id="sf-add" data-act="sf-add" style="align-self:flex-start">+ Add field</button>') + '</div>'
    + (sc.error ? '<p class="err" role="alert">' + esc(sc.error) + ' Not saved until this is fixed.</p>' : '')
    + '</div><aside class="dialog-side"><span class="lbl">In ' + esc(sc.system) + '.flow.md</span><pre class="data" id="sc-preview">' + esc(preview) + '</pre>'
    + '<span class="lbl">Used by</span>' + (usage.steps.length || usage.fields.length ? '<ul class="list hint">' + usage.steps.map((u) => '<li>' + esc(u.flowName) + ' step ' + u.n + ' · ' + u.as + '</li>').join('') + usage.fields.map((u) => '<li>' + esc(u.schema) + '.' + esc(u.field) + '</li>').join('') + '</ul>' : '<p class="hint">Nothing in ' + esc(model.system.label) + ' yet.</p>')
    + '</aside></div>'
    + '<footer class="row">' + (ro ? '<button type="button" class="btn primary" data-act="sc-open-sys">Open ' + esc(sysLabel) + '</button>'
      : sc.orig ? (sc.confirmDel ? '<span class="confirm">Delete ' + esc(sc.orig) + '? Steps and fields that use it keep the name. <button type="button" class="btn sm danger" data-act="sc-del-yes">Delete</button><button type="button" class="btn sm" data-act="sc-del-no">Cancel</button></span>' : '<button type="button" class="btn danger" data-act="sc-del">Delete type</button>') : '')
    + '<span class="spacer"></span><button type="button" class="btn primary" data-act="sc-close">Done</button></footer></div>';
}

/** Previous / next step (by number), so you can walk the flow without leaving the editor. */
function stepNav(f, s) {
  const i = f.steps.findIndex((x) => x.n === s.n);
  if (i < 0) throw new Error('bug: step ' + s.n + ' not in its flow');
  const prev = f.steps[i - 1], next = f.steps[i + 1];
  const b = (dir, to, k) => '<button type="button" class="btn icon sm" data-act="step-nav" data-v="' + (to ? to.n : '') + '" aria-label="' + (to ? dir + ' step: ' + to.n + ' · ' + esc(to.label || '(no label)') : 'No ' + dir.toLowerCase() + ' step') + '" title="' + (to ? dir + ': step ' + to.n : '') + '"' + (to ? '' : ' disabled') + '>' + icon(k) + '</button>';
  return '<div class="row" style="gap:2px;flex-wrap:nowrap">' + b('Previous', prev, 'chevL') + b('Next', next, 'chevR') + '</div>';
}
/** One line for the folded "Message & data" section: the types and how much example data there is. */
function msgSummary(s) {
  const n = Object.keys(s.data).length;
  const bits = [s.message ? '<span class="chip type" title="' + esc(s.message) + '">' + esc(tt(s.message)) + '</span>' : '<span class="hint">No message type</span>',
    s.result ? '<span class="chip ret" title="' + esc(s.result) + '">returns ' + esc(tt(s.result)) + '</span>' : '',
    '<span class="hint">' + (n ? plural(n, 'data field') : 'no example data') + '</span>'];
  return '<div id="msg-body" class="row" style="gap:6px">' + bits.join('') + '</div>';
}
function stepEditor(f, s) {
  const tc = triggerCandidates(f, s);
  const draftData = ui.drafts.data && ui.drafts.data.n === s.n && ui.drafts.data.flow === f.slug ? ui.drafts.data : null;
  const dataText = draftData ? draftData.text : (Object.keys(s.data).length ? jsyaml.dump(s.data, { lineWidth: -1, schema: jsyaml.JSON_SCHEMA }).replace(/\n$/, '') : '');
  const fork = s.after !== null && C.findStep(f, s.after).chain !== s.chain;
  const cross = C.isExternal(s.from) || C.isExternal(s.to);
  return '<section class="sec"><div class="row"><span class="nb" style="background:var(--accent);min-width:30px;height:30px;font-size:14px">' + s.n + '</span><div style="flex:1 1 auto;min-width:0"><div style="font-weight:800;font-size:16px">Step ' + s.n + (s.from === s.to ? ' · self-message' : cross ? ' · cross-system' : '') + '</div><div class="hint">Chain ' + s.chain + (s.after === null ? ' · starts the flow' : (fork ? ' · forked from ' : ' · after ') + s.after) + '</div></div>'
    + stepNav(f, s)
    + '<button type="button" class="btn sm" data-act="fork" data-v="' + s.n + '">' + icon('fork') + 'Fork</button><button type="button" class="btn icon" data-act="desel" aria-label="Close">×</button></div>'
    + '<div class="row" style="flex-wrap:nowrap"><label class="f" style="flex:1 1 0;min-width:0">From<select class="field" id="st-from">' + endpointOptions(s.from) + '</select></label><span style="padding-top:18px" aria-hidden="true">→</span><label class="f" style="flex:1 1 0;min-width:0">To<select class="field" id="st-to">' + endpointOptions(s.to) + '</select></label></div>'
    + '<label class="f">Label<input class="field" id="st-label" value="' + esc(s.label) + '" placeholder="What is being sent"></label>'
    + '<div class="f"><span id="st-call-lbl">Call</span><div class="row" style="gap:8px;flex-wrap:nowrap"><div class="seg" role="group" aria-labelledby="st-call-lbl">'
    + [['sync', 'Sync'], ['async', 'Async']].map(([v, n]) => '<button type="button" data-act="step-async" data-v="' + v + '" aria-pressed="' + (v === 'async' ? s.async : !s.async) + '">' + n + '</button>').join('')
    + '</div><span class="hint">' + (s.async ? esc(s.from) + ' carries on at once; the task plays alongside.' : 'What follows waits for ' + esc(s.to) + '’s task' + (s.triggers || s.result ? ' (sub-flow and reply).' : '.')) + '</span></div></div>'
    + '<div class="f"><label for="st-tag">Tags</label><div class="tags">' + s.tags.map((t) => '<span class="tagpill">#' + esc(t) + '<button type="button" data-act="tag-del" data-v="' + esc(t) + '" aria-label="Remove tag ' + esc(t) + '">×</button></span>').join('')
    + '<input id="st-tag" list="tag-options" placeholder="' + (s.tags.length ? '' : 'Add a tag, press Enter') + '" autocomplete="off"></div><datalist id="tag-options">' + allTags().filter((t) => !s.tags.includes(t)).map((t) => '<option value="' + esc(t) + '">').join('') + '</datalist></div>'
    + '</section><section class="sec"><h2 class="lbl">Triggers</h2>'
    + '<label class="f">Sub-flow to start<select class="field" id="st-trig"><option value="">None: a plain message</option>' + tc.shown.map((c) => '<option value="' + esc(c.value) + '"' + (c.value === s.triggers ? ' selected' : '') + '>' + esc(c.label) + '</option>').join('') + '</select></label>'
    + '<div class="row hint">' + (ui.trigAll ? 'Showing every flow in this galaxy.' : 'Showing flows that start at <span class="mono">' + esc(s.to) + '</span>' + (tc.hidden ? ' · ' + tc.hidden + ' hidden' : '') + '.')
    + ' <button type="button" class="btn sm" data-act="trig-all">' + (ui.trigAll ? 'Filter by ' + esc(s.to) : 'Show all') + '</button></div>'
    + triggerLink(s)
    + triggerHint(s)
    + '</section><section class="sec"><h2 class="lbl"><button type="button" class="sec-toggle" data-act="msg-toggle" aria-expanded="' + ui.msgOpen + '" aria-controls="msg-body"><span class="caret" aria-hidden="true">' + (ui.msgOpen ? '▾' : '▸') + '</span>Message &amp; data</button></h2>'
    + (ui.msgOpen
      ? '<div id="msg-body" class="sec-body">'
        + typePicker('message', 'Message type', 'what is sent', s.message, null)
        + resultField(f, s)
        + '<label class="f">Example data <span class="hint" style="font-weight:400">YAML, field: value per line</span><textarea class="field mono" id="st-data" rows="4" placeholder="orderId: ord_1042">' + esc(dataText) + '</textarea></label>'
        + (draftData && draftData.error ? '<p class="err">' + esc(draftData.error) + '</p>' : '')
        + '<div id="data-check" class="sec" style="border:0;padding:0">' + dataCheck(s) + '</div></div>'
      : msgSummary(s))
    + '</section><section class="sec"><h2 class="lbl">Description</h2><div class="mdbox"><div class="mdtools" role="toolbar" aria-label="Formatting">'
    + [['h', 'Heading', 'H'], ['b', 'Bold', 'B'], ['i', 'Italic', '<em style="font-family:Georgia,serif">I</em>'], ['link', 'Link', icon('link')], ['code', 'Code', '<span class="mono" style="font-size:11px">&lt;/&gt;</span>'], ['ul', 'Bulleted list', icon('list')], ['quote', 'Quote', '<span style="font-family:Georgia,serif;font-size:18px">“</span>']]
      .map(([k, n, g]) => '<button type="button" class="tb" data-act="fmt" data-v="' + k + '" aria-label="' + n + '"' + (ui.descPreview ? ' disabled' : '') + '>' + g + '</button>').join('')
    + '<span class="spacer"></span><div class="seg" role="group" aria-label="Description view" style="padding:2px"><button type="button" data-act="desc-mode" data-v="write" aria-pressed="' + !ui.descPreview + '" style="min-height:26px">Write</button><button type="button" data-act="desc-mode" data-v="preview" aria-pressed="' + ui.descPreview + '" style="min-height:26px">Preview</button></div></div>'
    + (ui.descPreview ? '<div class="prose preview">' + md(s.description) + '</div>' : '<textarea id="st-desc" rows="7" placeholder="Markdown: **bold**, *italic*, [links](https://…), lists">' + esc(s.description) + '</textarea>')
    + '</div></section><section class="sec">'
    + (ui.confirm && ui.confirm.kind === 'step' ? '<div class="confirm">Delete step ' + s.n + '? Later steps are renumbered. <button type="button" class="btn sm danger" data-act="step-del-yes">Delete</button><button type="button" class="btn sm" data-act="confirm-no">Cancel</button></div>'
      : '<button type="button" class="btn danger" data-act="step-del">Delete step</button>')
    + '</section>';
}

function itemCard(it, on) {
  const s = it.step;
  return '<article class="card' + (on ? ' on' : '') + '"><div class="row"><span class="nb" style="background:' + (on ? 'var(--accent)' : chainColor(it.chain)) + '">' + esc(dk(it)) + '</span><div style="min-width:0"><div style="font-weight:800;font-size:15px">' + esc(it.label || '(no label)') + '</div><div class="mono" style="color:var(--muted);font-size:11px">' + esc(toLocal(it.from)) + ' → ' + esc(toLocal(it.to)) + (it.depth ? ' · in ' + esc(it.system) + '/' + esc(it.flow) : ' · chain ' + it.chain) + '</div></div></div>'
    + ((s.message || s.tags.length || s.triggers || s.result) ? '<div class="row" style="gap:4px">' + (s.message ? '<span class="chip type" title="' + esc(s.message) + '">' + esc(tt(s.message)) + '</span>' : '') + s.tags.map((t) => '<span class="chip">#' + esc(t) + '</span>').join('') + (s.triggers ? '<span class="chip trig">triggers ' + esc(s.triggers) + '</span>' : '') + (s.result ? '<span class="chip ret" title="' + esc(s.result) + '">returns ' + esc(tt(s.result)) + '</span>' : '') + '</div>' : '')
    + '<div class="prose">' + md(s.description) + '</div>'
    + (Object.keys(s.data).length ? '<pre class="data">' + esc(jsyaml.dump(s.data, { lineWidth: -1, schema: jsyaml.JSON_SCHEMA }).replace(/\n$/, '')) + '</pre>' : '')
    + '</article>';
}
const activeItems = () => { const sc = script(); const ph = C.phasesAt(sc.items, ui.playT); return sc.items.filter((it) => ph.get(it.key).phase === 'active'); };
function playPanel() {
  const sc = script();
  if (!sc.items.length) return '<section class="sec"><h2 class="lbl">Playing</h2><p class="hint">This flow has no steps yet.</p></section>';
  if (ui.playView === 'slides') return '<section class="sec"><h2 class="lbl">Slides</h2><p class="hint">One slide per step in play order; concurrent chains interleave and sub-flow steps follow the step that triggered them. Use <kbd>←</kbd> <kbd>→</kbd> to move.</p></section>';
  const act = activeItems();
  if (!act.length) {
    const done = ui.playT >= sc.length;
    return '<section class="sec"><h2 class="lbl">' + (done ? 'Finished' : 'Ready') + '</h2><p class="hint">' + (done ? 'All ' + plural(sc.items.length, 'step') + ' played. Press play to start again.' : 'Press play, or press <kbd>Space</kbd>.') + '</p></section>';
  }
  return '<section class="sec"><h2 class="lbl">In flight' + (act.length > 1 ? ' · ' + act.length + ' concurrent' : '') + '</h2>' + act.map((it) => itemCard(it, true)).join('') + '</section>';
}

/* ---------- render: stage & playbar ---------- */
/** Expand all / Collapse all for the included systems (the home system always shows in full). */
function foldAllBar() {
  const inc = model.system.includes.filter((x) => libModels().has(x));
  if (!inc.length) return '';
  const allFolded = inc.every((x) => ui.folded.has(x)), noneFolded = !inc.some((x) => ui.folded.has(x));
  return '<div class="row" style="gap:4px"><button type="button" class="btn sm" data-act="fold-all" data-v="expand"' + (noneFolded ? ' disabled' : '') + '>Expand all</button><button type="button" class="btn sm" data-act="fold-all" data-v="collapse"' + (allFolded ? ' disabled' : '') + '>Collapse all</button></div>';
}
function camBar(scene) {
  if (scene.rings.length < 2) return '';
  return '<span class="spacer"></span><div class="row" style="gap:4px"><button type="button" class="btn icon sm" data-act="zoom" data-v="out" aria-label="Zoom out">' + icon('minus') + '</button><button type="button" class="btn icon sm" data-act="zoom" data-v="in" aria-label="Zoom in">' + icon('plus') + '</button><button type="button" class="btn sm" data-act="zoom" data-v="fit">' + icon('fit') + 'Fit</button></div>';
}
let lastScene = null;
function renderStage() {
  const el = $('stage');
  if (ui.mode === 'system') {
    const scene = buildScene(false, false, new Set());
    lastScene = scene;
    el.innerHTML = '<div class="stagebar"><span class="chip">' + plural(model.system.participants.length, 'participant') + ' · evenly spaced</span></div>'
      + sceneSvg(scene, { sublabel: () => plural(model.system.participants.length, 'participant'), nodeHits: true, selectedNode: (ref) => ui.sel && ui.sel.type === 'participant' && ref === homeSlug() + '.' + ui.sel.slug, drag: ui.drag });
    return;
  }
  if (ui.mode === 'galaxy') {
    const scene = buildScene(true, false, new Set());
    lastScene = scene;
    el.innerHTML = '<div class="stagebar"><span class="chip">' + esc(model.system.label) + ' + ' + plural(model.system.includes.length, 'included system') + '</span>' + camBar(scene) + '</div>'
      + sceneSvg(scene, { sublabel: (r) => (r.home ? 'home system' : ''), ringHits: true, shadeIdle: true, selectedRing: (slug) => ui.sel && ui.sel.type === 'system' && ui.sel.slug === slug });
    return;
  }
  const f = flow();
  if (ui.mode === 'flow') {
    const scene = buildScene(true, false, ui.folded);
    const next = f.steps.reduce((m, s) => Math.max(m, s.n), 0) + 1;
    const selKey = ui.sel && ui.sel.type === 'step' ? String(ui.sel.n) : null;
    const viewSeg = '<div class="seg" role="group" aria-label="Flow view">' + [['orbit', 'System'], ['sequence', 'Sequence']].map(([v, n]) => '<button type="button" data-act="flow-view" data-v="' + v + '" aria-pressed="' + (ui.flowView === v) + '">' + n + '</button>').join('') + '</div>';
    if (ui.flowView === 'sequence') {
      lastScene = null;
      el.innerHTML = '<div class="stagebar">' + viewSeg + '<span class="chip" style="color:' + chainColor(ui.chain) + '">' + esc(f.name) + ' · chain ' + ui.chain + '</span>'
        + (ui.pending ? '<span class="chip">from ' + esc(ui.pending.from) + ' → click a heading for step ' + next + '</span><button type="button" class="btn sm" data-act="cancel">Cancel <kbd>Esc</kbd></button>' : '<span class="hint">Click one heading, then another, to add a step.</span>') + '</div>'
        + seqSvg(flowSeqItems(f), (k) => (selKey !== null && (k === selKey || k.startsWith(selKey + '.')) ? 'sel' : 'normal'), false, { editable: true, pendingFrom: ui.pending ? C.absRef(homeSlug(), ui.pending.from) : null });
      return;
    }
    lastScene = scene;
    el.innerHTML = '<div class="stagebar">' + viewSeg + '<span class="chip" style="color:' + chainColor(ui.chain) + '">' + esc(f.name) + ' · chain ' + ui.chain + '</span>'
      + (ui.pending ? '<span class="chip">from ' + esc(ui.pending.from) + (ui.pending.after !== null ? ' · after ' + ui.pending.after : '') + '</span><button type="button" class="btn sm" data-act="cancel">Cancel <kbd>Esc</kbd></button>' : '') + camBar(scene) + foldAllBar() + '</div>'
      + sceneSvg(scene, {
        sublabel: (r) => (r.home ? 'flow · ' + f.name : ''), items: homeItems(f), nodeHits: true, badgeAct: 'fork', shadeIdle: true, foldToggles: true,
        stateOf: (k) => (selKey === null ? 'normal' : k === selKey ? 'sel' : 'normal'), labels: (k) => k === selKey,
        pending: ui.pending ? { from: C.absRef(homeSlug(), ui.pending.from), next } : null, cursor: ui.cursor
      });
    return;
  }
  const sc = script();
  const ph = C.phasesAt(sc.items, ui.playT);
  const stateOf = (k) => { const p = ph.get(k).phase; return p === 'active' ? 'active' : p === 'todo' ? 'dim' : 'normal'; };
  if (ui.playView === 'orbit') {
    const scene = buildScene(true, ui.collapse, new Set());
    lastScene = scene;
    el.innerHTML = '<div class="stagebar"><span class="chip">' + esc(f.name) + (sc.items.some((i) => i.depth) ? ' · with sub-flows' : '') + '</span>' + camBar(scene) + '</div>'
      + sceneSvg(scene, {
        sublabel: (r) => (r.home ? 'playing · ' + f.name : ''), items: sc.items, stateOf, labels: (k) => ph.get(k).phase === 'active', badgeAct: 'jump',
        dots: sc.items.filter((it) => ph.get(it.key).phase === 'active').map((it) => ({ key: it.key, p: ph.get(it.key).p }))
      });
  } else if (ui.playView === 'sequence') {
    lastScene = null;
    el.innerHTML = seqSvg(sc.items, stateOf, false);
  } else {
    lastScene = null;
    el.innerHTML = slideHtml(sc);
  }
}
function slideIndex(sc) {
  if (ui.slideK !== undefined && ui.slideK < sc.items.length) return ui.slideK;
  const k = sc.items.findIndex((it) => it.start >= Math.floor(ui.playT));
  return k < 0 ? sc.items.length - 1 : k;
}
function slideHtml(sc) {
  if (!sc.items.length) return '<p class="hint">No steps to show.</p>';
  const idx = slideIndex(sc), it = sc.items[idx], s = it.step;
  const concurrent = sc.items.filter((x) => x.key !== it.key && x.start === it.start);
  return '<div class="slidenav"><button type="button" class="btn" data-act="slide" data-v="-1" ' + (idx ? '' : 'disabled') + '>← Back</button><span class="hint">Slide ' + (idx + 1) + ' of ' + sc.items.length + '</span><button type="button" class="btn primary" data-act="slide" data-v="1" ' + (idx < sc.items.length - 1 ? '' : 'disabled') + '>Next →</button></div>'
    + '<div class="slide"><div style="min-width:0">' + seqSvg(sc.items, (k) => (k === it.key ? 'sel' : sc.items.findIndex((x) => x.key === k) < idx ? 'normal' : 'dim'), true) + '</div>'
    + '<div style="display:flex;flex-direction:column;gap:12px;min-width:0"><div class="row"><span class="nb" style="background:var(--accent);min-width:38px;height:38px;font-size:15px">' + esc(dk(it)) + '</span><div style="min-width:0"><h2>' + esc(it.label || '(no label)') + '</h2><div class="mono" style="color:var(--muted)">' + esc(toLocal(it.from)) + ' → ' + esc(toLocal(it.to)) + (it.depth ? ' · in ' + esc(it.system) + '/' + esc(it.flow) : '') + '</div></div></div>'
    + '<div class="row" style="gap:4px">' + (s.message ? '<span class="chip type" title="' + esc(s.message) + '">' + esc(tt(s.message)) + '</span>' : '') + s.tags.map((t) => '<span class="chip">#' + esc(t) + '</span>').join('') + (s.triggers ? '<span class="chip trig">triggers ' + esc(s.triggers) + '</span>' : '') + (s.result ? '<span class="chip ret" title="' + esc(s.result) + '">returns ' + esc(tt(s.result)) + '</span>' : '') + concurrent.map((x) => '<span class="chip" style="color:' + chainColor(x.chain) + '">alongside ' + esc(dk(x)) + ' · ' + esc(x.label) + '</span>').join('') + '</div>'
    + '<div class="prose">' + md(s.description) + '</div>'
    + (Object.keys(s.data).length ? '<pre class="data">' + esc(jsyaml.dump(s.data, { lineWidth: -1, schema: jsyaml.JSON_SCHEMA }).replace(/\n$/, '')) + '</pre>' : '')
    + '</div></div>'
    + '<div class="dots" role="group" aria-label="Slides">' + sc.items.map((x, k) => '<button type="button" data-act="slide-to" data-v="' + k + '" aria-current="' + (k === idx) + '" class="' + (k < idx ? 'past' : '') + '" aria-label="Slide ' + (k + 1) + ', step ' + esc(dk(x)) + '">' + esc(dk(x)) + '</button>').join('') + '</div>';
}

function renderPlaybar() {
  const el = $('playbar');
  el.hidden = ui.mode !== 'play' || ui.playView === 'slides';
  if (el.hidden) return;
  const sc = script(), ph = C.phasesAt(sc.items, ui.playT);
  const lanes = [];
  sc.items.forEach((it) => { if (!lanes.includes(it.lane)) lanes.push(it.lane); });
  const cols = 'grid-template-columns: 110px repeat(' + Math.max(sc.length, 1) + ', minmax(40px, 1fr))';
  const laneName = (lane) => {
    const it = sc.items.find((x) => x.lane === lane);
    return it.depth ? '↳ ' + it.parent + ' ' + it.system + (it.chain === 'A' ? '' : ' ' + it.chain) : 'Chain ' + it.chain;
  };
  const rows = lanes.map((lane) => {
    const it0 = sc.items.find((x) => x.lane === lane);
    return '<div class="lane" style="' + cols + '"><span style="font-size:12px;font-weight:800;color:' + chainColor(it0.chain) + ';white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + esc(laneName(lane)) + '</span>'
      + Array.from({ length: sc.length }, (_, k) => {
        const it = sc.items.find((x) => x.lane === lane && x.start === k);
        if (!it) return '<span></span>';
        const p = ph.get(it.key).phase;
        return '<span style="display:flex;justify-content:center"><button type="button" class="nb' + (p === 'todo' ? ' todo' : '') + '" data-act="jump" data-v="' + esc(it.key) + '" aria-label="Jump to step ' + esc(dk(it)) + '" style="border:0;cursor:pointer;' + (p === 'todo' ? '' : 'background:' + (p === 'active' ? 'var(--accent)' : chainColor(it.chain))) + '">' + esc(dk(it)) + '</button></span>';
      }).join('') + '</div>';
  }).join('');
  const head = sc.length ? 'left: calc(110px + (100% - 110px) * ' + (ui.playT / sc.length).toFixed(4) + ')' : 'display:none';
  el.innerHTML = '<div class="row">'
    + '<button type="button" class="btn icon" data-act="step-back" aria-label="Previous beat">' + icon('prev', true) + '</button>'
    + '<button type="button" class="btn icon primary" data-act="play" aria-label="' + (ui.playing ? 'Pause' : 'Play') + '">' + icon(ui.playing ? 'pause' : 'play', true) + '</button>'
    + '<button type="button" class="btn icon" data-act="step-fwd" aria-label="Next beat">' + icon('next', true) + '</button></div>'
    + '<label style="flex:1 1 200px;display:flex;align-items:center;gap:10px"><span class="lbl" style="flex:none">Time</span><input type="range" id="play-pos" min="0" max="' + Math.max(1, sc.length * 1000) + '" value="' + Math.round(ui.playT * 1000) + '" ' + (sc.length ? '' : 'disabled') + '></label>'
    + '<span class="pos" id="play-txt">' + posText(sc) + '</span>'
    + '<label class="row" style="gap:6px"><span class="lbl">Speed</span><select class="field" id="play-speed" style="width:auto;min-height:32px;padding:2px 8px">' + [0.25, 0.5, 1, 2, 4].map((v) => '<option value="' + v + '"' + (v === ui.speed ? ' selected' : '') + '>' + v + '×</option>').join('') + '</select></label>'
    + (sc.length ? '<div class="lanes">' + rows + '<div class="playhead" id="playhead" style="' + head + '"></div></div>' : '');
}
const posText = (sc) => (sc.length ? 'beat ' + Math.min(sc.length, Math.floor(ui.playT) + 1) + ' / ' + sc.length : 'no steps');

/* ---------- render: markdown drawer ---------- */
function renderDrawer() {
  const d = $('drawer');
  d.hidden = !ui.mdOpen;
  if (!ui.mdOpen) return;
  if (!document.getElementById('md-text')) {
    d.innerHTML = '<header><strong class="mono" style="font-size:13px" id="md-name"></strong><span class="spacer"></span><button type="button" class="btn sm" data-act="copy">Copy</button><button type="button" class="btn sm" data-act="md" aria-label="Close markdown">Close</button></header>'
      + '<div class="msg" id="md-msg"></div><label for="md-text" class="lbl" style="position:absolute;left:-9999px">Markdown source</label><div class="md-edit"><pre id="md-gutter" aria-hidden="true"></pre><textarea id="md-text" spellcheck="false" wrap="off"></textarea></div>';
    const ta = document.getElementById('md-text');
    ta.addEventListener('scroll', () => { $('md-gutter').scrollTop = ta.scrollTop; });
  }
  document.getElementById('md-name').textContent = homeSlug() + '.flow.md';
  const t = document.getElementById('md-text');
  if (document.activeElement !== t && t.value !== ui.mdText) t.value = ui.mdText;
  updateGutter();
  const m = document.getElementById('md-msg');
  m.className = 'msg ' + (ui.mdError ? 'bad' : 'good');
  m.textContent = ui.mdError ? ui.mdError.message + ' The canvas shows the last version that read cleanly.' : 'In sync. Edit here and the canvas follows; edit the canvas and this updates.';
}

/** Line numbers beside the Markdown source; the line a parse error points to is marked. */
function updateGutter() {
  const t = document.getElementById('md-text'), g = document.getElementById('md-gutter');
  if (!t || !g) return;
  const count = t.value.split('\n').length;
  const bad = ui.mdError ? ui.mdError.line : null;
  let html = '';
  for (let i = 1; i <= count; i++) html += (i === bad ? '<span class="bad">' + i + '</span>' : i) + '\n';
  g.innerHTML = html;
  g.scrollTop = t.scrollTop;
}

/* ---------- render orchestration ---------- */
function render(opts) {
  const skip = (opts && opts.skip) || [];
  const focus = document.activeElement;
  const fid = focus && focus.id ? focus.id : null;
  let selStart = null, selEnd = null, scroll = 0;
  if (fid && 'selectionStart' in focus) { try { selStart = focus.selectionStart; selEnd = focus.selectionEnd; scroll = focus.scrollTop; } catch (e) { selStart = null; } }
  if (!skip.includes('header')) renderHeader();
  if (!skip.includes('left')) renderLeft();
  if (!skip.includes('right')) renderRight();
  if (!skip.includes('stage')) renderStage();
  if (!skip.includes('playbar')) renderPlaybar();
  renderDrawer();
  if (!skip.includes('modal')) renderModal();
  syncHash();
  if (fid && document.activeElement !== document.getElementById(fid)) {
    const el = document.getElementById(fid);
    if (el) {
      el.focus({ preventScroll: true });
      if (selStart !== null && 'setSelectionRange' in el) { try { el.setSelectionRange(selStart, selEnd); el.scrollTop = scroll; } catch (e) { /* range and select inputs have no caret */ } }
    }
  }
}

/* ---------- actions ---------- */
function setMode(m) {
  ui.mode = m; ui.pending = null; ui.cursor = null; ui.confirm = null; ui.drag = null; ui.ringDrag = null; ui.press = null; ui.cam = null;
  if (m !== 'play') stopPlay();
  if (ui.sel && !((m === 'system' && ui.sel.type === 'participant') || (m === 'flow' && ui.sel.type === 'step') || (m === 'galaxy' && ui.sel.type === 'system'))) ui.sel = null;
  render();
}
/** ref: as drawn (fully qualified). Steps store home participants as bare slugs. */
function clickNode(absRef) {
  const ref = toLocal(absRef);
  const f = flow();
  if (!ui.pending) {
    ui.pending = { from: ref, chain: ui.chain, after: C.chainTail(f, ui.chain) };
    render({ skip: ['left'] });
    return;
  }
  const r = attempt(() => C.addStep(model, f.slug, { from: ui.pending.from, to: ref, chain: ui.pending.chain, after: ui.pending.after }));
  if (!r) return;
  ui.chain = ui.pending.chain;
  ui.pending = { from: ref, chain: ui.pending.chain, after: r.n };
  ui.sel = { type: 'step', n: r.n };
  ui.confirm = null;
  commit(r.model);
  // Ready to label: focus the new step's label so typing names it; the next canvas click still adds a step.
  const label = $('st-label');
  label.focus({ preventScroll: true });
  label.select();
}
function forkFrom(n) {
  const f = flow(), s = C.findStep(f, n);
  const c = attempt(() => C.nextChain(f));
  if (!c) return;
  ui.chain = c;
  ui.pending = { from: s.to, chain: c, after: n };
  ui.mode = 'flow';
  toast('New chain ' + c + ' from step ' + n + ': click the next participant (or ' + titleOfRef(s.to) + ' again for a self-message).');
  render();
}
function jumpTo(key) {
  const sc = script(), k = sc.items.findIndex((it) => it.key === key);
  if (k < 0) throw new Error('bug: no play item ' + key);
  stopPlay();
  ui.playT = sc.items[k].start + 0.5;
  ui.slideK = k;
  render();
}
function stepPlay(dir) {
  const sc = script();
  stopPlay();
  const beat = Math.floor(ui.playT + 1e-9);
  ui.playT = Math.min(sc.length, Math.max(0, dir > 0 ? beat + 1 : (ui.playT - beat < 0.05 ? beat - 1 : beat)));
  ui.slideK = undefined;
  render();
}
function moveSlide(k) {
  const sc = script();
  const idx = Math.max(0, Math.min(sc.items.length - 1, k));
  ui.slideK = idx;
  ui.playT = sc.items[idx].start + 0.5;
  render();
}
function zoom(v) {
  if (!lastScene) return;
  const cur = ui.cam || sceneBounds(lastScene);
  if (v === 'fit') { ui.cam = null; renderStage(); return; }
  const k = v === 'in' ? 0.8 : 1.25;
  const cx = cur.x + cur.w / 2, cy = cur.y + cur.h / 2;
  ui.cam = { x: cx - (cur.w * k) / 2, y: cy - (cur.h * k) / 2, w: cur.w * k, h: cur.h * k };
  renderStage();
}

/* ---------- play clock ---------- */
let raf = 0, lastTs = 0;
function frame(ts) {
  if (!ui.playing) return;
  const dt = lastTs ? Math.min(0.1, (ts - lastTs) / 1000) : 0;
  lastTs = ts;
  const sc = script();
  const before = activeKey();
  ui.playT = Math.min(sc.length, ui.playT + (dt * ui.speed) / SLOT_SECONDS);
  if (ui.playT >= sc.length) ui.playing = false;
  const changed = activeKey() !== before || !ui.playing;
  renderStage();
  if (changed) { renderRight(); renderLeft(); renderPlaybar(); }
  else updatePlaybarLive(sc);
  if (ui.playing) raf = requestAnimationFrame(frame);
}
const activeKey = () => activeItems().map((it) => it.key).join(',');
function updatePlaybarLive(sc) {
  const r = document.getElementById('play-pos');
  if (r && !ui.scrubbing) r.value = String(Math.round(ui.playT * 1000));
  const t = document.getElementById('play-txt');
  if (t) t.textContent = posText(sc);
  const h = document.getElementById('playhead');
  if (h && sc.length) h.style.left = 'calc(110px + (100% - 110px) * ' + (ui.playT / sc.length).toFixed(4) + ')';
}
function startPlay() {
  const sc = script();
  if (!sc.length) { toast('This flow has no steps to play.'); return; }
  if (ui.playT >= sc.length) ui.playT = 0;
  ui.playing = true; lastTs = 0; ui.slideK = undefined;
  renderPlaybar();
  raf = requestAnimationFrame(frame);
}
function stopPlay() {
  if (!ui.playing) return;
  ui.playing = false;
  cancelAnimationFrame(raf);
}

/* ---------- description formatting ---------- */
function applyFormat(kind) {
  const ta = document.getElementById('st-desc');
  if (!ta) throw new Error('bug: format without the description editor');
  const a = ta.selectionStart, b = ta.selectionEnd, v = ta.value, sel = v.slice(a, b);
  const wrap = (l, r, ph) => { const t = sel || ph; return { text: v.slice(0, a) + l + t + r + v.slice(b), s: a + l.length, e: a + l.length + t.length }; };
  const lines = (prefix) => {
    const ls = v.lastIndexOf('\n', a - 1) + 1;
    const block = v.slice(ls, b).split('\n').map((x) => prefix + x).join('\n');
    return { text: v.slice(0, ls) + block + v.slice(b), s: ls, e: ls + block.length };
  };
  const ops = {
    b: () => wrap('**', '**', 'bold'), i: () => wrap('*', '*', 'italic'), code: () => wrap('`', '`', 'code'),
    link: () => wrap('[', '](https://)', 'link text'), h: () => lines('### '), ul: () => lines('- '), quote: () => lines('> ')
  };
  if (!ops[kind]) throw new Error('bug: unknown format ' + kind);
  const r = ops[kind]();
  commit(C.updateStep(model, flow().slug, ui.sel.n, { description: r.text }), { key: 'desc' + ui.sel.n, skip: ['right'] });
  ta.value = r.text;
  ta.focus();
  ta.setSelectionRange(r.s, r.e);
}

/* ---------- click handling (event delegation) ---------- */
document.addEventListener('click', (e) => {
  const inMenu = e.target.closest('#file-menu-wrap');
  const t = e.target.closest('[data-act]');
  if (ui.fileMenu && (!inMenu || (t && t.getAttribute('data-act') !== 'file-menu'))) { ui.fileMenu = false; renderHeader(); }
  if (!t) return;
  const v = t.getAttribute('data-v');
  const f = flow();
  const sel = ui.sel;
  const acts = {
    mode: () => setMode(v),
    undo, redo,
    md: () => { ui.mdOpen = !ui.mdOpen; if (ui.mdOpen && !ui.mdError) ui.mdText = C.serialize(model); render({ skip: ['left', 'right', 'stage', 'playbar'] }); },
    'file-menu': () => setFileMenu(!ui.fileMenu, true),
    download: () => downloadMd(),
    load: () => $('file-in').click(),
    'new-sys': () => newSystem(),
    'confirm-no': () => { ui.confirm = null; render(); },
    cancel: () => { ui.pending = null; ui.cursor = null; render(); },
    zoom: () => zoom(v),
    'add-part': () => {
      const r = C.addParticipant(model, v);
      ui.sel = { type: 'participant', slug: r.slug };
      commit(r.model);
      // Ready to rename: focus the title with its text selected, so typing replaces it.
      const title = $('pt-title');
      title.focus();
      title.select();
    },
    'sys-fill': () => commit(C.updateSystem(model, { fill: v })),
    'sys-del': () => { ui.sysDel = { opener: t.isConnected ? t : $('file-menu-btn') }; renderModal(); $('sd-cancel').focus(); },
    'sys-del-no': () => closeSysDel(),
    'sys-del-yes': () => { ui.sysDel = null; renderModal(); deleteHome(); },
    'pick-part': () => { ui.sel = { type: 'participant', slug: v }; ui.confirm = null; render(); },
    'pt-fill': () => commit(C.updateParticipant(model, sel.slug, { fill: v }).model),
    'pt-move': () => {
      const parts = model.system.participants, i = C.participantIndex(model, sel.slug);
      const j = (i + Number(v) + parts.length) % parts.length;
      if (i !== j) commit(C.swapParticipants(model, sel.slug, parts[j].slug));
    },
    'pt-del': () => { ui.confirm = { kind: 'part' }; renderRight(); },
    'pt-del-yes': () => { const s = sel.slug; ui.confirm = null; ui.sel = null; commit(C.removeParticipant(model, s)); },
    desel: () => { ui.sel = null; ui.confirm = null; render(); },
    'pick-ring': () => { ui.sel = { type: 'system', slug: v }; ui.confirm = null; render(); },
    'sys-move': () => {
      // Swap with the neighbouring slot, wrapping round the galaxy (same as moving a participant).
      const inc = model.system.includes, i = inc.indexOf(sel.slug);
      if (i < 0) throw new Error('bug: moving a system that is not included');
      const j = (i + Number(v) + inc.length) % inc.length;
      if (i !== j) commit(C.swapIncludes(model, sel.slug, inc[j]));
    },
    include: () => { const m = attempt(() => C.includeSystem(model, v)); if (m) { ui.sel = { type: 'system', slug: v }; ui.cam = null; commit(m); } },
    'add-examples': () => {
      const lib = libModels();
      C.exampleSystems().filter((m) => !lib.has(m.system.slug)).forEach((m) => { library.set(m.system.slug, { model: m, text: null, error: null, sample: false }); markDirty(m.system.slug); });
      persistSamples();
      render();
      toast('Added the example systems. Include them below.');
    },
    exclude: () => { ui.confirm = { kind: 'exclude' }; renderRight(); },
    'exclude-yes': () => { const s = sel.slug; ui.confirm = null; ui.sel = null; ui.cam = null; commit(C.removeInclude(model, s)); },
    'open-sys': () => { openHome(v); ui.mode = 'system'; render(); },
    'add-flow': () => {
      const r = C.addFlow(model);
      ui.flow = r.slug; ui.sel = null; ui.pending = null; ui.chain = 'A';
      commit(r.model);
      const el = $('flow-name'); // name it straight away: the slug follows as you type
      el.focus(); el.select();
    },
    'pick-flow': () => { ui.flow = v; ui.sel = null; ui.pending = null; ui.chain = 'A'; ui.playT = 0; ui.slideK = undefined; stopPlay(); ui.confirm = null; render(); },
    'flow-del': () => { ui.confirm = { kind: 'flow' }; renderRight(); },
    'flow-del-yes': () => { const r = attempt(() => C.removeFlow(model, f.slug)); ui.confirm = null; if (r) { ui.sel = null; commit(r); } },
    'pick-step': () => { const s = C.findStep(f, Number(v)); ui.sel = { type: 'step', n: s.n }; ui.chain = s.chain; ui.pending = null; ui.confirm = null; render(); },
    fork: () => forkFrom(Number(v)),
    fold: () => { const next = new Set(ui.folded); if (next.has(v)) next.delete(v); else next.add(v); ui.folded = next; ui.cam = null; renderStage(); },
    'fold-all': () => {
      if (v !== 'expand' && v !== 'collapse') throw new Error('bug: fold-all ' + v);
      ui.folded = v === 'collapse' ? new Set(model.system.includes.filter((x) => libModels().has(x))) : new Set();
      ui.cam = null; renderStage();
    },
    'msg-toggle': () => { ui.msgOpen = !ui.msgOpen; ui.tp = null; renderRight(); document.querySelector('[data-act="msg-toggle"]').focus(); },
    'flow-view': () => { ui.flowView = v; ui.cursor = null; renderStage(); },
    'step-nav': () => { const s = C.findStep(f, Number(v)); ui.sel = { type: 'step', n: s.n }; ui.chain = s.chain; ui.pending = null; ui.confirm = null; ui.drafts.data = null; render(); },
    'step-async': () => commit(C.updateStep(model, f.slug, sel.n, { async: v === 'async' })),
    'row-async': () => { const n = Number(v); commit(C.updateStep(model, f.slug, n, { async: !C.findStep(f, n).async })); },
    'tag-del': () => commit(C.updateStep(model, f.slug, sel.n, { tags: C.findStep(f, sel.n).tags.filter((x) => x !== v) })),
    fmt: () => applyFormat(v),
    'desc-mode': () => { ui.descPreview = v === 'preview'; renderRight(); },
    'trig-all': () => { ui.trigAll = !ui.trigAll; renderRight(); },
    'step-del': () => { ui.confirm = { kind: 'step' }; renderRight(); },
    'step-del-yes': () => { const n = sel.n; ui.confirm = null; ui.sel = null; ui.pending = null; commit(C.removeStep(model, f.slug, n)); },
    view: () => { ui.playView = v; if (v === 'slides') stopPlay(); render(); },
    jump: () => jumpTo(v),
    play: () => { if (ui.playing) { stopPlay(); renderPlaybar(); } else startPlay(); },
    'step-back': () => stepPlay(-1), 'step-fwd': () => stepPlay(1),
    slide: () => moveSlide(slideIndex(script()) + Number(v)),
    'slide-to': () => moveSlide(Number(v)),
    copy: () => copyMd(),
    'tp-pick': () => chooseType(t.getAttribute('data-k'), v, t.getAttribute('data-new') === '1'),
    'tp-clear': () => { ui.tp = null; commit(C.updateStep(model, f.slug, sel.n, { [v]: null })); },
    'open-schema': () => openSchema(v),
    'fill-data': () => { const s = C.findStep(f, sel.n); ui.drafts.data = null; commit(C.updateStep(model, f.slug, s.n, { data: C.fillData(types(), s.message, s.data) })); },
    'sc-close': () => closeSchema(),
    'sf-add': () => addDraftField(),
    'sf-del': () => { ui.schema.draft.fields.splice(Number(v), 1); applySchemaDraft(); },
    'sc-del': () => { ui.schema.confirmDel = true; renderModal(); },
    'sc-del-no': () => { ui.schema.confirmDel = false; renderModal(); },
    'sc-del-yes': () => { const n = ui.schema.orig; ui.schema = null; commit(C.removeSchema(model, n)); toast('Deleted type ' + n + '.'); },
    'sc-open-sys': () => {
      const sys = ui.schema.system;
      const id = [...library.entries()].find(([, e]) => e.model && e.model.system.slug === sys);
      if (!id) throw new Error('bug: no saved system ' + sys);
      const name = ui.schema.draft.slug;
      ui.schema = null;
      openHome(id[0]);
      ui.mode = 'flow';
      render();
      openSchema(name);
    }
  };
  if (!acts[t.getAttribute('data-act')]) throw new Error('bug: no action ' + t.getAttribute('data-act'));
  acts[t.getAttribute('data-act')]();
});

/* ---------- reordering steps in the list ---------- */
/** Move step n to position `to` in its chain, keep it selected (by its new number) and focused. */
function moveStepTo(n, to) {
  const f = flow();
  const r = attempt(() => C.moveStep(model, f.slug, n, to));
  if (!r || r.model === model) return;
  ui.sel = { type: 'step', n: r.n };
  ui.pending = null; ui.confirm = null; ui.drafts.data = null;
  commit(r.model);
  const btn = document.querySelector('#left [data-act="pick-step"][data-v="' + r.n + '"]');
  if (btn) btn.focus();
  toast('Moved to step ' + r.n + '.');
}
let stepDrag = null; // { n, chain }
const clearDropMarks = () => document.querySelectorAll('#left .drop-before, #left .drop-after, #left .dragging').forEach((el) => el.classList.remove('drop-before', 'drop-after', 'dragging'));
const left = $('left');
left.addEventListener('dragstart', (e) => {
  const li = e.target.closest('li[data-drag-n]');
  if (!li || ui.mode !== 'flow') return;
  stepDrag = { n: Number(li.dataset.dragN), chain: li.dataset.chain };
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/plain', String(stepDrag.n));
  li.classList.add('dragging');
});
left.addEventListener('dragover', (e) => {
  const li = e.target.closest('li[data-drag-n]');
  if (!stepDrag || !li || li.dataset.chain !== stepDrag.chain) return; // steps move within their own chain
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
  const r = li.getBoundingClientRect(), before = e.clientY < r.top + r.height / 2;
  document.querySelectorAll('#left .drop-before, #left .drop-after').forEach((el) => el.classList.remove('drop-before', 'drop-after'));
  li.classList.add(before ? 'drop-before' : 'drop-after');
});
left.addEventListener('drop', (e) => {
  const li = e.target.closest('li[data-drag-n]');
  if (!stepDrag || !li || li.dataset.chain !== stepDrag.chain) return;
  e.preventDefault();
  const before = li.classList.contains('drop-before');
  const seq = C.chainSequence(flow(), stepDrag.chain).map((s) => s.n);
  const from = seq.indexOf(stepDrag.n), over = seq.indexOf(Number(li.dataset.dragN));
  if (from < 0 || over < 0) throw new Error('bug: dragged step not in its chain');
  let to = before ? over : over + 1;
  if (from < to) to -= 1;
  const n = stepDrag.n;
  stepDrag = null;
  clearDropMarks();
  moveStepTo(n, to);
});
left.addEventListener('dragend', () => { stepDrag = null; clearDropMarks(); });

/* ---------- input handling ---------- */
document.addEventListener('input', (e) => {
  const id = e.target.id, val = e.target.value;
  const f = flow();
  if (id === 'sys-label') { if (val.trim()) commit(C.updateSystem(model, { label: val }), { key: id, skip: ['left'] }); syncField('sys-slug', model.system.slug); return; }
  if (id === 'sys-opacity') { commit(C.updateSystem(model, { opacity: Number(val) / 100 }), { key: id, skip: ['left'] }); $('sys-op-v').textContent = val + '%'; return; }
  if (id === 'sys-reach') { commit(C.updateSystem(model, { selfReach: Number(val) / 100 }), { key: id, skip: ['left'] }); $('sys-sr-v').textContent = val + '%'; return; }
  if (id === 'pt-title') {
    if (!val.trim()) return;
    const old = ui.sel.slug;
    const r = C.updateParticipant(model, old, { title: val });
    ui.sel = { type: 'participant', slug: r.slug };
    if (r.slug !== old) propagateToIncluders((m) => C.renameExternalParticipant(m, homeSlug(), old, r.slug));
    commit(r.model, { key: id, skip: ['right'] });
    syncField('pt-slug', r.slug);
    return;
  }
  if (id === 'flow-name') {
    if (!val.trim()) return;
    const old = f.slug;
    const r = C.renameFlow(model, f.slug, val);
    ui.flow = r.slug;
    if (r.slug !== old) propagateToIncluders((m) => C.renameExternalFlow(m, homeSlug(), old, r.slug));
    commit(r.model, { key: id, skip: ['right'] });
    $('flow-slug').textContent = r.slug; // the panel isn't re-rendered while typing, so show the slug following the name
    return;
  }
  if (id === 'st-label') { commit(C.updateStep(model, f.slug, ui.sel.n, { label: val }), { key: id + ui.sel.n, skip: ['right'] }); return; }
  if (id === 'st-result') { const m = attempt(() => C.updateStep(model, f.slug, ui.sel.n, { result: val })); if (m) commit(m, { key: id + ui.sel.n, skip: ['right'] }); return; }
  if (id === 'tp-message' || id === 'tp-result') { ui.tp = { kind: id.slice(3), q: val, hi: 0 }; refreshRight(); return; }
  if (id === 'sc-title') {
    const d = ui.schema.draft;
    // The id follows the title (like participant slugs) while it still matches; an id steps already use stays.
    if (ui.schema.orig) d.slug = C.followTypeSlug(model, d.slug, d.title, val);
    d.title = val;
    applySchemaDraft(true);
    syncField('sc-slug', d.slug);
    return;
  }
  if (id === 'sc-summary') { ui.schema.draft.summary = val; applySchemaDraft(true); return; }
  if (/^sf-name-\d+$/.test(id)) { ui.schema.draft.fields[Number(id.slice(8))].name = val.trim(); applySchemaDraft(true); return; }
  if (id === 'st-message') { commit(C.updateStep(model, f.slug, ui.sel.n, { message: val }), { key: id + ui.sel.n, skip: ['right'] }); return; }
  if (id === 'st-desc') { commit(C.updateStep(model, f.slug, ui.sel.n, { description: val }), { key: id + ui.sel.n, skip: ['right'] }); return; }
  if (id === 'st-data') { editData(f, val); return; }
  if (id === 'play-pos') { ui.scrubbing = true; stopPlay(); ui.playT = Number(val) / 1000; ui.slideK = undefined; renderStage(); renderRight(); renderLeft(); updatePlaybarLive(script()); return; }
  if (id === 'md-text') { scheduleMdParse(val); updateGutter(); return; }
});
function syncField(id, value) {
  const el = document.getElementById(id);
  if (el && document.activeElement !== el) el.value = value;
}
function editData(f, text) {
  let parsed;
  try { parsed = text.trim() === '' ? {} : jsyaml.load(text, { schema: jsyaml.JSON_SCHEMA }); }
  catch (err) { ui.drafts.data = { flow: f.slug, n: ui.sel.n, text, error: 'Not valid YAML yet: ' + (err.reason || err.message) }; showDataError(); return; }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) { ui.drafts.data = { flow: f.slug, n: ui.sel.n, text, error: 'Data must be field: value lines, e.g. orderId: ord_1042' }; showDataError(); return; }
  ui.drafts.data = { flow: f.slug, n: ui.sel.n, text, error: null };
  showDataError();
  commit(C.updateStep(model, f.slug, ui.sel.n, { data: parsed }), { key: 'st-data' + ui.sel.n, skip: ['right'] });
  const dc = document.getElementById('data-check');
  if (dc) dc.innerHTML = dataCheck(C.findStep(flow(), ui.sel.n));
}
function showDataError() {
  const ta = document.getElementById('st-data');
  if (!ta) return;
  let p = ta.parentElement.nextElementSibling;
  if (!p || !p.classList.contains('err')) { p = document.createElement('p'); p.className = 'err'; ta.parentElement.after(p); }
  p.textContent = ui.drafts.data.error || '';
  p.hidden = !ui.drafts.data.error;
}
document.addEventListener('change', (e) => {
  const id = e.target.id, val = e.target.value;
  const f = flow();
  if (id === 'sys-pick') { if (val !== ui.homeDoc) { openHome(val); render(); } return; }
  if (id === 'sys-slug') { const m = attempt(() => C.updateSystem(model, { slug: val.trim() })); if (m) commit(m); else e.target.value = model.system.slug; return; }
  if (id === 'pt-slug') {
    const old = ui.sel.slug;
    const r = attempt(() => C.updateParticipant(model, old, { slug: val.trim() }));
    if (r) { ui.sel = { type: 'participant', slug: r.slug }; propagateToIncluders((m) => C.renameExternalParticipant(m, homeSlug(), old, r.slug)); commit(r.model); } else e.target.value = old;
    return;
  }
  if (id === 'pt-kind') { commit(C.updateParticipant(model, ui.sel.slug, { kind: val }).model); return; }
  if (id === 'st-from' || id === 'st-to') {
    const m = attempt(() => C.updateStep(model, f.slug, ui.sel.n, { [id === 'st-from' ? 'from' : 'to']: val }));
    if (m) commit(m); else renderRight();
    return;
  }
  if (id === 'st-trig') {
    const s = C.findStep(f, ui.sel.n);
    const resultOf = (trig) => { const t = trig ? triggerTarget(trig) : null; const R = t ? C.flowResult(t) : null; return R ? R.result : null; };
    commit(C.updateStep(model, f.slug, s.n, { triggers: val || null, result: C.resultAfterTrigger(s.result, resultOf(s.triggers), resultOf(val || null)) }));
    return;
  }
  if (id === 'sc-slug') { ui.schema.draft.slug = val.trim(); applySchemaDraft(); return; }
  if (/^sf-type-\d+$/.test(id)) {
    const i = Number(id.slice(8)), fld = ui.schema.draft.fields[i];
    if (val === '__new') {
      const r = attempt(() => C.addSchema(model, C.sentence(fld.name) || 'New type', [...types().keys()]));
      if (!r) { renderModal(); return; }
      commit(r.model, { skip: ['modal'] });
      fld.type = r.slug;
    } else fld.type = val;
    applySchemaDraft();
    return;
  }
  if (/^sf-rep-\d+$/.test(id)) { ui.schema.draft.fields[Number(id.slice(7))].repeated = e.target.checked; applySchemaDraft(); return; }
  if (id === 'play-speed') { ui.speed = Number(val); return; }
  if (id === 'play-collapse') { ui.collapse = e.target.checked; stopPlay(); ui.playT = 0; ui.slideK = undefined; ui.cam = null; render(); return; }
  if (id === 'play-pos') { ui.scrubbing = false; render(); return; }
  if (id === 'file-in') openFile(e.target);
});
document.addEventListener('focusin', (e) => {
  const id = e.target.id;
  if (id === 'tp-message' || id === 'tp-result') {
    if (!ui.tp || ui.tp.kind !== id.slice(3)) { ui.tp = { kind: id.slice(3), q: e.target.value, hi: 0 }; refreshRight(); }
    return;
  }
  if (ui.tp && !e.target.closest('.tp')) { ui.tp = null; refreshRight(); }
});
document.addEventListener('focusout', (e) => {
  // Drop the typed draft once it has been saved; no redraw here, so a click on a nearby button still lands.
  if (e.target.id === 'st-data' && ui.drafts.data && !ui.drafts.data.error) ui.drafts.data = null;
});
/** Opens or closes the File menu; `focusIn` moves focus to its first item (keyboard and click alike). */
function setFileMenu(open, focusIn) {
  ui.fileMenu = open;
  renderHeader();
  if (open && focusIn) $('file-menu').querySelector('[role="menuitem"]').focus();
  if (!open) $('file-menu-btn').focus();
}
document.addEventListener('keydown', (e) => {
  const t = e.target;
  // SVG buttons (role="button" on <g>) act on Enter and Space like real buttons.
  if (t && t.matches && t.matches('svg [role="button"][data-act]') && (e.key === 'Enter' || e.key === ' ')) {
    e.preventDefault();
    const v = t.getAttribute('data-v');
    t.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    const again = document.querySelector('svg [data-act="' + t.getAttribute('data-act') + '"][data-v="' + CSS.escape(v) + '"]');
    if (again) again.focus();
    return;
  }
  if (ui.fileMenu && t && t.closest && t.closest('#file-menu-wrap')) {
    const items = [...$('file-menu').querySelectorAll('[role="menuitem"]')];
    const i = items.indexOf(t);
    if (e.key === 'Escape' || e.key === 'Tab') { if (e.key === 'Escape') e.preventDefault(); setFileMenu(false, false); return; }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); items[(i + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length].focus(); return; }
    if (e.key === 'Home' || e.key === 'End') { e.preventDefault(); items[e.key === 'Home' ? 0 : items.length - 1].focus(); return; }
  }
  if (!ui.fileMenu && t && t.id === 'file-menu-btn' && e.key === 'ArrowDown') { e.preventDefault(); setFileMenu(true, true); return; }
  const typing = t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable);
  if (t && t.id === 'st-tag' && (e.key === 'Enter' || e.key === ',')) {
    e.preventDefault();
    const tag = t.value.trim().replace(/^#/, '').replace(/\s+/g, '-');
    const f = flow(), s = C.findStep(f, ui.sel.n);
    if (tag && !s.tags.includes(tag)) commit(C.updateStep(model, f.slug, s.n, { tags: [...s.tags, tag] }));
    const el = document.getElementById('st-tag');
    if (el) { el.value = ''; el.focus(); }
    return;
  }
  if (t && t.id === 'st-tag' && e.key === 'Backspace' && t.value === '') {
    const f = flow(), s = C.findStep(f, ui.sel.n);
    if (s.tags.length) commit(C.updateStep(model, f.slug, s.n, { tags: s.tags.slice(0, -1) }));
    return;
  }
  if (t && (t.id === 'tp-message' || t.id === 'tp-result') && ui.tp) {
    const opts = typeOptions(ui.tp.kind, ui.tp.q);
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); ui.tp.hi = Math.max(0, Math.min(opts.length - 1, ui.tp.hi + (e.key === 'ArrowDown' ? 1 : -1))); refreshRight(); return; }
    if (e.key === 'Enter') { e.preventDefault(); const o = opts[Math.min(ui.tp.hi, opts.length - 1)]; if (o) chooseType(ui.tp.kind, o.name, o.create); return; }
    if (e.key === 'Escape') { e.preventDefault(); ui.tp = null; refreshRight(); return; }
  }
  if (ui.sysDel && e.key === 'Escape') { e.preventDefault(); closeSysDel(); return; }
  // Enter on a field name: a fresh blank field right below it, ready to type.
  if (ui.schema && t && /^sf-name-\d+$/.test(t.id) && e.key === 'Enter') {
    e.preventDefault();
    if (t.value.trim() === '') return; // already on a blank row
    addDraftField('', Number(t.id.slice(8)) + 1);
    return;
  }
  if (ui.schema && e.key === 'Escape') { e.preventDefault(); closeSchema(); return; }
  // Enter or Esc in a step label finishes typing; a second Esc then cancels the pending step.
  if (t && t.id === 'st-label' && (e.key === 'Enter' || e.key === 'Escape')) { e.preventDefault(); t.blur(); return; }
  if (typing) return;
  // Alt+↑ / Alt+↓ on a step in the list moves it within its chain
  if (e.altKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown') && t && t.matches && t.matches('#left [data-act="pick-step"]')) {
    e.preventDefault();
    const n = Number(t.dataset.v), seq = C.chainSequence(flow(), C.findStep(flow(), n).chain).map((s) => s.n);
    const to = seq.indexOf(n) + (e.key === 'ArrowUp' ? -1 : 1);
    if (to >= 0 && to < seq.length) moveStepTo(n, to);
    return;
  }
  const mod = e.metaKey || e.ctrlKey;
  if (mod && e.key.toLowerCase() === 'z') { e.preventDefault(); if (e.shiftKey) redo(); else undo(); return; }
  if (e.key === 'Escape') {
    if (ui.confirm) ui.confirm = null;
    else if (ui.pending) { ui.pending = null; ui.cursor = null; }
    else ui.sel = null;
    render();
    return;
  }
  if ((e.key === 'Delete' || e.key === 'Backspace') && ui.sel && (ui.mode === 'flow' || ui.mode === 'system')) {
    e.preventDefault();
    ui.confirm = { kind: ui.sel.type === 'step' ? 'step' : 'part' };
    renderRight();
    return;
  }
  if (ui.mode === 'play') {
    if (e.key === ' ') { e.preventDefault(); if (ui.playing) { stopPlay(); renderPlaybar(); } else startPlay(); }
    if (e.key === 'ArrowRight') { e.preventDefault(); if (ui.playView === 'slides') moveSlide(slideIndex(script()) + 1); else stepPlay(1); }
    if (e.key === 'ArrowLeft') { e.preventDefault(); if (ui.playView === 'slides') moveSlide(slideIndex(script()) - 1); else stepPlay(-1); }
  }
});

/* ---------- stage pointer handling ---------- */
function svgPoint(e) {
  const svg = document.getElementById('orbit');
  if (!svg) return null;
  const pt = svg.createSVGPoint();
  pt.x = e.clientX; pt.y = e.clientY;
  const m = svg.getScreenCTM();
  if (!m) return null;
  const p = pt.matrixTransform(m.inverse());
  return { x: p.x, y: p.y };
}
/** Screen pixels per world unit (the viewBox is fitted with "meet", so the smaller ratio wins). */
const pxPerUnit = (svg, vb) => { const b = svg.getBoundingClientRect(); return Math.min(b.width / vb.w, b.height / vb.h); };
const stage = $('stage');
// Canvas input runs on pointerdown/pointerup (not click): the canvas redraws while the
// pointer moves, which would otherwise split a click across two different elements.
stage.addEventListener('pointerdown', (e) => {
  if (e.button !== 0 || e.target.closest('[data-act]') || e.target.closest('a[href]')) { ui.press = null; return; }
  const hit = (sel, attr) => { const el = e.target.closest(sel); return el ? el.getAttribute(attr) : null; };
  const svg = document.getElementById('orbit');
  ui.press = {
    node: hit('[data-node]', 'data-node'), badge: hit('[data-badge]', 'data-badge'), step: hit('[data-step]', 'data-step'), ring: hit('[data-ring]', 'data-ring'),
    cx: e.clientX, cy: e.clientY, moved: false, onSvg: Boolean(e.target.closest('#orbit')),
    cam: lastScene ? (ui.cam || sceneBounds(lastScene)) : null, pxPerUnit: svg && lastScene ? pxPerUnit(svg, ui.cam || sceneBounds(lastScene)) : 1
  };
  if ((ui.mode === 'system' && ui.press.node) || (ui.mode === 'galaxy' && ui.press.ring) || (ui.press.onSvg && !ui.press.node && !ui.press.badge && !ui.press.step && !ui.press.ring)) stage.setPointerCapture(e.pointerId);
});
stage.addEventListener('pointermove', (e) => {
  const press = ui.press;
  if (press && Math.hypot(e.clientX - press.cx, e.clientY - press.cy) > 6) press.moved = true;
  // pan: drag on empty canvas when the galaxy is showing
  if (press && press.moved && press.onSvg && !press.node && !press.badge && !press.step && !press.ring && lastScene && lastScene.rings.length > 1) {
    const dx = (e.clientX - press.cx) / press.pxPerUnit, dy = (e.clientY - press.cy) / press.pxPerUnit;
    ui.cam = { x: press.cam.x - dx, y: press.cam.y - dy, w: press.cam.w, h: press.cam.h };
    renderStage();
    return;
  }
  if (ui.mode === 'flow' && ui.pending && ui.flowView === 'orbit') { ui.cursor = svgPoint(e); renderStage(); return; }
  if (!press || !press.moved) return;
  const p = svgPoint(e);
  if (!p) return;
  if (ui.mode === 'system' && press.node) {
    let target = null, best = Infinity;
    lastScene.nodes.forEach((n, ref) => { const d = Math.hypot(n.x - p.x, n.y - p.y); if (ref !== press.node && d < n.nr * 2.2 && d < best) { best = d; target = ref; } });
    ui.drag = { ref: press.node, x: p.x, y: p.y, target };
    renderStage();
    return;
  }
  if (ui.mode === 'galaxy' && press.ring) {
    let target = null, best = Infinity;
    lastScene.rings.forEach((r) => { if (r.home || r.slug === press.ring) return; const d = Math.hypot(r.slotX - p.x, r.slotY - p.y); if (d < r.L.R * 1.2 && d < best) { best = d; target = r.slug; } });
    ui.ringDrag = { slug: press.ring, x: p.x, y: p.y, target };
    renderStage();
  }
});
stage.addEventListener('pointerup', () => {
  const press = ui.press;
  ui.press = null;
  if (!press) return;
  const panned = press.moved && press.onSvg && !press.node && !press.badge && !press.step && !press.ring && lastScene && lastScene.rings.length > 1;
  if (panned) return;
  if (ui.mode === 'system') {
    const drag = ui.drag;
    ui.drag = null;
    if (press.node && press.moved) {
      if (drag && drag.target) commit(C.swapParticipants(model, toLocal(press.node), toLocal(drag.target)));
      else renderStage();
      return;
    }
    if (press.moved) return;
    if (press.node) { ui.sel = { type: 'participant', slug: toLocal(press.node) }; ui.confirm = null; render(); }
    else if (ui.sel) { ui.sel = null; render(); }
    return;
  }
  if (ui.mode === 'galaxy') {
    const drag = ui.ringDrag;
    ui.ringDrag = null;
    if (press.ring && press.moved) {
      if (drag && drag.target) commit(C.swapIncludes(model, press.ring, drag.target));
      else renderStage();
      return;
    }
    if (press.moved) return;
    if (press.ring) { ui.sel = { type: 'system', slug: press.ring }; ui.confirm = null; render(); }
    else if (ui.sel) { ui.sel = null; render(); }
    return;
  }
  if (press.moved) return;
  if (ui.mode === 'play') {
    const k = press.badge !== null ? press.badge : press.step;
    if (k !== null) jumpTo(k);
    return;
  }
  if (press.badge !== null) { forkFrom(Number(press.badge)); return; }
  if (press.node !== null) { clickNode(press.node); return; }
  if (press.step !== null) { const s = C.findStep(flow(), Number(press.step.split('.')[0])); ui.sel = { type: 'step', n: s.n }; ui.chain = s.chain; ui.pending = null; ui.confirm = null; render(); return; }
  if (ui.pending) { ui.pending = null; ui.cursor = null; render(); return; }
  if (ui.sel) { ui.sel = null; render(); }
});
stage.addEventListener('pointercancel', () => { ui.press = null; if (ui.drag || ui.ringDrag) { ui.drag = null; ui.ringDrag = null; renderStage(); } });
stage.addEventListener('pointerleave', () => { if (ui.mode === 'flow' && ui.cursor) { ui.cursor = null; renderStage(); } });
stage.addEventListener('wheel', (e) => {
  if (!(e.ctrlKey || e.metaKey) || !lastScene || lastScene.rings.length < 2) return;
  e.preventDefault();
  const p = svgPoint(e);
  if (!p) return;
  const cur = ui.cam || sceneBounds(lastScene);
  const k = Math.exp(e.deltaY * 0.002);
  ui.cam = { x: p.x - (p.x - cur.x) * k, y: p.y - (p.y - cur.y) * k, w: cur.w * k, h: cur.h * k };
  renderStage();
}, { passive: false });

/* ---------- markdown pane: parse as you type ---------- */
let mdTimer = null;
function scheduleMdParse(text) {
  ui.mdText = text;
  clearTimeout(mdTimer);
  mdTimer = setTimeout(() => {
    try {
      const m = C.parse(text);
      ui.mdError = null;
      ui.savePaused = false;
      if (JSON.stringify(m) !== JSON.stringify(model)) {
        hist.past.push(model); hist.future = []; hist.key = null;
        setHome(m);
        normaliseUi();
      }
    } catch (err) {
      if (!(err instanceof C.FlowParseError)) throw err;
      ui.mdError = err;
    }
    render();
  }, 350);
}
function openFile(input) {
  const file = input.files && input.files[0];
  input.value = '';
  if (!file) return;
  file.text().then((text) => {
    let m;
    try { m = C.parse(text); }
    catch (err) {
      if (!(err instanceof C.FlowParseError)) throw err;
      ui.mdOpen = true; ui.mdText = text; ui.mdError = err;
      render();
      toast(file.name + ' has an error: ' + err.message);
      return;
    }
    const slug = m.system.slug;
    const existing = [...library.entries()].find(([, e]) => e.model && e.model.system.slug === slug);
    const id = existing ? existing[0] : slug;
    library.set(id, { model: m, text: null, error: null, sample: false });
    persistSamples();
    markDirty(id);
    openHome(id);
    render();
    toast((existing ? 'Replaced ' : 'Opened ') + m.system.label + ' from ' + file.name + '.');
  }, () => toast('Could not read ' + file.name + '.'));
}
function copyMd() {
  const text = ui.mdError ? ui.mdText : C.serialize(model);
  navigator.clipboard.writeText(text).then(() => toast('Markdown copied.'), () => {
    const ta = document.getElementById('md-text');
    if (ta) { ta.focus(); ta.select(); }
    toast('Copy is blocked here. The text is selected; press Ctrl+C or ⌘C.');
  });
}
function downloadMd() {
  if (ui.mdError) { toast('Fix the Markdown error first: ' + ui.mdError.message); return; }
  const use = window.claude && window.claude.use ? window.claude.use('downloads') : Promise.resolve(null);
  use.then((dl) => {
    if (!dl) { toast('Downloads aren\'t available in this view. Use Markdown → Copy instead.'); return; }
    dl.save({ filename: homeSlug() + '.flow.md', data: C.serialize(model) }).then(
      () => toast('Saved ' + homeSlug() + '.flow.md.'),
      (err) => { if (err && err.code !== 'declined') toast('Download failed: ' + (err.message || err.code)); }
    );
  });
}

/* ---------- storage: one document per saved system ---------- */
let db = null, saveTimer = null, loaded = false;
const dirty = new Set();
function setStore(state, msg) { ui.store = { state, msg }; renderHeader(); }
function markDirty(id) {
  if (ui.isSample) persistSamples();
  dirty.add(id);
  scheduleSave();
}
/** The first edit to the sample galaxy saves all of it, so its includes still resolve on reload. */
function persistSamples() {
  if (!ui.isSample) return;
  ui.isSample = false;
  library.forEach((e, id) => { if (e.sample) { library.set(id, { ...e, sample: false }); dirty.add(id); } });
  savePointer();
}
function scheduleSave() {
  if (!loaded || !db) return;
  if (ui.savePaused) { setStore('paused', 'Saving paused'); return; }
  clearTimeout(saveTimer);
  setStore('saving', 'Saving…');
  saveTimer = setTimeout(() => { flush().catch((err) => setStore('error', saveError(err))); }, 700);
}
const saveError = (err) => (err && err.code === 'invalid_argument' ? 'View only: changes aren\'t saved' : 'Not saved: ' + ((err && err.message) || 'unknown error'));
async function flush() {
  // A renamed home system moves to a new document; systems that include it follow the rename.
  if (model && ui.homeDoc !== homeSlug() && !ui.savePaused) {
    const oldId = ui.homeDoc, oldSlug = oldId, next = homeSlug();
    const entry = library.get(oldId);
    library.delete(oldId);
    library.set(next, entry);
    ui.homeDoc = next;
    dirty.delete(oldId);
    dirty.add(next);
    library.forEach((e, id) => {
      if (id === next || !e.model) return;
      const m = C.renameSystemRefs(e.model, oldSlug, next);
      if (m !== e.model) { library.set(id, { ...e, model: m }); dirty.add(id); }
    });
    await db.doc('systems/' + next).set({ markdown: C.serialize(model), savedAt: new Date().toISOString() });
    await db.doc('systems/' + oldId).delete();
    savePointer();
    renderHeader();
  }
  const ids = [...dirty];
  dirty.clear();
  for (const id of ids) {
    const e = library.get(id);
    if (!e || !e.model) continue;
    if (id === ui.homeDoc && ui.savePaused) continue;
    await db.doc('systems/' + id).set({ markdown: C.serialize(e.model), savedAt: new Date().toISOString() });
  }
  setStore('saved', 'Saved');
}
function savePointer() {
  if (!db || !loaded || ui.isSample) return;
  db.doc('app/state').set({ home: ui.homeDoc }).catch(() => { /* the pointer only remembers which system was open last */ });
}
async function initStore() {
  const use = window.claude && window.claude.use;
  if (!use) { loaded = true; setStore('none', 'Not saved: open this page on claude.ai'); return; }
  db = await use('db');
  if (!db) { loaded = true; setStore('none', 'Not saved: storage unavailable here'); return; }
  const user = await use('user');
  const editable = user ? await user.canEdit() : true;
  let docs;
  try { docs = (await db.collection('systems').get()).docs.map((d) => ({ id: d.id, data: d.data() })); }
  catch (err) { loaded = true; setStore('error', 'Could not load: ' + ((err && err.message) || err.code)); return; }
  // The first version stored a single system under "current": move it under its own slug.
  const legacy = docs.find((d) => d.id === 'current');
  if (legacy && editable) {
    try {
      const m = C.parse(legacy.data.markdown);
      if (m.system.slug !== 'current') {
        if (!docs.some((d) => d.id === m.system.slug)) await db.doc('systems/' + m.system.slug).set({ markdown: legacy.data.markdown, savedAt: legacy.data.savedAt || new Date().toISOString() });
        await db.doc('systems/current').delete();
        docs = docs.filter((d) => d.id !== 'current');
        if (!docs.some((d) => d.id === m.system.slug)) docs.push({ id: m.system.slug, data: legacy.data });
      }
    } catch (err) {
      if (!(err instanceof C.FlowParseError)) throw err; // left in place; it shows as "has errors"
    }
  }
  loaded = true;
  if (!docs.length) {
    setStore(editable ? 'saved' : 'none', editable ? 'Sample · edits save automatically' : 'View only: changes aren\'t saved');
    render();
    return;
  }
  library.clear();
  docs.forEach((d) => {
    const text = d.data.markdown;
    if (typeof text !== 'string') throw new Error('bug: stored system ' + d.id + ' has no markdown');
    try {
      const m = C.parse(text);
      library.set(d.id, { model: m, text, error: null, sample: false });
      if (editable && C.serialize(m) !== text) dirty.add(d.id); // e.g. older PascalCase type names, now kebab ids
    }
    catch (err) {
      if (!(err instanceof C.FlowParseError)) throw err;
      library.set(d.id, { model: null, text, error: err, sample: false });
    }
  });
  ui.isSample = false;
  let home = null;
  try { const p = await db.doc('app/state').get(); if (p.exists && library.has(p.data().home)) home = p.data().home; }
  catch (err) { home = null; }
  openHome(home || firstId(), { keepMode: true });
  setStore(editable ? (ui.savePaused ? 'paused' : 'saved') : 'none', editable ? (ui.savePaused ? 'Saving paused' : 'Saved') : 'View only: changes aren\'t saved');
  if (editable && dirty.size) scheduleSave(); // systems converted on open are saved in the new form
  render();
}

/* ---------- boot ---------- */
seedSamples();
render();
initStore().catch((err) => { loaded = true; setStore('error', 'Storage error: ' + (err && (err.message || err.code))); }).then(() => applyRoute(initialHash));
})();
