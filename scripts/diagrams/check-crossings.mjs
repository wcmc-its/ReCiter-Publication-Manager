/**
 * Geometry linter: flag edges whose drawn path passes THROUGH a node box that
 * is not one of its own endpoints — the failure class validate() (node overlap +
 * bounds only) cannot see. Reconstructs each edge path with the same math as
 * lib.mjs (routed polyline / straight / cubic Bézier) and samples it densely.
 * Not part of the build; a dev aid run on demand: node scripts/diagrams/check-crossings.mjs
 */
import { readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const files = readdirSync(join(here, "definitions")).filter((f) => f.endsWith(".mjs")).sort();

const dist = (a, b) => Math.hypot(b.x - a.x, b.y - a.y);
const onNode = (p, n) => {
  // within 1.5px of node n's border ring => this point anchors to n
  const insideOuter = p.x >= n.x - 1.5 && p.x <= n.x + n.w + 1.5 && p.y >= n.y - 1.5 && p.y <= n.y + n.h + 1.5;
  const insideInner = p.x > n.x + 1.5 && p.x < n.x + n.w - 1.5 && p.y > n.y + 1.5 && p.y < n.y + n.h - 1.5;
  return insideOuter && !insideInner;
};
const strictInside = (p, n, pad = 4) =>
  p.x > n.x + pad && p.x < n.x + n.w - pad && p.y > n.y + pad && p.y < n.y + n.h - pad;

function samplePath(e) {
  const { p0, p1, route, points } = e;
  const pts = [];
  const lerp = (a, b, t) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
  const seg = (a, b) => { for (let i = 0; i <= 24; i++) pts.push(lerp(a, b, i / 24)); };
  if (points && points.length) {
    const chain = [p0, ...points, p1];
    for (let i = 0; i < chain.length - 1; i++) seg(chain[i], chain[i + 1]);
  } else if (route === "straight") {
    seg(p0, p1);
  } else {
    const d = Math.max(36, dist(p0, p1) * 0.34);
    const c0 = { x: p0.x + p0.nx * d, y: p0.y + p0.ny * d };
    const c1 = { x: p1.x + p1.nx * d, y: p1.y + p1.ny * d };
    for (let i = 0; i <= 60; i++) {
      const t = i / 60, u = 1 - t;
      pts.push({
        x: u * u * u * p0.x + 3 * u * u * t * c0.x + 3 * u * t * t * c1.x + t * t * t * p1.x,
        y: u * u * u * p0.y + 3 * u * u * t * c0.y + 3 * u * t * t * c1.y + t * t * t * p1.y,
      });
    }
  }
  return pts;
}

let total = 0;
for (const f of files) {
  const { spec } = await import(join(here, "definitions", f));
  const nodes = Object.entries(spec.nodes).map(([id, n]) => ({ id, ...n }));
  const hits = new Set();
  for (let ei = 0; ei < spec.edges.length; ei++) {
    const e = spec.edges[ei];
    // endpoints' own nodes are exempt
    const own = new Set(nodes.filter((n) => onNode(e.p0, n) || onNode(e.p1, n)).map((n) => n.id));
    const pts = samplePath(e);
    for (const n of nodes) {
      if (own.has(n.id)) continue;
      if (pts.some((p) => strictInside(p, n))) {
        const lbl = e.label ? ` "${e.label}"` : "";
        hits.add(`  edge[${ei}]${lbl} (${[...own].join("→") || "?"}) passes through node "${n.id}"`);
      }
    }
  }
  total += hits.size;
  if (hits.size) { console.log(`✗ ${spec.id}: ${hits.size} crossing(s)`); [...hits].forEach((h) => console.log(h)); }
  else console.log(`✓ ${spec.id}: no edge passes through a foreign node`);
}
process.exitCode = total ? 1 : 0;
