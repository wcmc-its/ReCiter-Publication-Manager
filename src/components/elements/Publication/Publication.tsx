import React, { useState, useEffect, useRef, FunctionComponent } from "react"
import styles from './Publication.module.css';
import { Container, Row, Col, Button, Accordion, Card } from "react-bootstrap";
import type { Author } from '../../../../types/Author';
import { useSelector, useDispatch } from "react-redux";
import { RootStateOrAny } from "../../../types/redux";
import HistoryModal from "./HistoryModal";
import { showEvidenceByDefault } from "../../../redux/actions/actions";
import { reciterConfig } from "../../../../config/local";

const pubMedUrl = 'https://www.ncbi.nlm.nih.gov/pubmed/';
const doiUrl = 'https://doi.org/';

//TEMP: update to required
interface FuncProps {
    onAccept?(pmid: number, id: number): void,
    onReject?(pmid: number, id: number): void,
    onUndo?(pmid: number, id: number): void,
    updatePublication?(uid: string, pmid: number, userAssertion: string): void,
    item?: any,
    faculty?: any,
    reciterArticle: any,
    index: any,
    personIdentifier: string,
    fullName: string,
    paginatedPubsCount?:any,
    activekey?:any,
    totalCount?:any,
    page?:any,
    actionSource?:any,
    countPendingArticles?:any,
    maxArticlesPerPerson?:any,
    showEvidenceDefault?:any,
    isFocused?: boolean,
    onCardMouseDown?: () => void,
}

