// "Report a problem" on /authorships: the one dialog and the state behind its five triggers.
// What is saved is built in src/utils/authorshipsCapture.ts; the server route is
// /api/db/authorships/feedback. Rendered by AuthorshipsTabs, never inside a card or a menu:
// clicks bubble through portals and would toggle the card.
import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import type { CSSProperties, FormEvent, KeyboardEvent } from "react";
import { toast } from "react-toastify";
import { Button, Checkbox, Dialog, Input, Select } from "../../ui";
import { reciterConfig } from "../../../../config/local";
import { parseCwid } from "../../../utils/canonicalCwid";
import { setRecording } from "../../../utils/authorshipsCalls";
import { buildReport, combine, reportJson, trimReport, uuid4 } from "../../../utils/authorshipsCapture";
import type { Block, FeedbackForm, FeedbackTarget } from "../../../utils/authorshipsCapture";

const FEEDBACK_URL = "/api/db/authorships/feedback";
const headers = { Accept: "application/json", "Content-Type": "application/json", Authorization: reciterConfig.backendApiKey };
const COMMENT_MAX = 5000;
const FETCH_WAIT_MS = 3000;

const CATEGORIES: Array<{ value: string; label: string }> = [
  { value: "wrong_person", label: "Wrong person" },
  { value: "missing_person", label: "Right person missing" },
  { value: "wrong_evidence", label: "Wrong label, evidence or score" },
  { value: "duplicate", label: "Duplicate" },
  { value: "action_failed", label: "An action failed" },
  { value: "list_or_count", label: "List or count is wrong" },
  { value: "layout", label: "Layout" },
  { value: "idea", label: "Idea" },
];
const categoryLabel = (v: string) => CATEGORIES.find((c) => c.value === v)?.label || v;
const STATUS_TEXT: Record<string, string> = {
  new: "New", diagnosing: "Being looked at", needs_info: "Needs more information", awaiting_approval: "Fix waiting for approval",
  pr_open: "Fix in review", fixed: "Fixed", not_a_bug: "Not a bug", duplicate: "Duplicate of another report",
};

export interface FeedbackReport {
  id: number; created_at: string; category: string; comment: string; review_id: number | null;
  trigger_place: string; status: string; resolution_url: string | null;
}

interface Draft {
  target: FeedbackTarget;
  form: FeedbackForm;
  uuid: string;
  tried: string | null;                    // the form as last sent
  sending: boolean;
  error: string | null;
  fetched: Record<string, Block>;          // fetched_for_report parts
  waiting: Promise<unknown>[];
}

const newDraft = (target: FeedbackTarget): Draft => ({
  target, form: { category: "", about: [], expected: "", typedRef: "", comment: "" }, uuid: uuid4(),
  tried: null, sending: false, error: null, fetched: {}, waiting: [],
});
const touched = ({ form: f }: Draft) => !!(f.category || f.about.length || f.expected.trim() || f.typedRef.trim() || f.comment.trim());

// What the page had not loaded about the row and its people, asked for once the dialog is open.
// Plain fetch into the draft only: not the page's caches and not the call recorder, so reporting
// never changes the page or what a later report says the page had.
const fetchPart = (d: Draft, key: string, path: string, body: unknown) => {
  if (d.fetched[key]) return;
  const t0 = Date.now();
  const put = (b: Omit<Block, "at" | "ms">) => { d.fetched[key] = { ...b, at: new Date().toISOString(), ms: Date.now() - t0 } as Block; };
  d.fetched[key] = { status: "timeout", at: new Date().toISOString() }; // until it answers
  d.waiting.push(fetch(`/api/db/authorships${path}`, { credentials: "same-origin", method: "POST", headers, body: JSON.stringify(body) })
    .then(async (r) => {
      const text = await r.text();
      if (!r.ok) { put({ status: "error", error: { name: "HTTP", code: String(r.status) }, data: { raw: text.slice(0, 4096) } }); return; }
      const data = JSON.parse(text);
      put({ status: data == null ? "empty" : "ok", data });
    })
    .catch((e) => put({ status: "error", error: { name: String(e?.name || "Error"), code: null } })));
};
const loadedInPage = (b: Block | undefined, key: string) => ["ok", "empty"].includes(b?.data?.[key]?.status);
const fetchForReport = (d: Draft) => {
  const { reviewId, people, capture } = d.target;
  if (reviewId != null && !loadedInPage(capture.calls_row, "candidate_evidence")) {
    fetchPart(d, "candidate_evidence", "/candidate-evidence", { id: reviewId });
  }
  people.forEach((p) => {
    if (!loadedInPage(capture.calls_people, p.cwid)) fetchPart(d, `prior_names:${p.cwid}`, "/prior-names", { cwid: p.cwid });
  });
};
// "Who should it be" takes a cwid, a NetID or a name: the identifier in it, if any.
const expectedCwid = (text: string): string | null => parseCwid(/\b[a-z]{2,4}\d{1,5}\b/i.exec(text)?.[0]);
const fetchExpected = (d: Draft) => {
  const cwid = expectedCwid(d.form.expected);
  if (!cwid || d.target.people.some((p) => parseCwid(p.cwid) === cwid)) return;
  fetchPart(d, `prior_names:${cwid}`, "/prior-names", { cwid });
};

