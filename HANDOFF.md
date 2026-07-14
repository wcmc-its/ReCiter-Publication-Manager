# Handoff — Literature Search (PR #824)

**Supersedes every earlier `HANDOFF-*.md` in this repo, and the previous version of itself.** Rewritten
2026-07-14 at the end of the session that closed the original work order and measured the feature for the
first time. Everything below was executed, not remembered.

```bash
cd ~/worktrees/pm-literature-ui        # NOT ~/Dropbox/GitHub/ReCiter-Publication-Manager
git log --oneline -8                   # 7 commits this session, ALL UNPUSHED
npm run check:literature:pure          # the CI gate. No network, no LLM, no .env.local. Keep it that way.
npm run check:literature               # the live integration check. Needs the PubMed tool on :8083.
```

## The situation in one paragraph

**The code is no longer the bottleneck.** The original seven-item work order is done, the residual bugs
seven adversarial reviewers found behind those fixes are done, PR #824 finally has CI, and the feature has
been measured end-to-end against live PubMed and live Bedrock for the first time. What gates a librarian
actually using this is now **a human conversation and three ops actions**, not more engineering. The two
CodePipeline manual approvals are still parked, so merging still redeploys nothing — and that is still
fine, because everything that mattered this session was laptop work.

## READ THIS FIRST: what the measurements found, because it changes what the product IS

Three studies, all reproducible, all committed. Full write-up in **`docs/RECALL-STUDY.md`**; raw artifacts
in `.litrecall-run.json` / `.litquestion-run.json`.

| | |
|---|---|
| The **strategy** retrieves | **99%** of the studies a published Cochrane review included (72/73) |
| It survives a **badly-phrased question** | **99%** on a bare keyword string with no criteria at all |
| The **AI screen** keeps what it sees | **99%** enriched / **100%** at realistic prevalence |
| The **top-50 relevance cut** shows the model | **1%** of the eligible studies |
| **End to end** | **1 of 73** |

**Both halves are excellent and the thing between them destroys the result.** A known-good study typically
ranks ~**300th** by PubMed relevance; across three reviews exactly one of 72 lands in the top 50. Relevance
ranking is not built to float the primary studies a systematic review needs, and it doesn't.

**So Mode 1's deliverable is THE BOOLEAN QUERY.** It is excellent, reproducible, peer-reviewable, robust to
phrasing, and it is exactly what Covidence wants. The 50-record sample is triage, and the `.xlsx` now
**refuses** its "AI suggested / Include / Exclude" column when the sheet is truncated — because that file
opens in Covidence, where it is treated as a screening pass, and a verdict column over a sample containing
~none of the eligible studies is a screen-shaped object that would quietly cost a published review its
recall.

## DO NEXT

### 1. Push. (Blocked on a human saying "push".)
Seven commits are local; **PR #824 does not know about any of them.** This is also the ONLY real test of
the CI we built: it is *proven* to run offline (executed from a clean `git archive` under `env -i` with a
preload that hard-exits on any socket/DNS/fetch), but **it has never actually run on a GitHub runner.**
Until it does, "PR #824 has CI" is a claim, not a fact.
Branch `feature/pm-literature-mode2` → base `dev`. PR is titled DO NOT MERGE — review only.

### 2. Rewrite the PR description.
#824 is now **59 commits, ~+19k lines**, and its story has changed completely: it was "here is a literature
search feature", it is now "here is the feature, plus the measurements showing which half of it works and
which half we just disabled." No reviewer will reconstruct that from the diff.

### 3. Browser-verify the UI that was never driven.
The Scopus **failure panel was verified end-to-end** in a browser (dead port → PubMed strategy survives
intact, explicit failure panel, cost still logged). **These were NOT driven and are typechecked + reasoned
only** — the gate flagged it and it is right:
- the **unscreened warning strip** (`screened: false`) and the **"N never screened"** tally arithmetic
- the **keystroke bounds refusal** on `addLine()` / `edit()` (MAX_LINES / MAX_TERMS)
- the **degraded** note (search succeeded, enrichment failed)
- the rebuilt **PRISMA-S methods block** (now a `Block[]` renderer, carries the AI disclosure)

### 4. THEN STOP BUILDING AND GO TO THE LIBRARIAN.
**This is the real bottleneck and it is now a much better conversation, because we have numbers.**
- The strategy is 99% and robust. **Is a peer-reviewable Boolean query, handed to Covidence, what they
  actually want?** If yes, Mode 1 is nearly done.
- **Was refusing the AI column on a truncated sheet the right call, or too conservative?** Made on the
  data; they own it.
- **Is an uncounted Embase strategy useful, or noise?**
- **PubMed Clinical Queries hedges** are the standard librarian instrument for Mode 3 and appear in NONE
  of our design docs. **Ask before inventing our own.** This one is a trap.

