// One canonical spelling for a person identifier (CWID / netid / external cohort id).
//
// ReCiter keys every person by an exact uid string in DynamoDB, while reciterdb's MySQL
// compares case-insensitively. So `Abl9002` and `abl9002` are two people in ReCiter and one
// duplicated person in `person`, and `ggi9001 ` (trailing space) is a third. PM re-created
// such keys itself: logins whose admin_users row carried the typed case, reject-others
// writes, feedback-log rows. Every write boundary now converts the uid on the way in
// instead of trusting it:
//
//   1. trim surrounding whitespace;
//   2. lowercase, EXCEPT external-cohort ids (usc_, fh_, fredhutch_, ucsf_, ucdavis_, ...),
//      whose ReCiter keys are mixed case on purpose (fredhutch_Rachel.Rau) and must not move;
//   3. reject only what is still not an identifier after that: empty, inner whitespace, '@'
//      (an email), or any character outside [a-z0-9._-] ([A-Za-z0-9._-] for cohort ids).
//
// Deliberately NOT a WCM-shape regex: Cornell netids, `_xxx` legacy ids and cohort ids must
// keep working.

// The cohort prefix must be lowercase and end in '_' -- a bare "uc" would also match real
// WCM CWIDs (uca4001, ucx9002), which must still be lowercased.
const EXTERNAL_COHORT = /^(usc|fh|fredhutch|uc[a-z]*)_/

export const CWID_MAX_LENGTH = 64

export function isExternalCohortId(trimmed: string): boolean {
    return EXTERNAL_COHORT.test(trimmed)
}

/** Trim, then lowercase unless it is an external-cohort id. Non-strings become ''. */
export function canonicalCwid(raw: unknown): string {
    if (typeof raw !== 'string') return ''
    const trimmed = raw.trim()
    return isExternalCohortId(trimmed) ? trimmed : trimmed.toLowerCase()
}

/** True when `cwid` is already canonical and an acceptable identifier. */
export function isValidCwid(cwid: unknown): boolean {
    if (typeof cwid !== 'string' || cwid === '' || cwid.length > CWID_MAX_LENGTH) return false
    if (canonicalCwid(cwid) !== cwid) return false
    return isExternalCohortId(cwid) ? /^[A-Za-z0-9._-]+$/.test(cwid) : /^[a-z0-9._-]+$/.test(cwid)
}

/** The canonical form when it is valid, otherwise null (caller answers 400 or skips + logs). */
export function parseCwid(raw: unknown): string | null {
    const c = canonicalCwid(raw)
    return isValidCwid(c) ? c : null
}

/** Route params (?uid=, /curate/[id]) arrive as string | string[]; canonicalize the first. */
export function cwidParam(raw: unknown): string | null {
    return parseCwid(Array.isArray(raw) ? raw[0] : raw)
}

/** The same person? Compares canonical forms, so `Abl9002` and `abl9002 ` match. */
export function sameCwid(a: unknown, b: unknown): boolean {
    const ca = canonicalCwid(a)
    return ca !== '' && ca === canonicalCwid(b)
}
