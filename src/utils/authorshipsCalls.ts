// The /authorships page's own requests and answers, kept in memory for "Report a problem"
// (src/utils/authorshipsCapture.ts reads them). Nothing here leaves the browser by itself.
//
// Rules: recordedFetch() hands back the very Response fetch() gave, rejects with the very reason
// fetch() rejected with, and no failure in the recording may reach the page. Bodies only, never
// headers: they carry the API key. Email fields are dropped as an answer is read.

const BASE = "/api/db/authorships";
const RAW_MAX = 4096;      // kept of a body that is not JSON
const IDS_MAX = 200;       // ids kept of a list
const KEYS_MAX = 1000;     // last answers kept per endpoint
const LOOKUP_ROWS_MAX = 200;
const RING_MAX: Record<string, number> = { list: 20, summary: 10, activity: 5, reports: 5, action: 10, failed: 100, refused: 10, bulk: 10 };
const LIST_ENDPOINTS = ["", "/selectable", "/reports"]; // up to 5,000 rows: counts and ids only

export const EMAIL_KEY = /^(emails?|mail|primaryEmail)$/i;

/** Local only, never sent. The same object later identifies the call to markCall(). */
export interface CallMeta {
  site: string;      // which code sent it: fetchData and topUp send identical requests
  rowId?: number;    // lookups: the row they were made from
  row?: unknown;     // actions: the row as the browser had it
  guarded?: boolean; // the caller may drop the answer, and says so with markCall()
}

export type CallOutcome = "pending" | "ok" | "http_error" | "network_error" | "aborted" | "unread";

export interface CallEntry {
  endpoint: string;
  site: string;
  request: any;
  start: string;
  end: string | null;
  ms: number | null;
  status: number | null;
  outcome: CallOutcome;
  // Guarded calls: "applied", "dropped: filters changed", or still "not applied" (with outcome ok:
  // a newer request had started).
  applied?: string;
  rowId?: number;
  row?: unknown;
  response?: any;                  // parsed answer (never for lists)
  raw?: string;                    // an answer that is not JSON, usually an error page
  error?: { name: string };
  count?: number | null;           // lists
  rows_returned?: number;
  ids?: Array<number | string>;
  dup_ids?: Array<number | string>;
}

let recording = true;
let last: Record<string, Map<string, CallEntry>> = {};
let rings: Record<string, any[]> = {};
let lookups = new Map<number, CallEntry[]>();
let facetSummary: CallEntry | null = null; // the last summary that carried the affiliation facet
let loadedAt = new WeakMap<object, { at: string; site: string }>();
let entryOf = new WeakMap<CallMeta, CallEntry>();
const startedMs = new WeakMap<CallEntry, number>();
// Other modules' stores (the hover cards) that are emptied with this one.
const clearers: Array<() => void> = [];
export const onClear = (fn: () => void) => { clearers.push(fn); };

/** Off for everyone the server does not list: what was kept since the page opened is dropped. */
export function setRecording(on: boolean) {
  recording = on;
  if (on) return;
  last = {}; rings = {}; lookups = new Map(); facetSummary = null;
  loadedAt = new WeakMap(); entryOf = new WeakMap();
  clearers.forEach((fn) => fn());
}
export const isRecording = () => recording;

const now = () => new Date().toISOString();
const safely = <T>(fn: () => T): T | undefined => { try { return fn(); } catch { return undefined; } };

/** JSON text without email fields; undefined when it is not JSON. */
const parse = (text: string): any =>
  safely(() => JSON.parse(text, (k, v) => (EMAIL_KEY.test(k) ? undefined : v)));

const push = (ring: string, item: any) => {
  const list = (rings[ring] = rings[ring] || []);
  list.push(item);
  if (list.length > RING_MAX[ring]) list.shift();
};

/** Re-inserts, so a Map's oldest key is always its first. */
const put = <K, V>(map: Map<K, V>, key: K, value: V, max: number) => {
  map.delete(key);
  map.set(key, value);
  if (map.size > max) map.delete(map.keys().next().value as K);
};

const lastKey = (e: CallEntry): string | null => {
  const id = e.endpoint === "/prior-names" ? e.request?.cwid
    : ["/candidate-evidence", "/orcid-record", "/counterpart", "/action"].includes(e.endpoint) ? e.request?.id : null;
  return id == null ? null : String(id);
};

const begin = (url: string, init: RequestInit | undefined, meta: CallMeta): CallEntry => {
  const path = url.split("?")[0];
  const body = typeof init?.body === "string" ? init.body : null;
  const e: CallEntry = {
    endpoint: path.startsWith(BASE) ? path.slice(BASE.length) : path,
    site: meta.site, request: body == null ? null : parse(body) ?? body.slice(0, RAW_MAX),
    start: now(), end: null, ms: null, status: null, outcome: "pending",
  };
  if (meta.rowId != null) e.rowId = meta.rowId;
  if (meta.row !== undefined) e.row = meta.row;
  if (meta.guarded) e.applied = "not applied";
  startedMs.set(e, Date.now());
  entryOf.set(meta, e);
  const key = lastKey(e);
  if (key) {
    const map = (last[e.endpoint] = last[e.endpoint] || new Map());
    // Never in place of an answer: a call that is aborted would lose the one still on screen.
    if (!map.has(key)) put(map, key, e, KEYS_MAX);
  }
  if (e.endpoint === "/action") push("action", e);
  else if (e.endpoint === "" || e.endpoint === "/selectable") push("list", e);
  else if (e.endpoint === "/summary") push("summary", e);
  else if (e.endpoint === "/recent-activity") push("activity", e);
  else if (e.endpoint === "/reports") push("reports", e);
  else if (e.endpoint === "/lookup") {
    const list = [...(lookups.get(e.rowId ?? 0) || []), e].slice(-10);
    put(lookups, e.rowId ?? 0, list, LOOKUP_ROWS_MAX); // 0 = the bulk assign box
  }
  return e;
};

