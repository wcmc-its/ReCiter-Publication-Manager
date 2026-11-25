// authorship_review.note is APPEND-ONLY: `case "assign"`'s local_only branch appends
// LOCAL_ONLY_MARKER when the assignee has no ReCiter identity (#925), and
// reconcile-local-only-assigns.mjs appends RECONCILED_MARKER once an identity has since
// appeared and the promised gold-standard write actually lands. Nothing ever removes or
// rewrites a prior marker — the note is a running audit trail, so a row can carry either marker
// more than once. Pure and dependency-free ONLY so both the note text and the read of it are
// directly assertable (scripts/check-local-only-marker.mjs) without a DB — same reasoning as
// assignGate.ts. PM#949: this is now the SHARED contract between the writer (`case "assign"`),
// the reader (`case "reopen"`, which used to infer local-only from a live identity check instead
// of the note it was sitting right next to), and the reconciler script.
//
// Because the note is append-only, "is this row STILL local-only" cannot be answered by "does
// the note contain RECONCILED_MARKER" — a row can cycle: local-only assign to cwid A
// (LOCAL_ONLY) -> reconciled once A gets an identity (RECONCILED) -> reopened -> re-assigned
// local-only to a second no-identity cwid B (a second LOCAL_ONLY, appended after the first
// RECONCILED). At that point the note carries both markers, more than once each, and the answer
// has to be "whichever one was appended most recently" — see isLocalOnlyNote below.
export const LOCAL_ONLY_MARKER = "local record only, nothing written to the publication record";
export const RECONCILED_MARKER = "reconciled to publication record";

// Does this note carry the local-only marker at all, at any point in its history — including a
// row that has since been reconciled, or reconciled and then made local-only again. Callers that
// need "is this STILL local-only right now" want isLocalOnlyNote below, not this.
export function noteHasLocalOnlyMarker(note: unknown): boolean {
  return typeof note === "string" && note.includes(LOCAL_ONLY_MARKER);
}

export function noteIsReconciled(note: unknown): boolean {
  return typeof note === "string" && note.includes(RECONCILED_MARKER);
}

// The predicate `case "reopen"` actually wants: is the row local-only RIGHT NOW. Because the
// note is append-only and either marker can appear more than once (the reconcile -> reopen ->
// re-assign cycle described above), "contains LOCAL_ONLY but not RECONCILED" is wrong once a row
// has been through that cycle even once: it would carry both markers and this would say false,
// when the most recent event was in fact a fresh local-only assign. The correct read is
// positional — the most recently appended marker decides, found via lastIndexOf rather than
// counting or matching substrings.
export function isLocalOnlyNote(note: unknown): boolean {
  if (typeof note !== "string") return false;
  const li = note.lastIndexOf(LOCAL_ONLY_MARKER), ri = note.lastIndexOf(RECONCILED_MARKER);
  return li >= 0 && li > ri; // the most recent marker decides
}

// The row's new note after the reconciler's write lands: original text preserved, marker
// appended — never replaced, so the note stays a full audit trail of what happened to this
// row and when. No separator when there was no prior note to join.
export function reconciledNote(note: unknown, isoDate: string): string {
  return `${note ? `${note} | ` : ""}${RECONCILED_MARKER} ${isoDate}`;
}
