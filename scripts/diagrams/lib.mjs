/**
 * Reusable, dependency-free SVG diagram renderer.
 *
 * Pure functions only — no DOM, no Node APIs — so the exact same code renders
 * diagrams at build time (scripts/diagrams/build.mjs) and could be imported in a
 * browser. A diagram is described by a plain "spec" object; see definitions/*.mjs.
 *
 *   spec = {
 *     id:   "system-context",
 *     vb:   [width, height],                       // SVG viewBox
 *     groups: [ {x,y,w,h,kind,title,fo?,dash?} ],  // labelled container rects
 *     nodes:  { id: {x,y,w,h,kind,title,sub?,badge?} },
 *     edges:  [ {p0,p1,color?,label?,dash?,route?,points?,lp?,w?} ],
 *   }
 *
 *   renderSVG(spec) -> complete "<svg>…</svg>" string (defs inlined, self-contained)
 *   validate(spec)  -> string[] of geometry problems (overlaps, out-of-bounds)
 *   A(node, side, f) -> anchor point + outward normal, for wiring edges
 */

/** Resource-type palette: box fill / stroke / text / left-chip colour. */
export const KIND = {
  ext:  { fill: "#f1f3f5", stroke: "#adb5bd", text: "#343a40", bar: "#868e96" },
  edge: { fill: "#fbeaea", stroke: "#7d1c1c", text: "#5e1414", bar: "#7d1c1c" },
  net:  { fill: "#e7ecff", stroke: "#4263eb", text: "#2b3a8c", bar: "#4263eb" },
  app:  { fill: "#e3faf3", stroke: "#0ca678", text: "#0b6e4f", bar: "#0ca678" },
  data: { fill: "#fff4d6", stroke: "#f08c00", text: "#8a5a00", bar: "#f08c00" },
  aws:  { fill: "#f0ebff", stroke: "#7048e8", text: "#4a2fb0", bar: "#7048e8" },
  good: { fill: "#ebfbee", stroke: "#2f9e44", text: "#256f33", bar: "#2f9e44" },
  open: { fill: "#fff0f0", stroke: "#e03131", text: "#b02525", bar: "#e03131", dash: "6 4" },
};

/** Edge colour -> stroke + arrow-marker id. */
export const COL = {
  gray:   { s: "#868e96", m: "mGray" },   maroon: { s: "#7d1c1c", m: "mMaroon" },
  red:    { s: "#e03131", m: "mRed" },    green:  { s: "#2f9e44", m: "mGreen" },
  indigo: { s: "#4263eb", m: "mIndigo" }, violet: { s: "#7048e8", m: "mViolet" },
  amber:  { s: "#f08c00", m: "mAmber" },  teal:   { s: "#0ca678", m: "mTeal" },
};

/** CDK stack -> accent colour (the top stripe + the legend swatch in view 2). */
export const STACKC = {
  NetworkStack: "#4263eb", DataStack: "#f08c00", SecretsStack: "#7048e8", AppStack: "#0ca678",
  EtlStack: "#2f9e44", EdgeStack: "#7d1c1c", Observability: "#1098ad", DrVault: "#868e96",
};

/** Right-aligned status chip tones (e.g. ETL refresh cadence on a source node). */
export const CHIP = {
  nightly:  { fill: "#e7f6ef", text: "#157a52" },
  weekly:   { fill: "#fbefd9", text: "#9a5b12" },
  annual:   { fill: "#eceff8", text: "#43547e" },
  ondemand: { fill: "#f1f3f5", text: "#5b6470" },
  planned:  { fill: "#e0e7ff", text: "#3730a3" },
  live:     { fill: "#f3eeff", text: "#6a40c9" },
};

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Anchor on a node/group side; `f` in [0,1] runs along that side. Returns point + outward normal. */
export function A(n, side, f = 0.5) {
  if (side === "t") return { x: n.x + n.w * f, y: n.y, nx: 0, ny: -1 };
  if (side === "b") return { x: n.x + n.w * f, y: n.y + n.h, nx: 0, ny: 1 };
  if (side === "l") return { x: n.x, y: n.y + n.h * f, nx: -1, ny: 0 };
  return { x: n.x + n.w, y: n.y + n.h * f, nx: 1, ny: 0 }; // "r"
}

function pathFor(p0, p1, route, points) {
  if (points && points.length)
    return `M${p0.x},${p0.y} ` + points.map((p) => `L${p.x},${p.y} `).join("") + `L${p1.x},${p1.y}`;
  if (route === "straight") return `M${p0.x},${p0.y} L${p1.x},${p1.y}`;
  const d = Math.max(36, Math.hypot(p1.x - p0.x, p1.y - p0.y) * 0.34);
  const c0 = { x: p0.x + p0.nx * d, y: p0.y + p0.ny * d };
  const c1 = { x: p1.x + p1.nx * d, y: p1.y + p1.ny * d };
  return `M${p0.x},${p0.y} C${c0.x},${c0.y} ${c1.x},${c1.y} ${p1.x},${p1.y}`;
}

