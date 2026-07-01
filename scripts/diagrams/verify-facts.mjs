/**
 * Fact verifier for the ReCiter Publication Manager architecture diagrams.
 *
 * Tier 3 of the four-tier check (see the skill PLAYBOOK). Asserts that the
 * constants hand-typed into the diagrams still match THIS repo's real sources,
 * so the pictures cannot silently drift from the code. Two rules keep it honest:
 *   1. Read the actual source — package.json as JSON, others via tight regex.
 *   2. FAIL LOUD if a source constant can't be located (a check that passes
 *      because it couldn't look is worse than no check).
 *
 * NOTE: the deployed stack is PINNED to the versions in package.json (Next 12 /
 * React 16 / next-auth 3 / saml2-js 3), NOT the aspirational README "stack"
 * table (which lists Next 14 / React 18). package.json is the source of truth,
 * so that is what we bind to.
 *
 *   node scripts/diagrams/verify-facts.mjs          # standalone (exit 1 on mismatch)
 *   import { verifyFacts } from "./verify-facts.mjs" # returns string[] of problems
 */
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const REPO = join(here, "..", "..");

/** All searchable text for one diagram: node titles + sub-lines + the human-facing meta. */
function diagramText(it) {
  const nodes = Object.values(it.spec.nodes).flatMap((n) => [n.title, ...(n.sub || [])]);
  const meta = [it.meta.heading, it.meta.blurb, it.meta.footnote, it.meta.extraHtml].filter(Boolean);
  return [...nodes, ...meta].join("  ");
}

/** Read a source file or record an error; returns "" and pushes a problem if unreadable. */
function readSrc(rel, problems) {
  try { return readFileSync(join(REPO, rel), "utf8"); }
  catch (e) { problems.push(`source: could not read ${rel} (${e.message})`); return ""; }
}

export function verifyFacts(items) {
  const problems = [];
  // Search across ALL diagrams plus the built index.html (so hero meta chips count too).
  let hay = items.map(diagramText).join("  ");
  try { hay += "  " + readFileSync(join(REPO, "docs/architecture/index.html"), "utf8"); } catch { /* not built yet */ }
  const has = (s) => hay.includes(s);

  // (a) Pinned stack versions — read package.json directly, bind diagram label to the real major.
  let pkg;
  try { pkg = JSON.parse(readSrc("package.json", problems)); } catch (e) { problems.push(`pkg: package.json unparseable (${e.message})`); }
  if (pkg) {
    const deps = pkg.dependencies || {};
    // [dependency, expected major, label shown in a diagram]. The label can itself
    // contain digits (e.g. "saml2-js"), so the expected major is given explicitly
    // rather than parsed back out of the label.
    const stack = [
      ["next", "12", "Next.js 12"],
      ["react", "16", "React 16"],
      ["next-auth", "3", "next-auth 3"],
      ["saml2-js", "3", "saml2-js 3"],
      ["sequelize", "6", "Sequelize 6"],
    ];
    for (const [dep, expectedMajor, label] of stack) {
      const range = deps[dep];
      if (!range) { problems.push(`stack: "${dep}" not in package.json dependencies (renamed/removed?)`); continue; }
      const major = (range.match(/\d+/) || [])[0];
      if (major !== expectedMajor) problems.push(`stack: ${dep} is ${range} (major ${major}) but a diagram says "${label}"`);
      else if (!has(label)) problems.push(`stack: "${label}" (from ${dep} ${range}) not shown in any diagram`);
    }
  }

  // (b) Container base image + port — Dockerfile / k8 deployment.
  const dockerfile = readSrc("Dockerfile", problems);
  if (dockerfile && !/FROM node:22-alpine/.test(dockerfile)) problems.push(`image: Dockerfile no longer uses node:22-alpine`);
  else if (dockerfile && !has("node:22-alpine")) problems.push(`image: "node:22-alpine" not shown in any diagram`);

  const deployYaml = readSrc("kubernetes/k8-deployment.yaml", problems);
  if (deployYaml && !/containerPort:\s*3000/.test(deployYaml)) problems.push(`port: containerPort 3000 not found in k8-deployment.yaml`);
  else if (deployYaml && !has("3000")) problems.push(`port: "3000" not shown in any diagram`);

  // (c) CI/CD deployment targets — buildspec sets image on these deployments.
  const buildspec = readSrc("k8-buildspec.yml", problems);
  for (const name of ["reciter-pm-prod", "reciter-pm-dev"]) {
    if (buildspec && !buildspec.includes(name)) problems.push(`deploy: "${name}" not found in k8-buildspec.yml (pipeline target moved?)`);
    else if (buildspec && !has(name)) problems.push(`deploy: "${name}" not shown in any diagram`);
  }

  // (d) ReCiter feature-generator contract — endpoint path + likelihood-score floor (config/local.js).
  const localCfg = readSrc("config/local.js", problems);
  if (localCfg) {
    if (!localCfg.includes("/reciter/feature-generator/by/uid")) problems.push(`reciter: feature-generator by/uid endpoint missing from config/local.js`);
    else if (!has("by/uid")) problems.push(`reciter: "by/uid" not shown in any diagram`);
    const m = localCfg.match(/authorshipLikelihoodScore:\s*(\d+)/);
    if (!m) problems.push(`reciter: authorshipLikelihoodScore not found in config/local.js`);
    else if (!has(`score≥${m[1]}`)) problems.push(`reciter: score floor ${m[1]} (authorshipLikelihoodScore) not shown as "score≥${m[1]}" in any diagram`);
  }

  // (e) Middleware route gating — ROUTE_PERMISSIONS map + the authorships role gate.
  const mw = readSrc("src/middleware.ts", problems);
  if (mw) {
    if (!mw.includes("ROUTE_PERMISSIONS")) problems.push(`rbac: ROUTE_PERMISSIONS not found in middleware.ts`);
    else if (!has("ROUTE_PERMISSIONS")) problems.push(`rbac: "ROUTE_PERMISSIONS" not shown in any diagram`);
    if (!/canManageUsers/.test(mw)) problems.push(`rbac: canManageUsers gate missing from middleware.ts`);
    else if (!has("canManageUsers")) problems.push(`rbac: "canManageUsers" not shown in any diagram`);
  }

  // (f) Authorships review store — the durable table the current feature reads.
  const authModel = readSrc("src/db/models/AuthorshipReview.ts", problems);
  if (authModel && !authModel.includes("authorship_review")) problems.push(`authorships: AuthorshipReview model no longer references table authorship_review`);
  else if (authModel && !has("authorship_review")) problems.push(`authorships: "authorship_review" not shown in any diagram`);

  return problems;
}

// Standalone run: load the definitions, verify, report, set exit code.
if (import.meta.url === `file://${process.argv[1]}`) {
  const dir = join(here, "definitions");
  const items = [];
  for (const f of readdirSync(dir).filter((f) => f.endsWith(".mjs")).sort()) {
    const mod = await import(join(dir, f));
    items.push({ spec: mod.spec, meta: mod.meta });
  }
  const problems = verifyFacts(items);
  if (problems.length) {
    console.error(`FAIL facts: ${problems.length} mismatch(es)`);
    problems.forEach((p) => console.error("    " + p));
    process.exitCode = 1;
  } else {
    console.log("PASS facts: every probed constant matches its source");
  }
}
