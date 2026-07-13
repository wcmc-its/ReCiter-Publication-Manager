# Handoff — Literature Search: what's real, what's left

**Read first, in this order:**
1. **`docs/literature-search-mockup.html`** — the signed-off clickable mockup, saved in-repo.
2. `HANDOFF-literature-search-ui.md` — the design contract (§3 screens, §7 decisions).
3. `~/Dropbox/Projects/PubMed MCP/SPEC-literature-search.md` — backend spec.

`HANDOFF-literature-search-bedrock-local.md` is **done** and superseded by this doc.

**Status 2026-07-13 (commit `3c30446`):** Mode 1 is built to the design contract and **verified
end to end in a browser** against live PubMed and live Bedrock. The drift the previous version of
this doc catalogued is closed. What is left is judgment (§Open decisions), not code.

## What now exists

The strategy is a **live PRESS artifact**, not a printout:

```
   ☑  1  "Probiotics"[MeSH] OR "Gastrointestinal Microbiome"[MeSH] OR …
   ☑  2  probiotic*[tiab] OR synbiotic*[tiab] OR psychobiotic*[tiab] OR …
      3  1 OR 2
   ☑  4  "Depression"[MeSH] OR "Depressive Disorder"[MeSH] OR …
   ☑  5  depress*[tiab] OR dysthymi*[tiab] OR "low mood"[tiab] OR …
   ☐  ·  "Emotions"[MeSH] OR emotion*[tiab] OR mood[tiab] OR …
            Suggested: retrieves Sarkar (2016) · +25,139 records to screen
      6  4 OR 5
      7  3 AND 6
      8  7 AND (2021:2026[dp]) AND (Randomized Controlled Trial[pt])
```

Every atomic line has a checkbox and is **editable in place**. Changing anything re-counts the
yield and re-validates the seeds **with no model call** — `runStrategy()` is `assembleQuery` →
`countPubmed` → `validateSeeds`, so iteration costs a handful of esearch calls. A librarian can
work the strategy all afternoon for free. Debounced 300ms.

**One object, one truth.** The numbering, the Boolean, the hit count and the exported PRISMA-S
block all derive from the *current selection* via the pure functions in
`controllers/literatureSearch.strategy.ts`, which **the server and the browser both import**. The
export cannot describe a query that was not run — that was the trap, and it is closed by
construction rather than by discipline.

**Only ticked lines get numbers** (an unticked line shows `·`). Numbers renumber as you toggle,
so a line number always refers to a line that was actually searched. The alternative (stable
numbers, `5b` suffixes) is more code and buys a number that may point at nothing.

**A concept with nothing ticked drops out of the AND entirely.** It never emits `3 AND ()`. This
is the one piece of real logic in the feature and `npm run check:literature` defends it.

## What the browser taught us that typecheck could not

Three bugs shipped past a clean `tsc` and were only caught by driving the page:

1. **The suggested fix was a false promise.** The model's widening was verified against the term
   line alone (`pmid[uid] AND (terms)`) — which passed. But the paper was *also* excluded by the
   limits, so ticking the line cost **+531 records to screen and still did not retrieve it**.
   Verification now runs against the **whole strategy, limits included**, because "tick this and
   the paper comes back" is the claim the checkbox makes, so that is the claim that must be true.
2. **The miss diagnosis was half a diagnosis.** A seed can fail a concept block *and* the limits
   at once, and we only reported the block. Sarkar 2016 does exactly that — it is a 2016 review
   and the limits ask for 2021–2026 RCTs. Both causes are now derived and reported independently.
3. **The fix model was being asked to widen for a paper it had never seen.** Handed a bare PMID it
   guessed, and guessed badly: it proposed `"Bipolar Disorder"[MeSH]` to fix a *depression* miss.
   It is now shown the paper's title and the MeSH descriptors PubMed actually indexed it under
   (Sarkar is under *Emotions*), and it proposes the right line. **Never ask it blind** — if the
   seed record cannot be fetched, no fix is proposed at all.

The verify step caught (1) and (3) at runtime and dropped them, which is the design working. But
it only *proposed* nothing — the librarian would have seen a miss with no help and no idea why.

## Verified by real runs — do not re-litigate

- **Counts reproduce the PubMed web UI** because the prompt forces a field tag on every term.
  **Never relax that rule** — automatic term mapping only rewrites UNTAGGED terms.
- **`us.anthropic.claude-opus-4-8` is an ACTIVE Bedrock inference profile** (acct 665083158573,
  us-east-1). **InvokeModel, not Converse** (native Anthropic body passes through verbatim).
- **The full loop, in a browser:** build → 3 of 4 seeds → derived miss → verified, priced
  suggestion (+25,139 records) → one click → **4 of 4**, renumbered, and the exported methods
  block reports the toggled query and its 31,070 records.
- **Miss-diagnosis is derived, not guessed** (re-count the seed against each block and the limits).
- **The PubMed tool needs zero infra** to boot — no DynamoDB, no S3, no AWS.

## Two stale notes in the old handoff, now corrected

- **`mvn` works fine.** The old note said "do NOT use mvn: it runs JDK 25 and the pinned Lombok
  dies on it." The only JDK on this machine is **Temurin 17**, and `mvn -DskipTests package`
  builds the retrieval tool clean.
