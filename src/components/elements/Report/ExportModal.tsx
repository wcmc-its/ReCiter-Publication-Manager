import CircularProgress from "@mui/material/CircularProgress";
import { Dialog } from "../../ui";
import { ExportButtonProps } from "../../../../types/Export";
import styles from "./ExportModal.module.css";

interface ExportModalProps {
  title: string,
  show: boolean,
  handleClose: () => void,
  countInfo: string,
  loadingResults?: boolean,
  error?: boolean,
  buttonsList: Array<ExportButtonProps>,
  exportArticleCsvLoading?: any,
  exportAuthorshipCsvLoading?: any,
  articleLimit?: any,
  authorLimit?: any,
  reportsResultsIds?: any,
  articlesCount?: any,
  // 5f Excel modal: a specific message (e.g. "add a filter") and the per-file publication cap
  errorMessage?: string | null,
  xlsxArticleLimit?: number
}

const DownloadIcon = () => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2"><path d="M8 2v9M4 8l4 4 4-4"/><path d="M2 14h12"/></svg>
);

const ExportModal = ({ errorMessage, xlsxArticleLimit, articlesCount, reportsResultsIds, articleLimit, authorLimit, exportArticleCsvLoading, exportAuthorshipCsvLoading, show, handleClose, title, countInfo, error, loadingResults, buttonsList }: ExportModalProps) => {
  const formatter = new Intl.NumberFormat('en-US');
  const isRTF = title === "RTF";
  // The Excel modal ("Excel": .xlsx first, CSV as a fallback) keeps the CSV modal's layout.
  const isCsv = title === "CSV" || title === "Excel";
  const isExcel = title === "Excel";
  const overXlsxLimit = isExcel && xlsxArticleLimit && articlesCount > xlsxArticleLimit;
  const isDownloading = (exportAuthorshipCsvLoading && reportsResultsIds?.authorshipsCount > authorLimit?.maxLimit) || (exportArticleCsvLoading && articlesCount > articleLimit?.maxLimit);

  return (
    <Dialog
      open={show}
      onClose={handleClose}
      width={420}
      title={
        <span className={styles.titleWrap}>
          <span className={`${styles.icon} ${isRTF ? styles.iconRtf : styles.iconCsv}`}>
            {isRTF ? (
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M3 2h7l4 4v9H3z"/><path d="M10 2v4h4"/><path d="M5 8h4M5 11h3"/></svg>
            ) : (
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M3 2h7l4 4v9H3z"/><path d="M10 2v4h4"/><path d="M5 7h6M5 10h6M5 13h4"/></svg>
            )}
          </span>
          Export to {title}
        </span>
      }
      footer={loadingResults ? undefined : (
        <>
          {buttonsList.map((btn, index) => {
            // RTF: single dark button; CSV: first blue, second blue-light
            let btnClass = styles.btnExport;
            if (isCsv && index === 0) btnClass += ` ${styles.btnBlue}`;
            if (isCsv && index >= 1) btnClass += ` ${styles.btnBlueLight}`;

            return (
              <button
                key={index}
                className={btnClass}
                onClick={btn.onClick}
                disabled={btn.loading}
              >
                {btn.loading ? (
                  <CircularProgress size={14} color="inherit" aria-label="Exporting" />
                ) : (
                  <>
                    <DownloadIcon />
                    {btn.title}
                  </>
                )}
              </button>
            );
          })}
          <button className={styles.btnCancel} onClick={handleClose}>Cancel</button>
        </>
      )}
    >
      {loadingResults ? (
        <div className={styles.loadingWrap}>
          <div className={styles.loadingSpinner} />
          <span className={styles.loadingText}>Loading…</span>
        </div>
      ) : (
        <>
          {/* stat blocks */}
          <div className={styles.summaryRow}>
            {isCsv && (
              <div className={styles.statBlock}>
                <div className={styles.statNum}>{formatter.format(reportsResultsIds?.authorshipsCount || 0)}</div>
                <div className={styles.statLabel}>Authorships</div>
              </div>
            )}
            <div className={styles.statBlock}>
              <div className={styles.statNum}>{articlesCount ? formatter.format(articlesCount) : 0}</div>
              <div className={styles.statLabel}>{isRTF ? 'Articles matched' : 'Articles'}</div>
            </div>
            <div className={styles.badgeWrap}>
              <span className={`${styles.formatBadge} ${isRTF ? styles.badgeRtf : styles.badgeCsv}`}>{title}</span>
            </div>
          </div>

          {/* limit warning */}
          {isDownloading && (
            <div className={styles.limitAlert}>
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M8 1L1 14h14L8 1z"/><path d="M8 6v4M8 12v.5"/></svg>
              Downloading the first {exportArticleCsvLoading ? formatter.format(articleLimit?.maxLimit) : formatter.format(authorLimit?.maxLimit)} records.
            </div>
          )}

          {overXlsxLimit && (
            <div className={styles.limitAlert} data-testid="xlsx-limit-alert">
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M8 1L1 14h14L8 1z"/><path d="M8 6v4M8 12v.5"/></svg>
              The Excel file holds the first {formatter.format(xlsxArticleLimit)} publications. Narrow the filters to get the rest.
            </div>
          )}

          {/* description */}
          <p className={styles.desc}>
            {isExcel
              ? 'The Excel workbook has three sheets: Publications (one row per article), Authorships (one row per WCM author\u2013article pair) and About (filters, counts and column notes). The CSV files are the older one-sheet exports.'
              : isRTF
              ? 'Exports a formatted bibliography document based on your current author and article filters. Opens in Word, Google Docs, or any RTF-compatible editor.'
              : 'Choose your export type. The authorship report includes one row per author\u2013article pair. The article report includes one row per article with aggregated authorship data.'}
          </p>

          {errorMessage ? (
            <div className={styles.errorAlert} role="alert" data-testid="export-error">{errorMessage}</div>
          ) : error && (
            <div className={styles.errorAlert}>Unable to generate the export file. Please try again.</div>
          )}
        </>
      )}
    </Dialog>
  );
}

export default ExportModal;
