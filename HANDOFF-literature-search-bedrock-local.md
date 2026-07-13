# Handoff — Literature Search: move to Bedrock, run fully local

**Read first:** `HANDOFF-literature-search-ui.md` (design + the SR reasoning) and
`~/Dropbox/Projects/PubMed MCP/SPEC-literature-search.md` (backend spec, empirical findings).
This doc covers only the **two new constraints** and what they change.

**Branch:** `feature/pm-literature-search`, based on fresh `origin/dev`. One commit: **`d75bc48`**.

## The two new constraints (2026-07-12)

1. **Must use AWS Bedrock**, not the Anthropic API directly. The committed code calls
   `api.anthropic.com` — that has to be swapped.
2. **Must not touch `reciter-dev.weill.cornell.edu`.** Another effort is using it. Everything
   has to run locally.

Both are tractable. **Local-only is genuinely possible**, and one of the two moves is free.

## What's already done and VERIFIED (do not redo)

Mode 1 ("Search strategy") is built: the deliverable is the **search strategy**, not records —
no candidate list, no screening, no synthesis, no result cap. It never retrieves a record; it
only **counts**. Files: `controllers/literatureSearch.controller.ts`,
`controllers/db/wcmExperts.controller.ts`, `src/pages/api/literature/search.ts`,
`src/components/elements/Literature/LiteratureSearch.tsx`, `src/pages/literature/index.tsx`,
plus the `SideNavbar` slice bump (6→7) and the `middleware.ts` matcher + role gate.

Verified against live PubMed and live reciterdb, not just typechecked:

- **Counts are exactly reproducible against the PubMed web UI** — 2,302 both ways, and 122 both
  ways with an RCT filter. Holds *by construction*: PubMed's automatic term mapping only
  rewrites **untagged** terms, and the system prompt requires a field tag on every term. **Do
  not relax that prompt rule — it is what makes the librarian's count reproducible.**
- **Known-item validation works, and the miss reason is DERIVED, not guessed.** `(strategy) AND
  <pmid>[uid]`, expect 1. 3 of 4 seeds retrieved; Sarkar 2016 (PMID 27793434) correctly
  attributed to the **Depression** concept block (PubMed indexes it under *Emotions*). A model
  asked to guess would most likely have blamed the date range and been wrong.
- **The MeSH expert join returns 430 faculty**, not a handful. The `LIMIT` is load-bearing and
  the panel must state the honest total.

Runnable check, still passing: **`npm run check:literature`** (`controllers/literatureSearch.check.js`).
It drives the real Retrieval Tool and asserts the seed behaviour. It needs **no** LLM — Mode 1's
verifiable half is entirely downstream of the model. **Keep it green through the Bedrock swap.**

## NOT verified (be honest about this)

- **The React UI has never rendered.** Local login 401s (below), so the page, the sidebar item,
  and the slice fix are unproven at runtime. TypeScript compiles clean; that is all.
- **The LLM call has never run.** There was no key. It is now moot — it is being replaced.

## What depends on reciter-dev (the actual blocker list)

Checked in `.env.local`:

| Var | Points at | Used by | Local fix |
|---|---|---|---|
| `RECITER_API_BASE_URL` | **reciter-dev** | `countPubmed` (via fallback) | Override — see below. **Zero code change.** |
| `RECITER_PUBMED_API_URL` | *(unset)* | — | **Set this.** It already overrides just the PubMed routes. |
| `RECITER_AUTHENTICATION_ENDPOINT` | **reciter-dev** | local login | Needs a fix — see below. |
| `RECITER_DB_HOST` | a separate **RDS** host | expert panel | *Not* reciter-dev. See open question 1. |

### Fix 1 — PubMed goes local, for free

`config/local.js:135-136` already resolves the PubMed routes as
`(RECITER_PUBMED_API_URL || RECITER_API_BASE_URL)`. That override is exactly what PRs #796–800
built. So:

```
# .env.local
RECITER_PUBMED_API_URL=http://localhost:8083
```

…and run **ReCiter-PubMed-Retrieval-Tool** locally on **8083** (its registered port; it's a
Spring Boot app at `~/Dropbox/GitHub/ReCiter-PubMed-Retrieval-Tool`). **No application code
changes at all.** Give the tool a `PUBMED_API_KEY` if you have one; without it you get NCBI's
unkeyed rate limit (fine for a pilot, and Mode 1 issues only a handful of count calls).

Sanity check once it's up — this is the whole PubMed dependency:

```bash
curl -s -X POST http://localhost:8083/pubmed/query-number-pubmed-articles/ \
  -H 'Content-Type: application/json' \
  -d '{"strategy-query":"37314797[uid]"}'     # expect: 1
npm run check:literature                       # expect: OK, 3 of 4 seeds, miss -> Depression
```

### Fix 2 — local login

`src/pages/api/auth/[...nextauth].jsx` → the `direct_login` provider calls `authenticate()`,
which posts to `RECITER_AUTHENTICATION_ENDPOINT` on **reciter-dev**, and that currently returns
**401** for `paa2013` + `LOCAL_DEV_PASSWORD` (credentials confirmed correct;
`LOGIN_PROVIDER=LOCAL`). This is the single thing blocking any UI verification.

Options, laziest first:
1. When `LOGIN_PROVIDER=LOCAL`, compare the password to `LOCAL_DEV_PASSWORD` directly and skip
   the remote `authenticate()` call entirely. That is arguably what `LOCAL` was always meant to
   mean, and it removes the last reciter-dev dependency from the auth path.
