# Ultracode review — PR #824 (Literature Search)

Ten independent finders swept the diff; every finding then faced three adversarial verifiers
(correctness / reachability / already-handled) with a majority-refutes kill rule, plus a completeness
critic. 39 findings raised, **31 survived**, 11 refuted. 137 agents, 0 errors.

`npm run check:literature` is green — confirmed by running it, not by trusting the handoff.

## STATUS — what has been fixed, and what is still open

**Fixed and committed** (6 commits, `5a4ad6b`..`362e378`; check green, `tsc` clean after each):

| Commit | What |
|---|---|
| `5a4ad6b` | **P0** — drop `rowCounts` when the line numbers they are keyed to move. Plus the stale `dirty` set on a limits change. |
| `d1e391d` | Quote a DOI seed, so a PII-style DOI is not read as Boolean grouping. |
| `4ed56d1` | Stop printing the query yield under the word "retrieved". |
| `880397e` | An invented citation reaches the reader; dropped table rows are backfilled; a ranking the tool never applied is refused (502) instead of asserted. |
| `115c7ca` | Bound the seed list (`MAX_SEEDS = 10`); recompute the expert panel a toggle invalidated. |
| `362e378` | A retracted trial sorts below everything; a protocol is not a trial; Word gets real paragraphs. |

**Still open** — everything in the *Correctness / UX* section below except the `.docx`, `modelLabel`
and export-label items, which are done. Specifically still to do:

- [ ] `LiteratureSearch.tsx:606/637/647` — `newSearch()` cannot cancel an in-flight re-count; the
      stale response writes back into the cleared `results` and the form vanishes; `recounting` can
      wedge true and disable every export until a reload. **Fix: `seq.current++` and
      `setRecounting(false)` inside `newSearch()`.**
- [ ] `LiteratureSearch.tsx:811` — "Copy Markdown" is a fourth, undeclared document builder with no
      query, database, yield or search date.
- [ ] `LiteratureSearch.tsx:869` — the Scopus query downloads as `pubmed-query-<date>.txt`; both
      databases' Word appendices collide on one filename.
- [ ] `search.ts:509` — a Scopus tool failure 502s the whole Mode 1 build, discarding the
      already-paid-for PubMed strategy, and skips `logCost`.
- [ ] `controller.ts:820` — `invoke()` discards Bedrock's `stop_reason`, so a `max_tokens` truncation
      is parsed as a complete answer. (Chains into the next one.)
- [ ] `LiteratureSearch.tsx:1843` — a record the model never screened renders as an ordinary AI
      *include*: pre-ticked, counted in the tally, fed to the synthesis with no marker.
- [ ] `controller.ts:1101` — the model's own strategy output is never bounds-checked, though the same
      object posted back from the browser is; a build the server accepts can be one it then refuses
      to re-count.
- [ ] `literatureExport.ts:52` — `modelLabel()` mangles any Bedrock id with a `-vN:M` or dated suffix.
- [ ] `LiteratureSearch.tsx:185` — the browser shadows the shared `parseSeeds` with a stricter
      PMID-only rule.
- [ ] `LiteratureSearch.tsx:643` — Mode 2/3 narrowing ticks fire a per-line count sweep for a column
      those modes never render.
- [ ] `check.js:726` — `strategyDoc`'s Records column is never given a `rowCounts` map.

Deploy prerequisites (out of this PR's surface, but they gate the feature — see the handoff's P0):
`BEDROCK_MODEL_ID`, `AWS_REGION`, `LITERATURE_SEARCH_CWIDS` on the pod; `bedrock:InvokeModel` on the
`reciter-pm` IRSA role; PubMedTool #164 deployed **before** RPM.

## The verdict

**The cardinal sin is live on screen, and it is not where the handoff thought it was.**

The handoff's suspicion #1 pointed at the `rowSeq` guard: "the newest, least-exercised code in the
diff." **That guard is fine — a finder attacked it and all three verifiers refuted the attack.** The
bug is one layer up, in code nobody flagged as risky:

> `rowCounts` is a map **keyed by PRESS line number**. The line numbers **renumber on every toggle**.
> Nothing clears the map when they do.

Five of the ten finders converged on this independently, from five different dimensions. Zero
verifiers refuted it. It is the single most dangerous defect in the PR.

## P0 — a count sitting beside a line it does not belong to

`LiteratureSearch.tsx:1282` renders rows from `numberStrategy(live)` — the **just-toggled** strategy.
`LiteratureSearch.tsx:1331/1353` looks those new numbers up in `result.rowCounts` — the map the server
keyed to the **previous** strategy. `editConcept` (line 700) writes `strategies` and never touches
`results`.

It is worse than an off-by-one, because `numberStrategy` (strategy.ts:271) **drops a concept's
OR-combine row** when the concept falls to one live line. Unticking one line of a two-line concept
shifts every subsequent number by **two**.

Worked example, from the check's own fixture (probiotics/depression, verified by running
`numberStrategy` over both selections):

