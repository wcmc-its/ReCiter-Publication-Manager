import { useCallback, useEffect, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import Tooltip from "@mui/material/Tooltip";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import Snackbar from "@mui/material/Snackbar";
import Checkbox from "@mui/material/Checkbox";
import { reciterConfig } from "../../../../config/local";

// ---- types ---------------------------------------------------------------
interface AuthorshipRow {
  id: number;
  pmid: number;
  author_key: string;
  wcm_author?: string;
  author_position_label?: string;
  author_affiliation?: string;
  entrez_date?: string;
  title?: string;
  journal?: string;
  doi?: string;
  classification?: "assigned" | "suggested" | "buried" | "absent";
  top_cwid?: string;
  top_name?: string;
  top_person_type?: string;
  top_dept?: string;
  top_fg_score?: number;
  top_io_score?: number;
  top_confidence?: number;
  top_cohort_size?: number;
  top_given_match?: string;
  top_affil_match?: boolean;
  n_candidates?: number;
  single_candidate?: boolean;
  candidate_cwids_json?: string;
  pmid_sibling_count?: number;
  status?: string;
  snooze_until?: string;
  reviewer?: string;
  resolved_at?: string;
}

interface Candidate {
  cwid: string;
  name?: string;
  person_type?: string;
  dept?: string;
  io_score?: number;
  final_score?: number;
  confidence?: number;
  affil_dept_match?: boolean;
}

interface Summary { total: number; single_candidate: number; classes: Record<string, number>; personTypes?: Array<{ type: string; n: number }>; }

const PAGE_SIZE = 25;
const apiHeaders = {
  Accept: "application/json",
  "Content-Type": "application/json",
  Authorization: reciterConfig.backendApiKey,
};

// case-insensitive WCM institution token matcher (F6) — longest variants first
const WCM_RE = /Weill Cornell(?:\s+(?:Medicine|Medical College|Medical Cent(?:er|re)))?/i;

const CLASS_META: Record<string, { label: string; color: string; hint: string }> = {
  buried: { label: "Buried", color: "#b42318", hint: "Production buried it (final < 30)" },
  absent: { label: "Never retrieved", color: "#8a5a00", hint: "Production never scored this person" },
  suggested: { label: "Suggested", color: "#475467", hint: "Already in a curator's pending queue (final ≥ 30)" },
  assigned: { label: "Assigned", color: "#067647", hint: "Accepted by a WCM person" },
};

const ACTION_LABEL: Record<string, string> = {
  accept: "Accepted", reject: "Rejected", snooze: "Snoozed for 90 days", dismiss: "Dismissed", assign: "Assigned",
};

// ---- inline Lucide SVG icons (no npm deps) -------------------------------
type IconProps = { size?: number; style?: CSSProperties };
const svgBase = (size: number, style?: CSSProperties): CSSProperties => ({
  width: size, height: size, flex: "none", stroke: "currentColor", fill: "none",
  strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round", verticalAlign: -2, ...style,
});
const Icon = ({ size = 15, style, children }: IconProps & { children: ReactNode }) => (
  <svg viewBox="0 0 24 24" aria-hidden style={svgBase(size, style)}>{children}</svg>
);
const IconCheck = (p: IconProps) => <Icon {...p}><path d="M20 6 9 17l-5-5" /></Icon>;
const IconChecks = (p: IconProps) => <Icon {...p}><path d="M18 6 7 17l-5-5" /><path d="m22 10-7.5 7.5L13 16" /></Icon>;
const IconX = (p: IconProps) => <Icon {...p}><path d="M18 6 6 18M6 6l12 12" /></Icon>;
const IconChevR = (p: IconProps) => <Icon {...p}><path d="m9 18 6-6-6-6" /></Icon>;
const IconChevD = (p: IconProps) => <Icon {...p}><path d="m6 9 6 6 6-6" /></Icon>;
const IconExt = (p: IconProps) => <Icon {...p}><path d="M15 3h6v6" /><path d="M10 14 21 3" /><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /></Icon>;
const IconPin = (p: IconProps) => <Icon {...p}><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" /><circle cx="12" cy="10" r="3" /></Icon>;
const IconInfo = (p: IconProps) => <Icon {...p}><circle cx="12" cy="12" r="10" /><path d="M12 16v-4M12 8h.01" /></Icon>;
const IconAlert = (p: IconProps) => <Icon {...p}><path d="m21.7 18-8-14a2 2 0 0 0-3.4 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.7-3Z" /><path d="M12 9v4M12 17h.01" /></Icon>;
const IconMore = (p: IconProps) => <Icon {...p}><circle cx="12" cy="12" r="1" /><circle cx="19" cy="12" r="1" /><circle cx="5" cy="12" r="1" /></Icon>;
const IconUsers = (p: IconProps) => <Icon {...p}><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></Icon>;

// ---- small presentational bits -------------------------------------------
// MUI Tooltip with a larger, more readable font (the default tooltip text is tiny).
const Tip = ({ children, ...rest }: any) => (
  <Tooltip {...rest}
    componentsProps={{ tooltip: { style: { fontSize: 13, maxWidth: 380, lineHeight: 1.45, padding: "8px 10px" } } }}>
    {children}
  </Tooltip>
);

// ---- pure helpers --------------------------------------------------------
const hasWcm = (aff?: string) => !!aff && WCM_RE.test(aff);

// Wrap the WCM institution token in <mark>. Returns React nodes (one match).
const highlightAffiliation = (text?: string): ReactNode => {
  if (!text) return null;
  const m = text.match(WCM_RE);
  if (!m || m.index === undefined) return text;
  const before = text.slice(0, m.index);
  const matched = text.slice(m.index, m.index + m[0].length);
  const after = text.slice(m.index + m[0].length);
  return (
    <>
      {before}
      <mark style={{ background: "#f0fdf4", color: "#15803d", padding: "0 3px", borderRadius: 3, fontWeight: 600 }}>{matched}</mark>
      {after}
    </>
  );
};

// IO color band (F2): >=90 green, 50-89 amber, <50 muted grey
const ioColor = (v?: number) => (v == null ? "#94a3b8" : v >= 90 ? "#15803d" : v >= 50 ? "#b45309" : "#94a3b8");
const fmtScore = (v?: number) => (v == null ? "—" : Number.isInteger(v) ? String(v) : v.toFixed(1));
// confidence band (F10): >=0.8 High, 0.5-0.79 Medium, <0.5 Low
const confBand = (c?: number) => (c == null ? "—" : c >= 0.8 ? "High" : c >= 0.5 ? "Medium" : "Low");

const parseCandidates = (json?: string): Candidate[] => {
  if (!json) return [];
  try {
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

// inline IO/FG explanation (F8)
const ioFgNote = (r: AuthorshipRow): string => {
  if (r.top_io_score == null) {
    const wcm = hasWcm(r.author_affiliation);
    return wcm
      ? `Never retrieved — no IO/FG. The affiliation names Weill Cornell${r.top_dept ? ` and the department (${r.top_dept})` : " and the surname is unique"}; production never scored this person.`
      : `Never retrieved — no IO/FG. The surname is unique among WCM identities (${r.top_cohort_size ?? 1} homonym); production never scored this person.`;
  }
  const io = fmtScore(r.top_io_score);
  const fg = fmtScore(r.top_fg_score);
  if (hasWcm(r.author_affiliation)) {
    return `IO ${io} — unique match; FG fell to ${fg} even though the affiliation names Weill Cornell — production under-scored a clear WCM authorship.`;
  }
  return `IO ${io} — name uniquely matches ${r.top_cwid || "this identity"} (${r.top_cohort_size ?? 1} WCM homonym); FG fell to ${fg} because the affiliation names an external institution, not WCM. Identity carries it.`;
};

const btn = (variant: "accept" | "soft" | "ghost", disabled?: boolean): CSSProperties => {
  const base: CSSProperties = {
    display: "inline-flex", alignItems: "center", gap: 6, borderRadius: 7, padding: "6px 12px",
    font: "inherit", fontSize: 13, fontWeight: 600, cursor: disabled ? "default" : "pointer",
    border: "1px solid transparent", whiteSpace: "nowrap", opacity: disabled ? 0.5 : 1,
  };
  if (variant === "accept") return { ...base, background: "#16a34a", color: "#fff" };
  if (variant === "soft") return { ...base, background: "#f0fdf4", color: "#15803d", borderColor: "#bbf7d0" };
  return { ...base, background: "#fff", color: "#475569", borderColor: "#dde3ea" };
};
const iconBtn = (disabled?: boolean): CSSProperties => ({
  background: "transparent", border: "none", color: "#94a3b8", padding: 6, borderRadius: 6,
  cursor: disabled ? "default" : "pointer", display: "inline-flex", opacity: disabled ? 0.5 : 1,
});

// signal chips (F7)
const Chip = ({ kind, children }: { kind: "ok" | "warn" | "neutral"; children: ReactNode }) => {
  const styles: Record<string, CSSProperties> = {
    ok: { background: "#f0fdf4", color: "#15803d", borderColor: "transparent" },
    warn: { background: "#fffbeb", color: "#b45309", borderColor: "transparent" },
    neutral: { background: "#fff", color: "#475569", borderColor: "#dde3ea" },
  };
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11.5, padding: "2px 9px",
      borderRadius: 6, border: "1px solid #dde3ea", ...styles[kind],
    }}>{children}</span>
  );
};

