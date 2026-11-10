import React from "react";
import styles from "./ReportsResultPane.module.css";
import { AuthorsComponent } from "../Common/AuthorsComponent";
import { Author } from "../../../../types/Author";
import { setReportFilterLabels, setIsVisible } from "../../../utils/constants";
import { sanitizeInlineHtml } from "../../../utils/htmlText";
import { citationBlock, externalIdOf, pmcidHref, sourceOf, wcmPositionText } from "../../../utils/reportRow";

interface ReportsResultPaneProps {
  title: string
  pmid: number
  doi?: string
  pmcid?: string
  sourceType?: string
  articleId?: string
  citationCount: number
  percentileRank: number
  relativeCitationRatio: number
  journalImpactScore1?: number,
  journalImpactScore2?: number,
  citationCountScopus: number,
  authors: Author[]
  journalTitleVerbose: string
  publicationDateDisplay: string
  publicationTypeCanonical: string
  onClickAuthor?: (personalIdentifier: string) => void,
  reportingWebDisplay: any,
}

// One result row, per the UI-refresh mockup: title, byline (WCM authors in Slate), a meta line
// (type, source badge, venue · date, ids, SJR, WCM first/last author) and a citation block on the
// right. Labels and visibility still come from the reportingWebDisplay admin setting.
export const ReportsResultPane: React.FC<ReportsResultPaneProps> = ({
  title,
  pmid,
  doi,
  pmcid,
  sourceType,
  articleId,
  citationCount,
  percentileRank,
  relativeCitationRatio,
  journalImpactScore1,
  journalImpactScore2,
  citationCountScopus,
  authors,
  journalTitleVerbose,
  publicationDateDisplay,
  publicationTypeCanonical,
  onClickAuthor,
  reportingWebDisplay
}) => {
  const hasSettings = Array.isArray(reportingWebDisplay) && reportingWebDisplay.length > 0;
  // Before the async admin settings land, show everything rather than flash an empty row.
  const visible = (key: string) => !hasSettings || setIsVisible(reportingWebDisplay, key);
  const labelOf = (key: string, fallback: string) => setReportFilterLabels(reportingWebDisplay, key) || fallback;

  const source = sourceOf({ sourceType, pmid, articleId });
  const altId = !doi ? externalIdOf({ pmid, articleId }) : null;
  const pmcHref = pmcidHref(pmcid);
  const position = wcmPositionText(authors);
  const showSjr = journalImpactScore1 != null && visible("Journal Rank");
  const cites = citationBlock(
    { citationCountNIH: citationCount, citationCountScopus, relativeCitationRatioNIH: relativeCitationRatio, percentileNIH: percentileRank, pmid },
    { showRcr: visible("Relative Citation Ratio (NIH)"), showPct: visible("Percentile Rank") },
  );
  const jm2 = journalImpactScore2 != null && visible("Journal impact") ? ` · ${labelOf("Journal impact", "Journal metric")} ${journalImpactScore2}` : "";

  return (
    <div className={styles.articleRow} data-testid="report-row">
      <div className={styles.articleMain}>
        <div className={styles.articleTitle} dangerouslySetInnerHTML={{ __html: sanitizeInlineHtml(title) }} />

        <div className={styles.articleAuthors}>
          <AuthorsComponent authors={authors} onClick={onClickAuthor} />
        </div>

        <div className={styles.articleMeta}>
          {publicationTypeCanonical && <span className={styles.typeBadge}>{publicationTypeCanonical}</span>}
          <span className={`${styles.sourceBadge} ${styles[`tone_${source.tone}`]}`} title={source.tip} data-testid="source-badge">{source.label}</span>
          <span>
            {journalTitleVerbose && <em dangerouslySetInnerHTML={{ __html: sanitizeInlineHtml(journalTitleVerbose) }} />}
            {journalTitleVerbose && publicationDateDisplay && " · "}
            {publicationDateDisplay}
          </span>
          {pmid > 0 && (
            <span>PMID <a href={`https://pubmed.ncbi.nlm.nih.gov/${pmid}/`} target="_blank" rel="noreferrer">{pmid}</a></span>
          )}
          {doi && (
            <span>DOI <a className={styles.mono} href={`https://doi.org/${doi}`} target="_blank" rel="noreferrer">{doi}</a></span>
          )}
          {altId && (
            <span>{altId.label} <a className={styles.mono} href={altId.href} target="_blank" rel="noreferrer">{altId.value}</a></span>
          )}
          {pmcHref && (
            <span title="Free full text in PubMed Central">PMCID <a href={pmcHref} target="_blank" rel="noreferrer">{pmcid}</a></span>
          )}
          {showSjr && (
            <span title="SCImago Journal Rank">SJR <strong className={styles.num}>{Number(journalImpactScore1).toFixed(2)}</strong></span>
          )}
          {position && <span className={styles.wcmPosition}>{position}</span>}
        </div>
      </div>

      <div className={styles.citeBlock} title={cites.tip + jm2} data-testid="cite-block">
        <span className={styles.citeCount}>{cites.count != null ? cites.count : "–"}</span>
        <span className={styles.citeLabel}>{cites.label}</span>
        {cites.pill && <span className={`${styles.citePill} ${cites.pillStrong ? styles.citePillStrong : ""}`}>{cites.pill}</span>}
      </div>
    </div>
  );
}
