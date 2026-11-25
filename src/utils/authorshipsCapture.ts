// What a "Report a problem" saves from the browser (the client_snapshot of
// POST /api/db/authorships/feedback): the row and card as shown, the calls behind them, the page
// around them. Every part is a block {status, at, ...}, so "never asked", "none" and "failed" stay
// distinct. Called from the click handler, before any state changes.

import {
  EMAIL_KEY, isRecording, lastCall, lastFacetSummary, lookupsOf, onClear, ringOf, rowLoaded,
} from "./authorshipsCalls";
import type { CallEntry } from "./authorshipsCalls";

export type TriggerPlace = "menu" | "queue" | "dup_pair" | "activity" | "page";
export type BlockStatus = "ok" | "empty" | "error" | "timeout" | "not_loaded" | "not_applicable" | "unavailable" | "too_large";
export interface Block { status: BlockStatus; at: string; ms?: number; data?: any; error?: any; [extra: string]: any }
export interface FeedbackPerson { cwid: string; name?: string | null }

/** Structural: the page's AuthorshipRow and ActivityEntry both fit. */
export interface CaptureInput {
  place: TriggerPlace;
  row?: any | null;
  activity?: any | null;
  el?: Element | null;                      // anything inside the card, pair or activity entry
  people?: FeedbackPerson[];
  conflict?: any;
  conflictLog?: any[];
  activityIds?: number[];
  heading?: string;                         // the dialog's one line about the row
  view: any;
}

/** What the dialog is about, fixed when it is opened. */
export interface FeedbackTarget {
  key: string;
  place: TriggerPlace;
  reviewId: number | null;
  heading: string;
  people: FeedbackPerson[];
  capture: Record<string, Block>;
}

/** A report being written, as far as its evidence goes: the dialog's Draft adds its own state. */
export interface DraftEvidence {
  target: FeedbackTarget;
  form: FeedbackForm;
  fetched: Record<string, Block>;           // fetched_for_report parts
  again: Recapture[];                       // taken when it was reopened after the comment was begun
  againDropped: number;
}
export interface Recapture { capture: Record<string, Block>; fetched: Record<string, Block> }
const AGAIN_MAX = 3;

const now = () => new Date().toISOString();
const block = (status: BlockStatus, data?: any, extra: Partial<Block> = {}): Block =>
  ({ status, at: now(), ...(data === undefined ? {} : { data }), ...extra });
const NA = () => block("not_applicable");
// Reading the page must never stop a report.
const guarded = (fn: () => Block): Block => {
  try { return fn(); } catch (e: any) { return block("error", undefined, { error: { name: String(e?.name || "Error"), code: null } }); }
};

/** Parts with their own envelope: the block takes the first status on this list that any part has. */
const WORST: BlockStatus[] = ["error", "timeout", "too_large", "ok", "empty", "unavailable", "not_loaded", "not_applicable"];
export const combine = (parts: Record<string, Block>): Block => {
  const all = Object.values(parts).map((p) => p.status);
  return block(WORST.find((s) => all.includes(s)) ?? "not_applicable", parts);
};

export const isEmptyAnswer = (endpoint: string, request: any, response: any): boolean =>
  response == null || (endpoint === "/orcid-record" && response.record == null)
  || (endpoint === "/lookup" && Array.isArray(response.matches) && response.matches.length === 0)
  || (endpoint === "/prior-names" && response.accepted?.[request?.cwid] === 0 && !response.names?.[request.cwid]?.length);

