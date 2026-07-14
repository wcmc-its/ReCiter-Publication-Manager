# The recall study — what Mode 1 actually finds, and what it then throws away

Run 2026-07-14 against **live PubMed** and **live Bedrock** (`us.anthropic.claude-opus-4-8`).
Reproduce with `node controllers/literatureSearch.recall.js` (~$0.80, ~4 minutes).
The run writes `.litrecall-run.json` (every query, every rank, every verdict). It is gitignored — it is
an output, and `literatureSearch.screen.js` consumes it — so regenerate it rather than looking for it here.

This is the measurement nobody had ever taken. The question it answers was: *"Nobody has measured whether the AI
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

## Part 2 — the screen, measured directly (`literatureSearch.screen.js`)

The study above left the screen **innocent by starvation**: it was handed one eligible study and kept
it. So it was measured on its own, by padding each review's known-included studies up to a full 50-record
batch with records *the same strategy retrieved but the review excluded* — the exact shape the code
screens in production. Run in two stages, because an enriched batch (~50% eligible) could flatter a model
that a real one (~3%) would not.

| | recall | |
|---|---|---|
| **Stage A** — enriched, ~50% eligible | **99%** | 71/72 kept |
| **Stage B** — realistic, ~6% eligible | **89%** | 8/9 kept |

**The screen is good, and prevalence did not flatter it.** Stage B's single loss is the *same study*
Stage A lost (PMID 34956078), excluded both times with near-identical reasoning — *"TBI measured as
covariate, not the index test evaluated against imaging with sens/spec"*. That is a defensible call on a
borderline paper, made consistently, not a hallucination. It is exactly the judgement a human
first-screener makes and a second reviewer overturns, which is why Covidence does dual screening and we
do not. **The classifier was never the problem.**

### The thing this run actually caught, which mattered more than the number

On the eczema batch the model **returned 43 verdicts for 50 records**. Seven got no verdict at all; four
of them were known-included studies. It did **not** trip the `stop_reason: max_tokens` guard — this was
not truncation. The model simply omitted records from a tool call whose schema says *"Exactly one entry
per record supplied. Never omit a record."*

And the omission was **not random**. Reconstructing the batch order showed the seven were positions
**25–31 of 50** — a contiguous window out of the dead centre of the list:

```
........................XXXXXXX...................
```

That is **lost-in-the-middle**: positional attention degradation. It took whatever sat in that window
regardless of what the papers were.

### Which is why the fix is a repair, not a better model

Two things follow, and they decided the design.

**A better model cannot fix this.** We are already on the most capable one. A better one would drop three
instead of seven and you would still not know which run was which. And the rate is **wildly unstable** —
re-running the identical experiment dropped **7 records one run and 1 the next**. You cannot manage a
rate that swings 7× between runs.

**But completeness is checkable.** We know exactly which records came back without a verdict — the
`missing` list already existed. A requirement you can *verify* should be **repaired**, not made more
probable. So `screenRecords()` now **re-asks for precisely the records that were skipped** (up to two
re-asks), with the fail-open `screened: false` floor still underneath for anything missing at the end.

**Measured after the fix: every batch returns 50 of 50.** The re-ask fires visibly and converges:

```
{"tag":"literature-screen-reask","attempt":1,"asked":50,"answered":49,"reasking":1}
```

No `literature-screen-missing` in any of the six batches. Screen recall re-measured: **99% enriched,
100% realistic**.

The first pass is still **not chunked**. Chunking shrinks the middle but never reaches zero (a ten-record
call can drop one too), and it screens each batch blind to the others. Re-asking only pays for the
failures, and it terminates.

### One honest caveat about the re-ask

The re-ask is itself a small blind batch, and the screen is **measurably stochastic on borderline
papers**: across runs, PMID 34956078 was excluded in one batch and included in another, with coherent
reasoning both times. So a record that lands in a re-ask may get a verdict it would not have got in the
main pass.

