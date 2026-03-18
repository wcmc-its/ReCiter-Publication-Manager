# Phase 1: Search Result Filtering - Research

**Researched:** 2026-03-15
**Domain:** PubMed search result deduplication, pending article badging, and filter state persistence in Next.js 12 / React 16 / Redux application
**Confidence:** HIGH

## Summary

Phase 1 modifies the PubMed search tab within the curation page (`/curate/:id`). The server-side controller (`pubmed.controller.ts`) already filters out ACCEPTED and REJECTED articles via `retrieveFirstNew100PubMedArticles()`, but it does NOT filter articles with pending (unsaved) feedback, nor does it identify suggested (NULL assertion) articles in the results. The client receives PubMed results as a flat array in Redux state (`pubmedData`), and the `TabAddPublication` component renders each article via `AddPublication`. The client also has access to `reciterData.reciter.reCiterArticleFeatures` (all scored articles with their `userAssertion` and `totalArticleScoreStandardized`) and `reciterData.reciterPending` (array of PMIDs with pending feedback). Both datasets are already loaded when the curation page opens -- no new API calls are needed.

The work splits into three concerns: (1) client-side dedup of articles that the server missed (pending feedback articles, and suggested/NULL assertion articles which should show with a badge), (2) rendering a "Pending" badge with color-coded score on matched articles in `AddPublication`, and (3) preserving filter/search state across accept/reject operations in `TabAddPublication`. All changes are confined to existing components and their CSS modules -- no new pages, API routes, or Redux actions are required.

**Primary recommendation:** Modify `TabAddPublication.filter()` to cross-reference `pubmedData` PMIDs against `reciterData.reciter.reCiterArticleFeatures`, remove accepted/rejected matches (client-side dedup), and annotate pending (NULL assertion) matches with score data. Modify `AddPublication` to render a color-coded pill badge when the article has pending status. Fix `acceptPublication()`/`rejectPublication()` to not reset filter state.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Colored pill badge displayed inline, right of the article title
- Badge text format: "Pending . {score}" where score is `totalArticleScoreStandardized` rounded to whole number
- Badge background color changes based on score thresholds:
  - Green: score >= 80 (strong match)
  - Amber: score 40-79 (moderate match)
  - Red: score < 40 (weak match)
- Hover tooltip: "Already in Suggested tab / Evidence score: {score}"
- Pending articles mixed in naturally with PubMed results (no reordering/grouping)
- Accept/reject buttons work identically to new articles -- article removed from PubMed list, moved to Accepted/Rejected tab, removed from Suggested tab
- Same accept/reject flow for pending and new articles -- no special "View in Suggested" action
- Keep existing "X already accepted, Y already rejected" count banner
- Add pending count: "X already accepted, Y already rejected, Z pending"
- Active filters must remain applied after accepting or rejecting an article
- Results update without resetting search text, year filters, or pagination position

### Claude's Discretion
- Exact badge CSS implementation (Bootstrap badge classes or custom)
- Toast/confirmation behavior after accept/reject (if any)
- Animation when article is removed from results
- Client-side dedup implementation approach (comparing PMIDs from feature generator against PubMed results)

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope

</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| DEDUP-01 | PubMed search results exclude articles already accepted for the curated person | Server-side `retrieveFirstNew100PubMedArticles()` already handles this; client-side dedup in `filter()` needed as safety net for pending accepts |
| DEDUP-02 | PubMed search results exclude articles already rejected for the curated person | Server-side already handles this; client-side dedup in `filter()` needed as safety net for pending rejects |
| DEDUP-03 | PubMed search results show pending (suggested) articles with inline "Pending" badge and evidence score | Cross-reference PMIDs from `reciterData.reciter.reCiterArticleFeatures` (where `userAssertion === null` or `"NULL"`) against `pubmedData`; annotate matches; render badge in `AddPublication` |
| FILT-01 | Active filter remains applied after accepting an article in filtered PubMed search results | Fix `acceptPublication()` in `TabAddPublication` to preserve search/filter state when dispatching `UpdatePubMadeData` |
| FILT-02 | Active filter remains applied after rejecting an article in filtered PubMed search results | Fix `rejectPublication()` in `TabAddPublication` to preserve search/filter state when dispatching `UpdatePubMadeData` |