/** One remembered call as a block. An aborted or unfinished call gave the page nothing: not_loaded. */
export const callBlock = (e: CallEntry | null): Block => {
  if (!e) return block("not_loaded");
  const at = e.end || e.start;
  const { row, ...data } = e;
  const base = { at, ...(e.ms == null ? {} : { ms: e.ms }) };
  if (e.outcome === "pending") return block("not_loaded", { ...data, in_flight: true }, base);
  if (e.outcome === "aborted") return block("not_loaded", data, { ...base, error: { name: "AbortError", code: null } });
  if (e.outcome !== "ok") {
    return block("error", data, { ...base, error: { name: e.error?.name || "HTTP", code: e.status == null ? null : String(e.status) } });
  }
  if (e.endpoint === "/lookup" && e.response?.configured === false) return block("unavailable", data, base);
  const empty = isEmptyAnswer(e.endpoint, e.request, e.response);
  // No match from a directory that did not answer is not "nobody by that name".
  if (empty && Object.values(e.response?.debug?.perDirectory || {}).some((d: any) => d?.failed)) {
    return block("error", data, { ...base, error: { name: "DirectoryFailed", code: null } });
  }
  return block(empty ? "empty" : "ok", data, base);
};

// The newest call of a ring that was answered or failed, as a block's status.
const newest = (ring: CallEntry[]): Block | null => {
  const e = [...ring].reverse().find((x) => x.outcome !== "pending" && x.outcome !== "aborted");
  return e ? callBlock(e) : null;
};

// ---------------------------------------------------------------------------- the card

const textOf = (el: Element): string => ((el as HTMLElement).innerText ?? el.textContent ?? "").trim();
const rectOf = (el: Element) => { const r = el.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; };
const describe = (el: Element | null) => el && el !== document.body
  ? { tag: el.tagName.toLowerCase(), label: el.getAttribute("aria-label") || textOf(el).slice(0, 120), row: el.closest("[data-arow]")?.getAttribute("data-arow") ?? null }
  : null;

export const captureCard = (from: Element | null | undefined): Block => guarded(() => {
  const el = from?.closest("[data-arow],[data-dup-pair],[data-activity]");
  if (!el) return NA();
  const within = (sel: string) => [...(el.matches(sel) ? [el] : []), ...Array.from(el.querySelectorAll(sel))];
  const cut = within("*").filter((x) => {
    const wide = x.scrollWidth > x.clientWidth + 1, tall = x.scrollHeight > x.clientHeight + 1;
    if ((!wide && !tall) || !x.clientWidth) return false;
    const css = getComputedStyle(x);
    return (wide && css.overflowX !== "visible") || (tall && css.overflowY !== "visible");
  });
  return block("ok", {
    attributes: Object.fromEntries(Array.from(el.attributes).filter((a) => a.name.startsWith("data-")).map((a) => [a.name, a.value])),
    text: textOf(el),
    titles: within("[title]").map((x) => ({ text: textOf(x).slice(0, 120), title: x.getAttribute("title") })),
    aria_labels: within("[aria-label]").map((x) => ({ tag: x.tagName.toLowerCase(), text: textOf(x).slice(0, 120), label: x.getAttribute("aria-label") })),
    buttons: within("button,[role=button],[role=checkbox]").map((x) => ({
      label: x.getAttribute("aria-label") || textOf(x).slice(0, 120),
      disabled: (x as HTMLButtonElement).disabled === true || x.getAttribute("aria-disabled") === "true",
      reason: x.getAttribute("title"),
    })),
    cut_off: cut.map((x) => ({ tag: x.tagName.toLowerCase(), text: textOf(x).slice(0, 300), width: x.clientWidth, needs_width: x.scrollWidth, height: x.clientHeight, needs_height: x.scrollHeight })),
    position: rectOf(el),
    scroll: { x: window.scrollX, y: window.scrollY },
    focused: describe(document.activeElement),
  });
});

// The last identity card shown on each row. Kept when it opens: it is always closed by the time
// anyone reaches a Report control.
const hovers = new Map<number, Block>();
onClear(() => hovers.clear());
export const noteHover = (el: Element | null, cwid?: string | null) => {
  if (!el || !isRecording()) return;
  try {
    const id = Number(el.closest("[data-arow]")?.getAttribute("data-arow"));
    if (!id) return;
    hovers.delete(id);
    hovers.set(id, block("ok", { cwid: cwid ?? null, text: textOf(el), position: rectOf(el) }));
    if (hovers.size > 200) hovers.delete(hovers.keys().next().value as number);
  } catch { /* the page must not notice */ }
};