| Line on screen after the untick | Count rendered beside it | Whose count that actually is |
|---|---|---|
| `"Depression"[MeSH]` | 9,001 | `probiotic*[tiab]` — the line just switched **off** |
| `depress*[tiab]` | 44,000 | the old `1 OR 2` combine row |
| **the final row — the whole search** | a term line's count | **not the yield** |

The app's own stated invariant — *the number beside the final line and the number at the top of the
panel cannot disagree* — is broken **on screen**.

Three things make this a librarian-facing fabrication rather than a flicker:

1. `setRecounting(true)` is **inside** the 300ms debounce, so the wrong numbers render at **full
   opacity** first.
2. `.hitsStale` is `opacity: .45` — it **dims** the wrong number, it does not withhold it.
3. **If the re-count POST fails**, the catch at line 644 never touches `results` and `finally` clears
   `recounting` — so the fully mis-assigned column stays on screen at **full opacity, indefinitely**,
   under an error banner that only mentions the total.

**Fix (one line, in `editConcept` at 700, alongside `dirty.current.add(di)`):**

```ts
setResults(rs => rs.map((r, i) => (i === di ? { ...r, rowCounts: {} } : r)))
```

`RowCount` already renders a missing count as an **em-dash** — the app's own correct "not counted yet"
state. Do the same for `dateId`/`typeId` (a limits change rewrites the final row's text under an
unchanged number). A count that no longer belongs to the line beside it is not a stale count; it is a
wrong one.

**The check cannot catch this** (it cannot render React), but one pure assertion pins the invariant:
unticking a line **re-keys** the rows, so the old map must not be readable at the new numbers.

## The rest of the wrong-number class