</phase_requirements>

## Standard Stack

### Core (Already in Project -- No New Dependencies)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| react | ^16.14.0 | UI rendering | Already in use |
| react-bootstrap | ^2.0.3 | Badge, OverlayTrigger, Popover components | Already used for badges (imported in ReciterTabs) and popovers (used in Publication.tsx, InferredKeywords.tsx) |
| bootstrap | ^5.1.3 | CSS utility classes (badge-* classes) | Already in use |
| redux / react-redux | ^4.1.1 / ^7.2.5 | State management | Already in use |

### No New Dependencies Required

This phase requires zero new npm packages. All UI components (Badge, OverlayTrigger, Popover) are already available from react-bootstrap. All CSS patterns exist in the project.

## Architecture Patterns

### Existing Data Flow (Do Not Change)

```
[PubMed Search Button]
    --> dispatch(pubmedFetchData(query))
    --> POST /api/reciter/search/pubmed
    --> pubmed.controller.ts::searchPubmed()
        --> Fetches PubMed count, then articles
        --> Calls getPublications() to get feature generator data
        --> retrieveFirstNew100PubMedArticles() filters out ACCEPTED/REJECTED
        --> formatPubmedSearch() transforms to client format
    --> Redux: PUBMED_CHANGE_DATA --> pubmedData updated
    --> TabAddPublication useEffect([pubmedData]) fires --> filter() called
    --> filter() produces filteredPublications + paginatedPublications
    --> publications.paginatedPublications.map() renders AddPublication components
```

### Pattern 1: Client-Side PMID Cross-Reference (for DEDUP-01, DEDUP-02, DEDUP-03)

**What:** In `TabAddPublication.filter()`, after receiving `pubmedData`, look up each PMID in `reciterData.reciter.reCiterArticleFeatures` to find matches. Hide accepted/rejected matches; annotate suggested (NULL) matches with score.

**When to use:** Every time `filter()` runs (which happens on mount, on pubmedData change, and on search text change).

**Implementation approach:**

```typescript
// Inside TabAddPublication.filter(), before the main filtering loop:

// Build a lookup map from feature generator data for O(1) lookups
const featureMap = new Map();
if (reciterData?.reciter?.reCiterArticleFeatures) {
  reciterData.reciter.reCiterArticleFeatures.forEach((article) => {
    featureMap.set(article.pmid, {
      userAssertion: article.userAssertion,
      score: article.totalArticleScoreStandardized,
    });
  });
}

// Also account for pending feedback PMIDs
const pendingPmids = new Set(reciterData?.reciterPending || []);

// Then in the forEach over pubmedData:
// 1. Skip if featureMap has ACCEPTED/REJECTED for this PMID (client-side dedup)
// 2. If featureMap has NULL/undefined assertion for this PMID,
//    annotate publication with: { isPending: true, pendingScore: score }
// 3. Count pending matches for the banner
```

**Key insight:** The server already does ACCEPTED/REJECTED filtering, but the client-side dedup is needed because:
- After accepting/rejecting in the PubMed tab, the article is removed from `pubmedData` via `UpdatePubMadeData` -- but if the user re-triggers `filter()` without a new search, the original `pubmedData` from Redux might still contain articles that were accepted in the same session
- The `reciterPending` array tracks PMIDs with unsaved feedback (accepted/rejected via UI but not yet committed to gold standard). These should also be excluded.

### Pattern 2: Article Annotation via Object Extension (for DEDUP-03)

**What:** Attach `isPending` and `pendingScore` properties to publication objects in the filtered results, so `AddPublication` can render the badge without additional lookups.

**Why this approach:**
- The `AddPublication` component receives `item` prop -- adding properties to it is the simplest way to pass badge data
- Avoids adding new Redux state or prop drilling
- Consistent with how the codebase already mutates/extends publication objects (see `acceptPublication()` line 109: `Object.assign(publication, {...})`)

```typescript
// In filter(), when a PMID matches a NULL-assertion feature generator article:
const featureData = featureMap.get(publication.pmid);
if (featureData && (featureData.userAssertion === 'NULL' || featureData.userAssertion === null)) {
  publication.isPending = true;
  publication.pendingScore = featureData.score;
}
```

