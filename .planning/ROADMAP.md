# Roadmap: PubMed Search Improvements

## Overview

Two phases deliver the complete PubMed search improvement. Phase 1 fixes the core curation loop: hiding already-acted-on articles, badging pending ones, and preserving filter state across accept/reject actions. Phase 2 layers on author identification by highlighting the curated person's name variants and exposing PubMed affiliations on hover. Together they transform PubMed search from a raw results list into a curation-aware, identity-aware tool.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Search Result Filtering** - Hide acted-on articles, badge pending ones, and preserve filter state after curation actions
- [ ] **Phase 2: Author Identification** - Highlight the curated person's name in search results and show PubMed affiliations on hover

## Phase Details

### Phase 1: Search Result Filtering
**Goal**: Curators see only actionable PubMed search results, with pending articles clearly marked and filters stable across accept/reject actions
**Depends on**: Nothing (first phase)
**Requirements**: DEDUP-01, DEDUP-02, DEDUP-03, FILT-01, FILT-02
**Success Criteria** (what must be TRUE):
  1. A curator searching PubMed from a curation page does not see articles they have already accepted for that person
  2. A curator searching PubMed from a curation page does not see articles they have already rejected for that person
  3. Pending (suggested) articles appear in PubMed search results with a visible "Pending" badge and their evidence score
  4. After accepting or rejecting an article while a filter is active, the filter remains applied and the results update without resetting
**Plans**: TBD

Plans:
- [ ] 01-01: TBD
- [ ] 01-02: TBD

### Phase 2: Author Identification
**Goal**: Curators can visually identify the curated person in PubMed search result author lists and inspect their affiliations
**Depends on**: Phase 1
**Requirements**: MATCH-01, MATCH-02
**Success Criteria** (what must be TRUE):
  1. The curated person's name (including known name variants from ReCiter identity) is visually highlighted in every PubMed search result's author list
  2. Hovering over a highlighted author name displays a stacked list of all PubMed affiliations for that author
**Plans**: TBD

Plans:
- [ ] 02-01: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Search Result Filtering | 0/? | Not started | - |
| 2. Author Identification | 0/? | Not started | - |
