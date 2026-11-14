// UI refresh 4d-3: the evidence table under a single-candidate row, fed by
// POST /api/db/authorships/candidate-evidence (4d-1). The fetch hook is shared with 4d-4's grid.
import { useEffect, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { reciterConfig } from "../../../../config/local";
import { MATCH_COLORS } from "../../../utils/identityEvidence";
import { tallyOf } from "../../../utils/candidateEvidence";
import type { CandidateFacts, EvidenceCandidate, EvidenceKind, EvidenceRow } from "../../../utils/candidateEvidence";

export interface CandidateEvidenceData { coauthors: string[] | null; facts: Record<string, CandidateFacts> }

// One request per row id, tagged with the candidate set it was asked for: when the row's
// candidates change (a re-run moved top_cwid) the tag no longer matches and it refetches. The
// promise is cached, not the answer, so a re-mount while it's in flight (StrictMode, a quick
// collapse and re-expand) shares the one request. A failure is evicted so the next expand retries.
// ponytail: module-level, unbounded — one small entry per expanded row; LRU if sessions get long.
const cache = new Map<number, { tag: string; p: Promise<CandidateEvidenceData>; data?: CandidateEvidenceData }>();

const load = (id: number, tag: string) => {
  const hit = cache.get(id);
  if (hit?.tag === tag) return hit;
  const entry: { tag: string; p: Promise<CandidateEvidenceData>; data?: CandidateEvidenceData } = {
    tag,
    p: fetch("/api/db/authorships/candidate-evidence", {
      credentials: "same-origin", method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json", Authorization: reciterConfig.backendApiKey },
      body: JSON.stringify({ id }),
    }).then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); }),
  };
  entry.p.then((d) => { entry.data = d; }, () => { if (cache.get(id) === entry) cache.delete(id); });
  cache.set(id, entry);
  return entry;
};

type State = { status: "loading" } | { status: "error" } | { status: "ok"; data: CandidateEvidenceData };

export const useCandidateEvidence = (id: number, tag: string): State => {
  const [state, setState] = useState<State>(() => {
    const hit = cache.get(id);
    return hit?.tag === tag && hit.data ? { status: "ok", data: hit.data } : { status: "loading" };
  });
  useEffect(() => {
    let live = true;
    const e = load(id, tag);
    if (e.data) setState({ status: "ok", data: e.data });
    else {
      setState({ status: "loading" });
      e.p.then((data) => { if (live) setState({ status: "ok", data }); }, () => { if (live) setState({ status: "error" }); });
    }
    return () => { live = false; };
  }, [id, tag]);
  return state;
};

export const KIND_SYM: Record<EvidenceKind, string> = { match: "✓", partial: "~", mismatch: "✕", nodata: "?" };
const KIND_TEXT: Record<EvidenceKind, string> = { match: "Match", partial: "Partial", mismatch: "Mismatch", nodata: "No data" };

export const KindPill = ({ kind }: { kind: EvidenceKind }) => (
  <span style={{
    display: "inline-flex", alignItems: "center", gap: 4, width: "fit-content", padding: "0 7px", height: 18,
    borderRadius: 999, fontSize: 11, fontWeight: 600, background: MATCH_COLORS[kind].bg, color: "#1f2937",
    border: `1px solid ${MATCH_COLORS[kind].border}`,
  }}>
    <span aria-hidden="true">{KIND_SYM[kind]}</span>{KIND_TEXT[kind]}
  </span>
);

// Bar + "N match · N partial · N mismatch · N no data", Curate's identity tally (2b). The bar's
// base is the scored rows only, so "no data" never dilutes it.
export const TallyBar = ({ rows, width = 150, compact }: { rows: EvidenceRow[]; width?: number; compact?: boolean }) => {
  const t = tallyOf(rows);
  const base = t.match + t.partial + t.mismatch || 1;
  const text = [`${t.match} match`, t.partial && `${t.partial} partial`, t.mismatch && `${t.mismatch} mismatch`, t.nodata && `${t.nodata} no data`]
    .filter(Boolean).join(" · ");
  return (
    <span style={{ display: "inline-flex", flexDirection: compact ? "column" : "row", alignItems: compact ? "flex-start" : "center", gap: compact ? 3 : 8, fontSize: compact ? 11 : 12.5, color: "#5c6474" }}>
      <span aria-hidden="true" style={{ display: "flex", width, height: 7, borderRadius: 4, overflow: "hidden", background: "#eef0f3" }}>
        {(["match", "partial", "mismatch"] as const).map((k) => (
          <span key={k} style={{ width: `${(100 * t[k]) / base}%`, background: MATCH_COLORS[k].border }} />
        ))}
      </span>
      {text}
    </span>
  );
};

