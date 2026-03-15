---
phase: 1
slug: search-result-filtering
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-15
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | None — no test infrastructure exists in this project |
| **Config file** | none — manual testing only |
| **Quick run command** | Manual: visual verification against running dev server |
| **Full suite command** | Manual: full walkthrough of all 5 requirements |
| **Estimated runtime** | ~5 minutes (manual walkthrough) |

---

## Sampling Rate

- **After every task commit:** Manual visual verification against running dev server (`npm run dev`)
- **After every plan wave:** Full manual walkthrough of all 5 requirements
- **Before `/gsd:verify-work`:** Full walkthrough must pass all criteria
- **Max feedback latency:** ~60 seconds (page refresh + manual check)

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| TBD | 01 | 1 | DEDUP-01 | manual | Search PubMed, verify accepted articles hidden | N/A | ⬜ pending |
| TBD | 01 | 1 | DEDUP-02 | manual | Search PubMed, verify rejected articles hidden | N/A | ⬜ pending |
| TBD | 01 | 1 | DEDUP-03 | manual | Search PubMed, verify badge appears with correct color | N/A | ⬜ pending |
| TBD | 01 | 1 | FILT-01 | manual | Apply filter, accept article, verify filter remains | N/A | ⬜ pending |
| TBD | 01 | 1 | FILT-02 | manual | Apply filter, reject article, verify filter remains | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements (manual testing only).

No test framework setup needed — this project has no test configuration, no test files, and the components use `@ts-nocheck` with heavy Redux store dependencies. Setting up automated testing infrastructure exceeds the scope of this 5-requirement phase.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Accepted articles excluded from PubMed results | DEDUP-01 | No test framework; requires live API + Redux store + feature generator data | 1. Open curation page for a person with accepted articles. 2. Search PubMed for a term matching an accepted article. 3. Verify the accepted article does NOT appear in results. |
| Rejected articles excluded from PubMed results | DEDUP-02 | No test framework; requires live API + Redux store + feature generator data | 1. Open curation page for a person with rejected articles. 2. Search PubMed for a term matching a rejected article. 3. Verify the rejected article does NOT appear in results. |
| Pending articles show badge with score | DEDUP-03 | No test framework; requires live API + feature generator scores | 1. Open curation page for a person with suggested (pending) articles. 2. Search PubMed for a term matching a suggested article. 3. Verify "Pending · {score}" badge appears with correct color (green/amber/red). 4. Hover badge — verify tooltip shows "Already in Suggested tab / Evidence score: {score}". |
| Filter persists after accept | FILT-01 | No test framework; requires UI interaction sequence | 1. Search PubMed. 2. Apply a text filter. 3. Accept an article. 4. Verify filter text remains in input and results stay filtered. |
| Filter persists after reject | FILT-02 | No test framework; requires UI interaction sequence | 1. Search PubMed. 2. Apply a text filter. 3. Reject an article. 4. Verify filter text remains in input and results stay filtered. |

---

## Validation Sign-Off

- [ ] All tasks have manual verify instructions
- [ ] Sampling continuity: manual check after every task commit
- [ ] Wave 0 covers all MISSING references (N/A — no Wave 0)
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s (manual page refresh)
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