// ---------------------------------------------------------------------------- the whole capture

const captureEnv = (): Block => guarded(() => block("ok", {
  build: (window as any).__NEXT_DATA__?.buildId ?? null,
  url: window.location.href,
  viewport: { width: window.innerWidth, height: window.innerHeight },
  pixel_ratio: window.devicePixelRatio,
  browser: navigator.userAgent,
  time_zone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  clicked_at: now(),
}));

const actionBlock = (id: number | null, activityIds: number[]): Block => {
  const data = {
    last: ringOf("action"), failed: ringOf("failed"), refused_in_browser: ringOf("refused"), bulk_runs: ringOf("bulk"),
    this_row: lastCall("/action", id),
    recent_activity: Object.fromEntries(activityIds.map((a) => [a, lastCall("/action", a)]).filter(([, e]) => e)),
  };
  const last = newest(data.last);
  if (last?.status === "error") return block("error", data, { error: last.error });
  return block(data.last.length || data.refused_in_browser.length || data.bulk_runs.length ? "ok" : "empty", data);
};

export function captureReport(i: CaptureInput): FeedbackTarget {
  const id: number | null = i.row?.id ?? i.activity?.id ?? null;
  // A Recent activity entry is already decided; the row it was is known if this session decided it.
  const row = i.row ?? (i.activity ? (lastCall("/action", id)?.row as any) ?? null : null);
  const people = (i.people || []).filter((p, n, all) => p.cwid && all.findIndex((q) => q.cwid === p.cwid) === n).slice(0, 30);
  const loaded = rowLoaded(row);
  const onRow = (fn: () => Block) => (id == null ? NA() : guarded(fn));
  const list = ringOf("list"), summary = ringOf("summary"), activity = ringOf("activity"), reports = ringOf("reports");
  const capture: Record<string, Block> = {
    shown_row: onRow(() => ({
      ...block(row ? "ok" : "not_loaded", row ?? null), at: loaded?.at ?? now(), loader: loaded?.site ?? null,
      ...(i.activity ? { activity: i.activity } : {}),
    })),
    card: captureCard(i.el),
    last_hover: onRow(() => hovers.get(id!) ?? block("not_loaded")),
    calls_row: onRow(() => combine({
      candidate_evidence: callBlock(lastCall("/candidate-evidence", id)),
      orcid_record: row && !row.byline_orcid ? NA() : callBlock(lastCall("/orcid-record", id)),
      counterpart: row && row.matched_pmid == null ? NA() : callBlock(lastCall("/counterpart", id)),
      action: callBlock(lastCall("/action", id)),
    })),
    calls_people: people.length ? guarded(() => combine(Object.fromEntries(people.map((p) => [p.cwid, callBlock(lastCall("/prior-names", p.cwid))])))) : NA(),
    // Page-level: the lookups made from the bulk assign box, which belong to no row.
    calls_lookup: guarded(() => {
      const calls = lookupsOf(id ?? 0).map(callBlock);
      return calls.length ? block(WORST.find((s) => calls.some((c) => c.status === s))!, calls) : block("not_loaded");
    }),
    calls_recent: guarded(() => {
      const data = { list, summary, summary_with_affiliation_facet: lastFacetSummary(), activity, reports };
      const bad = [list, summary].map(newest).find((b) => b?.status === "error");
      if (bad) return block("error", data, { error: bad.error });
      return block([list, summary, activity, reports].some(newest) ? "ok" : "not_loaded", data);
    }),
    actions: guarded(() => actionBlock(id, i.activityIds || [])),
    conflict: onRow(() => {
      const log = (i.conflictLog || []).filter((c) => c?.id === id);
      return block(i.conflict || log.length ? "ok" : "empty", { prompt: i.conflict ?? null, log });
    }),
    view: guarded(() => block("ok", i.view)),
    env: captureEnv(),
  };
  return { key: `${i.place}:${id ?? "page"}`, place: i.place, reviewId: id, heading: i.heading || "", people, capture };
}

// ---------------------------------------------------------------------------- the request body