### Pattern 3: Badge Rendering with Bootstrap + OverlayTrigger (for DEDUP-03)

**What:** In `AddPublication`, check `item.isPending` and render a color-coded pill badge with a hover tooltip.

**Existing pattern to follow:** The project already uses `OverlayTrigger` with `Popover` in `Publication.tsx` (line 603-615) for score tooltips. Use the same pattern. The project also already imports `Badge` from react-bootstrap in `ReciterTabs.tsx` (though currently unused).

```tsx
// In AddPublication, after the title <strong> tag:
{item.isPending && (
  <OverlayTrigger
    trigger={["focus", "hover"]}
    overlay={
      <Popover id={`pending-badge-${item.pmid}`}>
        <Popover.Body>
          Already in Suggested tab / Evidence score: {item.pendingScore}
        </Popover.Body>
      </Popover>
    }
    placement="right"
  >
    <Badge
      pill
      bg=""
      className={
        item.pendingScore >= 80 ? 'pending-badge-green' :
        item.pendingScore >= 40 ? 'pending-badge-amber' :
        'pending-badge-red'
      }
    >
      Pending &middot; {Math.round(item.pendingScore)}
    </Badge>
  </OverlayTrigger>
)}
```

### Pattern 4: Filter State Preservation (for FILT-01, FILT-02)

**What:** After accept/reject, the filter state must not reset.

**Current problem:** When `acceptPublication()` or `rejectPublication()` in `TabAddPublication` dispatches `UpdatePubMadeData(updatedpubs)`, this triggers `PUBMED_CHANGE_DATA` in Redux, which triggers the `useEffect([pubmedData])` on line 182-191, which calls `filter()`. This re-filtering works correctly -- it re-reads `pubmedSearch`, `latestYear`, `earliestYear` from component state. **The filter state is already preserved** because those state variables are not reset during accept/reject.

**However**, there is a subtlety: `filter()` is called with no arguments on line 191 (`filter()`), but on line 78 it's called with `filterState` (`filter(filterState ? filterState : "")`). The `filter()` function signature expects a `search` parameter. When called without arguments, `search` is `undefined`, which means the text filter in the Filter component (the `handleFilterUpdate` callback) will NOT be preserved on re-render.

**The fix:** Ensure `filter()` in the `useEffect` on pubmedData change passes the current search text:

```typescript
useEffect(() => {
  // ... existing pubSearchFilters restoration ...
  filter(search)  // Pass current search state, not undefined
}, [pubmedData])
```

### Anti-Patterns to Avoid

- **Do NOT modify `pubmed.controller.ts` server-side filtering:** The requirements doc explicitly says "Modifying ReCiter PubMed proxy API" is out of scope. All new filtering is client-side.
- **Do NOT create new Redux actions/reducers for pending state:** The data is already available in `reciterData.reciter.reCiterArticleFeatures`. Adding new Redux state would be unnecessary complexity.
- **Do NOT store badge data in Redux:** Annotate it on the filtered publication objects in `filter()`. This is ephemeral UI state.
- **Do NOT re-order or group pending articles:** The decision says "mixed in naturally with PubMed results (no reordering/grouping)."

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Tooltip on badge | Custom CSS tooltip | `OverlayTrigger` + `Popover` from react-bootstrap | Already used in Publication.tsx; handles positioning, accessibility, event binding |
| Pill badge | Custom `<span>` with border-radius | `Badge pill` from react-bootstrap | Already imported in ReciterTabs.tsx; handles pill shape, consistent sizing |
| PMID lookup | Nested loop (O(n*m)) | `Map` for O(1) lookup | The `retrieveFirstNew100PubMedArticles()` already uses nested loops and is slow; use a Map for the client-side version |

## Common Pitfalls

