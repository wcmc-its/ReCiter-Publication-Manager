import React from "react";
import Loader from "../Common/Loader";
import { ReportsResultPane } from "./ReportsResultPane";
import { PublicationSearchFilter } from "../../../../types/publication.report.search";
import { Author } from "../../../../types/Author";

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
      <div className="m-5">
        <Loader />
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