export const draftReport = (d: Draft) => buildReport(d.uuid, d.target, d.form,
  Object.keys(d.fetched).length ? combine(d.fetched) : { status: "not_applicable", at: new Date().toISOString() });

const errorText = async (r: Response): Promise<string> => {
  let body: any = null;
  try { body = await r.json(); } catch { /* not JSON */ }
  if (r.status === 503 && body?.code === "NO_TABLE") return "Reports can't be stored on this server yet.";
  if (r.status === 400 && body?.message) return `The report was refused: ${body.message}.`;
  if (r.status === 401) return "You are signed out. Sign in again in another tab, then send.";
  if (r.status === 403) return "Reporting is not enabled for this account.";
  if (r.status === 413) return "The report is too large to send.";
  return `The server didn't save the report (${r.status}).`;
};

/** Everything AuthorshipsTabs needs. `enabled` is false until the server says otherwise. */
export function useAuthorshipFeedback() {
  const [enabled, setEnabled] = useState(false);
  const [reports, setReports] = useState<{ list: FeedbackReport[]; failed: boolean }>({ list: [], failed: false });
  const [open, setOpen] = useState<Draft | null>(null);
  const [, redraw] = useReducer((n: number) => n + 1, 0);
  // One draft per place and row, for the life of the page. A ref, not state: typing must not
  // re-render the card list. Dropped only by a save.
  const drafts = useRef(new Map<string, Draft>());
  const openRef = useRef<Draft | null>(null);
  useEffect(() => { openRef.current = open; }, [open]);

  const load = useCallback(() => {
    fetch(FEEDBACK_URL, { credentials: "same-origin", headers })
      .then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then((d) => {
        setEnabled(d?.enabled === true);
        setRecording(d?.enabled === true);
        setReports({ list: Array.isArray(d?.reports) ? d.reports : [], failed: !!d?.reportsError });
      })
      .catch(() => setReports((r) => ({ ...r, failed: true })));
  }, []);
  useEffect(() => { load(); }, [load]);

  const start = useCallback((target: FeedbackTarget) => {
    let d = drafts.current.get(target.key);
    // Something typed: the same draft with what was captured when it was begun. Nothing typed: anew.
    if (!d || (!touched(d) && !d.sending)) {
      d = newDraft(target);
      drafts.current.set(target.key, d);
    }
    fetchForReport(d);
    if (target.place === "page") load();
    setOpen(d);
  }, [load]);
  const hide = useCallback(() => setOpen(null), []);

  const send = useCallback(async (d: Draft) => {
    if (d.sending) return;
    d.sending = true;
    d.error = null;
    redraw();
    try {
      fetchExpected(d);
      await Promise.race([Promise.all(d.waiting), new Promise((r) => setTimeout(r, FETCH_WAIT_MS))]);
      // A retry of the same text keeps its id, so a save whose answer was lost is not stored twice.
      // Changed text is a new report: the server would answer with the first one's id.
      const form = JSON.stringify(d.form);
      if (d.tried !== null && d.tried !== form) d.uuid = uuid4();
      d.tried = form;
      const report = draftReport(d);
      const post = (body: string) => fetch(FEEDBACK_URL, { credentials: "same-origin", method: "POST", headers, body });
      let r = await post(reportJson(report));
      if (r.status === 413) r = await post(reportJson(trimReport(report)));
      if (!r.ok) throw new Error(await errorText(r));
      const { id } = await r.json();
      if (!id) throw new Error("The server didn't confirm the save.");
      drafts.current.delete(d.target.key);
      setOpen((o) => (o === d ? null : o));
      toast(`Reported #${id}`, { autoClose: 5000 });
    } catch (e: any) {
      d.error = e instanceof TypeError ? "The server couldn't be reached."
        : e instanceof SyntaxError ? "The server's answer couldn't be read. You may be signed out."
          : String(e?.message || e);
      if (openRef.current !== d) toast.error("A problem report was not saved. Open it again from the same place to retry.", { autoClose: 8000 });
    } finally {
      d.sending = false;
      redraw();
    }
  }, []);

  return { enabled, reports, open, start, hide, send };
}