### Pitfall 1: Score Range Mismatch
**What goes wrong:** The CONTEXT.md says "Score range is 0-100" and defines thresholds at 80/40, but the existing code's tooltip says `totalArticleScoreStandardized` is on a "1-10" scale (see Publication.tsx line 608). The feature generator config has `totalStandardizedArticleScore: 3` as a minimum threshold, which makes sense for a 1-10 scale but not a 0-100 scale.
**Why it happens:** Possible confusion between `totalArticleScoreStandardized` (1-10 scale) and some other percentage-based score.
**How to avoid:** During implementation, log a few actual `totalArticleScoreStandardized` values to confirm the range. If the range is indeed 1-10, the badge thresholds need adjustment (e.g., green >= 8, amber 4-7.9, red < 4), or the score needs to be multiplied by 10 to present on a 0-100 scale. **This must be confirmed before implementation.**
**Warning signs:** All badges showing as "red" (< 40) because scores are actually 1-10.

### Pitfall 2: Metadata Objects in pubmedData Array
**What goes wrong:** The `pubmedData` array contains publication objects PLUS two metadata objects appended at the end: `{acceptedPubMedCount: N}` and `{rejectedPubMedCount: N}` (see `formatPubmedSearch()` lines 199-200 in pubmed.controller.ts). If these are not handled, the PMID cross-reference will attempt to process them and fail or produce incorrect counts.
**Why it happens:** The server appends count metadata as array elements instead of using a separate response field.
**How to avoid:** The existing `filter()` already handles this -- it checks `if (publication && publication.pmid)` on line 239. Keep this guard. When building the feature map cross-reference, only process items that have a `pmid` property.
**Warning signs:** Errors about accessing properties on undefined, or incorrect publication counts.

### Pitfall 3: `filter()` Called Without Search Argument
**What goes wrong:** `filter()` is called from `useEffect` on line 179 and 191 without the `search` argument, making it `undefined`. The Filter component's text search state (`search`) is maintained in component state but not passed when `filter()` is triggered by `pubmedData` changes.
**Why it happens:** The `search` state variable is set by `handleFilterUpdate` but the `useEffect` that responds to `pubmedData` changes calls `filter()` bare.
**How to avoid:** Always pass `search` to `filter()` in the `useEffect`. This is the key fix for FILT-01 and FILT-02.
**Warning signs:** After accepting/rejecting, the inline filter text clears even though the input still shows the text.

### Pitfall 4: Mutation of pubmedData Objects
**What goes wrong:** Adding `isPending` and `pendingScore` properties to publication objects that are referenced from Redux state (`pubmedData`) mutates Redux state directly. While the existing code already does this (see `acceptPublication()` line 107: `publication.evidence = []`), it can cause subtle re-render issues.
**Why it happens:** Objects in the `pubmedData` array are references, and modifying them mutates the Redux store without going through a reducer.
**How to avoid:** Since the existing codebase already mutates these objects freely (the pattern is established), follow the same pattern. If issues arise, create shallow copies of the publication objects before annotating. But do not break from the established pattern unnecessarily.
**Warning signs:** Stale badge data after navigation, or badges persisting after they should be gone.

