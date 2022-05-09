import React from  "react";
import styles from "./ReportsResultPane.module.css";
import { Popover, OverlayTrigger } from "react-bootstrap";
import { infoBubblesConfig } from "../../../../config/report";
import { AuthorsComponent } from "../Common/AuthorsComponent";
import { Author } from "../../../../types/Author";

interface ReportsResultPaneProps {
  title: string
  pmid: number
  doi: number
  citationCount: number
  percentileRank: number
  relativeCitationRatio: number
  trendingPubsScore?: number
  journalImpactScore1?: number
  authors: Author[]
  journalTitleVerbose: string
  publicationDateDisplay: string
  publicationTypeCanonical: string
  onClickAuthor?: (personalIdentifier: string) => void
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
  authors,
  journalTitleVerbose,
  publicationDateDisplay,
  publicationTypeCanonical,
  onClickAuthor
 }) => {
  const pubMedUrl = 'https://www.ncbi.nlm.nih.gov/pubmed/';
  const doiUrl = 'https://doi.org/';

  const ADDITIONAL_INFO_CONFIGS = [
    {
      label: "Citation count (NIH)",
      title: "citationCount",
      value: citationCount
    },
    {
      label: "Percentile Rank",
      title: "percentileRank",
      value: percentileRank
    },
    {
      label: "Relative Citation Ratio (NIH)",
      title: "relativeCitationRatio",
      value: relativeCitationRatio
    },
    {
      label: "Journal Rank",
      title: "journalImpactScore",
      value: journalImpactScore1
    },
    {
      label: "TrendingPubs score",
      title: "trendingPubsScore",
      value: trendingPubsScore
    }
  ]

  const DisplayInfo = ({ label, title, value}) => {
    if (value) {
      if (infoBubblesConfig[title]) {
        return (
          <OverlayTrigger
            trigger={["focus", "hover"]}
            overlay={(
              <Popover id="information-description">
                <Popover.Body>
                  {infoBubblesConfig[title]}
                </Popover.Body>
              </Popover>)}
              placement="top"
              >
                <span className={styles.midDot}>{' '}<span className={styles.infoTitle}>{`${label}:`}</span>{' '}{value}</span>
          </OverlayTrigger>
        )
      } else {
        return (
          <span className={styles.midDot}>{' '}<span className={styles.infoTitle}>{`${label}:`}</span>{' '}{value}</span>
        )
      } 
    } else
    return null
  }

  return (
    <div className={styles.searchResultContainer}>
      <div className="seach-result-title"><b>{title}</b></div>
      <div className="authors">
        <AuthorsComponent 
          authors={authors}
          onClick={onClickAuthor}
          />
      </div>
      <div className="additional-info">
        <div>
          <span className={styles.midDot}> {journalTitleVerbose} </span>
          <span className={styles.midDot}> {publicationDateDisplay} </span>
          <span className={styles.midDot}> {publicationTypeCanonical} </span>
        </div>
       <div className={`${styles.reportsAdditionalInfo} pt-2`}>
          <span className={styles.midDot}>{`PMID: `}<a href={`${pubMedUrl}${pmid}`} target="_blank" rel="noreferrer">{pmid}</a>{' '}</span>
          <span className={styles.midDot}>{' '}<a href={`${doiUrl}${doi}`} target="_blank" rel="noreferrer">DOI</a>{' '}</span>
          {
            ADDITIONAL_INFO_CONFIGS.map(({ label, title, value}) => {
              return (
                <DisplayInfo
                  label={label}
                  title={title}
                  value={value}
                  key={title}
                />
              )
            })
          }
        </div>
      </div>
    </div>
  )
}