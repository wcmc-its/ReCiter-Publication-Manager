# Handoff — Literature Search: what's real, what's missing, what's next

**Read first:** `HANDOFF-literature-search-ui.md` (the design contract — still authoritative) and
`~/Dropbox/Projects/PubMed MCP/SPEC-literature-search.md` (backend spec). This doc supersedes
`HANDOFF-literature-search-bedrock-local.md`, whose work is now done.

**Status 2026-07-13:** Mode 1 runs end to end on Bedrock, locally, and the UI has been driven in a
browser. But **the page is not yet faithful to the design contract** — §3 of the UI handoff asked
for things that were never built, and a couple of them are load-bearing rather than cosmetic. That
gap is the substance of this doc.

## Branches (both LOCAL, nothing pushed, no PRs)

| Branch | Base | Commits | What |
|---|---|---|---|
| `feature/pm-literature-ui` | `feature/pm-literature-search` | `85e96b8`, `fe53181`, `98b98e7`, `035e75c` | Bedrock swap, local login, the UI fixes |
| `fix/contrast-aa-tokens` | fresh `origin/dev` | `12d8747` | App-wide WCAG AA text contrast. Independent — review separately. |

Worktrees: `~/worktrees/pm-literature-ui`, `~/worktrees/pm-contrast-tokens`.

## Running it locally (no reciter-dev, per the constraint)

```bash
# 1. PubMed retrieval tool — prebuilt jar, no AWS, no DB, boots in ~10s.
#    Do NOT use mvn: `mvn` on this machine runs JDK 25 and the pinned Lombok dies on it.
java -jar ~/Dropbox/GitHub/ReCiter-PubMed-Retrieval-Tool/target/reciter-pubmed-retrieval-tool-1.1.0.jar \
  --server.port=8083

# 2. The app
cd ~/worktrees/pm-literature-ui && PORT=3000 npm run dev
# login paa2013 / $LOCAL_DEV_PASSWORD, then go to /literature
```

`.env.local` needs: `RECITER_PUBMED_API_URL=http://localhost:8083`, `AWS_REGION=us-east-1`,
`BEDROCK_MODEL_ID=us.anthropic.claude-opus-4-8`, `LITERATURE_SEARCH_CWIDS=paa2013`.

**Login lands you on `/curate/paa2013`, which errors.** That is not this feature: `/curate` calls
the ReCiter backend on reciter-dev, which rejects our API key (`{"status":401,"message":"Invalid
API key"}`). Literature Search touches none of it. Navigate to `/literature` directly.

`npm run check:literature` still passes and needs no LLM — keep it green.

## Verified by real runs, not typecheck

- **Bedrock works.** `us.anthropic.claude-opus-4-8` IS an ACTIVE inference profile in account
  665083158573/us-east-1 — the old handoff's "do not assume 4-8 has access" is **wrong**.
- **Use `InvokeModel`, not Converse.** InvokeModel passes the native Anthropic Messages body
  through verbatim, so SYSTEM_PROMPT, the tool schema and the forced `tool_choice` survive
  unchanged. Converse would force a rewrite of all three. Creds from the default chain; `modelId`
  is a command param, never a body field.
- **Counts are reproducible** because the prompt forces a field tag on every term. **Never relax
  that rule** — automatic term mapping only rewrites UNTAGGED terms, and reproducibility is the
  whole promise.
- **Miss-diagnosis is derived, not guessed**, and distinguishes a concept-block defect from a
  deliberate limit.
- Expert panel returns ~1,230 faculty; the LIMIT is load-bearing and the panel states the honest
  total.

## THE FIDELITY GAPS — the page vs §3 of the design contract

Everything below was specified and is **not built**. Ordered by how much it matters.

### 1. No "Edit & re-run" — the librarian's core loop is missing (P0)

§7.4 said ship **both** Copy and Edit-and-re-run in v1, where re-running an edited query
**re-validates the seeds against it**. Only `Copy query` exists.

