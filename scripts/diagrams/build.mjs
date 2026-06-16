/**
 * Build the architecture diagrams.
 *
 *   node scripts/diagrams/build.mjs        # or: npm run diagrams
 *
 * For every module in ./definitions it: validates the geometry, renders a
 * standalone .svg, rasterizes a .png (rsvg-convert if present, else sharp), and
 * assembles a single index.html viewer. Outputs land in docs/architecture/.
 * Exits non-zero if any diagram has geometry problems, so it can gate CI.
 *
 * To add a diagram: drop a new file in ./definitions exporting { spec, meta }.
 * To change one: edit its definition (pure data) and re-run. See README.md.
 */
import { readdirSync, writeFileSync, mkdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { renderSVG, validate, STACKC, CHIP, COL } from "./lib.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const OUT = join(here, "..", "..", "docs", "architecture");
mkdirSync(OUT, { recursive: true });

// Strip the HTML out of a meta blurb so it can serve as an SVG <desc> / accessible description.
const stripHtml = (s) =>
  String(s).replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/\s+/g, " ").trim();

// Build provenance: the source commit + its date, so a shared SVG/PDF/PNG says what it came from.
// Deterministic (no wall-clock → no churn on no-op rebuilds); silent if not a git checkout.
function gitProvenance() {
  const git = (args) => execFileSync("git", args, { cwd: here, stdio: ["ignore", "pipe", "ignore"] }).toString().trim();
  try {
    const sha = git(["rev-parse", "--short", "HEAD"]);
    const date = git(["log", "-1", "--format=%cs"]); // committer date, YYYY-MM-DD
    return sha ? { sha, date } : null;
  } catch { return null; }
}

// Load every definition, ordered by filename (01-, 02-, …).
const files = readdirSync(join(here, "definitions")).filter((f) => f.endsWith(".mjs")).sort();
const items = [];
for (const f of files) {
  const mod = await import(join(here, "definitions", f));
  items.push({ spec: mod.spec, meta: mod.meta });
}

// Validate + render SVG.
let problems = 0;
for (const it of items) {
  const issues = validate(it.spec);
  if (issues.length) { problems += issues.length; console.error(`✗ ${it.spec.id}:`); issues.forEach((i) => console.error("    " + i)); }
  else console.log(`✓ ${it.spec.id}: geometry clean`);
  it.svg = renderSVG(it.spec, { title: stripHtml(it.meta.heading), desc: stripHtml(it.meta.blurb) });
  writeFileSync(join(OUT, `${it.spec.id}.svg`), it.svg);
}

// Rasterize to PNG (best-effort; vector svg is the primary artifact).
for (const it of items) await rasterize(join(OUT, `${it.spec.id}.svg`), join(OUT, `${it.spec.id}.png`));

// Assemble the viewer.
writeFileSync(join(OUT, "index.html"), buildHtml(items));

console.log(`\nWrote ${items.length} diagram(s) → docs/architecture/ (svg + png + index.html)`);

// Optional, per-project fact check: assert constants baked into the diagrams still
// match the real sources. Runs only if scripts/diagrams/verify-facts.mjs exists, so
// build.mjs stays copyable to a project that hasn't written one.
try {
  const { verifyFacts } = await import("./verify-facts.mjs");
  const factIssues = verifyFacts(items);
  if (factIssues.length) { problems += factIssues.length; console.error("✗ facts:"); factIssues.forEach((i) => console.error("    " + i)); }
  else console.log("✓ facts: diagram constants match their sources (crons, model versions, buckets, table)");
} catch (e) {
  if (e?.code !== "ERR_MODULE_NOT_FOUND") throw e; // genuine error, not just "no verifier in this project"
}

if (problems) { console.error(`\n${problems} problem(s) (geometry / facts) — see above.`); process.exitCode = 1; }

// ---------------------------------------------------------------------------

