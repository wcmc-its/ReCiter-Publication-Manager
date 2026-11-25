import { useEffect, useState } from "react";
import CircularProgress from "@mui/material/CircularProgress";
import { useSelector } from "react-redux";
import { toast } from "react-toastify";
import { Button, Checkbox, Dialog } from "../../ui";
import { RootStateOrAny } from "../../../types/redux";
import { reciterConfig } from "../../../../config/local";
import { reportError } from "../../../utils/reportError";
import { hasReportFilter, WordGroupBy } from "../../../../controllers/db/reports/wordBibliography";

// Export Word (5g): a server-built .docx bibliography of the publications the page lists.
const MODES: Array<{ value: WordGroupBy; label: string; sub: string }> = [
  { value: "year", label: "Grouped by year", sub: "Formatted citations, newest year first" },
  { value: "type", label: "Grouped by publication type", sub: "Academic articles, reviews, letters and so on, newest first in each (CV order)" },
  { value: "person", label: "Grouped by person", sub: "Citations under each WCM author who matches the filters" },
];

const fmt = new Intl.NumberFormat("en-US");

const WordExportModal = ({ show, onClose, articlesCount }: { show: boolean; onClose: () => void; articlesCount?: number }) => {
  const pubSearchFilter = useSelector((state: RootStateOrAny) => state.pubSearchFilter);
  const [groupBy, setGroupBy] = useState<WordGroupBy>("year");
  const [includeExternal, setIncludeExternal] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const filters = pubSearchFilter?.filters || {};
  const blocked = !hasReportFilter(filters);

  useEffect(() => {
    if (show) setError(null);
  }, [show]);

  const download = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/db/reports/publication/word`, {
        credentials: "same-origin",
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: reciterConfig.backendApiKey },
        body: JSON.stringify({ filters, groupBy, includeExternal }),
      });
      if (!response.ok) {
        let message = "Unable to generate the Word export. Please try again.";
        try {
          const body = await response.json();
          if (body && body.error) message = body.error;
        } catch (e) { /* not JSON */ }
        if (response.status >= 500) reportError("ERR-8001", "Unable to export Word bibliography", { status: response.status });
        setError(message);
        return;
      }
      const entries = Number(response.headers.get("X-Export-Entries") || 0);
      const total = Number(response.headers.get("X-Export-Total") || 0);
      const blob = await response.blob();
      const fileName = `ArticleReport-ReCiter-${new Date().toISOString().slice(0, 10)}.docx`;
      const link = document.createElement("a");
      link.href = window.URL.createObjectURL(blob);
      link.download = fileName;
      document.body.appendChild(link); // Chrome honors the download filename only for an anchor in the DOM.
      link.click();
      link.remove();
      toast.success(
        total > entries
          ? `Downloaded ${fileName} · first ${fmt.format(entries)} of ${fmt.format(total)} citations (export limit)`
          : `Downloaded ${fileName} · ${fmt.format(entries)} ${entries === 1 ? "citation" : "citations"}`
      );
      onClose();
    } catch (e) {
      console.error("[ERR-8001]", e);
      reportError("ERR-8001", "Unable to export Word bibliography", e);
      setError("Unable to generate the Word export. Please try again. (ERR-8001)");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog
      open={show}
      onClose={onClose}
      width={480}
      title="Export as Word"
      description={blocked ? "No filters applied" : `${fmt.format(articlesCount || 0)} ${articlesCount === 1 ? "publication" : "publications"}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={download} disabled={blocked || loading} data-testid="word-download"
            sx={{ bgcolor: "var(--pm-slate)", borderColor: "var(--pm-slate)", "&:hover": { bgcolor: "#2a4159", borderColor: "#2a4159" } }}>
            {loading ? <CircularProgress size={14} color="inherit" aria-label="Exporting" /> : "Download"}
          </Button>
        </>
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }} data-testid="word-export-modal">
        {blocked && (
          <div role="alert" style={{ padding: "12px 14px", borderRadius: 8, background: "var(--pm-amber-tint)", border: "1px solid var(--pm-amber-tint-border)", color: "var(--pm-amber)", fontSize: 13, lineHeight: 1.5 }}>
            Add a person, organization, date, type or journal filter before exporting. An unfiltered export would include every publication.
          </div>
        )}
        {!blocked && (
          <>
            <div role="radiogroup" aria-label="Group citations" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {MODES.map((m) => {
                const on = groupBy === m.value;
                return (
                  <button key={m.value} type="button" role="radio" aria-checked={on} onClick={() => setGroupBy(m.value)} data-testid={`word-group-${m.value}`}
                    style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: "10px 12px", borderRadius: 8, textAlign: "left", cursor: "pointer", fontFamily: "inherit",
                      border: `1px solid ${on ? "var(--pm-slate)" : "var(--pm-border-strong)"}`, background: on ? "var(--pm-slate-tint)" : "#fff" }}>
                    <span aria-hidden="true" style={{ marginTop: 2, width: 16, height: 16, borderRadius: "50%", boxSizing: "border-box", flexShrink: 0, background: "#fff",
                      border: on ? "5px solid var(--pm-slate)" : "1.5px solid var(--pm-muted-foreground)" }} />
                    <span style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                      <span style={{ fontSize: 13.5, fontWeight: 600, color: "var(--pm-foreground)" }}>{m.label}</span>
                      <span style={{ fontSize: 12.5, color: "var(--pm-muted-foreground)" }}>{m.sub}</span>
                    </span>
                  </button>
                );
              })}
            </div>
            <Checkbox
              checked={includeExternal}
              onChange={(e) => setIncludeExternal(e.target.checked)}
              label="Include works outside PubMed (Scopus, OpenAlex, Crossref and manual)"
              inputProps={{ "aria-label": "Include works outside PubMed" } as any}
            />
            <span style={{ fontSize: 12, color: "var(--pm-muted-foreground)", lineHeight: 1.5 }}>
              Saved as a .docx with Word heading styles (so the navigation pane works), WCM authors in bold, and PMIDs and DOIs as live links. Opens in Word, Google Docs and Pages.
            </span>
          </>
        )}
        {error && (
          <div role="alert" data-testid="word-export-error" style={{ padding: "10px 12px", borderRadius: 8, background: "var(--pm-red-light, #f5e6e6)", color: "var(--pm-red-dark, #8c1515)", fontSize: 13 }}>
            {error}
          </div>
        )}
      </div>
    </Dialog>
  );
};

export default WordExportModal;
