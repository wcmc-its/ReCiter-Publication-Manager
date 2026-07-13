# Handoff — Literature Search: what's real, what drifted from the mockup, what's next

**Read first, in this order:**
1. **`docs/literature-search-mockup.html`** — the signed-off clickable mockup, now saved in-repo
   (was only a `claude.ai/code/artifact` URL, which is how it got skipped). **Open it in a browser
   and click through the four steps before touching the page.**
2. `HANDOFF-literature-search-ui.md` — the design contract (§3 screens, §7 decisions).
3. `~/Dropbox/Projects/PubMed MCP/SPEC-literature-search.md` — backend spec.

`HANDOFF-literature-search-bedrock-local.md` is **done** and superseded by this doc.

**Status 2026-07-13:** Mode 1 runs end to end on Bedrock, locally, and has been driven in a browser.
**But the page was built from the ASCII fallback in the handoff, not from the mockup** — nobody
opened the artifact. The result is faithful in spirit and wrong in several specifics, and two of
those specifics are the load-bearing ones. That drift is the substance of this doc.

## Branches (both LOCAL, nothing pushed, no PRs)

| Branch | Base | Commits | What |
|---|---|---|---|
| `feature/pm-literature-ui` | `feature/pm-literature-search` | `85e96b8` … `19eefb4` | Bedrock swap, local login, UI fixes |
| `fix/contrast-aa-tokens` | fresh `origin/dev` | `12d8747` | App-wide WCAG AA contrast. **Independent — review separately.** |

Worktrees: `~/worktrees/pm-literature-ui`, `~/worktrees/pm-contrast-tokens`.

## Running it locally (never touches reciter-dev)

```bash
# PubMed retrieval tool — prebuilt jar. No AWS, no DB. Boots in ~10s.
# Do NOT use mvn: it runs JDK 25 on this machine and the pinned Lombok dies on it.
java -jar ~/Dropbox/GitHub/ReCiter-PubMed-Retrieval-Tool/target/reciter-pubmed-retrieval-tool-1.1.0.jar \
  --server.port=8083

cd ~/worktrees/pm-literature-ui && PORT=3000 npm run dev
# login paa2013 / $LOCAL_DEV_PASSWORD  →  then go to /literature
```

`.env.local`: `RECITER_PUBMED_API_URL=http://localhost:8083`, `AWS_REGION=us-east-1`,
`BEDROCK_MODEL_ID=us.anthropic.claude-opus-4-8`, `LITERATURE_SEARCH_CWIDS=paa2013`.

**Login lands on `/curate/paa2013`, which errors — ignore it.** That page calls the ReCiter backend
on reciter-dev, which rejects our API key (`Invalid API key`). Literature Search touches none of it.

`npm run check:literature` passes and needs no LLM. Keep it green.

## THE DRIFT — built page vs `docs/literature-search-mockup.html`

### 1. The strategy is not PRESS-numbered (P0 — this is the big one)

**Mockup** numbers every line the way a published SR strategy is written and peer-reviewed:

```
1  "Gastrointestinal Microbiome"[MeSH] OR "Probiotics"[MeSH]
2  probiotic*[tiab] OR synbiotic*[tiab] OR psychobiotic*[tiab]
3  1 OR 2
4  "Depression"[MeSH] OR "Depressive Disorder"[MeSH]
5  depress*[tiab]
6  4 OR 5
7  3 AND 6
8  7 AND (2021:2026[dp]) AND (Randomized Controlled Trial[pt])
```

**Built** collapses each concept to a single row (MeSH and free-text merged) plus one combination
row. It reads fine and it is *wrong for the audience*: PRESS review is line-by-line, and the whole
claim of this mode is that the output is peer-reviewable and publishable as the PRISMA-S appendix.

This is not cosmetic — **it changes `STRATEGY_TOOL`**. The model must return each concept as a
*pair* of lines (MeSH line, free-text line) plus explicit combination lines, rather than one
`terms` string per concept. `assembleQuery` and the PRISMA-S block change with it.

### 2. The miss explanation is missing its two most valuable halves (P0)

**Mockup:**

> **Why:** it clears your probiotics block (MeSH-indexed under *Probiotics*) but fails the
> depression block — PubMed indexes it under *Emotions*, not *Depression*, and the abstract never
> says "depression." **Adding `"Emotions"[MeSH] OR mood[tiab]` to line 4 retrieves it, at a cost of
> +426 records to screen.**