// ---- main component ------------------------------------------------------
const AuthorshipsTabs = () => {
  const [rows, setRows] = useState<AuthorshipRow[]>([]);
  const [count, setCount] = useState(0);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(0);
  const [lane, setLane] = useState<"single" | "all">("single");
  const [classification, setClassification] = useState<"all" | "buried" | "absent" | "suggested">("all");
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [sort, setSort] = useState("io"); // F3: default sort = IO
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [typeAnchor, setTypeAnchor] = useState<HTMLElement | null>(null);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [statusView, setStatusView] = useState<"open" | "snoozed" | "dismissed">("open");
  const [actingId, setActingId] = useState<number | null>(null);
  const [menu, setMenu] = useState<{ anchor: HTMLElement; row: AuthorshipRow } | null>(null);
  // F4: undo holds a BATCH of rows (single-row actions push a 1-element batch)
  const [undo, setUndo] = useState<{ rows: AuthorshipRow[]; label: string } | null>(null);
  const [errorMsg, setErrorMsg] = useState<string>("");
  // selection (bulk) — single-candidate rows only
  const [selected, setSelected] = useState<Set<number>>(new Set());
  // multi-candidate: chosen cwid per row id
  const [picked, setPicked] = useState<Record<number, string>>({});
  // F13: keyboard focus
  const [focusedId, setFocusedId] = useState<number | null>(null);
  const cardRefs = useRef<Record<number, HTMLElement | null>>({});

  const filterBody = useCallback(() => ({
    feed: "unassigned",
    precision: lane === "single" ? "single" : "all",
    classification,
    searchTextInput: search,
    personTypes: selectedTypes,
    dateFrom,
    dateTo,
    sort,
    statusView,
  }), [lane, classification, search, selectedTypes, dateFrom, dateTo, sort, statusView]);

  const fetchData = useCallback(() => {
    setLoading(true);
    fetch("/api/db/authorships", {
      credentials: "same-origin", method: "POST", headers: apiHeaders,
      body: JSON.stringify({ ...filterBody(), limit: PAGE_SIZE, offset: page * PAGE_SIZE }),
    })
      .then((r) => r.json())
      .then((d) => { setRows(d.rows || []); setCount(d.count || 0); })
      .catch((e) => console.error("[authorships]", e))
      .finally(() => setLoading(false));
  }, [filterBody, page]);

  const fetchSummary = useCallback(() => {
    fetch("/api/db/authorships/summary", {
      credentials: "same-origin", method: "POST", headers: apiHeaders,
      body: JSON.stringify({ feed: "unassigned", searchTextInput: search, dateFrom, dateTo, statusView }),
    })
      .then((r) => r.json()).then(setSummary).catch(() => setSummary(null));
  }, [search, dateFrom, dateTo, statusView]);

  // live-filter: debounce the search box so the queue narrows as you type (no Enter needed)
  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput.trim()), 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  useEffect(() => { fetchData(); }, [fetchData]);
  useEffect(() => { fetchSummary(); }, [fetchSummary]);
  // reset to first page when filters, sort, or status view change
  useEffect(() => { setPage(0); }, [lane, classification, search, selectedTypes, dateFrom, dateTo, sort, statusView]);
  // clear transient per-page UI state when the page contents change
  useEffect(() => { setSelected(new Set()); setExpanded(null); setPicked({}); }, [rows]);

  // perform a curator action: optimistically drop the row, POST, then offer Undo (or revert on failure).
  // `extra` carries the assign cwid; the returned promise lets bulk loops await settlement.
  const doActionAsync = useCallback((row: AuthorshipRow, action: string, extra?: Record<string, any>): Promise<boolean> => {
    setRows((rs) => rs.filter((x) => x.id !== row.id));
    setCount((c) => Math.max(0, c - 1));
    return fetch("/api/db/authorships/action", {
      credentials: "same-origin", method: "POST", headers: apiHeaders,
      body: JSON.stringify({ id: row.id, action, ...extra }),
    })
      .then(async (r) => {
        if (!r.ok) throw new Error((await r.text()) || `HTTP ${r.status}`);
        return true;
      });
  }, []);

  // single-row action with its own optimistic remove + Undo (PR-1 behaviour, extended for assign)
  const doAction = useCallback((row: AuthorshipRow, action: string, extra?: Record<string, any>) => {
    setMenu(null);
    setActingId(row.id);
    doActionAsync(row, action, extra)
      .then(() => {
        if (action !== "reopen") setUndo({ rows: [row], label: ACTION_LABEL[action] || "Done" });
        fetchSummary();
      })
      .catch((e) => {
        setErrorMsg(`Couldn't ${action} — ${String(e?.message || e)}`);
        fetchData(); // restore the optimistically-removed row
      })
      .finally(() => setActingId(null));
  }, [doActionAsync, fetchData, fetchSummary]);

  // F5: bulk orchestration — accept a batch of rows, collect into one Undo batch
  const doBulkAccept = useCallback((batch: AuthorshipRow[]) => {
    if (batch.length === 0) return;
    setMenu(null);
    Promise.allSettled(batch.map((row) => doActionAsync(row, "accept")))
      .then((results) => {
        const failed = results.some((r) => r.status === "rejected");
        const ok = batch.filter((_, i) => results[i].status === "fulfilled");
        if (ok.length > 0) setUndo({ rows: ok, label: `Accepted ${ok.length}` });
        if (failed) {
          setErrorMsg("Some accepts failed — refreshing");
          fetchData();
        }
        fetchSummary();
      });
    setSelected(new Set());
  }, [doActionAsync, fetchData, fetchSummary]);

  // undo = reopen over the whole batch (F4: extends PR-1's single-row undo)
  const doUndo = useCallback(() => {
    if (!undo) return;
    const batch = undo.rows;
    setUndo(null);
    Promise.allSettled(batch.map((row) =>
      fetch("/api/db/authorships/action", {
        credentials: "same-origin", method: "POST", headers: apiHeaders,
        body: JSON.stringify({ id: row.id, action: "reopen" }),
      }).then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); })
    )).then((results) => {
      if (results.some((r) => r.status === "rejected")) setErrorMsg("Undo failed for one or more rows");
    }).finally(() => { fetchData(); fetchSummary(); });
  }, [undo, fetchData, fetchSummary]);

  // F12: clicking "+N more" narrows the view to the pmid. The sibling count is scoped
  // only to the status view (it deliberately ignores lane/classification/type/date), so to
  // actually surface all N siblings we must relax those list filters too — otherwise the
  // default single-candidate lane would hide multi-candidate siblings and "+2 more" could
  // narrow to fewer than 2 cards. Lane→all + classification→all matches the count; the
  // person-type/date filters are left intact (they aren't part of the sibling-count scope
  // either, but relaxing lane+classification is what makes the primary mismatch go away).
  const narrowToPmid = useCallback((pmid: number) => {
    setLane("all");
    setClassification("all");
    setSearchInput(String(pmid));
    setSearch(String(pmid));
  }, []);

  const toggleSelect = useCallback((row: AuthorshipRow) => {
    if (!row.single_candidate || statusView !== "open") return; // multi rows aren't bulk-selectable
    setSelected((s) => {
      const next = new Set(s);
      next.has(row.id) ? next.delete(row.id) : next.add(row.id);
      return next;
    });
  }, [statusView]);

  // F13: keyboard nav — J/K move, Y accept (single), N reject, S snooze, X select, Enter open PubMed
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
      if (tag === "input" || tag === "select" || tag === "textarea") return;
      const visible = rows;
      if (visible.length === 0) return;
      const idx = focusedId == null ? -1 : visible.findIndex((r) => r.id === focusedId);
      const focus = (i: number) => {
        const r = visible[Math.max(0, Math.min(visible.length - 1, i))];
        if (r) { setFocusedId(r.id); cardRefs.current[r.id]?.scrollIntoView({ block: "nearest" }); }
      };
      const k = e.key.toLowerCase();
      if (k === "j") { focus(idx + 1); e.preventDefault(); return; }
      if (k === "k") { focus(idx < 0 ? 0 : idx - 1); e.preventDefault(); return; }
      if (focusedId == null) return;
      const row = visible.find((r) => r.id === focusedId);
      if (!row) return;
      if (k === "y") { if (row.single_candidate && statusView === "open") doAction(row, "accept"); else setErrorMsg("Use Pick one ▾ to assign a multi-candidate authorship"); e.preventDefault(); }
      else if (k === "n") { if (statusView === "open") { if (row.single_candidate) doAction(row, "reject"); else setErrorMsg("Use Pick one ▾ / None of these for a multi-candidate authorship"); } e.preventDefault(); }
      else if (k === "s") { if (statusView === "open") doAction(row, "snooze"); e.preventDefault(); }
      else if (k === "x") { toggleSelect(row); e.preventDefault(); }
      else if (e.key === "Enter") { window.open(`https://pubmed.ncbi.nlm.nih.gov/${row.pmid}/`, "_blank", "noreferrer"); e.preventDefault(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [rows, focusedId, statusView, doAction, toggleSelect]);

  const totalPages = Math.max(1, Math.ceil(count / PAGE_SIZE));
  const classChips: Array<typeof classification> = ["all", "buried", "absent", "suggested"];

  // F4: near-certain bulk = visible single-candidate rows with IO >= 95
  const nearCertain = rows.filter((r) => r.single_candidate && (r.top_io_score ?? 0) >= 95);
  const selectedRows = rows.filter((r) => selected.has(r.id));

  return (
    <div style={{ padding: "24px 28px", fontFamily: "Inter, system-ui, -apple-system, 'Segoe UI', sans-serif", color: "#0f172a", maxWidth: 1040, margin: "0 auto" }}>
      <h2 style={{ margin: "0 0 4px", fontSize: 24, fontWeight: 700, letterSpacing: "-0.01em" }}>Authorships</h2>
      <p style={{ color: "#475569", marginTop: 0, marginBottom: 20, maxWidth: 760, fontSize: 14, lineHeight: 1.45 }}>
        WCM-affiliated authorships not yet assigned to an identity. Each card is one decision: is this author the
        proposed WCM person? <strong style={{ color: "#0f172a", fontWeight: 600 }}>IO</strong> (identity-only, the trusted
        signal) leads; <strong style={{ color: "#0f172a", fontWeight: 600 }}>FG</strong> (production) is shown small as
        the diagnosis. Expand a card for the affiliation and evidence.
      </p>

      {/* summary */}
      {summary && (
        <div style={{ display: "flex", gap: 18, margin: "12px 0 18px", color: "#475569", fontSize: 13, flexWrap: "wrap" }}>
          <span><strong style={{ color: "#0f172a" }}>{summary.total.toLocaleString()}</strong> unassigned</span>
          <span><strong style={{ color: "#0f172a" }}>{summary.single_candidate.toLocaleString()}</strong> single-candidate</span>
          {Object.entries(summary.classes).map(([k, v]) => (
            <span key={k}>{CLASS_META[k]?.label || k}: <strong style={{ color: "#0f172a" }}>{v.toLocaleString()}</strong></span>
          ))}
        </div>
      )}

      {/* row 1: status view + sort + keyboard help */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10, flexWrap: "wrap" }}>
        <div style={{ display: "inline-flex", background: "#eef2f7", borderRadius: 7, padding: 2 }}>
          {([["open", "Open"], ["snoozed", "Snoozed"], ["dismissed", "Dismissed"]] as const).map(([key, label]) => (
            <button key={key} onClick={() => setStatusView(key)} style={{
              border: "none", padding: "5px 12px", font: "inherit", fontSize: 13, fontWeight: 600, borderRadius: 5,
              cursor: "pointer", background: statusView === key ? "#fff" : "transparent",
              color: statusView === key ? "#0f172a" : "#475569",
              boxShadow: statusView === key ? "0 1px 2px rgba(15,23,42,.08)" : "none",
            }}>{label}</button>
          ))}
        </div>
        <span style={{ marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: 5, color: "#94a3b8", fontSize: 12 }}>
          <IconInfo size={13} /> <kbd style={kbdStyle}>J</kbd><kbd style={kbdStyle}>K</kbd> move · <kbd style={kbdStyle}>Y</kbd> accept · <kbd style={kbdStyle}>N</kbd> reject · <kbd style={kbdStyle}>S</kbd> snooze
        </span>
        <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, color: "#475569" }}>
          Sort
          <select value={sort} onChange={(e) => setSort(e.target.value)}
            style={{ height: 32, border: "1px solid #dde3ea", borderRadius: 7, background: "#fff", font: "inherit", fontSize: 13, color: "#0f172a", padding: "0 10px", cursor: "pointer" }}>
            <option value="io">Identity-only (IO) — strongest first</option>
            <option value="date">Newest</option>
            <option value="confidence">Confidence</option>
            <option value="precision">Best match</option>
            <option value="fg">Production score</option>
          </select>
        </label>
      </div>

      {/* row 2: lane + classification chips + type + dates + search */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10, flexWrap: "wrap" }}>
        <div style={{ display: "inline-flex", background: "#eef2f7", borderRadius: 7, padding: 2 }}>
          {([["single", "High-precision"], ["all", "All unassigned"]] as const).map(([key, label]) => (
            <Tip key={key} title={key === "single" ? "Only authorships where exactly one WCM identity matches the name" : "Every unassigned authorship"} placement="top" arrow>
              <button onClick={() => setLane(key)} style={{
                border: "none", padding: "5px 11px", font: "inherit", fontSize: 13, fontWeight: 500, borderRadius: 5,
                cursor: "pointer", background: lane === key ? "#fff" : "transparent",
                color: lane === key ? "#2563eb" : "#475569",
                boxShadow: lane === key ? "0 1px 2px rgba(15,23,42,.08)" : "none",
              }}>{label}</button>
            </Tip>
          ))}
        </div>
        <div style={{ display: "inline-flex", background: "#eef2f7", borderRadius: 7, padding: 2 }}>
          {classChips.map((c) => (
            <Tip key={c} title={c === "all" ? "Show every classification" : CLASS_META[c].hint} placement="top" arrow>
              <button onClick={() => setClassification(c)} style={{
                border: "none", padding: "5px 11px", font: "inherit", fontSize: 13, fontWeight: 500, borderRadius: 5,
                cursor: "pointer", background: classification === c ? "#fff" : "transparent",
                color: classification === c ? "#2563eb" : "#475569",
                boxShadow: classification === c ? "0 1px 2px rgba(15,23,42,.08)" : "none",
              }}>{c === "all" ? "All classes" : CLASS_META[c].label}</button>
            </Tip>
          ))}
        </div>
        <button type="button" onClick={(e) => setTypeAnchor(e.currentTarget)}
          style={{ height: 32, display: "inline-flex", alignItems: "center", gap: 6, border: "1px solid #dde3ea", borderRadius: 7, background: "#fff", cursor: "pointer", fontSize: 13, color: "#0f172a", padding: "0 10px", maxWidth: 220, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {selectedTypes.length === 0 ? "All types" : selectedTypes.length === 1 ? selectedTypes[0] : `Type: ${selectedTypes.length}`} <IconChevD size={13} />
        </button>
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <label style={{ fontSize: 12, color: "#475569", display: "flex", alignItems: "center", gap: 6 }} title="Filter by article publication date (from)">
            From
            <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
              style={{ padding: "5px 8px", borderRadius: 7, border: "1px solid #dde3ea", fontSize: 13, color: "#0f172a" }} />
          </label>
          <label style={{ fontSize: 12, color: "#475569", display: "flex", alignItems: "center", gap: 6 }} title="Filter by article publication date (to)">
            To
            <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
              style={{ padding: "5px 8px", borderRadius: 7, border: "1px solid #dde3ea", fontSize: 13, color: "#0f172a" }} />
          </label>
          {(dateFrom || dateTo) && (
            <button type="button" onClick={() => { setDateFrom(""); setDateTo(""); }}
              style={{ padding: "5px 10px", borderRadius: 7, border: "1px solid #dde3ea", background: "#fff", cursor: "pointer", color: "#475569", fontSize: 12 }}>
              Clear dates
            </button>
          )}
          <form onSubmit={(e) => { e.preventDefault(); setSearch(searchInput.trim()); }}>
            <input value={searchInput} onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Filter by name, CWID, or PMID"
              style={{ padding: "6px 10px", borderRadius: 7, border: "1px solid #dde3ea", width: 220, fontSize: 13 }} />
          </form>
        </div>
      </div>

      {/* F4: bulk bar (slim) */}
      {statusView === "open" && (
        <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "6px 0 18px", fontSize: 13, color: "#475569", flexWrap: "wrap" }}>
          <Tip title="Acts on single-candidate rows with IO ≥ 95 on this page only (bounded blast radius)" placement="top" arrow>
            <button disabled={nearCertain.length === 0} style={btn("soft", nearCertain.length === 0)}
              onClick={() => doBulkAccept(nearCertain)}>
              <IconChecks /> Accept near-certain · IO ≥ 95 <strong style={{ fontVariantNumeric: "tabular-nums" }}>({nearCertain.length})</strong>
            </button>
          </Tip>
          {selectedRows.length > 0 && (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              — <strong>{selectedRows.length}</strong> selected
              <button style={{ ...btn("accept"), padding: "4px 10px" }} onClick={() => doBulkAccept(selectedRows)}>
                <IconCheck /> Accept selected
              </button>
            </span>
          )}
          <span style={{ marginLeft: "auto", fontSize: 12, color: "#94a3b8" }}>Bulk acts on single-candidate rows on this page</span>
        </div>
      )}

      {/* card queue */}
      <div>
        {loading && <div style={{ padding: 24, textAlign: "center", color: "#94a3b8" }}>Loading…</div>}
        {!loading && rows.length === 0 && (
          <div style={{ padding: 24, textAlign: "center", color: "#94a3b8" }}>No authorships match these filters.</div>
        )}
        {!loading && rows.map((r) => (
          <AuthorshipCard
            key={r.id}
            row={r}
            statusView={statusView}
            isExpanded={expanded === r.id}
            isSelected={selected.has(r.id)}
            isFocused={focusedId === r.id}
            acting={actingId === r.id}
            pickedCwid={picked[r.id]}
            registerRef={(el) => { cardRefs.current[r.id] = el; }}
            onFocus={() => setFocusedId(r.id)}
            onToggleExpand={() => setExpanded((e) => (e === r.id ? null : r.id))}
            onToggleSelect={() => toggleSelect(r)}
            onPick={(cwid) => setPicked((p) => ({ ...p, [r.id]: cwid }))}
            onAction={(action, extra) => doAction(r, action, extra)}
            onMenu={(anchor) => setMenu({ anchor, row: r })}
            onNarrowPmid={() => narrowToPmid(r.pmid)}
          />
        ))}
      </div>

      {/* pagination */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 18, color: "#475569", fontSize: 13 }}>
        <span style={{ fontVariantNumeric: "tabular-nums" }}>{count.toLocaleString()} authorships · page {page + 1} of {totalPages}</span>
        <span style={{ display: "flex", gap: 8 }}>
          <button disabled={page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))} style={btn("ghost", page === 0)}>Previous</button>
          <button disabled={page + 1 >= totalPages} onClick={() => setPage((p) => p + 1)} style={btn("ghost", page + 1 >= totalPages)}>Next</button>
        </span>
      </div>

      {/* overflow menu: Reject / Snooze / Dismiss.
          Reject writes a "rejected" gold-standard entry against top_cwid — valid only for
          single-candidate rows (the backend 409s on multi). For multi-candidate rows the
          equivalent "this isn't any of them" action is None of these → dismiss. */}
      <Menu anchorEl={menu?.anchor} open={!!menu} onClose={() => setMenu(null)}>
        {menu?.row.single_candidate ? (
          <MenuItem onClick={() => menu && doAction(menu.row, "reject")} style={{ color: "#b91c1c" }}>
            <IconX size={14} style={{ marginRight: 8 }} /> Reject
          </MenuItem>
        ) : (
          <MenuItem onClick={() => menu && doAction(menu.row, "dismiss")} style={{ color: "#b91c1c" }}>
            <IconX size={14} style={{ marginRight: 8 }} /> None of these
          </MenuItem>
        )}
        <MenuItem onClick={() => menu && doAction(menu.row, "snooze")}>Snooze 90 days</MenuItem>
        <MenuItem onClick={() => menu && doAction(menu.row, "dismiss")}>Dismiss</MenuItem>
      </Menu>

      {/* person-type multiselect menu */}
      <Menu anchorEl={typeAnchor} open={!!typeAnchor} onClose={() => setTypeAnchor(null)}>
        {(summary?.personTypes || []).length === 0 && <MenuItem disabled>No types</MenuItem>}
        {(summary?.personTypes || []).map((pt) => (
          <MenuItem key={pt.type} dense onClick={() =>
            setSelectedTypes((s) => s.includes(pt.type) ? s.filter((t) => t !== pt.type) : [...s, pt.type])
          }>
            <Checkbox checked={selectedTypes.includes(pt.type)} size="small" style={{ padding: "0 8px 0 0" }} />
            {pt.type} ({pt.n.toLocaleString()})
          </MenuItem>
        ))}
        {selectedTypes.length > 0 && (
          <MenuItem dense onClick={() => setSelectedTypes([])} style={{ color: "#b42318", fontWeight: 600 }}>Clear selection</MenuItem>
        )}
      </Menu>

      {/* undo (immediate reversal, batched) */}
      <Snackbar open={!!undo} autoHideDuration={6000} onClose={() => setUndo(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
        message={undo ? undo.label : ""}
        action={
          <button onClick={doUndo}
            style={{ color: "#7cc4ff", background: "none", border: "none", cursor: "pointer", fontWeight: 700, fontSize: 13 }}>UNDO</button>
        } />

      {/* error */}
      <Snackbar open={!!errorMsg} autoHideDuration={6000} onClose={() => setErrorMsg("")}
        anchorOrigin={{ vertical: "bottom", horizontal: "left" }} message={errorMsg} />
    </div>
  );
};

