# Handoff — Literature Search: Modes 2 & 3 (Issue review, Clinical question)

**Mode 1 (Search strategy) is DONE and verified end to end.** This doc is about the other two
tabs. Read it before touching them, because one of them is blocked on a question nobody has
answered yet, and the other carries the highest PHI risk in the feature.

**Read first, in this order:**
1. `HANDOFF-literature-search-ui.md` — the design contract. **§3 Screen 3 & Screen 4** are the
   screens you are building; **§5** is the streaming problem; **§7** the open decisions.
2. `docs/literature-search-mockup.html` — the signed-off clickable mockup. **Screens 3 and 4 are
   the ones that matter now** (screens 1–2 are built). Open it in a browser and click through.
3. `docs/literature-search-form-mockup.html` — the form's visual system, as built.
4. `docs/DECISION-pubmed-client.md` — why we do not use the PubMed MCP server. Don't re-ask.
5. `~/Dropbox/Projects/PubMed MCP/SPEC-literature-search.md` — backend spec.

## Where things stand

Branch `feature/pm-literature-ui`, **local, unpushed, no PR**. 13 commits ahead of `origin/dev`,
of which the last 4 are today's. It is a strict descendant of `feature/pm-literature-search`
(which IS pushed) — the two collapse with a pure fast-forward whenever you want one branch.
`fix/contrast-aa-tokens` is a separate, independent branch: review it separately.

**Mode 1 works, on real Bedrock and real PubMed, driven in a browser:** build → 3 of 4 seeds →
derived miss diagnosis → a verified, priced suggested widening → one click → 4 of 4, renumbered,
and a PRISMA-S export that describes the toggled query and its actual count.

`npm run check:literature` is green and needs no LLM. **Keep it green.**

## THE BLOCKER — answer this before you build any UI

> **Does SSE survive the ingress?**

Nothing in RPM has ever held a connection open for minutes. Every other surface is
request → spinner → render. Modes 2–3 stream tool calls and then stream tokens, for minutes.

**§5 of the design contract is explicit: do not build the streaming UI until this is answered.**
If SSE does not survive the ALB / ingress, the shape becomes **polling**, and that changes the
component, the API route, and the state machine. Guessing wrong costs you the whole screen.

This is why Mode 1 shipped first and shipped alone: it makes only count calls, so it was never
blocked on this. That de-risking worked. Do not throw it away by starting Mode 2 with the UI.

**Prove it with the smallest possible thing:** one route that streams `data: tick\n\n` every
second for 90 seconds, deployed to reciter-dev, watched from a browser on the WCM network. If it
survives, build streaming. If it dies, build polling. Either way you will know in a day.

## What Modes 2–3 actually are

| Mode | Objective | Cap | Ends in | Retrieves records? |
|---|---|---|---|---|
| Search strategy | Recall | none | a strategy | **no** — counts only |
| **Issue review** | Precision. The ~30 that matter. | **50** | a synthesis | **yes** |
| **Clinical question** | Precision + evidence hierarchy | **50** | a PICO answer | **yes** |

**The 50-cap is not a setting, it is a property of the mode.** Modes 2–3 cap at 50 because the
abstracts have to fit in a context window. Mode 1 has no cap *because it does not synthesize*.
Do not "unify" these. Someone will try.

**The cap is also the cost ceiling.** It bounds how many abstracts enter the context window,
which is what actually drives the bill (§8 of the contract).

## What Mode 1 hands you for free

- **Record retrieval already works.** `POST /pubmed/query-complex/` on the retrieval tool returns
  full `PubMedArticle` JSON *including the abstract*. `seedRecords()` in
  `controllers/literatureSearch.controller.ts` already parses title / first author / year / MeSH
  out of it — copy that shape.
- **The Bedrock call.** `invoke(system, tool, user)` in the same file. InvokeModel, native
  Anthropic body, forced `tool_choice`. It is non-streaming — **Modes 2–3 will need a streaming
  variant** (`InvokeModelWithResponseStream`), which is exactly what the blocker above gates.
