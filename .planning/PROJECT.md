# PubMed Search Improvements

## What This Is

A set of targeted improvements to the PubMed search experience within ReCiter-Publication-Manager's curation workflow. Faculty and librarians searching PubMed from the curation page encounter duplicate results, lost filter state, and no visual cues connecting search results to the person being curated. These fixes address usability gaps that slow down the curation process.

## Core Value

PubMed search results should only show articles the curator hasn't already acted on, and should help curators quickly identify relevant matches for the person being curated.

## Requirements

### Validated

<!-- Existing capabilities already working in the codebase -->

- ✓ PubMed search from curation page — existing
- ✓ Accept/reject articles from search results — existing
- ✓ Filter search results — existing
- ✓ Article detail view with evidence — existing
- ✓ Person identity lookup and profile card — existing
- ✓ Suggested/Accepted/Rejected tab management — existing

### Active

<!-- Current scope. Building toward these. -->

- [ ] Hide articles from PubMed search results that are already accepted for the curated person
- [ ] Hide articles from PubMed search results that are already rejected for the curated person
- [ ] Hide articles from PubMed search results that are pending (suggested) for the curated person
- [ ] Preserve active filter state after accepting or rejecting an article in filtered PubMed search results
- [ ] Highlight the curated person's name (and variants) in PubMed search result author lists
- [ ] Show PubMed affiliation on hover for highlighted author names

### Out of Scope

- Matching against all ReCiter identities (not just the curated person) — complexity not justified for v1
- Using ReCiter identity affiliations for hover — PubMed article data is sufficient
- Showing accepted/rejected/pending articles with status badges — user prefers hiding entirely
- Changes to the Suggested/Accepted/Rejected tabs — this work is only about PubMed search
- PubMed search outside of the curation page context

## Context

- The curation page is at `/curate/[id].tsx` with PubMed search handled by `SearchPubmed` components
- PubMed search hits `/api/reciter/searchPubmed/[query]` which proxies to ReCiter's PubMed retrieval tool
- Person's existing articles (accepted/rejected/pending) are loaded via the feature generator endpoint
- The curated person's identity (including name variants) is available from the identity endpoint
- Filter state is managed in React component state within the curation page
- This is the `dev_v2` branch, which is 70+ commits ahead of `dev`

## Constraints

- **Tech stack**: Next.js 12, React 16, no hooks beyond what React 16 supports
- **Existing patterns**: Must follow existing Redux + thunk async pattern
- **API**: PubMed search goes through ReCiter proxy — cannot modify upstream PubMed API responses
- **Performance**: Filtering duplicates must happen client-side after PubMed results return (cannot modify ReCiter API)

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Hide duplicates rather than badge them | User preference — cleaner results, less cognitive load | — Pending |
| Use PubMed affiliations for hover (not ReCiter) | Already in API response, no extra call needed | — Pending |
| Client-side duplicate filtering | Cannot modify ReCiter PubMed proxy API | — Pending |

---
*Last updated: 2026-03-15 after initialization*
