import React from  "react";
import styles from "./ReportsResultPane.module.css";
import { Popover, OverlayTrigger } from "react-bootstrap";
import { infoBubblesConfig } from "../../../../config/report";

interface ReportsResultPaneProps {
  title: string
  pmid: number
  doi: number
  citationCount: number
  percentileRank: number
  relativeCitationRatio: number
  trendingPubsScore?: number
  journalImpactScore1?: number
}

export const ReportsResultPane: React.FC<ReportsResultPaneProps> = ({ title, pmid, doi, citationCount, percentileRank, relativeCitationRatio, trendingPubsScore, journalImpactScore1 }) => {
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
    <div className="search-result-container">
      <div className="seach-result-title">{title}</div>
      <div className="additional-info">
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
                />
              )
            })
          }
        </div>
      </div>
    </div>
  )
}