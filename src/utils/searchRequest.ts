// Pure helpers for Find People (/search): the list request and the hand-off to /report.
// Kept free of redux/React imports so `npm test` can load them directly.

// Largest page size on /search. A name search hands its matched CWIDs to /report only up to this
// many; above it, /report gets the facet filters alone (the person filter would be unwieldy).
export const REPORT_HANDOFF_CAP = 200;

// More tokens than this is an exact CWID list on the server (person.controller.ts findAll,
// reciterConstants.nameCWIDSpaceCountThreshold); this many or fewer is a name search.
export const CWID_LIST_THRESHOLD = 3;

// Split pasted text on any run of whitespace or commas, so a newline-separated spreadsheet column
// or a comma-separated list gives one token per person.
export function searchTokens(text: string | null | undefined): string[] {
  return (text || '').trim().split(/[\s,]+/).filter(Boolean);
}

// Every new search, filter change or pending toggle starts at the first row. `offset` is a row
// offset (identityFetchPaginatedData uses (page - 1) * limit), never a page number.
export function newSearchRequest(filters: Record<string, any>, limit: number) {
  return { filters: { ...filters }, limit, offset: 0 };
}

// findAll groups by personIdentifier, so its `count` is one row per matched person:
// [{ personIdentifier, count }, ...]. That gives every matched CWID, not only the current page.
export function matchedPersonIds(totalPersonsCount: any): string[] {
  if (!Array.isArray(totalPersonsCount)) return [];
  const ids = totalPersonsCount.map((r) => r?.personIdentifier).filter((id) => typeof id === 'string' && id);
  return Array.from(new Set(ids));
}

const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v));

// A fresh copy of the /report filter state, so no caller can mutate the reducer's initial state.
export function freshPubSearchFilter<T>(initial: T): T {
  return clone(initial);
}

// /report filter state for "Create Reports" from /search. The typed words are never sent as CWIDs:
// - a CWID list (more than CWID_LIST_THRESHOLD tokens) carries the CWIDs that matched;
// - a name search carries the matched people's CWIDs when there are at most `cap` of them,
//   otherwise only the facet filters (`capped: true`, so the UI can say so);
// - no search text carries only the facet filters.
export function reportFiltersFromSearch<T extends { filters: Record<string, any> }>(
  initial: T,
  searchFilters: Record<string, any> | null | undefined,
  matchedIds: string[],
  cap: number = REPORT_HANDOFF_CAP,
): { pubSearchFilter: T; capped: boolean } {
  const out = freshPubSearchFilter(initial);
  const f = searchFilters || {};
  if (Array.isArray(f.orgUnits) && f.orgUnits.length) out.filters.orgUnits = [...f.orgUnits];
  if (Array.isArray(f.institutions) && f.institutions.length) out.filters.institutions = [...f.institutions];
  if (Array.isArray(f.personTypes) && f.personTypes.length) out.filters.personTypes = [...f.personTypes];
  let capped = false;
  const words: string[] = Array.isArray(f.nameOrUids) ? f.nameOrUids : [];
  if (words.length) {
    const ids = Array.from(new Set(matchedIds || []));
    if (words.length > CWID_LIST_THRESHOLD || ids.length <= cap) {
      out.filters.personIdentifers = ids;
    } else {
      capped = true;
    }
  }
  return { pubSearchFilter: out, capped };
}

// True when a name search matched more people than /report can be handed (the Go button says so).
export function reportHandoffCapped(searchFilters: Record<string, any> | null | undefined, matchedCount: number, cap: number = REPORT_HANDOFF_CAP): boolean {
  const words = Array.isArray(searchFilters?.nameOrUids) ? searchFilters!.nameOrUids : [];
  return words.length > 0 && words.length <= CWID_LIST_THRESHOLD && matchedCount > cap;
}
