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

## THE ONE THING TO DO BEFORE ANYONE TRUSTS A COST NUMBER

**`estUsd` in the logs is currently fiction.** `BEDROCK_USD_PER_MTOK_IN` / `_OUT` default to **5 /
25**, which is Anthropic's *first-party list price* for Opus 4.8 — **not** a verified AWS Bedrock
rate. Every `estUsd` figure in this doc and in the pod logs inherits that assumption, including the
~$0.49/run headline. It may be right. Nobody has checked.

This matters more than it looks: Mode 2 costs roughly **16× Mode 1** ($0.49 vs $0.03), because 50
abstracts pass through a context window three times. That ratio is what will be asked about the
moment this graduates past a two-person pilot, and answering it with a number nobody verified is
how a pilot loses its budget.

**Get the real rate — do not guess, and do not read it off a blog post:**

1. The rate is a function of **the model ID and the region**, which is exactly why it is an env var
   and not a constant. We are on `BEDROCK_MODEL_ID=us.anthropic.claude-opus-4-8` in `us-east-1`.
   Note the `us.` prefix: that is a **cross-region inference profile**, and inference profiles can be
   priced differently from the base model. Price the profile you actually invoke.

2. Read it from AWS, not from memory. Either:
   - the Bedrock pricing page for **us-east-1**, on-demand, for that exact model; or
   - the API, which is the auditable answer:
     ```bash
     aws pricing get-products --region us-east-1 --service-code AmazonBedrock \
       --filters 'Type=TERM_MATCH,Field=regionCode,Value=us-east-1' \
       --query 'PriceList' --output text | grep -i opus
     ```
     (`aws pricing` only lives in `us-east-1` and `ap-south-1` — that region flag is the endpoint,
     not the thing being priced.)

3. Set both vars wherever the pod gets its env (the K8s secret alongside `LITERATURE_SEARCH_CWIDS`),
   **and locally in `.env.local`**, so a dev run and a prod run agree.

4. **Then reconcile.** The cost log already emits `model` on every line precisely so a past `estUsd`
   can be recomputed against a rate discovered later. Take one real `literature-search` log line,
   multiply its `inputTokens`/`outputTokens` by the true rate, and confirm the new `estUsd` matches.
   If it does not, the arithmetic in `logCost()` is wrong, not the rate.

Until that is done, treat every dollar figure as **unverified**, and say so out loud to anyone who
asks. Do not put a cost meter in front of a librarian either way — iteration is the behaviour we
want, and a running meter teaches them to ration it.

## Also before this meets a real user

- **Mode 3 → InfoSec.** Unchanged and still the long pole. PICO invites someone to paste a case
  history into a textarea, and it is the only surface in the feature with a real PHI story. The
  radio is disabled in the UI; leave it disabled. Note the answer may differ now that inference is
  **Bedrock, in-account AWS**, not `api.anthropic.com` — that is a materially different data-flow
  question and worth re-asking with that fact up front. **Do NOT build a PHI detector**: the obvious
  MRN heuristic is "a 7-10 digit number", which fires on every 8-digit PMID in the seeds field.

- **The nav item is wider than the API gate.** `LITERATURE_SEARCH_CWIDS` gates the route
  (authoritative), but the sidebar link renders for every Superuser / Curator_All / Reporter_All, so
  a non-allowlisted user can open the page and hit a visible 403. Narrow the nav, or accept it and
  make the 403 read like a waiting list rather than an error.

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
- **`NARROW_ABOVE = 200` is duplicated**, once in the controller and once in `LiteratureSearch.tsx`,
  because a *value* import from the controller would drag the Bedrock SDK into the client bundle.
  Its proper home is `literatureSearch.strategy.ts` (pure, already value-imported by the client).
  Same story as `RECORD_CAP`/`CAP`. The server is the one that enforces the boundary, so the
  duplication is cosmetic — but it will rot.
- `probe-latency.mjs` sits untracked in the worktree. It is how the 2.3s / 28.9s / 47.1s latency
  numbers were measured, and it costs a real Bedrock call to run. Delete it or keep it; it is not
  committed.

## Permanently out of scope

Dual independent screening, full-text screening, PRISMA flow diagrams, risk-of-bias, GRADE,
meta-analysis. Covidence and Rayyan do all of this and the SR team trusts them. **We hand off; we do
not compete.** Any ticket that starts to rebuild one of these is a signal the feature has drifted.
