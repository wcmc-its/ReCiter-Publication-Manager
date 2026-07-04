import React, { useCallback, useEffect, useState } from "react";
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
  snooze_until?: string;
  reviewer?: string;
  resolved_at?: string;
}

interface Summary { total: number; single_candidate: number; classes: Record<string, number>; }

type StatusView = "open" | "snoozed" | "dismissed";

const PAGE_SIZE = 25;
const apiHeaders = {
  Accept: "application/json",
  "Content-Type": "application/json",
  Authorization: reciterConfig.backendApiKey,
};

// curator-action -> undo-bar label
const ACTION_LABEL: Record<string, string> = {
  accept: "Accepted", reject: "Rejected", snooze: "Snoozed for 90 days", dismiss: "Dismissed",
};

const CLASS_META: Record<string, { label: string; color: string; hint: string }> = {
  buried: { label: "Buried", color: "#b42318", hint: "Production buried it (final < 30)" },
  absent: { label: "Never retrieved", color: "#8a5a00", hint: "Production never scored this person" },
  suggested: { label: "Suggested", color: "#475467", hint: "Already in a curator's pending queue (final ≥ 30)" },
  assigned: { label: "Assigned", color: "#067647", hint: "Accepted by a WCM person" },
};

// ---- small presentational bits -------------------------------------------
const Badge = ({ text, color, title }: { text: string; color: string; title?: string }) => (
  <span title={title} style={{
    background: color, color: "#fff", borderRadius: 10, padding: "1px 8px",
    fontSize: 11, fontWeight: 600, whiteSpace: "nowrap",
  }}>{text}</span>
);

const Score = ({ value, kind }: { value?: number; kind: "fg" | "io" }) => {
  if (value === null || value === undefined) return <span style={{ color: "#98a2b3" }}>—</span>;
  // IO high = strong identity (green). FG low = buried (red), high = already suggested (grey).
  let color = "#475467";
  if (kind === "io") color = value >= 90 ? "#067647" : value >= 50 ? "#475467" : "#98a2b3";
  if (kind === "fg") color = value < 30 ? "#b42318" : "#475467";
  return <span style={{ color, fontWeight: 600 }}>{value.toFixed(1)}</span>;
};

// ---- action-control styles -----------------------------------------------
const acceptBtn = (busy: boolean): React.CSSProperties => ({
  border: "1px solid #067647", background: busy ? "#f2f4f7" : "#067647", color: busy ? "#98a2b3" : "#fff",
  borderRadius: 6, padding: "3px 10px", fontSize: 12, fontWeight: 600, cursor: busy ? "default" : "pointer",
});
const ghostBtn = (busy: boolean): React.CSSProperties => ({
  border: "1px solid #d0d5dd", background: "#fff", color: "#344054", borderRadius: 6,
  padding: "3px 10px", fontSize: 12, fontWeight: 600, cursor: busy ? "default" : "pointer", opacity: busy ? 0.5 : 1,
});
const kebabBtn: React.CSSProperties = {
  border: "1px solid #d0d5dd", background: "#fff", color: "#475467", borderRadius: 6,
  padding: "3px 8px", fontSize: 14, lineHeight: 1, cursor: "pointer",
};
const menuItem = (color = "#344054"): React.CSSProperties => ({
  display: "block", width: "100%", textAlign: "left", border: "none", background: "#fff", color,
  padding: "7px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap",
});

