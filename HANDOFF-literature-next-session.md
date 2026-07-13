# Handoff — Literature Search, next session

**Supersedes `HANDOFF-literature-next.md`.** That one is DONE: its three open items (the Bedrock
rate, the nav gate, the duplicated constants) are all closed.

## Where it stands

**All three modes are built, driven end to end in a browser on real Bedrock and real PubMed, and
open as [PR #824](https://github.com/wcmc-its/ReCiter-Publication-Manager/pull/824)** —
`feature/pm-literature-mode2` → `dev`, 22 commits, **DO NOT MERGE** (dev is wanted for another
feature set first). GitHub reports it MERGEABLE / CLEAN.

| Mode | What it is | State |
|---|---|---|
| 1. Search strategy | PRESS-numbered, toggleable, counts only. Re-count costs **zero inference**. | live |
| 2. Issue review | Retrieve → screen → synthesize, 50-cap. | live |
| 3. Clinical question | PICO in, a cited answer out, **ranked by derived evidence tier**. | live |

**`npm run check:literature` is green and needs NO LLM.** Keep it that way. It covers the tier order
(with the SR-below-RCT inversion pinned), the stable sort, the evidence floor, PICO assembly, the
guideline tier against a **real** PubMed record, and every export invariant. It can fail with a
transient `HTTP 502` or an empty fetch from NCBI — **re-run before debugging**; failing loudly is the
check working.

**Cross-repo, and it ships together:** RPM sends `{sort, retmax}` to `/pubmed/query-complex/`.
Against an old jar those fields are **silently ignored** and Modes 2–3 print "top 50 by most
relevant" over an unranked slice. `ReCiter-PubMed-Retrieval-Tool @ feature/pubmed-sort-retmax`
(local, unpushed — **it needs its own PR**) deploys FIRST, or not at all.

## The three asks for this session

### 1. Real Word (.docx) alongside Excel

**The document builders are already pure and format-agnostic** — `controllers/literatureExport.ts`
emits a `Block[]` (`h1` / `h2` / `p` / `small` / `mono` / `table`), and `rtf()` is just one renderer
over it. So adding `.docx` is **a second renderer, not a rewrite**: `npm i docx`, ~60 lines mapping
`Block[]` → docx paragraphs/tables, and the documents themselves do not change.

Excel is already real `.xlsx` (exceljs, already a dependency, dynamically imported inside the click
so its 600KB costs the page nothing until someone downloads). Verified with openpyxl: two sheets,
frozen bold header, autofilter, sized columns.

**Ambiguity to resolve with Paul first — one sentence, do not guess:** "include Word and Excel" could
mean **(a)** replace RTF with a true `.docx` (my reading — it followed my offer to swap), or **(b)**
offer *both* a Word and an Excel download at *every* section. (b) is mostly wrong: a 3-paragraph
narrative synthesis in a spreadsheet is a worse artifact, not a choice. **Ask.**

Whichever way: **keep RTF or drop it, but do not keep two half-maintained renderers.** And keep the
invariant the check enforces — **every document carries the database, the exact query, the date, the
count, and who ran it.** An export that cannot be re-run is not evidence. (Proven, not asserted: the
exported `.txt` query was fed back to PubMed and returned 5,593 — exactly the count printed in the
Word file beside it.)

### 2. Display the model used

**Today `BEDROCK_MODEL_ID` appears ONLY in the pod logs.** Nothing on screen and nothing in any
exported document says which model drafted the text. That is a real disclosure gap: journals
increasingly require declaring the AI tool **and its version**, and "AI-assisted" without a model
name is not a declaration.

It is a small change with three surfaces, and the third is the one people forget:

1. **The synthesis/answer caveat on screen** — next to the existing "verify every claim" banner.
2. **The synthesis/answer export** — the `AI-ASSISTED` paragraph in `synthesisDoc()`.
3. **The SEARCH STRATEGY export.** ← the one people forget. **Mode 1's query is also model-drafted.**
   A PRISMA-S appendix that does not disclose that the strategy was AI-drafted and human-reviewed is
   incomplete. Put it in `strategyDoc()`'s repro header.

Plumbing: the route already knows the model; return it on the build/synthesize responses (it is not
a secret — it is already in every log line). Render a human name (`Claude Opus 4.8, via AWS Bedrock`)
**and** keep the exact profile id (`us.anthropic.claude-opus-4-8`) in the export, because the id is
what makes the run reproducible and the pretty name is what a reader understands.

**Do NOT show a cost.** That remains deliberate: iteration is the behaviour we want, and a running
meter teaches a librarian to ration it.

### 3. Scopus and Embase — READ THIS BEFORE PROMISING EITHER

**These are not two variants of one task and must not be planned as one.** Recon'd this session
against the actual Java source and Elsevier's official docs.

#### Scopus: reachable, but the tool cannot do it today

`ReCiter-Scopus-Retrieval-Tool` is a **credentialed Elsevier proxy with a fixed query template, not a
query engine.** Do not be misled by the name.

- `GET /scopus/search/documents?by=keyword&term=…` **force-wraps** the term:
  `ScopusSearchService.java:78-85` → `TITLE-ABS-KEY(<term>)`. The caller never controls the field.
  Booleans *do* survive inside the wrap, so a concept block works **by accident** — but anything
  field-qualified at the top level (`PUBYEAR`, `DOCTYPE`, `LANGUAGE`) gets nested inside
  `TITLE-ABS-KEY()` and becomes invalid. **Our `limits` half breaks.**
- **Every search runs in STANDARD view.** `view=` / `COMPLETE` / `abstract` / `dc:description` have
  **zero occurrences** in the tool's Java source. STANDARD returns **no abstract**, and `dc:creator` =
  **first author only** (RPM already concedes this at `scopusSearch.controller.ts:32`). Screening and
  synthesis need abstracts. **This is the blocking gap, not the query syntax.**
- The count is free: the response carries `opensearch:totalResults`, which already passes through
  verbatim. Mode 1's shape works unchanged.
- The search controller exists **only on `origin/dev`** of that repo; **prod builds from `master`**.

**Work:** one new endpoint (raw query + `count`/`start`/`view`), a `view=COMPLETE` flip, a dev→master
merge, then `ready: false → true` at `LiteratureSearch.tsx:129` and a Scopus count/retrieve pair in
`config/local.js` mirroring `reciterPubmed` (`:134-137`). Days, not weeks. RPM already reaches the
tool via `RECITER_SCOPUS_API_URL` (PR #797 moved the Elsevier creds into it).

**THE ONE UNKNOWN: does WCM's Scopus insttoken entitle `view=COMPLETE`?** If not, abstracts require
the Abstract Retrieval API and the job gets materially bigger. **Verify with Elsevier — do not
assume.**

**And be honest with the librarians: Scopus is the EASY database and the LESS VALUABLE one.** It has
**no controlled vocabulary** — nothing to explode, no MeSH analogue — so a concept block loses its
entire controlled-vocab recall arm and is systematically *less sensitive* than in PubMed. For a
systematic review, where recall is the cardinal virtue, that is a **methodological cost no engineering
can remove**. Do Scopus to *earn the schema* (below), not because Scopus is the prize.

#### Embase: a procurement problem, not an engineering one

**Elsevier explicitly excludes the Embase API from free academic access, "regardless of institutional
type"** (stated on two separate Elsevier support pages; Scopus and ScienceDirect *are* in the free
tier). **An Embase.com web subscription does NOT convey API access** — the API is a separately-priced
Data-as-a-Service product sold through an Account Manager. Our existing Elsevier key almost certainly
carries no Embase entitlement. **Nothing anyone can do in this repo moves this one inch.**

And there is a genuine chicken-and-egg: **the single fact that decides whether Embase is even usable
for Mode 1 — does the search response return a total hit count without paging? — is not documented in
the 44-page official guide or in the WADL, and can only be settled with a live call using a key you
can only get by buying the subscription.** Mode 1 is count-only by design; if there is no cheap count,
counting a 15,000-hit strategy means ~75 paged requests at 6 req/s, and the design needs rework.

**THE ONE ACTION — send the Elsevier Account Manager exactly two questions before scheduling any
Embase work:**
1. Can our existing Elsevier API key + institutional token be granted **Embase API** entitlement, and
   at what cost?
2. Does the Embase search response (`/content/embase/article`) return a **total result count** without
   paging through records?

**Do not commit to an Embase date before those are answered.** Scopus proceeds independently.

#### The schema change both of them force — and the line to HOLD

**Adding a second database does NOT force a query-translation layer, and you must not build one.**
`HANDOFF-literature-search-ui.md:67` already decided this: *"There is no query-translation layer,
ever — the model writes a native query per database from the original question, rather than
translating MeSH into Emtree."* That decision **survives contact with Embase and Scopus, and is the
methodologically correct one**: Cochrane/PRESS expect a bespoke, separately peer-reviewed strategy per
database, and a mechanical MeSH→Emtree transliteration is exactly the artifact a librarian would
**reject** at PRESS review.

What a second database **does** force is a **type split**, because today the DB-neutral and DB-native
things are welded together in `Strategy = { db: 'pubmed', concepts: [{label, lines}], limits }` — the
concept's intellectual content (`label`) and its **PubMed rendering** (`lines`) live in one object:

```
Concept   = { label }                 // DB-NEUTRAL. The only thing that crosses a database boundary.
Rendering = { db, lines, limits }     // DB-NATIVE. Independently GENERATED, never translated.
```

One strategy per database, sharing only the concept **labels**. Nothing ever maps MeSH→Emtree.
**Someone will look at that map and call it a translation layer. It is not. Hold the line.**

Three PubMed-shaped things generalize with it:
1. `Strategy.db: 'pubmed'` — the literal type.
2. `countPubmed()` — needs a per-DB sibling. Trivial for Scopus (`opensearch:totalResults`);
   **possibly impossible for Embase** (see above).
3. **`SeedResult.pmid` — the subtle one.** The known-item seed check is the real quality gate on a
   generated strategy, and it is **PMID-keyed**. Embase's unique value is conference abstracts and
   European pharma content that **has no PMID at all** — so the seed check *cannot validate the part
   of the Embase strategy that is the entire reason for adding Embase*. Seeds would have to become
   DOI-keyed, and even that misses conference abstracts.

**A trap worth its own line: EMBASE EMBEDS MEDLINE.** Records carry
`<dbcollection>EMBASE</dbcollection><dbcollection>MEDLINE</dbcollection>`. Embase and PubMed counts
overlap massively and **must NEVER be summed.** The UI already renders counts per-database rather than
as a total, which is right — but nobody downstream may add them up, and record-level dedup is
mandatory before any "N unique records" claim.

## Still open, carried forward

- **`PUBMED_API_KEY` should be rotated** (printed to a transcript on 2026-07-13) **and set on the
  pod**, or Modes 2–3 trip NCBI's unkeyed 3/s limit under real use.
- **`HANDOFF-literature-search-ui.md:192-198` contradicts the signed-off mockup** — it still shows a
  Screen-4 `Effect | 0.70` column and an invented SMD range, which the mockup deliberately deleted.
  Anyone building from the ASCII ships an effect-size column. **Strike it.** (Paul confirmed the
  mockup wins; I left the doc alone rather than edit a signed-off artifact unasked.)
- **PubMed Clinical Queries hedges** (validated Therapy / Diagnosis / Prognosis / Etiology filters)
  are the standard librarian instrument for Mode 3 and appear in **none** of the design docs. Ask the
  SR librarians before inventing our own.
- **A count without records is not an empty search.** Handled now (the page says "rate limited, try
  again" instead of rendering an empty list under a 275-record count) — but the same suspicion
  applies to anything new: a throttled PubMed returns a well-formed zero, not an error.

## Running it locally

```bash
# Retrieval tool — MUST be the sort/retmax build, or Mode 2-3 print "by most relevant" over an
# unranked slice. NEVER `mvn` on this machine (JDK 25 kills the pinned Lombok); run the jar.
java -jar ~/Dropbox/GitHub/ReCiter-PubMed-Retrieval-Tool/target/reciter-pubmed-retrieval-tool-1.1.0.jar --server.port=8083

cd ~/worktrees/pm-literature-ui && PORT=3000 npm run dev
# login paa2013 -> sidebar -> Literature Search.  /curate errors on landing; ignore it.
```

`.env.local`: `RECITER_PUBMED_API_URL=http://localhost:8083`, `AWS_REGION=us-east-1`,
`BEDROCK_MODEL_ID=us.anthropic.claude-opus-4-8`, `LITERATURE_SEARCH_CWIDS=paa2013`. **That is the
whole list — there are no rate vars any more** (the app no longer prices anything; see below).

## Do NOT re-litigate

- **The app logs NO dollar figure, deliberately.** A token count is durable; a rate is volatile and
  owned by AWS. This route logged 5/25 per Mtok for months when the real `us.`-profile rate is
  **5.50/27.50**, so every figure it emitted was 10% light — recoverable ONLY because `model` and the
  token counts sat beside it. Totals come from Cost Explorer; ratios get recomputed from the tokens.
  (Verified rate + the two traps that hand you a confident wrong number: see the
  `reference_bedrock_pricing` memory.)
- **The server ranks; the model never does.** Mode 3's hierarchy is derived from PubMed's
  `publicationtypelist` and sorted before the model sees a record. Do not ask a model how strong
  evidence is.
- **No SSE.** Three plain POSTs; ~76s measured against a live-verified 500s ALB idle timeout.
- **No PHI detector, ever.** The obvious MRN heuristic ("a 7-10 digit number") fires on every 8-digit
  PMID in the seeds field. Mode 3's PHI surface is handled by *affordance* — four structured PICO
  fields, not a "describe the case" textarea.
- **The 50-cap is a property of the mode, not a setting.** It bounds the context window and therefore
  the bill.
- **iCite never sorts, never filters, never reaches the model.** Popularity is not evidence.

## Permanently out of scope

Dual independent screening, full-text screening, PRISMA flow diagrams, risk-of-bias, GRADE,
meta-analysis. Covidence and Rayyan do these and the SR team trusts them. **We hand off; we do not
compete.** A ticket that starts rebuilding one of these is a signal the feature has drifted.