const kbdStyle: CSSProperties = {
  font: "inherit", fontSize: 11, background: "#eef2f7", border: "1px solid #dde3ea", borderBottomWidth: 2,
  borderRadius: 4, padding: "0 5px", color: "#475569",
};

// ---- card ----------------------------------------------------------------
interface CardProps {
  row: AuthorshipRow;
  statusView: "open" | "snoozed" | "dismissed";
  isExpanded: boolean;
  isSelected: boolean;
  isFocused: boolean;
  acting: boolean;
  pickedCwid?: string;
  registerRef: (el: HTMLElement | null) => void;
  onFocus: () => void;
  onToggleExpand: () => void;
  onToggleSelect: () => void;
  onPick: (cwid: string) => void;
  onAction: (action: string, extra?: Record<string, any>) => void;
  onMenu: (anchor: HTMLElement) => void;
  onNarrowPmid: () => void;
}

const AuthorshipCard = ({
  row: r, statusView, isExpanded, isSelected, isFocused, acting, pickedCwid,
  registerRef, onFocus, onToggleExpand, onToggleSelect, onPick, onAction, onMenu, onNarrowPmid,
}: CardProps) => {
  const isMulti = !r.single_candidate && (r.n_candidates ?? 0) > 1;
  const isAbsent = r.top_io_score == null;
  const wcm = hasWcm(r.author_affiliation);
  const candidates = isMulti ? parseCandidates(r.candidate_cwids_json) : [];
  const meta = CLASS_META[r.classification || "absent"];

  const cardStyle: CSSProperties = {
    background: isSelected ? "#eff6ff" : "#fff",
    border: "1px solid #e8edf2",
    borderRadius: 10,
    marginBottom: 11,
    boxShadow: isFocused ? "0 0 0 2px #2563eb" : "0 1px 2px rgba(15,23,42,.04)",
    transition: "box-shadow 150ms, background 150ms",
  };

  return (
    <article ref={registerRef} tabIndex={0} onFocus={onFocus} onMouseEnter={onFocus} style={cardStyle}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "13px 15px" }}>
        {/* selection checkbox — single-candidate open rows only */}
        <input type="checkbox" disabled={!r.single_candidate || statusView !== "open"}
          checked={isSelected} onChange={onToggleSelect}
          aria-label={`select ${r.wcm_author || ""}`}
          style={{ width: 16, height: 16, marginTop: 3, accentColor: "#2563eb", cursor: r.single_candidate && statusView === "open" ? "pointer" : "default", flex: "none", opacity: r.single_candidate && statusView === "open" ? 1 : 0.3 }} />

        <div style={{ flex: 1, minWidth: 0 }}>
          {/* L1 — WCM author + position */}
          <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
            <span style={{ fontSize: 15, fontWeight: 600, color: "#0f172a" }}>{r.wcm_author}</span>
            <span style={{ fontSize: 12, color: "#94a3b8" }}>{r.author_position_label} author</span>
            {(r.pmid_sibling_count ?? 1) > 1 && (
              <Tip title="Show all WCM authorships on this paper" placement="top" arrow>
                <button onClick={onNarrowPmid} style={{
                  display: "inline-flex", alignItems: "center", gap: 4, border: "1px solid #e2e9f3", background: "#f4f7fc",
                  color: "#2563eb", borderRadius: 12, padding: "1px 8px", fontSize: 11, fontWeight: 600, cursor: "pointer",
                }}>
                  <IconUsers size={12} /> +{(r.pmid_sibling_count as number) - 1} more WCM authors on this paper
                </button>
              </Tip>
            )}
          </div>

          {/* L2 — proposed identity */}
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 3, fontSize: 13, color: "#475569", flexWrap: "wrap" }}>
            <span style={{ color: "#94a3b8" }}>→</span>
            {isMulti ? (
              <span style={{ color: "#94a3b8" }}>choose among {r.n_candidates} WCM homonyms</span>
            ) : (
              <>
                <span style={{ fontWeight: 600, color: "#0f172a" }}>{r.top_name}</span>
                {r.top_cwid && (
                  <a href={`/curate/${r.top_cwid}`} target="_blank" rel="noreferrer"
                    title={`Open ${r.top_name || r.top_cwid}'s curate profile`}
                    style={{ color: "#2563eb", textDecoration: "none" }}>{r.top_cwid}</a>
                )}
                <span style={{ color: "#94a3b8" }}>· {r.top_person_type}{r.top_dept ? `, ${r.top_dept}` : ""}</span>
              </>
            )}
          </div>

          {/* L3 — paper meta (quiet/truncated) */}
          <div style={{ fontSize: 12.5, color: "#94a3b8", marginTop: 4, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }} title={r.title}>
            {r.title} · <i>{r.journal}</i>{r.entrez_date ? ` · ${r.entrez_date}` : ""} ·{" "}
            <a href={`https://pubmed.ncbi.nlm.nih.gov/${r.pmid}/`} target="_blank" rel="noreferrer" style={{ color: "#94a3b8", textDecoration: "none" }}>
              PMID {r.pmid} <IconExt size={13} />
            </a>
          </div>

          {/* L4 — affiliation one line (WCM highlighted, full on hover) + disclosure */}
          <div style={{ display: "flex", alignItems: "center", gap: 7, marginTop: 7, fontSize: 12.5, color: "#475569" }}>
            <Tip title={r.author_affiliation || "No affiliation"} placement="top-start" arrow>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6, minWidth: 0, cursor: "help" }}>
                <IconPin size={15} style={{ color: "#94a3b8" }} />
                <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 440 }}>
                  {r.author_affiliation ? highlightAffiliation(r.author_affiliation) : "—"}
                </span>
              </span>
            </Tip>
            <button onClick={onToggleExpand} aria-expanded={isExpanded} style={{
              display: "inline-flex", alignItems: "center", gap: 4, marginLeft: "auto", background: "none", border: "none",
              font: "inherit", fontSize: 12, fontWeight: 600, color: isExpanded ? "#2563eb" : "#475569", cursor: "pointer",
              padding: "2px 4px", borderRadius: 5, flex: "none",
            }}>
              {isMulti ? "Pick one" : "Evidence"} {isExpanded ? <IconChevD size={13} /> : <IconChevR size={13} />}
            </button>
          </div>
        </div>

        {/* right rail: score block + primary action + overflow */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, flex: "none" }}>
          <ScoreRail row={r} isMulti={isMulti} isAbsent={isAbsent} candidates={candidates} />
          {statusView === "open" ? (
            isMulti ? (
              <button style={btn("ghost")} onClick={onToggleExpand}>Pick one <IconChevR size={13} /></button>
            ) : (
              <button style={btn("accept", acting)} disabled={acting} onClick={() => onAction("accept")}>
                <IconCheck /> Accept
              </button>
            )
          ) : (
            <button style={btn("ghost", acting)} disabled={acting} onClick={() => onAction("reopen")}>Reopen</button>
          )}
          {statusView === "open" && (
            <button style={iconBtn(acting)} disabled={acting} aria-label="More actions"
              onClick={(e) => onMenu(e.currentTarget)}><IconMore /></button>
          )}
        </div>
      </div>

      {/* snoozed wake-time hint */}
      {statusView === "snoozed" && r.snooze_until && (
        <div style={{ padding: "0 15px 10px 43px", fontSize: 11, color: "#94a3b8" }}>Wakes {r.snooze_until}</div>
      )}

      {/* expanded evidence / pick-one */}
      {isExpanded && (
        <div style={{ padding: "0 15px 14px 43px", fontSize: 13, color: "#475569" }}>
          {isMulti ? (
            <MultiEvidence row={r} candidates={candidates} pickedCwid={pickedCwid} acting={acting}
              onPick={onPick} onAction={onAction} />
          ) : (
            <SingleEvidence row={r} wcm={wcm} isAbsent={isAbsent} />
          )}
        </div>
      )}
    </article>
  );
};

