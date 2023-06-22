import React from  "react";
import styles from "./ReportsResultPane.module.css";
import { Popover, OverlayTrigger } from "react-bootstrap";
import { infoBubblesConfig } from "../../../../config/report";
import { AuthorsComponent } from "../Common/AuthorsComponent";
import { Author } from "../../../../types/Author";
import { reportConfig } from "../../../../config/report";
import { setHelptextInfo, setReportFilterLabels,setReportFilterDisplayRank, setIsVisible } from "../../../utils/constants";

interface ReportsResultPaneProps {
  title: string
  pmid: number
  doi: number
  citationCount: number
  percentileRank: number
  relativeCitationRatio: number
  trendingPubsScore?: number
  journalImpactScore1?: number,
  journalImpactScore2?:number,
  citationCountScopus:number,
  authors: Author[]
  journalTitleVerbose: string
  publicationDateDisplay: string
  publicationTypeCanonical: string
  onClickAuthor?: (personalIdentifier: string) => void,
  reportingWebDisplay:any,
  
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

  const ADDITIONAL_INFO_CONFIGS = [
    {
      label: setReportFilterLabels(reportingWebDisplay,"Citation count (NIH)") ,
      title:  setHelptextInfo(reportingWebDisplay,"Citation count (NIH)"),
      value: citationCount,
      displayRank : setReportFilterDisplayRank(reportingWebDisplay,"Citation count (NIH)"),
      isVisible : setIsVisible(reportingWebDisplay,"Citation count (NIH)")
    },
    {
      label: setReportFilterLabels(reportingWebDisplay,"Percentile Rank"),
      title: setHelptextInfo(reportingWebDisplay,"Percentile Rank"),
      value: percentileRank,
      displayRank : setReportFilterDisplayRank(reportingWebDisplay,"Percentile Rank"),
      isVisible : setIsVisible(reportingWebDisplay,"Percentile Rank")
    },
    {
      label: setReportFilterLabels(reportingWebDisplay,"Relative Citation Ratio (NIH)"),
      title: setHelptextInfo(reportingWebDisplay,"Relative Citation Ratio (NIH)"),
      value: relativeCitationRatio,
      displayRank : setReportFilterDisplayRank(reportingWebDisplay,"Relative Citation Ratio (NIH)"),
      isVisible : setIsVisible(reportingWebDisplay,"Relative Citation Ratio (NIH)")
    },
    {
      label: setReportFilterLabels(reportingWebDisplay,"Journal Rank"),
      title: setHelptextInfo(reportingWebDisplay,"Journal Rank"),
      value: journalImpactScore1,
      displayRank : setReportFilterDisplayRank(reportingWebDisplay,"Journal Rank"),
      isVisible : setIsVisible(reportingWebDisplay,"Journal Rank")
    },
    {
      label: setReportFilterLabels(reportingWebDisplay,"Journal impact"),
      title: setHelptextInfo(reportingWebDisplay,"Journal impact"),
      value: journalImpactScore2,
      displayRank : setReportFilterDisplayRank(reportingWebDisplay,"Journal impact"),
      isVisible : setIsVisible(reportingWebDisplay,"Journal impact")
    },
    {
      label: setReportFilterLabels(reportingWebDisplay,"TrendingPubs score"),
      title: setHelptextInfo(reportingWebDisplay,"TrendingPubs score"),
      value: trendingPubsScore,
      displayRank : setReportFilterDisplayRank(reportingWebDisplay,"TrendingPubs score"),
      isVisible : setIsVisible(reportingWebDisplay,"TrendingPubs score")
    },
    {
      label: setReportFilterLabels(reportingWebDisplay,"Citation count (Scopus)"),
      title: setHelptextInfo(reportingWebDisplay,"Citation count (Scopus)"),
      value: citationCountScopus,
      displayRank : setReportFilterDisplayRank(reportingWebDisplay,"Citation count (Scopus)"),
      isVisible : setIsVisible(reportingWebDisplay,"Citation count (Scopus)")
    }
  ]

  const HIGHLIGHT_AUTHORS = reportConfig.authorFilters?.list?.author?.isEnabled;

  const DisplayInfo = ({ label, title, value}) => {
    console.log('label title value',value);
    if (value) {
      if (title) {
        return (
          <OverlayTrigger
            trigger={["focus", "hover"]}
            overlay={(
              <Popover id="information-description">
                <Popover.Body>
                  {title}
                </Popover.Body>
              </Popover>)}
              placement="top"
              >
                <span className={styles.midDot}>{' '}<span className={styles.infoTitle}>{`${label}:`}</span>{' '}{value}</span>
          </OverlayTrigger>
        )
      } else {
        console.log('value',value)
        return (
          <span className={styles.midDot}>{' '}<span>{`${label}:`}</span>{' '}{value}</span>
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
          {doi && <span className={styles.midDot}>{' '}<a href={`${doiUrl}${doi}`} target="_blank" rel="noreferrer">DOI</a>{' '}</span>}
          { 
            ADDITIONAL_INFO_CONFIGS.sort((a: any, b: any) => a.displayRank - b.displayRank).map(({ label, title, value,isVisible}) => {
              return (
                isVisible &&
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