That is accepted deliberately. An unstable verdict on a borderline paper is a judgement the librarian can
see, argue with, and untick. **No verdict at all is an unread paper wearing a tick** — which is the
failure this entire work order exists to kill. A shaky answer beats a silent gap.

### The same bug class, checked elsewhere

`synthesize()` returns a variable-length evidence table from the same model in the same shape, and it
builds that table by walking the model's rows. It was checked: it **already backfills** any selected
paper the model omits, from the record we hold, and logs it (`literature-synth-missing-rows`). A selected
paper cannot silently vanish from the table. No change needed.

## What this study does NOT establish

- **N is 3.** This is a smoke alarm, not a thermometer. It cannot rank models or justify tuning.
- **The distractor side is noisy by construction.** A "distractor" is any retrieved record the review did
  not include — but some are its own protocol, a secondary report, or a study excluded on full text for a
  reason no title/abstract screen could see. Do **not** read the include rate on distractors as a
  precision score. Recall is the clean number here; precision is not measured.
- **All three reviews are Cochrane**, and Cochrane questions are unusually well-formed. A messier
  question may strategise worse.
- **Modes 2 and 3 are unmeasured.** They are relevance-truncated too, but they answer a clinical
  question rather than assemble a review, and "the top 50 by relevance" may be exactly right for them.
  Do not generalise this result onto them without running it.

## Part 3 — does the strategy survive a question a real person would type? (`literatureSearch.question.js`)

Parts 1 and 2 left the Boolean query as the deliverable. That made its 99% recall the only claim we are
still making — and it rested on three Cochrane reviews with **questions written by reading those
reviews**: careful, PICO-shaped restatements of a question a Cochrane team had already spent months
sharpening. That is not what the box will get.

So: hold everything constant — same reviews, same gold PMIDs, same ceiling, same criteria — and change
**only the question**, degrading it toward what a hurried person types. B and C are deliberately faithful
paraphrases, not strawmen: a degraded question that also asks something *different* would confound
vagueness with a changed question.

| | A careful | B colloquial | C terse | D terse, no criteria |
|---|---|---|---|---|
| Hearing loss | 100% / 898 | 100% / 3,117 | 100% / 802 | 100% / 3,374 |
| Toe-brachial | 100% / 4,510 | 100% / 6,162 | 94% / 1,077 | 100% / 3,560 |
| Eczema | 100% / 5,354 | **90% / 368** | 97% / 5,137 | 97% / 6,511 |
| **POOLED** | **100%** | **96%** | **97%** | **99%** |

*(recall / yield)*

**The strategy builder is robust to phrasing.** 100% on the careful question, 99% on the worst realistic
input — a bare keyword string with no inclusion criteria at all. **The question is not the risk**, and
Mode 1 does not need to interrogate the user before it searches. That was the thing this experiment was
run to find out, and the answer is a clean no.

### But the yields tell a second story, and it is the one worth keeping

Look at eczema variant B: recall drops to 90% and the **yield collapses from 5,354 to 368** — 93% of the
search, gone. The model had silently added a third concept block: **an RCT design filter**, from a
question that says nothing whatsoever about randomised trials.

That is a **prompt violation**. Limits come from the two dropdowns and are passed in by the caller; the
system prompt explicitly says *"Limits already applied by the caller (do NOT repeat these inside a
concept block)"*. On a vague question the model fills the gaps in the PICO anyway, and **every gap it
fills is an AND, and every AND can only narrow.**

### The mechanism, which is NOT the one I first assumed

The obvious story — "the invented RCT filter threw away the trials" — is **wrong**, and it is worth
recording that it is wrong, because it is the story anyone would tell. Blaming each lost study against
each block (`<pmid>[uid] AND (block)`) gives:

| lost study | eczema block | education block | RCT filter | killed by |
|---|---|---|---|---|
| 30141340 | ✓ | **0** | ✓ | education block |
| 29505898 | ✓ | **0** | ✓ | education block |
| 24942774 | ✓ | ✓ | **0** | RCT filter |