const GRID = "minmax(140px,0.8fr) minmax(0,1fr) minmax(0,1.25fr)";
const HEAD: CSSProperties = { fontSize: 11, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: "#6b7484" };
const MUTED: CSSProperties = { fontSize: 11.5, color: "#6b7484" };

export const EvidenceTable = ({ rows, who }: { rows: EvidenceRow[]; who: string }) => (
  <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 10 }} data-testid="candidate-evidence">
    <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
      <span style={HEAD}>Identity match</span>
      <TallyBar rows={rows} />
    </div>
    <div role="table" aria-label={`Evidence for ${who}`} style={{ border: "1px solid #e5e7eb", borderRadius: 10, overflow: "hidden", background: "#fff" }}>
      <div role="row" style={{ display: "grid", gridTemplateColumns: GRID, gap: 12, padding: "8px 12px", background: "#f7f7f5", ...HEAD }}>
        <span role="columnheader">Evidence</span><span role="columnheader" style={{ textTransform: "none", letterSpacing: 0 }}>{who}</span><span role="columnheader">This article</span>
      </div>
      {rows.map((e) => (
        <div role="row" key={e.label} data-kind={e.kind}
          style={{ display: "grid", gridTemplateColumns: GRID, gap: 12, padding: "9px 12px", borderTop: "1px solid #e5e7eb", fontSize: 12.5, lineHeight: 1.45, alignItems: "start", color: "#1f2937" }}>
          <span role="cell" style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 0 }}>
            <span style={{ fontWeight: 600 }}>{e.label}</span>
            <KindPill kind={e.kind} />
          </span>
          <span role="cell" style={{ minWidth: 0, overflowWrap: "anywhere", color: "#5c6474" }}>{e.theirs || "—"}</span>
          <span role="cell" style={{ minWidth: 0, overflowWrap: "anywhere", display: "flex", flexDirection: "column", gap: 2 }}>
            {/* a long affiliation is clamped to 3 lines; the full text is the tooltip */}
            <span title={e.mine} style={{ display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{e.mine || "—"}</span>
            {e.why && <span style={MUTED}>{e.why}</span>}
          </span>
        </div>
      ))}
    </div>
  </div>
);

// ---- 4d-4: comparison grid --------------------------------------------------------------
// One column per candidate, the same evidence rows lined up, this article's value first. Columns
// are ordered by evidenceStrength then IO; already-rejected candidates go last and never carry
// "Most evidence". A header click calls onPick, the same pick the radio list makes; Assign stays
// gated on that explicit pick. `paged` (4+ candidates) shows two columns at a time with a chip
// strip to jump.
export interface GridCandidate extends EvidenceCandidate { cwid: string }
export { orderByEvidence } from "../../../utils/candidateEvidence";

