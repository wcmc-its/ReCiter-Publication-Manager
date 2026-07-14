# Handoff — Literature Search, after the ultracode review

**Supersedes `HANDOFF-literature-next-session.md`.** Its one ask — the ultracode review of PR #824 —
is **done**. The review, the verdict, and the full ledger of what it found are in **`REVIEW-pr824.md`**
on this branch. Read that before touching anything; it is the map.

```bash
cd ~/worktrees/pm-literature-ui        # NOT ~/Dropbox/GitHub/ReCiter-Publication-Manager
git log --oneline -9                   # 5a4ad6b..0e4fb8a — the review's fixes, pushed to PR #824
```

## What the review changed, and the one thing to carry forward

39 findings raised, **31 survived** three adversarial verifiers each. **Seven are fixed and pushed**
(`5a4ad6b`..`0e4fb8a`). About twenty are open, each with its file, line and fix, in `REVIEW-pr824.md`.
`npm run check:literature` is green, `tsc` is clean, and the P0 was driven in a browser on real
Bedrock and live PubMed.

**The lesson that outlives the PR: the `rowSeq` guard was never the bug.** The last handoff pointed
the review at it as "the newest, least-exercised code in the diff." A finder attacked it and all three
verifiers refuted the attack — **it is correct**. The bug was one layer up, in code nobody had flagged:
`rowCounts` is a map **keyed by PRESS line number**, and the line numbers **renumber on every toggle**.
Five of ten independent finders converged on it. The guard ordered *responses*; nothing was in flight
at the moment of the toggle, so no response-ordering guard could ever have seen it.

**And the second lesson, which is the more useful one: the browser found a bug ten static reviewers
did not.** After wiring the expert panel to recompute on a toggle, driving it showed the total *still*
frozen — `meshFromConcepts` iterated every line and **ignored `line.on`**, counting faculty against
MeSH terms the librarian had switched off. The reviewers all imagined the *edit* case; only an *untick*
exposes it. **Drive the thing. The static sweep is necessary and it is not sufficient.**

## EMBASE — decide it, do not leave it sitting there

Today Embase is **a disabled checkbox and a "Coming soon" card** (`LiteratureSearch.tsx:161`, and the
card near :1589). That is a promise the repo cannot currently keep, and it has been sitting there
implying imminent delivery. **The status quo is the one option that is definitely wrong.** Pick one.

**The fact that makes this a real choice, and it is easy to miss:** *a search strategy needs no API.*
Elsevier does not sell us the Embase **API** — that is settled and nothing in this repo moves it (see
"Permanently out of scope" below). But WCM **has Embase.com through a subscription**, and a strategy is
just *text a librarian pastes into it*. Generating native Emtree is a model call and a `DIALECTS` entry.
The entitlement blocks **counting**, not **writing**.

### What Embase-as-strategy-only would and would not give you

| | |
|---|---|
| **Gives** | A bespoke, native Emtree strategy per concept, side by side with the PubMed one, in the PRISMA-S appendix. **Cochrane requires an Embase search.** This is the thing that takes Mode 1 from "useful" to "compliant", and it is the one database whose absence a peer reviewer will actually flag. |
| **Does not give** | **A count. A yield. A seed check. The free-iteration loop.** All three of those are the whole argument for Mode 1 — toggle a line, see the number move in 1.1s — and Embase would have **none** of it. Every row is an em-dash, forever. |

So an Embase rendering is **a draft that has never been executed**. That is honest, and it is normal in
a protocol — but be clear that it is what you are shipping.

**The new failure mode, and it is worth saying out loud before anyone builds this.** For PubMed we can
at least prove a MeSH line retrieves *something*. For Embase we cannot verify that an Emtree heading
**even exists**. A hallucinated `'probiotic agent'/exp` that is not a real Emtree term retrieves **0**
in Embase, silently. It fails in Embase.com, in front of a librarian, rather than as a confident wrong
number on our screen — so it fails *safely* by this app's standards — but it is a new class of wrong
that PubMed and Scopus do not have, and it is exactly the class a librarian will judge us on.

### The next step is a SPIKE, not a project