Everything else buildable is polish, and a thirty-minute conversation could redirect it.

## Open code items (both small, both measured-motivated)

- **"ALWAYS GIVE SEEDS" in the UI.** Highest-leverage change left. The tool's own seed validation +
  failing-block diagnosis is what *diagnoses* every failure mode we found — it names the exact block that
  killed a seed. A seedless strategy is one whose recall nobody has checked, **including the tool, which is
  built to check it and is being asked not to.**
- **The invented-constraint bug.** On a vague question the model adds a concept block that is really a
  LIMIT — measured: an *"RCT design filter"* invented from a question that never mentioned trials, which
  **collapsed the yield 5,354 → 368** (93% of the search) and cost a known-included study. It is an explicit
  prompt violation (`SYSTEM_PROMPT` says *"do NOT repeat these inside a concept block"*). `hoistFilters()`
  already performs exactly this species of repair for PubMed — extend it to hoist a publication-type/design
  **block** out of the concepts and into the limits, where it is visible, labelled a limit, and toggleable.

## Ops actions that gate everything, and have no owner

None of these is code. **The feature cannot reach a librarian until all three happen.**
1. **Click the two parked CodePipeline manual approvals.** Nothing redeploys until someone does.
2. **Attach the `bedrock:InvokeModel` IAM policy** to the `reciter-pm` role. Written and committed:
   `docs/iam-reciter-pm-bedrock.json` + `.md`, including the trap (a `us.` inference profile needs
   InvokeModel on the underlying **foundation-model ARNs in every fan-out region**, not just the profile
   ARN — a policy naming only the profile passes review and fails at runtime) and the
   `aws iam simulate-principal-policy` command that proves it.
3. **Decide the pilot allowlist.** `LITERATURE_SEARCH_CWIDS` **fails shut** — unset, empty, whitespace and
   comma-only all mean NOBODY gets in. The feature is dark until someone names names. That is the intended
   safety property, and emptying it is also the rollback.

**PROD IS WORSE THAN DEV.** The prod pipeline only runs `kubectl set image`, never `kubectl apply`
(`k8-buildspec.yml:83`, `:95`), while dev does both (`:91`). So prod will **never** pick up
`BEDROCK_MODEL_ID` / `AWS_REGION` / `LITERATURE_SEARCH_CWIDS` from the manifest and will serve a permanent
503 until they are set **imperatively**. It will work in dev and 503 in prod, and everyone will go read the
code. **Don't. Read `docs/RUNBOOK-prod-literature-search.md`.** The good news is the corollary: because prod
only ever sets the image, imperative env vars survive every future deploy. You set them once.

## CLOSED — do not re-open, and do NOT pay to re-derive

- **"What is the AI screen's false-negative rate?"** → **99% / 100%.** The classifier was never the problem.
- **"Verdict completeness — chunk it, or use a better model?"** → **NEITHER, and it is FIXED.** The model
  dropped a **contiguous window out of the middle** of the list (positions 25–31 of 50 — lost-in-the-middle,
  NOT `max_tokens` truncation), and the rate is unmanageable anyway: **7 records one run, 1 the next.** We
  are already on the most capable model; chunking never reaches zero and screens each batch blind to the
  others. Completeness is *checkable*, so it is **repaired**: `screenRecords()` re-asks for exactly the
  skipped records. **Measured after: 50 of 50 in every batch.**
- **"Then screen a DEEPER SLICE to beat the cap?"** → **NO. The rank arithmetic refuses it.** Even with
  perfect completeness, a cap of **200 shows the model 18%** of the eligible studies and **500 shows 74%** —
  and 500 records is ~400k input tokens, past the model's context, so it is a chunked design anyway.
  **Completeness was never the binding constraint; recall arithmetic is. DO NOT RUN THIS EXPERIMENT.**
- **"Does a vague question break the strategy?"** → **NO. 99%** on a bare keyword string with no criteria.
  **Mode 1 does not need to interrogate the user before it searches — do not build that.**
- **PubMed #164 and #165 are MERGED** (into `dev`, 2026-07-14). #165 was stacked on #164's branch and would
  have merged into a stale feature branch — it was retargeted to `dev` first. No deploy was triggered; both
  pipelines are parked at their manual approval, as expected.

## Still genuinely unmeasured

- **Modes 2 and 3.** Relevance-truncated too, but they answer a *clinical question* rather than assemble a
  review, so "the top 50 by relevance" may be exactly right for them. **Do not generalise the Mode 1 finding
  onto them without running it** — and note the yardstick has to be different, because a clinical question
  has no "included studies" list to score against.