- **The retrieval tool's record fetch is fine on `origin/master`.** A stale local checkout
  (`435ee85`) had XXE hardening that set `disallow-doctype-decl=true`, which rejects every EFetch
  response (they all open with a `<!DOCTYPE>`). Counting still worked, so it looked like a bug in
  *this* feature. It was **already fixed upstream** — see "Fix EFetch parsing broken by XXE
  hardening" on master. **If record fetch 500s locally, your jar is stale: rebuild from
  `origin/master`.** No PR is needed and there is no prod bug.

## Running it locally

```bash
# PubMed retrieval tool. Rebuild if your jar predates the EFetch fix.
cd ~/Dropbox/GitHub/ReCiter-PubMed-Retrieval-Tool
JAVA_HOME=$(/usr/libexec/java_home -v 17) mvn -DskipTests package
java -jar target/reciter-pubmed-retrieval-tool-1.1.0.jar --server.port=8083

cd ~/worktrees/pm-literature-ui && PORT=3000 npm run dev
# login paa2013 / $LOCAL_DEV_PASSWORD  →  then go to /literature
```

`.env.local`: `RECITER_PUBMED_API_URL=http://localhost:8083`, `AWS_REGION=us-east-1`,
`BEDROCK_MODEL_ID=us.anthropic.claude-opus-4-8`, `LITERATURE_SEARCH_CWIDS=paa2013`.

**Login lands on `/curate/paa2013`, which errors — ignore it.** That page calls the ReCiter
backend on reciter-dev, which rejects our API key. Literature Search touches none of it.

`npm run check:literature` passes and needs no LLM. Keep it green — it is an integration check
against live PubMed, so it fails for real when the seed logic breaks.

## Open decisions (judgment, not code)

### A. The default limits are now a real question

The limits are two dropdowns resolved to PubMed syntax by a **server-side table**
(`buildLimits()`); the model no longer decides what "2021-2026" means. They currently default to
**Any date / Any type**. That is the safest default for recall, but it means the first count a
librarian sees is enormous (5,931 for the probiotics question, and 486,156 with the depression
block unticked). **Ask the SR librarians what should be pre-selected.**

### B. The "Adults" population block — still worth one narrow question

Ask "…in adults?" and the model sometimes emits a third **Adults** concept block and ANDs it in,
which in an earlier run excluded 3 of 4 seeds. **The toggles dissolve this as an emergency** — the
librarian unticks it and watches the seeds return. But it is still worth asking: should the
default strategy include a population block at all — ticked, unticked, or not emitted? That is a
cheap defaults question now, not a methods crisis. Do **not** change `SYSTEM_PROMPT` unilaterally.

### C. `estUsd` is not trustworthy

Rates come from `BEDROCK_USD_PER_MTOK_IN/OUT`, defaulting to Anthropic's **first-party list price**
($5/$25) — explicitly *not* a verified Bedrock rate. A real run costs ~$0.03 (two model calls:
the strategy, plus one fix per missed seed). Read the AWS Bedrock pricing page and set them.

### D. Access

`LITERATURE_SEARCH_CWIDS` gates the API (authoritative), but the **nav item is visible to every
Superuser / Curator_All / Reporter_All**, so a non-allowlisted user can open the page and hit a
visible 403. Narrow the nav item, or accept it for a 2–3 person pilot.

### E. InfoSec

Still the first RPM surface that sends user-typed text to an LLM. **It is Bedrock (in-account
AWS), not `api.anthropic.com`** — which may materially change the answer. Does not block Mode 1.

### F. Set `PUBMED_API_KEY` on the retrieval tool before anyone toggles in anger

Unkeyed NCBI is **3 requests/second**. Each toggle is 1 count for the yield + 1 per seed (+1 for
the limits check on a miss), debounced at 300ms. It has not tripped in testing, but a fast
librarian with 5 seeds will. The key lifts it to 10/s and is free.

## Deliberately NOT built

- **Export CSV.** The mockup has it; we skipped it. The strategy is 8 lines and the PRISMA-S
  block already carries every one of them plus the counts and the seed validation. A CSV of 8
  lines is a solution to no problem. Add it if a librarian asks. *(Paul, 2026-07-13.)*
- **A free-text "Edit & re-run" box.** Superseded and made unnecessary: every line is *already* an
  editable input feeding the same debounced re-count, so there is no second copy of the query to
  drift, and a bad line can only break its own block.
- A DB abstraction layer, a query-translation layer, a rate limiter (the allowlist is the
  guardrail), or a **PHI detector** — the obvious MRN heuristic is "7–10 digit number", which
  fires on every 8-digit PMID in the seeds field.

Permanently out of scope: dual independent screening, full-text screening, PRISMA flow diagrams,
risk-of-bias, GRADE, meta-analysis. Covidence and Rayyan do all of this and the SR team trusts
them. **We hand off; we do not compete.**

## Suggested next steps

1. **Show it to the SR librarians.** The code questions are answered; the remaining ones (A, B)
   are theirs, and the page is now the right thing to put in front of them.
2. Verify the Bedrock cost rate (C). Set `PUBMED_API_KEY` (F).
3. Push and open the PR. Both branches are still **local**:
   `feature/pm-literature-ui` (this work) and `fix/contrast-aa-tokens` (independent — review
   separately).