**Do not build the dialect first.** The entire question is *can the model write valid Emtree*, and that
costs one Bedrock call and ten minutes in a browser:

1. Prompt Opus for a native Embase strategy for the probiotics/depression question — Emtree headings
   with `/exp`, `:ti,ab` field tags, the `AND`/`OR` syntax Embase.com actually parses.
2. **Paste it into Embase.com and press search.** Does it run? Do the Emtree terms resolve, or does
   Embase reject/zero them?
3. Show the output to the SR librarians alongside the PubMed one.

If the Emtree is sound → build it: `Db` gains `'embase'`, `DIALECTS` gains an entry (this is precisely
what that table exists for — "a third database is a table entry, not a hunt"), and `runStrategy` needs
one branch for an **uncountable** database. `countIn(db)` (`literatureSearch.controller.ts:187`) is the
single dispatch point and therefore the seam: an uncountable dialect skips counting entirely, and
`hits`, `rowCounts` and the seed check are **absent**, never zero. The export must **declare** it:
*"Embase strategy — drafted, not executed. Run it in Embase.com; we have no API access to count it."*
The same rule as the unsupported Scopus limits: **a thing we cannot do is DECLARED, not dropped.**

If the Emtree is junk → **axe the card.** Delete the disabled checkbox and the "Coming soon" note, and
say in the methods that Embase was not searched. A promise you cannot keep is worse than an absence you
have explained.

**My recommendation: spike it, and expect to ship it.** The value is real (Cochrane), the cost is a
table entry plus one branch, it needs no Elsevier entitlement, and it publishes **no number** — so it
cannot commit this feature's cardinal sin. But the spike gates it, because a hallucinated Emtree
vocabulary is the one way this goes wrong, and thirty minutes tells you.

## The rest of the queue, in the order things actually block each other

### P0 — the feature has still never run outside localhost

Unchanged by the review, because **the PR touches zero deploy files** — the review confirmed that and
refuted its own findings on those grounds. These remain true and they gate everything:

