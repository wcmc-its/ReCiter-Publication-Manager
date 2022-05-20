import React from "react";
import Loader from "../Common/Loader";
import { ReportsResultPane } from "./ReportsResultPane";

interface ReportResultsProps  {
  results: any,
  loading: boolean,
  onClickAuthor: () => void
}
export const ReportResults: React.FC<ReportResultsProps> = ({ results, loading, onClickAuthor }) => {
  if (loading) {
    return (
      <div className="m-5">
        <Loader />
      </div>
    )
  }

  return (
    <>
      {
        Object.keys(results).length > 0 && results?.rows.map((row) => {
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
            authors={row.authors}
            journalTitleVerbose={row.journalTitleVerbose}
            publicationDateDisplay={row.publicationDateDisplay}
            publicationTypeCanonical={row.publicationTypeCanonical}
            onClickAuthor={onClickAuthor}
          />
        )})
      }
    </>
  )
}