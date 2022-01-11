import React, { useState, FunctionComponent } from "react"
import styles from './Publication.module.css';
import ReactTooltip from 'react-tooltip';
import CheckIcon from '@mui/icons-material/Check';
import ClearIcon from '@mui/icons-material/Clear';
import UndoIcon from '@mui/icons-material/Undo';
import { Container, Row, Col, Button, Accordion, Card } from "react-bootstrap";
import type { Author } from '../../../../types/publication';
import { useRouter } from 'next/router';
import { useSelector, RootStateOrAny } from "react-redux";

const pubMedUrl = 'https://www.ncbi.nlm.nih.gov/pubmed/';
const doiUrl = 'https://doi.org/';


interface FuncProps {
    onAccept(id: number): void,
    onReject(id: number): void,
    onUndo(id: number): void,
    item: any,
    faculty: any,
}

const Publication: FunctionComponent<FuncProps> = (props) => {

    const [showEvidence, setShowEvidence] = useState<boolean>(false)
    const [expandedAuthors, setExpandedAuthors] = useState<boolean>(false)
    const [countPendingArticles, setCountPendingArticles] = useState<number>(props.item.countPendingArticles || 0)
    const filteredIdentities = useSelector((state: RootStateOrAny) => state.filteredIdentities)
    const [displayArticleIndexes, setDisplayArticleIndexes] = useState<number[] | []>(props.item.reCiterArticleFeatures.length > 1 ? [0, 1] : [0])

    const router = useRouter()

    const toogleEvidence = () => {
        setShowEvidence((showEvidence)?false:true)
    }

    const acceptPublication = ( pmid: number, index: number ) => {

        if ( countPendingArticles > 0 ) {
          setCountPendingArticles(countPendingArticles - 1);
        }
        // props.onAccept(pmid);
        let currArticleIndexes = [...displayArticleIndexes];
        displayArticleIndexes.forEach((pos, i) => {
          if (index === pos) {
            if (displayArticleIndexes.length > 1) {
              let currMax = Math.max(displayArticleIndexes[0], displayArticleIndexes[1]);
              if (currMax === props.item.reCiterArticleFeatures.length - 1) {
                currArticleIndexes.splice(i, 1);
              } else {
                currArticleIndexes.splice(i, 1, currMax + 1);
              }
            } else {
              currArticleIndexes = [];
            }
          }
        })
        setDisplayArticleIndexes(currArticleIndexes);
    }

    const rejectPublication = (pmid: number, index: number) => {
      if ( countPendingArticles > 0 ) {
        setCountPendingArticles(countPendingArticles - 1);
      }
      props.onReject(pmid)
    }

    const undoPublication = (pmid: number, index: number) => {
      setCountPendingArticles(countPendingArticles + 1);
      props.onUndo(pmid)
    }

    const handleProfileClick = (uid: string) => {
      return router.push('/app/' + uid)
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

      return <li key={"author" + index} className={author.targetAuthor ? styles.highlightedAuthor : ""}>{authorFullName}{(index < count - 1)?", ":""}</li>
    }

    const AuthorsList = ({ authors } : {
      authors: Author[]
    }) => {
      return (
        <ul className={styles.listInline}>
          {
            authors && authors.map((author, i) => <Author author={author} key={`${author.authorName}_${i}`} index={i} count={authors.length}></Author>  )
          }
        </ul>
      )
    }

    const displayAuthors = (authors: Author[]) => {
      let authCount = authors.length;
      if ( authCount > 0) {
        if ( authCount < 6 || expandedAuthors) {
          return (<AuthorsList authors={authors}></AuthorsList>)
      } else {
        let authorsDefaultDisplay = authors.slice(0, 6);
        let lastAuthor = authors[authCount - 1];

        return (
          <>
            <AuthorsList authors={authorsDefaultDisplay}></AuthorsList>
            <button className={styles.btnNoStyling} onClick={() => {setExpandedAuthors(true)}}>[...]</button>
            <ul className={styles.listInline}>
              <Author author={lastAuthor} key={`${lastAuthor.authorName}_${authCount - 1}`} index={authCount - 1} count={authCount}></Author>
            </ul>
          </>
        )
      }
    } else return (
        <span>No authors listed</span>
      )
    }

    const { item } = props;
    var facultyUserName = "";
    let reciterArticle = item.reCiterArticleFeatures.length > 0 ? item.reCiterArticleFeatures[0] : {};
    if(props.faculty !== undefined) {

        if(props.faculty.firstName !== undefined) {
            facultyUserName += props.faculty.firstName + ' ';
        }
        if(props.faculty.middleName !== undefined) {
            facultyUserName += props.faculty.middleName + ' ';
        }
        if(props.faculty.lastName !== undefined) {
            facultyUserName += props.faculty.lastName + ' ';
        }
    }

    var evidancePopoverHtml = "<strong>" + item.rawScore + " :</strong> Raw score<br/><strong>" + item.standardScore + " : </strong>Standardized score (1-10)<br/><br/>These scores represent the strength of evidence supporting the possibility that <b>"+facultyUserName+"</b> wrote this article. To investigate which evidence is used to generate this score, click on \"Show evidence behind this suggestion.\"";

    const Buttons = ({index, pmid, userAssertion} : {
      index: number,
      pmid: number, 
      userAssertion: string
    }) => {
      switch (userAssertion) { 
        case "NULL" :
          return (
            <Row className="d-flex justify-content-md-between">
            <Col xs lg={6}><button
                className={`btn btn-success w-100 p-2 ${styles.publicationAccept}`}
                onClick={() => acceptPublication(pmid, index)}
            ><CheckIcon/> Accept
            </button>
            </Col>
            <Col xs lg={6}>
            <button
                className={`btn btn-danger w-100 p-2 ${styles.publicationReject}`}
                onClick={() => rejectPublication(pmid, index)}
            ><ClearIcon/> Reject
            </button>
            </Col>
            </Row>
          )
        case "ACCEPTED" :
          return (
            <Row className="d-flex justify-content-md-between">
              <Col xs lg={6}><button
                className={`btn btn-default ${styles.publicationUndo}`}
                onClick={() => undoPublication(pmid, index)}
              ><UndoIcon />Undo
              </button>
              </Col>
              <Col>
                <button
                  className={`btn btn-danger ${styles.publicationReject}`}
                  onClick={() => rejectPublication(pmid, index)}
                ><ClearIcon />Reject
                </button>
              </Col>
            </Row>
          )
        case "REJECTED" : 
          return (
            <div>
              <button
                  className={`btn btn-success ${styles.publicationAccept}`}
                  onClick={() => acceptPublication(pmid, index)}
              > <CheckIcon/> Accept
              </button>
              <button
                  className={`btn btn-default ${styles.publicationUndo}`}
                  onClick={() => undoPublication(pmid, index)}
              ><UndoIcon /> Undo
              </button>
          </div>
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
              <p>
                {item.name}
                {
                  item.tags.map((tag, index) => {
                    return (
                      <span className={styles.reciterType}>{tag}</span>
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
      { organizationalUnitEvidence : 'Departmental Affiliation'},
      { affiliationEvidence: 'Target author\' s institutional affiliation' },
      { grantEvidence: 'Grants' },
      { journalCategoryEvidence: 'Journal category'},
      { educationYearEvidence: 'Degree year discrepancy'},
      { genderEvidence: 'Inferred gender of name'},
      { articleCountEvidence: 'Candidate article count'},
      { averageClusteringEvidence: 'Clustering'},
    ]

    const evidenceTableCellFields = {
       authorNameEvidence: { points: 'nameScoreTotal', dataFormat: 'true' },
       relationshipEvidence: { points: 'relationshipEvidenceTotalScore', dataFormat: 'true'},
       email: { points: 'emailMatchScore', institutionalData:'emailMatch', articleData: 'emailMatch'}, 
       organizationalUnitEvidence: { dataFormat: 'true' },
       affiliationEvidence: { scopusUrl: 'https://www.scopus.com/affil/profile.uri?afid=', dataFormat: 'true' } ,
       grantEvidence: { institutionalData: 'articleGrant', articleData: 'articleGrant'},
       journalCategoryEvidence: { points: 'journalSubfieldScore', dataFormat: 'true'},
       educationYearEvidence: { points: 'educationYearEvidence', articleData: 'articleYear', dataFormat: 'true'},
       genderEvidence: { source: 'https://data.world/howarder/gender-by-name', dataFormat: 'true'},
       articleCountEvidence: { institutionalData:'-', articleData: 'countArticlesRetrieved', points: 'articleCountScore'},
       averageClusteringEvidence: { institutionalData:'-', dataFormat: 'true', points: 'clusterScoreAverage'},
       personTypeEvidence: { institutionalData: 'personType', points: 'personTypeScore'}
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
      } else {
        return false;
      }
    }

    const formatEvidenceTable = (evidence: any) => {
      return (
        evidenceTableRowTitles.filter((row) => displayRow(row, evidence)).map((title, index) => {
          let rowName = Object.keys(title)[0];
          let rowFields = evidenceTableCellFields[rowName];
          let points = '';
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
                if(evidence[rowName].hasOwnProperty('relationshipEvidenceTotalScore')) {
                  points = evidence[rowName].relationshipEvidenceTotalScore.toFixed(2)
                }
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
                let totalScore = Math.abs(scopusTargetAuthorAffiliationScore + pubmedTargetAuthorAffiliationScore)
                points = totalScore.toString();
              }

              if (rowName === 'organizationalUnitEvidence') {
                let scoreTotal = 0
                let itemCount = 0
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
                  institutionalData = institutionalData + evidence[rowName].identityDoctoralYear + ' - Doctoral'
                }
              }

              if (rowName === 'genderEvidence') {
                if(evidence[rowName].hasOwnProperty('genderScoreIdentity')) {
                  if(Number(evidence[rowName].enderScoreIdentity) >= 0.5) {
                      institutionalData = 'Male - ' + (Number(evidence[rowName].genderScoreIdentity) * 100) + '% probability'
                  } else {
                    institutionalData = 'Female - ' + ((1 - Number(evidence[rowName].genderScoreIdentity)) * 100) + '% probability'
                  }
                }
                if (evidence[rowName].hasOwnProperty('genderScoreArticle')) {
                  if(Number(evidence[rowName].genderScoreArticle) >= 0.5) {
                    articleData = 'Male - ' + (Number(evidence[rowName].genderScoreArticle) * 100) + '% probability'
                } else {
                    articleData = 'Female - ' + ((1 - Number(evidence[rowName].genderScoreArticle)) * 100) + '% probability'
                }
                }
              }

              if (rowName === 'averageClusteringEvidence') {
                articleData = 'Score of article without clustering: ' + evidence[rowName].totalArticleScoreWithoutClustering + ' Average score of cluster: ' + evidence[rowName].clusterScoreAverage;
              }
            }

            if (rowName == 'grantEvidence') {
              let scoreTotal = 0
              if(evidence[rowName].grants !== undefined && evidence[rowName].grants.length > 0) {
                evidence[rowName].grants.forEach((grant: any) => {
                    scoreTotal = scoreTotal + grant.grantMatchScore
                })
                points = Math.abs(scoreTotal).toString();
              }
            }

            if (rowName == 'genderEvidence') {
              points = Math.abs(evidence[rowName].genderScoreIdentityArticleDiscrepancy).toString();
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
          
          return (
            <tr>
              <td align="right" width="30%">
                <p>
                  <strong>{Object.values(title)}</strong>
                  <br></br>
                  {source && <small>(<a href={source}>source</a>)</small>}
                  {<small>{`${points} points`}</small>}
                </p>
              </td>
              <td width="30%">
                {displayInstDataList ? <TableCellWithTypes list={institutionalDataList}></TableCellWithTypes> : institutionalData}
              </td>
              <td width="30%">
                {displayArticleDataList ? <TableCellWithTypes list={articleDataList}></TableCellWithTypes> : articleData}
              </td>
            </tr>
          )
        })
      )
    }

    return (
      <Container className={`${styles.publicationContainer} p-0`} fluid>
        <Accordion>
         <Accordion.Item eventKey="0">
          <Accordion.Header className={styles.publicationHeader}> 
            <Row>
              <Col md={8} className={styles.facultyHeader}>
                {filteredIdentities[item.personIdentifier] && <p><span className={styles.facultyTitle}>{filteredIdentities[item.personIdentifier].fullName}</span>{filteredIdentities[item.personIdentifier].title}</p>}
              </Col>
              <Col md={3}>
                <div className={styles.publicationRowButtons}>
                  <Button onClick={() => handleProfileClick(item.personIdentifier)}>
                    View Profile
                  </Button>
                  <Button onClick={() => handleProfileClick(item.personIdentifier)}>
                    {`View All ${countPendingArticles} Pending`}
                  </Button>
                </div>
              </Col>
            </Row>
          </Accordion.Header>
          <Accordion.Body> 
          {item.reCiterArticleFeatures.length > 0 &&
            displayArticleIndexes.map((pos: number, index: number) => {
              reciterArticle = item.reCiterArticleFeatures[pos];
              return(
            <Row>
              <Col md={3} className={styles.publicationButtons}>
                <Buttons pmid={reciterArticle.pmid} index={index} userAssertion={reciterArticle.userAssertion}></Buttons>
                  <div className="clear-both"></div>
                  {(reciterArticle.evidence !==undefined)?
                      <React.Fragment>
                          <p className={styles.publicationScore} data-tip={evidancePopoverHtml} data-place="right"
                              data-effect="solid" data-html={true} data-class={styles.evidenceScorePopupContainer}>
                              Evidence<br />Score<br /><strong>{reciterArticle.totalArticleScoreStandardized}</strong>
                          </p>
                          < ReactTooltip />
                      </React.Fragment>: <p></p>
                  }
              </Col>
              <Col md={9} className={`${styles.publicationButtons} ${styles.publicationsSummary}`}>
                <Row><strong>{reciterArticle.journalTitleVerbose}</strong></Row>
                  <div className={styles.publicationField}>
                      <span>
                        {item.reCiterArticleFeatures.length > 0 &&
                        displayAuthors(item.reCiterArticleFeatures[0].reCiterArticleAuthorFeatures)}
                      </span>
                  </div>
                  <span className={styles.midDot}> {reciterArticle.publicationType.publicationTypeCanonical} </span>
                  <span className={styles.midDot}> {reciterArticle.publicationDateDisplay} </span>
                  <div className={styles.publicationAdditionalInfo}>
                    <span className={styles.midDot}>{`PMID: `}<a href={`${pubMedUrl}${reciterArticle.pmid}`}>{reciterArticle.pmid}</a>{' '}</span>
                    <span className={styles.midDot}>{' '}<a href={`${doiUrl}${reciterArticle.pmid}`}>DOI</a>{' '}</span>
                    <span className={styles.midDot}> Show History </span>
                  </div>
                  {
                      (reciterArticle.evidence !== undefined) ?
                          <div className={styles.publicationEvidenceBar}>
                              <p onClick={toogleEvidence}>
                                  {
                                      (showEvidence) ?
                                          <span
                                              className={`${styles.publicationShowEvidenceLink} ${styles.publicationEvidenceShow}`}>Hide evidence behind this suggestion</span>
                                          :
                                          <span
                                              className={`${styles.publicationShowEvidenceLink} ${styles.publicationEvidenceHide}`}>Show evidence behind this suggestion</span>
                                  }
                              </p>


                              <div
                                  className={`${styles.publicationShowEvidenceContainer} ${(showEvidence) ? styles.publicationShowEvidenceContainerOpen : ""}`}>
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
            </Row>
              )
            })
            }
         </Accordion.Body>
        </Accordion.Item>
      </Accordion>
    </Container>
  ); 
}

export default Publication;