The invented RCT filter matched both of those RCTs perfectly well. It only cost **one** study. **The
dominant loss came from a narrower intervention vocabulary**: the colloquial phrasing *"teaching patients
about their eczema"* produced an education block that missed the terms **"eczema care plan"** and
**"eczema action plan"** — which is precisely what those two papers are titled.

So there are two distinct failure modes, and they need different answers:

1. **Invented constraint blocks** (the RCT filter). A prompt violation, cheap to detect — a concept block
   made of publication-type terms is not a concept, it is a limit — and it collapsed the yield by 93%.
2. **Vocabulary gaps** (the missing "care plan" / "action plan" synonyms). Not fixable by a rule. This is
   what a librarian is *for*, and it is what the product's own seed validation exists to catch.

### And the product already contains its own cure

The failing-block diagnosis above is not a technique I invented for this write-up — **it is what the tool
already does** when you give it known-item seeds. Every line is a checkbox with its own count, so the
368-record collapse is visible on screen, and a seeded run names the exact block that killed the seed.

The operational lesson is therefore blunt and it belongs in front of every librarian who uses this:
**always give seeds.** A strategy with no seeds is a strategy whose recall nobody has checked — including
this tool, which is capable of checking it and is being asked not to.

## Where that leaves the feature

Both halves work. **The strategy builder retrieves the studies (99%) and the screen keeps them (98% of
those it judges).** The failure is entirely in the relevance-ranked cut between them, and in the model's
habit of silently returning a short verdict array.

So the honest shape of Mode 1 is: **the Boolean query is the deliverable.** It is excellent, it is
reproducible, it survives a badly-phrased question, and Covidence wants exactly that. The 50-record
sample is triage and the export says so.

### The deeper-slice idea is DEAD, and the rank table already killed it

It is tempting to say "the screen is good and complete now, so screen a deeper slice and beat the cap."
**The arithmetic refuses.** Read the recall from the rank table at each cap:

| cap | hearing | toe-brachial | eczema | **pooled recall of eligible studies** |
|---|---|---|---|---|
| 50 (today) | 1/25 | 0/18 | 0/29 | **1%** |
| 200 | 3/25 | 4/18 | 6/29 | **18%** |
| 500 | 24/25 | 9/18 | 20/29 | **74%** |
| 1000 | 25/25 | 10/18 | 22/29 | **79%** |

Even with *perfect* verdict completeness, screening 200 records shows the model **18%** of the eligible
studies. A systematic review needs essentially all of them; 74% is not a screen. And the curve flattens
after 500 because the diagnostic review's studies are scattered past rank 1000 — the ranking is not
degrading gracefully, it is simply not sorted by the thing we care about. **Completeness was never the
binding constraint. Recall arithmetic is.**

It is not even runnable as specified. At ~800 input tokens per record, **500 records is ~400k input
tokens** — past the standard 200k context on `us.anthropic.claude-opus-4-8`, so it is a chunked design,
and chunking is what we ruled out. And **200 records would blow the 8,000-token output ceiling** (~200
verdicts × ~50 tokens) — where it would now *throw*, correctly, on the `stop_reason` guard.

**Do not run this experiment.** It costs money to confirm a design the rank table has already refused.

### What is actually left

- **Modes 2 and 3 are unmeasured.** They are relevance-truncated too, but they answer a clinical question
  rather than assemble a review, so "the top 50 by relevance" may be exactly right for them. Do not
  generalise Part 1 onto them without running it — and note the yardstick would have to be different,
  because there is no "included studies" list for a clinical question.
- **The invented-constraint bug** (Part 3): a concept block made of publication-type terms is a limit
  wearing a concept's clothes. `hoistFilters()` already performs exactly this species of repair for
  PubMed. Extending it to hoist a design-filter *block* out of the concepts and into the limits — where it
  is visible, labelled as a limit, and toggleable — is the contained fix.
- **Say "always give seeds" out loud, in the UI.** It is the single highest-leverage thing a librarian can
  do, and the tool is already built to reward it.
