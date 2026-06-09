import { useCallback, useEffect, useState } from "react";
import Tooltip from "@mui/material/Tooltip";
import { reciterConfig } from "../../../../config/local";

// ---- types ---------------------------------------------------------------
interface AuthorshipRow {
  id: number;
  pmid: number;
  author_key: string;
  wcm_author?: string;
  author_position_label?: string;
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
  status?: string;
}

interface Summary { total: number; single_candidate: number; classes: Record<string, number>; }

const PAGE_SIZE = 25;
const apiHeaders = {
  Accept: "application/json",
  "Content-Type": "application/json",
  Authorization: reciterConfig.backendApiKey,
};

const CLASS_META: Record<string, { label: string; color: string; hint: string }> = {
  buried: { label: "Buried", color: "#b42318", hint: "Production buried it (final < 30)" },
  absent: { label: "Never retrieved", color: "#8a5a00", hint: "Production never scored this person" },
  suggested: { label: "Suggested", color: "#475467", hint: "Already in a curator's pending queue (final ≥ 30)" },
  assigned: { label: "Assigned", color: "#067647", hint: "Accepted by a WCM person" },
};

// Column headers; `hint` (when present) renders a hover tooltip explaining the jargon.
const HEADERS: Array<{ label: string; hint?: string }> = [
  { label: "WCM author" },
  { label: "Proposed identity" },
  { label: "FG", hint: "Production (final-gate) score: the authorship-likelihood score ReCiter assigns in production (0–100). Below 30 means production buried this person." },
  { label: "IO", hint: "Identity-only score: likelihood from identity evidence alone (name, affiliation, etc.), ignoring curator feedback (0–100)." },
  { label: "Class", hint: "How production currently treats this authorship — Buried (final < 30), Never retrieved (never scored), Suggested (already pending), or Assigned (accepted)." },
  { label: "Cand.", hint: "Number of WCM identities matching this author name. “1 ✓” = a single, near-certain candidate." },
  { label: "Conf.", hint: "Confidence that the proposed WCM identity is the correct author of this article (0–1)." },
  { label: "Date", hint: "Article publication date (Entrez date)." },
  { label: "Article" },
  { label: "" },
];
const COL_COUNT = HEADERS.length;

// ---- small presentational bits -------------------------------------------
const Badge = ({ text, color, title }: { text: string; color: string; title?: string }) => {
  const chip = (
    <span style={{
      background: color, color: "#fff", borderRadius: 10, padding: "1px 8px",
      fontSize: 11, fontWeight: 600, whiteSpace: "nowrap", cursor: title ? "help" : "default",
    }}>{text}</span>
  );
  return title ? <Tooltip title={title} placement="top" arrow>{chip}</Tooltip> : chip;
};