const Publication: FunctionComponent<FuncProps> = (props) => {
    const feedbacklog = useSelector((state: RootStateOrAny) => state.feedbacklog)
    const [showEvidence, setShowEvidence] = useState<boolean>(false)
    const [expandedAuthors, setExpandedAuthors] = useState<boolean>(false)
    const [showZeroWeight, setShowZeroWeight] = useState<boolean>(false)

    const filteredIdentities = useSelector((state: RootStateOrAny) => state.filteredIdentities)
    const [showHistoryModal, setShowHistoryModal] = useState<boolean>(false)
    const [showCurationLog, setShowCurationLog] = useState<boolean>(false)
    const curationLogRef = useRef<HTMLSpanElement>(null)
    const [expandedPubIndex, setExpandedPubIndex] = useState<any>(props.showEvidenceDefault ? props.showEvidenceDefault : null)

    const maxArticlesPerPerson = reciterConfig.reciter.featureGeneratorByGroup.featureGeneratorByGroupApiParams.maxArticlesPerPerson;
    const dispatch = useDispatch();

    const onOpenModal = () => setShowHistoryModal(true)
    const onCloseModal = () => setShowHistoryModal(false)

    // Close curation log popover on click outside or Escape
    useEffect(() => {
      if (!showCurationLog) return;
      const handleClickOutside = (e: MouseEvent) => {
        if (curationLogRef.current && !curationLogRef.current.contains(e.target as Node)) {
          setShowCurationLog(false);
        }
      };
      const handleEscape = (e: KeyboardEvent) => {
        if (e.key === 'Escape') setShowCurationLog(false);
      };
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleEscape);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
        document.removeEventListener('keydown', handleEscape);
      };
    }, [showCurationLog]);

    const formatClogDate = (timestamp: string | Date) => {
      const d = new Date(timestamp);
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    };

    const toogleEvidence = (pubExpEvidenceNumber) => {
      let expandedPubNumber = parseInt(pubExpEvidenceNumber.slice(5));

      if(props.actionSource === "curateAll"){
        if(expandedPubNumber == maxArticlesPerPerson) setExpandedPubIndex(`page${props.page}${(expandedPubNumber - 1)}`);
        else setExpandedPubIndex(pubExpEvidenceNumber);
      }else {
      let allPaginatedPubsCount = props.paginatedPubsCount;
      let totalRecordsInTab = props.totalCount;
      if(allPaginatedPubsCount > expandedPubNumber){
        setExpandedPubIndex(pubExpEvidenceNumber);
      } else if(allPaginatedPubsCount === expandedPubNumber && allPaginatedPubsCount != totalRecordsInTab){
        setExpandedPubIndex(pubExpEvidenceNumber);
      }else if(allPaginatedPubsCount === expandedPubNumber && allPaginatedPubsCount === totalRecordsInTab && allPaginatedPubsCount != 1 && expandedPubNumber != 1){
        setExpandedPubIndex(`page${props.page}${(expandedPubNumber - 1)}`);
      }else if(allPaginatedPubsCount === expandedPubNumber && allPaginatedPubsCount === 1 && expandedPubNumber === 1){
        setExpandedPubIndex(null);
      }else{
        setExpandedPubIndex(null);
      }
    }
      setShowEvidence((showEvidence)?false:true)
    }

    const acceptPublication = ( pmid: number, index: number ) => {
      props.onAccept(pmid, index);
    }

    const rejectPublication = (pmid: number, index: number) => {
      props.onReject(pmid, index)
    }

    const undoPublication = (pmid: number, index: number) => {
      props.onUndo(pmid, index)
    }

    const Author = ({author, index, count} : {
      author: Author,
      index: number,
      count: number,
    }) => {
      let authorFullName: string = '';
      if (author.firstName) {
        authorFullName += author.firstName + " ";
      }
      if (author.lastName) {
        authorFullName += author.lastName;
      }

      return <li key={"author" + index}><span className={author.targetAuthor ? styles.highlightedAuthor : ""}>{authorFullName}</span>{(index < count - 1)?", ":""}</li>
    }

    const AuthorsList = ({ authors } : {
      authors: Author[]
    }) => {
      return (
        <ul className={styles.listInline}>
          {
            authors && authors.map((author, i) => <Author author={author} key={i} index={i} count={authors.length}></Author>  )
          }
        </ul>
      )
    }

    const displayAuthors = (authors: Author[]) => {
      let authCount = authors.length;
      if ( authCount > 0) {
        if ( authCount <= 7 || expandedAuthors) {
          return (<AuthorsList authors={authors}></AuthorsList>)
      } else {
        let authorsDefaultDisplay = authors.slice(0, 6);
        let lastAuthor = authors[authCount - 1];

        return (
          <>
            <AuthorsList authors={authorsDefaultDisplay}></AuthorsList>
            <button className={styles.btnNoStyling} onClick={() => {setExpandedAuthors(true)}}>[...]</button>
            <ul className={styles.listInline}>
              <Author author={lastAuthor} index={authCount - 1} count={authCount}></Author>
            </ul>
          </>
        )
      }
    } else return (
        <span>No authors listed</span>
      )
    }

    const { item } = props;

    const { reciterArticle } = props;
    const clogEntries = feedbacklog[reciterArticle.pmid] || [];

    const CardFooter = ({pmid, userAssertion} : {
      pmid: number,
      userAssertion: string
    }) => {
      const evDefault = expandedPubIndex ? expandedPubIndex : props.showEvidenceDefault;
      // Compact right-aligned action cluster (not full-width). Wiring/dispatch unchanged.
      switch (userAssertion) {
        case "NULL" :
          return (
            <div className={styles.bigActions}>
              <button
                className={styles.btnAcceptBig}
                onClick={() => { props.updatePublication(props.personIdentifier, pmid, 'ACCEPTED'); dispatch(showEvidenceByDefault(evDefault))}}
              >
                <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" width="15" height="15"><path d="M13.5 4.5L6.3 11.7 3 8.4"/></svg>
                Accept
              </button>
              <span className={styles.deadZone}><span className={styles.deadZoneLine} /></span>
              <button
                className={styles.btnRejectBig}
                onClick={() =>{ props.updatePublication(props.personIdentifier, pmid, 'REJECTED'); dispatch(showEvidenceByDefault(evDefault))}}
              >
                <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" width="15" height="15"><path d="M4.5 4.5l7 7M11.5 4.5l-7 7"/></svg>
                Reject
              </button>
            </div>
          )
        case "ACCEPTED" :
          if (props.activekey === 'NULL') {
            return (
              <div className={`${styles.cardActions} ${styles.cardActionsActioned}`}>
                <button
                  className={styles.btnUndo}
                  onClick={() => { props.updatePublication(props.personIdentifier, pmid, 'NULL'); dispatch(showEvidenceByDefault(evDefault)); }}
                >
                  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" width="13" height="13"><path d="M3 8a5 5 0 105-5H5M3 8V4m0 4H7"/></svg>
                  Undo
                </button>
              </div>
            );
          }
          return (
            <div className={styles.cardActions}>
              <button
                className={styles.btnReject}
                onClick={() => { props.updatePublication(props.personIdentifier, pmid, 'REJECTED'); dispatch(showEvidenceByDefault(evDefault)); }}
              >
                <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" width="13" height="13"><path d="M4.5 4.5l7 7M11.5 4.5l-7 7"/></svg>
                Reject
              </button>
              <button
                className={styles.btnUndo}
                onClick={() => { props.updatePublication(props.personIdentifier, pmid, 'NULL'); dispatch(showEvidenceByDefault(evDefault)); }}
              >
                <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" width="13" height="13"><path d="M3 8a5 5 0 105-5H5M3 8V4m0 4H7"/></svg>
                Undo
              </button>
            </div>
          );
        case "REJECTED" :
          if (props.activekey === 'NULL') {
            return (
              <div className={`${styles.cardActions} ${styles.cardActionsActioned}`}>
                <button
                  className={styles.btnUndo}
                  onClick={() => { props.updatePublication(props.personIdentifier, pmid, 'NULL'); dispatch(showEvidenceByDefault(evDefault)); }}
                >
                  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" width="13" height="13"><path d="M3 8a5 5 0 105-5H5M3 8V4m0 4H7"/></svg>
                  Undo
                </button>
              </div>
            );
          }
          return (
            <div className={styles.cardActions}>
              <button
                className={styles.btnUndo}
                onClick={() => { props.updatePublication(props.personIdentifier, pmid, 'NULL'); dispatch(showEvidenceByDefault(evDefault)); }}
              >
                <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" width="13" height="13"><path d="M3 8a5 5 0 105-5H5M3 8V4m0 4H7"/></svg>
                Undo
              </button>
              <button
                className={styles.btnAccept}
                onClick={() => { props.updatePublication(props.personIdentifier, pmid, 'ACCEPTED'); dispatch(showEvidenceByDefault(evDefault)); }}
              >
                <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" width="13" height="13"><path d="M13 4.5L6.2 11.5 3 8.3"/></svg>
                Accept
              </button>
            </div>
          );
        default:
          return null;
      }
    }

    const fullName = (person: any) => {
      let userName = "";
      if(person !== undefined) {
          if(person.firstName !== undefined) {
            userName += person.firstName + ' ';
          }
          if(person.middleInitial !== undefined) {
            userName += person.middleName + ' ';
          }
          if(person.lastName !== undefined) {
            userName += person.lastName + ' ';
          }
      }
      return userName; 
    }

    // Provenance badges (Affiliation / Scopus / PubMed / Journal Category, etc.) all read
    // as one light pill. Color is reserved strictly for match semantics, not source.
    const getTagClass = (_tag: string): string => {
      return styles.evTag;
    };

    const TableCellWithTypes = (props: any) => {
      return(
        <>
          {props.list.map((item, index) => {
            const hasPubmedTag = item.tags.some((t: string) => t.toLowerCase() === 'pubmed');
            return (
              <p key={index} className={hasPubmedTag && props.list.length > 1 ? styles.dataSub : undefined}>
                {item.name}
                {item.url && <a href={item.url} target="_blank" rel="noreferrer">{item.urlName} ↗</a>}
                {
                  item.tags.map((tag, index) => {
                    return (
                      <span className={getTagClass(tag)} key={index}>{tag}</span>
                    )
                  })
                }
              </p>
            )
          })}
        </>
      )
    }

    const evidenceTableRowTitles = [
      { authorNameEvidence: 'Name' },
      { relationshipEvidence: 'Relationships'},
      { emailEvidence : 'Email'},
      { organizationalUnitEvidence : 'Departmental affiliation'},
      { affiliationEvidence: 'Target author affiliation' },
      { grantEvidence: 'Grants' },
      { journalCategoryEvidence: 'Journal category'},
      { educationYearEvidence: 'Degree year discrepancy'},
      { genderEvidence: 'Inferred gender of name '},
      { articleCountEvidence: 'Candidate article count'},
      { authorCountEvidence: 'Candidate author count'},
      //{ averageClusteringEvidence: 'Clustering'},
      { coAuthorAffiliationEvidence: 'Co-author affiliation'},
    ]

    const evidenceTableCellFields = {
       authorNameEvidence: { points: 'nameScoreTotal', dataFormat: 'true' },
       relationshipEvidence: { relationshipNegativeScore: 'relationshipNegativeMatchScore',relationshipPostiveScore: 'relationshipPositiveMatchScore', relationshipIdentityCount: 'relationshipIdentityCount', dataFormat: 'true'},
       emailEvidence: { points: 'emailMatchScore', institutionalData:'emailMatch', articleData: 'emailMatch'}, 
       organizationalUnitEvidence: { dataFormat: 'true' },
       affiliationEvidence: { scopusUrl: 'https://www.scopus.com/affil/profile.uri?afid=', dataFormat: 'true' } ,
       grantEvidence: { dataFormat: 'true' },
       journalCategoryEvidence: { points: 'journalSubfieldScore', dataFormat: 'true'},
       educationYearEvidence: { points: 'educationYearEvidence', articleData: 'articleYear', dataFormat: 'true'},
       genderEvidence: { source: 'https://data.world/howarder/gender-by-name', dataFormat: 'true'},
       articleCountEvidence: { institutionalData:'-', articleData: 'countArticlesRetrieved', points: 'articleCountScore'},
       authorCountEvidence: { institutionalData:'-', articleData: 'countAuthors', points: 'authorCountScore'},
       //averageClusteringEvidence: { institutionalData:'-', dataFormat: 'true', points: 'clusterScoreModificationOfTotalScore'},
       personTypeEvidence: { institutionalData: 'personType', points: 'personTypeScore'},
       coAuthorAffiliationEvidence: { dataFormat: 'true'},
    }

    const displayRow = (row, evidence) => {
      if (evidence.hasOwnProperty(Object.keys(row)[0])) {
        if (Object.keys(row)[0] === 'relationshipEvidence') {
            return true;
        } else {
          return true
        }
      } else if (Object.keys(row)[0] === 'coAuthorAffiliationEvidence') {
        if(evidence.affiliationEvidence !== undefined) {
          if (evidence.affiliationEvidence.scopusNonTargetAuthorAffiliation !== undefined) {
            return true;
          }
        }
      } else{
        return false;
      }
    }

    const determineMatchType = (rowName: string, points: any, evidence: any): 'match' | 'partial' | 'mismatch' | 'nodata' => {
      const p = Number(points);
      if (isNaN(p) || p === 0) return 'nodata';
      if (p > 1) return 'match';
      if (p > 0) return 'partial';
      return 'mismatch';
    };

    // Status lives in exactly one place — the icon color. No fills, no rails, no bars.
    const matchColors: Record<string, { color: string; label: string }> = {
      match: { color: '#1D9E75', label: 'Strong' },
      partial: { color: '#BA7517', label: 'Partial' },
      mismatch: { color: '#c0392b', label: 'Mismatch' },
      nodata: { color: '#8a94a6', label: 'No data' },
    };

    const matchIcons: Record<string, JSX.Element> = {
      match: <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" width="14" height="14"><circle cx="8" cy="8" r="6.5"/><path d="M5.3 8.2l1.8 1.8 3.6-3.8"/></svg>,
      partial: <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" width="14" height="14"><circle cx="8" cy="8" r="6.5"/><path d="M8 4.8v3.6M8 10.7v.05"/></svg>,
      mismatch: <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" width="14" height="14"><circle cx="8" cy="8" r="6.5"/><path d="M5.8 5.8l4.4 4.4M10.2 5.8l-4.4 4.4"/></svg>,
      nodata: <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" width="14" height="14"><circle cx="8" cy="8" r="6.5"/><path d="M5 8h6"/></svg>,
    };

    const formatEvidenceTable = (evidence: any) => {
      let evidenceTableRows = []
        evidenceTableRowTitles.filter((row) => displayRow(row, evidence)).map((title, index) => {
          let rowName = Object.keys(title)[0];
          let rowFields = evidenceTableCellFields[rowName];
          let points = '';
          let pointsText:any = '';
          let source = '';
          let institutionalData = '-';
          let articleData = '-';
          let displayInstDataList = false;
          let displayArticleDataList = false;
          let institutionalDataList = [];
          let articleDataList = [];
          if (rowFields && evidence[rowName]) {
            if (rowFields.hasOwnProperty('points')) {
              if (evidence[rowName]) {
                if (evidence[rowName][rowFields['points']]) {
                  let unFormattedpoints = evidence[rowName][rowFields['points']]
                  points = (Math.round(unFormattedpoints * 100 + Number.EPSILON) / 100).toString();
                }
              }
            }

            if (rowFields['dataFormat']) {
              if (rowName === 'authorNameEvidence') {
                institutionalData = fullName(evidence[rowName].institutionalAuthorName)
                articleData = fullName(evidence[rowName].articleAuthorName)
              }

              if (rowName === 'relationshipEvidence') {
                points = (evidence[rowName].relationshipPositiveMatchScore + evidence[rowName].relationshipNegativeMatchScore).toFixed(2)
                const posScore = (evidence[rowName].relationshipPositiveMatchScore ?? 0).toFixed(2);
                const negScore = (evidence[rowName].relationshipNegativeMatchScore ?? 0).toFixed(2);
                const idCount = evidence[rowName].relationshipIdentityCount || 0;
                pointsText = <span>+{posScore} / {'\u2212'}{Math.abs(Number(negScore)).toFixed(2)} {'\u00B7'} {idCount} identities</span>
                if (evidence[rowName].hasOwnProperty('relationshipPositiveMatch')) {
                  displayInstDataList = true;
                  displayArticleDataList = true;
                  evidence[rowName].relationshipPositiveMatch.forEach(match => {
                    let username = fullName(match.relationshipNameIdentity);
                    let tags = match.relationshipType;
                    institutionalDataList.push({ name: username, tags: tags});
                    articleDataList.push({ name: username, tags: []});
                  });
                }
              }

              if (rowName === 'affiliationEvidence') {
                let scopusTargetAuthorAffiliationScore = 0;
                let pubmedTargetAuthorAffiliationScore = 0;
                displayInstDataList = true;
                displayArticleDataList = true;
                if (evidence[rowName].hasOwnProperty('scopusTargetAuthorAffiliation')) {
                  let matchType = ''
                  evidence[rowName].scopusTargetAuthorAffiliation.forEach((scopusTargetAuthorAffiliation: any) => {
                    scopusTargetAuthorAffiliationScore = scopusTargetAuthorAffiliationScore + scopusTargetAuthorAffiliation.targetAuthorInstitutionalAffiliationMatchTypeScore
                    if(scopusTargetAuthorAffiliation.hasOwnProperty('targetAuthorInstitutionalAffiliationMatchType')) {
                      if(scopusTargetAuthorAffiliation.targetAuthorInstitutionalAffiliationMatchType === 'POSITIVE_MATCH_INDIVIDUAL') {
                          matchType = 'Affiliation'
                      } else if(scopusTargetAuthorAffiliation.targetAuthorInstitutionalAffiliationMatchType === 'POSITIVE_MATCH_INSTITUTION') {
                          matchType = 'Affiliation'
                      } else if(scopusTargetAuthorAffiliation.targetAuthorInstitutionalAffiliationMatchType === 'NULL_MATCH') {
                          matchType = 'No data available'
                      } else {
                          matchType = 'No Match'
                      }
                    }
                    let targetAuthorInstitutionalAffiliationIdentity = ''
                    if (scopusTargetAuthorAffiliation.hasOwnProperty('targetAuthorInstitutionalAffiliationIdentity')) {
                      targetAuthorInstitutionalAffiliationIdentity = scopusTargetAuthorAffiliation.targetAuthorInstitutionalAffiliationIdentity
                    }
                    if (matchType === 'No data available') {
                      institutionalDataList.push({ name: '-', tags: []})
                      articleDataList.push({ name: '', tags: [matchType]})
                    } else {
                      institutionalDataList.push({ name: targetAuthorInstitutionalAffiliationIdentity, tags: [matchType]});
                      let targetAuthorInstitutionalAffiliationArticleScopusLabel = ''
                      if (scopusTargetAuthorAffiliation.hasOwnProperty('targetAuthorInstitutionalAffiliationArticleScopusLabel')) {
                          targetAuthorInstitutionalAffiliationArticleScopusLabel = scopusTargetAuthorAffiliation.targetAuthorInstitutionalAffiliationArticleScopusLabel
                      }
                      articleDataList.push({ name: targetAuthorInstitutionalAffiliationArticleScopusLabel, tags: ['Scopus'], source: rowFields['scopusUrl'] + scopusTargetAuthorAffiliation.targetAuthorInstitutionalAffiliationArticleScopusAffiliationId});
                    }
                  })
                }
                if(evidence[rowName].hasOwnProperty('pubmedTargetAuthorAffiliation')) {
                  displayInstDataList = true;
                  displayArticleDataList = true;
                  let matchType = ''
                  pubmedTargetAuthorAffiliationScore = Number(evidence[rowName].pubmedTargetAuthorAffiliation.targetAuthorInstitutionalAffiliationMatchTypeScore)
                  if (evidence[rowName].pubmedTargetAuthorAffiliation.hasOwnProperty('targetAuthorInstitutionalAffiliationMatchType')) {
                      if (evidence[rowName].pubmedTargetAuthorAffiliation.targetAuthorInstitutionalAffiliationMatchType === 'POSITIVE_MATCH_INDIVIDUAL') {
                          matchType = 'Affiliation'
                      } else if(evidence[rowName].pubmedTargetAuthorAffiliation.targetAuthorInstitutionalAffiliationMatchType === 'POSITIVE_MATCH_INSTITUTION') {
                          matchType = 'Affiliation'
                      } else if(evidence[rowName].pubmedTargetAuthorAffiliation.targetAuthorInstitutionalAffiliationMatchType === 'NULL_MATCH') {
                          matchType = 'No data available'
                      } else {
                          matchType = 'No Match'
                      }
                  }
                  displayInstDataList = false;
                  institutionalData = '-';
                  articleDataList.push({ name: evidence[rowName].pubmedTargetAuthorAffiliation.targetAuthorInstitutionalAffiliationArticlePubmedLabel, tags: ['PubMed']})
                }
                let totalScore = scopusTargetAuthorAffiliationScore + pubmedTargetAuthorAffiliationScore
                points = totalScore.toString();
              }

              if (rowName === 'organizationalUnitEvidence') {
                let scoreTotal = 0
                let itemCount = 0
                displayInstDataList = true;
                displayArticleDataList = true;
                evidence[rowName].forEach((orgUnitItem: any) => {
                    itemCount++
                    scoreTotal = scoreTotal + Number(orgUnitItem.organizationalUnitMatchingScore + orgUnitItem.organizationalUnitModifierScore)
                    if(orgUnitItem.hasOwnProperty('organizationalUnitType')) {
                      const unitType = orgUnitItem.organizationalUnitType.charAt(0).toUpperCase() + orgUnitItem.organizationalUnitType.slice(1).toLowerCase();
                      institutionalDataList.push({ name: orgUnitItem.identityOrganizationalUnit, tags: [unitType]})
                    } else {
                      institutionalDataList.push({ name: orgUnitItem.identityOrganizationalUnit, tags: []})
                    }
                    if(itemCount === 1) {
                      articleDataList.push({ name: orgUnitItem.articleAffiliation, tags: ['PubMed']})
                    }
                })
                points = scoreTotal.toString();
              }

              if (rowName === 'journalCategoryEvidence') {
                displayInstDataList = true;
                displayArticleDataList = true;
                if (evidence[rowName].journalSubfieldDepartment === 'NO_MATCH') {
                  displayInstDataList = false;
                  institutionalData = '-';
                } else {
                  institutionalDataList.push({ name: evidence[rowName].journalSubfieldDepartment, tags: ['Org Unit'] })
                }
                articleDataList.push({ name: evidence[rowName].journalSubfieldScienceMetrixLabel, tags: ['Journal Category']})
              }

              if (rowName === 'educationYearEvidence') {
                if (evidence[rowName].identityBachelorYear !== undefined) {
                  institutionalData = evidence[rowName].identityBachelorYear + ' - Bachelors'
                }
                if (evidence[rowName].identityDoctoralYear !== undefined) {
                  institutionalData = (institutionalData === '-') ? evidence[rowName].identityDoctoralYear + ' - Doctoral' : institutionalData + ' , ' + evidence[rowName].identityDoctoralYear + ' - Doctoral';
                }
                points = evidence[rowName].discrepancyDegreeYearBachelorScore + evidence[rowName].discrepancyDegreeYearDoctoralScore
              }

              if (rowName === 'genderEvidence') {
                if(evidence[rowName].hasOwnProperty('genderScoreIdentity')) {
                  if(Number(evidence[rowName].genderScoreIdentity) >= 0.5) {
                      institutionalData = 'Male - ' + (Number(evidence[rowName].genderScoreIdentity) * 100) + '% probability'
                  } else {
                    institutionalData = 'Female - ' + Math.round(((1 - Number(evidence[rowName].genderScoreIdentity)) * 100)) + '% probability'
                  }
                }
                if (evidence[rowName].hasOwnProperty('genderScoreArticle')) {
                  if(Number(evidence[rowName].genderScoreArticle) >= 0.5) {
                    articleData = 'Male - ' + (Number(evidence[rowName].genderScoreArticle) * 100) + '% probability'
                } else {
                    articleData = 'Female - ' + Math.round(((1 - Number(evidence[rowName].genderScoreArticle)) * 100)) + '% probability'
                }
                }
              }

              if (rowName === 'averageClusteringEvidence') {
                displayArticleDataList = true;
                articleDataList.push({ name: 'Score of article without clustering: ' + evidence[rowName].totalArticleScoreWithoutClustering, tags: []});
                articleDataList.push({ name: 'Average score of cluster: ' + evidence[rowName].clusterScoreAverage, tags: []});
              }
            }

            if (rowName == 'grantEvidence') {
              let scoreTotal = 0
              if(evidence[rowName].grants !== undefined && evidence[rowName].grants.length > 0) {
                evidence[rowName].grants.forEach((grant: any) => {
                    scoreTotal = scoreTotal + grant.grantMatchScore
                    displayInstDataList = true;
                    displayArticleDataList = true;
                    institutionalDataList.push({ name: grant.institutionGrant, tags: []})
                    articleDataList.push({ name: grant.articleGrant, tags: []})
                })
                points = scoreTotal.toString();
              }
            }

            if (rowName == 'genderEvidence') {
              points = evidence[rowName].genderScoreIdentityArticleDiscrepancy.toString();
            }

            if (rowFields.hasOwnProperty('source')) {
              source = rowFields['source'];
            }

            if (rowFields.hasOwnProperty('institutionalData')) {
              if (evidence[rowName] && evidence[rowName][rowFields['institutionalData']]) {
                institutionalData = evidence[rowName][rowFields['institutionalData']];
              }
            }

            if (rowFields.hasOwnProperty('articleData')) {
              if (evidence[rowName] && evidence[rowName][rowFields['articleData']]) {
                articleData = evidence[rowName][rowFields['articleData']];
              }
            }
          }

          if (rowName === 'coAuthorAffiliationEvidence') {
            let scopusNonTargetAuthorAffiliationScore = evidence.affiliationEvidence.scopusNonTargetAuthorAffiliation.nonTargetAuthorInstitutionalAffiliationScore;
            if(evidence.affiliationEvidence.scopusNonTargetAuthorAffiliation.nonTargetAuthorInstitutionalAffiliationMatchKnownInstitution !== undefined) {
              displayInstDataList = true;
              displayArticleDataList = true;
              evidence.affiliationEvidence.scopusNonTargetAuthorAffiliation.nonTargetAuthorInstitutionalAffiliationMatchKnownInstitution.forEach((matchingKnownInst: any) => {
                  let knownInst = matchingKnownInst.split(', ')
                  let articleDataName = knownInst[2] + ' author(s) from '
                  institutionalDataList.push({ name: knownInst[0], tags: ['Affiliation']})
                  articleDataList.push({ name: articleDataName, tags: ['Scopus'], url: "https://www.scopus.com/affil/profile.uri?afid=" + knownInst[1], urlName: knownInst[0]})
              })
            }

            if(evidence.affiliationEvidence.scopusNonTargetAuthorAffiliation.nonTargetAuthorInstitutionalAffiliationMatchCollaboratingInstitution !== undefined) {
              displayInstDataList = true;
              displayArticleDataList = true;
              evidence.affiliationEvidence.scopusNonTargetAuthorAffiliation.nonTargetAuthorInstitutionalAffiliationMatchCollaboratingInstitution.forEach((matchingCollabInst: any) => {
                let collabInst = matchingCollabInst.split(', ')
                institutionalDataList.push({ name: collabInst[0], tags: ['Affiliation']})
                articleDataList.push({ name: collabInst[2] + ' author(s) from ', url: "https://www.scopus.com/affil/profile.uri?afid=" + collabInst[1], urlName: collabInst[0], tags: ['Scopus']})
              })
            }

            points = scopusNonTargetAuthorAffiliationScore.toString()
          }

          let evidenceTableRowData = {
            title: Object.values(title),
            name: Object.keys(title)[0],
            points: points,
            pointsText: pointsText,
            institutionalData: institutionalData,
            articleData: articleData,
            displayInstDataList: displayInstDataList,
            displayArticleDataList: displayArticleDataList,
            institutionalDataList: institutionalDataList,
            articleDataList: articleDataList,
            source: source,
            spanData: Object.keys(title)[0] === 'relationshipEvidence',
          }

          evidenceTableRows.push(evidenceTableRowData);
        })

        // Sort Evidence Rows by highest score first
        evidenceTableRows.sort((a: any, b: any) => Math.abs(b.points) - Math.abs(a.points))

        // Keep Author Name Evidence at the top
        const authorNameEvidenceIndex = evidenceTableRows.findIndex((e) => e.name === 'authorNameEvidence');
        if (authorNameEvidenceIndex > 0) {
          const authorNameEvidenceData = evidenceTableRows[authorNameEvidenceIndex];
          evidenceTableRows.splice(authorNameEvidenceIndex, 1);
          evidenceTableRows.unshift(authorNameEvidenceData);
        }

        const visibleRows = evidenceTableRows.filter((r: any) => Number(r.points) !== 0);
        const zeroRows = evidenceTableRows.filter((r: any) => Number(r.points) === 0);
        const rowsToRender = showZeroWeight ? evidenceTableRows : visibleRows;

        const IdentityRow = ({ evidenceRow, idx }: { evidenceRow: any; idx: number }) => {
          const mt = determineMatchType(evidenceRow.name, evidenceRow.points, evidence);
          const mc = matchColors[mt];
          const ptsNum = Number(evidenceRow.points) || 0;
          const ptsIsNeg = ptsNum < 0;
          return (
            <div className={styles.identityRow} key={idx}>
              <div className={styles.identityEvidence}>
                <span className={styles.matchIcon} style={{ color: mc.color }}>{matchIcons[mt]}</span>
                <span className={styles.evName}>{evidenceRow.title}</span>
                {evidenceRow.source && <a href={evidenceRow.source} target="_blank" rel="noreferrer" className={styles.sourceLink}>(source)</a>}
                {evidenceRow.pointsText ? (
                  <span className={styles.evPoints}>{evidenceRow.pointsText}</span>
                ) : (
                  <span className={ptsIsNeg ? styles.evPointsNeg : styles.evPoints}>
                    {ptsNum !== 0 ? ptsNum.toFixed(2) : '0.00'} pts
                  </span>
                )}
              </div>
              {evidenceRow.spanData ? (
                <div className={styles.identityDataSpan}>
                  {evidenceRow.displayInstDataList ? <TableCellWithTypes list={evidenceRow.institutionalDataList} /> : (evidenceRow.institutionalData === '-' ? <span className={styles.dataEmpty}>{'\u2014'}</span> : <span>{evidenceRow.institutionalData}</span>)}
                </div>
              ) : (
                <>
                  <div className={styles.identityData}>
                    {evidenceRow.displayInstDataList ? <TableCellWithTypes list={evidenceRow.institutionalDataList} /> : (evidenceRow.institutionalData === '-' ? <span className={styles.dataEmpty}>{'\u2014'}</span> : <span>{evidenceRow.institutionalData}</span>)}
                  </div>
                  <div className={styles.identityData}>
                    {evidenceRow.displayArticleDataList ? <TableCellWithTypes list={evidenceRow.articleDataList} /> : (evidenceRow.articleData === '-' ? <span className={styles.dataEmpty}>{'\u2014'}</span> : <span>{evidenceRow.articleData}</span>)}
                  </div>
                </>
              )}
            </div>
          );
        };

        return (
          <>
            {/* Quiet column header */}
            <div className={`${styles.identityRow} ${styles.identityHeaderRow}`}>
              <div className={styles.identityEvidence}>Evidence</div>
              <div className={styles.identityData}>Institutional</div>
              <div className={styles.identityData}>Article</div>
            </div>
            {/* Rows */}
            {rowsToRender.map((evidenceRow: any, idx: number) => (
              <IdentityRow evidenceRow={evidenceRow} idx={idx} key={idx} />
            ))}
            {/* Zero-weight toggle */}
            {zeroRows.length > 0 && (
              <button className={styles.zeroToggle} onClick={() => setShowZeroWeight(!showZeroWeight)}>
                {showZeroWeight
                  ? 'Hide zero-weight factors'
                  : `Show ${zeroRows.length} zero-weight factor${zeroRows.length > 1 ? 's' : ''} (${zeroRows.map((r: any) => r.title).join(', ')})`
                }
              </button>
            )}
          </>
        );
    }

