# Handoff — Literature Search, after Mode 2

**Mode 1 (Search strategy) and Mode 2 (Issue review) are both built and both driven end to end in a
browser on real Bedrock and real PubMed.** Mode 3 (Clinical question) is deliberately still dark.

Nothing is pushed and there are no PRs — `dev` is wanted for another feature set first. Two local
branches carry the work:

| Repo | Branch | Commits |
|---|---|---|
| ReCiter-Publication-Manager | `feature/pm-literature-mode2` | `321035f` (on top of the 14 Mode-1 commits on `feature/pm-literature-ui`) |
| ReCiter-PubMed-Retrieval-Tool | `feature/pubmed-sort-retmax` | `990d555` sort+retmax, `110afb1` the threshold carve-out |

**The RPM branch is a strict descendant of `feature/pm-literature-ui`, which descends from
`feature/pm-literature-search`.** All three collapse with a fast-forward whenever you want one
branch. None is pushed. `fix/contrast-aa-tokens` is separate and unrelated — review it on its own.

**The two repos ship together.** RPM sends `{sort, retmax}` to `/pubmed/query-complex/`. Against an
old jar those fields are ignored, and Mode 2 silently degrades to "the first 50 in PubMed's default
order" while still *printing* "top 50 retrieved by most relevant". That is a lie on screen with no
error anywhere. **Deploy the retrieval tool first, or not at all.**

`npm run check:literature` is green, needs no LLM, and must stay that way. Keep it green.

## THE APP NO LONGER KNOWS WHAT ANYTHING COSTS, ON PURPOSE (done — `5656230`, `f0e2ef2`)

**`estUsd` is GONE from the logs, and no price lives in this codebase any more.** `logCost()` emits
`model` + `inputTokens` + `outputTokens` and stops. There is **nothing to set on the pod** — the two
`BEDROCK_USD_PER_MTOK_*` vars an earlier draft of this doc told you to provision no longer exist.

**Why:** a token count is a **durable** fact about what we did; a price is a **volatile** fact owned
by AWS that changes without telling us. Bake the volatile one into a log line and a rate change
silently rots every past line. This is not hypothetical — it is what happened here. The route logged
`5/25` per Mtok for months; the real rate for a `us.` profile is `5.50/27.50`; **every figure it ever
emitted was 10% light**, and it was recoverable *only* because `model` and the token counts were on
the line beside it. Store the durable fact; apply the volatile one at read time.

**So where do dollars come from now?**
- **Totals:** Cost Explorer, filtered to Bedrock. Authoritative, self-updating, and structurally
  incapable of being 10% wrong.
- **Ratios** ("Mode 2 costs ~16× Mode 1") — the question that *will* be asked when this outgrows the
  pilot: Cost Explorer cannot answer it, because it has never heard of a cwid or a mode. Recompute
  from the logged tokens, at the rate of the day. That is a five-minute job and it is always right.

**The rate, as of 2026-07-13, if you need to do that arithmetic today:**
`us.anthropic.claude-opus-4-8`, us-east-1, on-demand = **$5.50 / Mtok in, $27.50 / Mtok out**
(so the Mode 2 headline is ~$0.54, not the ~$0.49 quoted below and elsewhere in this doc).
Read it from the **AWS Price List API** — the billing source of truth. **Two traps are waiting, and
both hand you a confident wrong number instead of an error:**

- The service code is **`AmazonBedrockFoundationModels`**, *not* `AmazonBedrock`. The old
  service code (which the previous version of this handoff told you to use) carries only legacy
  Claude models — 2.x, 3 Haiku/Sonnet — and returns **zero hits for Opus**, silently. The newer
  models are sold as Marketplace "Amazon Bedrock Edition" listings, and the model name lives in
  `product.attributes.servicename`, not in the `model` attribute (which is null).
  ```bash
  aws pricing get-products --region us-east-1 --service-code AmazonBedrockFoundationModels \
    --filters 'Type=TERM_MATCH,Field=regionCode,Value=us-east-1'
  # then: servicename == "Claude Opus 4.8 (Amazon Bedrock Edition)"
  ```
- **`aws.amazon.com/bedrock/pricing` will tell you $6.00 / $30.00. That is the GovCloud table.**
  The commercial-region tables on that page are rendered client-side and do not survive a fetch.

**Why 5.50 and not 5.00:** the Price List publishes two on-demand tiers per model — **"Regional
CRIS"** and **"Global"**. A `us.` prefix is a **geography-scoped** cross-region inference profile and
bills the *CRIS* tier; only a `global.` profile gets the 10%-cheaper *Global* tier. The 5/25 that
everyone reaches for is Anthropic's **first-party list price**, which happens to coincide with the
*Global* tier — so it looks right, and is 10% low for every `us.` profile. The delta is a stable
structure, not a one-off: Opus 4.5/4.6/4.7/4.8, Sonnet 4.5/4.6, and Haiku 4.5 all show exactly 10%.

**A real cost lever, if anyone asks:** switching to `global.anthropic.claude-opus-4-8` is exactly
10% cheaper. It routes to any commercial AWS region, so it is a **data-residency call, not a code
one**. Nothing in the code needs to change for it either way — which is now the point.

