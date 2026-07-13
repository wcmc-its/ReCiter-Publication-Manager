# Plan — Mode 3, Clinical question (PICO)

**Status: awaiting Paul's approval. No code written.**

InfoSec is **cleared** (Paul, 2026-07-13), which supersedes "leave the radio disabled" in
`HANDOFF-literature-modes-2-3.md:109` and `HANDOFF-literature-next.md`. Input is **four structured
PICO fields**, not a free-text case textarea — the PHI hazard is designed out at the affordance,
not policed by a detector. **A PHI detector remains forbidden**: the obvious MRN heuristic is
"a 7-10 digit number", which fires on every 8-digit PMID in the seeds field.

## What Mode 3 actually is

By the documents' own arithmetic: **Mode 3 = Mode 2 + PICO input + evidence hierarchy.** Mode 2's
rails (retrieve → screen → synthesize, 50-cap, three plain POSTs, ~76s, ~$0.54) are reused whole.

Be clear-eyed about how little of this is specified. The entire contract for Mode 3 is:

- `SPEC-literature-search.md:122` — *"Precision + evidence hierarchy. Guidelines and SRs before primary trials. | 50 | An answer"*
- `SPEC-literature-search.md:132` — *"PICO in, short answer + evidence table + explicit confidence caveat."*

There is no PICO form, no tier vocabulary, no answer template, and **the signed-off mockup does not
contain Mode 3 at all**. So the evidence hierarchy is the only functional thing distinguishing Mode
3 from the already-built Mode 2, and it is one unelaborated phrase. Most of what follows is a
proposal, not a transcription. Where I am inventing, I say so.

## The one principle everything below hangs on

**The server ranks. The model never ranks.**

`designOf()` (`controller:423`) already stamps study design from PubMed's own `publicationtypelist`,
with a comment that got this exactly right: *"a design it cannot substantiate is a fabrication with
a coloured badge on it."* Mode 3 extends that discipline; it does not reopen it. The model writes
prose over a set the server has already ordered, and every tier label on screen is NLM's, not the
model's. This is the same move that makes Mode 1's counts reproducible and its miss-diagnosis
derived rather than guessed.

Note this puts Mode 3 in direct tension with `SYNTH_PROMPT` rule 5 — *"do not rank the papers by
quality"* — which is correct for Mode 2 and must be **amended, not deleted**, for Mode 3: *"you do
not rank; the server has already ordered these by PubMed's publication types."*

## 1. The hierarchy (derived, auditable, free)

Extend `designOf()` into a tier ordinal. Every tier below is a real NCBI publication type that
arrives on the record today — nothing here is inferred from an abstract.

| Tier | Designs (PubMed `[pt]`) | Why |
|---|---|---|
| 1 | Practice Guideline, Guideline, Consensus Development Conference | The spec's own sentence puts guidelines first. **Today there is no guideline tier at all** — a practice guideline currently renders as "Review" or "Other". |
| 2 | Meta-Analysis, Systematic Review | Above primary trials, per the spec. |
| 3 | Randomized Controlled Trial | |
| 4 | Clinical Trial (incl. phases), Controlled Clinical Trial | Non-randomized interventional. |
| 5 | Observational Study | PubMed's only observational `[pt]`, and it is coarse. |
| 6 | Case Reports | |
| 7 | Review (narrative), Editorial, Comment, Letter | Near expert opinion. |
| 8 | Other | Anything `[pt]` cannot substantiate. |

**This fixes a live inversion.** Today `any('systematic review') || any('review')` returns one
`'Review'` bucket, tested *after* RCT — so a systematic review sorts **below** an RCT, and a
narrative review sorts **equal to** a systematic one. Harmless in Mode 2 where the chip is
informational. Fatal in Mode 3 where the order is the product.

Two supporting changes:
- **`toRecord()` (`controller:504`) must keep the raw publication-type list on `PubRecord`.** It
  currently collapses it to a single `design` string and throws the rest away, so "Practice
  Guideline" vs "Guideline" is not recoverable and there is nothing to sort on.
- Sorting is a **server-side stable sort by tier**, applied after retrieval, before the model sees
  anything. Ties keep PubMed's relevance order.

**Deliberately NOT doing:** deriving cohort / case-control / case-series. Those tiers are **MeSH
headings, not publication types** ("Cohort Studies", "Case-Control Studies"). We hold the MeSH on
the record, so it *would* still be derived and auditable — but it is a second, weaker source, and
the existing code comment already defends the conservative call: PubMed tags many real
observational studies as nothing but "Journal Article", and inventing "Observational" for them
would be the exact lie we are avoiding. **Coarse and honest beats granular and wrong.** Revisit only
if the librarians ask.

## 2. The evidence floor — the bit nothing in the contract mentions, and the bit that matters most

Derived, free, and often the true clinical answer:

> **"The strongest design retrieved was an observational study. There is no RCT and no guideline in
> this set."**

A clinician reading a confident synthesis has no way to know the whole answer rests on case series.
This one sentence, computed from the tier of the top-ranked record, is the single highest-value
thing Mode 3 can say — and it costs one line of arithmetic, no inference, and cannot be wrong.

## 3. PICO input

Four fields. **Comparison is optional** — a great many clinical questions have no comparator, and a
required C field invites people to invent one.

```
Population    adults with type 2 diabetes and CKD
Intervention  SGLT2 inhibitor
Comparison    metformin                              (optional)
Outcome       cardiovascular mortality
```

