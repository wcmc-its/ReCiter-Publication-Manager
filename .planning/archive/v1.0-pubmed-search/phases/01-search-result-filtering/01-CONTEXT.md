# Phase 1: Search Result Filtering - Context

**Gathered:** 2026-03-15
**Status:** Ready for planning

<domain>
## Phase Boundary

Hide already-acted-on articles from PubMed search results, show pending (suggested) articles with a color-coded badge and evidence score, and preserve filter state after accept/reject actions. Requirements: DEDUP-01, DEDUP-02, DEDUP-03, FILT-01, FILT-02.

</domain>

<decisions>
## Implementation Decisions

### Pending article badge
- Colored pill badge displayed inline, right of the article title
- Badge text format: "Pending · {score}" where score is `totalArticleScoreStandardized` rounded to whole number
- Badge background color changes based on score thresholds:
  - Green: score >= 80 (strong match)
  - Amber: score 40-79 (moderate match)
  - Red: score < 40 (weak match)
- Hover tooltip: "Already in Suggested tab / Evidence score: {score}"

### Pending article behavior
- Pending articles mixed in naturally with PubMed results (no reordering/grouping)
- Accept/reject buttons work identically to new articles — article removed from PubMed list, moved to Accepted/Rejected tab, removed from Suggested tab
- Same accept/reject flow for pending and new articles — no special "View in Suggested" action

### Result count banner
- Keep existing "X already accepted, Y already rejected" count banner
- Add pending count: "X already accepted, Y already rejected, Z pending"

### Filter state persistence
- Active filters must remain applied after accepting or rejecting an article
- Results update without resetting search text, year filters, or pagination position

### Claude's Discretion
- Exact badge CSS implementation (Bootstrap badge classes or custom)
- Toast/confirmation behavior after accept/reject (if any)
- Animation when article is removed from results
- Client-side dedup implementation approach (comparing PMIDs from feature generator against PubMed results)

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `TabAddPublication.tsx`: Main PubMed search component — has `acceptPublication()`, `rejectPublication()`, `filter()`, `searchFunction()`
- `AddPublication.tsx`: Individual article row renderer — needs badge addition
- `pubmed.controller.ts`: Server-side filtering already removes accepted/rejected via `retrieveFirstNew100PubMedArticles()` — returns `acceptedPubMedCount` and `rejectedPubMedCount`
- `filterPublications.js`: Utility for filtering articles by assertion and search text

### Established Patterns
- Redux + thunk async pattern: FETCHING → SUCCESS/ERROR dispatch cycle
- `UpdatePubMadeData()` Redux action removes articles from `pubmedData` after accept/reject
- Accepted/rejected counts appended as last two elements of `pubmedData` array (metadata objects)
- Bootstrap/MUI styling used throughout — badge should use `badge-info`, `badge-success`, `badge-warning`, `badge-danger` classes

### Integration Points
- `reciterData.reciter.reCiterArticleFeatures` contains all person's articles with `userAssertion` and `totalArticleScoreStandardized` — cross-reference with PubMed results to identify pending articles
- `reciterData.reciterPending` contains PMIDs with pending feedback
- Feature generator already loaded when curation page opens — no extra API call needed to get scores
- PubMed API route (`/api/reciter/search/pubmed`) receives `personIdentifier` and can access feature generator data

</code_context>

<specifics>
## Specific Ideas

- Score range is 0-100 (not the raw standardized score range)
- Color coding "similar to pending" — green for strong matches, amber moderate, red weak
- Keep existing count in the PubMed search tab banner and extend it with pending count

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 01-search-result-filtering*
*Context gathered: 2026-03-15*
