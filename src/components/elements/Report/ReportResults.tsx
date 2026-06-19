import React from "react";
import { ReportsResultPane } from "./ReportsResultPane";
import { PublicationSearchFilter } from "../../../../types/publication.report.search";
import { Author } from "../../../../types/Author";
import reportStyles from "./Report.module.css";

interface ReportResultsProps  {
  results: any,
  loading: boolean,
  reportingWebDisplay:any,
  onClickAuthor: (personIdentifier: string) => void,
  pubSearchFilter?: PublicationSearchFilter,
  highlightSelectedAuthors: (authors: Author[], pubSearchFilter: PublicationSearchFilter) => Author[]
}
export const ReportResults: React.FC<ReportResultsProps> = ({ reportingWebDisplay, results, loading, onClickAuthor, pubSearchFilter, highlightSelectedAuthors }) => {
  if (loading) {
    return (
      <div>
        <div className={reportStyles.loadingRow}>
          <div className={reportStyles.spinner} />
          <span>Searching…</span>
        </div>
        <div className={reportStyles.skeletonCard}><div className={reportStyles.skTitle} /><div className={reportStyles.skAuthors} /><div className={reportStyles.skMeta} /></div>
        <div className={reportStyles.skeletonCard}><div className={reportStyles.skTitle} style={{ width: '60%' }} /><div className={reportStyles.skAuthors} style={{ width: '50%' }} /><div className={reportStyles.skMeta} style={{ width: '38%' }} /></div>
        <div className={reportStyles.skeletonCard}><div className={reportStyles.skTitle} style={{ width: '74%' }} /><div className={reportStyles.skAuthors} style={{ width: '44%' }} /><div className={reportStyles.skMeta} style={{ width: '32%' }} /></div>
      </div>
    )
  }

  return (
    <>
      {
        Object.keys(results).length > 0 && results?.rows && results?.rows?.map((row) => {
          return (
            <ReportsResultPane
            key={row.pmid}
            title={row.articleTitle}
            pmid={row.pmid}
            doi={row.doi}
            citationCount={row.citationCountNIH}
            percentileRank={row.percentileNIH}
            relativeCitationRatio={row.relativeCitationRatioNIH}
            trendingPubsScore={row.trendingPubsScore}
            journalImpactScore1={row.journalImpactScore1}
            journalImpactScore2={row.journalImpactScore2}
            citationCountScopus = {row.citationCountScopus}
            authors={highlightSelectedAuthors(row.authors, pubSearchFilter)}
            journalTitleVerbose={row.journalTitleVerbose}
            publicationDateDisplay={row.publicationDateDisplay}
            publicationTypeCanonical={row.publicationTypeCanonical}
            onClickAuthor={onClickAuthor}
            reportingWebDisplay = {reportingWebDisplay}
           
          />
        )})
      }
    </>
  )
}