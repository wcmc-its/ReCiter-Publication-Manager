// Pure helpers for the /authorships header: the filter chip row, the drill banner and the
// keyboard map. Kept out of AuthorshipsTabs.tsx so they can be unit-tested without a browser
// (tests/authorshipChips.test.mjs).

// What a filter chip reads. At rest it shows "Label: <all-label>" (or just "Label" when the
// filter has no all-label); one value names it, several show how many. Same rule as the
// prototype's filterChips.
export const chipText = (
  label: string,
  selected: string[],
  opts: { allLabel?: string; labelOf?: (v: string) => string } = {},
): string => {
  const { allLabel, labelOf = (v: string) => v } = opts;
  if (selected.length === 0) return allLabel ? `${label}: ${allLabel}` : label;
  if (selected.length === 1) return `${label}: ${labelOf(selected[0])}`;
  return `${label}: ${selected.length}`;
};

// The same chip for a single-choice filter whose default is a real value (Queue: Open,
// Match class: All unassigned, Date: Last 2 years). Always names the current value.
export const singleChipText = (label: string, valueLabel: string): string => `${label}: ${valueLabel}`;

export type DrillBanner = { label: string; note: string; back: boolean } | null;

// The slate band under the chip row. A "Show N others like this" drill names the pile and
// offers the way back to the filters it replaced. The identity-conflicts and duplicate-records
// queues get the label only: those queues keep the curator's filters (#988), so there is
// nothing to go back to.
//
// The drill keeps the curator's other filters, so it can show fewer rows than the button that
// opened it promised ("Show 4 others like this" counts the whole open queue). `expected` is that
// promise; when the list falls short the banner says how many and why, rather than widening the
// filters behind the curator's back.
const BACK_NOTE = "When the last one is done, your previous filters come back.";
export const drillBanner = (args: {
  likeAuthor: string;
  count: number | null;
  expected?: number | null;
  statusView: string;
}): DrillBanner => {
  const like = args.likeAuthor.trim();
  if (like) {
    const n = args.count, want = args.expected;
    const noun = (k: number) => (k === 1 ? "authorship" : "authorships");
    if (n == null) return { label: `Showing authorships like “${like}”`, note: BACK_NOTE, back: true };
    if (want != null && n < want) {
      const out = want - n;
      return {
        label: `Showing ${n.toLocaleString()} of ${want.toLocaleString()} ${noun(want)} like “${like}”`,
        note: `${out.toLocaleString()} ${out === 1 ? "is" : "are"} outside the current filters. ${BACK_NOTE}`,
        back: true,
      };
    }
    return { label: `Showing ${n.toLocaleString()} ${noun(n)} like “${like}”`, note: BACK_NOTE, back: true };
  }
  if (args.statusView === "conflicts") return { label: "Showing identity conflicts", note: "", back: false };
  if (args.statusView === "duplicates") return { label: "Showing duplicate records", note: "", back: false };
  return null;
};

// The /authorships shortcuts, by KeyboardEvent.key. Letters are matched case-insensitively;
// "?" arrives as "?" whatever the layout's shift state.
export type KeyCommand = "next" | "prev" | "accept" | "reject" | "snooze" | "select" | "evidence" | "open" | "legend";
const KEYS: Record<string, KeyCommand> = {
  j: "next", arrowdown: "next",
  k: "prev", arrowup: "prev",
  y: "accept", a: "accept",
  n: "reject", r: "reject",
  s: "snooze",
  x: "select",
  e: "evidence",
  enter: "open",
  "?": "legend",
};
export const keyCommand = (e: { key: string; metaKey?: boolean; ctrlKey?: boolean; altKey?: boolean }): KeyCommand | null => {
  // Cmd/Ctrl/Alt chords belong to the browser (Cmd-R, Ctrl-A, …), never to a row.
  if (e.metaKey || e.ctrlKey || e.altKey) return null;
  return KEYS[e.key.toLowerCase()] ?? null;
};

/** Enter belongs to the control that has focus, or to whatever already handled it, not to the row. */
export const enterIsTaken = (e: { defaultPrevented: boolean; target: EventTarget | null }): boolean =>
  e.defaultPrevented || !!(e.target as Element | null)?.closest?.("button,a,summary,[role=button],[role=menuitem],[role=option],[role=checkbox],[role=radio]");

// The "?" legend, in the prototype's order. Enter is this page's own addition.
export const KEY_LEGEND: Array<{ key: string; label: string }> = [
  { key: "J / ↓", label: "Next row" },
  { key: "E", label: "Show or hide evidence" },
  { key: "K / ↑", label: "Previous row" },
  { key: "Y / A", label: "Accept (single candidate)" },
  { key: "N / R", label: "Reject" },
  { key: "S", label: "Snooze 90 days" },
  { key: "X", label: "Select / deselect the row" },
  { key: "U", label: "Undo the last action" },
  { key: "↵", label: "Open the record in a new tab" },
  { key: "?", label: "Show or hide this list" },
];