const settle = (e: CallEntry, outcome: CallOutcome) => {
  if (!recording || e.end) return;
  e.outcome = outcome;
  e.end = now();
  e.ms = Date.now() - (startedMs.get(e) ?? Date.now());
  const key = lastKey(e);
  if (key && outcome !== "aborted") put((last[e.endpoint] = last[e.endpoint] || new Map()), key, e, KEYS_MAX);
  if (e.endpoint === "/action" && outcome !== "ok") push("failed", e);
  if (e.endpoint === "/summary" && outcome === "ok" && e.request?.includeAuthorInstitutions) facetSummary = e;
};

const failed = (e: CallEntry, err: any, outcome: CallOutcome) => {
  const name = String(err?.name || "Error");
  e.error = { name };
  settle(e, name === "AbortError" ? "aborted" : outcome);
};

// What a list answer is remembered as: its size and which rows, never the rows.
const noteList = (e: CallEntry, d: any) => {
  const ids: Array<number | string> = (Array.isArray(d?.rows) ? d.rows : []).map((r: any) => r?.id ?? `${r?.cwid}:${r?.pmid}`);
  const seen = new Set<number | string>(), dups = new Set<number | string>();
  ids.forEach((id) => (seen.has(id) ? dups : seen).add(id));
  e.count = d?.count ?? d?.total ?? null;
  e.rows_returned = ids.length;
  e.ids = ids.slice(0, IDS_MAX);
  e.dup_ids = [...dups].slice(0, IDS_MAX);
};

const onResponse = (e: CallEntry, r: Response) => {
  e.status = r.status;
  if (r.ok && LIST_ENDPOINTS.includes(e.endpoint)) {
    // Read along with the caller's own r.json() instead of a second copy of 5,000 rows.
    const json = r.json.bind(r);
    r.json = () => {
      const p = json();
      p.then((d) => { safely(() => noteList(e, d)); settle(e, "ok"); }, (err) => failed(e, err, "unread")).catch(() => {});
      return p;
    };
    return;
  }
  r.clone().text().then((text) => {
    const body = parse(text);
    if (body === undefined) e.raw = text.slice(0, RAW_MAX);
    else e.response = body;
    settle(e, r.ok ? "ok" : "http_error");
  }).catch((err) => failed(e, err, "unread"));
};

/** fetch() for every /api/db/authorships call: same Response, same rejection, and it is remembered. */
export function recordedFetch(url: string, init?: RequestInit, meta: CallMeta = { site: "" }): Promise<Response> {
  const sent = fetch(url, init);
  const e = recording ? safely(() => begin(url, init, meta)) : undefined;
  if (!e) return sent;
  return sent.then(
    (r) => { safely(() => onResponse(e, r)); return r; },
    (err) => { safely(() => failed(e, err, "network_error")); throw err; },
  );
}

/** What the page did with a guarded call's answer. */
export function markCall(meta: CallMeta, applied: string) {
  const e = entryOf.get(meta);
  if (e) e.applied = applied;
}

/** When each row object arrived and from where. Beside the rows, never on them. */
export function noteRows(rows: unknown, site: string) {
  if (!recording || !Array.isArray(rows)) return;
  const at = now();
  rows.forEach((r) => { if (r && typeof r === "object") loadedAt.set(r, { at, site }); });
}
export const rowLoaded = (row: object | null | undefined) => (row ? loadedAt.get(row) ?? null : null);

/** An action the browser refused without sending anything. */
export function noteRefusal(row: unknown, action: string, reason: string) {
  if (recording) push("refused", { at: now(), action, refused: reason, id: (row as any)?.id ?? null, row });
}

/** A bulk run's result: its single calls are in `actions`, but only the last 10 of them. */
export function noteBulk(action: string, results: PromiseSettledResult<unknown>[]) {
  if (!recording) return;
  const failedBy: Record<string, number> = {};
  results.forEach((r) => {
    if (r.status !== "rejected") return;
    const k = String((r.reason as any)?.status ?? ((r.reason as any)?.local ? "refused_in_browser" : "no_response"));
    failedBy[k] = (failedBy[k] || 0) + 1;
  });
  push("bulk", { at: now(), action, total: results.length, ok: results.filter((r) => r.status === "fulfilled").length, failed_by_status: failedBy });
}

// ---------------------------------------------------------------------------- reading it back
// Copies, so a call that settles after the click does not change what was captured.

export const lastCall = (endpoint: string, key: number | string | null | undefined): CallEntry | null => {
  const e = key == null ? undefined : last[endpoint]?.get(String(key));
  return e ? { ...e } : null;
};
export const ringOf = (ring: string): any[] => (rings[ring] || []).map((e) => ({ ...e }));
export const lookupsOf = (rowId: number): CallEntry[] => (lookups.get(rowId) || []).map((e) => ({ ...e }));
export const lastFacetSummary = (): CallEntry | null => (facetSummary ? { ...facetSummary } : null);