- **Auth.** `/api/literature/search` is the only route in RPM that gates on a real session
  (`getToken`) plus an env allowlist (`LITERATURE_SEARCH_CWIDS`). Reuse it verbatim. Do NOT fall
  back to the `NEXT_PUBLIC_...` backend-API-key shape check — it is a shape check, not auth, and
  these routes spend money.
- **The multi-database seam.** The API returns `databases: [result]` — an array. Adding Embase
  pushes an element; no consumer changes. Keep it.
- **The design system.** `LiteratureSearch.module.css`. Screens 3–4 should use the same tokens,
  cards, and buttons. Do not start a second visual vocabulary.
- **The WCM expert panel.** `findWcmExperts(mesh, 5)` works off the query's MeSH and needs no
  records at all. The mockup puts the same card on the candidates screen and the synthesis
  screen. It is already built; just render it.

## What is genuinely new, and where the traps are

### 1. Abstracts enter a context window (Modes 2–3 only)

This is the first time user-adjacent *content* is sent to a model in bulk. The cap (50) is the
guardrail. `pubmed.controller.ts` has a **100-slice** — Mode 1 sidesteps it entirely by only
counting; Modes 2–3 will meet it. Know it is there.

### 2. Screening UI (Screen 3) — the integrity argument

The mockup keeps AI-excluded records **on the page, de-emphasised, with the reason shown**.
Nothing is hidden. *The flags are suggestions; the checkbox is the human's.* That visibility is
the entire integrity argument of the mode — do not "clean it up" by hiding excluded rows.

### 3. Synthesis (Screen 4) — every claim carries its PMID