// right-rail score block
const ScoreRail = ({ row: r, isMulti, isAbsent, candidates }: { row: AuthorshipRow; isMulti: boolean; isAbsent: boolean; candidates: Candidate[] }) => {
  if (isMulti) {
    const total = r.n_candidates ?? candidates.length;
    return (
      <div style={{ textAlign: "right", minWidth: 46 }}>
        <span style={{ display: "inline-block", fontSize: 11, fontWeight: 600, padding: "3px 9px", borderRadius: 20, whiteSpace: "nowrap", background: "#fffbeb", color: "#b45309" }}>
          {total} candidates
        </span>
        {r.top_io_score != null && (
          <span style={{ display: "block", fontSize: 10.5, color: "#94a3b8", marginTop: 3, textAlign: "right", fontWeight: 500 }}>
            top IO {fmtScore(r.top_io_score)}
          </span>
        )}
      </div>
    );
  }
  if (isAbsent) {
    return (
      <div style={{ textAlign: "right", minWidth: 46 }}>
        <span style={{ display: "inline-block", fontSize: 11, fontWeight: 600, padding: "3px 9px", borderRadius: 20, whiteSpace: "nowrap", background: "#fffbeb", color: "#b45309" }}>
          Never retrieved
        </span>
        <span style={{ display: "block", fontSize: 10.5, color: "#94a3b8", marginTop: 3, textAlign: "right", fontWeight: 500 }}>
          conf: {confBand(r.top_confidence)}
        </span>
      </div>
    );
  }
  return (
    <div style={{ textAlign: "right", minWidth: 46 }}>
      <div style={{ fontSize: 22, fontWeight: 700, lineHeight: 1, letterSpacing: "-0.02em", fontVariantNumeric: "tabular-nums", color: ioColor(r.top_io_score) }}>
        {fmtScore(r.top_io_score)}
      </div>
      {r.top_fg_score != null && (
        <div style={{ fontSize: 11, color: "#c2410c", marginTop: 3, fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>
          FG {fmtScore(r.top_fg_score)}
        </div>
      )}
    </div>
  );
};

// single-candidate / absent evidence panel
const SingleEvidence = ({ row: r, wcm, isAbsent }: { row: AuthorshipRow; wcm: boolean; isAbsent: boolean }) => (
  <>
    {r.author_affiliation && (
      <div style={{ background: "#f8fafc", border: "1px solid #e8edf2", borderRadius: 7, padding: "9px 11px", lineHeight: 1.55, marginBottom: 9 }}>
        <span style={{ color: "#94a3b8", fontSize: 11, textTransform: "uppercase", letterSpacing: ".04em", display: "block", marginBottom: 3 }}>PubMed affiliation</span>
        {highlightAffiliation(r.author_affiliation)}
      </div>
    )}
    {/* absent → labeled facts, no score blocks (F10) */}
    {isAbsent && (
      <div style={{ display: "flex", gap: 22, marginBottom: 10 }}>
        <div><div style={{ fontSize: 14, fontWeight: 600, color: "#0f172a" }}>{confBand(r.top_confidence)}</div><div style={factLabel}>Confidence</div></div>
        <div><div style={{ fontSize: 14, fontWeight: 600, color: "#0f172a", fontVariantNumeric: "tabular-nums" }}>{r.top_cohort_size ?? "—"}</div><div style={factLabel}>WCM homonym</div></div>
        <div><div style={{ fontSize: 14, fontWeight: 600, color: "#0f172a" }}>{r.top_given_match || "—"}</div><div style={factLabel}>Given name</div></div>
      </div>
    )}
    {/* signal chips (F7) */}
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 9 }}>
      {wcm
        ? <Chip kind="ok"><IconCheck size={13} /> WCM affiliation match</Chip>
        : <Chip kind="warn"><IconAlert size={13} /> No WCM string in affiliation</Chip>}
      {r.top_affil_match
        ? <Chip kind="neutral">Dept: {r.top_dept} ✓</Chip>
        : <Chip kind="neutral">Dept ≠ affiliation</Chip>}
    </div>
    {/* inline IO/FG note (F8) */}
    <div style={{
      display: "flex", gap: 7, fontSize: 12.5, lineHeight: 1.5, borderRadius: 7, padding: "8px 10px",
      background: isAbsent ? "#fffbeb" : "#eff6ff", color: isAbsent ? "#b45309" : "#475569",
    }}>
      {isAbsent ? <IconAlert size={15} style={{ marginTop: 1, color: "#b45309" }} /> : <IconInfo size={15} style={{ marginTop: 1, color: "#2563eb" }} />}
      <span>{ioFgNote(r)}</span>
    </div>
  </>
);