function midFor(p0, p1, route, points) {
  if (points && points.length) { const m = points[Math.floor((points.length - 1) / 2)]; return { x: m.x, y: m.y }; }
  if (route === "straight") return { x: (p0.x + p1.x) / 2, y: (p0.y + p1.y) / 2 };
  const d = Math.max(36, Math.hypot(p1.x - p0.x, p1.y - p0.y) * 0.34);
  const c0 = { x: p0.x + p0.nx * d, y: p0.y + p0.ny * d }, c1 = { x: p1.x + p1.nx * d, y: p1.y + p1.ny * d };
  return { x: 0.125 * (p0.x + 3 * c0.x + 3 * c1.x + p1.x), y: 0.125 * (p0.y + 3 * c0.y + 3 * c1.y + p1.y) };
}

function defsMarkup() {
  let m = "";
  for (const v of Object.values(COL))
    m += `<marker id="${v.m}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="9" markerHeight="9" markerUnits="userSpaceOnUse" orient="auto-start-reverse"><path d="M0.5,0.8 L9.4,5 L0.5,9.2 L3,5 Z" fill="${v.s}"/></marker>`;
  return `<filter id="sh" x="-25%" y="-25%" width="150%" height="150%"><feDropShadow dx="0" dy="1.4" stdDeviation="2.4" flood-color="#0b1f3a" flood-opacity="0.14"/></filter>` + m;
}

// Group rendering is split so the renderer can layer it correctly: the big
// background rect goes UNDER the edges, but the title tab (text) goes OVER them
// — otherwise an edge crossing a band runs straight through its label.
function groupRect(g) {
  const k = KIND[g.kind] || KIND.net;
  const dash = g.dash ? ` stroke-dasharray="7 5"` : "";
  return `<rect x="${g.x}" y="${g.y}" width="${g.w}" height="${g.h}" rx="14" fill="${k.fill}" fill-opacity="${g.fo ?? 0.16}" stroke="${k.stroke}" stroke-width="1.4"${dash}><title>${esc(g.title)}</title></rect>`;
}
function groupTitle(g) {
  const k = KIND[g.kind] || KIND.net;
  const tw = 18 + g.title.length * 6.6;
  return `<g><rect x="${g.x + 16}" y="${g.y - 13}" width="${tw}" height="26" rx="8" fill="#ffffff" stroke="${k.stroke}" stroke-width="1.2"/>` +
    `<text x="${g.x + 16 + tw / 2}" y="${g.y + 4.5}" font-size="12" font-weight="700" fill="${k.text}" text-anchor="middle">${esc(g.title)}</text></g>`;
}

// Module-level so clipPath ids stay unique across every node in a build run
// (multiple SVGs inlined into one HTML document must not collide).
let _uid = 0;

function nodeEl(n) {
  const k = KIND[n.kind] || KIND.ext;
  const sub = n.sub || [];
  const dash = k.dash ? ` stroke-dasharray="6 4"` : "";
  const card = `<rect x="${n.x}" y="${n.y}" width="${n.w}" height="${n.h}" rx="10" fill="${k.fill}" stroke="${k.stroke}" stroke-width="1.6"${dash} filter="url(#sh)"/>`;
  // Accessible name + native hover tooltip for the node, as the group's first child.
  const a11yName = n.title + (sub.length ? " — " + sub.join("; ") : "");
  let s = `<g><title>${esc(a11yName)}</title>`;
  if (n.badge) {
    // Top accent stripe = owning CDK stack. Clipped to the rounded card so it
    // follows the corner radius; collision-proof (unlike an in-box text badge).
    const sc = STACKC[n.badge] || "#868e96", cid = "nc" + _uid++;
    s += `<clipPath id="${cid}"><rect x="${n.x}" y="${n.y}" width="${n.w}" height="${n.h}" rx="10"/></clipPath>` +
      card + `<rect x="${n.x}" y="${n.y}" width="${n.w}" height="6" fill="${sc}" clip-path="url(#${cid})"/>`;
  } else {
    s += card;
  }
  s += `<rect x="${n.x + 12}" y="${n.y + 15}" width="9" height="9" rx="2.5" fill="${k.bar}"/>` +
    `<text x="${n.x + 28}" y="${n.y + 24}" font-size="13.5" font-weight="700" fill="${k.text}">${esc(n.title)}</text>`;
  let yy = n.y + 41;
  for (const ln of sub) { s += `<text x="${n.x + 14}" y="${yy}" font-size="11" fill="#5b6470">${esc(ln)}</text>`; yy += 15; }
  if (n.chip) {
    const c = CHIP[n.chip.tone] || CHIP.ondemand, t = n.chip.text, cw = 14 + t.length * 5.9;
    s += `<rect x="${n.x + n.w - cw - 10}" y="${n.y + 10}" width="${cw}" height="17" rx="8.5" fill="${c.fill}"/>` +
      `<text x="${n.x + n.w - 10 - cw / 2}" y="${n.y + 22}" font-size="10" font-weight="700" fill="${c.text}" text-anchor="middle">${esc(t)}</text>`;
  }
  return s + `</g>`;
}