The mockup's synthesis prose links each claim to the PMID it came from, and shows **no effect
sizes**, because inventing them is precisely the failure this feature exists to prevent. The
caveat banner ("AI-assisted synthesis over the records YOU selected — verify against the
sources") is not decoration.

### 4. PHI — Clinical question is the highest-risk surface in the feature

PICO **invites** someone to paste a case. Mode 1's warning line ("do not include patient
identifiers") is necessary but almost certainly not sufficient here. **Do not build a PHI
detector** — the obvious MRN heuristic is "7–10 digit number", which fires on every 8-digit PMID.
Take this one to InfoSec *before* building, not after. Note the answer may have changed now that
inference is **Bedrock, in-account AWS** rather than `api.anthropic.com`.

## Bugs we already paid for — do not re-learn these

These all passed a clean `tsc` and were only caught by driving the page in a browser. Modes 2–3
will hit PubMed and Bedrock *harder* than Mode 1, so every one of them still applies.

1. **A ZERO FROM PUBMED IS NOT A ZERO.** `countPubmed` returned 0 for a query that reliably
   counts 64,604. A build fires a dozen counts in a burst; unkeyed NCBI allows **3 requests per
   second**; a throttled esearch comes back as a well-formed `0`, not an error — indistinguishable
   from "your strategy found nothing." Modes 2–3 will make *more* calls, including record fetches.
   `countPubmed` now retries a zero once, and `suggestFixes` refuses to publish a count that
   violates arithmetic. **Apply the same suspicion to anything you add.**
2. **NEVER ASK THE MODEL ABOUT A PAPER IT CANNOT SEE.** Asked to widen a block for a bare PMID,
   it proposed `"Bipolar Disorder"[MeSH]` to fix a *depression* miss. Given the paper's title and
   real MeSH it proposes the right line. Feed it the record, or don't ask.
3. **VERIFY THE CLAIM THE UI ACTUALLY MAKES.** We verified a suggested widening against the term
   line alone; it passed; but the paper was *also* excluded by the limits, so ticking it cost
   +531 records and still didn't retrieve it. A false promise with a price tag. Verify end to end.
4. **Errors were invisible.** The page toasts, but nothing mounts a `ToastContainer` and the
   AppLayout fallback is gated on a config key that does not exist. A 403 rendered as *nothing*.
   Use inline error state. Same for "Copy" confirmations.
5. **`h1` is pinned app-wide** — `globals.css` has `h1 { font-size: 28px !important }` to beat
   Bootstrap. A module class cannot override it. Don't fight it in a feature branch.

## Before anyone uses this in anger

- **Set `PUBMED_API_KEY` on the retrieval tool.** It is free, lifts NCBI from 3/s to 10/s, and the
  throttle **demonstrably bites today** (see bug 1). This is no longer theoretical.
- **Verify the Bedrock cost rate.** `BEDROCK_USD_PER_MTOK_IN/OUT` default to Anthropic's
  first-party list price ($5/$25), which is **not** a verified Bedrock rate. Until they are set
  from the AWS pricing page, `estUsd` in the logs lies. A Mode 1 run is ~$0.03; Modes 2–3, which
  push 50 abstracts through a context window, will be materially more.
- **Narrow the nav item, or accept it.** `LITERATURE_SEARCH_CWIDS` gates the API (authoritative),
  but the sidebar link is visible to every Superuser / Curator_All / Reporter_All, so a
  non-allowlisted user can open the page and hit a visible 403.

## Open decisions carried forward (judgment, not code)

- **Mode 1 defaults.** Limits currently default to **Any date / Any type**, which is safest for
  recall but means the first count a librarian sees is enormous. And: should a population
  ("Adults") block arrive ticked, unticked, or not emitted? Both are questions for the **SR
  librarians**, and the page is now the right thing to put in front of them.
- **How loudly do we say "this is not a systematic review tool"?** Mode 1 structurally cannot
  emit a synthesis, so the hazard is reduced. Contract §7 proposes the one-line hint under the
  mode picker (built). A first-run banner is the alternative; librarians may find it patronising.

## Running it locally

```bash
# PubMed retrieval tool. REBUILD if your jar predates the EFetch fix on origin/master —
# a stale jar 500s on every record fetch (XXE hardening rejected the DOCTYPE).
cd ~/Dropbox/GitHub/ReCiter-PubMed-Retrieval-Tool
JAVA_HOME=$(/usr/libexec/java_home -v 17) mvn -DskipTests package     # mvn works fine on JDK 17
java -jar target/reciter-pubmed-retrieval-tool-1.1.0.jar --server.port=8083

cd ~/worktrees/pm-literature-ui && PORT=3000 npm run dev
# login paa2013 / $LOCAL_DEV_PASSWORD  →  sidebar → Literature Search
```

`.env.local`: `RECITER_PUBMED_API_URL=http://localhost:8083`, `AWS_REGION=us-east-1`,
`BEDROCK_MODEL_ID=us.anthropic.claude-opus-4-8`, `LITERATURE_SEARCH_CWIDS=paa2013`.

**Login lands on `/curate/paa2013`, which errors — ignore it.** That page calls the ReCiter
backend on reciter-dev, which rejects our API key. Literature Search touches none of it.

## Suggested order

1. **Answer the SSE question** (the blocker). One dumb streaming route, deployed to dev. A day.
2. **Take Clinical question's PHI surface to InfoSec** — in parallel, it has the longest lead
   time, and the Bedrock-not-Anthropic fact may change the answer.
3. **Issue review before Clinical question.** It is the simpler of the two (narrative synthesis,
   no evidence hierarchy), it reuses Screen 3 + Screen 4 whole, and it does not invite a case
   history into a textarea. Clinical question is Issue review plus PICO plus a hazard.
4. Wire the mode picker to real state — it currently hardcodes `checked={m.ready}` with the other
   two `disabled`, because there is nothing to switch to yet.
5. Push, PR, and get Mode 1 in front of the SR librarians. **Do not let Modes 2–3 hold Mode 1
   hostage** — that was the whole point of building it first.

## Do NOT build

A DB abstraction layer (the three seams cover it), a query-translation layer, a rate limiter (the
allowlist is the guardrail), a **PHI detector** (see above), or **Export CSV** on Mode 1 — the
strategy is 8 lines and the PRISMA-S block already carries all of them (Paul, 2026-07-13).

Permanently out of scope: dual independent screening, full-text screening, PRISMA flow diagrams,
risk-of-bias, GRADE, meta-analysis. Covidence and Rayyan do all of this and the SR team trusts
them. **We hand off; we do not compete.**