1. **Ship PubMedTool [#164](https://github.com/wcmc-its/ReCiter-PubMed-Retrieval-Tool/pull/164) FIRST**
   (`sort` + `retmax`). **This deploys before RPM, or not at all** — against an older jar Jackson drops
   both fields silently and Modes 2–3 print *"top 50 by most relevant"* over an unranked slice.
   **The review added a defence:** RPM now **502s** rather than degrade, because a tool that honoured
   `retmax` cannot return more than the cap, and that is a free capability signal we were throwing
   away (`880397e`). It is a backstop, not a substitute for deploying the tool.
   [#165](https://github.com/wcmc-its/ReCiter-PubMed-Retrieval-Tool/pull/165) is stacked on it.
2. **Give the pod `BEDROCK_MODEL_ID`, `AWS_REGION`, `LITERATURE_SEARCH_CWIDS`** in `k8-deployment.yaml`
   + `k8-secrets.yaml`. Without them the route 503s and the sidebar link hides itself.
3. **Give `reciter-pm` `bedrock:InvokeModel`** on the Opus inference profile. The SA exists and is
   IRSA-bound (PM #737), so there is a role to attach to. **Still the single most likely thing to blow
   up on first deploy**, and it will look like a 502 from a route that works perfectly on a laptop.
4. **Confirm `reciter-scopus-dev` actually has ScopusTool #35.** Merged to the tool's `dev`, but nobody
   verified the branch-gated CodeBuild fired. Against an older jar `POST /scopus/search/query` **404s**.

### P1 — the open findings, worst first

All twenty-odd are in `REVIEW-pr824.md` with file, line and fix. The one I would take next:

- **`newSearch()` cannot cancel an in-flight re-count.** `seq` is bumped *after* the effect's early
  returns, so the stale response writes back into the cleared `results`: the form the librarian just
  asked for **disappears**, and `recounting` can wedge permanently true, **disabling every export on
  the page** until a reload. Fix is two lines — `seq.current++` and `setRecounting(false)` inside
  `newSearch()`.
- Then: the unscreened-record fail-open (a record the model never read arrives **pre-ticked** and
  counted as an AI include), which chains off `invoke()` discarding Bedrock's `stop_reason`.

### P1 — the validation that is not code, and now has an extra question

**Put the two-database strategy in front of the SR librarians** — and take the Embase spike with you.
Ask them:

- Is the **Scopus** rendering of each concept good enough to peer-review, with no controlled vocabulary
  to lean on? Is "supplementary, not equivalent" the right framing, or too soft?
- **Is an UNCOUNTED Embase strategy useful to you, or is it noise?** They are the people who would paste
  it into Embase.com. This is the question that decides the section above, and it is theirs, not ours.
- **PubMed Clinical Queries hedges** (validated Therapy / Diagnosis / Prognosis / Etiology filters) are
  the standard librarian instrument for Mode 3 and appear in **none** of the design docs. **Ask before
  inventing our own.**

## Do NOT re-litigate

Everything in the previous handoff's "Do NOT re-litigate" list still stands. Do not re-derive it — the
short version:

- **There is no query-translation layer, ever.** Two native renderings of one concept is the DESIGN.
  Concept `{label}` is DB-neutral; Rendering `{db, lines, limits}` is DB-native and independently
  GENERATED. There is no MeSH→Emtree map either, and Embase does not get one.
- **The Elsevier creds stay in the TOOL.** RPM holds no `SCOPUS_API_KEY`.
- **`count=0` is not "no records" in Scopus** (Elsevier ignores it and returns 25; a cheap count is
  `count=1`). **`view=COMPLETE` caps a page at 25.**
- **The app shows no dollar figure.** **No SSE.** **No PHI detector, ever.**
- **The server ranks; the model never does.** **iCite never sorts, never filters, never reaches the model.**
- **DO NOT parallelise RPM's count calls** — the tool owns the rate policy; it knows the pod count.
- **Counts are NEVER summed across databases.** The overlap is large and unmeasured. If anyone ever
  wants a union count, dedup on DOI (+ `eid`, + PMID where present) becomes **mandatory** — and
  **EMBASE EMBEDS MEDLINE**, so its counts overlap PubMed's massively. That trap gets worse, not
  better, if Embase ships.

## Permanently out of scope

Dual independent screening, full-text screening, PRISMA flow diagrams, risk-of-bias, GRADE,
meta-analysis. Covidence and Rayyan do these and the SR team trusts them. **We hand off; we do not
compete.**

**The Embase API.** Elsevier excludes it from academic access, and an Embase.com subscription does
**not** convey API access. Nothing in this repo moves that — which is exactly why the section above is
about **strategy text**, not about counting. If anyone ever revives the API question, two things go to
the Account Manager **before** any engineering: (1) can our key be entitled, at what cost; (2) **does
the Embase search response return a total hit count without paging?** — undocumented, and Mode 1 is
count-only by design.

## Running it locally

```bash
# PubMed tool — MUST be the sort/retmax build (PR #164). `mvn` is fine (Temurin 17 is the only JDK).
cd ~/worktrees/pubmed-sort-retmax && java -jar target/reciter-pubmed-retrieval-tool-1.1.0.jar --server.port=8083

# Scopus tool — dev, post-#35.
cd ~/worktrees/scopus-dev && java -jar target/reciter-scopus-retrieval-tool-3.0.0.jar --server.port=8082

cd ~/worktrees/pm-literature-ui && PORT=3000 npm run dev
# login paa2013 -> sidebar -> Literature Search.  /curate errors on landing; ignore it.
```

`.env.local`: `RECITER_PUBMED_API_URL=http://localhost:8083`,
`RECITER_SCOPUS_API_URL=http://localhost:8082`, `AWS_REGION=us-east-1`,
`BEDROCK_MODEL_ID=us.anthropic.claude-opus-4-8`, `LITERATURE_SEARCH_CWIDS=paa2013`.

`npm run check:literature` is green and still needs **no LLM**. Keep it that way. It now also asserts
the re-key hazard, the DOI-seed quoting (live, with a PMID control), the retracted/protocol tiers, the
two-number export, the invented-citation warning, and that a `.docx` emits real Word paragraphs — that
last one reads `word/document.xml` back out and counts `<w:p>`.
