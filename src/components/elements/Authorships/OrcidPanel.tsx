// The opened row's "From ORCID" box: what the public record of the byline's iD says about its
// owner. Fetched when the row is opened, never for the list, and for reading only: it has no
// effect on Accept, assign or bulk selection. With no answer it is just the link.
import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import { reciterConfig } from "../../../../config/local";
import { familyOnByline, isCornellOrg, yearsText } from "../../../lib/orcidRecord";
import type { OrcidRecord } from "../../../lib/orcidRecord";

const SHOWN = 3;
const K: CSSProperties = { color: "var(--pm-muted-foreground)" };
const LINK: CSSProperties = { border: 0, background: "none", padding: 0, font: "inherit", fontSize: 12, color: "var(--pm-slate)", cursor: "pointer", width: "fit-content" };

const OrcidPanel = ({ rowId, orcid, byline }: { rowId: number; orcid: string; byline?: string | null }) => {
  const [rec, setRec] = useState<OrcidRecord | null | undefined>(undefined); // undefined = loading
  const [all, setAll] = useState(false);
  useEffect(() => {
    const ctl = new AbortController();
    setRec(undefined);
    setAll(false);
    fetch("/api/db/authorships/orcid-record", {
      credentials: "same-origin", method: "POST", signal: ctl.signal,
      headers: { Accept: "application/json", "Content-Type": "application/json", Authorization: reciterConfig.backendApiKey },
      body: JSON.stringify({ id: rowId }),
    }).then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then((d) => setRec(d.record ?? null))
      .catch(() => { if (!ctl.signal.aborted) setRec(null); });
    return () => ctl.abort();
  }, [rowId, orcid]);

  const items = rec ? (all ? rec.affiliations : rec.affiliations.slice(0, SHOWN)) : [];
  const more = rec ? rec.affiliations.length - SHOWN : 0;
  const link = (
    <a href={`https://orcid.org/${orcid}`} target="_blank" rel="noopener noreferrer" style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--pm-slate)", whiteSpace: "nowrap" }}>{orcid}</a>
  );
  return (
    <div data-orcid-panel style={{
      padding: "9px 12px", borderRadius: 8, background: "var(--pm-page)", border: "1px solid var(--pm-border)",
      display: "grid", gridTemplateColumns: "110px minmax(0,1fr)", gap: "5px 12px", fontSize: 12.5, lineHeight: 1.5,
    }}>
      <span style={{ ...K, cursor: "help" }} title="The public ORCID record for the iD on this byline, as its owner and their institutions entered it. Shown for reading; it does not change the suggestion.">From ORCID</span>
      <span style={{ minWidth: 0, overflowWrap: "anywhere" }} aria-live="polite">
        {rec?.name && <strong style={{ fontWeight: 600 }}>{rec.name}</strong>}{rec?.name ? " · " : ""}{link}
        {rec === undefined && <span style={K}> · Loading…</span>}
        {rec?.deprecated && <span style={K}> · merged into {rec.orcid}</span>}
      </span>
      {!!rec && !familyOnByline(rec, byline) && (
        <>
          <span />
          <span data-orcid-mismatch style={{ fontWeight: 600, color: "var(--pm-amber)" }}>The family name on this ORCID record is not on the byline. The iD may be someone else’s.</span>
        </>
      )}
      {!!rec?.otherNames.length && (
        <>
          <span style={K}>Also known as</span>
          <span style={{ minWidth: 0, overflowWrap: "anywhere" }}>{rec.otherNames.slice(0, 4).join("; ")}</span>
        </>
      )}
      {items.length > 0 && (
        <>
          <span style={K}>Affiliations</span>
          <div style={{ minWidth: 0, display: "flex", flexDirection: "column", gap: 2, overflowWrap: "anywhere" }}>
            {items.map((a, i) => (
              <span key={i} data-orcid-affil={a.kind}>
                <span style={isCornellOrg(a.org) || isCornellOrg(a.dept) ? { fontWeight: 600, color: "var(--pm-slate)" } : undefined}>{a.org}</span>
                {[a.dept, a.role].filter(Boolean).map((t) => ` · ${t}`).join("")}
                <span style={K}>{[a.kind === "education" ? "education" : "", yearsText(a)].filter(Boolean).map((t) => ` · ${t}`).join("")}</span>
              </span>
            ))}
            {more > 0 && <button type="button" onClick={() => setAll(!all)} aria-expanded={all} style={LINK}>{all ? "Show fewer" : `Show ${more} more`}</button>}
          </div>
        </>
      )}
      {!!rec?.emailDomains.length && (
        <>
          <span style={K}>Email domain</span>
          <span>{rec.emailDomains.join(", ")}</span>
        </>
      )}
    </div>
  );
};

export default OrcidPanel;