### Pitfall 5: Accept/Reject From PubMed Tab Updating Wrong Tab Counts
**What goes wrong:** When accepting a pending article from PubMed results, it should be removed from both the PubMed results AND the Suggested tab count. The `updatePublicationAssertion()` callback from `ReciterTabs` handles this for the tab counts, but the `tabType` passed from `TabAddPublication` is `"AddPub"` (the tab's eventKey), not `"NULL"` (the suggested tab value).
**Why it happens:** The `prevUserAssertion` parameter in `updatePublicationAssertion()` is used to find which tab to decrement. For PubMed search results, `tabType` is `"AddPub"`, which won't match any of the filtered data tabs (NULL, ACCEPTED, REJECTED).
**How to avoid:** For pending articles accepted/rejected from PubMed search, also update the "NULL" (Suggested) tab's count and data. The `prevUserAssertion` for pending articles should be `"NULL"` (to remove from Suggested), and for new articles it should remain as the current `props.tabType`. Alternatively, when a pending article is accepted/rejected, call `updatePublicationAssertion` with `prevUserAssertion="NULL"` instead of `props.tabType`.
**Warning signs:** Suggested tab count does not decrease when accepting a pending article from PubMed search.

## Code Examples

### Example 1: Building a PMID Feature Map

```typescript
// Build once per filter() call, reuse for all publications
const buildFeatureMap = (reciterData) => {
  const map = new Map();
  const features = reciterData?.reciter?.reCiterArticleFeatures;
  if (features && features.length > 0) {
    features.forEach((article) => {
      map.set(article.pmid, {
        userAssertion: article.userAssertion,
        score: article.totalArticleScoreStandardized,
      });
    });
  }
  return map;
};
```

### Example 2: Badge Color Logic

```typescript
// Score thresholds per CONTEXT.md decisions
// NOTE: Verify actual score range before implementation (see Pitfall 1)
const getBadgeClass = (score: number): string => {
  if (score >= 80) return 'pending-badge-green';
  if (score >= 40) return 'pending-badge-amber';
  return 'pending-badge-red';
};
```

### Example 3: CSS for Badge (in AddPublication.module.css)

```css
/* Custom badge colors -- Bootstrap 5 badge with pill + custom bg */
.pendingBadgeGreen {
  background-color: #28a745 !important;
  color: #fff;
  font-size: 11px;
  font-weight: 600;
  margin-left: 8px;
  vertical-align: middle;
  cursor: default;
}
.pendingBadgeAmber {
  background-color: #ffc107 !important;
  color: #212529;
  font-size: 11px;
  font-weight: 600;
  margin-left: 8px;
  vertical-align: middle;
  cursor: default;
}
.pendingBadgeRed {
  background-color: #dc3545 !important;
  color: #fff;
  font-size: 11px;
  font-weight: 600;
  margin-left: 8px;
  vertical-align: middle;
  cursor: default;
}
```

### Example 4: OverlayTrigger Pattern (from existing Publication.tsx)

```tsx
// Source: src/components/elements/Publication/Publication.tsx lines 603-615
<OverlayTrigger
  trigger={["focus", "hover"]}
  overlay={(
    <Popover id="keyword-information">
      <Popover.Body>
        {/* tooltip content */}
      </Popover.Body>
    </Popover>)} placement="right">
    {/* trigger element */}
</OverlayTrigger>
```

### Example 5: Accepting a Pending Article (Modified Flow)

```typescript
// In acceptPublication(), detect if article is pending
const isPendingArticle = featureMap.get(id)?.userAssertion === 'NULL' ||
                          featureMap.get(id)?.userAssertion === null;

// For the updatePublicationAssertion callback:
// If pending article, prevUserAssertion should be "NULL" to update Suggested tab
// If new article, prevUserAssertion remains props.tabType
const prevAssertion = isPendingArticle ? "NULL" : props.tabType;
props.updatePublicationAssertion(pubmedPublications[0], "ACCEPTED", prevAssertion);
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Server-only dedup in `retrieveFirstNew100PubMedArticles()` | Server + client-side dedup with pending article annotation | This phase | Catches edge cases server misses; shows pending context |
| No pending article indication in PubMed search | Color-coded pill badge with score and tooltip | This phase | Curators can identify already-suggested articles at a glance |
| Filter resets on accept/reject | Filter persists across operations | This phase | Curators maintain workflow context |

## Files to Modify

| File | Changes | Reason |
|------|---------|--------|
| `src/components/elements/TabAddPublication/TabAddPublication.tsx` | Modify `filter()` to cross-reference PMIDs, count pending, pass search to useEffect | DEDUP-01, DEDUP-02, DEDUP-03, FILT-01, FILT-02 |
| `src/components/elements/AddPublication/AddPublication.tsx` | Add Badge + OverlayTrigger for pending articles | DEDUP-03 |
| `src/components/elements/AddPublication/AddPublication.module.css` | Add badge color classes | DEDUP-03 |
| `src/components/elements/TabAddPublication/TabAddPublication.module.css` | Possibly adjust banner styling for 3rd count | DEDUP-03 |

## Open Questions

1. **Score Range Confirmation**
   - What we know: The existing UI tooltip says "Standardized score (1-10)". The feature generator config uses `totalStandardizedArticleScore: 3` as a minimum.
   - What's unclear: The CONTEXT.md says "Score range is 0-100" and defines thresholds at 80/40. These are contradictory.
   - Recommendation: During implementation (Wave 0), log actual `totalArticleScoreStandardized` values from `reciterData.reciter.reCiterArticleFeatures` to confirm the range. If 1-10, either multiply by 10 for display or adjust thresholds to 8/4. If somehow 0-100, use the thresholds as-is. The user should be informed of the discrepancy.

2. **`greaterThan100` Flag Behavior**
   - What we know: When PubMed returns >100 results, the server truncates to 100 and sets `greaterThan100: true`. The client shows "Showing the first 100 records".
   - What's unclear: After client-side dedup removes some articles, should the count message reflect the post-dedup count or the original 100?
   - Recommendation: Show post-dedup count. The existing `allPubs` calculation already uses `filteredPublications.length`, so this should work naturally.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | None -- no test infrastructure exists in this project |
| Config file | none -- see Wave 0 |
| Quick run command | N/A |
| Full suite command | N/A |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DEDUP-01 | Accepted articles excluded from PubMed results | manual-only | Manual: search PubMed, verify accepted articles hidden | N/A |
| DEDUP-02 | Rejected articles excluded from PubMed results | manual-only | Manual: search PubMed, verify rejected articles hidden | N/A |
| DEDUP-03 | Pending articles show badge with score | manual-only | Manual: search PubMed, verify badge appears with correct color | N/A |
| FILT-01 | Filter persists after accept | manual-only | Manual: apply filter, accept article, verify filter remains | N/A |
| FILT-02 | Filter persists after reject | manual-only | Manual: apply filter, reject article, verify filter remains | N/A |

**Justification for manual-only:** This project has no test framework, no test configuration, and no test files. The components use `@ts-nocheck`, rely heavily on Redux store state, and make real API calls. Setting up Jest + React Testing Library + a mock Redux store for these specific components would be a significant effort that exceeds the scope of this 5-requirement phase. The requirements are best validated through manual testing against a running dev server with real data.

### Sampling Rate
- **Per task commit:** Manual visual verification against running dev server
- **Per wave merge:** Full manual walkthrough of all 5 requirements
- **Phase gate:** All 5 requirements verified manually before `/gsd:verify-work`

### Wave 0 Gaps
None -- manual testing only for this phase. No test infrastructure to set up.

## Sources

### Primary (HIGH confidence)
- **Codebase analysis** -- Direct reading of all files listed below:
  - `src/components/elements/TabAddPublication/TabAddPublication.tsx` -- main PubMed search component, filter logic, accept/reject handlers
  - `src/components/elements/AddPublication/AddPublication.tsx` -- article row renderer
  - `controllers/pubmed.controller.ts` -- server-side dedup in `retrieveFirstNew100PubMedArticles()`
  - `controllers/featuregenerator.controller.ts` -- feature generator data shape, `reciterPendingData` construction
  - `src/pages/api/reciter/feature-generator/[uid].ts` -- API response shape (`reciter`, `reciterPending`)
  - `src/pages/api/reciter/search/pubmed.ts` -- PubMed search API route
  - `src/redux/actions/actions.js` -- `pubmedFetchData`, `UpdatePubMadeData`, `reciterUpdatePublication`
  - `src/redux/reducers/reducers.js` -- `pubmedData`, `reciterData` reducers
  - `src/redux/methods/methods.js` -- action type constants
  - `src/components/elements/CurateIndividual/ReciterTabs.tsx` -- tab structure, `updatePublicationAssertion`
  - `src/components/elements/Publication/Publication.tsx` -- existing OverlayTrigger/Popover/Badge patterns
  - `src/utils/filterPublications.js` -- existing filter utility (reference for search text matching)
  - `types/publication.d.ts` -- TypeScript type definitions for Publication
  - `package.json` -- dependency versions

### Secondary (MEDIUM confidence)
- react-bootstrap v2.0.3 Badge component API -- `pill` prop, `bg` prop for background variants
- Bootstrap 5.1.3 badge classes -- standard color utilities

### Tertiary (LOW confidence)
- `totalArticleScoreStandardized` score range -- existing code says 1-10 but CONTEXT.md says 0-100. Needs runtime verification.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- no new dependencies, all components already in project
- Architecture: HIGH -- direct codebase analysis, every file read and data flow traced
- Pitfalls: HIGH -- identified through code reading, especially the metadata objects in pubmedData array, filter() argument issue, and tab count update edge case
- Score range: LOW -- contradictory information between existing code and user decisions

**Research date:** 2026-03-15
**Valid until:** 2026-04-15 (stable -- no external dependencies or fast-moving APIs involved)