const formatFeedbackLabel = (key: string): string => {
  return key
    .replace('feedbackScore', '')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\b\w/g, (char) => char.toUpperCase())
    .replace('Orcid', 'ORCID')
    .replace('Co Author Name:', 'Co-Author Name')
    .replace('Co Author', 'Co-Author')
    .replace('Journal Sub Field', 'Journal Subfield');
};

const displayFeedbackEvidence = (feedbackEvidence: Record<string, number>): JSX.Element => {
  const sortedFeedback = (feedbackEvidence ? Object.entries(feedbackEvidence) : [])
    .map(([key, value]) => [formatFeedbackLabel(key), Math.round(value as number)] as [string, number])
    .filter(([, v]) => v !== 0)
    .sort((a, b) => b[1] - a[1]);

  // Scale every bar against the documented ±100 feedback range (not the per-card
  // max), so the same value renders at the same width on every card — bars stay
  // comparable across publications. Values beyond 100 cap at full width.
  const FEEDBACK_SCALE = 100;

  return (
    <div className={styles.feedbackList}>
      {sortedFeedback.map(([label, value], i) => {
        const isNeg = value < 0;
        const barPct = Math.min((Math.abs(value) / FEEDBACK_SCALE) * 100, 100);
        return (
          <React.Fragment key={i}>
            <span className={styles.feedbackLabel}>{label}</span>
            <span className={isNeg ? styles.feedbackValueNeg : styles.feedbackValue}>
              {isNeg ? `−${Math.abs(value)}` : value}
            </span>
            <div className={styles.feedbackBarTrack}>
              <div
                className={isNeg ? styles.feedbackBarFillNeg : styles.feedbackBarFill}
                style={{ width: `${barPct}%` }}
              />
            </div>
          </React.Fragment>
        );
      })}
    </div>
  );
};
    const rawScore = reciterArticle.authorshipLikelihoodScore ?? null;
    const score = rawScore !== null ? Math.round(rawScore) : null;
    const scoreNum = typeof score === 'number' ? score : 0;
    const userAssertion = reciterArticle.userAssertion;
    const isActioned = userAssertion === 'ACCEPTED' || userAssertion === 'REJECTED';
    const evDefault = expandedPubIndex ? expandedPubIndex : props.showEvidenceDefault;

    return (
      // eslint-disable-next-line jsx-a11y/no-static-element-interactions
      <div className={`${styles.articleCard}${props.isFocused ? ` ${styles.focused}` : ''}`} data-pmid={reciterArticle.pmid} onMouseDown={props.onCardMouseDown}>
        {/* Status strip for accepted/rejected */}
        {userAssertion === 'ACCEPTED' && <div className={styles.statusStripAccepted} />}
        {userAssertion === 'REJECTED' && <div className={styles.statusStripRejected} />}

        {/* Main content column */}
        <div className={styles.cardMain}>
          <div className={styles.cardTop}>
            {/* Score tile — left rail */}
            <div className={styles.scoreArea}>
              <span className={styles.scoreTip}>
                <span className={scoreNum >= 70 ? styles.scoreTileHigh : scoreNum >= 40 ? styles.scoreTileMedium : styles.scoreTileLow}>
                  <span className={styles.scoreTileNumber}>{score !== null ? score : "N/A"}</span>
                  <span className={styles.scoreTileLabel}>SCORE</span>
                </span>
                {score !== null && (
                  <span className={styles.scoreTooltip}>
                    <span className={styles.stRow}>
                      <span className={styles.stLabel}>Score</span>
                      <span className={scoreNum >= 70 ? styles.stValGreen : scoreNum >= 40 ? styles.stValAmber : styles.stValMuted}>{rawScore !== null ? Number(rawScore).toFixed(2) : scoreNum}</span>
                    </span>
                    <span className={styles.stRow}>
                      <span className={styles.stLabel}>Tier</span>
                      <span className={scoreNum >= 70 ? styles.stValGreen : scoreNum >= 40 ? styles.stValAmber : styles.stValMuted}>
                        {scoreNum >= 70 ? 'Strong match' : scoreNum >= 40 ? 'Moderate match' : 'Weak match'}
                      </span>
                    </span>
                  </span>
                )}
              </span>
            </div>
            {/* Content area */}
            <div className={styles.cardContent}>
              {/* Row 1: Type chip · date · PMID link */}
              <div className={styles.cardMetaRow}>
                <div className={styles.cardMetaLeft}>
                  {reciterArticle.publicationType?.publicationTypeCanonical &&
                    <span className={styles.typeBadge}>{reciterArticle.publicationType.publicationTypeCanonical}</span>
                  }
                  {reciterArticle.publicationDateDisplay && <><span className={styles.cardMetaSep}>·</span><span className={styles.cardDate}>{reciterArticle.publicationDateDisplay}</span></>}
                  <><span className={styles.cardMetaSep}>·</span><span className={styles.cardDate}><span className={styles.pmidLabel}>PMID</span> <a className={styles.pmidLink} href={`${pubMedUrl}${reciterArticle.pmid}`} target="_blank" rel="noreferrer">{reciterArticle.pmid}</a><span style={{userSelect: 'none', color: '#2563a8'}}> ↗</span></span></>
                  {reciterArticle.firstRetrievalDate && <><span className={styles.cardMetaSep}>·</span><span className={styles.cardDate}>First retrieved {reciterArticle.firstRetrievalDate}</span></>}
                  {userAssertion === 'ACCEPTED' && (
                    <span className={styles.statusChipAccepted}>
                      <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" width="12" height="12"><path d="M13 4.5L6.2 11.5 3 8.3"/></svg>
                      Accepted
                    </span>
                  )}
                  {userAssertion === 'REJECTED' && (
                    <span className={styles.statusChipRejected}>
                      <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" width="12" height="12"><path d="M4.5 4.5l7 7M11.5 4.5l-7 7"/></svg>
                      Rejected
                    </span>
                  )}
                </div>
              </div>
              {/* Row 2: Title */}
              <div className={styles.articleTitle}>{reciterArticle.articleTitle}</div>
              {/* Row 3: Authors */}
              <div className={styles.articleAuthors}>
                {reciterArticle.reCiterArticleAuthorFeatures?.length > 0 &&
                  displayAuthors(reciterArticle.reCiterArticleAuthorFeatures)}
              </div>
              {/* Row 4: Journal */}
              <div className={styles.articleMeta}>
                <span>{reciterArticle.journalTitleVerbose}</span>
                {Object.keys(feedbacklog).length > 0 && (
                  <span className={styles.curationWrap} ref={curationLogRef}>
                    <button className={styles.evidenceBtn} onClick={(e) => { e.stopPropagation(); setShowCurationLog(!showCurationLog); }}>Curation log</button>
                    {showCurationLog && (
                      <div className={styles.curationLogPopover}>
                        <div className={styles.clogHead}>Curation history</div>
                        {clogEntries.length > 0 ? (
                          clogEntries.map((entry: any, i: number) => {
                            const action = entry.feedback === 'ACCEPTED' ? 'accepted' : entry.feedback === 'REJECTED' ? 'rejected' : 'undone';
                            const verb = entry.feedback === 'ACCEPTED' ? 'Accepted' : entry.feedback === 'REJECTED' ? 'Rejected' : 'Suggested';
                            const who = entry.AdminUser?.personIdentifier || '';
                            const date = formatClogDate(entry.modifyTimestamp);
                            return (
                              <div className={styles.clogEntry} key={entry.feedbackID || i}>
                                <div className={styles.clogAction}>
                                  <div className={`${styles.clogDot} ${action === 'accepted' ? styles.clogDotAccepted : action === 'rejected' ? styles.clogDotRejected : styles.clogDotUndone}`} />
                                  <span className={`${styles.clogVerb} ${action === 'accepted' ? styles.clogVerbAccepted : action === 'rejected' ? styles.clogVerbRejected : styles.clogVerbUndone}`}>{verb}</span>
                                  <span className={styles.clogWho}>{who}</span>
                                </div>
                                <span className={styles.clogDate}>{date}</span>
                              </div>
                            );
                          })
                        ) : (
                          <div className={styles.clogEmpty}>No curation events yet</div>
                        )}
                      </div>
                    )}
                  </span>
                )}
              </div>


            </div>
          </div>
          {/* Footer row — action cluster left, evidence link right */}
          <div className={styles.cardFooter}>
            <CardFooter pmid={reciterArticle.pmid} userAssertion={userAssertion} />
            {reciterArticle.evidence !== undefined ? (
              <button className={styles.evidenceBtnPrimary} data-evidence-toggle onClick={() => toogleEvidence(props.index)}>
                <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><circle cx="5.5" cy="5.5" r="4" stroke="currentColor" strokeWidth="1.3"/><path d="M8.5 8.5L11.5 11.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg>
                Supporting evidence
              </button>
            ) : <span />}
          </div>
          {/* Evidence panel — full card width */}
          {reciterArticle.evidence !== undefined && (
            <div className={`${styles.publicationShowEvidenceContainer} ${(props.index === props.showEvidenceDefault || showEvidence) ? styles.publicationShowEvidenceContainerOpen : ""}`}>

              {/* Feedback-based scores */}
              <div className={styles.sectionBlock}>
                <div className={styles.sectionHeader}>
                  <span className={styles.sectionTitle}>Feedback-based scores</span>
                  <div className={styles.learnMoreWrap}>
                    <div className={styles.learnMoreBtn}>
                      <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" width="13" height="13"><circle cx="8" cy="8" r="6.5"/><path d="M8 7v4M8 5.5v.5" strokeLinecap="round"/></svg>
                      Learn more
                    </div>
                    <div className={styles.learnMorePopover}>
                      <p>Based on attributes from articles you&apos;ve previously accepted or rejected, we&apos;ve generated the following feedback-based scores for <strong>{props.fullName}.</strong> Each subscore represents the contribution of a specific attribute to the overall likelihood that the article was authored by <strong>{props.fullName}.</strong></p>
                      <p>A score of <strong>100</strong> for an attribute indicates strong evidence supporting authorship, while a score of <strong>&minus;100</strong> suggests strong evidence against it. Scores closer to 0 represent attributes that provide less definitive evidence.</p>
                    </div>
                  </div>
                </div>
                <div className={styles.sectionCard}>
                  {reciterArticle.evidence.feedbackEvidence && Object.keys(reciterArticle.evidence.feedbackEvidence).length > 0
                    ? displayFeedbackEvidence(reciterArticle.evidence.feedbackEvidence)
                    : <p style={{color:'#8a94a6', fontStyle:'italic', margin:'0'}}>No feedback available.</p>
                  }
                </div>
              </div>

              {/* Identity-based scores */}
              <div className={styles.sectionBlock}>
                <div className={styles.sectionHeader}>
                  <span className={styles.sectionTitle}>Identity-based scores</span>
                  <div className={styles.learnMoreWrap}>
                    <div className={styles.learnMoreBtn}>
                      <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" width="13" height="13"><circle cx="8" cy="8" r="6.5"/><path d="M8 7v4M8 5.5v.5" strokeLinecap="round"/></svg>
                      Legend
                    </div>
                    <div className={`${styles.learnMorePopover} ${styles.legendPopover}`}>
                      {Object.entries(matchColors).map(([key, mc]) => (
                        <span className={styles.legendItem} key={key}>
                          <span className={styles.legendIcon} style={{ color: mc.color }}>{matchIcons[key]}</span>
                          {mc.label}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
                <div className={styles.identityCard}>
                  {formatEvidenceTable(reciterArticle.evidence)}
                </div>
              </div>

            </div>
          )}
        </div>


        <HistoryModal
          showModal={showHistoryModal}
          onOpen={onOpenModal}
          onClose={onCloseModal}
          id={reciterArticle.pmid}
          userId={props.personIdentifier}
        />
      </div>
    );
}

export default Publication;