// multi-candidate disambiguation panel (F11)
const MultiEvidence = ({ row: r, candidates, pickedCwid, acting, onPick, onAction }: {
  row: AuthorshipRow; candidates: Candidate[]; pickedCwid?: string; acting: boolean;
  onPick: (cwid: string) => void; onAction: (action: string, extra?: Record<string, any>) => void;
}) => {
  // rank by IO desc; null IO sinks last
  const ranked = [...candidates].sort((a, b) => (b.io_score ?? -1) - (a.io_score ?? -1));
  const scored = ranked.filter((c) => c.io_score != null);
  const unscored = ranked.filter((c) => c.io_score == null);
  const [showAll, setShowAll] = useState(false);
  const anyDeptMatch = candidates.some((c) => c.affil_dept_match);
  const lead = scored[0];
  // The Assign button writes the PRODUCTION gold standard, so it must reflect an
  // EXPLICIT curator pick — never a silent default. We highlight the highest-IO
  // candidate (lead) as a visual hint only; selectedCwid drives the radio state but
  // Assign is gated on pickedCwid below so opening/mis-clicking a card can't write GS.
  const selectedCwid = pickedCwid;
  // when no candidate has an IO score, there is nothing to show in the default view —
  // auto-expand the unscored list so the curator always has a visible choice to pick.
  const visible = showAll || scored.length === 0 ? ranked : scored;

  return (
    <>
      {r.author_affiliation && (
        <div style={{ background: "#f8fafc", border: "1px solid #e8edf2", borderRadius: 7, padding: "9px 11px", lineHeight: 1.55, marginBottom: 9 }}>
          <span style={{ color: "#94a3b8", fontSize: 11, textTransform: "uppercase", letterSpacing: ".04em", display: "block", marginBottom: 3 }}>PubMed affiliation</span>
          {highlightAffiliation(r.author_affiliation)}
        </div>
      )}
      {!anyDeptMatch && (
        <div style={{ display: "flex", gap: 7, fontSize: 12.5, lineHeight: 1.5, borderRadius: 7, padding: "8px 10px", background: "#fffbeb", color: "#b45309", marginBottom: 10 }}>
          <IconAlert size={15} style={{ marginTop: 1 }} />
          <span>The affiliation names Weill Cornell but no department — ranked by identity-only (IO).</span>
        </div>
      )}
      <div>
        {visible.map((c, i) => {
          const isLead = c.cwid === lead?.cwid;
          const checked = c.cwid === selectedCwid;
          return (
            <label key={c.cwid || i} style={{
              display: "flex", alignItems: "center", gap: 11, padding: "9px 11px",
              border: `1px solid ${isLead ? "#bbf7d0" : "#e8edf2"}`, borderRadius: 7, marginBottom: 7, cursor: "pointer",
              background: isLead ? "#f0fdf4" : "#fff",
            }}>
              <input type="radio" name={`m${r.id}`} checked={checked} onChange={() => onPick(c.cwid)}
                style={{ accentColor: "#2563eb", flex: "none" }} />
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ fontSize: 13.5, fontWeight: 600, color: "#0f172a" }}>
                  {c.name}{" "}
                  {c.cwid && <a href={`/curate/${c.cwid}`} target="_blank" rel="noreferrer" style={{ color: "#2563eb", textDecoration: "none", fontWeight: 400 }}>{c.cwid}</a>}
                </span>
                <span style={{ display: "block", fontSize: 12, color: "#94a3b8" }}>
                  {c.person_type}{c.dept ? ` · ${c.dept}` : ""}{c.affil_dept_match ? " · dept✓" : ""}{!hasWcm(r.author_affiliation) ? " · ⚠ no WCM string" : ""}
                </span>
              </span>
              <span style={{ textAlign: "right" }}>
                <span style={{ display: "block", fontSize: 16, fontWeight: 700, lineHeight: 1, fontVariantNumeric: "tabular-nums", color: ioColor(c.io_score) }}>
                  {fmtScore(c.io_score)}
                </span>
                {c.final_score != null && (
                  <span style={{ display: "block", fontSize: 10.5, color: "#c2410c", marginTop: 2, fontVariantNumeric: "tabular-nums" }}>FG {fmtScore(c.final_score)}</span>
                )}
              </span>
            </label>
          );
        })}
        {!showAll && scored.length > 0 && unscored.length > 0 && (
          <button onClick={() => setShowAll(true)} style={{ background: "none", border: "none", color: "#2563eb", fontSize: 12, cursor: "pointer", padding: "2px 0", marginBottom: 8 }}>
            Show all {ranked.length} ({unscored.length} never retrieved, IO unavailable)
          </button>
        )}
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
        <button style={btn("accept", acting || !pickedCwid)} disabled={acting || !pickedCwid}
          onClick={() => pickedCwid && onAction("assign", { cwid: pickedCwid })}>
          <IconCheck /> Assign selected
        </button>
        <button style={btn("ghost", acting)} disabled={acting} onClick={() => onAction("dismiss")}>
          <IconX /> None of these
        </button>
      </div>
    </>
  );
};

const factLabel: CSSProperties = { fontSize: 10.5, color: "#94a3b8", textTransform: "uppercase", letterSpacing: ".04em", marginTop: 1 };

export default AuthorshipsTabs;