2. Reuse the local-login fix that the `pm-calm-redesign` worktree reportedly carries
   (see the `project_pm_local_dev` memory — also documents a `/noaccess` gotcha: the login form
   sends no email, but `findUserPermissions` keys on `personIdentifier AND email`).

**Do not** hack around the middleware to make the page render. Fix the login.

## Fix 3 — the Bedrock swap (the only real code change)

Contained to **one function**: `buildStrategy()` in `controllers/literatureSearch.controller.ts`.
Everything downstream (`countPubmed`, `validateSeeds`, `assembleQuery`, the derived
miss-diagnosis, the expert join, the UI) is model-agnostic and does not change.

**Use ReciterAI's working pattern — it is in production and already grounded.**
(`~/Dropbox/GitHub/ReciterAI`, e.g. `pipeline_feedback/sweep.py:268-290`.)

What ReciterAI actually does:
- `boto3.client("bedrock-runtime")`, region **`us-east-1`**
- body carries **`"anthropic_version": "bedrock-2023-05-31"`**
- **`modelId` is passed as a parameter, NOT in the body** (this is the #1 porting mistake)
- credentials come from the **default chain** — no keys in code (per the global rules)
- model IDs are **inference profiles** with a `us.` prefix

For this repo (TypeScript) that means **`@aws-sdk/client-bedrock-runtime`**. Note
`@aws-sdk/client-dynamodb` is *already* in `package.json`, so AWS SDK v3 is an established
dependency family here — this is not a new ecosystem.

Sketch:

```ts
import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime'

const client = new BedrockRuntimeClient({ region: process.env.AWS_REGION || 'us-east-1' })
const res = await client.send(new InvokeModelCommand({
  modelId: process.env.BEDROCK_MODEL_ID,          // NOT in the body
  contentType: 'application/json',
  accept: 'application/json',
  body: JSON.stringify({
    anthropic_version: 'bedrock-2023-05-31',      // replaces `model` + the version header
    max_tokens: 2000,
    system: SYSTEM_PROMPT,                        // keep verbatim — the tagging rule is load-bearing
    tools: [STRATEGY_TOOL],                       // keep: forces the structured strategy
    tool_choice: { type: 'tool', name: 'submit_strategy' },
    messages: [{ role: 'user', content: prompt }],
  }),
}))
const data = JSON.parse(new TextDecoder().decode(res.body))
// same shape as the direct API: data.content -> find type === 'tool_use' -> .input
// usage: data.usage.input_tokens / output_tokens (keep the cost log line)
```

**Three things to VERIFY, not assume:**

1. **Which model is actually enabled in the account.** ReciterAI runs
   `us.anthropic.claude-opus-4-7` and `us.anthropic.claude-sonnet-4-6` — **not 4-8**. Do not
   assume `claude-opus-4-8` has Bedrock model access in this account/region. List what's
   enabled and pick from that. Put it in `BEDROCK_MODEL_ID`; never hardcode.
   *(Paul has ruled out Fable 5 for now.)*
2. **That `tool_choice` is honoured on the chosen Bedrock path.** Forcing the tool call is what
   guarantees a structured strategy. If it misbehaves on InvokeModel, the **Converse API**
   (`ConverseCommand` + `toolConfig`) is the alternative. Confirm before trusting the parse.
3. **Cost-log rates.** `search.ts` hardcodes $5/$25 per Mtok for Opus. Update to the rate of
   whichever model you land on, or the `estUsd` field lies.

Also rename `anthropicConfigured()` → `bedrockConfigured()` and drop `ANTHROPIC_API_KEY` from
the 503 guard; the route should now check that `BEDROCK_MODEL_ID` is set (credentials come from
the chain, so their absence surfaces as a runtime error, not a config check).

Locally you'll need AWS creds in the default chain (SSO/profile) with `bedrock:InvokeModel`.
On EKS this becomes an IAM role — and note the `reciter-pm` service account / IRSA gap flagged
in the `project_provenance_curation_history` memory may bite here too.

## Env vars, final state

```
RECITER_PUBMED_API_URL=http://localhost:8083   # local retrieval tool; keeps us off reciter-dev
BEDROCK_MODEL_ID=<an inference profile actually enabled in the account>
AWS_REGION=us-east-1
LITERATURE_SEARCH_CWIDS=paa2013                # pilot allowlist (already added to .env.local)
# ANTHROPIC_API_KEY — DELETE. Superseded by Bedrock.
```

## Open questions for Paul

1. **Is the dev RDS off-limits too, or only `reciter-dev.weill.cornell.edu`?** `RECITER_DB_HOST`
   is a *separate* RDS endpoint, and the expert panel makes one read-only query against it. If
   that's also out, note the panel **already fails soft** — `search.ts` wraps it in try/catch and
   never fails the strategy over it — so Mode 1 works without it. No code change needed to
   proceed; you just lose the panel locally.
2. **Which model** should Mode 1 use, from those actually enabled in Bedrock?

## Suggested order for the next session

1. Start the local PubMed Retrieval Tool on 8083, set `RECITER_PUBMED_API_URL`, confirm
   `npm run check:literature` still passes. **This severs the reciter-dev PubMed dependency with
   zero code change** and proves the environment before anything else moves.
2. Fix local login (Fix 2). Until this works, no UI can be verified.
3. Swap `buildStrategy()` to Bedrock (Fix 3). Re-run the check — it must stay green, since it
   does not depend on the model.
4. **Finally do the runtime verification that never happened:** load `/literature`, confirm the
   sidebar shows Literature Search and that the slice bump didn't swallow *Manage Profile*, and
   drive a real strategy build end to end.
