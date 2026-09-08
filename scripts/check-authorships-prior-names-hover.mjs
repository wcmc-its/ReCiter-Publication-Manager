#!/usr/bin/env node
/**
 * Round 2, item 4 — the "previously accepted publication name variants" hover on a
 * MULTI-CANDIDATE row.
 *
 * The hover card itself was never removed: IdentityHoverCard, the per-cwid cache and
 * /api/db/authorships/prior-names all shipped with §2.6. What it was missing is the one row
 * where it earns its keep — "choose among 5 WCM homonyms", where the question a curator is
 * actually asking is "which of these people has already published under this byline name".
 * That row renders plain grey text on L2 (the isMulti branch), so the hover had nowhere to
 * hang; it now hangs off each candidate inside MultiEvidence.
 *
 * What this guards, and why each one is worth a check:
 *   1. ONE fetch path. The candidates must reuse requestPriorNames, not grow a second
 *      endpoint call that skips the asked-set.
 *   2. The asked-set ref actually covers the new call site. A five-candidate row that a
 *      curator sweeps back and forth over must cost five requests for the life of the page,
 *      not five per sweep — the endpoint caps at PRIOR_NAMES_CWID_CAP=50 cwids per call but
 *      caps nothing per session.
 *   3. The 220ms hover-intent still bites, and now on a per-cwid key rather than a boolean.
 *      A pointer travelling down five candidate rows to reach the Assign button must ask for
 *      none of them.
 *   4. The three states of the names block survive (Loading / no accepted papers /
 *      accepted-but-no-byline-name) — two of them look identical from the client and mean
 *      opposite things.
 *
 * Run: node scripts/check-authorships-prior-names-hover.mjs
 * No prerequisites, no DB, no build. The hover-intent block and requestPriorNames are pulled
 * out of the source as literal text and EVALUATED, wired to each other exactly as the
 * component wires them, so a future edit that breaks the debounce or the dedupe fails here.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const src = readFileSync(join(ROOT, "src/components/elements/Authorships/AuthorshipsTabs.tsx"), "utf8");

let n = 0;
const check = (label, actual, expected) => {
  assert.deepEqual(actual, expected, `${label}: got ${JSON.stringify(actual)}, want ${JSON.stringify(expected)}`);
  n++; console.log(`  ok  ${label}`);
};
const slice = (from, to) => {
  const a = src.indexOf(from);
  assert.ok(a > -1, `source no longer contains ${JSON.stringify(from)} — the check needs re-anchoring`);
  const b = src.indexOf(to, a + from.length);
  assert.ok(b > -1, `source no longer contains ${JSON.stringify(to)} after it`);
  return src.slice(a, b);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------------------------------------------------------------- 1. wiring, statically
console.log("1. one card, one fetch path, both feeds");
check("prior-names endpoint is called from exactly one place",
  (src.match(/"\/api\/db\/authorships\/prior-names"/g) || []).length, 1);
check("that place is requestPriorNames",
  /const requestPriorNames = useCallback[\s\S]{0,400}"\/api\/db\/authorships\/prior-names"/.test(src), true);
check("IdentityHoverCard has two render sites", (src.match(/<IdentityHoverCard/g) || []).length, 2);
check("one is fed by the row's proposed identity", /<IdentityHoverCard name=\{r\.top_name\}/.test(src), true);
check("one is fed by a candidate", /<IdentityHoverCard name=\{c\.name\} cwid=\{c\.cwid\}/.test(src), true);
check("the candidate card reads the SAME per-cwid cache",
  /<IdentityHoverCard name=\{c\.name\}[^>]*priorNames=\{priorNames\[c\.cwid\]\}/.test(src), true);

// The page hands the card the whole cache and the fetcher ITSELF — not a closure over
// top_cwid, which is what confined the hover to the single-candidate identity before.
check("page passes the whole cache", /priorNames=\{priorNames\}\s/.test(src), true);
check("page passes requestPriorNames unwrapped", /onHoverIdentity=\{requestPriorNames\}/.test(src), true);
check("card forwards both to MultiEvidence",
  /<MultiEvidence[\s\S]{0,300}priorNames=\{priorNames\} onHoverIdentity=\{onHoverIdentity\}/.test(src), true);
check("the candidate popup is gated on the hovered cwid", /\{hoverCwid === c\.cwid && \(/.test(src), true);

// ---------------------------------------------------------------- 2. the three states
console.log("2. the names block still has three distinct states");
const card = slice("const IdentityHoverCard", "// ---- main component");
check("loading", /Loading…/.test(card), true);
check("genuinely none", /No accepted papers yet/.test(card), true);
check("accepted, but no byline name recorded", /none with a byline name recorded/.test(card), true);
check("and the heading the owner remembers", /NAMES ON ACCEPTED PAPERS/.test(card), true);

// ---------------------------------------------------------------- 3. behaviour, for real
console.log("3. hover-intent + dedupe, evaluated off the source");

// (a) the real requestPriorNames, TS annotation stripped and nothing else.
const reqSrc = slice("const requestPriorNames = useCallback(", "\n  }, []);")
  .replace("useCallback((cwid?: string | null) =>", "((cwid) =>") + "\n  });";
const makeRequest = new Function("priorNamesAsked", "fetch", "apiHeaders", "setPriorNames",
  reqSrc + "\nreturn requestPriorNames;");

// (b) the real per-candidate hover-intent block out of MultiEvidence.
const hoverSrc = slice("const [hoverCwid, setHoverCwid]", "const anyDeptMatch")
  .replace(/use(State|Ref)<[^(]*>\(/g, "use$1(")   // strip the TS generics only
  .replace("(cwid?: string)", "(cwid)");
check("the delay is still 220ms", /setTimeout\([\s\S]*?, 220\)/.test(hoverSrc), true);
check("it opens on the cwid and asks for the same cwid",
  /setHoverCwid\(cwid\); onHoverIdentity\(cwid\);/.test(hoverSrc), true);

// harness: fake hooks, real timers, and a counting fetch.
let asked = [];
let unmount;
const priorNamesAsked = { current: new Set() };
const cache = {};
const setPriorNames = (fn) => Object.assign(cache, fn({ ...cache }));
const fetchStub = (url, opts) => {
  const cwid = JSON.parse(opts.body).cwid;
  asked.push(cwid);
  if (cwid === "boom") return Promise.resolve({ ok: false, status: 500 });
  return Promise.resolve({
    ok: true,
    json: () => Promise.resolve({
      names: { [cwid]: [{ first: "Renwick", last: "Li", n: 12 }] },
      accepted: { [cwid]: 12 },
      more: { [cwid]: 3 },
    }),
  });
};
const requestPriorNames = makeRequest(priorNamesAsked, fetchStub, {}, setPriorNames);

let popup = null;                                      // stands in for the hoverCwid state
const hover = new Function("useState", "useRef", "useEffect", "onHoverIdentity",
  hoverSrc + "\nreturn { openHover, closeHover };")(
  () => [popup, (v) => { popup = v; }],
  (init) => ({ current: init }),
  (fn) => { unmount = fn(); },
  requestPriorNames,
);

const main = async () => {
  // nothing before 220ms — this is the whole point of the delay on a five-row panel.
  hover.openHover("abc1001");
  await sleep(140);
  check("nothing asked at 140ms", asked, []);
  check("no popup at 140ms", popup, null);
  await sleep(140);
  check("asked once at 280ms", asked, ["abc1001"]);
  check("popup open on that candidate", popup, "abc1001");
  check("cache entry has the card's shape", cache.abc1001,
    { names: [{ first: "Renwick", last: "Li", n: 12 }], accepted: 12, more: 3 });
  hover.closeHover();
  check("leaving closes it", popup, null);

  // a pointer crossing a candidate on the way somewhere else asks for nothing.
  hover.openHover("def2002");
  hover.closeHover();
  await sleep(280);
  check("a crossed-over candidate is never requested", asked, ["abc1001"]);

  // a candidate the producer listed without a cwid: no request, and no popup stranded on
  // "Loading…" (requestPriorNames drops a blank cwid, so the card would never resolve).
  hover.openHover(undefined);
  hover.openHover("");
  await sleep(280);
  check("a cwid-less candidate asks for nothing", asked, ["abc1001"]);
  check("and opens nothing", popup, null);

  // the card can be removed mid-hover by an accept; the unmount cleanup must kill the timer.
  hover.openHover("ghi3003");
  unmount();
  await sleep(280);
  check("unmount cancels a pending hover", asked, ["abc1001"]);

  // THE CAP CONCERN: five candidates, swept twice. Five requests, not ten.
  const five = ["c1", "c2", "c3", "c4", "c5"];
  for (const c of five) { hover.openHover(c); await sleep(240); }
  check("one request per candidate", asked, ["abc1001", ...five]);
  for (const c of five) { hover.openHover(c); await sleep(240); }
  check("a second sweep costs nothing", asked, ["abc1001", ...five]);
  hover.openHover("abc1001");
  await sleep(240);
  check("nor does re-hovering the first one", asked, ["abc1001", ...five]);

  // a failed request must be retryable, or that one candidate is stuck on "Loading…" forever.
  hover.openHover("boom");
  await sleep(240);
  check("failure asked once", asked.filter((c) => c === "boom").length, 1);
  await sleep(20);                                     // let the .catch settle
  hover.closeHover();
  hover.openHover("boom");
  await sleep(240);
  check("failure retries on the next hover", asked.filter((c) => c === "boom").length, 2);

  console.log(`\n${n} checks passed.`);
};

main().catch((e) => { console.error(e); process.exit(1); });
