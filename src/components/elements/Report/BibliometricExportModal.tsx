import { useEffect, useState } from "react";
import CircularProgress from "@mui/material/CircularProgress";
import { toast } from "react-toastify";
import { Button, Dialog } from "../../ui";
import { reciterConfig } from "../../../../config/local";
import { reportError } from "../../../utils/reportError";
import { downloadBibliometricDocx } from "../../../utils/bibliometricDownload";

// Bibliometric analysis v2 (5h P5): one person's .docx with headings, tables and two charts. Shown
// only while the admin_settings bibliometricReport flag is "docx". The list follows the document's
// sections (bibliometricDocx.ts); sections with nothing to show are left out of the file.
const SECTIONS: Array<{ name: string; rows: string; cols: string }> = [
  { name: "Summary for reviewers", rows: "1–2 paragraphs", cols: "Plain-language reading of the figures below, for a promotion or review committee" },
  { name: "Key figures", rows: "table", cols: "Top-5 average NIH percentile, median Relative Citation Ratio and share at or above the 90th percentile, each next to its reference point; publications, author roles and h-index" },
  { name: "Peer comparison", rows: "table", cols: "Full-time WCM faculty only: top-5 and top-10 averages by author role, ranked among faculty of the same rank (20 or more to rank)" },
  { name: "Authorship over time", rows: "chart", cols: "Research articles by year as first, middle and senior author" },
  { name: "Percentile distribution", rows: "chart", cols: "Rated research articles in ten NIH percentile bins, against the 10% expected" },
  { name: "Most influential research articles", rows: "top 10", cols: "By NIH percentile, then Relative Citation Ratio, with the author role" },
  { name: "Reviews, recent and older work", rows: "tables", cols: "Works outside the research-article measures: reviews and other types, works too recent to rate, and pre-1980 works" },
  { name: "Methods and sources", rows: "1 page", cols: "Definitions, NIH iCite and ReCiter sources, and the run date" },
];
const fmt = new Intl.NumberFormat("en-US");

type Availability = { show: boolean; works: number; name: string | null };

const BibliometricExportModal = ({ show, onClose, uid }: { show: boolean; onClose: () => void; uid: string | null }) => {
  const [info, setInfo] = useState<Availability | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!show || !uid) return;
    let live = true;
    setError(null);
    setInfo(null);
    fetch(`/api/db/reports/bibliometric/show/${encodeURIComponent(uid)}`, {
      credentials: "same-origin",
      headers: { Accept: "application/json", Authorization: reciterConfig.backendApiKey },
    })
      .then((r) => (r.ok ? r.json() : null))
      // { version: "rtf" } (flag switched back mid-session) carries no counts; keep the uid.
      .then((d) => { if (live && d && d.version === "docx") setInfo(d); })
      .catch(() => { /* the description falls back to the uid */ });
    return () => { live = false; };
  }, [show, uid]);

  const download = async () => {
    if (!uid) return;
    setLoading(true);
    setError(null);
    try {
      const result = await downloadBibliometricDocx(uid, reciterConfig.backendApiKey);
      if (result.ok === false) {
        if (result.status >= 500) reportError("ERR-8013", "Unable to export bibliometric analysis", { status: result.status });
        setError(result.status >= 500 ? `${result.message} (ERR-8013)` : result.message);
        return;
      }
      toast.success(`Downloaded ${result.fileName}`);
      onClose();
    } catch (e) {
      console.error("[ERR-8013]", e);
      reportError("ERR-8013", "Unable to export bibliometric analysis", e);
      setError("Unable to generate the bibliometric analysis. Please try again. (ERR-8013)");
    } finally {
      setLoading(false);
    }
  };

  const noWorks = info !== null && !info.show;
  const who = info?.name || uid || "";
  const description = info
    ? `${who} · ${fmt.format(info.works)} ${info.works === 1 ? "publication" : "publications"}`
    : who;

  return (
    <Dialog
      open={show}
      onClose={onClose}
      width={520}
      title="Bibliometric analysis"
      description={description}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={download} disabled={!uid || noWorks || loading} data-testid="biblio-download"
            sx={{ bgcolor: "var(--pm-slate)", borderColor: "var(--pm-slate)", "&:hover": { bgcolor: "#2a4159", borderColor: "#2a4159" } }}>
            {loading ? <CircularProgress size={14} color="inherit" aria-label="Generating" /> : "Download"}
          </Button>
        </>
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }} data-testid="biblio-export-modal">
        {noWorks && (
          <div role="alert" style={{ padding: "12px 14px", borderRadius: 8, background: "var(--pm-amber-tint)", border: "1px solid var(--pm-amber-tint-border)", color: "var(--pm-amber)", fontSize: 13, lineHeight: 1.5 }}>
            {who} has no accepted publications yet, so there is nothing to analyze.
          </div>
        )}
        <div style={{ border: "1px solid var(--pm-border)", borderRadius: 8, overflow: "hidden" }}>
          {SECTIONS.map((sct, i) => (
            <div key={sct.name} style={{ display: "flex", flexDirection: "column", gap: 2, padding: "9px 12px", borderTop: i ? "1px solid var(--pm-border)" : "none" }}>
              <span style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                <span style={{ fontSize: 13.5, fontWeight: 600, color: "var(--pm-foreground)" }}>{sct.name}</span>
                <span style={{ fontSize: 12, color: "var(--pm-muted-foreground)", whiteSpace: "nowrap" }}>{sct.rows}</span>
              </span>
              <span style={{ fontSize: 12.5, color: "var(--pm-muted-foreground)", lineHeight: 1.45 }}>{sct.cols}</span>
            </div>
          ))}
        </div>
        <span style={{ fontSize: 12, color: "var(--pm-muted-foreground)", lineHeight: 1.5 }}>
          Covers all of this person&apos;s accepted publications, whatever other filters are set. Citation measures use PubMed research articles with an NIH percentile; works from Scopus, OpenAlex, Crossref and manual entry are counted but never rated.
        </span>
        <span style={{ fontSize: 12, color: "var(--pm-muted-foreground)", lineHeight: 1.5 }}>
          Saved as BibliometricAnalysis-{uid || "<cwid>"}-{"<run date>"}.docx, a Word document with headings, tables and charts, ready to edit or attach to a promotion packet.
        </span>
        {error && (
          <div role="alert" data-testid="biblio-export-error" style={{ padding: "10px 12px", borderRadius: 8, background: "var(--pm-red-light, #f5e6e6)", color: "var(--pm-red-dark, #8c1515)", fontSize: 13 }}>
            {error}
          </div>
        )}
      </div>
    </Dialog>
  );
};

export default BibliometricExportModal;