const Score = ({ value, kind }: { value?: number; kind: "fg" | "io" }) => {
  if (value === null || value === undefined) return <span style={{ color: "#98a2b3" }}>—</span>;
  // IO high = strong identity (green). FG low = buried (red), high = already suggested (grey).
  let color = "#475467";
  if (kind === "io") color = value >= 90 ? "#067647" : value >= 50 ? "#475467" : "#98a2b3";
  if (kind === "fg") color = value < 30 ? "#b42318" : "#475467";
  return <span style={{ color, fontWeight: 600 }}>{value.toFixed(1)}</span>;
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
  const [sort, setSort] = useState("precision");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [expanded, setExpanded] = useState<number | null>(null);

  const filterBody = useCallback(() => ({
    feed: "unassigned",
    precision: lane === "single" ? "single" : "all",
    classification,
    searchTextInput: search,
    dateFrom,
    dateTo,
    sort,
  }), [lane, classification, search, dateFrom, dateTo, sort]);

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
      body: JSON.stringify({ feed: "unassigned", searchTextInput: search, dateFrom, dateTo }),
    })
      .then((r) => r.json()).then(setSummary).catch(() => setSummary(null));
  }, [search, dateFrom, dateTo]);

  // live-filter: debounce the search box so the table narrows as you type (no Enter needed)
  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput.trim()), 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  useEffect(() => { fetchData(); }, [fetchData]);
  useEffect(() => { fetchSummary(); }, [fetchSummary]);
  // reset to first page when filters or sort change
  useEffect(() => { setPage(0); }, [lane, classification, search, dateFrom, dateTo, sort]);

  const totalPages = Math.max(1, Math.ceil(count / PAGE_SIZE));
  const classChips: Array<typeof classification> = ["all", "buried", "absent", "suggested"];

  return (
    <div style={{ padding: "24px 28px", fontFamily: "inherit" }}>
      <h2 style={{ margin: 0, fontSize: 22 }}>Authorships</h2>
      <p style={{ color: "#475467", marginTop: 4, maxWidth: 760 }}>
        WCM-affiliated authorships not yet assigned to any identity. The high-precision lane
        shows authorships where exactly one WCM identity matches the name — near-certain matches.
        <strong> FG</strong> is the production score; <strong> IO</strong> is the identity-only score.
      </p>

      {/* summary */}
      {summary && (
        <div style={{ display: "flex", gap: 18, margin: "12px 0 18px", color: "#475467", fontSize: 13 }}>
          <span><strong style={{ color: "#101828" }}>{summary.total.toLocaleString()}</strong> unassigned</span>
          <span><strong style={{ color: "#101828" }}>{summary.single_candidate.toLocaleString()}</strong> single-candidate</span>
          {Object.entries(summary.classes).map(([k, v]) => (
            <span key={k}>{CLASS_META[k]?.label || k}: <strong style={{ color: "#101828" }}>{v.toLocaleString()}</strong></span>
          ))}
        </div>
      )}

      {/* lane toggle */}
      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        {([["single", "High-precision (single candidate)"], ["all", "All unassigned"]] as const).map(([key, label]) => (
          <button key={key} onClick={() => setLane(key)} style={{
            padding: "6px 14px", borderRadius: 8, border: "1px solid #d0d5dd", cursor: "pointer",
            background: lane === key ? "#1570ef" : "#fff", color: lane === key ? "#fff" : "#344054",
            fontWeight: 600, fontSize: 13,
          }}>{label}</button>
        ))}
      </div>

      {/* classification chips + sort + date filter + search */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
        {classChips.map((c) => (
          <Tooltip key={c} title={c === "all" ? "Show every classification" : CLASS_META[c].hint} placement="top" arrow>
            <button onClick={() => setClassification(c)}
              style={{
                padding: "4px 12px", borderRadius: 16, border: "1px solid #d0d5dd", cursor: "pointer",
                background: classification === c ? "#eff8ff" : "#fff",
                color: classification === c ? "#175cd3" : "#475467", fontSize: 12, fontWeight: 600,
              }}>{c === "all" ? "All classes" : CLASS_META[c].label}</button>
          </Tooltip>
        ))}
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <label style={{ fontSize: 12, color: "#475467", display: "flex", alignItems: "center", gap: 6 }}>
            Sort
            <select value={sort} onChange={(e) => setSort(e.target.value)}
              style={{ padding: "6px 8px", borderRadius: 8, border: "1px solid #d0d5dd", fontSize: 13, color: "#344054" }}>
              <option value="precision">Best match</option>
              <option value="confidence">Confidence</option>
              <option value="date">Newest</option>
              <option value="io">Identity-only score</option>
              <option value="fg">Production score</option>
            </select>
          </label>
          <label style={{ fontSize: 12, color: "#475467", display: "flex", alignItems: "center", gap: 6 }}
            title="Filter by article publication date (from)">
            From
            <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
              style={{ padding: "5px 8px", borderRadius: 8, border: "1px solid #d0d5dd", fontSize: 13, color: "#344054" }} />
          </label>
          <label style={{ fontSize: 12, color: "#475467", display: "flex", alignItems: "center", gap: 6 }}
            title="Filter by article publication date (to)">
            To
            <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
              style={{ padding: "5px 8px", borderRadius: 8, border: "1px solid #d0d5dd", fontSize: 13, color: "#344054" }} />
          </label>
          {(dateFrom || dateTo) && (
            <button type="button" onClick={() => { setDateFrom(""); setDateTo(""); }}
              style={{ padding: "5px 10px", borderRadius: 8, border: "1px solid #d0d5dd", background: "#fff", cursor: "pointer", color: "#475467", fontSize: 12 }}>
              Clear dates
            </button>
          )}
          <form onSubmit={(e) => { e.preventDefault(); setSearch(searchInput.trim()); }}>
            <input value={searchInput} onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Filter by name, CWID, or PMID"
              style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid #d0d5dd", width: 240, fontSize: 13 }} />
          </form>
        </div>
      </div>

      {/* table */}
      <div style={{ border: "1px solid #eaecf0", borderRadius: 10, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ background: "#f9fafb", textAlign: "left", color: "#475467" }}>
              {HEADERS.map((h, i) => (
                <th key={i} style={{ padding: "10px 12px", fontWeight: 600, borderBottom: "1px solid #eaecf0", whiteSpace: "nowrap" }}>
                  {h.hint
                    ? <Tooltip title={h.hint} placement="top" arrow>
                        <span style={{ borderBottom: "1px dotted #98a2b3", cursor: "help" }}>{h.label}</span>
                      </Tooltip>
                    : h.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={COL_COUNT} style={{ padding: 24, textAlign: "center", color: "#98a2b3" }}>Loading…</td></tr>
            )}
            {!loading && rows.length === 0 && (
              <tr><td colSpan={COL_COUNT} style={{ padding: 24, textAlign: "center", color: "#98a2b3" }}>No authorships match these filters.</td></tr>
            )}
            {!loading && rows.map((r) => {
              const meta = CLASS_META[r.classification || "absent"];
              const isOpen = expanded === r.id;
              let alternates: any[] = [];
              if (isOpen && r.candidate_cwids_json) {
                try { alternates = JSON.parse(r.candidate_cwids_json); } catch { alternates = []; }
              }
              return (
                <>
                  <tr key={r.id} style={{ borderBottom: "1px solid #f2f4f7" }}>
                    <td style={{ padding: "10px 12px" }}>
                      <div style={{ fontWeight: 600, color: "#101828" }}>{r.wcm_author}</div>
                      <div style={{ color: "#98a2b3", fontSize: 11 }}>{r.author_position_label} author</div>
                    </td>
                    <td style={{ padding: "10px 12px" }}>
                      <div style={{ color: "#101828" }}>{r.top_name} <span style={{ color: "#1570ef" }}>({r.top_cwid})</span></div>
                      <div style={{ color: "#667085", fontSize: 11 }}>{r.top_person_type}{r.top_dept ? ` · ${r.top_dept}` : ""}</div>
                    </td>
                    <td style={{ padding: "10px 12px" }}><Score value={r.top_fg_score} kind="fg" /></td>
                    <td style={{ padding: "10px 12px" }}><Score value={r.top_io_score} kind="io" /></td>
                    <td style={{ padding: "10px 12px" }}><Badge text={meta.label} color={meta.color} title={meta.hint} /></td>
                    <td style={{ padding: "10px 12px", whiteSpace: "nowrap" }}>
                      {r.single_candidate
                        ? <Badge text="1 ✓" color="#067647" title="Single candidate — near-certain" />
                        : <button onClick={() => setExpanded(isOpen ? null : r.id)} style={{
                            border: "1px solid #d0d5dd", background: "#fff", borderRadius: 6, padding: "2px 8px",
                            cursor: "pointer", color: "#475467", fontSize: 12,
                          }}>{r.n_candidates} ▾</button>}
                    </td>
                    <td style={{ padding: "10px 12px", color: "#475467" }}>{r.top_confidence?.toFixed(2)}</td>
                    <td style={{ padding: "10px 12px", whiteSpace: "nowrap", color: "#475467" }}>{r.entrez_date || "—"}</td>
                    <td style={{ padding: "10px 12px", maxWidth: 360 }}>
                      <div style={{ color: "#101828", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 360 }} title={r.title}>{r.title}</div>
                      <div style={{ color: "#667085", fontSize: 11 }}>{r.journal}</div>
                    </td>
                    <td style={{ padding: "10px 12px" }}>
                      <a href={`https://pubmed.ncbi.nlm.nih.gov/${r.pmid}/`} target="_blank" rel="noreferrer"
                        style={{ color: "#1570ef", textDecoration: "none", fontSize: 12 }}>{r.pmid} ↗</a>
                    </td>
                  </tr>
                  {isOpen && alternates.length > 0 && (
                    <tr key={`${r.id}-exp`} style={{ background: "#fcfcfd" }}>
                      <td colSpan={COL_COUNT} style={{ padding: "8px 12px 12px 24px" }}>
                        <div style={{ color: "#475467", fontSize: 12, marginBottom: 4 }}>Candidate identities (pick one when assigning):</div>
                        <table style={{ fontSize: 12, borderCollapse: "collapse" }}>
                          <tbody>
                            {alternates.map((c, i) => (
                              <tr key={i}>
                                <td style={{ padding: "2px 12px 2px 0", color: "#101828" }}>{c.name} <span style={{ color: "#1570ef" }}>({c.cwid})</span></td>
                                <td style={{ padding: "2px 12px", color: "#667085" }}>{c.person_type}{c.dept ? ` · ${c.dept}` : ""}</td>
                                <td style={{ padding: "2px 12px" }}>IO <Score value={c.io_score} kind="io" /></td>
                                <td style={{ padding: "2px 12px" }}>FG <Score value={c.final_score} kind="fg" /></td>
                                <td style={{ padding: "2px 12px", color: "#667085" }}>conf {Number(c.confidence).toFixed(2)}{c.affil_dept_match ? " · affil✓" : ""}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </td>
                    </tr>
                  )}
                </>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* pagination */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 14, color: "#475467", fontSize: 13 }}>
        <span>{count.toLocaleString()} authorships · page {page + 1} of {totalPages}</span>
        <span style={{ display: "flex", gap: 8 }}>
          <button disabled={page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))}
            style={{ padding: "6px 12px", borderRadius: 8, border: "1px solid #d0d5dd", background: "#fff", cursor: page === 0 ? "default" : "pointer", opacity: page === 0 ? 0.5 : 1 }}>Previous</button>
          <button disabled={page + 1 >= totalPages} onClick={() => setPage((p) => p + 1)}
            style={{ padding: "6px 12px", borderRadius: 8, border: "1px solid #d0d5dd", background: "#fff", cursor: page + 1 >= totalPages ? "default" : "pointer", opacity: page + 1 >= totalPages ? 0.5 : 1 }}>Next</button>
        </span>
      </div>
    </div>
  );
};

export default AuthorshipsTabs;
