// Toast copy for /authorships. Pure, so tests/authorshipMessages.test.mjs can pin the wording.

// What a curator action did, as the toast's verb. Bulk toasts use the short form ("Snoozed 3
// authorships"); a single row names the author ("Snoozed for 90 days: Michael Bales").
const SINGLE_VERB: Record<string, string> = {
  accept: "Accepted", reject: "Rejected", snooze: "Snoozed for 90 days", dismiss: "Dismissed", assign: "Assigned",
  reopen: "Reopened",
};
const BULK_VERB: Record<string, string> = { ...SINGLE_VERB, snooze: "Snoozed" };

// The infinitive for "Couldn't … <author>".
const BASE_VERB: Record<string, string> = {
  accept: "accept", reject: "reject", snooze: "snooze", dismiss: "dismiss", assign: "assign", reopen: "reopen",
  verdict: "save the verdict for",
};

export type ToastRow = { wcm_author?: string | null; title?: string | null; id?: number | string };

const subjectOf = (row: ToastRow): string =>
  (row.wcm_author || "").trim() || (row.title || "").trim() || (row.id != null ? `row ${row.id}` : "this authorship");

// "Accepted: Jane Doe → Jane Q. Doe", "Snoozed for 90 days: Michael Bales", "Snoozed 3 authorships".
// `target` is the identity an accept or assign landed on; it is ignored for every other action.
export function actionToast(action: string, rows: ToastRow[], target?: string | null): string {
  const n = rows.length;
  if (n > 1) return `${BULK_VERB[action] || "Done"} ${n.toLocaleString()} authorships`;
  const verb = SINGLE_VERB[action] || "Done";
  if (n === 0) return verb;
  const arrow = (action === "accept" || action === "assign") && target && target.trim() ? ` → ${target.trim()}` : "";
  return `${verb}: ${subjectOf(rows[0])}${arrow}`;
}

const GENERIC = "The server had a problem saving it.";

// One plain sentence from whatever an error carries. Server errors arrive as plain text, as JSON
// ({ message } / { error }), as an HTML error page, or as a stringified exception
// ("SequelizeConnectionError: Too many connections"). Only the first is shown as is; JSON is
// unwrapped to its message, and the rest become a generic sentence, so a toast never shows
// raw JSON, markup or a stack.
export function plainReason(e: unknown): string {
  let text = "";
  let status: number | undefined;
  if (e && typeof e === "object") {
    const o = e as { message?: unknown; status?: unknown };
    text = typeof o.message === "string" ? o.message : "";
    if (typeof o.status === "number") status = o.status;
  } else if (e != null) text = String(e);
  text = text.trim();

  if (/^[[{]/.test(text)) {
    try {
      const parsed = JSON.parse(text);
      const m = parsed && (parsed.message ?? parsed.error);
      text = typeof m === "string" ? m.trim() : "";
    } catch { text = ""; }
  }
  if (/^Error:\s*/.test(text)) text = text.replace(/^Error:\s*/, "");
  if (/^(Failed to fetch|NetworkError|Load failed)/i.test(text)) return "The server could not be reached.";
  const httpOnly = /^HTTP \d{3}$/.test(text);
  const looksRaw = !text || httpOnly || text.startsWith("<") || /^[A-Z][A-Za-z]*Error\b/.test(text)
    || /\bat .+:\d+:\d+/.test(text) || text.length > 240;
  if (looksRaw) {
    const code = status ?? (httpOnly ? Number(text.slice(5)) : undefined);
    return code ? GENERIC.replace(".", ` (HTTP ${code}).`) : GENERIC;
  }
  return /[.!?]$/.test(text) ? text : `${text}.`;
}

// "Couldn't dismiss Nicolás Di Siervi. The server had a problem saving it (HTTP 500). The row is
// back in the list; nothing was saved."
export function actionErrorToast(action: string, row: ToastRow, e: unknown, opts: { rowRestored?: boolean } = {}): string {
  const base = `Couldn't ${BASE_VERB[action] || action} ${subjectOf(row)}. ${plainReason(e)}`;
  return opts.rowRestored === false ? base : `${base} The row is back in the list; nothing was saved.`;
}
