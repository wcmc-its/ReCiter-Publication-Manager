// Keeps the first row for each id and drops the rest, preserving order.
//
// The /authorships list keys its cards by authorship_review id. When the list query fanned out
// (one review row joined to two `person` rows for the same cwid), the same id came back twice,
// React saw duplicate keys, and accepting that row left an orphaned card on screen. The server
// query now returns each review row once; this is the client-side guard so a repeat id can
// never reach the list again.
export function uniqueById<T extends { id: unknown }>(rows: readonly T[]): T[] {
  const seen = new Set<unknown>();
  const out: T[] = [];
  for (const row of rows) {
    if (seen.has(row.id)) continue;
    seen.add(row.id);
    out.push(row);
  }
  return out;
}