This is not a nice-to-have. The whole workflow the feature promises is: *strategy misses a seed →
widen the failing block → re-run → confirm the seed now comes back.* Without Edit & re-run, the
librarian reads "Excluded by the Adults block", copies the Boolean out to PubMed proper, edits it
there, and never comes back. **We built the diagnosis and omitted the cure.**

When building it: re-run must pin the edited query verbatim (tell the model: use this exact query,
do not rewrite it) and re-run `validateSeeds` against it.

### 2. The strategy rows have no concept labels — the miss diagnosis dangles (P0, cheap)

The validation panel says **"Excluded by the *Adults* block"**, but the numbered strategy rows
render `c.terms` only. Nothing on the screen is labelled "Adults". The librarian is told which
block is broken and then has to guess which row that is.

The model already returns `c.label` (it's used in the PRISMA-S block and in the diagnosis). Just
render it on the row. This is a few lines and it closes the loop between the finding and the fix.

### 3. Seeds show a bare PMID — no author, no year, no title (P1)

Spec Screen 2 shows `✓ Nikolova 2023   PMID 37285127`. We render `✓ PMID 37314797`. A librarian
naming 4 seeds cannot tell which paper missed without pasting the PMID into PubMed.

Note this is genuinely more than a UI change: Mode 1 **only counts, it never fetches records**,
which is what makes it cheap and cap-free. Getting titles means one `esummary`-style fetch for the
3–5 seeds only. That is a small, bounded exception to "never retrieve" — worth it, but make it a
deliberate decision, not an accident.

### 4. No Export CSV (P1)

Spec Screen 2 has `[ Copy PRISMA-S methods block ] [ Export CSV ]`. Only the first exists. §4 says
to reuse `Report/ExportModal.tsx` + `exceljs` (already a dependency, client-side).

### 5. Limits is a free-text box, not the spec'd dropdowns (P2)

Spec: `Date [2021 – 2026 ▾]  Pub type [RCT + Meta ▾]`. Built: a single free-text "Limits —
optional" input whose contents are passed to the model as prose. It works, but it is not what was
signed off, and free text means the model decides what "2021-2026" means.

### 6. No Embase "not searched" placeholder card (P2)

Spec Screen 2 shows a greyed Embase card under the PubMed one. The form has the disabled Embase
checkbox, but the results area does not. The API already returns `databases: [result]` — the array
seam from §2 is correct — so this is purely presentational.

### 7. The form does not collapse after a run (P2)

§7.3 proposed the form collapses to a read-only summary bar
(`Search strategy · "probiotics…" · PubMed 1,247 · [New search]`). Today the full form stays
expanded above the results, so on a laptop the deliverable sits below the fold.

### 8. Concept blocks are one line each, not PRESS-style numbered sub-lines (P2 — needs a librarian)

Spec Screen 2 numbers **every line** the way a published strategy does:

```
1  "Gastrointestinal Microbiome"[MeSH] OR "Probiotics"[MeSH] …
2  probiotic*[tiab] OR synbiotic*[tiab] …
3  1 OR 2
4  "Depression"[MeSH] …
7  3 AND 6
```

We merge MeSH + free-text into a single numbered row per concept and add one combination row.
Ours is defensible and more compact, but **published SR strategies are peer-reviewed line-by-line**
(PRESS), and a reviewer expects to cite "line 3". **Ask the SR librarians which they want** before
rebuilding this — it changes the tool schema, not just the render.

## Open decisions (not code — judgment calls)

### A. The "Adults" concept block (needs a librarian, highest value)

Ask "…in adults?" and the model emits a **third concept block** (`Adult[MeSH] OR Middle Aged[MeSH]
OR Aged[MeSH] OR adult*[tiab]…`) and ANDs it in. In a live run this excluded **3 of 4 known-item
seeds**.

This is a classic systematic-review search error — a population descriptor belongs in the limits,
not as an AND-ed concept, because many trials in adults are not indexed with those terms — and it
silently guts recall. **The known-item validation caught it and named the block, which is the
feature working exactly as designed.** But the strategy the model writes is, today, wrong in a way
a real SR team would reject.

Likely fix is one line in `SYSTEM_PROMPT` ("never make a concept block from a population
descriptor; express it as a limit"). **Do not change the prompt unilaterally** — the prompt is
load-bearing for count reproducibility and this is a methods decision.

### B. `estUsd` in the cost log is NOT trustworthy

Rates come from `BEDROCK_USD_PER_MTOK_IN/OUT`, defaulting to **Anthropic's first-party list price
($5/$25)** — explicitly **not** a verified Bedrock rate. Someone must read the AWS Bedrock pricing
page for `us.anthropic.claude-opus-4-8` and set those two vars. Until then the field lies.

### C. Access model still the env allowlist

`LITERATURE_SEARCH_CWIDS` gates the API (authoritative) — but the **nav item is visible to every
Superuser / Curator_All / Reporter_All**, so a non-allowlisted reporter can open the page, type a
question, and hit a 403. The 403 is now visible (it used to render as nothing), but it is still a
confusing path. Either narrow the nav item or accept it for a 2–3 person pilot.

### D. InfoSec review — unchanged, and now easier

Still the first time RPM sends user-typed text to an LLM vendor. **It is now Bedrock (in-account,
AWS) rather than api.anthropic.com**, which may materially change the answer. Worth re-asking with
that fact in hand. Does not block Mode 1.

## Bugs found by actually looking at the page (all fixed — don't re-fix)

Listing these because every one passed typecheck, and three of them would have passed any test
suite we'd have written:

- **The strategy was unreadable.** Concept blocks were `nowrap`; a 650-char block laid out ~4,500px
  wide in a ~980px card. The deliverable of the mode was off-screen. (`035e75c`)
- **Every error on the page was invisible.** The component toasted, but nothing mounts a
  ToastContainer and the AppLayout fallback is dead code gated on `reciterConfig.showToasts` — a
  key that does not exist. A 403 rendered as *nothing* and read as a dead button. (`85e96b8`)
- **Copy silently did nothing** for the same reason. (`fe53181`)
- **The expert panel silently rendered empty.** `meshFromConcepts` required *quoted* MeSH
  descriptors; unquoted ones are equally valid PubMed and the model emits both. (`85e96b8`)
- **Local login was two bugs**: no LOCAL short-circuit, plus `findUserPermissions` keyed on an
  email the login form never sends → zero roles → `/noaccess`. (`85e96b8`)
- `@aws-sdk/client-dynamodb` was in `package.json` but in neither the lockfile nor `node_modules`,
  despite `articleProvenance.ts` importing it. Reconciled.

## Suggested order

1. **Concept labels on the strategy rows** (gap 2). Few lines, closes the diagnosis→fix loop.
2. **Edit & re-run + seed re-validation** (gap 1). This is the feature's actual workflow.
3. **Ask the SR librarians** about the Adults block (A) and the PRESS line-numbering (gap 8).
   Longer lead time than the code — start it in parallel.
4. Seed titles (gap 3), Export CSV (gap 4), collapse-after-run (gap 7).
5. Verify the Bedrock cost rate (B), then push and open PRs.

## Do NOT build

A DB abstraction layer (the 3 seams from §2 already cover it), a query-translation layer, a rate
limiter (the allowlist is the guardrail), or a **PHI detector** — the obvious MRN heuristic is
"7–10 digit number", which fires on every 8-digit PMID in the seeds field.

Permanently out of scope: dual screening, full-text screening, PRISMA flow diagrams, risk-of-bias,
GRADE, meta-analysis. Covidence and Rayyan do these and the SR team trusts them. **We hand off; we
do not compete.**