**Built:** *"Excluded by the Depression block. Widen that concept to retrieve it."*

We ship the **diagnosis** and withhold both the **prescription** and its **price**:
- **the concrete terms to add** — the model can propose these;
- **the cost in records** — computable with *one more count call* (`(widened strategy)` vs
  `(strategy)`), entirely in keeping with Mode 1's counts-only design.

That trade — *"+426 records to screen buys you this missing paper"* — is the actual judgment a
librarian is trying to make. Without it we hand them a problem and no lever.

Note this also **dissolves my earlier "add concept labels" suggestion**: the mockup has no labels.
It refers to **"line 4"**, which works precisely *because* of PRESS numbering. Do (1) and this
follows.

### 3. No "Edit & re-run" (P0)

Mockup footer: `[ Copy ]  [ Edit & re-run ]`. Built: `[ Copy query ]` only.

§7.4 specified both for v1, with the edited query **re-validating the seeds**. Query iteration is
the librarian's core loop: *strategy misses a seed → widen the failing line → re-run → confirm the
seed returns.* Re-run must pin the edited query verbatim (tell the model: use this exact query, do
not rewrite it) and re-run `validateSeeds` against it.

### 4. Seed rows show a bare PMID (P1)

Mockup: `✓ Nikolova (2023)  PMID 37314797`. Built: `✓ PMID 37314797`.

A librarian naming 4 seeds cannot tell which paper missed. **Caveat:** Mode 1 deliberately *only
counts, never fetches records* — that is what makes it cheap and cap-free. Author+year needs one
bounded `esummary` fetch **for the 3–5 seeds only**. Small, worth it, but make it a deliberate
exception rather than an accident.

### 5. No collapsed summary bar after a run (P1)

Mockup Screen 2 replaces the form with:
`[Search strategy] "Do probiotics reduce symptoms of depression in adults?"  [New search]`

Built keeps the whole form expanded above the results, so on a laptop the deliverable sits below
the fold. (§7.3 proposed exactly this bar.)

### 6. Limits is a free-text box, not the two dropdowns (P1)

Mockup: `Date [2021 – 2026 ▾]` and `Publication type [RCT + Meta-analysis ▾]` — real `<select>`s.
Built: one free-text "Limits — optional" input, whose contents are passed to the model as prose. It
works, but the model then decides what "2021-2026" means, which quietly undermines reproducibility.

### 7. No Export CSV (P2)

Mockup: `[ Export CSV ]  [ Copy PRISMA-S methods block ]`. Built: only the second. §4 says reuse
`Report/ExportModal.tsx` + `exceljs` (already a dependency, client-side).

### 8. No Embase "not searched" card (P2)

Mockup shows a dashed placeholder under the PubMed strategy: *"A Cochrane-compliant search needs
Embase and CENTRAL too. Coming soon."* The form has the disabled checkbox; the results do not have
the card. The API already returns `databases: [result]`, so the array seam from §2 is correct —
this is purely presentational.

### 9. Smaller stuff (P2)

- **Mode picker**: mockup uses bordered radio *cards* (accent-tinted when selected); built uses
  plain inline radios.
- **Expert panel footer**: mockup ends with *"Ranked by accepted publications. Live query against
  2,310,368 person–MeSH rows."* Built omits it.
- Mockup has no breadcrumb-free layout; built has no `Literature Search › Search strategy` crumb.

## Open decisions (judgment, not code)

### A. The "Adults" concept block — highest value, needs a librarian

Ask "…in adults?" and the model emits a **third "Adults" concept block** (`Adult[MeSH] OR Middle
Aged[MeSH] OR Aged[MeSH] OR adult*[tiab]…`) and ANDs it in. In a live run this excluded **3 of 4
known-item seeds**.

Classic SR search error — a population descriptor belongs in the limits, not as an AND-ed concept,
because many trials in adults are simply not indexed with those terms. It silently guts recall.
**The known-item validation caught it and named it, which is the feature working exactly as
designed** — but the strategy the model wrote is one a real SR team would reject.