async function rasterize(svgPath, pngPath) {
  try { execFileSync("rsvg-convert", ["-z", "1.6", "-b", "white", svgPath, "-o", pngPath], { stdio: "ignore" }); return; }
  catch { /* not installed — try sharp */ }
  try { const sharp = (await import("sharp")).default; await sharp(svgPath, { density: 160 }).png().toFile(pngPath); }
  catch (e) { console.warn(`  png skipped for ${pngPath.split("/").pop()} (no rsvg-convert or sharp: ${e.message})`); }
}

function withCode(s) {
  return s.split(" · ").map((t) => (/[\/.]/.test(t) && !t.includes(" ") ? `<code>${t}</code>` : t)).join(" · ");
}

function section({ spec, meta, svg }) {
  const chips = (arr) => arr.map((l) => `<span class="chip"><i style="background:${l.fill};border-color:${l.stroke}"></i>${l.label}</span>`).join("");
  const stack = meta.stackLegend
    ? `<div class="legtitle">CDK stack — top accent stripe (ADR-008)</div><div class="legend">` +
      meta.stackLegend.map(([n, d]) => `<span class="chip"><i style="background:#fff;border-color:${STACKC[n]}"></i><b style="color:${STACKC[n]}">${n}</b>&nbsp;<span style="color:#5b6470">${d}</span></span>`).join("") +
      `</div>`
    : "";
  const cadence = meta.cadenceLegend
    ? `<div class="legtitle">${meta.cadenceLegend.title}</div><div class="legend">` +
      meta.cadenceLegend.items.map((it) => `<span class="chip"><span class="cchip" style="background:${CHIP[it.tone].fill};color:${CHIP[it.tone].text}">${it.tone}</span><span style="color:#5b6470">${it.label}</span></span>`).join("") +
      `</div>`
    : "";
  // Edge-type key: colour = relationship, dash = out-of-band/async. Each diagram
  // defines its own edge semantics (meta.edgeLegend), promoted out of the prose.
  const edge = meta.edgeLegend
    ? `<div class="legtitle">Edge types — colour = relationship · dashed = out-of-band / async</div><div class="legend">` +
      meta.edgeLegend.map((e) => {
        const c = (COL[e.color] || COL.gray).s;
        const dash = e.dash ? ` stroke-dasharray="3.5 2.5"` : "";
        return `<span class="chip"><svg width="28" height="10" viewBox="0 0 28 10" aria-hidden="true" style="flex:none">` +
          `<line x1="1" y1="5" x2="21" y2="5" stroke="${c}" stroke-width="2.2" stroke-linecap="round"${dash}/>` +
          `<path d="M20,1.5 L27,5 L20,8.5 Z" fill="${c}"/></svg>${e.label}</span>`;
      }).join("") + `</div>`
    : "";
  const footnote = meta.footnote ? `<p class="foot">${meta.footnote}</p>` : "";
  const seeAlso = meta.seeAlso
    ? `<p class="foot see-also">Related views: ` + meta.seeAlso.map((s) => `<a href="#${s.id}">${s.label}</a>`).join(" · ") + `</p>`
    : "";
  return `<section class="card" id="${spec.id}">
    <div class="kicker">${meta.kicker}</div>
    <h2><span class="dot" style="background:${meta.dot}"></span>${meta.heading}</h2>
    <p class="blurb">${meta.blurb}</p>
    <div class="canvas">${svg}</div>
    <div class="legend">${chips(meta.legend)}</div>
    ${edge}
    ${stack}
    ${cadence}
    ${footnote}
    ${meta.extraHtml || ""}
    ${seeAlso}
    <p class="src">Sources: ${withCode(meta.source)}</p>
  </section>`;
}

