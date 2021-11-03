import React, { useState, FunctionComponent } from "react"
import styles from './Publication.module.css';
import ReactTooltip from 'react-tooltip';

interface FuncProps {
    onAccept(id: number): void,
    onReject(id: number): void,
    onUndo(id: number): void,
    item: any,
    faculty: any
}

const Publication: FunctionComponent<FuncProps> = (props) => {

    const [showEvidence, setShowEvidence] = useState<boolean>(false)

    const toogleEvidence = () => {
        setShowEvidence((showEvidence)?false:true)
    }

    const acceptPublication = () => {
        const { item } = props
        props.onAccept(item.pmid);
    }

    const rejectPublication = () => {
        const { item } = props
        props.onReject(item.pmid)
    }

    const undoPublication = () => {
        const { item } = props
        props.onUndo(item.pmid)
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
        buttons = <div>
            <button
                className={`btn btn-success ${styles.publicationAccept}`}
                onClick={acceptPublication}
            >Accept
            </button>
            <button
                className={`btn btn-danger ${styles.publicationReject}`}
                onClick={rejectPublication}
            >Reject
            </button>
        </div>;
    }
    if(item.userAssertion === "ACCEPTED") {

        buttons = <div>
            <button
                className={`btn btn-default ${styles.publicationUndo}`}
                onClick={undoPublication}
            >Undo
            </button>
            <button
                className={`btn btn-danger ${styles.publicationReject}`}
                onClick={rejectPublication}
            >Reject
            </button>
        </div>;
    }

    if(item.userAssertion === "REJECTED") {
        buttons = <div>
            <button
                className={`btn btn-success ${styles.publicationAccept}`}
                onClick={acceptPublication}
            >Accept
            </button>
            <button
                className={`btn btn-default ${styles.publicationUndo}`}
                onClick={undoPublication}
            >Undo
            </button>
        </div>;

    }

    return <tr>
        <td key="0" className={styles.publicationButtons}>
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
        </td>
        <td key="1" className={styles.publicationButtons}>
            <p className={styles.publicationField}>
                <strong>Authors: </strong>
                <span>
                    {
                        (item.authors !== undefined)?item.authors.map(function(author: any, authorIndex: number){
                            var authorHTML = <span></span>;
                            if(author.targetAuthor) {
                                authorHTML = <span key={authorIndex} className={styles.publicationAuthorHighlighted}>{author.authorName}</span>;
                                if(authorIndex < item.authors.length - 1) {
                                    authorHTML = <span key={authorIndex}>{authorHTML}, </span>;
                                }
                            }else {
                                authorHTML = <span key={authorIndex}>{author.authorName}{(authorIndex < item.authors.length - 1)?", ":""}</span>;
                            }
                            return authorHTML;
                            }):<span>No authors listed</span>
                    }
                </span>
            </p>
            <p className={styles.publicationField}>
                <strong>Title: </strong>
                <span>{item.title}</span>
            </p>
            <p className={styles.publicationField}>
                <strong>Journal: </strong>
                <span>{item.journal}</span>
            </p>
            <p className={styles.publicationField}>
                <strong>Date: </strong>
                <span>{item.displayDate}</span>
            </p>
            <div className={styles.publicationRowButtons}>
                <a href={`https://www.ncbi.nlm.nih.gov/pubmed/${item.pmid}`} className="btn btn-default" target="_blank" rel="noopener noreferrer">PubMed</a>
                <a href={`https://weillcornell-primo.hosted.exlibrisgroup.com/openurl/01WCMC/WCMC?sid=Entrez:PubMed&id=pmid:${item.pmid}`} className="btn btn-default" target="_blank" rel="noopener noreferrer">GET IT</a>
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
                                                <td key="0" align="right"
                                                    dangerouslySetInnerHTML={{__html: evidence.label}}/>
                                                <td key="1" width="40%"
                                                    dangerouslySetInnerHTML={{__html: evidence.institutionalData}}/>
                                                <td key="2" width="40%"
                                                    dangerouslySetInnerHTML={{__html: evidence.articleData}}/>
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
        </td>
    </tr>;
    
}

export default Publication;