export interface FeedbackForm { category: string; about: string[]; expected: string; typedRef: string; comment: string }

/** Version 4 UUID. Not crypto.randomUUID: that one is missing outside https. */
export const uuid4 = (): string => {
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
};

/**
 * A draft that is opened again, with what the page shows now. A comment stays with what was on
 * screen when it was begun, and the new capture is added. Without one (a category, say) the new
 * capture replaces the old: nothing has been said about that one yet.
 */
export const reopenDraft = (d: DraftEvidence, target: FeedbackTarget) => {
  const { people } = d.target;
  if (d.form.comment.trim()) {
    d.again.push({ capture: target.capture, fetched: {} });
    if (d.again.length > AGAIN_MAX) { d.again.shift(); d.againDropped++; }
    d.target = { ...d.target, people: [...people, ...target.people.filter((p) => !people.some((q) => q.cwid === p.cwid))] };
    return;
  }
  // Whoever is ticked stays on offer, so that they can be unticked.
  const ticked = people.filter((p) => d.form.about.includes(p.cwid) && !target.people.some((q) => q.cwid === p.cwid));
  d.target = { ...target, people: [...target.people, ...ticked] };
  d.fetched = {};
  d.again = [];
  d.againDropped = 0;
};

export const fetchedBlock = (parts: Record<string, Block>): Block => (Object.keys(parts).length ? combine(parts) : NA());

const recapturedBlock = (d: DraftEvidence): Block => (!d.again.length ? NA() : block("ok",
  d.again.map((a) => ({ ...a.capture, fetched_for_report: fetchedBlock(a.fetched) })), { dropped: d.againDropped }));

export const buildReport = (uuid: string, d: DraftEvidence) => ({
  client_uuid: uuid,
  trigger_place: d.target.place,
  category: d.form.category,
  about_cwids: d.form.about,
  ...(d.form.expected.trim() ? { expected: d.form.expected.trim() } : {}),
  ...(d.target.place === "page" && d.form.typedRef.trim() ? { typed_ref: d.form.typedRef.trim() } : {}),
  comment: d.form.comment,
  review_id: d.target.reviewId,
  snapshot_version: 1,
  client_build: d.target.capture.env?.data?.build ?? null,
  client_snapshot: {
    form: { ...d.form, offered: d.target.people, sent_at: now() },
    ...d.target.capture,
    fetched_for_report: fetchedBlock(d.fetched),
    recaptured: recapturedBlock(d),
  },
});

export const reportJson = (report: unknown): string =>
  JSON.stringify(report, (k, v) => (EMAIL_KEY.test(k) ? undefined : v));

const dropBlocks = (snap: any, drop: (k: string) => boolean) => Object.keys(snap).filter(drop).forEach((k) => {
  if (["ok", "error", "empty"].includes(snap[k]?.status)) snap[k] = { status: "too_large", at: snap[k].at };
});

/** For the one retry after a 413: the comment, row and card always fit, the call logs may not. */
export const trimReport = (report: ReturnType<typeof buildReport>) => {
  const snap: any = { ...report.client_snapshot };
  dropBlocks(snap, (k) => k.startsWith("calls_"));
  // Up to three more captures. Their action logs mostly repeat the first one's: keep this row's.
  if (Array.isArray(snap.recaptured?.data)) {
    snap.recaptured = { ...snap.recaptured, trimmed: true, data: snap.recaptured.data.map((c: any) => {
      const one = { ...c };
      dropBlocks(one, (k) => k.startsWith("calls_") || k === "fetched_for_report");
      if (one.actions?.data) one.actions = { ...one.actions, trimmed: true, data: { this_row: one.actions.data.this_row ?? null } };
      return one;
    }) };
  }
  // Up to 100 failed calls, each with its whole row.
  const acts = snap.actions?.data;
  if (acts) snap.actions = { ...snap.actions, trimmed: true, data: { ...acts, failed: acts.failed?.map(({ row, ...rest }: any) => rest) } };
  return { ...report, client_snapshot: snap };
};
