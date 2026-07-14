# Handoff — Literature Search (PR #824)

**Supersedes every earlier `HANDOFF-*.md` in this repo.** They are kept for history; this is the one
that is true. Written 2026-07-14, re-grounded against HEAD by twelve agents reading the actual code —
**every line number below was freshly read, not remembered.**

```bash
cd ~/worktrees/pm-literature-ui        # NOT ~/Dropbox/GitHub/ReCiter-Publication-Manager
git log --oneline -20                  # 16 commits since the review
npm run check:literature               # green, and needs NO LLM. Keep it that way.
```

## The situation in one paragraph

**You cannot deploy to dev.** Two AWS CodePipeline **manual approvals** are parked (Scopus since
2026-07-13 17:19 ET; PubMed's last dev build was 2026-06-13), so merging a PR does **not** redeploy
anything. That is fine. **Almost all of the remaining work is laptop work** — and this document is
ordered so that when someone finally clicks those approvals, the only unknown left is the deploy
itself.

## THE BIGGEST RISK — MEASURED 2026-07-14. It was not the screen. It was the cap.

This section used to say *"nobody has measured whether the AI screen is any good — and a wrong EXCLUDE
is invisible."* That measurement has now been run, against live PubMed and live Bedrock, on three
published Cochrane reviews whose included studies are known.

**Full write-up: `docs/RECALL-STUDY.md`. Reproduce: `node controllers/literatureSearch.recall.js`.**

| | |
|---|---|
| The **strategy** retrieved | **72 of 73** known-included studies — **99%** |
| Of those, the **top-50 relevance cut** showed the model | **1** — **1%** |
| Of what reached the model, the **AI screen** kept | **1 of 1**. It threw away **nothing.** |

**The screen was never the problem, and the fear in this document was aimed at the wrong thing.** The
strategy builder is excellent — it is the best part of this feature. What destroys the result is the
**top-50 relevance cut sitting between them**. Across all three reviews, exactly ONE of the 72 retrieved
known-good studies ranks in the top 50 (at #38). The typical eligible study sits around **rank 300**.

**And a bigger cap does not rescue it.** At a cap of 500 — 10x the screening cost — we still lose HALF
the diagnostic review's studies. PubMed relevance ranking is not built to float the primary studies a
systematic review would include, and it does not: it surfaces reviews and highly-cited work, a
population nearly *disjoint* from the eligible one. The cap is not a tuning knob. Ranking by relevance
is simply the wrong instrument for this job.

**What changed because of it:** the `.xlsx` that goes into **Covidence** carried an *"AI suggested /
Include / Exclude"* column over that sample. Covidence treats the file as a screening pass. A verdict
column over 50 relevance-ranked records — containing ~none of the eligible ones — is not a screen; it is
a screen-shaped object, and it would have quietly cost a published review its recall. **`recordSheets()`
now REFUSES the verdict columns whenever the sheet is truncated**, and says why, in the file. The
records and the strategy still ship: the Boolean query is the reliable half, and it is what Covidence
actually wants.

**THE SCREEN WAS THEN MEASURED DIRECTLY TOO** (`literatureSearch.screen.js`), by padding each review's
known-included studies to a full 50-record batch with retrieved-but-excluded records. **It is good:**
**99%** recall enriched, **89%** at a realistic prevalence, and its one loss is the same borderline paper
both times, excluded with a coherent reason. The classifier was never the problem.

**But that run caught the thing that matters more.** On one batch the model returned **43 verdicts for 50
records** — seven records got none, four of them known-included studies — and it did **not** trip the
`max_tokens` guard. It simply omitted them from a tool call whose schema says *"never omit a record"*.
That is item #1's failure mode, on an ordinary run, first try. Before the fix those four would have
arrived **pre-ticked and indistinguishable from AI-endorsed includes**. **The `screened: false` marker is
not belt-and-braces; it fires routinely.**

**And it closes off the obvious repair.** "Just screen a deeper slice" does not work as stated: at 50
records the model already drops ~14% of its verdicts, so a 500-record batch leans on fail-open for a
large silent fraction — safe, but screening nothing. **Verdict-completeness has to be solved first.**

Note also that the old worry recorded in memory — the model's "Adults" concept block killing 3 of 4
seeds — did **not** reproduce: seed-style recall was 99%.

## The work order — all of it laptop-only

Ranked by **damage to a librarian**, not by ease.

### 1. `invoke()` must refuse a truncated model answer — `controller.ts:912`

**The only finding that puts an UNREAD PAPER in front of a librarian wearing an AI endorsement.**

`invoke()` parses Bedrock's body and never reads `stop_reason`. A `max_tokens` cut mid-`tool_use`
still yields a parseable `verdicts` array that is simply **short**. `screenRecords()` then walks the
*records* and fails each missing verdict **open** — `{ include: true, reason: 'Not screened — no
verdict came back for this record. Read it yourself.' }` — and the UI renders a reason **only on an
exclude**. So the unscreened records arrive **pre-ticked**, are visually identical to endorsed ones,
inflate the "N included" tally, and go into the synthesis with no marker. The `missing` list never
reaches the client.

Two bugs, one chain. Fix together:
- In `invoke()`, immediately after decoding: if `stop_reason === 'max_tokens'`, **throw**. A visible
  502 the librarian can act on beats a silent short answer. (It becomes a 502 through the route's
  existing try/catch.)
- Add a discriminator to `Screened` (e.g. `screened: false`) on the fail-open branch, return it, and
  render the reason whenever `f && (!f.include || f.screened === false)`.

**Keep the fail-open default** — an unscreened record must not be silently *dropped* either. The bug
is that it is invisible, not that it is included.

### 2. The Markdown that people actually forward drops the fabrication warning — `LiteratureSearch.tsx:931`

Worse than the review said. `markdown()` hand-builds the clipboard synthesis and **omits
`synthesis.invented`** — the fabricated-citation warning that we go to the trouble of detecting,
render on screen, and stamp into the `.docx`. It also carries no query, no database, no yield and no
search date: the exact facts `literatureExport.ts` exists to guarantee.

So the **most-forwarded artifact is the only one with no provenance and no warning.**

Fix: build the markdown from the **same `Block[]`** the `.docx` uses — a `Block[] → markdown`
renderer beside `literatureDocx.ts`. Not over-engineering: the blocks already exist, and it is what
stops a *fifth* format drifting.

### 3. The model's own output is never bounds-checked — `controller.ts:1223`

The route enforces `MAX_CONCEPTS` / `MAX_LINES` / `MAX_TERMS` on anything the **browser** sends.
`buildStrategy()` applies **none** of them to what the **model** returns. So a strategy the server
happily builds, counts and renders can be one it then **refuses to re-count** — 502 on every
subsequent toggle, on the rows phase, and on Mode 2's escape hatch. The paid-for strategy becomes
read-only.

Also: the emptiness guard fires on the **raw** model input, ten lines *before* the
`.filter(c => c.lines.length)` that can empty it. A model returning `lines: []` yields a zero-concept
strategy that `assembleQuery()` renders as `''` and `runStrategy()` reports as **`hits: 0`** — a
confident zero for a search that does not exist.

Fix: export the bounds from `literatureSearch.strategy.ts` so both ends share them; validate the
model's output against them; move the emptiness guard **after** the filter.

### 4. One database's failure 502s the whole build — `search.ts:546`

The Mode 1 build loop is one unguarded `await` chain in a single `try`. Any database failing —
`buildStrategy`, `runStrategy`, `seedRecords`, `suggestFixes` — throws past `results`, **past
`logCost`**, out to a 502. So the moment a librarian ticks Scopus and the Scopus tool is old (it will
be: the dev deploy never ran, so `POST /scopus/search/query` **404s**), their **PubMed** strategy, its
counts, its seed validation and its fixes all evaporate — **and they are billed for it silently.**

Fix: per-database try/catch; a FAILED-database result the UI renders as an **explicit failure panel**
— never an empty-but-successful one, never a zero, and never Embase's "not counted" wording in place
of a real count. Hoist `usage` above the `try` so spend is always logged.

**Verify in two minutes:** point `RECITER_SCOPUS_API_URL` at a dead port. That is exactly what dev
will do until the approval is clicked.

### 5. `newSearch()` cannot cancel an in-flight re-count — `LiteratureSearch.tsx:830`

Two failures. **(a)** The effect bumps `seq` *after* its early returns, and emptying `strategies`
trips `if (!strategies.length) return` **before** the bump — so an outstanding response still passes
its guard and writes into the cleared array. The form the librarian just asked for **disappears**,
and "Copy PRISMA-S" / "Download everything" stay **live over the discarded search**. **(b)** The bump
happens in the effect *body* while the request is issued 300ms later inside the `setTimeout` — so a
bump whose timeout the cleanup cancels can never be matched by the `finally`, wedging `recounting`
**true for the session** and disabling every export until a reload.

Fix: move the bump **into** the timeout (a bump only exists for a request actually issued, so it
always has a matching `finally`), and in `newSearch()` bump `seq`, bump **each** `rowSeq` key
(monotonically — do *not* reset the object, or the next fetch's `mine = 1` collides with a first
in-flight fetch), clear `dirty`, and `setRecounting(false)`.

**Do NOT "fix" this by adding `recounting` to `inFlight`** — that disables *New search* for ~2.4s on
every toggle, killing the free-iteration loop this mode is built around.

**Must not regress:** the stale-response drop the guard exists for. Re-test with a slow earlier
request and a fast later one.

### 6. Give it all a net — and PR #824 has NO CI AT ALL

**52 commits, +19,350/−6,465 across 33 files, and not one automated check runs on push.** Rank 6 by
damage, but **start it first in wall-clock**, because everything above needs somewhere to prove
itself.

- Add `.github/workflows/*.yml`: `npm run check:literature` + `tsc --noEmit` + `next build`.
- All four `xp.strategyDoc()` calls in the check pass **no `rowCounts`**, so the Records column of the
  exported PRESS appendix is only ever exercised on its **blank** branch. The real map is computed at
  `check.js:605`, used for three assertions, and then thrown away — never once handed to the exporter
  that has to print it. ~15 lines; everything is already in scope.

Without CI, all six fixes are one careless commit from coming back, and nobody will know until a
librarian sees the wrong number.

### 7. The narrowing gate spends 7 NCBI counts on a column nobody reads — `LiteratureSearch.tsx:676`

No wrong number, but the blast radius is **other people's work**. The re-count effect fires
`fetchRows()` unconditionally, and it is deliberately allowed to run in Modes 2/3. Those modes
**never render the Results column** — so every narrowing tick spends a full per-line sweep (7 calls, a
measured 5.5s) on a map no JSX reads. NCBI's keyed quota is **shared with the ReCiter engine**, so the
cost lands on the nightly ETL too. The server already states the rule; the client forgot it.

One-line guard: `if (isSR) fetched.forEach(...)`. Touches the same effect as #5 — land #5 first or do
both in one PR.

## What can be prepared now, even though it is "blocked"

- **Merge PubMed #164 and #165.** Both are **OPEN, MERGEABLE/CLEAN, fully green** on CodeBuild *and*
  GitHub Actions — and simply **unreviewed**. Merging costs nothing and banks the contract. It will
  **not** redeploy the pod (the approval gate), and that is fine.
- **Build both jars locally and prove their contracts against live PubMed/Scopus right now** (`:8083`,
  `:8082`). RPM already honours `RECITER_PUBMED_API_URL` / `RECITER_SCOPUS_API_URL`, so this needs zero
  code changes.
- **The k8s manifest is DONE and committed** (`a4a0851`). `BEDROCK_MODEL_ID` + `AWS_REGION` as plain
  values; `LITERATURE_SEARCH_CWIDS` as an **`optional: true`** secretKeyRef.
- **Write the `bedrock:InvokeModel` IAM policy** and hand it to whoever owns the `reciter-pm` role.
  Grep finds **no Bedrock policy anywhere**, including ReCiter-CDK. **The trap:** a `us.` inference
  profile needs `InvokeModel` on **both** the inference-profile ARN **and** the underlying
  foundation-model ARNs **in every region the profile fans out to**. A policy naming only the profile
  ARN passes review and **fails at runtime**. Ship it with the `aws iam simulate-principal-policy`
  command that proves it — that needs no kubectl and no pod.
- **Write the PROD runbook now.** See below; it is the thing nobody has said out loud.

## PROD IS WORSE THAN DEV, AND NOBODY HAS SAID SO

**The prod pipeline only does `kubectl set image`. It NEVER does `kubectl apply`.**

So prod will **never** pick up `BEDROCK_MODEL_ID` / `AWS_REGION` / `LITERATURE_SEARCH_CWIDS` from the
manifest, no matter how correct the YAML is. It will serve a **permanent 503** until someone sets them
imperatively on `master_Next14`. Write that runbook now, while the reason is understood — not at 6pm
on release day.

## Verified this session, so nobody re-derives it

- **The allowlist FAILS SHUT.** Not reasoned — *executed*, against the compiled `isAllowlisted()` with
  `LITERATURE_SEARCH_CWIDS` unset, `""`, `"   "` and `",,,"`. Every case returns `false` for every
  CWID. An absent key means the pilot is closed, not open. **This is not a security finding.**
- **Embase (Ovid) is `countable: false` and makes zero network calls**, so it cannot cause #4.
- **`zzzprobioticzzz/` → 0 in Ovid.** A nonexistent Emtree heading returns zero rather than degrading
  into a keyword search, so a hallucinated heading costs *sensitivity* and can never produce a wrong
  *number*. That is why Embase was safe to ship uncounted. See `EMBASE-SPIKE.md`.
- **Scopus #35 is merged** (`cd99761e`) but the deploy **never ran** — the pipeline is parked at a
  manual approval, and the newest ScopusService build resolved a **pre-merge** commit. So
  `reciter-scopus-dev` will **404** on `POST /scopus/search/query`. This is exactly what makes #4 bite.

## Still to run

- **DOES VERDICT COMPLETENESS HOLD AT 200 OR 500 RECORDS?** The 50-record case is **solved**:
  `screenRecords()` was observed returning 43 verdicts for 50 records (the seven omitted were positions
  25-31 — a contiguous window out of the middle, i.e. lost-in-the-middle, not truncation), so it now
  **re-asks for exactly the skipped records**. Measured after the fix: **50 of 50 in every batch.** But
  the whole point of solving it was to make a **deeper, unranked slice** buildable — and nobody knows
  whether completeness survives a 200- or 500-record list, where the middle is far bigger. That is now
  the experiment that unlocks the cap problem, and it is cheap: raise `CAP` in `screen.js` and watch the
  `literature-screen-reask` log.
  - *"What is the screen's false-negative rate?"* — **ANSWERED.** 99% enriched / 100% realistic. Its one
    loss is a borderline paper it is genuinely stochastic about (excluded in one batch, included in
    another, coherent reasoning both times). See `docs/RECALL-STUDY.md` Part 2.
  - *"Should we chunk, or use a better model?"* — **NO to both.** We are already on the most capable
    model, and the drop rate is unstable anyway (7 records one run, 1 the next) — a rate that swings 7x
    cannot be managed, only repaired. Chunking shrinks the middle but never reaches zero and screens each
    batch blind to the others. Re-asking only pays for the failures and terminates.
- **Embase Part 3** (`EMBASE-SPIKE.md`): do PMIDs 37314797 / 34875345 / 35654766 land inside line 7 in
  Ovid? Strategy *quality*, not feasibility.
- **The librarian questions**, which are now the real bottleneck: is the Scopus rendering
  peer-reviewable with no controlled vocabulary? **Is an uncounted Embase strategy useful, or noise?**
  And **PubMed Clinical Queries hedges** are the standard librarian instrument for Mode 3 and appear in
  **none** of the design docs — **ask before inventing our own.**
  - *"May a relevance-truncated 50-of-N sample go into Covidence with an 'AI suggested' column?"* —
    **ANSWERED, by measurement, and the answer is no.** The sample contains ~1% of the eligible
    studies. The export now refuses the verdict columns when truncated. See `docs/RECALL-STUDY.md`.

## Do NOT re-litigate

- **No query-translation layer, ever.** `Concept = {label}` is DB-neutral; `Rendering = {db, lines,
  limits}` is DB-native and independently **generated**. There is no MeSH→Emtree map and there must
  never be one.
- **A dialect is PLATFORM + DATABASE.** WCM's Embase is on **Ovid**, not Embase.com. `exp probiotic
  agent/`, not `'probiotic agent'/exp` — Ovid rejects the latter outright.
- **The Elsevier creds stay in the TOOL.** RPM holds no `SCOPUS_API_KEY`.
- **`count=0` is not "no records" in Scopus** (it silently returns 25; a cheap count is `count=1`).
  **`view=COMPLETE` caps a page at 25.**
- **No dollar figure. No SSE. No PHI detector, ever.**
- **The server ranks; the model never does.** **iCite never sorts, never filters, never reaches the
  model.**
- **DO NOT parallelise RPM's count calls.** The tool owns the rate policy.
- **Counts are NEVER summed across databases.** **EMBASE EMBEDS MEDLINE** — the overlap is enormous.

## Permanently out of scope

Dual independent screening, full-text screening, PRISMA flow diagrams, risk-of-bias, GRADE,
meta-analysis. Covidence and Rayyan do these and the SR team trusts them. **We hand off; we do not
compete.**

## Running it locally

```bash
# PubMed tool — MUST be the sort/retmax build (#164), or Modes 2-3 print "by most relevant"
# over an unranked slice. `mvn` is fine (Temurin 17 is the only JDK).
cd ~/worktrees/pubmed-sort-retmax && java -jar target/reciter-pubmed-retrieval-tool-1.1.0.jar --server.port=8083

# Scopus tool — dev, post-#35.
cd ~/worktrees/scopus-dev && java -jar target/reciter-scopus-retrieval-tool-3.0.0.jar --server.port=8082

cd ~/worktrees/pm-literature-ui && PORT=3000 npm run dev
# login paa2013 -> sidebar -> Literature Search.  /curate errors on landing; ignore it.
```

`.env.local`: `RECITER_PUBMED_API_URL=http://localhost:8083`,
`RECITER_SCOPUS_API_URL=http://localhost:8082`, `AWS_REGION=us-east-1`,
`BEDROCK_MODEL_ID=us.anthropic.claude-opus-4-8`, `LITERATURE_SEARCH_CWIDS=paa2013`.

**The full finding ledger, with what was fixed and why, is in `REVIEW-pr824.md`.**
