# The recall study — what Mode 1 actually finds, and what it then throws away

Run 2026-07-14 against **live PubMed** and **live Bedrock** (`us.anthropic.claude-opus-4-8`).
Reproduce with `node controllers/literatureSearch.recall.js` (~$0.80, ~4 minutes).
Full artifact — every query, every rank, every verdict — in `.litrecall-run.json`.

This is the measurement `HANDOFF.md` said had never been taken: *"Nobody has measured whether the AI
screen is any good — and a wrong EXCLUDE is invisible."*

It has now been taken. **The screen is not where the loss is.** The loss is somewhere nobody was
looking, it is far larger, and it is structural.

## The headline

| | |
|---|---|
| The **strategy** retrieved | **72 of 73** known-included studies — **99%** |
| Of those 72, the **top-50 relevance cut** showed the model | **1** — **1%** |
| Of the studies that reached the model, the **AI screen** kept | **1 of 1** — it threw away **nothing** |
| Surviving question → strategy → cap → screen | **1 of 73** |

The strategy builder is the best part of this feature and it is not close. Given a real systematic
review's question, it wrote a PubMed strategy that retrieved essentially every study that review
included — including on the deliberately hard behavioural question with no clean MeSH handle.

And then the product hands the librarian the top 50 by relevance, and **the studies are not in it.**

## The three reviews

Cochrane reviews, chosen because they publish a formally separated *"References to studies included in
this review"* list. Gold PMIDs extracted from PMC JATS XML by section, never from the general
bibliography. See `controllers/literatureSearch.recall.json` for provenance and the full method.

| Review | Shape | Hits | Strategy recall | Reached the model | Screen kept | End to end |
|---|---|---|---|---|---|---|
| Intratympanic corticosteroids for sudden hearing loss | intervention / RCT | 818 | **25/25 (100%)** | 1/25 | 1/1 | **1/25 (4%)** |
| Toe-brachial index for peripheral arterial disease | diagnostic accuracy | 27,133 | **18/18 (100%)** | 0/18 | — | **0/18 (0%)** |
| Educational/psychological interventions for eczema | complex / behavioural | 10,112 | **29/30 (97%)** | 0/29 | — | **0/30 (0%)** |

The one study the strategy missed (PMID 30141340) and the 12 studies with no PMID at all are accounted
for in the `caveats` of the benchmark file. They are a ceiling on what *any* PubMed strategy could
retrieve, ours included, and they are not counted against the tool.

## Why the cap is not a tuning knob

The obvious reply to a 1% is "then raise the cap". It does not survive contact with the ranks.

**Where a known-good study actually sits in PubMed's relevance ordering:**

| Review | best rank | median rank | worst | beyond rank 1000 |
|---|---|---|---|---|
| Hearing loss (of 818) | 38 | **338** | 602 | 0 |
| Toe-brachial index (of 27,133) | 80 | **288** | 945 | 8 of 18 |
| Eczema (of 10,112) | 129 | **299** | 588 | 7 of 29 |

Across all three reviews, **exactly one** of the 72 retrieved known-good studies ranks in the top 50 —
at #38. Nothing else comes close to the fold. The typical eligible study sits around **rank 300**.

**What a bigger cap would buy:**

| cap | hearing loss | toe-brachial | eczema |
|---|---|---|---|
| 50 (today) | 1/25 | 0/18 | 0/29 |
| 100 | 1/25 | 1/18 | 0/29 |
| 200 | 3/25 | 4/18 | 6/29 |
| 500 | 24/25 | 9/18 | 20/29 |
| 1000 | 25/25 | 10/18 | 22/29 |

A cap of 500 — ten times the screening cost, ~$3 and several minutes per search — still loses **half**
the diagnostic review's studies. The problem is not that the cap is set too low. **It is that relevance
ranking is not built to float the primary studies a systematic review would include, and it does not.**
It surfaces reviews, highly-cited papers and recent work: a population very nearly *disjoint* from the
one the reviewer is hunting for.

## What this means, and what changed because of it

**The AI screen is exonerated, and the fear in the handoff was misplaced** — but only because the screen
was never given anything to get wrong. It saw one eligible study and it kept it. There is still no
evidence about how it behaves at volume, and this study cannot produce any, because the cap starves it.

**The real finding is upstream and it is worse.** The `.xlsx` that goes into **Covidence** carried an
*"AI suggested / Include / Exclude"* column over those 50 records. Covidence treats that file as a
screening pass. A column reading "Exclude" beside 50 records — drawn from the 27,000 the librarian's own
strategy correctly matched, and containing none of the eligible ones — is not a screen. It is a
screen-shaped object, and it would have quietly cost a published review its recall.

**So the export now refuses it.** When the sheet is truncated (`hits > retrieved`), `recordSheets()`
drops the AI verdict columns entirely and states in the Search sheet why, in the file, where Covidence
opens it. The records and the strategy still ship — the strategy is the good half, and the Boolean query
is what Covidence actually wants. The 50-record sample stays on screen as triage, which is a fair
description of what it is. See `controllers/literatureExport.ts`.

## What this study does NOT establish

- **N is 3.** This is a smoke alarm, not a thermometer. It cannot rank models or justify tuning.
- **It says nothing about the screen's false-negative rate at volume** — the thing the handoff was
  actually worried about. That question is still open and now needs a *different* experiment: feed the
  screen a known-positive set directly and see what it does.
- **All three reviews are Cochrane**, and Cochrane questions are unusually well-formed. A messier
  question may strategise worse.
- **Modes 2 and 3 are unmeasured.** They are relevance-truncated too, but they answer a clinical
  question rather than assemble a review, and "the top 50 by relevance" may be exactly right for them.
  Do not generalise this result onto them without running it.

## The next experiment, for whoever picks this up

Screening recall, isolated from the cap: take the 72 known-good studies, mix them with 200 records the
strategy retrieved but the review excluded, hand *that* to `screenRecords()`, and count what it bins.
That measures the classifier instead of the ranker, and it is the number the handoff was originally
asking for. It is a laptop afternoon and about two dollars.