Probably one line in `SYSTEM_PROMPT` ("never make a concept block from a population descriptor;
express it as a limit"). **Do not change the prompt unilaterally** — it is load-bearing for count
reproducibility, and this is a methods call.

### B. `estUsd` is not trustworthy

Rates come from `BEDROCK_USD_PER_MTOK_IN/OUT`, defaulting to **Anthropic's first-party list price
($5/$25)** — explicitly *not* a verified Bedrock rate. Read the AWS Bedrock pricing page for
`us.anthropic.claude-opus-4-8` and set them. Until then the field lies.

### C. Access

`LITERATURE_SEARCH_CWIDS` gates the API (authoritative), but the **nav item is visible to every
Superuser / Curator_All / Reporter_All** — so a non-allowlisted reporter can open the page, type a
question and hit a 403. The 403 is at least visible now. Narrow the nav item, or accept it for a
2–3 person pilot.

### D. InfoSec — unchanged, but the facts changed

Still the first RPM surface that sends user-typed text to an LLM vendor. **It is now Bedrock
(in-account AWS), not `api.anthropic.com`** — which may materially change the answer. Worth
re-asking with that in hand. Does not block Mode 1.

## Verified by real runs — do not re-litigate

- **`us.anthropic.claude-opus-4-8` IS an ACTIVE Bedrock inference profile** (acct 665083158573,
  us-east-1). The old handoff's "do not assume 4-8 has access" is **wrong**.
- **`InvokeModel`, not Converse.** InvokeModel passes the native Anthropic Messages body verbatim,
  so `SYSTEM_PROMPT`, the tool schema and the forced `tool_choice` all survive unchanged. Converse
  would force a rewrite of all three. `modelId` is a command parameter, never a body field; creds
  come from the default chain.
- **Counts reproduce the PubMed web UI** *because* the prompt forces a field tag on every term.
  **Never relax that rule** — automatic term mapping only rewrites UNTAGGED terms, and
  reproducibility is the entire promise.
- **Miss-diagnosis is derived, not guessed** (re-count the seed against each block).
- **The PubMed tool needs zero infra** — no DynamoDB, no S3, no AWS, no key to boot.

## Bugs found only by looking at the page (fixed — don't re-fix)

Every one of these passed typecheck, and three would have passed any test suite we'd have written:

- **The strategy was unreadable** — `nowrap`, so a 650-char block laid out ~4,500px wide in a
  ~980px card. The deliverable of the mode was off-screen. (`035e75c`)
- **Every error was invisible** — the component toasts, but nothing mounts a `ToastContainer` and
  the AppLayout fallback is dead code gated on `reciterConfig.showToasts`, a key that does not
  exist. A 403 rendered as *nothing* and read as a dead button. (`85e96b8`)
- **Copy silently did nothing**, same cause. (`fe53181`)
- **The expert panel silently rendered empty** — `meshFromConcepts` required *quoted* MeSH
  descriptors; unquoted ones are equally valid PubMed and the model emits both. (`85e96b8`)
- **Local login was two bugs** — no LOCAL short-circuit, plus `findUserPermissions` keyed on an
  email the login form never sends → zero roles → `/noaccess`. (`85e96b8`)
- `@aws-sdk/client-dynamodb` was declared in `package.json` but absent from both the lockfile and
  `node_modules`, despite `articleProvenance.ts` importing it. Reconciled.

## Suggested order

1. **PRESS line-numbering (drift 1)** — schema change; everything else on this list assumes it.
2. **Miss explanation: proposed terms + record cost (drift 2)** — one extra count call. This is the
   feature's whole value proposition and it is currently half-delivered.
3. **Edit & re-run + seed re-validation (drift 3)** — the librarian's loop.
4. **Ask the SR librarians** about the Adults block (A). Longer lead time than the code — start it
   in parallel with 1–3, not after.
5. Seed author/year (4), summary bar (5), the two dropdowns (6), Export CSV (7), Embase card (8).
6. Verify the Bedrock cost rate (B), then push and open PRs.

## Do NOT build

A DB abstraction layer (the three seams in §2 already cover it), a query-translation layer, a rate
limiter (the allowlist is the guardrail), or a **PHI detector** — the obvious MRN heuristic is
"7–10 digit number", which fires on every 8-digit PMID in the seeds field.

Permanently out of scope: dual independent screening, full-text screening, PRISMA flow diagrams,
risk-of-bias, GRADE, meta-analysis. Covidence and Rayyan do all of this and the SR team trusts
them. **We hand off; we do not compete.**
