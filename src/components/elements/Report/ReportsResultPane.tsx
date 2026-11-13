import React from "react";
import styles from "./ReportsResultPane.module.css";
import { AuthorsComponent } from "../Common/AuthorsComponent";
import { Author } from "../../../../types/Author";
import { setReportFilterLabels, setIsVisible } from "../../../utils/constants";
import { sanitizeInlineHtml } from "../../../utils/htmlText";
import { authorRoleNote, bylineRoleSuffix, citationBlock, externalIdOf, notPeerReviewedChip, pmcidHref, sourceOf, venueRecordOf, wcmPositionText } from "../../../utils/reportRow";
import { venueOf } from "../../../lib/pubTypes";

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
  // 5e (ReCiterDB v3.9), present only when the column exists
  citationCountOpenAlex?: number | null,
  authors: Author[]
  journalTitleVerbose: string
  publicationDateDisplay: string
  publicationTypeCanonical: string
  // 5c (ReCiterDB v3.7), present only when the columns exist
  pubType?: string | null
  publisher?: string | null
  editors?: string | null
  volume?: string | null
  issue?: string | null
  pages?: string | null
  // 5d-1 (ReCiterDB v3.10), present only when the columns exist
  peerReviewed?: number | string | null
  peerReviewedSource?: string | null
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
  citationCountOpenAlex,
  authors,
  journalTitleVerbose,
  publicationDateDisplay,
  publicationTypeCanonical,
  pubType,
  publisher,
  editors,
  volume,
  issue,
  pages,
  peerReviewed,
  peerReviewedSource,
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
    { citationCountNIH: citationCount, citationCountScopus, citationCountOpenAlex, relativeCitationRatioNIH: relativeCitationRatio, percentileNIH: percentileRank, pmid },
    { showRcr: visible("Relative Citation Ratio (NIH)"), showPct: visible("Percentile Rank") },
  );
  // The venue line by type (pubTypes.ts venueOf), shared with the exports through venueRecordOf.
  const venue = venueOf(venueRecordOf({ pubType, journalTitleVerbose, publisher, editors, volume, issue, pages }));
  const typeLabel = pubType || publicationTypeCanonical;
  const notPr = notPeerReviewedChip({ peerReviewed, peerReviewedSource, pubType });
  // Roles after names: "(translator)" after a person, or ", editors" after an edited book's byline.
  const byline = (authors || []).map((a) => {
    const note = authorRoleNote(pubType, a?.role);
    return note ? { ...a, roleNote: note } : a;
  });
  const bylineSuffix = bylineRoleSuffix(pubType, byline.length);
  const jm2 = journalImpactScore2 != null && visible("Journal impact") ? ` · ${labelOf("Journal impact", "Journal metric")} ${journalImpactScore2}` : "";

  return (
    <div className={styles.articleRow} data-testid="report-row">
      <div className={styles.articleMain}>
        <div className={styles.articleTitle} dangerouslySetInnerHTML={{ __html: sanitizeInlineHtml(title) }} />

        {/* An external row (negative pmid) with no stored byline has no authors anywhere in
            reciterdb, so show nothing rather than "No authors listed". */}
        {(Number(pmid) > 0 || (authors && authors.length > 0)) && (
          <div className={styles.articleAuthors}>
            <AuthorsComponent authors={byline} onClick={onClickAuthor} suffix={bylineSuffix} />
          </div>
        )}

        <div className={styles.articleMeta}>
          {typeLabel && <span className={styles.typeBadge}>{typeLabel}</span>}
          {notPr && <span className={styles.notPeerReviewed} title={notPr.tip} data-testid="not-peer-reviewed">Not peer-reviewed</span>}
          <span className={`${styles.sourceBadge} ${styles[`tone_${source.tone}`]}`} title={source.tip} data-testid="source-badge">{source.label}</span>
          <span>
            {venue && <em data-testid="venue" dangerouslySetInnerHTML={{ __html: sanitizeInlineHtml(venue) }} />}
            {venue && publicationDateDisplay && " · "}
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