Each non-empty field becomes **one concept block** in the strategy — which is exactly what the
existing `STRATEGY_TOOL` already emits (`concepts[] -> {label, lines[]}`), so PICO maps onto the
built machinery with no schema change. The field-tag rule in the prompt is untouched and
**must stay untouched**: it is what makes the count reproducible.

The placeholders are load-bearing, not decoration. "adults with type 2 diabetes and CKD" teaches
*Population = a clinical class*. There is no box that invites a case history, which is the whole PHI
argument.

## 4. The answer

Reuse Mode 2's synthesis rails and `SYNTH_TOOL` (model supplies `pmid` + `intervention` only;
study / year / journal / design are stamped server-side from the record).

- **Short answer**, every clause carrying `[PMID 12345678]`. `SYNTH_PROMPT` rules 1, 2, 3, 4, 6 are
  reused **verbatim** — especially rule 2, the no-invented-numbers rule.
- **Evidence table sorted by derived tier**, with a Tier/Design column stamped from
  `publicationtypelist`. **No Effect column.**
- **The evidence floor** (§2).
- **Static caveat banner** + the WCM expert panel (spec L134).

**NO per-answer certainty rating.** "High/moderate/low confidence in this answer" is GRADE by
another name, and GRADE is permanently out of scope (`SPEC:184`). The tier column and the evidence
floor give the reader what they need without a model adjudicating certainty.

### The doc contradiction Paul must settle

`HANDOFF-literature-search-ui.md:192-198` shows a Screen-4 table with an **`Effect | 0.70`** column
and the prose *"SMD −0.44 to −0.79"*. The **signed-off mockup deleted that column on purpose**
(`docs/literature-search-mockup.html:1194`): *"no effect sizes are shown because inventing them is
precisely the failure this feature is designed to prevent."* The two design docs point in opposite
directions and anyone building from the ASCII ships the effect column.

**Proposal: the mockup wins. No Effect column in Mode 3, ever.** Prose may quote a figure only if
that exact figure appears verbatim in an abstract and carries its PMID — which is already
`SYNTH_PROMPT` rule 2. I will strike the ASCII's Effect column from the UI contract as part of this
work unless told otherwise.

## 5. Wire protocol (smallest possible diff)

The `phase === 'screen'` and `phase === 'synthesize'` branches (`search.ts:235`, `:263`) are tested
**before** the mode branch and currently **ignore `mode` entirely**. Smallest change: the client
posts `mode: 'clinical-question'` alongside the existing phase, and those two branches read it to
pick the Mode-3 prompt. No 4th phase value, no new route.

- Phase 1: `{ mode:'clinical-question', population, intervention, comparison?, outcome, dateId, typeId, sort }` → `buildStrategy(..., 'precision')` → `runReview()`. Reuses the narrowing gate and the escape hatch unchanged.
- Phase 2 `screen`: unchanged (`screenRecords`), mode-blind is fine — screening is screening.
- Phase 3 `synthesize`: reads `mode`, picks `PICO_SYNTH_PROMPT`, and receives records **already tier-sorted**.
- `logCost` mode strings: `clinical-question:build` / `:screen` / `:synthesize`.

## 6. Verification (before I call it done)

- **`npm run check:literature` extended** — it needs **no LLM**, which is the point. Assert against
  real PubMed: a known practice guideline lands in tier 1; a known systematic review outranks a
  known RCT (the inversion, pinned); the evidence floor reports the true top tier; `toRecord()`
  preserves the raw pt list. This is the runnable check that fails if the hierarchy breaks.
- **Driven in a browser**, because on this page everything that passed `tsc` broke on screen:
  toasts render as **nothing** (use inline error state), `h1` is pinned app-wide by a `globals.css`
  `!important`, and a long query overflowed the card at 4,500px wide.
- A real PICO run end to end on Bedrock, with the tier ordering checked against the PubMed record by
  hand.

## 7. Cost and shape — unchanged from Mode 2

Three plain POSTs, ~76s, ~$0.54/run at the verified `us.` rate (5.50/27.50 per Mtok). No SSE — that
question is answered and the answer is "yes it survives the ingress, and we don't need it". The
50-cap is a property of the mode, not a setting.

## Open questions for Paul

1. **Is the hierarchy a RETRIEVAL rule or a DISPLAY rule?** *(the only one that changes the system)*
   "Guidelines and SRs before primary trials" does not say which. **This plan assumes DISPLAY**: one
   precision query, PubMed Best Match top 50, then a server-side sort by derived tier — plus the
   evidence floor to state honestly when the good stuff simply is not there. The alternative is
   **tiered retrieval** (a guideline/SR pass, then a trials pass, filling to 50), which honours the
   sentence more literally but is a materially bigger system and can drag in low-relevance
   guidelines just because they are guidelines. My recommendation is display-sort now; add tiered
   retrieval only if the librarians report the top 50 is missing guidelines they expected.
2. **Effect column: confirm the mockup wins** and I may strike the contradicting ASCII from the UI
   contract.
3. **PubMed Clinical Queries hedges** (the validated Therapy / Diagnosis / Prognosis / Etiology
   filters) are the standard librarian instrument for exactly this mode, and appear in **none** of
   the three documents. Not in this plan. Worth asking the SR librarians before we invent our own.

## Explicitly out of scope

GRADE, risk-of-bias, meta-analysis, pooled effects, dual independent screening, full-text screening,
PRISMA flow diagrams. A PHI detector. Covidence and Rayyan do the screening work and the SR team
trusts them. **We hand off; we do not compete.**