const labelStyle: CSSProperties = { display: "block", fontSize: 13, fontWeight: 600, marginBottom: 4, color: "var(--pm-foreground)" };
const hint: CSSProperties = { fontSize: 12, color: "var(--pm-muted-foreground)" };
const errorStyle: CSSProperties = { fontSize: 12.5, color: "var(--pm-red)", marginTop: 4 };

export const FeedbackDialog = ({ draft: d, reports, onHide, onSend }: {
  draft: Draft;
  reports: { list: FeedbackReport[]; failed: boolean };
  onHide: () => void; onSend: (d: Draft) => void;
}) => {
  const [form, setForm] = useState(d.form);
  const [missing, setMissing] = useState<{ category?: boolean; comment?: boolean }>({});
  const [copied, setCopied] = useState<"" | "yes" | string>(""); // "yes", or the text to copy by hand
  const categoryRef = useRef<{ focus: () => void }>(null); // MUI Select's handle
  const commentRef = useRef<HTMLTextAreaElement>(null);
  // Not while it is being sent: the draft is dropped once that save lands.
  const patch = (p: Partial<FeedbackForm>) => { if (d.sending) return; const next = { ...form, ...p }; d.form = next; setForm(next); };
  const page = d.target.place === "page";

  const submit = (e?: FormEvent) => {
    e?.preventDefault();
    const m = { category: !form.category, comment: !form.comment.trim() };
    setMissing(m);
    if (m.category) { categoryRef.current?.focus(); return; }
    if (m.comment) { commentRef.current?.focus(); return; }
    setCopied("");
    onSend(d);
  };
  const onKeyDown = (e: KeyboardEvent) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); submit(); } };
  const copy = async () => {
    const text = reportJson(draftReport(d));
    try { await navigator.clipboard.writeText(text); setCopied("yes"); } catch { setCopied(text); }
  };

  return (
    <Dialog open onClose={onHide} title="Report a problem" width={600}
      description={page ? "About the list, the counts, or a row that never appeared." : d.target.heading}
      footer={<>
        {d.error && <Button variant="ghost" onClick={copy}>{copied === "yes" ? "Copied" : "Copy report"}</Button>}
        <Button variant="secondary" onClick={onHide}>Close</Button>
        <Button variant="primary" type="submit" form="pm-feedback-form" disabled={d.sending}>{d.sending ? "Sending…" : "Send report"}</Button>
      </>}>
      <form id="pm-feedback-form" noValidate onSubmit={submit} onKeyDown={onKeyDown} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div>
          <label id="pm-feedback-category-label" style={labelStyle}>What is wrong?</label>
          <Select value={form.category} onChange={(category) => patch({ category })} fullWidth displayEmpty autoFocus
            id="pm-feedback-category" labelId="pm-feedback-category-label" error={!!missing.category && !form.category}
            inputRef={categoryRef}
            SelectDisplayProps={{ "aria-required": true, "aria-invalid": !!missing.category && !form.category, "aria-describedby": "pm-feedback-category-error" } as any}
            options={[{ value: "", label: "Choose one", disabled: true }, ...CATEGORIES]} />
          <div id="pm-feedback-category-error" role="alert" style={errorStyle}>{missing.category && !form.category ? "Choose what kind of problem this is." : ""}</div>
        </div>

        {d.target.people.length > 0 && (
          <fieldset style={{ border: 0, margin: 0, padding: 0, minWidth: 0 }}>
            <legend style={{ ...labelStyle, float: "none", width: "auto", padding: 0 }}>Who is it about? <span style={hint}>(optional)</span></legend>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start" }}>
              {d.target.people.map((p) => (
                <Checkbox key={p.cwid} checked={form.about.includes(p.cwid)} label={`${p.name || p.cwid} (${p.cwid})`}
                  onChange={(_, on) => patch({ about: on ? [...form.about, p.cwid] : form.about.filter((c) => c !== p.cwid) })} />
              ))}
            </div>
          </fieldset>
        )}

        <div>
          <label htmlFor="pm-feedback-expected" style={labelStyle}>Who should it be? <span style={hint}>(optional: CWID, NetID or name)</span></label>
          <Input id="pm-feedback-expected" fullWidth value={form.expected} inputProps={{ maxLength: 255, autoComplete: "off" }}
            onChange={(e) => patch({ expected: e.target.value })} onBlur={() => fetchExpected(d)} />
        </div>

        {page && (
          <div>
            <label htmlFor="pm-feedback-ref" style={labelStyle}>PMID or DOI <span style={hint}>(optional, for a paper that is not in the list)</span></label>
            <Input id="pm-feedback-ref" fullWidth value={form.typedRef} inputProps={{ maxLength: 255, autoComplete: "off" }}
              onChange={(e) => patch({ typedRef: e.target.value })} />
          </div>
        )}

        <div>
          <label htmlFor="pm-feedback-comment" style={labelStyle}>What happened, and what did you expect?</label>
          <Input id="pm-feedback-comment" fullWidth multiline minRows={4} maxRows={12} value={form.comment} inputRef={commentRef}
            error={!!missing.comment && !form.comment.trim()}
            inputProps={{ maxLength: COMMENT_MAX, "aria-required": true, "aria-describedby": "pm-feedback-comment-hint pm-feedback-comment-error" }}
            onChange={(e) => patch({ comment: e.target.value })} />
          <div id="pm-feedback-comment-hint" style={{ ...hint, marginTop: 4 }}>
            What is on screen is saved with your comment. Closing keeps what you typed until it is sent.
            {form.comment.length > COMMENT_MAX - 500 ? ` ${(COMMENT_MAX - form.comment.length).toLocaleString()} characters left.` : ""}
          </div>
          <div id="pm-feedback-comment-error" role="alert" style={errorStyle}>{missing.comment && !form.comment.trim() ? "Say what happened." : ""}</div>
        </div>

        <div role="alert" style={{ ...errorStyle, marginTop: 0 }}>
          {d.error ? `Not saved. ${d.error} Your text is kept: try again, or copy the report.` : ""}
        </div>
        {copied && copied !== "yes" && (
          <div>
            <label htmlFor="pm-feedback-copy" style={labelStyle}>The browser refused to copy. Select the text and copy it by hand.</label>
            <textarea id="pm-feedback-copy" readOnly rows={4} value={copied} onFocus={(e) => e.currentTarget.select()}
              style={{ width: "100%", boxSizing: "border-box", font: "12px var(--font-mono)" }} />
          </div>
        )}

        {page && (
          <section aria-labelledby="pm-feedback-mine" style={{ borderTop: "1px solid var(--pm-border)", paddingTop: 12 }}>
            <h3 id="pm-feedback-mine" style={{ ...labelStyle, margin: "0 0 6px" }}>Your reports</h3>
            {reports.failed ? <div style={hint}>Your earlier reports could not be loaded.</div>
              : reports.list.length === 0 ? <div style={hint}>None yet.</div> : (
                <ul tabIndex={0} aria-labelledby="pm-feedback-mine" style={{ listStyle: "none", margin: 0, padding: 0, maxHeight: 220, overflow: "auto" }}>
                  {reports.list.map((r) => (
                    <li key={r.id} style={{ padding: "6px 0", borderBottom: "1px solid var(--pm-border)", fontSize: 12.5, lineHeight: 1.45 }}>
                      <div>
                        <strong style={{ fontWeight: 600 }}>#{r.id}</strong> · {new Date(r.created_at).toLocaleDateString()} · {categoryLabel(r.category)} ·{" "}
                        {r.resolution_url
                          ? <a href={r.resolution_url} target="_blank" rel="noreferrer" style={{ color: "var(--pm-slate)" }}>{STATUS_TEXT[r.status] || r.status}</a>
                          : STATUS_TEXT[r.status] || r.status}
                      </div>
                      <div style={{ ...hint, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", overflowWrap: "anywhere" }}>{r.comment}</div>
                    </li>
                  ))}
                </ul>
              )}
          </section>
        )}
      </form>
    </Dialog>
  );
};
