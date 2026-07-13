# Handoff — Literature Search, next session

**Supersedes the previous `HANDOFF-literature-next-session.md`.** Its three asks are done or
honestly scoped: **(1) Word is real `.docx`**, **(2) every document names the model**, and
**(3) Scopus — the blocking half is BUILT, PR'd and verified; the RPM half is a real feature, not a
config flip, and it needs one decision from a librarian before anyone writes code.**

## Done this session

| | State |
|---|---|
| **Real `.docx`** | Shipped. RTF **deleted**. `controllers/literatureDocx.ts` is a second renderer over the same `Block[]`, dynamically imported inside the click like exceljs. Driven in a browser: a 6,903-hit strategy downloaded as a valid *Microsoft Word 2007+* file, real headings, real tables. |
| **Model disclosure** | Shipped, on all three surfaces — the synthesis caveat, the strategy panel footer, and **the strategy export's repro header** (the one people forget: Mode 1's *query* is model-drafted too). Both halves travel: `Claude Opus 4.8, via AWS Bedrock` **and** `us.anthropic.claude-opus-4-8`. |
| **Strategy rows** | Fixed. They bled together — a free-text line wraps to four visual lines, so line 2 ran into line 4. Now a hairline per row, like PubMed's own search history, and the checkbox anchors to the first line of its bundle. |
| **Scopus tool** | **[ScopusTool PR #35](https://github.com/wcmc-its/ReCiter-Scopus-Retrieval-Tool/pull/35)** — `POST /scopus/search/query`, query passed **verbatim**. 39 tests / 0 failures. Verified against live Elsevier. **Not merged.** |
| **RPM → Scopus wiring** | `config/local.js` `reciterScopus.searchQueryEndpoint`. Transport only. The checkbox stays `ready: false`. |

`npm run check:literature` is **green and still needs NO LLM**. Keep it that way. It now asserts over
the **Blocks** rather than rendered bytes — a `.docx` is a zip, and grepping a zip for a PubMed query
proves nothing — so the reproducibility invariant (query, count, date, who, **which model**) is
pinned on the *strategy* export as well as the synthesis. The renderer keeps a smoke test: Packer
really zips it, and a `.docx` must open with `PK`.

**PR #824** (`feature/pm-literature-mode2` → `dev`) now carries all of the above. Still **DO NOT
MERGE** — dev is wanted for another feature set first.

## Scopus: what is actually left, and the one question that blocks it

**The hard, cross-repo half is done.** `/scopus/search/documents` could never have run a strategy:
it force-wraps every term in `TITLE-ABS-KEY(...)`, so a top-level limit is inexpressible — nest
`PUBYEAR > 2020` inside the wrap and Elsevier answers `HTTP 400 "Error translating query"`. PR #35
adds the endpoint that doesn't wrap. Measured through it, against live Elsevier:

```
count=1                                   -> total 2,900,  1 record   (the cheap count)
  AND PUBYEAR > 2020   (top-level limit)  -> total 1,958
  AND DOCTYPE(ar)      (top-level limit)  -> total   942
view=COMPLETE count=25 start=0 / start=25 -> 25 + 25 records, WITH abstracts + full author lists
count=50 & view=COMPLETE / count=0 / ""   -> 400, 400, 400
```

**A trap the earlier handoff did not have: `view=COMPLETE` caps a page at 25.** `count=50` is an
`HTTP 400 INVALID_INPUT`, **not a short page**. So RPM's 50-record modes are **two paged calls**
(`start=0`, `start=25`), not one. The endpoint **rejects rather than clamps**, deliberately: a caller
who asked for 50, got 25, and was not told would print "top 50" over half a page — which is the exact
bug class this feature exists to prevent. (Same reason `count=0` is refused: Elsevier *ignores* it
and silently returns 25 records.)

### The RPM half is NOT `ready: false → true`

The old handoff said "a Scopus count/retrieve pair in `config/local.js`, and `ready: false → true`."
**That undersells it, and flipping the flag would ship a broken checkbox.** Everything below PubMed
in RPM is PubMed-shaped:

1. **`Strategy.db: 'pubmed'`** is a literal type, and the concept's intellectual content (`label`)
   is welded to its **PubMed rendering** (`lines`). This is the type split the old handoff called the
   genuinely hard part, and it is still unbuilt:
   ```
   Concept   = { label }              // DB-NEUTRAL. The only thing crossing a database boundary.
   Rendering = { db, lines, limits }  // DB-NATIVE. Independently GENERATED, never translated.
   ```
2. **`buildStrategy`'s prompt is PubMed** — it emits `[MeSH]` and `[tiab]`. Scopus needs its own
   prompt writing native Scopus. **Never a translation layer.** One strategy per database, sharing
   only the concept *labels*. Someone will look at that map and call it a translation layer. It is
   not. **Hold the line.**
3. **`countPubmed()`** needs a Scopus sibling. Trivial — `opensearch:totalResults`, and PR #35 hands
   it over.
4. **`SeedResult.pmid` — THE BLOCKER, and it is a librarian's call, not an engineer's.** The
   known-item seed check is the real quality gate on a generated strategy, and it is **PMID-keyed**.
   Scopus records are keyed by Scopus ID and DOI. **So: do Scopus seeds become DOI-keyed, does the
   Scopus strategy go unvalidated, or does Mode 1 validate the PubMed strategy only and say so?**
   Ask the SR librarians. Do not guess — an unvalidated strategy that *looks* validated is worse
   than no Scopus at all.

**Be honest with them about what Scopus IS.** It has **no controlled vocabulary** — no MeSH analogue,
nothing to explode. A PubMed concept block is `(exploded MeSH) OR (free-text)`; in Scopus the
controlled-vocab arm **has no equivalent**, so the same concept is faithfully expressed and
*systematically less sensitive*. For a systematic review, where recall is the cardinal virtue, that
is **a methodological cost no engineering can remove**. Scopus is a **supplementary** database here,
not a PubMed-equivalent one.

### Before Scopus reaches prod

**ScopusTool prod builds from `master`, and `master` has neither `ScopusSearchController` nor
`ScopusSearchService`** — it is Spring Boot 2.4.5 / Java 11 / v1.1.0, and `dev` is **61 commits ahead
and 5 behind**. Shipping any of this to prod is a **Boot 3 + Java 17 migration**, not a one-endpoint
merge. Nothing needs that yet (Literature Search is a dev-only pilot) — but plan it rather than
discover it.

## Embase — PARKED. Do not schedule it.

Elsevier explicitly excludes the Embase API from free academic access; an Embase.com web subscription
does **not** convey API access. **Nothing in this repo moves that.** Leave the checkbox disabled and
the "not searched" card honest — a Cochrane-compliant search *does* need Embase and CENTRAL, and the
card should keep saying so.

If it is ever revived, two questions go to the Elsevier Account Manager **before** any engineering:
(1) can our key be granted Embase entitlement, at what cost; (2) **does the Embase search response
return a total hit count without paging?** — undocumented, and Mode 1 is count-only by design.

**A trap worth its own line: EMBASE EMBEDS MEDLINE.** Records carry both `<dbcollection>` values.
Embase and PubMed counts overlap massively and **must NEVER be summed.** The UI renders counts
per-database rather than as a total, which is right — but nobody downstream may add them up.

## Still open, carried forward

- **`PUBMED_API_KEY` should be rotated** (it was printed to a transcript on 2026-07-13) **and set on
  the pod**, or Modes 2–3 trip NCBI's unkeyed 3/s limit under real use.
- **`HANDOFF-literature-search-ui.md:192-198` contradicts the signed-off mockup** — it still shows a
  Screen-4 `Effect | 0.70` column and an invented SMD range that the mockup deliberately deleted.
  Anyone building from that ASCII ships an effect-size column. **Strike it.**
- **PubMed Clinical Queries hedges** (validated Therapy / Diagnosis / Prognosis / Etiology filters)
  are the standard librarian instrument for Mode 3 and appear in **none** of the design docs. Ask the
  SR librarians before inventing our own.
- **The Mode 2/3 synthesis `.docx` was not clicked in a browser this session** — only the strategy
  one was. The renderer is shared and the check renders synthesis blocks to a real `.docx` in node,
  so the risk is low, but it is unverified in the UI. Click it.
- **A count without records is not an empty search.** A throttled PubMed returns a well-formed zero,
  not an error. Handled today; stay suspicious of anything new.

## Running it locally

```bash
# PubMed retrieval tool — MUST be the sort/retmax build, or Modes 2-3 print "by most relevant" over
# an unranked slice. NEVER `mvn` on THIS repo (JDK 25 kills the pinned Lombok); run the jar.
java -jar ~/Dropbox/GitHub/ReCiter-PubMed-Retrieval-Tool/target/reciter-pubmed-retrieval-tool-1.1.0.jar --server.port=8083

# Scopus retrieval tool (only once RPM actually calls it) — mvn IS fine here: Scopus dev is
# Boot 3.4.3 / Java 17, and Temurin 17 is the only JDK on this machine.
cd ~/worktrees/scopus-raw-search && mvn -B clean verify   # 39 tests
java -jar target/reciter-scopus-retrieval-tool-3.0.0.jar --server.port=8082

cd ~/worktrees/pm-literature-ui && PORT=3000 npm run dev
# login paa2013 -> sidebar -> Literature Search.  /curate errors on landing; ignore it.
```

`.env.local`: `RECITER_PUBMED_API_URL=http://localhost:8083`, `AWS_REGION=us-east-1`,
`BEDROCK_MODEL_ID=us.anthropic.claude-opus-4-8`, `LITERATURE_SEARCH_CWIDS=paa2013`. Add
`RECITER_SCOPUS_API_URL=http://localhost:8082` when Scopus goes live. **No rate vars — the app no
longer prices anything.**

## Do NOT re-litigate

- **The Elsevier creds stay in the TOOL.** PR #797 moved them out of RPM on purpose. RPM holds no
  `SCOPUS_API_KEY` and never calls `api.elsevier.com` — everything goes through
  `RECITER_SCOPUS_API_URL`, exactly as PubMed goes through `RECITER_PUBMED_API_URL`. Verified still
  true this session.
- **There is no query-translation layer, ever.** The model writes a native query per database from
  the original question. Cochrane/PRESS expect a bespoke, separately peer-reviewed strategy per
  database; a mechanical MeSH→Scopus transliteration is exactly the artifact a librarian **rejects**.
- **The app logs NO dollar figure, and shows none.** A token count is durable; a rate is volatile and
  owned by AWS. This route logged 5/25 per Mtok for months when the real `us.`-profile rate is
  **5.50/27.50** — every figure was 10% light, recoverable ONLY because `model` and the token counts
  sat beside it. Totals come from Cost Explorer. A running meter teaches a librarian to ration
  iteration, which is the behaviour we want.
- **The server ranks; the model never does.** Mode 3's hierarchy is derived from PubMed's
  `publicationtypelist` and sorted before the model sees a record.
- **No SSE.** Three plain POSTs; ~76s measured against a live-verified 500s ALB idle timeout.
- **No PHI detector, ever.** The obvious MRN heuristic fires on every 8-digit PMID in the seeds
  field. Mode 3's PHI surface is handled by *affordance* — four structured PICO fields.
- **The 50-cap is a property of the mode, not a setting.** It bounds the context window and the bill.
- **iCite never sorts, never filters, never reaches the model.** Popularity is not evidence.

## Permanently out of scope

Dual independent screening, full-text screening, PRISMA flow diagrams, risk-of-bias, GRADE,
meta-analysis. Covidence and Rayyan do these and the SR team trusts them. **We hand off; we do not
compete.** A ticket that starts rebuilding one of these is a signal the feature has drifted.
