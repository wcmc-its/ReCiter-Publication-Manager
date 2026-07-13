// The pilot allowlist, in ONE place.
//
// LITERATURE_SEARCH_CWIDS is server-only on purpose — it is never NEXT_PUBLIC_, so the roster of
// pilot users never reaches a browser. Two callers, and they must not disagree:
//
//   - src/pages/api/literature/search.ts   THE GATE. Authoritative; returns 403.
//   - src/pages/api/auth/[...nextauth].jsx sets one boolean on the JWT so the sidebar can hide a
//                                          link that would only dead-end. Cosmetic, not a control.
//
// This file exists rather than an import from search.ts because that would drag the Bedrock SDK and
// the PubMed controllers into the auth bundle. It is deliberately dependency-free.
export function isAllowlisted(cwid: string | null | undefined): boolean {
    const allowed = (process.env.LITERATURE_SEARCH_CWIDS || '')
        .split(',')
        .map(s => s.trim().toLowerCase())
        .filter(Boolean)
    // An empty list means the pilot is closed, NOT open to everyone. Fail shut.
    if (!allowed.length || !cwid) return false
    return allowed.includes(String(cwid).toLowerCase())
}
