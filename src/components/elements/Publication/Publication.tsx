import React, { useState, FunctionComponent } from "react"
import styles from './Publication.module.css';
import ReactTooltip from 'react-tooltip';
import CheckIcon from '@mui/icons-material/Check';
import ClearIcon from '@mui/icons-material/Clear';
import UndoIcon from '@mui/icons-material/Undo';
import { Container, Row, Col, Button, Accordion, Card } from "react-bootstrap";
import type { Author } from '../../../../types/publication';
import { useRouter } from 'next/router'

interface FuncProps {
    onAccept(id: number): void,
    onReject(id: number): void,
    onUndo(id: number): void,
    item: any,
    faculty: any
}

const Publication: FunctionComponent<FuncProps> = (props) => {

    const [showEvidence, setShowEvidence] = useState<boolean>(false)
    const [expandedAuthors, setExpandedAuthors] = useState<boolean>(false)
    const [countPendingArticles, setCountPendingArticles] = useState<number>(0)

    const router = useRouter()

    const toogleEvidence = () => {
        setShowEvidence((showEvidence)?false:true)
    }

    const acceptPublication = () => {
        setCountPendingArticles(countPendingArticles - 1);
        const { item } = props
        props.onAccept(item.pmid);
    }

    const rejectPublication = () => {
        setCountPendingArticles(countPendingArticles - 1);
        const { item } = props
        props.onReject(item.pmid)
    }

    const undoPublication = () => {
        const { item } = props
        props.onUndo(item.pmid)
    }

    const handleProfileClick = (event, path) => {
      event.stopPropagation();
      router.push(path);
    }

    const Author = ({author, index, count} : {
      author: Author,
      index: number,
      count: number,
    }) => {
      return <li key={"author" + index} className={author.target ? styles.highlightedAuthor : ""}>{author.authorName}{(index < count - 1)?", ":""}</li>
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

    var buttons = null;
    if(item.userAssertion === "NULL") {
        buttons = <Row className="d-flex justify-content-md-between">
            <Col xs lg={6}><button
                className={`btn btn-success w-100 p-2 ${styles.publicationAccept}`}
                onClick={acceptPublication}
            ><CheckIcon/> Accept
            </button>
            </Col>
            <Col xs lg={6}>
            <button
                className={`btn btn-danger w-100 p-2 ${styles.publicationReject}`}
                onClick={rejectPublication}
            ><ClearIcon/> Reject
            </button>
            </Col>
         </Row>;
    }
    if(item.userAssertion === "ACCEPTED") {

      buttons = <Row className="d-flex justify-content-md-between">
        <Col xs lg={6}><button
          className={`btn btn-default ${styles.publicationUndo}`}
          onClick={undoPublication}
        ><UndoIcon />Undo
        </button>
        </Col>
        <Col>
          <button
            className={`btn btn-danger ${styles.publicationReject}`}
            onClick={rejectPublication}
          ><ClearIcon />Reject
          </button>
        </Col>
        </Row>;
    }

    if(item.userAssertion === "REJECTED") {
        buttons = <div>
            <button
                className={`btn btn-success ${styles.publicationAccept}`}
                onClick={acceptPublication}
            > <CheckIcon/> Accept
            </button>
            <button
                className={`btn btn-default ${styles.publicationUndo}`}
                onClick={undoPublication}
            ><UndoIcon /> Undo
            </button>
        </div>;

    }

    return (
      <Container className={`${styles.publicationContainer} p-0`} fluid>
        <Accordion>
         <Accordion.Item eventKey="0">
          <Accordion.Header className={styles.publicationHeader}> 
            <Row>
              <Col md={8} className={styles.facultyHeader}>
                <p><span className={styles.facultyTitle}>{facultyUserName}</span>{props.faculty.title}</p>
              </Col>
              <Col md={3}>
                <div className={styles.publicationRowButtons}>
                  <Button onClick={(e) => handleProfileClick(e, "/search")}>
                    View Profile
                  </Button>
                  <Button onClick={(e) => handleProfileClick(e, "/search")}>
                    {`View All ${countPendingArticles} Pending`}
                  </Button>
                </div>
              </Col>
            </Row>
          </Accordion.Header>
          <Accordion.Body> 
            <Row>
              <Col md={3} className={styles.publicationButtons}>
                  {buttons}
                  <div className="clear-both"></div>
                  {(item.evidence !==undefined)?
                      <React.Fragment>
                          <p className={styles.publicationScore} data-tip={evidancePopoverHtml} data-place="right"
                              data-effect="solid" data-html={true} data-class={styles.evidenceScorePopupContainer}>
                              Evidence<br />Score<br /><strong>{item.standardScore}</strong>
                          </p>
                          < ReactTooltip />
                      </React.Fragment>: <p></p>
                  }
              </Col>
              <Col md={9} className={`${styles.publicationButtons} ${styles.publicationsSummary}`}>
                <Row><strong>{item.title}</strong></Row>
                  <div className={styles.publicationField}>
                      <span>
                        {displayAuthors(item.authors)}
                      </span>
                  </div>
                  <span className={styles.midDot}> {item.journal} </span>
                  <span className={styles.midDot}> {item.displayDate} </span>
                  <div className={styles.publicationAdditionalInfo}>
                    <span className={styles.midDot}>{`PMID: ${item.pmid} `}</span>
                    <span className={styles.midDot}>DOI</span>
                    <span className={styles.midDot}>Show History</span>
                  </div>
                  {
                      (item.evidence !== undefined) ?
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
                                          {
                                              item.evidence.map(function (evidence: any, evidenceIndex: number) {
                                                  return <tr key={evidenceIndex}>
                                                      <td key="0" align="right">{evidence.label}</td>
                                                      <td key="1" width="40%">{evidence.institutionalData}</td>
                                                      <td key="2" width="40%">{evidence.articleData}</td>
                                                  </tr>;
                                              })
                                          }
                                          </tbody>
                                      </table>
                                  </div>
                              </div>


                          </div>
                          : <div>
                              <span>Manaually added publication</span>
                          </div>
                  }
                  <div className="clear-both"></div>
              </Col>
          </Row>
         </Accordion.Body>
        </Accordion.Item>
      </Accordion>
    </Container>
  ); 
}

export default Publication;