| # | Where | The defect |
|---|---|---|
| 2 | `strategy.ts:139` | **A DOI seed with parentheses reads as NOT RETRIEVED by a strategy that does retrieve it.** `seedQuery` renders a DOI unquoted, and the seed ref is always concatenated (`${ref} AND (${query})`), so the literal parens in every Elsevier/Lancet PII-style DOI (`10.1016/S0140-6736(20)30183-5`) collide with PubMed's Boolean grouping. **Probed live against eutils:** the unquoted form returns **0**, the quoted form returns **1**. The miss is then blamed on every concept block and the limits — sending a librarian to fix a search that was never broken. Fix: quote it — `"${s.id}"[aid]`. Same treatment for the Scopus `DOI(...)` rendering. |
| 3 | `literatureExport.ts:84` | **Modes 2/3 label the query YIELD as "Records retrieved"** when only 50 were ever retrieved. One document says `Records retrieved \| 1391` in the methods table and *"18 of 50 retrieved records were selected"* eight lines below. A co-author building a PRISMA flow writes "Records screened: 1,391" — **27× the truth**. The top-50 slice is declared on screen and in **no export**. |
| 4 | `controller.ts:412` | **The "top 50 by most relevant" claim is asserted, never verified.** `sort`/`retmax` go to the PubMed tool with no echo or capability check; against an older jar Jackson drops them silently, and the export still stamps `Ranking \| most relevant` over an unranked slice. The response carries a **free capability signal that is thrown away**: if the tool ignored `retmax` it returns *more* than `cap`. Detect it and suppress the ranking claim. (This is the handoff's own "deploy the tool first" risk — but it is a *silent* failure, so it deserves a defence in RPM too, not just an ordering rule.) |
| 5 | `search.ts:351` | **The "At Weill Cornell" expert panel is never recomputed after a toggle.** The re-count path returns `{databases}` only; `setExperts` is called in exactly three places, none of which a toggle reaches. Edit the Depression block and the panel still shows the same bold **430 faculty** — a count over MeSH terms that are no longer on screen. The code comment says *"(none of them changed)"*; `meshFromConcepts` reads `line.terms` out of the concept blocks, so that is **false**. |
| 6 | `LiteratureSearch.tsx:609` | A stale `dirty` set survives a cancelled debounce: change the date limit, then click a checkbox within 300ms, and **only one database re-counts**. The other panel prints the new limit line under a headline count that answers the **broader** query. |

## Security / cost

| Where | The defect |
|---|---|
| `search.ts:243` | **`seeds` is completely unbounded, and each missed seed costs one Bedrock Opus call.** Paste a 60-PMID "known includes" list (no `maxLength`, no cap anywhere) and one POST fans out **~300 sequential PubMed counts (~150s)** plus **one Opus invocation per miss** — 40 misses = 40 paid Opus calls in a single request. The controller is written for "the 3–5 seeds" (its own comment). Cap it at ~10 in the route and 400 on overflow. |

## Trusting the model

| Where | The defect |
|---|---|
| `controller.ts:1588` | **`synthesize()` detects PMIDs the model invented — and only `console.error`s them.** The fabricated citation is still returned, rendered as a **clickable PubMed link**, and exported to `.docx`. The detection exists; it just never reaches the wire. |
| `controller.ts:1573` | The model may **drop selected papers from the evidence table**; the export then prints a selection count that contradicts the table beneath it. Backfill the dropped rows rather than dropping them. |
| `controller.ts:820` | `invoke()` **discards Bedrock's `stop_reason`**, so a `max_tokens` truncation of a tool_use block is parsed and returned as a **complete answer**. |
| `LiteratureSearch.tsx:1843` | **A record the model never screened is rendered as an ordinary AI-included record.** `screenRecords` fails a missing verdict open with `include: true` + reason *"Not screened — read it yourself"* — but the row only renders a reason on **excludes**. So unscreened rows arrive **pre-ticked**, inflate the "N included" tally, and go into the synthesis with **no marker at all**. (Chains directly off the `stop_reason` defect above.) |
| `controller.ts:1101` | The **model's own** strategy output is never bounds-checked, while the same object posted back from the browser is — so a build the server accepts can be one it then **refuses to re-count** (502 on every subsequent toggle). |

## Evidence hierarchy (Mode 3)

| Where | The defect |
|---|---|
| `controller.ts:620` | **`tierOf` ignores "Retracted Publication".** A retracted trial is tiered as an RCT, **sorted to the top** of the evidence order, and **led with** in the exported clinical answer. Test for retraction before the tier scan. |
| `controller.ts:609` | **"Clinical Trial Protocol" matches the rank-4 tier via `startsWith`.** A protocol — which reports **no results at all** — can set Mode 3's evidence floor. |

## Correctness / UX

- `LiteratureSearch.tsx:606/637/647` — the re-count `seq` is bumped **after** the effect's early
  returns, so `newSearch()` cannot cancel an in-flight re-count. The stale response writes back into
  the cleared `results`, **the form the librarian just asked for disappears**, and `recounting` can
  wedge permanently true — **disabling every export on the page** until a reload. Fix: `seq.current++`
  and `setRecounting(false)` inside `newSearch()`.
- `LiteratureSearch.tsx:811` — **"Copy Markdown" is a fourth, undeclared document builder** that ships
  the synthesis with no query, no database, no yield and no search date: the exact facts
  `literatureExport.ts` exists to guarantee.
- `LiteratureSearch.tsx:869` — every downloaded query file is named `pubmed-query-<date>.txt`,
  **including the one containing the Scopus query**; both databases' Word appendices collide on one
  filename.
- `search.ts:509` — in Mode 1 a Scopus tool failure **502s the whole build**, throwing away the
  already-paid-for PubMed strategy, and skips `logCost` so the spend is unlogged.
- `literatureDocx.ts:56` — every `.docx` **collapses the 3–5 paragraph synthesis into one Word
  paragraph** (raw `\n` inside one `<w:t>`; OOXML needs `<w:br/>`). Verified against the pinned
  `docx@9.7.1` by unzipping `word/document.xml`. This is the deliverable that goes to a co-author.
- `literatureExport.ts:52` — `modelLabel()` mangles any real Bedrock id carrying a `-vN:M` or dated
  suffix: `us.anthropic.claude-opus-4-5-20251101-v1:0` → **"Claude Opus 4.5.20251101."**. An invented
  version string in the AI declaration of every export.
- `LiteratureSearch.tsx:185` — the browser **shadows** the shared `parseSeeds` with a stricter
  PMID-only rule, so the on-screen seed count disagrees with what the server validates. Delete it and
  import the shared one — that is the entire reason the module exists.
- `LiteratureSearch.tsx:643` — every narrowing tick in Mode 2/3 fires a full per-line count sweep
  (~11–13 extra esearch calls) **for a column those modes never render**, burning the shared NCBI
  budget the throttled-zero defence depends on.
- `check.js:726` — `strategyDoc`'s **Records column is never given a `rowCounts` map**, so the only
  branch the check ever exercises is the empty one.

## Raised and refuted — do not resurrect without new evidence

- **The `rowSeq` guard is correct.** It is incremented only inside `fetchRows` and correctly drops a
  stale rows response. (The P0 above is a *different* mechanism: an already-rendered map being re-keyed
  underneath, which no response-ordering guard can see.)
- **`countPubmed` / `countScopus` do not have a coercion hole in practice.** Verifiers read the Java
  handlers upstream: no realistic producer can deliver the empty-body / empty-`totalResults` shapes the
  finders posited.
- **The `MAX_LINES`-per-concept and `db:'scopus'`-in-Mode-2 attacks are not reachable.**
- **The k8s / IRSA findings are true but out of surface.** The PR touches **zero** deploy files, and
  the handoff's own P0 states them verbatim. They remain deploy prerequisites, not review findings.

## What this review could not see

Runtime behaviour under real Bedrock; whether the model's Scopus strategy survives a librarian's PRESS
review; in-cluster deploy behaviour. The `.docx` paragraph-collapse finding **was** verified
empirically (against the pinned library), and the DOI-parens finding **was** probed live against
eutils.
