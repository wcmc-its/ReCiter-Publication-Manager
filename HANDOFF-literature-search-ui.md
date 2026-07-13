# Handoff — Literature Search UI

**Purpose:** Build the UI for the Literature Search feature. Backend spec is `~/Dropbox/Projects/PubMed MCP/SPEC-literature-search.md` — read it first; it has the locked decisions, the verified data sources, and the API shape. This doc covers **presentation only**.

**Premise:** This is a new surface, but not a new design language. The "calm" system (Inter + navy) is already the house style on `/curate`, `/authorships`, `/search`, `/report`. Conform to it. Nothing here justifies inventing a new visual vocabulary.

## 0. Read this before you branch

**Do NOT branch off `feature/pm-scopus-api-url`** — it predates the calm redesign. **And do NOT branch off `dev_Upd_NextJS14SNode18`** — an earlier version of this doc called it canonical; that is stale. The July dev rebuild made **`origin/dev`** the deployed branch for reciter-dev (recovery waves #801–#813 deployed and verified there, #814/#815 merged since), while `dev_Upd` froze at PR #768 — with a `package.json` still on Next 12, despite the branch name.

```
git fetch origin
git checkout -b feature/pm-literature-search origin/dev
```

**Stack reality check (verified on `origin/dev`, 2026-07-12):** Next **14.2.35**, next-auth **4.24.13**, React **18.2.0**, pages router. `useSession()` returns `{ data, status }` — the v4 shape. Older handoffs in this repo say Next 12 / next-auth 3 / React 16; on `origin/dev` that is **obsolete**. (It is still literally true on `dev_Upd` — one more reason not to branch there.)

## 1. The calm system (conform, don't reinvent)

Source of truth is `styles/globals.css :root` on **`origin/dev`**. Do not hardcode hexes — use the tokens.

**`STYLEGUIDE.md` did not survive the dev rebuild** — it exists only on stale `dev_Upd`. Read it with `git show origin/dev_Upd_NextJS14SNode18:STYLEGUIDE.md`; where it disagrees with `globals.css` on `origin/dev`, the CSS wins. Re-landing it in your PR is cheap and worth doing.

| Role | Token / value |
|---|---|
| Font | **Inter**, `var(--font-sans)` — loaded via `<link>` in `_document.tsx` |
| Page bg / cards | `#f5f2ee` warm bg · `--color-surface` `#ffffff` |
| Borders | `--color-border` · card border is **0.5px solid #e8e2d9**, radius **6px** (`--radius-md`) |
| Text | ink `#1a2133` · muted `#5a6478` · hint `#8a94a6` |
| Accent | `--color-accent` `#2563a8` · `--color-accent-soft` `rgba(37,99,168,0.1)` |
| Chrome | `--color-chrome` `#1a2133` (one navy) |
| Semantic tints | success `#dcfce7`/`#166534` · danger `#fee2e2`/`#991b1b` · warning `#fef3c7`/`#92400e` |
| Section headers | 11px / 600 / UPPERCASE / 0.1em tracking / `#8a94a6` · **no gray fill** |
| Buttons | soft-tint-at-rest → solid-on-hover · font-weight **400 or 600 only** |
| Confirmations | react-toastify (already wired) |

## 2. What the feature actually is

Three modes. **The mode is not a template — it is a retrieval objective**, and SR search and narrative search are opposite philosophies. Build the UI around that or it will fight you.

| Mode | Objective | Cap | Ends in | Retrieves records? |
|---|---|---|---|---|
| **Search strategy** | **Recall.** Thousands of hits is success. | **None** | A handoff | **No** |
| **Issue review** | **Precision.** The ~30 that matter. | 50 | A synthesis | Yes |
| **Clinical question** | **Precision + evidence hierarchy.** | 50 | An answer | Yes |

**Mode 1's deliverable is the search strategy itself — not records, not a synthesis.** This is the correction that matters most, and an earlier draft of this doc got it wrong. For a systematic review, the strategy *is* the librarian's intellectual output: PRESS-peer-reviewed by another librarian, published as the PRISMA-S appendix, and the thing that makes the review reproducible. Records, screening, and synthesis belong to the review team and to Covidence/Rayyan/EndNote, which they already trust. **We hand off. We do not compete, and we must not appear to.**

So Mode 1 has **no candidate list, no screening checkboxes, no AI include/exclude flags, and no synthesis.** It outputs: a numbered concept-block Boolean per database, hit count per database, date run, limits applied, **known-item validation**, and a copyable **PRISMA-S methods block**. That's it. It is a much smaller screen than the one this doc used to describe.

The cap is a **property of the mode, not a global setting.** Mode 1 has none *because it does not synthesize* — no abstracts enter a context window, so there is nothing to protect. Modes 2–3 cap at 50 because the abstracts must fit.

**Known-item validation is not optional.** The librarian names 3–5 papers that *must* be retrieved (they always have these — they're the papers that prompted the review). We report hit/miss for each. Without it, the failure mode is a model emitting a confident, plausible Boolean that silently misses half the literature with no way for anyone to tell. This is the single feature that makes an LLM-drafted strategy defensible in front of a serious SR team. Give it real estate.

It is **not** called "Systematic review" — a deliberate decision (see spec). But naming alone was never going to protect us, which is why Mode 1 now structurally *cannot* emit a synthesis.

Every mode also shows a **WCM expert panel** — the faculty who publish on those MeSH terms. That panel is the reason this feature lives in RPM instead of being a bookmark to claude.ai. It is not a garnish; give it real estate. It works in Mode 1 too, off the *query's* MeSH terms, with no records needed.

### Build for Embase/Scopus without building Embase/Scopus

Phase 1 is PubMed-only. **Do not build a database abstraction layer** — that is an interface with one implementation. Three seams make a second database additive, and they cost nothing now:

1. **The query artifact is an array, not a string** — `[{ db, query, hits, runDate }]`, an array of one. Every component renders a *list*. Adding Embase pushes an element and no consumer changes.
2. **Records carry `sourceDb` and a DOI** (Modes 2–3 only, but the slots exist day one).
3. **Hit counts render per database, not per sub-query** — `PubMed 37` today, `PubMed 37 · Embase 52 · Scopus 41` later. PRISMA-S wants it this way regardless.

There is **no query-translation layer, ever** — the model writes a native query per database from the original question, rather than translating MeSH into Emtree.

## 3. Screens (PROPOSED — needs sign-off, see §7)

**Clickable mockup:** https://claude.ai/code/artifact/e6eb6fb8-9f87-4bd0-92eb-cd28d4f4f77d — all four screens rendered in the calm system, stepping through the flow, with each §7 proposal visible rather than described. Review there first; the ASCII below is the fallback.

The wireframes in `RPM-PubMed-Integration-Proposal.md` predate the locked decisions and show a one-step "Systematic review." Ignore them. These reflect what was actually decided.

### Screen 1 — Search form

```
┌──────────────────────────────────────────────────────────────────┐
│  Literature Search                                               │
│                                                                  │
│  MODE                                                            │
│  (•) Search strategy   ( ) Issue review   ( ) Clinical question  │
│      recall · no cap       precision · 50     precision · 50     │
│      → strategy, no synth  → synthesis        → PICO answer      │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  What do you want to know?                                 │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                  │
│  DATABASES  [✓] PubMed   [ ] Embase (soon)  [ ] Scopus (soon)   │
│                                                                  │
│  [Search-strategy mode only]                                     │
│  KNOWN-ITEM SEEDS  — papers this search MUST retrieve            │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  PMID or DOI, one per line                                 │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                  │
│  INCLUSION / EXCLUSION CRITERIA (optional — shapes the query)     │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  e.g. RCTs only; adults; validated depression scales        │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                  │
│  Date [2021 – 2026 ▾]   Pub type [RCT + Meta ▾]                  │
│  (no Max — SR search is uncapped by design)                      │
│                                                                  │
│                                       [ Build strategy ]         │
└──────────────────────────────────────────────────────────────────┘
```

Mode changes the form. **Known-item seeds appear only in Search-strategy mode** and are the input to validation. **The `Max` dropdown is gone from this mode** — an SR search is uncapped by design; it reappears for Issue review / Clinical question. Filters are convenience sugar; the model can express all of them in the Boolean.

The **Databases** checklist ships with Embase/Scopus visible but disabled. That is deliberate: it sets the expectation, and it forces the array-shaped query artifact (§2) rather than letting a scalar sneak in.

### Screen 2 — The strategy (Search-strategy mode — this IS the deliverable)

There is no "Running" screen in this mode. It makes a handful of *count* calls and returns in seconds.

```
┌──────────────────────────────────────────────────────────────────┐
│  Literature Search  ›  Search strategy                           │
│                                                                  │
│  ┌── PUBMED ──────────────────────────── 1,247 records ───────┐  │
│  │  1  "Gastrointestinal Microbiome"[MeSH] OR "Probiotics"…   │  │
│  │  2  probiotic*[tiab] OR synbiotic*[tiab] OR "gut micro"…   │  │
│  │  3  1 OR 2                                                 │  │
│  │  4  "Depression"[MeSH] OR "Depressive Disorder"[MeSH]      │  │
│  │  5  depress*[tiab] OR "mood disorder*"[tiab]               │  │
│  │  6  4 OR 5                                                 │  │
│  │  7  3 AND 6                                                │  │
│  │  8  7 AND (2021:2026[dp])                                  │  │
│  │                                    [ Copy ] [ Edit & re-run ] │
│  └────────────────────────────────────────────────────────────┘  │
│      Run 12 Jul 2026 · limits: 2021–2026, English                │
│                                                                  │
│  ┌── EMBASE ─────────────────────────────── not searched ─────┐  │
│  │  Add Embase to search all three. (coming soon)             │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                  │
│  KNOWN-ITEM VALIDATION                          3 of 4 retrieved │
│  ✓ Nikolova 2023   PMID 37285127                                 │
│  ✓ Chahwan 2024    PMID 38122489                                 │
│  ✓ Wallace 2021    PMID 34210795                                 │
│  ✗ Sarkar 2016     PMID 27793434   ← NOT retrieved. Widen.       │
│    └ likely cause: published 2016, outside your 2021–2026 limit  │
│                                                                  │
│           [ Copy PRISMA-S methods block ]   [ Export CSV ]       │
└──────────────────────────────────────────────────────────────────┘
```

**The miss is the most valuable thing on this screen.** Style it as a finding, not an error — danger tint, but calm. Give the model's guess at *why* it missed, because that is what tells the librarian how to widen. A strategy that retrieves 4 of 4 seeds is signed off; one that misses is broken and the librarian now knows where.

Numbered concept blocks, not one long string — that is how strategies are peer-reviewed (PRESS) and published.

**Per-database counts, never per-sub-query counts.** The old draft showed `q1 12 · q2 12 · q3 3 · q4 22`; that was sub-queries within PubMed and it hard-codes the single-database assumption into the UI.

### Screen 3 — Candidates + screening (Issue review ONLY — not Search strategy)

```
┌──────────────────────────────────────────────────────────────────┐
│  Literature Search  ›  Candidates                                │
│                                                                  │
│  QUERY  ("Gastrointestinal Microbiome"[MeSH] OR …)   [Copy][Edit]│
│  PubMed 37                                                       │
│                                                                  │
│  ☑ 12 included   ☐ 25 excluded                  [Synthesize 12]  │
│  ────────────────────────────────────────────────────────────────│
│  ☑  Nikolova et al. (2023)  JAMA Psychiatry            PMID …127 │
│     Acceptability, Tolerability… Probiotics as Adjunctive        │
│     ⬤ RCT   N=49   HAMD-17, GAD-7                                │
│                                                                  │
│  ☐  Liu et al. (2024)  Nature Communications           PMID …445 │
│     Immunoregulatory role of the gut microbiota…                 │
│     ⬤ Observational    ⚑ Excluded: preclinical, not a human RCT  │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

Screening flags are **AI-suggested and pre-ticked, but the librarian decides.** Show the model's exclusion *reason* inline (the ⚑ line). Never hide a record because the AI excluded it — that's the whole integrity argument. Excluded rows stay visible, de-emphasised.

This screen is the honest home of scoping and rapid reviews. **It must never appear in Search-strategy mode** — if it does, we are pretending to do screening for a systematic review, which is the exact failure this redesign exists to prevent.

### Screen 4 — Synthesis + WCM experts

```
┌──────────────────────────────────────────────────────────────────┐
│  Literature Search  ›  Synthesis                                 │
│                                                                  │
│  ⚠ AI-assisted synthesis over the 12 records YOU selected.       │
│    Verify against the sources. Every claim links to its PMID.    │
│                                                                  │
│  SUMMARY TABLE                                                   │
│  │ Study     │ Yr │ Design │ N    │ Intervention  │ Effect │     │
│  │ Nikolova  │'23 │ RCT    │ 49   │ Multi-strain  │ 0.70   │     │
│  │ …                                                             │
│                                                                  │
│  SYNTHESIS                                                       │
│  Probiotics show moderate evidence for reducing depression       │
│  (SMD −0.44 to −0.79) in clinical populations [PMID 37285127]…   │
│                                                                  │
│  ┌── AT WEILL CORNELL ────────────────────────────────────────┐  │
│  │ 6 faculty publish on these topics                          │  │
│  │  Eric Pamer          —                          40 pubs    │  │
│  │  Randy Longman       Gastroenterology (Med)     20 pubs    │  │
│  │  Iliyan Iliev        Gastroenterology (Med)     20 pubs    │  │
│  │  3 of your 12 selected records are WCM-authored            │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                  │
│  Provenance: 12 of 37 screened in by {cwid} on {date}            │
│                            [Export CSV]  [Copy Markdown]         │
└──────────────────────────────────────────────────────────────────┘
```

## 4. Reuse, don't rebuild

| Need | Use |
|---|---|
| Page shell | `pages/report/index.js` pattern — `Page.getLayout = (page) => <AppLayout>{page}</AppLayout>` |
| Export button + modal | `src/components/elements/Report/ExportModal.tsx` — takes `title` + `buttonsList`, already handles loading/limit states |
| CSV writing | `exceljs`, **client-side**, as in `Report/SearchSummary.tsx` (`workbook.csv.writeBuffer()` → Blob → `link.download`). Already a dependency. `xlsx.writeBuffer()` is a one-line swap if Excel is wanted |
| Toasts | react-toastify, already wired |
| Cards / buttons / section headers | Whatever `/curate` and `/authorships` use — copy the class names, don't re-derive |

## 5. The genuinely new UI problem: a multi-minute streaming response — **Modes 2–3 only**

**Mode 1 does not need this section.** It only ever calls `query-number-pubmed-articles` — one count per database, then one count per known-item seed (`(strategy) AND <pmid>[uid]`, expect 1). A handful of cheap count calls, back in seconds, no records, no abstracts. **Mode 1 can therefore ship first, and it ships even if SSE turns out to be impossible.** Build it first for exactly that reason: it de-risks the whole feature and it is the mode the SR group actually wants.

For Modes 2–3: nothing in RPM has ever held a connection open for minutes. Every other surface is request → spinner → render. These stream tool calls and then stream tokens.

**Backend blocker — confirm before you build the streaming UI.** The spec's first task is proving SSE survives the ingress. If it doesn't, the shape becomes polling. **Do not build the streaming UI until that's answered** — but note this no longer blocks the whole feature, only Modes 2–3.

Assuming it works, the UX principle is *narrate the tool calls, then stream the prose*:

1. **Strategy built** — show the Boolean immediately, copyable and editable. Never bury it behind a spinner.
2. **Searching** — "PubMed 37 records." Counts, not a barber pole.
3. **Screening** — determinate progress (n/37) if the model reports per-record, indeterminate if not.
4. **Synthesis** — stream tokens into the prose block.

An indeterminate spinner for two minutes will read as a hang and people will refresh. Every phase needs a visible, changing number.

## 6. Wiring gotchas (both will bite silently)

**Nav** — `src/components/elements/Navbar/SideNavbar.tsx` (line refs are `origin/dev`). `menuItems` is a flat array rendered as `.slice(0, 6)` under "Navigation" (`:367`) and `.slice(6)` under "Admin" (`:397`). **Those indices are hardcoded.** Current order: Find People, Curate Publications, Authorships, Create Reports, Manage Notifications, Manage Profile │ Manage Users, Configuration. Insert Literature Search at index 4 (after Create Reports) and bump both slices to `slice(0, 7)` / `slice(7)` — otherwise the Admin section silently swallows Manage Profile. Icons are hand-rolled inline SVGs at `:10-20`.

`allowedRoleNames` proposed default: **Superuser, Curator_All, Reporter_All** — librarians hold Reporter_All today. Confirm with Paul before shipping.

**Middleware** — `src/middleware.ts` on `origin/dev` is the older **role-cascade** version (the `ROUTE_PERMISSIONS` refactor exists only on stale `dev_Upd` — don't copy patterns from there). Two changes, both required:

1. Add `/literature/:path*` to the `matcher` array — without this the route gets **no guard at all**.
2. Add an explicit role block modeled on the `/authorships` gate — the matcher alone only requires *a session*, and any logged-in role walks in. This route spends institutional money per call; gate it to the same roles as the nav item.

## 7. Open design questions — proposed answers, awaiting Paul's veto

Per the project's standing UI rule these don't ship unconfirmed — but each now has a concrete proposed default, so sign-off is one word per line instead of five design sessions.

1. **Nav label and icon.** Propose **"Literature Search"** — two-word Title Case like every sibling (Find People, Curate Publications, Create Reports). Icon: an open book in the existing 16×16 stroke-1.5 `NavIcon` idiom, defined next to the others at `SideNavbar.tsx:15-20`:

   ```tsx
   const IconLiterature = () => <NavIcon><path d="M8 4C6.7 2.9 4.8 2.5 2.5 2.5v10c2.3 0 4.2.4 5.5 1.5 1.3-1.1 3.2-1.5 5.5-1.5v-10C11.2 2.5 9.3 2.9 8 4z"/><path d="M8 4v10"/></NavIcon>;
   ```

2. **WCM expert panel placement.** Propose a **main-column card, not a right rail** — the same card on the strategy screen (off the query's MeSH terms), the candidates screen, and above the provenance line on synthesis. Rationale: no RPM surface has a right rail, so a rail is new layout vocabulary (the §premise says conform); the panel has no content until a search runs, so a persistent rail is an empty box on Screen 1; and at laptop widths a rail beside the 220px drawer would crush the content. The panel earns its weight by recurring, not by new chrome.

3. **Mode picker in results.** Propose the form **collapses to a read-only summary bar** — `Search strategy · "probiotics for depression…" · PubMed 1,247 · [New search]`. Changing mode mid-flight would invalidate the run, so mode changes go through **New search** (fresh start, question prefilled). One page, phase state, no sub-routes.

4. **Editable query.** Propose **ship both Copy and Edit-and-re-run in v1**, where re-run pins the edited query verbatim (the system prompt is told: use this exact query, do not rewrite it) and **re-runs the known-item validation against it**. That last part is what makes editing safe: the librarian widens the Boolean, and the seed check immediately tells them whether the widening actually caught the missing paper. Query iteration is the librarian's core loop; copy-only forces a round trip through PubMed proper for every refinement.

5. ~~**Result ceiling.**~~ **RESOLVED — the question dissolved.** It was posed as a global setting, and it isn't one: the cap is a property of the mode. Search-strategy mode has **no cap at all** because it doesn't synthesize (no abstracts, no context window, nothing to protect) and because SR searches are *designed* to over-retrieve — a 5,000-record yield is a success, not an error state. My earlier "refuse above 200" answer would have made the tool refuse to run on essentially every real systematic-review search. Issue review and Clinical question keep a 50-cap and best-N retrieval, because they synthesize and the abstracts must fit.

6. **NEW — how prominent is the "not for systematic reviews" boundary?** Mode 1 now structurally cannot emit a synthesis, so the hazard is much reduced. But an SR team with this in their sidebar may still assume more than it does. Options: (a) trust the structure, no copy; (b) a one-line hint under the mode label — *"produces a search strategy; screen and synthesize in Covidence"*; (c) a dismissible first-run note. **Propose (b)** — it's honest, it costs one line, and it names the handoff rather than just disclaiming. Ask the SR librarians which they'd want; they may find (c) patronising.

## 8. Verification

Use **Playwright MCP `browser_snapshot`** (accessibility tree, ~2-3k tokens), not screenshots (20k+). Screenshot only for genuine pixel comparison. Do not run both for the same check.

Describe exactly what changed and ask Paul to verify visually before moving on.

## 9. Out of scope

**Permanently, not "phase 2":** dual independent screening, full-text screening, PRISMA flow diagrams, risk-of-bias (RoB 2 / ROBINS-I), GRADE, meta-analysis. Covidence and Rayyan do all of this and the SR team already trusts them. **We hand off; we do not compete.** Any ticket that starts to rebuild one of these is a signal the feature has drifted.

**Deferred, cheap to add if asked:** RIS/NBIB record export (the team re-runs natively and exports from PubMed today, which is more trustworthy than records through our API); a 10-record result preview in Mode 1; cross-database dedup (their reference manager produces the "after duplicates removed" figure on import).

**Deferred, ordinary:** PDF export (browser print covers it), saved searches (a new table costs three schema changes — prod reciterDB, dev reciterDB, and the ReCiterDB repo), Author-Attributed mode, usage dashboards, per-user cost caps.

## 10. Build order

1. **Mode 1, PubMed only.** No streaming needed (count calls only), so it is not blocked on the SSE question. Ships the thing the SR group actually wants, on the three multi-database seams from §2.
2. **Verify count parity** — run 2–3 real strategies through our E-utilities path and through the PubMed web UI and compare the totals. If they diverge, we present ours as a sanity-check yield rather than the number of record. This lands directly on Mode 1's core promise, so do it early.
3. **Prove SSE through the ingress** (hello-world route). Only then build Modes 2–3.
4. **Second database** — Scopus is already plumbed and proves the array shape; Embase is the one that matters for Cochrane.

**Running in parallel, not in this sequence:** the InfoSec review in §11. It has a longer lead time than the code and it does **not** block step 1 — see below.

## 11. Access, cost, and data handling

### 11.1 Access — an env allowlist for the pilot, not a new role

Roles in RPM are DB rows: `admin_role` (`roleID`, `roleLabel`), joined through `admin_users_role`. So a proper `Librarian` role costs a row in **prod reciterDB, dev reciterDB, AND the ReCiterDB repo schema** (the standing three-places rule), plus a middleware role check and an `allowedRoleNames` entry. That is the right end state and a lot of ceremony for two people.

**For the pilot, use an env allowlist:**

```
LITERATURE_SEARCH_CWIDS=paa2013,xyz1234
```

Checked in the API route (authoritative) and used to show/hide the nav item (cosmetic). Zero schema changes, zero migration risk, membership changes by editing a K8s secret.

```ts
// ponytail: env allowlist, not a role. Promote to an admin_role row + middleware
// gate when this graduates past the librarian pilot. Ceiling: membership changes
// need a deploy, which is fine for 2-3 people and not fine for 20.
```

**Do not reuse `Reporter_All`.** It is a broad population, and this is the first route in RPM that **spends institutional money per call** — granting it to everyone who can run a report over-grants a budget, not just a feature.

### 11.2 Overuse — the allowlist is the guardrail

Three named librarians cannot produce runaway spend. Beyond that:

- **The `Max` cap on Modes 2–3 is the per-call cost ceiling.** It bounds how many abstracts enter the context window, which is what actually drives the bill. Already designed in.
- **Mode 1 is pennies.** It reasons over counts, never abstracts.
- **Disable the submit button while a request is in flight.** Free, and it kills the rage-click double-submit — the realistic accident, as opposed to the imagined abuser.

**Do NOT build a rate limiter.** For three trusted users it is speculative, and RPM has no Redis or job store to hang one on, so it would mean a new table. Add it when the cost log says you need it.

### 11.3 Cost — log it server-side; never show the librarian a meter

The Anthropic API returns token usage on every response. Emit **one structured log line per call** — mode, cwid, input/output tokens, computed cost — and grep the pod logs. No table, no dashboard, no UI.

**Do not put a dollar figure in front of the librarian.** Query iteration (edit → re-run → widen → re-validate) is precisely the behaviour we want, and a running meter teaches them to ration it. That is the wrong incentive. If in-product cost visibility is wanted later, it belongs in an admin view, not the search page.

### 11.4 PHI / PII — the third party is the issue, not the content

**The tempting wrong answer is "PubMed accepts any query, so who cares."** Half of that is right; the wrong half matters.

*Right:* a literature search is not inherently PHI. Librarians are not clinicians, do not handle patients, and are among the most privacy-trained staff in the building. The odds of PHI actually being typed are low.

*Wrong:* **the issue is the new third party, not the content.** RPM today sends queries to NLM/NIH. This feature would, for the first time, send user-typed free text to a commercial LLM vendor. That is a vendor and data-flow question that exists **whether or not a single character of PHI is ever entered.**

**Therefore:**

1. **WCM InfoSec review is a real gate, and it is a parallel workstream, not a build task.** Start it now — it has a longer lead time than the code. Confirm what data-retention terms apply to the specific API key RPM will use (zero-retention and BAA terms exist on enterprise agreements — *verify what ours is actually under*, do not assume).
2. **Do NOT build a PHI detector.** Two reasons, and the first is specific to this app:
   - The obvious MRN heuristic is "a 7–10 digit number." **The known-item seeds field is full of 8-digit PMIDs.** A naive detector fires on every legitimate SR search.
   - Names are undetectable in principle. Nothing distinguishes "Nikolova" the author from "Nikolova" the patient.
   - Net: false positives that block real work, false negatives that manufacture false comfort.
3. **What to actually do**, all cheap and all real:
   - **Never persist the query.** We are not building saved searches anyway, so exposure stays bounded to the API call itself. Do not log query text alongside the cost line.
   - **One honest line at the input**: the query goes to an external AI service; do not include patient identifiers. This is the control that operates at the moment of risk.
   - **Scope the pilot to named librarians.** A small, trained, accountable population is a stronger control than any regex.

### 11.5 The risk phasing falls out for free

The PHI surface is not evenly distributed across the modes:

| Mode | PHI surface | Note |
|---|---|---|
| **Search strategy** | **Essentially none** | A *topic* query. This is what the SR group wants and what ships first. |
| **Issue review** | Low | Also a topic query. |
| **Clinical question** | **Highest** | PICO invites someone to paste a case. (PICO is *Population*, not *Patient* — but a rushed user may not honour the distinction.) |

**So the InfoSec review does not block the thing you most want to ship.** If InfoSec gets nervous, ship Search strategy and Issue review, and hold Clinical question until they are comfortable.