- **Precision.** The studies measured **recall only**. The distractor side is noisy by construction (some
  "distractors" are a review's own protocol, or a full-text exclusion no abstract screen could make), so no
  precision number is claimed anywhere. Don't invent one from these artifacts.
- **N is 3, and all three are Cochrane.** A smoke alarm, not a thermometer. It cannot rank models or justify
  tuning, and nobody should treat it as a benchmark to optimise against.

## Do NOT re-litigate

- **No query-translation layer, ever.** `Concept = {label}` is DB-neutral; `Rendering = {db, lines, limits}`
  is DB-native and independently **generated**. There is no MeSH→Emtree map and there must never be one.
- **A dialect is PLATFORM + DATABASE.** WCM's Embase is on **Ovid**, not Embase.com. `exp probiotic agent/`,
  not `'probiotic agent'/exp` — Ovid rejects the latter outright.
- **The Elsevier creds stay in the TOOL.** RPM holds no `SCOPUS_API_KEY`.
- **`count=0` is not "no records" in Scopus** (it silently returns 25; a cheap count is `count=1`).
  **`view=COMPLETE` caps a page at 25.**
- **No dollar figure. No SSE. No PHI detector, ever.**
- **The server ranks; the model never does.** **iCite never sorts, never filters, never reaches the model.**
- **DO NOT parallelise RPM's count calls.** The tool owns the rate policy, and NCBI's keyed quota is
  **shared with the ReCiter engine** — waste here lands on the nightly ETL.
- **Counts are NEVER summed across databases. EMBASE EMBEDS MEDLINE** — the overlap is enormous.
- **The `screened: false` fail-open marker is LOAD-BEARING and fires routinely** (measured ~14% of a page on
  one run). Never "simplify" it away. It is the only thing separating "the model read this and kept it" from
  "no model ever looked at this."
- **The live `check:literature` can never be a merge gate.** It is an integration check on purpose (a mocked
  PubMed would pass while the feature was broken) and it is **flaky against live NCBI — 2 red in 6 runs on
  unchanged logic.** That is what `check:literature:pure` exists for.

## Permanently out of scope

Dual independent screening, full-text screening, PRISMA flow diagrams, risk-of-bias, GRADE, meta-analysis.
Covidence and Rayyan do these and the SR team trusts them. **We hand off; we do not compete.**

## Running it locally

```bash
# PubMed tool — MUST be the sort/retmax build (#164, now merged). Temurin 17 is the only JDK.
cd ~/worktrees/pubmed-sort-retmax && java -jar target/reciter-pubmed-retrieval-tool-1.1.0.jar --server.port=8083

# Scopus tool — dev, post-#35.
cd ~/worktrees/scopus-dev && java -jar target/reciter-scopus-retrieval-tool-3.0.0.jar --server.port=8082

cd ~/worktrees/pm-literature-ui && PORT=3000 npm run dev
# login paa2013 -> sidebar -> Literature Search.  /curate errors on landing; ignore it.
```

`.env.local`: `RECITER_PUBMED_API_URL=http://localhost:8083`, `RECITER_SCOPUS_API_URL=http://localhost:8082`,
`AWS_REGION=us-east-1`, `BEDROCK_MODEL_ID=us.anthropic.claude-opus-4-8`, `LITERATURE_SEARCH_CWIDS=paa2013`.

**Verify #4 in two minutes:** point `RECITER_SCOPUS_API_URL` at a dead port (`http://localhost:9999`), tick
Scopus, build. You should get a full PubMed panel **plus** an explicit Scopus failure panel that says *"this
is not a result of zero"*, **plus** a cost line in the log carrying `"failed":"scopus"`. That is exactly what
dev will do until the Scopus approval is clicked. **This was driven in a browser and it works.**

### The three studies (they cost real money — run deliberately)

```bash
node controllers/literatureSearch.recall.js     # ~$0.80  strategy + cap + screen, end to end
node controllers/literatureSearch.screen.js     # ~$1.50  the screen in isolation (needs .litrecall-run.json)
node controllers/literatureSearch.question.js   # ~$0.50  does a vague question break the strategy?
```
**Deliberately NOT part of `check:literature`** — a check that costs a dollar to run is a check nobody runs.

**Before believing any striking number from these, verify the instrument.** A PubMed tool without #164
silently ignores `sort=` and returns an unranked slice, which fakes the exact 0% the recall study found.
Prove it: `sort=relevance` and `sort=date` must return **different** PMIDs.

## Housekeeping left behind

- A dev server may still be running on **:3000** with `RECITER_SCOPUS_API_URL` pointed at the dead port 9999.
- Two renamed stale build dirs — `.next.stale-1784039331/`, `.next.stale-gate-1784041481/` — from gate agents
  working around a `PageNotFoundError` caused by a stale `.next`. They were **renamed, never deleted**. Safe
  to remove; I don't run `rm`.
- `.litproof/`, `.litproof2/` are older untracked compile dirs from previous sessions.
