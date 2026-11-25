// One canonical spelling for a person identifier (CWID / netid / external cohort id).
//
// ReCiter keys every person by an exact uid string in DynamoDB, while reciterdb's MySQL
// compares case-insensitively. So `Abl9002` and `abl9002` are two people in ReCiter and one
// duplicated person in `person`, and `ggi9001 ` (trailing space) is a third. PM re-created
// such keys itself: logins whose admin_users row carried the typed case, reject-others
// writes, feedback-log rows. Every write boundary now converts the uid on the way in
// instead of trusting it:
//
//   1. strip surrounding whitespace exactly as Java String.strip() does (see javaStrip);
//   2. lowercase, EXCEPT external-cohort ids (usc_, fh_, fredhutch_, ucsf_, ucdavis_, ...),
//      whose ReCiter keys are mixed case on purpose (fredhutch_Rachel.Rau) and must not move.
//      The prefix itself is matched case-insensitively and only IT is lowercased
//      (FREDHUTCH_A.B -> fredhutch_A.B);
//   3. reject only what is still not an identifier after that: empty, inner whitespace, '@'
//      (an email), any character outside [a-z0-9._-] ([A-Za-z0-9._-] for a cohort id), or a
//      bare cohort prefix with nothing after it ("usc_", "fh_", " UCLA_ ").
//
// This MUST produce the same output as ReCiter's reciter.utils.UidCanonicalizer.canonicalize
// (ReCiter #787/#789): PM writes keys ReCiter looks up byte-exact. tests/canonicalCwid.test.mjs
// carries the Java test table.
//
// Deliberately NOT a WCM-shape regex: Cornell netids, `_xxx` legacy ids and cohort ids must
// keep working.

// Same regex as Java's EXTERNAL_COHORT_PREFIX (Pattern.CASE_INSENSITIVE, ASCII-only folding;
// no `u` flag here, so JS folds ASCII only too). A bare "uc" would also match real WCM CWIDs
// (uca4001, ucx9002), which must still be lowercased; "uc_" alone is not a cohort prefix
// (uc[a-z]+), so `uc_X` lowercases like any other id.
const EXTERNAL_COHORT = /^(?:usc|fh|fredhutch|uc[a-z]+)_/i
const CANONICAL = /^[a-z0-9._-]+$/
const CANONICAL_EXTERNAL = /^[A-Za-z0-9._-]+$/

export const CWID_MAX_LENGTH = 64

// java.lang.Character.isWhitespace: Unicode space/line/paragraph separators EXCEPT the
// non-breaking ones (U+00A0, U+2007, U+202F), plus U+0009-U+000D and U+001C-U+001F.
// JS String.prototype.trim() differs both ways: it strips U+00A0, U+2007, U+202F and U+FEFF
// (Java keeps them, so the uid is invalid) and keeps U+001C-U+001F (Java strips them).
function isJavaWhitespace(c: number): boolean {
    return (c >= 0x09 && c <= 0x0d) || (c >= 0x1c && c <= 0x20) || c === 0x1680 ||
        (c >= 0x2000 && c <= 0x2006) || (c >= 0x2008 && c <= 0x200a) ||
        c === 0x2028 || c === 0x2029 || c === 0x205f || c === 0x3000
}

/** Java String.strip(): removes leading/trailing Character.isWhitespace code points. */
export function javaStrip(s: string): string {
    let i = 0
    let j = s.length
    while (i < j && isJavaWhitespace(s.charCodeAt(i))) i++
    while (j > i && isJavaWhitespace(s.charCodeAt(j - 1))) j--
    return s.slice(i, j)
}

export function isExternalCohortId(stripped: string): boolean {
    return EXTERNAL_COHORT.test(stripped)
}

/**
 * Strip, then lowercase (only the prefix of an external-cohort id). Non-strings become ''.
 * Does not validate: parseCwid / isValidCwid do.
 */
export function canonicalCwid(raw: unknown): string {
    if (typeof raw !== 'string') return ''
    const stripped = javaStrip(raw)
    const prefix = EXTERNAL_COHORT.exec(stripped)
    return prefix
        ? prefix[0].toLowerCase() + stripped.slice(prefix[0].length)
        : stripped.toLowerCase()
}

/**
 * True when `cwid` is already canonical and an acceptable identifier. Beyond the Java rule,
 * PM also caps the length at CWID_MAX_LENGTH (no real uid comes close).
 */
export function isValidCwid(cwid: unknown): boolean {
    if (typeof cwid !== 'string' || cwid === '' || cwid.length > CWID_MAX_LENGTH) return false
    if (canonicalCwid(cwid) !== cwid) return false
    const prefix = EXTERNAL_COHORT.exec(cwid)
    if (prefix) return cwid.length > prefix[0].length && CANONICAL_EXTERNAL.test(cwid)
    return CANONICAL.test(cwid)
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

/**
 * A list of uids from a request body, canonicalized and de-duplicated (first spelling wins).
 * Entries that are still not an identifier land in `invalid` for the caller to log and skip.
 */
export function parseCwidList(raw: unknown): { valid: string[]; invalid: unknown[] } {
    const valid: string[] = []
    const invalid: unknown[] = []
    for (const item of Array.isArray(raw) ? raw : []) {
        const c = parseCwid(item)
        if (c === null) invalid.push(item)
        else if (!valid.includes(c)) valid.push(c)
    }
    return { valid, invalid }
}