function buildHtml(items) {
  // ─── REBRAND: edit this block for your project (the only edits build.mjs needs) ───
  const PROJECT = "ReCiter Publication Manager";  // → hero <h1>, <title>, og:title
  const ORG = "Weill Cornell Medicine · ITS / Samuel J. Wood Library"; // → hero kicker
  const HERO =                                    // → hero paragraph (one for a newcomer)
    "The web UI of the ReCiter suite: librarians, faculty, and departmental staff use it to " +
    "curate which publications belong to each scholar and to generate bibliometric reports. " +
    "A Next.js app that proxies the ReCiter disambiguation engine and reads the ReCiterDB " +
    "MySQL reporting store, deployed as a container on Amazon EKS behind SAML single sign-on.";
  const META_CHIPS = [                            // → hero pills (key facts at a glance)
    "Next.js 12 (pages router) · React 16", "Sequelize → ReCiterDB (MySQL)",
    "next-auth + SAML2-js", "Docker → ECR → EKS", "ReCiter + PubMed APIs",
  ];
  const docDesc =                                 // → <meta description> + OG (one sentence)
    `Architecture of ${PROJECT} — the Next.js curation & reporting UI for the ReCiter suite: ` +
    `what feeds it, how it's built inside, how requests flow, and how it deploys to EKS.`;
  // ─────────────────────────────────────────────────────────────────────────────
  const docTitle = `${PROJECT} — Architecture`;
  const prov = gitProvenance();
  const provLine = prov ? ` · source commit <code>${prov.sha}</code> (${prov.date})` : "";
  const nav = items.map((it) => `<a href="#${it.spec.id}">${it.meta.nav}</a>`).join("\n  ");
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${docTitle}</title>
<meta name="description" content="${docDesc}" />
<meta property="og:type" content="website" />
<meta property="og:title" content="${docTitle}" />
<meta property="og:description" content="${docDesc}" />
<style>
  :root{ --maroon:#7d1c1c; --maroon-d:#5e1414; --ink:#1f2933; --muted:#5b6470; --line:#e3e8ef; --bg:#eef1f5; --card:#fff; --canvas:#fbfcfe; }
  *{box-sizing:border-box} html,body{margin:0}
  body{font-family:"Inter",-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;background:var(--bg);color:var(--ink);line-height:1.5;-webkit-font-smoothing:antialiased}
  .wrap{max-width:1300px;margin:0 auto;padding:0 22px 80px}
  .hero{background:linear-gradient(120deg,#7d1c1c 0%,#5e1414 60%,#3f0e0e 100%);color:#fff;border-radius:0 0 20px 20px;padding:30px 34px 26px;box-shadow:0 10px 30px rgba(94,20,20,.22)}
  .hero .in{max-width:1300px;margin:0 auto;padding:0 12px}
  .hero h1{margin:0 0 6px;font-size:27px;letter-spacing:-.4px;font-weight:800}
  .hero p{margin:0;color:#f2dada;font-size:14.5px;max-width:880px}
  .kicker{font-size:11.5px;font-weight:700;letter-spacing:.7px;text-transform:uppercase;color:var(--maroon)}
  .meta{margin-top:16px;display:flex;flex-wrap:wrap;gap:8px}
  .meta span{background:rgba(255,255,255,.13);border:1px solid rgba(255,255,255,.22);padding:4px 11px;border-radius:999px;font-size:12px;color:#fff}
  nav{position:sticky;top:0;z-index:20;background:rgba(255,255,255,.92);backdrop-filter:blur(8px);border-bottom:1px solid var(--line);margin-bottom:26px;border-radius:0 0 14px 14px}
  nav .nin{max-width:1300px;margin:0 auto;padding:11px 22px;display:flex;gap:8px;align-items:center;flex-wrap:wrap}
  nav a{text-decoration:none;color:var(--ink);font-size:13px;font-weight:600;padding:7px 13px;border-radius:9px;border:1px solid var(--line);background:#fff}
  nav a:hover{border-color:var(--maroon);color:var(--maroon)}
  nav .sp{flex:1} nav .hint{font-size:11.5px;color:var(--muted);font-weight:500}
  section.card{background:var(--card);border:1px solid var(--line);border-radius:16px;padding:22px 24px 26px;margin-bottom:26px;box-shadow:0 2px 10px rgba(15,30,60,.05)}
  section.card>h2{margin:0 0 4px;font-size:19px;font-weight:800;letter-spacing:-.2px;display:flex;align-items:center;gap:10px}
  section.card>h2 .dot{width:13px;height:13px;border-radius:4px;display:inline-block}
  .blurb{margin:2px 0 16px;color:var(--muted);font-size:14px;max-width:920px}
  .blurb b{color:var(--ink)}
  .canvas{background:var(--canvas);border:1px solid var(--line);border-radius:12px;padding:10px;overflow-x:auto}
  .canvas svg{display:block;width:100%;height:auto;min-width:880px}
  .legend{display:flex;flex-wrap:wrap;gap:8px 16px;margin-top:14px}
  .chip{display:inline-flex;align-items:center;gap:7px;font-size:12px;color:var(--ink)}
  .chip i{width:13px;height:13px;border-radius:3.5px;border:1.5px solid;display:inline-block}
  .cchip{font-size:10px;font-weight:700;padding:1px 8px;border-radius:8px;margin-right:6px}
  .legtitle{font-size:11.5px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.5px;margin:16px 0 6px}
  .grid2{display:grid;grid-template-columns:1.15fr .85fr;gap:16px;margin-top:18px}
  @media(max-width:900px){.grid2{grid-template-columns:1fr}}
  .panel{border:1px solid var(--line);border-radius:12px;padding:14px 16px;background:#fbfcfe}
  .panel h3{margin:0 0 8px;font-size:13px;font-weight:800;letter-spacing:.2px;display:flex;align-items:center;gap:8px}
  .panel.agenda{background:#fff6f6;border-color:#f3c9c9} .panel.agenda h3{color:#b02525}
  .agenda ol{margin:6px 0 0;padding-left:20px}
  .agenda li{font-size:13px;margin-bottom:9px;color:#39434f} .agenda li b{color:#b02525}
  .tag{display:inline-block;font-size:10.5px;font-weight:700;padding:1px 7px;border-radius:6px;margin-left:4px;vertical-align:middle}
  .tag.open{background:#ffe3e3;color:#c92a2a} .tag.done{background:#d3f9d8;color:#2b8a3e}
  table.env{border-collapse:collapse;width:100%;font-size:12.5px}
  table.env th,table.env td{border:1px solid var(--line);padding:6px 9px;text-align:left}
  table.env th{background:#f6f3f3;color:var(--maroon-d);font-weight:700}
  table.env td.k{font-weight:600;color:#39434f;background:#fafbfc}
  .foot{color:var(--muted);font-size:12.5px;margin-top:10px}
  .foot a{color:var(--maroon);text-decoration:none;border-bottom:1px solid #e6c9c9}
  .foot a:hover{border-color:var(--maroon)}
  .see-also{margin-top:12px}
  .src{font-size:11.5px;color:#94a0ae;margin-top:10px}
  .src code{background:#f1f3f5;padding:1px 5px;border-radius:5px;color:#5b6470}
  @media print{ nav{display:none} body{background:#fff} .hero{box-shadow:none;border-radius:0}
    section.card{break-inside:avoid;page-break-after:always;box-shadow:none;border:none;padding:8px 0} .canvas{border:none} }
</style>
</head>
<body>
<header class="hero"><div class="in">
  <div class="kicker" style="color:#f0c9c9">${ORG}</div>
  <h1>${docTitle}</h1>
  <p>${HERO}</p>
  <div class="meta">${META_CHIPS.map((c) => `<span>${c}</span>`).join("")}</div>
</div></header>
<nav><div class="nin">
  ${nav}
  <span class="sp"></span>
  <span class="hint">Generated · vector SVG (zoom freely) · ⌘P → Save as PDF for slides</span>
</div></nav>
<div class="wrap">
  ${items.map(section).join("\n")}
  <p class="foot" style="text-align:center">Generated by <code>scripts/diagrams/build.mjs</code> from the repository's sources${provLine} · self-contained.</p>
</div>
</body>
</html>`;
}