Do not put a cost meter in front of a librarian: iteration is the behaviour we want, and a running
meter teaches them to ration it.

## Also before this meets a real user

- **Mode 3 → InfoSec.** Unchanged and still the long pole. PICO invites someone to paste a case
  history into a textarea, and it is the only surface in the feature with a real PHI story. The
  radio is disabled in the UI; leave it disabled. Note the answer may differ now that inference is
  **Bedrock, in-account AWS**, not `api.anthropic.com` — that is a materially different data-flow
  question and worth re-asking with that fact up front. **Do NOT build a PHI detector**: the obvious
  MRN heuristic is "a 7-10 digit number", which fires on every 8-digit PMID in the seeds field.

- ~~**The nav item is wider than the API gate.**~~ **DONE (`5656230`).** One boolean
  (`literatureAccess`) now rides the JWT and hides the sidebar link; the roster itself never reaches
  the browser. It is set **outside** the `if (user)` guard in the `jwt` callback, so adding someone
  to the pilot takes effect on the next token refresh rather than requiring them to log out — check
  that if you ever touch it. The allowlist parse lives in `controllers/literatureAllowlist.ts`, and
  an **empty list means the pilot is closed, not open to everyone**. The API is still the real gate:
  `/literature` remains reachable by URL and still 403s, verified in a browser.

- **The 500s ALB idle timeout is not a promise.** It is a live-read of today's config. If anyone
  retunes the ingress, the three-POST design is what quietly breaks — the 47s synthesis call is the
  one that would start failing. See `project_rpm_sse_ingress` in memory for the full reading.

## What NOT to re-litigate

- **The SSE question is ANSWERED and the answer is "yes, but we don't need it."** SSE survives the
  ingress: the ALB is not nginx (two nginx controllers idle in the cluster are a decoy that no
  Ingress uses), it does not buffer, and its idle timeout is a live-verified **500s**. What would
  have killed a stream is **our own app** — Next's `compress` defaults to `true` and gzips
  `text/event-stream`, so events arrive as a bare gzip header, then silence, then a dump on close.
  That failure looks *exactly* like an ingress problem and is not one; if you ever do build SSE, set
  `Cache-Control: no-cache, no-transform` on the route and it works.
  We did not, because measured inference is ~76s against a 500s tolerance. **Three plain POSTs.** Do
  not reintroduce streaming to buy a progress bar you would pay for with a state machine on both
  sides, plus reconnect handling for the rolling deploys that sever in-flight streams.

- **The 50-cap is a property of the mode, not a setting.** No Max dropdown. It bounds the context
  window and therefore the bill. Someone will try to "unify" it with Mode 1's uncapped recall. Don't.

- **`RETRIEVAL_THRESHOLD = 2000` no longer refuses a bounded fetch**, and that was deliberate
  (`110afb1`). With an explicit `retmax` only `retmax` records are fetched, so the cost the gate
  protected against no longer depends on how many matched. The top 50 of a 122k-hit query works.
  The bound still holds: `retmax` may not exceed the threshold, and a caller sending no `retmax` —
  the ReCiter engine, every legacy path — gets the original refusal, untouched.

- **iCite is a display signal, not a ranker.** RCR and percentile are citation-based, so they favour
  **old papers and reviews** — the exact bias that was just removed from retrieval. Ranking the 50
  by RCR would put the reviews back and bury the recent trials. We show `nih_percentile` (readable
  without a footnote, unlike RCR) as a chip, and it **never sorts, never filters, and never reaches
  the model**. Popularity is not evidence.

## The bugs already paid for — do not re-learn these

Every one of them passed a clean `tsc` and was caught only by driving the page.

1. **A ZERO FROM PUBMED IS NOT A ZERO, AND NEITHER IS AN EMPTY RECORD SET.** A throttled esearch
   returns a well-formed `0`, not an error — and inside the retrieval tool, `if (count == 0) return
   new ArrayList<>()` turns that into a well-formed **empty result set**. Indistinguishable from
   "your search found nothing". Both `countPubmed` and `fetchArticles` now retry once; a genuine
   zero reproduces, a throttled one almost never does. It fired for real during this work
   (`literature-count-zero-retry`, recovering 122 from a 0). Apply the same suspicion to anything
   you add.

2. **A FILTER OR-ED INTO A BLOCK CANCELS ITSELF.** Lines within a block are OR-ed; blocks are
   AND-ed. Asked for "RCTs only, exclude animals", the model emitted
   `(RCT[pt] OR Controlled Clinical Trial[pt] OR Humans[MeSH] OR ...)` — satisfied by *every human
   paper ever indexed*. 31 of 50 retrieved records came back reviews, each one read into a context
   window, paid for, and then excluded by the screener for being a review. The prompt now spells the
   OR/AND semantics out, **and** `hoistFilters()` fixes it structurally, because a prompt is not a
   guarantee and this failure is silent and expensive.

