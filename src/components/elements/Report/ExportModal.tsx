import { Spinner } from "react-bootstrap";
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
  articlesCount?: any
}

const DownloadIcon = () => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2"><path d="M8 2v9M4 8l4 4 4-4"/><path d="M2 14h12"/></svg>
);

const ExportModal = ({ articlesCount, reportsResultsIds, articleLimit, authorLimit, exportArticleCsvLoading, exportAuthorshipCsvLoading, show, handleClose, title, countInfo, error, loadingResults, buttonsList }: ExportModalProps) => {
  if (!show) return null;

  const formatter = new Intl.NumberFormat('en-US');
  const isRTF = title === "RTF";
  const isCsv = title === "CSV";
  const isDownloading = (exportAuthorshipCsvLoading && reportsResultsIds?.authorshipsCount > authorLimit?.maxLimit) || (exportArticleCsvLoading && articlesCount > articleLimit?.maxLimit);

  return (
    <div className={styles.overlay} onClick={handleClose} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleClose(); } }}>
      {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions */}
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        {/* ── HEADER ── */}
        <div className={styles.header}>
          <div className={styles.titleWrap}>
            <div className={`${styles.icon} ${isRTF ? styles.iconRtf : styles.iconCsv}`}>
              {isRTF ? (
                <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M3 2h7l4 4v9H3z"/><path d="M10 2v4h4"/><path d="M5 8h4M5 11h3"/></svg>
              ) : (
                <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M3 2h7l4 4v9H3z"/><path d="M10 2v4h4"/><path d="M5 7h6M5 10h6M5 13h4"/></svg>
              )}
            </div>
            <div className={styles.title}>Export to {title}</div>
          </div>
          <button className={styles.closeBtn} onClick={handleClose}>
            <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M1 1l12 12M13 1L1 13"/></svg>
          </button>
        </div>

        {/* ── BODY ── */}
        <div className={styles.body}>
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

              {/* description */}
              <p className={styles.desc}>
                {isRTF
                  ? 'Exports a formatted bibliography document based on your current author and article filters. Opens in Word, Google Docs, or any RTF-compatible editor.'
                  : 'Choose your export type. The authorship report includes one row per author\u2013article pair. The article report includes one row per article with aggregated authorship data.'}
              </p>

              {error && (
                <div className={styles.errorAlert}>Unable to generate the export file. Please try again.</div>
              )}
            </>
          )}
        </div>

        {/* ── FOOTER ── */}
        {!loadingResults && (
          <div className={styles.footer}>
            {buttonsList.map((btn, index) => {
              // RTF: single dark button; CSV: first blue, second blue-light
              let btnClass = styles.btnExport;
              if (isCsv && index === 0) btnClass += ` ${styles.btnBlue}`;
              if (isCsv && index === 1) btnClass += ` ${styles.btnBlueLight}`;

              return (
                <button
                  key={index}
                  className={btnClass}
                  onClick={btn.onClick}
                  disabled={btn.loading}
                >
                  {btn.loading ? (
                    <Spinner animation="border" size="sm" />
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
          </div>
        )}
      </div>
    </div>
  );
}

export default ExportModal;
