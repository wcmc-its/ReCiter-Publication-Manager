import React, { useState, FunctionComponent } from "react"
import styles from './Publication.module.css';
import { Popover, OverlayTrigger } from "react-bootstrap";
import CheckIcon from '@mui/icons-material/Check';
import ClearIcon from '@mui/icons-material/Clear';
import UndoIcon from '@mui/icons-material/Undo';
import { Container, Row, Col, Button, Accordion, Card } from "react-bootstrap";
import type { Author } from '../../../../types/Author';
import { useSelector, RootStateOrAny, useDispatch } from "react-redux";
import HistoryModal from "./HistoryModal";
import { showEvidenceByDefault } from "../../../redux/actions/actions";
import { reciterConfig } from "../../../../config/local";
import InfoIcon from '@mui/icons-material/Info';

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
    showEvidenceDefault?:any
}

const Publication: FunctionComponent<FuncProps> = (props) => {
    const feedbacklog = useSelector((state: RootStateOrAny) => state.feedbacklog)
    const [showEvidence, setShowEvidence] = useState<boolean>(false)
    const [expandedAuthors, setExpandedAuthors] = useState<boolean>(false)

    const filteredIdentities = useSelector((state: RootStateOrAny) => state.filteredIdentities)
    const [showHistoryModal, setShowHistoryModal] = useState<boolean>(false)
    const [expandedPubIndex, setExpandedPubIndex] = useState<any>(props.showEvidenceDefault ? props.showEvidenceDefault : null)

    const maxArticlesPerPerson = reciterConfig.reciter.featureGeneratorByGroup.featureGeneratorByGroupApiParams.maxArticlesPerPerson;
    const dispatch = useDispatch();

    const onOpenModal = () => setShowHistoryModal(true)
    const onCloseModal = () => setShowHistoryModal(false)
    
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

    const Buttons = ({index, pmid, userAssertion} : {
      index: number,
      pmid: number, 
      userAssertion: string
    }) => {
      switch (userAssertion) { 
        case "NULL" :
          return (
            <Row className="d-flex justify-content-md-between px-4">
            <Col xs lg={6} className="p-1"><button
                className={`btn btn-success w-100 p-2 ${styles.publicationAccept}`}
                onClick={() => { props.updatePublication(props.personIdentifier, pmid, 'ACCEPTED'); dispatch(showEvidenceByDefault(expandedPubIndex ? expandedPubIndex : props.showEvidenceDefault))}}
            ><CheckIcon fontSize="small"/> Accept
            </button>
            </Col>
            <Col xs lg={6} className="p-1">
            <button
                className={`btn btn-danger w-100 p-2 ${styles.publicationReject}`}
                onClick={() =>{ props.updatePublication(props.personIdentifier, pmid, 'REJECTED'); dispatch(showEvidenceByDefault(expandedPubIndex ? expandedPubIndex : props.showEvidenceDefault))}}
            ><ClearIcon fontSize="small"/> Reject
            </button>
            </Col>
            </Row>
          )
        case "ACCEPTED" :
          return (
            <Row className="d-flex justify-content-md-between px-4">
              <Col xs lg={6} className="p-1"><button
                className={`btn btn-default w-100 p-2 ${styles.publicationUndo}`}
                onClick={() => {props.updatePublication(props.personIdentifier, pmid, 'NULL'); dispatch(showEvidenceByDefault(expandedPubIndex ? expandedPubIndex : props.showEvidenceDefault))}}
              ><UndoIcon fontSize="small"/>Undo
              </button>
              </Col>
              <Col xs lg={6} className="p-1">
                <button
                  className={`btn btn-danger w-100 p-2 ${styles.publicationReject}`}
                  onClick={() =>{ props.updatePublication(props.personIdentifier, pmid, 'REJECTED'); dispatch(showEvidenceByDefault(expandedPubIndex ? expandedPubIndex : props.showEvidenceDefault))}}
                ><ClearIcon fontSize="small"/>Reject
                </button>
              </Col>
            </Row>
          )
        case "REJECTED" : 
          return (
            <Row className="d-flex justify-content-md-between px-4">
              <Col xs lg={6} className="p-1">
                <button
                    className={`btn btn-success w-100 p-2 ${styles.publicationAccept}`}
                    onClick={() => { props.updatePublication(props.personIdentifier, pmid , 'ACCEPTED'); dispatch(showEvidenceByDefault(expandedPubIndex ? expandedPubIndex : props.showEvidenceDefault))}}
                > <CheckIcon fontSize="small"/> Accept
                </button>
              </Col>
              <Col xs lg={6} className="p-1">
                <button
                    className={`btn btn-default w-100 p-2 ${styles.publicationUndo}`}
                    onClick={() => {props.updatePublication(props.personIdentifier, pmid, 'NULL'); dispatch(showEvidenceByDefault(expandedPubIndex ? expandedPubIndex : props.showEvidenceDefault))}}
                ><UndoIcon fontSize="small"/> Undo
                </button>
              </Col>
            </Row>
          )
        default:
          return (
            <></>
          )
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

    const TableCellWithTypes = (props: any) => {
      return(
        <>
          {props.list.map((item, index) => {
            return (
              <p key={index}>
                {item.name}
                {item.url && <a href={item.url} target="_blank" rel="noreferrer">{item.urlName}</a>}
                {
                  item.tags.map((tag, index) => {
                    return (
                      <span className={styles.reciterType} key={index}>{tag}</span>
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
      { affiliationEvidence: 'Target author\'s institutional affiliation' },
      { grantEvidence: 'Grants' },
      { journalCategoryEvidence: 'Journal category'},
      { educationYearEvidence: 'Degree year discrepancy'},
      { genderEvidence: 'Inferred gender of name '},
      { articleCountEvidence: 'Candidate article count'},
      { authorCountEvidence: 'Candidate author count'},
      //{ averageClusteringEvidence: 'Clustering'},
      { coAuthorAffiliationEvidence: 'Co-authors\'s institutional affiliation'},
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
          if (evidence.relationshipEvidence.hasOwnProperty('relationshipPositiveMatch')) {
            return true;
          } else {
            return false;
          }
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
                pointsText = <div>
                <p>Positive match: {(evidence[rowName].relationshipNegativeMatchScore ?? 0).toFixed(2)}</p>
                <p>Negative match: {(evidence[rowName].relationshipPositiveMatchScore ?? 0).toFixed(2)}</p>
                <p>Identity count: {evidence[rowName].relationshipIdentityCount || 0}</p>
              </div>				  
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
                          matchType = 'Individual Affiliation'
                      } else if(scopusTargetAuthorAffiliation.targetAuthorInstitutionalAffiliationMatchType === 'POSITIVE_MATCH_INSTITUTION') {
                          matchType = 'Institutional Collaborator'
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
                          matchType = 'Individual Affiliation'
                      } else if(evidence[rowName].pubmedTargetAuthorAffiliation.targetAuthorInstitutionalAffiliationMatchType === 'POSITIVE_MATCH_INSTITUTION') {
                          matchType = 'Institutional Collaborator'
                      } else if(evidence[rowName].pubmedTargetAuthorAffiliation.targetAuthorInstitutionalAffiliationMatchType === 'NULL_MATCH') {
                          matchType = 'No data available'
                      } else {
                          matchType = 'No Match'
                      }
                  }
                  displayInstDataList = false;
                  institutionalData = '-';
                  articleDataList.push({ name: evidence[rowName].pubmedTargetAuthorAffiliation.targetAuthorInstitutionalAffiliationArticlePubmedLabel, tags: ['Pubmed']})
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
                      institutionalDataList.push({ name: orgUnitItem.identityOrganizationalUnit, tags: [orgUnitItem.organizationalUnitType]})
                    } else {
                      institutionalDataList.push({ name: orgUnitItem.identityOrganizationalUnit, tags: []})
                    }
                    if(itemCount === 1) {
                      articleDataList.push({ name: orgUnitItem.articleAffiliation, tags: ['Pubmed']})
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
                  institutionalDataList.push({ name: evidence[rowName].journalSubfieldDepartment, tags: ['Organizational Unit'] })
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
                  let articleDataName = knownInst[2] + ' author(s) from ' + knownInst[0]
                  institutionalDataList.push({ name: knownInst[0], tags: ['Individual Affiliation']})
                  articleDataList.push({ name: articleDataName + ' ', tags: ['Scopus'], url: "https://www.scopus.com/affil/profile.uri?afid=" + knownInst[1], urlName: knownInst[1]})
              })
            }

            if(evidence.affiliationEvidence.scopusNonTargetAuthorAffiliation.nonTargetAuthorInstitutionalAffiliationMatchCollaboratingInstitution !== undefined) {
              displayInstDataList = true;
              displayArticleDataList = true;
              evidence.affiliationEvidence.scopusNonTargetAuthorAffiliation.nonTargetAuthorInstitutionalAffiliationMatchCollaboratingInstitution.forEach((matchingCollabInst: any) => {
                let collabInst = matchingCollabInst.split(', ')
                institutionalDataList.push({ name: collabInst[0], tags: ['Collaborating Institution']})
                articleDataList.push({ name: collabInst[2] + ' author(s) from ' + collabInst[0] + ' ', url: "https://www.scopus.com/affil/profile.uri?afid=" + collabInst[1], urlName: collabInst[1], tags: ['Scupus']})
              })
            }

            points = scopusNonTargetAuthorAffiliationScore.toString()
          }

          let evidenceTableRowData = { 
            title: Object.values(title),
            name: Object.keys(title)[0],
            points: points,
			      pointsText : pointsText,						
            institutionalData: institutionalData,
            articleData: articleData,
            displayInstDataList: displayInstDataList,
            displayArticleDataList: displayArticleDataList,
            institutionalDataList: institutionalDataList,
            articleDataList: articleDataList,
            source: source,
          }

          evidenceTableRows.push(evidenceTableRowData);
        })

        // Sort Evidence Rows by highest score first
        evidenceTableRows.sort((a: any, b: any) => Math.abs(b.points) - Math.abs(a.points))

        // Keep Author Name Evidence at the top
        const authorNameEvidenceIndex = evidenceTableRows.findIndex((evidence) => evidence.name === 'authorNameEvidence');
        
        if (authorNameEvidenceIndex > 0) {
          const authorNameEvidenceData = evidenceTableRows[authorNameEvidenceIndex];
          evidenceTableRows.splice(authorNameEvidenceIndex, 1);
          evidenceTableRows.unshift(authorNameEvidenceData);
        }

        return (
          <>{
            evidenceTableRows.map((evidenceRow: any, index: number) => {
              return (
                <tr key={index}>
                  <td align="right" width="20%">
                    <p>
                      <strong>{evidenceRow.title}</strong>
                      {evidenceRow.source && <small>(<a href={evidenceRow.source} target="_blank" rel="noreferrer">source</a>)</small>}
                      <br></br>
  				      {<small>{evidenceRow.pointsText || `${evidenceRow.points} points`}</small>}																 
                    </p>
                  </td>
                  <td width="40%">
                    {evidenceRow.displayInstDataList ? <TableCellWithTypes list={evidenceRow.institutionalDataList}></TableCellWithTypes> : <p>{evidenceRow.institutionalData}</p>}
                  </td>
                  <td width="40%">
                    {evidenceRow.displayArticleDataList ? <TableCellWithTypes list={evidenceRow.articleDataList}></TableCellWithTypes> : <p>{evidenceRow.articleData}</p>}
                  </td>
                </tr>
              )
            })
          }</>
        )
    }

// Type the parameter as an object with string keys and number values
const displayFeedbackEvidence = (feedbackEvidence: Record<string, number>): JSX.Element => {
  // Sort the object by score in descending order
  const sortedFeedback = feedbackEvidence && Object.entries(feedbackEvidence)
  .sort((a, b) => b[1] - a[1])  // Sort by value in descending order
  .map(([key, value]) => {
    // Explicitly assert that key is a string and value is a number
    const typedKey = key as string; // `key` is inferred as `string`
    const typedValue = value as number; // `value` is inferred as `number`

    const convertedTypedKey = typedKey
    //remove the word feedbackScore from the label names
    .replace('feedbackScore', '')
    // Insert spaces before uppercase letters
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    // Capitalize the first letter of each word and lowercase the rest
    .replace(/\b\w/g, (char) => char.toUpperCase());

    // Check if 'typedKey' contains 'Orcid' and update 'typedKey' accordingly
    const updatedKey = convertedTypedKey.includes('Orcid')
    ? convertedTypedKey.replace('Orcid', 'ORCID') // Change 'Orcid' to uppercase 'ORCID'
    : convertedTypedKey;
    
    const updatedLabel = updatedKey.includes('Co Author Name')
    ? updatedKey.replace('Co Author Name:', 'Co-Author Name')
    : updatedKey;
  
    const updatedOrCidLabel = updatedLabel.includes('Co Author')
    ? updatedLabel.replace('Co Author', 'Co-Author')
    : updatedLabel;
    
    const updatedJournalSubFieldLabel = updatedOrCidLabel.includes('Journal Sub Field')
    ? updatedOrCidLabel.replace('Journal Sub Field', 'Journal Subfield')
    : updatedOrCidLabel;

    return [updatedJournalSubFieldLabel, Math.round(typedValue)] as [string, number]; // Ensure that the return is of type [string, number]
  });
   // Split the sorted feedback into 4 columns (each column has 3 items)
   const columns: [string, number][][] = [[], [], [], []];
  
   sortedFeedback?.forEach((item, index) => {
     const columnIndex = Math.floor(index / 3); // Distribute every 3 items into a column
     if (columnIndex < 4) {
       columns[columnIndex].push(item);
     }
   });
 

  return (
    <div className={styles.feedbackContainer}>
      <div className={styles.columnContainer}>
        {columns.map((column, index) => (
          <div className={styles.column} key={index}>
            {column.map(([key, value], index) => (
              <div className={styles.feedbackItem} key={index}>
                <strong>{key}:</strong> {value}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
};

const showOverlayFeedbackScoreLearnMorePopup = (fullName :any) => {
  return (
    <div style={{ display: 'flex', alignItems: 'center' }}>
      <h5 style={{marginBottom:"20px"}}>Feedback-based scores</h5>
      <React.Fragment>
        <OverlayTrigger
          trigger={["focus", "hover"]}
          overlay={
            <Popover id="feedback-information" style={{ maxWidth: "400px" }}>
              <Popover.Body>
                <p>
                  Based on attributes from articles you&apos;ve previously accepted or rejected, we&apos;ve generated the following feedback-based scores for 
                  <b> {fullName.trim()}.</b> Each subscore represents the contribution of a specific attribute, such as ORCID, institution, or journal, to the overall likelihood that the article was authored by 
                  <b> {fullName.trim()}.</b>
                </p>
                <p>
                  A score of 100 for an attribute indicates strong evidence supporting authorship, while a score of -100 suggests strong evidence against it. Scores closer to 0 represent attributes that provide less definitive evidence, making the feedback more ambiguous for that category.
                </p>
              </Popover.Body>
            </Popover>
          }
          placement="right"
        >
          <p>
            <span style={{ color: '#80808078', cursor: 'pointer' }}>
              <InfoIcon fontSize="small" style={{ fontSize: '22px', marginLeft: '7px' }} /> <u>Learn more</u>
            </span>
          </p>
        </OverlayTrigger>
      </React.Fragment>
    </div>
  );
};    
    
    return (
      <Row className={styles.articleContainer}>
        <Col md={2} className={styles.publicationButtons}>
          <Buttons pmid={reciterArticle.pmid} index={props.index} userAssertion={reciterArticle.userAssertion}></Buttons>
            <div className="clear-both"></div>
            {(reciterArticle.evidence !==undefined)?
                <React.Fragment>
                    <OverlayTrigger 
                      trigger={["focus", "hover"]} 
                      overlay={(      
                        <Popover id="keyword-information" style={{ maxWidth: "395px" }}>
                          <Popover.Body>
                              <p>
                              According to ReCiter’s neural network model, the 
                              likelihood that <b>{props.fullName}</b> has authored this article is&nbsp;
                              <b>{reciterArticle.authorshipLikelihoodScore ?  (Math.floor(reciterArticle.authorshipLikelihoodScore * 100) / 100).toFixed(5)   : "N/A"}%.</b>
                              </p>
                              <p style={{marginBottom:'0px'}}>This estimate is based on: </p>
                              <ul style={{paddingLeft: '1rem'}}>
                                   <li>Identity information (e.g., known email address)</li>
                                   <li>Feedback on other articles</li>
                                   <li>Raw count of accepted and rejected articles</li>
                              </ul>
                                <p>To investigate which evidence is used to generate this 
                                score, click on &quot;Explore supporting evidence.&quot;
                                </p>												 
	                      </Popover.Body>
                        </Popover>)} placement="right">
                          <p className={styles.publicationScore}>
                            Likelihood<br />Score<br />
                            <strong>{reciterArticle.authorshipLikelihoodScore ? Math.round(reciterArticle.authorshipLikelihoodScore) : "N/A"}</strong>
                          </p>
                    </OverlayTrigger>
                </React.Fragment>: <p></p>
            }
        </Col>
        <Col md={9} className={`${styles.publicationButtons} ${styles.publicationsSummary}`}>
          <Row className="pb-2"><strong>{reciterArticle.articleTitle}</strong></Row>
            <div className={styles.publicationField}>
                <span>
                  {reciterArticle.reCiterArticleAuthorFeatures?.length > 0 &&
                  displayAuthors(reciterArticle.reCiterArticleAuthorFeatures)}
                </span>
            </div>
            <span className={styles.midDot}> {reciterArticle.journalTitleVerbose} </span>
            <span className={reciterArticle.publicationDateDisplay ? styles.midDot : ""}> {reciterArticle.publicationDateDisplay} </span>
            <span className={reciterArticle.publicationDateDisplay ? styles.midDot : ""}> {reciterArticle.publicationType?.publicationTypeCanonical} </span>
            <div className={`${styles.publicationAdditionalInfo} pt-2`}>
              <span className={styles.midDot}>{`PMID: `}<a href={`${pubMedUrl}${reciterArticle.pmid}`} target="_blank" rel="noreferrer">{reciterArticle.pmid}</a>{' '}</span>
          {reciterArticle.doi ?
            <span className={styles.midDot}>{' '}<a href={`${doiUrl}${reciterArticle.doi}`} target="_blank" rel="noreferrer">DOI</a>{' '}</span> : ""}
          {Object.keys(feedbacklog).length > 0 ? <span className={styles.midDot} onClick={onOpenModal}> <div className={`text-decoration-underline d-inline ${styles.cursorPointer}`}>Show History</div> </span> : ""}
        </div>
        {
          (reciterArticle.evidence !== undefined) ?
            <div className={styles.publicationEvidenceBar}>
               {/* <p onClick={()=>updatedToggleEvidence(props.index)}>  */}
                <p onClick={()=>toogleEvidence(props.index)}> 
                {
                   (props.index === props.showEvidenceDefault) || showEvidence?
                    <span
                      className={`${styles.publicationShowEvidenceLink} ${styles.publicationEvidenceShow}`}>Explore supporting evidence</span>
                    :
                    <span
                      className={`${styles.publicationShowEvidenceLink} ${styles.publicationEvidenceHide}`}>Explore supporting evidence</span>
                }
              </p>


                        <div
                            className={`${styles.publicationShowEvidenceContainer} ${(props.index === props.showEvidenceDefault || showEvidence) ? styles.publicationShowEvidenceContainerOpen : ""}`}>
							      
                    {reciterArticle.evidence && reciterArticle.evidence.feedbackEvidence && Object.keys(reciterArticle.evidence.feedbackEvidence).length > 0 ? (
                      <>
                        {showOverlayFeedbackScoreLearnMorePopup(props.fullName.trim())}
                            <>{displayFeedbackEvidence(reciterArticle.evidence.feedbackEvidence)}<br></br></>
                            </>
				   
                          ) : (
                            <>
                            {showOverlayFeedbackScoreLearnMorePopup(props.fullName.trim())}

                             <p><i>No feedback available.</i></p>                            
                            <br></br>
                            </>
                          )}
                          <h5>Identity-based scores</h5>
	                        <div className="table-responsive">
                                <table className={`${styles.publicationsEvidenceTable} table table-striped`}>
                                    <thead>
                                    <tr>
                                        <th key="0" className={styles.firstCell}>Evidence</th>
                                        <th key="1">Institutional Data</th>
                                        <th key="2">Article Data</th>
                                    </tr>
                                    </thead>
                                    <tbody>
                                      <>{formatEvidenceTable(reciterArticle.evidence)}</>
                                    </tbody>
                                </table>
                            </div>
                        </div>


                    </div>
                    : <div>
                        <span></span>
                    </div>
            }
            <div className="clear-both"></div>
        </Col>
        <HistoryModal
          showModal={showHistoryModal}
          onOpen={onOpenModal}
          onClose={onCloseModal}
          id={reciterArticle.pmid}
          userId={props.personIdentifier}
          />
      </Row>
  ); 
}

export default Publication;