3. **`Number(null) === 0`, and `0` is finite.** An iCite `nih_percentile: null` sailed through a
   `Number.isFinite()` guard as a confident **"NIH 0th pct"** — a scarlet letter on exactly the
   recent trials a rapid review is looking for. **Reject null BEFORE coercing, never after.**

4. **The abstract is at `article.publicationAbstract.abstractTexts[]`** — camelCase, while every
   sibling on `article` (`articletitle`, `authorlist`, `meshheadinglist`) is lowercase. There is no
   naming strategy to reason about; it is a fact to copy. The obvious guess parses cleanly, throws
   nothing, and yields **50 records with 0 abstracts**: a screening pass over titles alone, which
   reads plausible and is worthless.

5. **`sort=date` is a silent no-op at NCBI.** Verified against a `bogus_value` control: identical
   idlist. The documented key is `pub_date`, and the tool maps it. Unrecognised sort keys are
   *ignored*, not rejected — so a sort control that does nothing looks exactly like one that works.

6. **Not every `[MeSH]` term is a topic.** `Humans[MeSH]` harvested into the WCM expert panel makes
   it answer "who here publishes on humans?" — everyone, ranked by output. And the panel's regex
   matched only `[MeSH]`, so Mode 2's `[majr]` terms (`Depression[majr]`) were **never harvested at
   all**: the panel was ranking on probiotics with the clinical topic missing entirely.

7. **Errors are invisible if you toast them.** Nothing mounts a `ToastContainer` on this page. Use
   inline error state. Same for "Copy" confirmations.

8. **`h1` is pinned app-wide** — `globals.css` has `h1 { font-size: 28px !important }` to beat
   Bootstrap. A module class cannot override it.

## Running it locally

```bash
# Retrieval tool. MUST be built from feature/pubmed-sort-retmax, or sort/retmax are silently
# ignored and Mode 2 prints "by most relevant" over an unranked slice.
cd ~/Dropbox/GitHub/ReCiter-PubMed-Retrieval-Tool
git checkout feature/pubmed-sort-retmax
JAVA_HOME=$(/usr/libexec/java_home -v 17) mvn package -Dtest='!ReCiterPubmedApiLoadTest' -DfailIfNoSpecifiedTests=false
java -jar target/reciter-pubmed-retrieval-tool-1.1.0.jar --server.port=8083

cd ~/worktrees/pm-literature-ui && PORT=3000 npm run dev
# login paa2013  ->  sidebar  ->  Literature Search
```

`ReCiterPubmedApiLoadTest` fails in a plain `mvn package` and it is **not your change**: it targets
`localhost:5000`, which on macOS is answered by AirPlay Receiver with a 403. Exclude it (above) or
turn AirPlay off.

**`check:literature` can fail with `pubmed retrieval tool HTTP 502`. Re-run it before you debug it.**
It fired once on 2026-07-13 and passed clean on an immediate re-run — NCBI throttling, surfacing as
a 502 rather than as the fake zero of bug #1 above. This is the *good* failure mode: loud, not a
lie. Do not add a retry to paper over it; a 502 that fails the check is the check working.

`.env.local`: `RECITER_PUBMED_API_URL=http://localhost:8083`, `AWS_REGION=us-east-1`,
`BEDROCK_MODEL_ID=us.anthropic.claude-opus-4-8`, `LITERATURE_SEARCH_CWIDS=paa2013`, and the two
`BEDROCK_USD_PER_MTOK_*` rates once you have actually looked them up.

**Login lands on `/curate/paa2013`, which errors — ignore it.** That page calls the ReCiter backend
on reciter-dev, which rejects our API key. Literature Search touches none of it.

## Loose ends, small

- **`PUBMED_API_KEY` should be rotated.** It was printed into a session transcript on 2026-07-13 by
  a careless `echo`. It is an NCBI E-utilities key — low sensitivity, free to reissue at
  https://account.ncbi.nlm.nih.gov/settings/ — but rotate it anyway. It *is* set locally and the
  tool does read it (`PubmedXmlQuery.java:68`, `System.getenv`), which lifts NCBI from 3/s to 10/s.
  Confirm it is set **on the pod** too, or Modes 2-3 will trip the unkeyed limit under real use.
- ~~**`NARROW_ABOVE = 200` is duplicated**~~ **DONE (`5656230`).** `RECORD_CAP` and `NARROW_ABOVE`
  now live in `literatureSearch.strategy.ts` and are imported by both sides; the controller
  re-exports them so `check.js` and the API route keep their single import site. The values did
  agree, so this closed the latent drift rather than a live bug.
- `probe-latency.mjs` sits untracked in the worktree. It is how the 2.3s / 28.9s / 47.1s latency
  numbers were measured, and it costs a real Bedrock call to run. Delete it or keep it; it is not
  committed.

## Permanently out of scope

Dual independent screening, full-text screening, PRISMA flow diagrams, risk-of-bias, GRADE,
meta-analysis. Covidence and Rayyan do all of this and the SR team trusts them. **We hand off; we do
not compete.** Any ticket that starts to rebuild one of these is a signal the feature has drifted.