// ---- main component ------------------------------------------------------
const AuthorshipsTabs = () => {
  const [rows, setRows] = useState<AuthorshipRow[]>([]);
  const [count, setCount] = useState(0);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(0);
  const [statusView, setStatusView] = useState<StatusView>("open");
  const [lane, setLane] = useState<"single" | "all">("single");
  const [classification, setClassification] = useState<"all" | "buried" | "absent" | "suggested">("all");
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [expanded, setExpanded] = useState<number | null>(null);
  // curator-action state
  const [actingId, setActingId] = useState<number | null>(null);
  const [menuId, setMenuId] = useState<number | null>(null);
  const [undo, setUndo] = useState<{ row: AuthorshipRow; label: string } | null>(null);
  const [errorMsg, setErrorMsg] = useState("");

  const filterBody = useCallback(() => ({
    feed: "unassigned",
    statusView,
    precision: lane === "single" ? "single" : "all",
    classification,
    searchTextInput: search,
    sort: "precision",
  }), [statusView, lane, classification, search]);

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
      body: JSON.stringify({ feed: "unassigned", statusView, searchTextInput: search }),
    })
      .then((r) => r.json()).then(setSummary).catch(() => setSummary(null));
  }, [statusView, search]);

  useEffect(() => { fetchData(); }, [fetchData]);
  useEffect(() => { fetchSummary(); }, [fetchSummary]);
  // reset to first page when filters change
  useEffect(() => { setPage(0); }, [statusView, lane, classification, search]);
  // auto-dismiss the undo bar and error toast
  useEffect(() => { if (!undo) return; const t = setTimeout(() => setUndo(null), 6000); return () => clearTimeout(t); }, [undo]);
  useEffect(() => { if (!errorMsg) return; const t = setTimeout(() => setErrorMsg(""), 6000); return () => clearTimeout(t); }, [errorMsg]);

  // ---- curator action: POST, then refetch the current view -----------------
  // Resolved rows (accepted/rejected) appear in no view, so the undo bar is the only
  // reversal path for accept/reject — reopen is also reachable in Snoozed/Dismissed.
  const act = useCallback((row: AuthorshipRow, action: string, extra?: Record<string, any>) => {
    setMenuId(null);
    setActingId(row.id);
    fetch("/api/db/authorships/action", {
      credentials: "same-origin", method: "POST", headers: apiHeaders,
      body: JSON.stringify({ id: row.id, action, ...extra }),
    })
      .then(async (r) => { if (!r.ok) throw new Error((await r.text()) || `HTTP ${r.status}`); })
      .then(() => {
        setUndo(action === "reopen" ? null : { row, label: ACTION_LABEL[action] || "Done" });
        fetchData();
        fetchSummary();
      })
      .catch((e) => setErrorMsg(`Couldn't ${action} — ${String(e?.message || e)}`))
      .finally(() => setActingId(null));
  }, [fetchData, fetchSummary]);

  const doUndo = useCallback(() => {
    if (!undo) return;
    const row = undo.row;
    setUndo(null);
    act(row, "reopen");
  }, [undo, act]);

  const totalPages = Math.max(1, Math.ceil(count / PAGE_SIZE));
  const classChips: Array<typeof classification> = ["all", "buried", "absent", "suggested"];
  const statusTabs: Array<[StatusView, string]> = [["open", "Open"], ["snoozed", "Snoozed"], ["dismissed", "Dismissed"]];

  return (
    <div style={{ padding: "24px 28px", fontFamily: "inherit" }}>
      <h2 style={{ margin: 0, fontSize: 22 }}>Authorships</h2>
      <p style={{ color: "#475467", marginTop: 4, maxWidth: 760 }}>
        WCM-affiliated authorships not yet assigned to any identity. The high-precision lane
        shows authorships where exactly one WCM identity matches the name — near-certain matches.
        <strong> FG</strong> is the production score; <strong> IO</strong> is the identity-only score.
      </p>

      {/* status view */}
      <div style={{ display: "inline-flex", background: "#eef2f7", borderRadius: 8, padding: 2, margin: "14px 0 6px" }}>
        {statusTabs.map(([key, label]) => (
          <button key={key} onClick={() => setStatusView(key)} style={{
            border: "none", padding: "6px 14px", font: "inherit", fontSize: 13, fontWeight: 600,
            borderRadius: 6, cursor: "pointer",
            background: statusView === key ? "#fff" : "transparent",
            color: statusView === key ? "#101828" : "#475467",
            boxShadow: statusView === key ? "0 1px 2px rgba(16,24,40,.1)" : "none",
          }}>{label}</button>
        ))}
      </div>

      {/* summary */}
      {summary && (
        <div style={{ display: "flex", gap: 18, margin: "12px 0 18px", color: "#475467", fontSize: 13 }}>
          <span><strong style={{ color: "#101828" }}>{summary.total.toLocaleString()}</strong> {statusView}</span>
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

      {/* classification chips + search */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
        {classChips.map((c) => (
          <button key={c} onClick={() => setClassification(c)} style={{
            padding: "4px 12px", borderRadius: 16, border: "1px solid #d0d5dd", cursor: "pointer",
            background: classification === c ? "#eff8ff" : "#fff",
            color: classification === c ? "#175cd3" : "#475467", fontSize: 12, fontWeight: 600,
          }}>{c === "all" ? "All classes" : CLASS_META[c].label}</button>
        ))}
        <form onSubmit={(e) => { e.preventDefault(); setSearch(searchInput.trim()); }} style={{ marginLeft: "auto" }}>
          <input value={searchInput} onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search name, CWID, or PMID"
            style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid #d0d5dd", width: 240, fontSize: 13 }} />
        </form>
      </div>

      {/* table */}
      <div style={{ border: "1px solid #eaecf0", borderRadius: 10, overflow: "visible" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ background: "#f9fafb", textAlign: "left", color: "#475467" }}>
              {["WCM author", "Proposed identity", "FG", "IO", "Class", "Cand.", "Conf.", "Article", "", "Actions"].map((h, i) => (
                <th key={i} style={{ padding: "10px 12px", fontWeight: 600, borderBottom: "1px solid #eaecf0", whiteSpace: "nowrap" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={10} style={{ padding: 24, textAlign: "center", color: "#98a2b3" }}>Loading…</td></tr>
            )}
            {!loading && rows.length === 0 && (
              <tr><td colSpan={10} style={{ padding: 24, textAlign: "center", color: "#98a2b3" }}>No authorships match these filters.</td></tr>
            )}
            {!loading && rows.map((r) => {
              const meta = CLASS_META[r.classification || "absent"];
              const isOpen = expanded === r.id;
              const acting = actingId === r.id;
              let alternates: any[] = [];
              if (isOpen && r.candidate_cwids_json) {
                try { alternates = JSON.parse(r.candidate_cwids_json); } catch { alternates = []; }
              }
              return (
               <React.Fragment key={r.id}>
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
                    <td style={{ padding: "10px 12px", maxWidth: 360 }}>
                      <div style={{ color: "#101828", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 360 }} title={r.title}>{r.title}</div>
                      <div style={{ color: "#667085", fontSize: 11 }}>{r.journal}{r.entrez_date ? ` · ${r.entrez_date}` : ""}</div>
                      {r.status === "snoozed" && r.snooze_until && (
                        <div style={{ color: "#98a2b3", fontSize: 11 }}>Wakes {r.snooze_until}</div>
                      )}
                    </td>
                    <td style={{ padding: "10px 12px" }}>
                      <a href={`https://pubmed.ncbi.nlm.nih.gov/${r.pmid}/`} target="_blank" rel="noreferrer"
                        style={{ color: "#1570ef", textDecoration: "none", fontSize: 12 }}>{r.pmid} ↗</a>
                    </td>
                    {/* curator actions */}
                    <td style={{ padding: "10px 12px", whiteSpace: "nowrap" }}>
                      {statusView === "open" ? (
                        <div style={{ display: "flex", gap: 6, alignItems: "center", position: "relative" }}>
                          {r.single_candidate && (
                            <button disabled={acting} onClick={() => act(r, "accept")} style={acceptBtn(acting)}>Accept</button>
                          )}
                          <button onClick={() => setMenuId(menuId === r.id ? null : r.id)} style={kebabBtn} title="More actions">⋯</button>
                          {menuId === r.id && (
                            <>
                              <div onClick={() => setMenuId(null)} style={{ position: "fixed", inset: 0, zIndex: 10 }} />
                              <div style={{
                                position: "absolute", top: "100%", right: 0, marginTop: 4, zIndex: 11,
                                background: "#fff", border: "1px solid #eaecf0", borderRadius: 8,
                                boxShadow: "0 4px 12px rgba(16,24,40,.12)", overflow: "hidden", minWidth: 150,
                              }}>
                                {r.single_candidate && (
                                  <button style={menuItem("#b42318")} onClick={() => act(r, "reject")}>Reject</button>
                                )}
                                <button style={menuItem()} onClick={() => act(r, "snooze")}>Snooze 90 days</button>
                                <button style={menuItem()} onClick={() => act(r, "dismiss")}>Dismiss</button>
                              </div>
                            </>
                          )}
                        </div>
                      ) : (
                        <button disabled={acting} onClick={() => act(r, "reopen")} style={ghostBtn(acting)}>Reopen</button>
                      )}
                    </td>
                  </tr>
                  {isOpen && alternates.length > 0 && (
                    <tr key={`${r.id}-exp`} style={{ background: "#fcfcfd" }}>
                      <td colSpan={10} style={{ padding: "8px 12px 12px 24px" }}>
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
                 </React.Fragment>
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

      {/* undo bar */}
      {undo && (
        <div style={{
          position: "fixed", bottom: 24, left: 24, zIndex: 20, display: "flex", alignItems: "center", gap: 14,
          background: "#101828", color: "#fff", borderRadius: 10, padding: "10px 16px",
          boxShadow: "0 8px 24px rgba(16,24,40,.22)", fontSize: 13,
        }}>
          <span>{undo.label}</span>
          <button onClick={doUndo} style={{ background: "none", border: "none", color: "#7cc4ff", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>UNDO</button>
        </div>
      )}

      {/* error toast */}
      {errorMsg && (
        <div style={{
          position: "fixed", bottom: 24, right: 24, zIndex: 20, display: "flex", alignItems: "center", gap: 14,
          background: "#b42318", color: "#fff", borderRadius: 10, padding: "10px 16px",
          boxShadow: "0 8px 24px rgba(16,24,40,.22)", fontSize: 13, maxWidth: 420,
        }}>
          <span>{errorMsg}</span>
          <button onClick={() => setErrorMsg("")} style={{ background: "none", border: "none", color: "#fecdca", fontWeight: 700, fontSize: 14, cursor: "pointer" }}>✕</button>
        </div>
      )}
    </div>
  );
};

export default AuthorshipsTabs;
