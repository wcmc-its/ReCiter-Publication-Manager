# Requirements: PubMed Search Improvements

**Defined:** 2026-03-15
**Core Value:** PubMed search results should only show articles the curator hasn't already acted on, and should help curators quickly identify relevant matches for the person being curated.

## v1 Requirements

Requirements for this release. Each maps to roadmap phases.

### Duplicate Filtering

- [ ] **DEDUP-01**: PubMed search results exclude articles already accepted for the curated person
- [ ] **DEDUP-02**: PubMed search results exclude articles already rejected for the curated person
- [ ] **DEDUP-03**: PubMed search results show pending (suggested) articles with an inline "Pending" badge and evidence score

### Filter Persistence

- [ ] **FILT-01**: Active filter remains applied after accepting an article in filtered PubMed search results
- [ ] **FILT-02**: Active filter remains applied after rejecting an article in filtered PubMed search results

### Author Matching

- [ ] **MATCH-01**: Curated person's name and known name variants are highlighted in PubMed search result author lists
- [ ] **MATCH-02**: Hovering over a highlighted author name shows a stacked list of all their PubMed affiliations

## v2 Requirements

### Enhanced Matching

- **MATCH-03**: Highlight matching based on additional identity signals (e.g., known co-authors, department)
- **MATCH-04**: Show ReCiter identity affiliations alongside PubMed affiliations for comparison

### Search UX

- **SRCH-01**: Save recent PubMed searches for quick re-execution
- **SRCH-02**: Batch accept/reject from PubMed search results

## Out of Scope

| Feature | Reason |
|---------|--------|
| Matching against all ReCiter identities | Complexity not justified — only curated person matters |
| Hiding pending articles entirely | Curator needs to see them with context (badge + score) |
| Modifying ReCiter PubMed proxy API | Client-side filtering sufficient, avoids upstream changes |
| Changes to Suggested/Accepted/Rejected tabs | Work scoped to PubMed search only |
| PubMed search outside curation page | No use case identified |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| DEDUP-01 | — | Pending |
| DEDUP-02 | — | Pending |
| DEDUP-03 | — | Pending |
| FILT-01 | — | Pending |
| FILT-02 | — | Pending |
| MATCH-01 | — | Pending |
| MATCH-02 | — | Pending |

**Coverage:**
- v1 requirements: 7 total
- Mapped to phases: 0
- Unmapped: 7 (awaiting roadmap)

---
*Requirements defined: 2026-03-15*
*Last updated: 2026-03-15 after initial definition*