export const CompareGrid = <C extends GridCandidate>({ cols, pickedCwid, onPick, paged, renderHead }: {
  cols: Array<{ c: C; rows: EvidenceRow[] }>; pickedCwid?: string; onPick: (cwid: string) => void; paged: boolean;
  renderHead: (c: C) => ReactNode;   // name, badges, hover card: owned by the caller
}) => {
  const [start, setStart] = useState(0);
  const per = paged ? 2 : cols.length;
  const from = Math.min(start, Math.max(0, cols.length - per));
  const shown = cols.slice(from, from + per);
  const bestCwid = cols.find((x) => !x.c.already_rejected)?.c.cwid;
  // The builder's row order; a label shows when any candidate has it (Prior decisions is per candidate).
  const labels = LABEL_ORDER.filter((l) => cols.some((x) => x.rows.some((e) => e.label === l)));
  const mineOf = (l: string) => cols.map((x) => x.rows.find((e) => e.label === l)?.mine).find(Boolean);
  const grid = `minmax(100px,0.6fr) minmax(0,1fr) repeat(${shown.length}, minmax(0,1.1fr))`;
  const stop = (e: { stopPropagation: () => void }) => e.stopPropagation();
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, margin: "4px 0 10px" }} data-testid="compare-grid" onClick={stop}>
      <span style={HEAD}>Compare {cols.length} candidates</span>
      {paged && (
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
          <button type="button" aria-label="Previous candidate" disabled={from === 0} onClick={() => setStart(from - 1)} style={pageBtn}>‹</button>
          <button type="button" aria-label="Next candidate" disabled={from + per >= cols.length} onClick={() => setStart(from + 1)} style={pageBtn}>›</button>
          <span style={{ ...MUTED, marginRight: 4, fontVariantNumeric: "tabular-nums" }}>{from + 1}–{from + shown.length} of {cols.length}</span>
          {cols.map((x, i) => {
            const inView = i >= from && i < from + per;
            return (
              <button type="button" key={x.c.cwid} onClick={() => setStart(i)} aria-current={inView || undefined}
                style={{ height: 24, padding: "0 9px", borderRadius: 999, border: `1px solid ${inView ? "#94a3b8" : "#e5e7eb"}`, background: inView ? "#f1f5f9" : "#fff",
                  fontSize: 12, fontWeight: inView ? 600 : 400, cursor: "pointer", fontFamily: "inherit", color: x.c.already_rejected ? "var(--pm-red)" : "#1f2937" }}>
                {x.c.name || x.c.cwid}{x.c.cwid === pickedCwid ? " ✓" : ""}
              </button>
            );
          })}
        </div>
      )}
      {/* no overflow:hidden here: it would clip the identity hover card in the headers */}
      <div role="table" style={{ border: "1px solid #e5e7eb", borderRadius: 10, background: "#fff" }}>
        <div role="row" style={{ display: "grid", gridTemplateColumns: grid, gap: 10, padding: "10px 12px", background: "#f7f7f5", alignItems: "stretch", borderRadius: "10px 10px 0 0" }}>
          <span role="columnheader" style={{ ...HEAD, alignSelf: "end" }}>Evidence</span>
          <span role="columnheader" style={{ ...HEAD, alignSelf: "end" }}>This article</span>
          {shown.map(({ c, rows }) => {
            const picked = c.cwid === pickedCwid;
            return (
              <div role="columnheader" key={c.cwid} aria-pressed={picked} tabIndex={0}
                onClick={() => onPick(c.cwid)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onPick(c.cwid); } }}
                title={`Pick ${c.name || c.cwid}`}
                style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 0, padding: "7px 9px", borderRadius: 8, cursor: "pointer",
                  border: `1px solid ${picked ? "var(--pm-slate)" : c.already_rejected ? "var(--pm-red-tint-border)" : "#e5e7eb"}`,
                  background: picked ? "var(--pm-slate-tint)" : c.already_rejected ? "var(--pm-red-tint)" : "#fff" }}>
                <span style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
                  <span aria-hidden="true" style={{ width: 13, height: 13, flex: "none", borderRadius: "50%", boxSizing: "border-box", background: "#fff",
                    border: picked ? "4px solid var(--pm-slate)" : "1.5px solid #94a3b8" }} />
                  {renderHead(c)}
                </span>
                <span style={{ ...MUTED, fontVariantNumeric: "tabular-nums" }}>IO {c.io_score == null ? "—" : Math.round(c.io_score)}</span>
                <TallyBar rows={rows} width={110} compact />
                {c.cwid === bestCwid && <span style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: "0.03em", color: "var(--pm-slate)" }}>MOST EVIDENCE</span>}
              </div>
            );
          })}
        </div>
        {labels.map((l) => (
          <div role="row" key={l} style={{ display: "grid", gridTemplateColumns: grid, gap: 10, padding: "8px 12px", borderTop: "1px solid #e5e7eb", fontSize: 12.5, lineHeight: 1.45, alignItems: "start", color: "#1f2937" }}>
            <span role="rowheader" style={{ fontWeight: 600 }}>{l}</span>
            <span role="cell" title={mineOf(l)} style={{ minWidth: 0, overflowWrap: "anywhere", display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{mineOf(l) || "—"}</span>
            {shown.map(({ c, rows }) => {
              const e = rows.find((x) => x.label === l);
              return (
                <span role="cell" key={c.cwid} data-kind={e?.kind} style={{ minWidth: 0, overflowWrap: "anywhere", display: "flex", flexDirection: "column", gap: 3 }}>
                  {e ? <>
                    <KindPill kind={e.kind} />
                    {e.theirs && <span style={{ color: "#5c6474" }}>{e.theirs}</span>}
                    {e.why && <span style={MUTED}>{e.why}</span>}
                  </> : <span style={MUTED}>—</span>}
                </span>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
};

const LABEL_ORDER = ["Name", "Given name", "Email", "Institution", "Department", "Co-authors", "Journal", "Career window", "Prior decisions", "Identity-Only Score"];
const pageBtn: CSSProperties = { width: 26, height: 26, borderRadius: 6, border: "1px solid #cbd5e1", background: "#fff", cursor: "pointer", fontSize: 15, lineHeight: 1, padding: 0 };
