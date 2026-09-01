// The marker text `case "assign"`'s local_only branch stamps into authorship_review.note when
// the assignee has no ReCiter identity (#925), and the marker `reconcile-local-only-assigns.mjs`
// stamps once an identity has since appeared and the promised gold-standard write actually
// lands. Pure and dependency-free ONLY so both the note text and the read of it are directly
// assertable (scripts/check-local-only-marker.mjs) without a DB — same reasoning as
// assignGate.ts. PM#949: this is now the SHARED contract between the writer (`case "assign"`),
// the reader (`case "reopen"`, which used to infer local-only from a live identity check instead
// of the note it was sitting right next to), and the reconciler script.
export const LOCAL_ONLY_MARKER = "local record only, nothing written to the publication record";
export const RECONCILED_MARKER = "reconciled to publication record";

// Does this note carry the local-only marker at all — including a row the reconciler has
// since promoted (RECONCILED_MARKER is appended, never replacing the original text). Callers
// that need "is this STILL local-only" want isLocalOnlyNote below, not this.
export function noteHasLocalOnlyMarker(note: unknown): boolean {
  return typeof note === "string" && note.includes(LOCAL_ONLY_MARKER);
}

export function noteIsReconciled(note: unknown): boolean {
  return typeof note === "string" && note.includes(RECONCILED_MARKER);
}

// The predicate `case "reopen"` actually wants: local-only AND not since reconciled. A
// reconciled row has an authoritative gold-standard write behind it now, same as any other
// assign, so it must reopen the ordinary way (undo via DELETE), not the local-only "nothing to
// undo" way.
export function isLocalOnlyNote(note: unknown): boolean {
  return noteHasLocalOnlyMarker(note) && !noteIsReconciled(note);
}

// The row's new note after the reconciler's write lands: original text preserved, marker
// appended — never replaced, so the note stays a full audit trail of what happened to this
// row and when. No separator when there was no prior note to join.
export function reconciledNote(note: unknown, isoDate: string): string {
  return `${note ? `${note} | ` : ""}${RECONCILED_MARKER} ${isoDate}`;
}
