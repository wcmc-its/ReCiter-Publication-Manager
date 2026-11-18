// UI refresh 4d-3: the evidence table under a single-candidate row, fed by
// POST /api/db/authorships/candidate-evidence (4d-1). The fetch hook is shared with 4d-4's grid.
import { useEffect, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { reciterConfig } from "../../../../config/local";
import { mostEvidenceCwid, tallyOf } from "../../../utils/candidateEvidence";
import { isDeliberateClick } from "../../../utils/authorshipRow";
import type { CandidateFacts, EvidenceCandidate, EvidenceKind, EvidenceRow } from "../../../utils/candidateEvidence";

export interface CandidateEvidenceData {
  coauthors: string[] | null;
  // The whole byline in order and this row's author's index in it (-1 = not found); null when
  // the paper's author list isn't available. For the expanded row's "Authors" line.
  authors?: string[] | null;
  target?: number;
  facts: Record<string, CandidateFacts>;
}

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
// The prototype's evidence palette (app_logic KIND): slate for for, amber for partial, red for
// against, grey for nothing to go on. Text and dot share the colour; the fill is its tint.
export const KIND_TONE: Record<EvidenceKind, { c: string; bg: string }> = {
  match: { c: "var(--pm-slate)", bg: "var(--pm-slate-tint)" },
  partial: { c: "var(--pm-amber)", bg: "var(--pm-amber-tint)" },
  mismatch: { c: "var(--pm-red)", bg: "var(--pm-red-tint)" },
  nodata: { c: "var(--pm-muted-foreground)", bg: "var(--pm-surface-2)" },
};

export const KindPill = ({ kind }: { kind: EvidenceKind }) => (
  <span data-kindpill={kind} style={{
    display: "inline-flex", alignItems: "center", gap: 5, width: "fit-content", padding: "0 7px", height: 18,
    borderRadius: 999, fontSize: 11, fontWeight: 600, background: KIND_TONE[kind].bg, color: KIND_TONE[kind].c, whiteSpace: "nowrap",
  }}>
    <span aria-hidden="true" style={{ width: 6, height: 6, borderRadius: "50%", background: KIND_TONE[kind].c, flex: "none" }} />{KIND_TEXT[kind]}
  </span>
);

const tallyText = (rows: EvidenceRow[]) => {
  const t = tallyOf(rows);
  return [`${t.match} match`, t.partial && `${t.partial} partial`, t.mismatch && `${t.mismatch} mismatch`, t.nodata && `${t.nodata} no data`]
    .filter(Boolean).join(" · ");
};

// The match / partial / mismatch bar. Its base is the scored rows only, so "no data" never
// dilutes it.
const Bar = ({ rows, width, height, track }: { rows: EvidenceRow[]; width: number | string; height: number; track: string }) => {
  const t = tallyOf(rows);
  const base = t.match + t.partial + t.mismatch || 1;
  return (
    <span aria-hidden="true" style={{ display: "flex", width, height, borderRadius: height / 2, overflow: "hidden", background: track, flex: "none" }}>
      {(["match", "partial", "mismatch"] as const).map((k) => (
        <span key={k} style={{ width: `${(100 * t[k]) / base}%`, background: KIND_TONE[k].c }} />
      ))}
    </span>
  );
};

// Bar + "N match · N partial · N mismatch · N no data", the prototype's identity tally.
export const TallyBar = ({ rows, width = 150 }: { rows: EvidenceRow[]; width?: number }) => (
  <span style={{ display: "inline-flex", alignItems: "center", gap: 12, fontSize: 12.5, color: "var(--pm-muted-foreground)" }}>
    <Bar rows={rows} width={width} height={7} track="var(--pm-surface-2)" />
    {tallyText(rows)}
  </span>
);

const GRID = "minmax(150px,0.85fr) minmax(0,1fr) minmax(0,1.25fr)";
export const HEAD: CSSProperties = { fontSize: 11, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--pm-muted-foreground)" };
const MUTED: CSSProperties = { fontSize: 11.5, color: "var(--pm-muted-foreground)" };
const TABLE: CSSProperties = { border: "1px solid var(--pm-border)", borderRadius: 10, background: "#fff" };
const ROW: CSSProperties = { padding: "9px 12px", borderTop: "1px solid var(--pm-border)", fontSize: 12.5, lineHeight: 1.45, alignItems: "start", color: "var(--pm-foreground)" };
const IO_LABEL = "Identity-Only Score";

// One candidate's evidence (prototype markup ~1117-1133). The Identity-Only Score belongs to the
// article ("99 · High" under This article), so its row shows "—" under the person.
export const EvidenceTable = ({ rows, who, note }: { rows: EvidenceRow[]; who: string; note?: ReactNode }) => (
  <div style={{ display: "flex", flexDirection: "column", gap: 10 }} data-testid="candidate-evidence">
    <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
      <span style={HEAD}>Identity match</span>
      <TallyBar rows={rows} />
      {note}
    </div>
    <div role="table" aria-label={`Evidence for ${who}`} style={{ ...TABLE, overflow: "hidden" }}>
      <div role="row" style={{ display: "grid", gridTemplateColumns: GRID, gap: 12, padding: "8px 12px", background: "var(--pm-surface-2)", ...HEAD }}>
        <span role="columnheader">Evidence</span><span role="columnheader">{who}</span><span role="columnheader">This article</span>
      </div>
      {rows.map((e) => {
        const io = e.label === IO_LABEL;
        const theirs = io ? undefined : e.theirs;
        const mine = io ? e.theirs || e.why : e.mine;
        const why = io ? undefined : e.why;
        return (
          <div role="row" key={e.label} data-kind={e.kind} style={{ display: "grid", gridTemplateColumns: GRID, gap: 12, ...ROW }}>
            <span role="cell" style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 0 }}>
              <span style={{ fontWeight: 600 }}>{e.label}</span>
              <KindPill kind={e.kind} />
            </span>
            <span role="cell" style={{ minWidth: 0, overflowWrap: "anywhere", color: "var(--pm-muted-foreground)" }}>{theirs || "—"}</span>
            <span role="cell" style={{ minWidth: 0, overflowWrap: "anywhere", display: "flex", flexDirection: "column", gap: 2 }}>
              {/* a long affiliation is clamped to 3 lines; the full text is the tooltip */}
              <span title={mine} style={{ display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{mine || "—"}</span>
              {why && <span style={MUTED}>{why}</span>}
            </span>
          </div>
        );
      })}
    </div>
  </div>
);

// ---- 4d-4: comparison grid --------------------------------------------------------------
// One column per candidate, the same evidence rows lined up, this article's value first. Columns
// are ordered by evidenceStrength then IO; already-rejected candidates go last and never carry
// "Most evidence". A header click calls onPick, the same pick the row's radios make; Accept stays
// gated on that explicit pick. Two or three candidates show side by side; four or more page two
// at a time (prototype authCompare: K = n <= 3 ? n : 2), wrapping round, with a chip per person.
export interface GridCandidate extends EvidenceCandidate { cwid: string }
export { orderByEvidence } from "../../../utils/candidateEvidence";

const stripPx = (n: number) => (n >= 3 ? "var(--pm-slate)" : n >= 0 ? "var(--pm-amber)" : "var(--pm-red)");

export const CompareGrid = <C extends GridCandidate>({ cols, onPick, renderHead, hint }: {
  // Clicking a person's column heading assigns the authorship to them, in one click.
  // undefined = read-only (a parked queue): the headers are not a picker.
  cols: Array<{ c: C; rows: EvidenceRow[] }>; onPick?: (cwid: string) => void;
  renderHead: (c: C) => ReactNode;   // name, badges, hover card: owned by the caller
  hint: string;
}) => {
  const n = cols.length;
  const per = n <= 3 ? n : 2;
  const [start, setStart] = useState(0);
  const off = ((start % n) + n) % n;
  const shown = Array.from({ length: per }, (_, j) => cols[(off + j) % n]);
  const score = (rows: EvidenceRow[]) => rows.reduce((t, e) => t + ({ match: 1, partial: 0.4, mismatch: -1, nodata: 0 })[e.kind], 0);
  // "Most evidence" only when one candidate leads outright, on the same strength the columns are
  // ordered by, and has not already rejected the paper.
  const bestCwid = mostEvidenceCwid(cols);
  // The builder's row order; a label shows when any shown candidate has it (Prior decisions is per candidate).
  const labels = LABEL_ORDER.filter((l) => shown.some((x) => x.rows.some((e) => e.label === l)));
  const mineOf = (l: string) => (l === IO_LABEL ? "Scored per person →" : cols.map((x) => x.rows.find((e) => e.label === l)?.mine).find(Boolean));
  const grid = `minmax(96px,0.7fr) minmax(0,1fr) repeat(${per}, minmax(0,1fr))`;
  const stop = (e: { stopPropagation: () => void }) => e.stopPropagation();
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }} data-testid="compare-grid" onClick={stop}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <span style={HEAD}>Compare {n} candidates</span>
        <span data-compare-hint style={{ fontSize: 12.5, color: onPick ? "var(--pm-slate)" : "var(--pm-muted-foreground)" }}>{hint}</span>
      </div>
      {per < n && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <button type="button" aria-label="Previous candidate" title="Previous candidate" onClick={() => setStart(off - 1)} className="pm-cmp-page" style={pageBtn}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>
          </button>
          <button type="button" aria-label="Next candidate" title="Next candidate" onClick={() => setStart(off + 1)} className="pm-cmp-page" style={pageBtn}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6" /></svg>
          </button>
          <span style={{ fontSize: 12, color: "var(--pm-muted-foreground)", fontVariantNumeric: "tabular-nums", marginRight: 4 }}>
            Showing {shown.map((_, j) => ((off + j) % n) + 1).join(" and ")} of {n} · strongest first
          </span>
          {cols.map((x, i) => {
            const inView = shown.some((y) => y.c.cwid === x.c.cwid);
            return (
              <button type="button" key={x.c.cwid} onClick={() => setStart(i)} aria-current={inView || undefined}
                title={`${x.c.name || x.c.cwid} · ${x.c.cwid} · ${tallyText(x.rows)}`}
                style={{ height: 26, padding: "0 9px", borderRadius: 999, display: "inline-flex", alignItems: "center", gap: 6, cursor: "pointer",
                  border: `1px solid ${inView ? "var(--pm-slate-tint-border)" : "var(--pm-border-strong)"}`, background: inView ? "var(--pm-slate-tint)" : "#fff",
                  fontSize: 12, fontWeight: inView ? 600 : 500, fontFamily: "inherit", color: "var(--pm-foreground)" }}>
                <span aria-hidden="true" style={{ width: 7, height: 7, borderRadius: "50%", background: x.c.already_rejected ? "var(--pm-red)" : stripPx(score(x.rows)) }} />
                {x.c.name || x.c.cwid}
              </button>
            );
          })}
        </div>
      )}
      {/* no overflow:hidden here: it would clip the identity hover card in the headers */}
      <div role="table" style={TABLE}>
        <div role="row" style={{ display: "grid", gridTemplateColumns: grid, gap: 12, padding: "10px 12px", background: "var(--pm-surface-2)", alignItems: "stretch", borderRadius: "10px 10px 0 0" }}>
          <span role="columnheader" style={{ ...HEAD, alignSelf: "end" }}>Evidence</span>
          <span role="columnheader" style={{ ...HEAD, alignSelf: "end" }}>This article</span>
          {shown.map(({ c, rows }) => {
            return (
              <div role="columnheader" key={c.cwid} tabIndex={onPick ? 0 : undefined} data-cmp-head={c.cwid}
                aria-label={onPick ? `Assign to ${c.name || c.cwid}` : undefined}
                onClick={(e) => { if (isDeliberateClick(e.detail, window.getSelection()?.toString() || "")) onPick?.(c.cwid); }} onKeyDown={(e) => { if (onPick && e.target === e.currentTarget && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); e.stopPropagation(); onPick(c.cwid); } }}
                title={onPick ? `Assign to ${c.name || c.cwid}` : undefined}
                style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 0, padding: "7px 9px", borderRadius: 8, cursor: onPick ? "pointer" : "default", boxSizing: "border-box",
                  border: "1px solid var(--pm-border)", background: "#fff" }}>
                <span style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
                  {renderHead(c)}
                </span>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--pm-muted-foreground)" }}>
                  {c.cwid} · IO {c.io_score == null ? "—" : Math.floor(c.io_score)}
                </span>
                <Bar rows={rows} width="100%" height={6} track="var(--pm-border)" />
                <span style={{ fontSize: 11, color: "var(--pm-muted-foreground)" }}>{tallyText(rows)}</span>
                {c.cwid === bestCwid && <span style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: "0.03em", color: "var(--pm-slate)" }}>MOST EVIDENCE</span>}
              </div>
            );
          })}
        </div>
        {labels.map((l) => (
          <div role="row" key={l} style={{ display: "grid", gridTemplateColumns: grid, gap: 12, ...ROW }}>
            <span role="rowheader" style={{ fontWeight: 600 }}>{l}</span>
            <span role="cell" title={mineOf(l)} style={{ minWidth: 0, overflowWrap: "anywhere", display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{mineOf(l) || "—"}</span>
            {shown.map(({ c, rows }) => {
              const e = rows.find((x) => x.label === l);
              // The header already names the person, so the name rows show only the verdict and why.
              const val = !e ? undefined : l === "Name" || l === "Given name" ? undefined : e.theirs;
              return (
                <span role="cell" key={c.cwid} data-kind={e?.kind} style={{ minWidth: 0, overflowWrap: "anywhere", display: "flex", flexDirection: "column", gap: 3,
                  padding: "5px 7px", margin: "-5px -7px", borderRadius: 6 }}>
                  <KindPill kind={e?.kind || "nodata"} />
                  {val && <span style={{ color: "var(--pm-muted-foreground)" }}>{val}</span>}
                  {e?.why && <span style={MUTED}>{e.why}</span>}
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
const pageBtn: CSSProperties = { width: 28, height: 28, borderRadius: 6, border: "1px solid var(--pm-border-strong)", background: "#fff", display: "grid", placeItems: "center", cursor: "pointer", padding: 0, color: "var(--pm-foreground)" };
