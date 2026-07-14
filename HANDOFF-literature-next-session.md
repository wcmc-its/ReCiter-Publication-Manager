# Handoff — Literature Search, next session

**Supersedes the previous version of this file.** Its three asks are done: **Word is a real `.docx`**,
**every document names the model**, and **Scopus is built, merged in the tool, and searching** — via
the Concept/Rendering split, which is also done.

## Where it stands

**[PR #824](https://github.com/wcmc-its/ReCiter-Publication-Manager/pull/824)**
(`feature/pm-literature-mode2` → `dev`). **DO NOT MERGE** — dev is wanted for another feature set
first. Everything below is on it.

| | State |
|---|---|
| Modes 1, 2, 3 | Live. Driven end to end on real Bedrock + real PubMed. |
| **Real `.docx`** | Shipped. RTF **deleted** — one renderer, not two half-maintained ones. Verified: a valid *Microsoft Word 2007+* file with real headings and tables. |
| **Model disclosure** | Shipped, all three surfaces — including the one people forget, the **strategy** export (Mode 1's *query* is model-drafted too). Carries both the pretty name and the profile id. |
| **Concept/Rendering split** | Shipped. See below. |
| **Scopus (Mode 1)** | Shipped. Native Scopus, own seed check, own export. |
| **ScopusTool [#35](https://github.com/wcmc-its/ReCiter-Scopus-Retrieval-Tool/pull/35)** | **MERGED to `dev`** (`cd99761`). `POST /scopus/search/query`, query passed verbatim. 39 tests. |
| **PubMedTool [#164](https://github.com/wcmc-its/ReCiter-PubMed-Retrieval-Tool/pull/164)** | **OPEN** → `dev`. `sort` + `retmax` on `/query-complex/`. 20 tests. **Merge + deploy before RPM.** |

`npm run check:literature` is **green and still needs NO LLM**. Keep it that way.

## THE SPLIT — read this before touching the strategy types

```
Concept   = { label }                 DB-NEUTRAL. The only thing that crosses a database boundary.
Rendering = { db, lines, limits }     DB-NATIVE. Independently GENERATED, never translated.
```

The model writes native PubMed, then **separately** writes native Scopus **from the same question**.
They share the concept **labels** and nothing else. Everything DB-native lives in **one dialect
table** (`DIALECTS` in `literatureSearch.strategy.ts`): limits, seed syntax, display name, export
provenance. A third database is a table entry, not a hunt for hardcoded `[tiab]`.

**SOMEONE WILL LOOK AT TWO RENDERINGS OF ONE CONCEPT AND CALL IT A TRANSLATION LAYER. IT IS NOT.
HOLD THE LINE.** There is no MeSH→Scopus map and there must never be one: Cochrane and PRESS expect a
bespoke, separately peer-reviewed strategy per database, and a mechanical transliteration is exactly
the artifact a librarian rejects at review.

Three rules the split made explicit, each of which fails SILENTLY if broken:

- **A limit a database cannot express is DECLARED, not dropped.** Scopus indexes a *document* type,
  not a study design — probed live, `DOCTYPE(rct)` returns **0** — so **"RCT only" has no Scopus
  equivalent**. Dropping it silently would run an unlimited Scopus search beside a limited PubMed one
  and print both counts as if they answered the same question. Faking it with free-text `randomized`
  would be a translation layer in disguise.
- **A SEED IS NOT A PMID.** A PMID only exists for a record MEDLINE indexed, so a PMID-keyed seed
  check can only ever validate the half of Scopus that PubMed already covers — while the records
  Scopus is *for* have no PMID at all (probed: a Scopus conference-paper search returns records with
  **no `pubmed-id` whatsoever**). A seed is an identifier **with a kind**, PMID *or* DOI. **Never
  re-key anything on PMID.**
- **"Not in this database" is not a strategy bug.** Otherwise a seed Scopus never indexed fails every
  block at once, reads as a catastrophically narrow query, and sends a librarian off to fix a search
  that was never broken. It is its own verdict — and a real finding: it is what a coverage gap looks
  like.

**Scopus is SEARCH-STRATEGY ONLY, and that is principled.** Modes 2 and 3 order records by an
evidence tier derived from PubMed's publication-type indexing; Scopus has no such index, so a Scopus
"clinical answer" would have no evidence hierarchy underneath it — which is the one thing Mode 3 is
for. **Counts are never summed across databases**: the overlap is large and unmeasured until records
are deduped.

## NEXT STEPS, in the order they actually block each other

### P0 — the feature has NEVER run outside localhost, and four things stand between it and dev

This is the headline and it was not obvious until this session: **`kubernetes/k8-deployment.yaml`
gives the pod `RECITER_SCOPUS_API_URL` but NO `BEDROCK_MODEL_ID`, NO `AWS_REGION`, and NO
`LITERATURE_SEARCH_CWIDS`.** On the pod, `/api/literature/search` returns **503 "not configured on
this environment"** and the sidebar link hides itself. Every "verified" claim in this repo about
Literature Search is a claim about **a laptop**.

1. **Ship the PubMed retrieval tool FIRST — the PR is now OPEN, and it needs review + merge +
   deploy.** **[PubMedTool PR #164](https://github.com/wcmc-its/ReCiter-PubMed-Retrieval-Tool/pull/164)**
   (`feature/pubmed-sort-retmax-dev` → `dev`), 20 tests, 0 failures. Rebased onto current `dev` —
   the original branch was cut from `master` and was 15 commits behind. `.*dev` in the buildspec
   deploys `reciter-pubmed-dev`, which is what RPM's `RECITER_PUBMED_API_URL` points at.

   **This deploys before RPM, or not at all.** Against an older jar `{sort, retmax}` are **silently
   ignored** (Jackson does not fail on unknown properties) and Modes 2–3 print *"top 50 by most
   relevant"* over an **unranked slice**.

   Verified live through the jar: `retmax` is honoured exactly; `sort=relevance` and `sort=date`
   return a **different first record**, which is the proof the sort reached the wire. That last one
   matters more than it looks — **NCBI silently ignores a literal `sort=date`** (the ESearch key is
   `pub_date`), so forwarding the caller's value verbatim would have reproduced the exact failure the
   parameter exists to fix. The PR maps it.

   *(The "never `mvn` here, JDK 25 kills Lombok" warning in earlier handoffs is **STALE** — Temurin 17
   is now the only JDK on this machine and `mvn -B clean verify` is green on both Java tools.)*

   **Two bugs found while verifying it, NEITHER caused by the PR — do not let them get attributed to
   it:**
   - The 2,000-record **threshold refusal surfaces as `500`, not the `502`** `GlobalExceptionHandler`
     intends: the refusal is an `IOException` thrown inside a `@Retryable`, so Spring Retry burns all
     7 attempts on a permanent condition and then wraps it, and the `IOException` handler never sees
     it. **Confirmed against an unmodified `dev` build.** Wants its own issue.
   - **`retmax` caps the EFetch; the parsed count can be LOWER.** `cancer[tiab]` with `retmax=50`
     yields **46** — the SAX parser deliberately skips `<PubmedBookArticle>` records and that batch
     had 4 book chapters. So "top 50" may legitimately deliver fewer, and RPM must not treat a short
     list as an error.

2. **Give the pod the three env vars** (`BEDROCK_MODEL_ID`, `AWS_REGION`, `LITERATURE_SEARCH_CWIDS`)
   in `k8-deployment.yaml` + `k8-secrets.yaml`.

3. **Give `reciter-pm` permission to call Bedrock.** The service account already exists and is
   IRSA-bound to an IAM role (for the DynamoDB provenance read, PM #737) — so there is a role to
   attach to, but **`bedrock:InvokeModel` on the Opus inference profile is almost certainly not on
   it**. Unverified in-cluster. **This is the single most likely thing to blow up on first deploy**,
   and it will look like a 502 from a route that works perfectly on a laptop.

4. **Confirm `reciter-scopus-dev` actually has #35.** It is merged to the tool's `dev`, but I did
   **not** verify that the merge triggers the branch-gated CodeBuild. `RECITER_SCOPUS_API_URL` on the
   pod must point at a jar that has `POST /scopus/search/query` — against an older one it **404s**.

Also carried, and it bites under real use: **`PUBMED_API_KEY` should be rotated** (it was printed to
a transcript on 2026-07-13) **and set on the retrieval tool** — unkeyed NCBI allows 3 req/s, and a
two-database Mode 1 build fires a burst of counts. A throttled esearch returns a **well-formed zero**,
not an error.

### P1 — the validation that actually matters, and it is not code

5. **Put the two-database strategy in front of the SR librarians.** This is now the real test, and
   the split is what makes it possible: two native strategies, same concept labels, side by side. Ask
   them the questions the code cannot answer:
   - Is the Scopus rendering of each concept *good enough to peer-review*, given there is no
     controlled vocabulary to lean on?
   - Is "supplementary, not equivalent" the right framing on the panel, or too soft?
   - **PubMed Clinical Queries hedges** (validated Therapy / Diagnosis / Prognosis / Etiology
     filters) are the standard librarian instrument for Mode 3 and appear in **none** of the design
     docs. **Ask before inventing our own.**

### P2 — known, small, and honestly stated

6. **A DOI seed gets no label and no suggested widening.** `seedRecords` fetches PubMed records for
   PMID seeds only — matching a returned record back to the DOI that asked for it means digging
   through PubMed's articleid list, and all it buys is a prettier label. The *diagnosis* is
   unaffected, which is the part that matters. Fix when a librarian actually seeds by DOI and misses
   the label.
7. **The Mode 2/3 synthesis `.docx` was never clicked in a browser** — only the strategy one was. The
   renderer is shared and the check renders synthesis blocks to a real `.docx` in node, so the risk is
   low, but it is unverified in the UI. Click it.
8. **`HANDOFF-literature-search-ui.md:192-198` contradicts the signed-off mockup** — it still shows a
   Screen-4 `Effect | 0.70` column and an invented SMD range the mockup deliberately deleted. Anyone
   building from that ASCII ships an effect-size column. **Strike it.**

### Deliberately NOT next

- **Scopus records in Modes 2/3.** No publication-type index → no evidence tier → no Mode 3.
- **Cross-database dedup / "N unique records".** Not needed while counts are shown per-database and
  never summed. The moment anyone wants a union count, dedup on DOI (+ `eid`, + PMID where present)
  becomes **mandatory** — the overlap is large.
- **Embase.** Elsevier excludes the Embase API from academic access, and an Embase.com subscription
  does **not** convey API access. **Nothing in this repo moves that.** If revived, two questions go to
  the Account Manager BEFORE any engineering: (1) can our key be entitled, at what cost; (2) **does
  the Embase search response return a total hit count without paging?** — undocumented, and Mode 1 is
  count-only by design. **A trap worth its own line: EMBASE EMBEDS MEDLINE.** Its counts overlap
  PubMed's massively and must NEVER be summed.

### Before Scopus reaches PROD

**ScopusTool prod builds from `master`, and `master` has neither `ScopusSearchController` nor
`ScopusSearchService`** — it is Spring Boot 2.4.5 / Java 11 / v1.1.0, and `dev` is **61 commits ahead
and 5 behind**. Getting this to prod is a **Boot 3 + Java 17 migration**, not a one-endpoint merge.
Nothing needs it yet (Literature Search is a dev-only pilot). **Plan it rather than discover it.**

## Running it locally

```bash
# PubMed tool — MUST be the sort/retmax build (PR #164), or Modes 2-3 print "by most relevant"
# over an unranked slice. `mvn` IS fine here now (Temurin 17 is the only JDK).
cd ~/worktrees/pubmed-sort-retmax && java -jar target/reciter-pubmed-retrieval-tool-1.1.0.jar --server.port=8083

# Scopus tool — dev, post-#35. mvn IS fine here (Boot 3.4.3 / Java 17).
cd ~/worktrees/scopus-dev && java -jar target/reciter-scopus-retrieval-tool-3.0.0.jar --server.port=8082

cd ~/worktrees/pm-literature-ui && PORT=3000 npm run dev
# login paa2013 -> sidebar -> Literature Search.  /curate errors on landing; ignore it.
```

`.env.local`: `RECITER_PUBMED_API_URL=http://localhost:8083`,
`RECITER_SCOPUS_API_URL=http://localhost:8082`, `AWS_REGION=us-east-1`,
`BEDROCK_MODEL_ID=us.anthropic.claude-opus-4-8`, `LITERATURE_SEARCH_CWIDS=paa2013`. **No rate vars —
the app no longer prices anything.**

## Do NOT re-litigate

- **The Elsevier creds stay in the TOOL.** PR #797 moved them out of RPM on purpose. RPM holds no
  `SCOPUS_API_KEY` and never calls `api.elsevier.com` — verified again this session.
- **There is no query-translation layer, ever.** See THE SPLIT above.
- **`count=0` is not "no records" in Scopus** — Elsevier IGNORES it and silently returns 25. A cheap
  count is `count=1` + `opensearch:totalResults`.
- **`view=COMPLETE` caps a Scopus page at 25.** `count=50` is an `HTTP 400`, not a short page. The
  tool **rejects rather than clamps**: a caller who asked for 50, got 25, and was not told would print
  "top 50" over half a page.
- **The app logs and shows NO dollar figure.** A token count is durable; a rate is volatile and owned
  by AWS. This route logged 5/25 per Mtok for months when the real `us.`-profile rate is **5.50/27.50**
  — every figure was 10% light, recoverable ONLY because `model` and the tokens sat beside it. A
  running meter teaches a librarian to ration iteration, which is the behaviour we want.
- **The server ranks; the model never does.** Mode 3's hierarchy is derived from PubMed's
  `publicationtypelist` and sorted before the model sees a record.
- **No SSE.** Three plain POSTs; ~76s measured against a live-verified 500s ALB idle timeout.
- **No PHI detector, ever.** The obvious MRN heuristic fires on every 8-digit PMID in the seeds field.
  Mode 3's PHI surface is handled by *affordance* — four structured PICO fields.
- **The 50-cap is a property of the mode, not a setting.** It bounds the context window and the bill.
- **iCite never sorts, never filters, never reaches the model.** Popularity is not evidence.

## Permanently out of scope

Dual independent screening, full-text screening, PRISMA flow diagrams, risk-of-bias, GRADE,
meta-analysis. Covidence and Rayyan do these and the SR team trusts them. **We hand off; we do not
compete.** A ticket that starts rebuilding one of these is a signal the feature has drifted.