// `mode`: "line" draws only the path, "label" only the pill+text, "both" does both.
// renderSVG draws all lines first, then all labels — so a crossing edge never
// paints over another edge's label text.
function edgeEl(e, mode = "both") {
  const c = COL[e.color || "gray"];
  let s = "";
  if (mode !== "label") {
    const d = pathFor(e.p0, e.p1, e.route, e.points);
    const dash = e.dash ? ` stroke-dasharray="6 5"` : "";
    s += `<path d="${d}" fill="none" stroke="${c.s}" stroke-width="${e.w || 1.8}" stroke-linecap="round"${dash} marker-end="url(#${c.m})"/>`;
  }
  if (mode !== "line" && e.label) {
    const lp = e.lp || midFor(e.p0, e.p1, e.route, e.points);
    const lw = 12 + e.label.length * 5.85;
    s += `<rect x="${lp.x - lw / 2}" y="${lp.y - 9.5}" width="${lw}" height="18" rx="9" fill="#ffffff" stroke="${c.s}" stroke-opacity="0.45"/>` +
      `<text x="${lp.x}" y="${lp.y + 3.4}" font-size="10" fill="#3a434f" text-anchor="middle">${esc(e.label)}</text>`;
  }
  return s;
}

/**
 * Render a spec to a complete, self-contained `<svg>` string.
 * `a11y` (optional): { title, desc } become the SVG's accessible name/description
 * (role="img" + aria-labelledby), read by screen readers as the diagram's "alt text".
 */
export function renderSVG(spec, a11y = {}) {
  // Strict layering so nothing with text is ever crossed by a line:
  // group backgrounds < edge lines < edge labels < group titles < decos < nodes.
  let body = "";
  for (const g of spec.groups || []) body += groupRect(g);       // backgrounds only (bottom)
  for (const e of spec.edges || []) body += edgeEl(e, "line");   // all edge lines…
  for (const e of spec.edges || []) body += edgeEl(e, "label");  // …labels above lines
  for (const g of spec.groups || []) body += groupTitle(g);      // band titles above lines
  for (const d of spec.decos || []) body += d;                   // annotations above lines
  for (const n of Object.values(spec.nodes || {})) body += nodeEl(n); // nodes on top of all
  const [w, h] = spec.vb;
  const tId = `t-${spec.id}`, dId = `d-${spec.id}`;
  const aTitle = esc(a11y.title || spec.id);
  const aDesc = esc(a11y.desc || `Architecture diagram: ${spec.id}.`);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" ` +
    `role="img" aria-labelledby="${tId} ${dId}" ` +
    `font-family="Inter,-apple-system,Segoe UI,Helvetica,Arial,sans-serif">` +
    `<title id="${tId}">${aTitle}</title><desc id="${dId}">${aDesc}</desc>` +
    `<rect width="100%" height="100%" fill="#fbfcfe"/><defs>${defsMarkup()}</defs>${body}</svg>`;
}

/** Geometry sanity check: node overlaps, out-of-bounds nodes/groups. Returns problems (empty = clean). */
export function validate(spec) {
  const issues = [];
  const ns = Object.entries(spec.nodes || {}).map(([id, n]) => ({ id, ...n }));
  const ov = (a, b) => a.x < b.x + b.w - 1 && b.x < a.x + a.w - 1 && a.y < b.y + b.h - 1 && b.y < a.y + a.h - 1;
  for (let i = 0; i < ns.length; i++)
    for (let j = i + 1; j < ns.length; j++)
      if (ov(ns[i], ns[j])) issues.push(`overlap: ${ns[i].id} ∩ ${ns[j].id}`);
  const [W, H] = spec.vb;
  for (const n of ns)
    if (n.x < 0 || n.y < 0 || n.x + n.w > W || n.y + n.h > H) issues.push(`out of bounds: ${n.id}`);
  for (const g of spec.groups || [])
    if (g.x < 0 || g.y < 0 || g.x + g.w > W || g.y + g.h > H) issues.push(`group out of bounds: ${g.title}`);
  return issues;
}
