import React, { Component } from 'react';
import '../../css/Publication.css';
import ReactTooltip from 'react-tooltip';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {faPlus, faMinus } from '@fortawesome/free-solid-svg-icons'
import checked_icon from '../../images/icons/checked.svg';
import cancel_icon from '../../images/icons/close1.svg';
import undo_icon from '../../images/icons/undo.svg';

class Publication extends Component {

    state = {
        showEvidence: false
    }

    constructor(props) {
        super(props);
        this.toogleEvidence = this.toogleEvidence.bind(this);
        this.acceptPublication = this.acceptPublication.bind(this);
        this.rejectPublication = this.rejectPublication.bind(this);
        this.undoPublication = this.undoPublication.bind(this);
    }

    toogleEvidence() {
        this.setState({
            showEvidence: (this.state.showEvidence) ? false : true
        });
    }

    acceptPublication() {
        const { item } = this.props;
        this.props.onAccept(item.pmid);
    }

    rejectPublication() {
        const { item } = this.props;
        this.props.onReject(item.pmid);
    }

    undoPublication() {
        const { item } = this.props;
        this.props.onUndo(item.pmid);
    }

    render() {

        const { item } = this.props;
        var facultyUserName = "";
        if (this.props.faculty !== undefined) {

            if (this.props.faculty.firstName !== undefined) {
                facultyUserName += this.props.faculty.firstName + ' ';
            }
            if (this.props.faculty.middleName !== undefined) {
                facultyUserName += this.props.faculty.middleName + ' ';
            }
            if (this.props.faculty.lastName !== undefined) {
                facultyUserName += this.props.faculty.lastName + ' ';
            }
        }
 
        var evidancePopoverHtml = "<strong>" + item.rawScore + " :</strong> Raw score<br/><strong>" + item.standardScore + " : </strong>Standardized score (1-10)<br/><br/>These scores represent the strength of evidence supporting the possibility that <b>" + facultyUserName + "</b> wrote this article. To investigate which evidence is used to generate this score, click on \"Show evidence behind this suggestion.\"";

        var buttons = null;
        if (item.userAssertion === "NULL") {
            buttons = <div>
                <button
                    className={`success_btn btn btn-success h6fnhWdeg-publication-accept`}
                    onClick={this.acceptPublication}
                ><span><img src={checked_icon} className='publicationaccepted_icons'/></span> <span>Accept</span>
                </button>
                <button
                    className={`dangers_btn btn btn-danger h6fnhWdeg-publication-reject`}
                    onClick={this.rejectPublication}
                ><span><img src={cancel_icon} className='publicationreject_icons'/></span> <span>Reject</span>
                </button>
            </div>;
        }
        if (item.userAssertion === "ACCEPTED") {

            buttons = <div>
                <button
                    className={`btn_publicationacceptedundobtn btn btn-default h6fnhWdeg-publication-undo`}
                    onClick={this.undoPublication}
                ><span><img src={undo_icon} className='publicationundo_icons'/></span> <span>Undo</span>
                </button>
                <button
                    className={`btn_publicationacceptedrejectbtn btn btn-danger h6fnhWdeg-publication-reject`}
                    onClick={this.rejectPublication}
                ><span><img src={cancel_icon} className='publicationreject_icons'/></span> <span>Reject</span>
                </button>
            </div>;
        }

        if (item.userAssertion === "REJECTED") {
            buttons = <div>
                <button
                    className={`btn_publicationrejectedacceptbtn btn-success h6fnhWdeg-publication-accept`}
                    onClick={this.acceptPublication}
                > <span><img src={checked_icon} className='publicationaccepted_icons'/></span> <span>Accept</span>
                </button>
                <button
                    className={`btn_publicationrejectedundobtn btn btn-default h6fnhWdeg-publication-undo`}
                    onClick={this.undoPublication}
                ><span><img src={undo_icon} className='publicationundo_icons'/></span> <span>Undo</span>
                </button>
            </div>;

        }

        return <div className="publication_evidance_tablediv"><tr><td className="h6fnhWdeg-publication_tabletd"><tr className="h6fnhWdeg-publication_tablerow">
            <td key="0" className="h6fnhWdeg-publication-buttons">
                {buttons}
                <div className="clear-both"></div>
                {(item.evidence !== undefined) ?
                    <React.Fragment>
                        <p className="h6fnhWdeg-publication-score" data-tip={evidancePopoverHtml} data-place="right"
                            data-effect="solid" data-html={true} data-class="h6fnhWdeg-evidence-score-popup-container">
                            Evidence Score<br /><strong>{item.standardScore}</strong>
                        </p>
                        < ReactTooltip />
                    </React.Fragment> : <p></p>
                }
            </td>
            <td key="1" className="h6fnhWdeg-publication-content">
                <p className="h6fnhWdeg-publication-citation">malhotra s, cheriff ad, gossey jt, cole cl, kaushal r, ancker js. effects of an e-prescribing interface redesign on rates of generic drug prescribing: exploiting default options. j am med inform assoc. 2016 sep;23(5):891-8. doi:10.1093/jamia/ocv192. epub 2016 feb 17. pubmed pmid: 26911828.</p>
                <p className="h6fnhWdeg-publication-field">
                    <strong className="Publications_text_bold">Authors: </strong>
                    <span className="h6fnhWdeg-publication-field-authors">
                        {
                            (item.authors !== undefined) ? item.authors.map(function (author, authorIndex) {
                                var authorHTML = <span></span>;
                                if (author.targetAuthor) {
                                    authorHTML = <span key={authorIndex} className="h6fnhWdeg-publication-author-highlighted">{author.authorName}</span>;
                                    if (authorIndex < item.authors.length - 1) {
                                        authorHTML = <span key={authorIndex}>{authorHTML}, </span>;
                                    }
                                } else {
                                    authorHTML = <span key={authorIndex}>{author.authorName}{(authorIndex < item.authors.length - 1) ? ", " : ""}</span>;
                                }
                                return authorHTML;
                            }) : <span>No authors listed</span>
                        }
                    </span>
                </p>
                <p className="h6fnhWdeg-publication-field">
                    <strong className="Publications_text_bold">Title: </strong>
                    <span className="h6fnhWdeg-publication-field-title">{item.title}</span>
                </p>
                <p className="h6fnhWdeg-publication-field">
                    <strong className="Publications_text_bold">Journal: </strong>
                    <span className="h6fnhWdeg-publication-field-journal">{item.journal}</span>
                </p>
                <p className="h6fnhWdeg-publication-field">
                    <strong className="Publications_text_bold">Date: </strong>
                    <span className="h6fnhWdeg-publication-field-year">{item.displayDate}</span>
                </p>
                <div className="h6fnhWdeg-publication-row-buttons">
                    <a href={`https://www.ncbi.nlm.nih.gov/pubmed/${item.pmid}`} className="btn btn-default" target="_blank" rel="noopener noreferrer">PubMed</a>
                    <a href={`https://weillcornell-primo.hosted.exlibrisgroup.com/openurl/01WCMC/WCMC?sid=Entrez:PubMed&id=pmid:${item.pmid}`} className="btn btn-default" target="_blank" rel="noopener noreferrer">GET IT</a>
                </div>
                {
                    (item.evidence !== undefined) ?
                        <div className="h6fnhWdeg-publication-evidence-bar">
                            <p className="link_for_show_evidence_hidemain" onClick={this.toogleEvidence}>
                                {
                                    (this.state.showEvidence) ?
                                        <span
                                            className="publication_hide_evidences h6fnhWdeg-publication-show-evidence-link h6fnhWdeg-publication-evidence-show">  <span> <FontAwesomeIcon icon={faMinus} /> </span> <span className="link_evidence_underline">Hide evidence behind this suggestion </span></span>
                                        :
                                        <span
                                            className="publication_show_evidences h6fnhWdeg-publication-show-evidence-link h6fnhWdeg-publication-evidence-hide">  <span><FontAwesomeIcon icon={faPlus} /></span> <span className="link_evidence_underline">Show evidence behind this suggestion</span></span>
                                }
                            </p>





                        </div>
                        : <div>
                            <span>Manaually added publication</span>
                        </div>
                }
                <div className="clear-both"></div>

            </td>
        </tr>


        </td></tr>
            <tr className="publication_evidence_tr">
                {(this.state.showEvidence) ? (<tr><td colspan="2" className="evidance_tablepubmedcolspan">
                    <table className="h6fnhWdeg-publications-evidence-table table table-striped">
                        <thead>
                            <tr>
                                <th key="0" className="h6fnhWdeg-first-cell">Evidence</th>
                                <th key="1">Institutional Data</th>
                                <th key="2">Article Data</th>
                            </tr>
                        </thead>
                        <tbody>
                            {
                                item.evidence.map(function (evidence, evidenceIndex) {
                                    return <tr key={evidenceIndex}>
                                        <td key="0" align="right"
                                            dangerouslySetInnerHTML={{ __html: evidence.label }} />
                                        <td key="1" width="40%"
                                            dangerouslySetInnerHTML={{ __html: evidence.institutionalData }} />
                                        <td key="2" width="40%"
                                            dangerouslySetInnerHTML={{ __html: evidence.articleData }} />
                                    </tr>;
                                })
                            }
                        </tbody>
                    </table>

                </td></tr>) : <tr></tr>}
            </tr></div>;
    }
}

export default Publication;
