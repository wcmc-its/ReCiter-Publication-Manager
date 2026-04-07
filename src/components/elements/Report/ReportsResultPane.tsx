import React from  "react";
import styles from "./ReportsResultPane.module.css";
import { AuthorsComponent } from "../Common/AuthorsComponent";
import { Author } from "../../../../types/Author";
import { setHelptextInfo, setReportFilterLabels, setReportFilterDisplayRank, setIsVisible } from "../../../utils/constants";

interface ReportsResultPaneProps {
  title: string
  pmid: number
  doi: number
  citationCount: number
  percentileRank: number
  relativeCitationRatio: number
  trendingPubsScore?: number
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

export const ReportsResultPane: React.FC<ReportsResultPaneProps> = ({
  title,
  pmid,
  doi,
  citationCount,
  percentileRank,
  relativeCitationRatio,
  trendingPubsScore,
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
  const pubMedUrl = 'https://www.ncbi.nlm.nih.gov/pubmed/';
  const doiUrl = 'https://doi.org/';

  const METRIC_CONFIGS = [
    {
      label: setReportFilterLabels(reportingWebDisplay, "Percentile Rank"),
      tip: setHelptextInfo(reportingWebDisplay, "Percentile Rank"),
      value: percentileRank,
      displayRank: setReportFilterDisplayRank(reportingWebDisplay, "Percentile Rank"),
      isVisible: setIsVisible(reportingWebDisplay, "Percentile Rank"),
      colorClass: percentileRank >= 90 ? styles.metricValueTop : styles.metricValue,
    },
    {
      label: setReportFilterLabels(reportingWebDisplay, "Citation count (NIH)"),
      tip: setHelptextInfo(reportingWebDisplay, "Citation count (NIH)"),
      value: citationCount,
      displayRank: setReportFilterDisplayRank(reportingWebDisplay, "Citation count (NIH)"),
      isVisible: setIsVisible(reportingWebDisplay, "Citation count (NIH)"),
      colorClass: styles.metricValue,
    },
    {
      label: setReportFilterLabels(reportingWebDisplay, "Relative Citation Ratio (NIH)"),
      tip: setHelptextInfo(reportingWebDisplay, "Relative Citation Ratio (NIH)"),
      value: relativeCitationRatio,
      displayRank: setReportFilterDisplayRank(reportingWebDisplay, "Relative Citation Ratio (NIH)"),
      isVisible: setIsVisible(reportingWebDisplay, "Relative Citation Ratio (NIH)"),
      colorClass: relativeCitationRatio >= 2.0 ? styles.metricValueHigh : styles.metricValue,
    },
    {
      label: setReportFilterLabels(reportingWebDisplay, "Journal Rank"),
      tip: setHelptextInfo(reportingWebDisplay, "Journal Rank"),
      value: journalImpactScore1,
      displayRank: setReportFilterDisplayRank(reportingWebDisplay, "Journal Rank"),
      isVisible: setIsVisible(reportingWebDisplay, "Journal Rank"),
      colorClass: styles.metricValue,
    },
    {
      label: setReportFilterLabels(reportingWebDisplay, "Journal Metric"),
      tip: setHelptextInfo(reportingWebDisplay, "Journal Metric"),
      value: journalImpactScore2,
      displayRank: setReportFilterDisplayRank(reportingWebDisplay, "Journal Metric"),
      isVisible: setIsVisible(reportingWebDisplay, "Journal Metric"),
      colorClass: styles.metricValue,
    },
    {
      label: setReportFilterLabels(reportingWebDisplay, "TrendingPubs score"),
      tip: setHelptextInfo(reportingWebDisplay, "TrendingPubs score"),
      value: trendingPubsScore,
      displayRank: setReportFilterDisplayRank(reportingWebDisplay, "TrendingPubs score"),
      isVisible: setIsVisible(reportingWebDisplay, "TrendingPubs score"),
      colorClass: styles.metricValue,
    },
    {
      label: setReportFilterLabels(reportingWebDisplay, "Citation count (Scopus)"),
      tip: setHelptextInfo(reportingWebDisplay, "Citation count (Scopus)"),
      value: citationCountScopus,
      displayRank: setReportFilterDisplayRank(reportingWebDisplay, "Citation count (Scopus)"),
      isVisible: setIsVisible(reportingWebDisplay, "Citation count (Scopus)"),
      colorClass: styles.metricValue,
    },
  ];

  const visibleMetrics = METRIC_CONFIGS
    .filter(m => m.isVisible && m.value != null && m.value !== undefined)
    .sort((a, b) => a.displayRank - b.displayRank);

  return (
    <div className={styles.articleCard}>
      {/* Row 1: Badge + date + PMID */}
      <div className={styles.cardMetaRow}>
        <span className={styles.typeBadge}>{publicationTypeCanonical}</span>
        <span className={styles.metaSep}>·</span>
        <span className={styles.cardDate}>{publicationDateDisplay}</span>
        <span className={styles.metaSep}>·</span>
        <span className={styles.cardDate}><span className={styles.idLabel}>PMID</span> <a className={styles.idLink} href={`${pubMedUrl}${pmid}`} target="_blank" rel="noreferrer">{pmid}</a><span style={{userSelect: 'none', color: '#2c4a7c'}}> ↗</span></span>
      </div>

      {/* Row 2: Title */}
      <div className={styles.articleTitle} dangerouslySetInnerHTML={{ __html: title }} />

      {/* Row 3: Authors */}
      <div className={styles.articleAuthors}>
        <AuthorsComponent authors={authors} onClick={onClickAuthor} />
      </div>

      {/* Row 4: Journal + DOI */}
      <div className={styles.articleBib}>
        <span>{journalTitleVerbose}</span>
        {doi && (
          <>
            <span className={styles.dot} />
            <a className={styles.idLink} href={`${doiUrl}${doi}`} target="_blank" rel="noreferrer">DOI ↗</a>
          </>
        )}
      </div>

      {/* Metrics */}
      {visibleMetrics.length > 0 && (
        <div className={styles.articleMetrics}>
          {visibleMetrics.map((metric, i) => (
            <React.Fragment key={metric.label}>
              {i > 0 && <span className={styles.dot} />}
              <span className={styles.metricItem}>
                <span className={styles.metricLabel}>
                  {metric.label}:
                  {metric.tip && <span className={styles.metricTip}>{metric.tip}</span>}
                </span>
                <span className={metric.colorClass}>{metric.value}</span>
              </span>
            </React.Fragment>
          ))}
        </div>
      )}
    </div>
  );
}
