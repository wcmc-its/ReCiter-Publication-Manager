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

### 3. Scopus — GO. (Embase is parked; see below.)

**Paul, 2026-07-13: "We probably don't have EMBASE access. We do however have Scopus access. This app
uses the Scopus Retrieval Tool service."** So: **build Scopus, park Embase.**

#### Every blocking unknown is now ANSWERED — probed live against api.elsevier.com with WCM's own key

I ran the real API with `SCOPUS_API_KEY` + `SCOPUS_INST_TOKEN` (both already in the shell env; the
Scopus tool reads them from `System.getenv`). **These are measurements, not assumptions:**

| Question | Answer | Evidence |
|---|---|---|
| Does our insttoken entitle **`view=COMPLETE`**? | **YES.** | HTTP 200, **abstract 2,128 chars**, **full author list**. STANDARD returns neither. This was THE blocker and it is gone. |
| Is there a **cheap count** (Mode 1 is count-only)? | **YES — use `count=1`.** | Returns the true `opensearch:totalResults` (2,981) for a one-record payload. **`count=0` is IGNORED and silently gives you 25 records** — do not use it. |
| Do **top-level limits** work? | **YES, if the query is passed RAW.** | `…` = 2,981 → `AND PUBYEAR > 2020` = 2,019 → `AND DOCTYPE(ar)` = 1,423 → both = 975. |
| Does the tool's **force-wrap** corrupt a limited query? | It **fails loudly**, which is the good news. | Nesting `PUBYEAR` inside `TITLE-ABS-KEY()` → **HTTP 400 `"Error translating query"`**. It cannot silently produce a wrong count. |

#### So the work is exactly this

**In `ReCiter-Scopus-Retrieval-Tool` (NOT in RPM — see the warning below):** add ONE endpoint that
passes the query **verbatim** and exposes `count` / `start` / `view`. Today
`ScopusSearchService.java:78-85` force-wraps every term as `TITLE-ABS-KEY(<term>)`, so the caller can
never write a top-level limit — that is the whole gap. Then set `view=COMPLETE` (now known-entitled),
and **merge dev → master**: the search controller exists only on `origin/dev`, and **prod builds from
`master`**.

**In RPM:** a Scopus count/retrieve pair in `config/local.js` mirroring `reciterPubmed` (`:134-137`),
and `ready: false → true` at `LiteratureSearch.tsx:129`.

**⚠️ THE CREDS STAY IN THE TOOL.** PR #797 (`feat(scopus): search via the Scopus Retrieval Tool, drop
PM's Elsevier creds`) deliberately moved the Elsevier key OUT of RPM. **Do not let RPM re-acquire an
Elsevier credential** — route everything through `RECITER_SCOPUS_API_URL`, exactly as PubMed goes
through `RECITER_PUBMED_API_URL`. This is also what Paul confirmed the app does.

#### Be honest with the librarians about what Scopus IS

**Scopus has no controlled vocabulary.** Nothing to explode; no MeSH analogue. A concept block in
PubMed is `(exploded MeSH) OR (free-text)` — in Scopus the controlled-vocab arm **has no equivalent**,
so the same concept is faithfully expressed and *systematically less sensitive*. For a systematic
review, where recall is the cardinal virtue, that is a **methodological cost no engineering can
remove**, and a librarian will say so. Scopus is a **supplementary** database here, not a
PubMed-equivalent one. Its real payoff is that it forces and proves the Concept/Rendering split below,
which is the genuinely hard, database-agnostic part.

#### Embase — PARKED. Do not schedule it.

Paul: we probably don't have access, and the recon agrees. **Elsevier explicitly excludes the Embase
API from free academic access "regardless of institutional type"** (Scopus and ScienceDirect *are* in
the free tier), and **an Embase.com web subscription does NOT convey API access** — it is a
separately-priced Data-as-a-Service product sold through an Account Manager. **Nothing in this repo
moves that.**

Leave the Embase checkbox disabled and the "not searched" card honest. **If it ever gets revived, two
questions go to the Elsevier Account Manager BEFORE any engineering:** (1) can our key be granted
Embase entitlement, at what cost; (2) **does the Embase search response return a total hit count
without paging?** — undocumented in both the 44-page guide and the WADL, and Mode 1 is count-only by
design, so it can only be settled with a key you can only get by buying first. **Do not commit to an
Embase date before that is answered.**

Keep the honesty in the UI meanwhile: a Cochrane-compliant search *does* need Embase and CENTRAL, and
the card should keep saying so. Scopus does not change that.

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
