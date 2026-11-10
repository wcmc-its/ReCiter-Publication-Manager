// UI refresh 4d-3: the evidence table under a single-candidate row, fed by
// POST /api/db/authorships/candidate-evidence (4d-1). The fetch hook is shared with 4d-4's grid.
import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import { reciterConfig } from "../../../../config/local";
import { MATCH_COLORS } from "../../../utils/identityEvidence";
import { tallyOf } from "../../../utils/candidateEvidence";
import type { CandidateFacts, EvidenceKind, EvidenceRow } from "../../../utils/candidateEvidence";

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
export const TallyBar = ({ rows, width = 150 }: { rows: EvidenceRow[]; width?: number }) => {
  const t = tallyOf(rows);
  const base = t.match + t.partial + t.mismatch || 1;
  const text = [`${t.match} match`, t.partial && `${t.partial} partial`, t.mismatch && `${t.mismatch} mismatch`, t.nodata && `${t.nodata} no data`]
    .filter(Boolean).join(" · ");
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 12.5, color: "#5c6474" }}>
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
