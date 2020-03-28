import React, { Component } from 'react';
import { Table, Button, Form, Row, Col, Container, Accordion } from "react-bootstrap";
import checked_icon from '../../../images/icons/checked.svg';
import cancel_icon from '../../../images/icons/close1.svg';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faPlus, faMinus } from '@fortawesome/free-solid-svg-icons'
import './individual_suggestions.css'


export default class Suggestions extends Component {

    state = {
        articles: {}
    };

    constructor(props) {
        super(props);
        // this.onAccordionChange = this.onAccordionChange.bind(this)

    }

    componentWillReceiveProps() {
        this.setState({
            articles: this.props.articles
        })
    }

    onAccordionChange = (e) => {
        let showEvidence = true
        let hideEvidence = false
        if (this.state.hasOwnProperty([e])) {
            this.setState({
                [e]: this.state[e] == showEvidence ? hideEvidence : showEvidence
            })
        }
        else {
            this.setState({
                [e]: hideEvidence
            })
        }
    }



    render() {
        const i = this.state.articles;


        return (
            <div>
                {i != {} && i.reciterArticleFeatures ? i.reciterArticleFeatures.length ? i.reciterArticleFeatures.map((item, index) =>
                    <Accordion defaultActiveKey="-1">
                        <div className="tableBody backgroundColorWhite">
                            <Table responsive className="individual2_table">
                                <tbody>
                                    <tr>
                                        <td>
                                            <div className="displayflex padding5px margin0px justifyContentSpaceBt borderRadius0">
                                                <Button className="h6fnhWdeg-publication-accept backgroundColorGreen btn-success"> <span><img src={checked_icon} className='publicationaccepted_icons' /></span> <span>Accept</span></Button>
                                                <Button className="h6fnhWdeg-publication-reject backgroundColorRed"> <span><img src={cancel_icon} className='publicationreject_icons' /></span> <span>Reject</span></Button>
                                            </div>
                                            <div className="padding15px ">
                                                <div className="displayflex flexDirectionCol backgroundColor202b3b textAlignCenter colorWhite ">
                                                    <p className="evidence">Evidence Score</p>
                                                    <h1 className="score"><b>{item.standardScore}</b></h1>
                                                </div>
                                            </div>
                                        </td>
                                        <td>
                                            <Row>
                                                <Col lg={12} className="contnet_individual_suggestions pt-1">
                                                    {item.authors.length ? <p><b>Authors:</b> {item.authors.map((author, index) => index != item.authors.length - 1 ? author.authorName + ', ' : author.authorName)}</p> : null}
                                                    <p> <b>Title:</b> {item.title}</p>
                                                    <p>  <b>Journal:</b> {item.journal}</p>
                                                    <p> <b>Date:</b> {item.displayDate} </p>
                                                </Col>
                                            </Row>
                                            <Row>
                                                <Col lg={8} md={8} sm={8} xs={8} xl={8}>
                                                    <Accordion.Toggle as={Button} variant="link" eventKey="0" className="individual_suggestion_accordinbtn accoedins_btns" onClick={() => this.onAccordionChange('accordion' + index)}>
                                                        {/* <p className="suggestionText" ><span>{this.state['accordion' + index + 'symbol']}</span>{this.state['accordion' + index] || '+ Show evidence behind this suggestion'}</p> */}
                                                        <p className="suggestionText" >
                                                            {
                                                                (this.state['accordion' + index] != undefined ? (this.state['accordion' + index] ? <span className="publication_show_evidences h6fnhWdeg-publication-show-evidence-link h6fnhWdeg-publication-evidence-hide">  <span><FontAwesomeIcon icon={faPlus} /></span> <span className="link_evidence_underline">Show evidence behind this suggestion</span></span> : <span className="publication_hide_evidences h6fnhWdeg-publication-show-evidence-link h6fnhWdeg-publication-evidence-show">  <span> <FontAwesomeIcon icon={faMinus} /> </span> <span className="link_evidence_underline">Hide evidence behind this suggestion </span></span>) : <span className="publication_show_evidences h6fnhWdeg-publication-show-evidence-link h6fnhWdeg-publication-evidence-hide">  <span><FontAwesomeIcon icon={faPlus} /></span> <span className="link_evidence_underline">Show evidence behind this suggestion</span></span>)
                                                            }
                                                        </p>
                                                    </Accordion.Toggle>
                                                </Col>
                                                <Col lg={4} md={4} sm={4} xs={4} xl={4}>
                                                    <span> <button className="btn button" type="button">PubMed</button>
                                                        <button className="btn button" type="button">GET IT</button>
                                                    </span>
                                                </Col>
                                            </Row>
                                        </td>
                                    </tr>
                                    <tr>
                                        <td id="suggestion_tables_evdiencetd" className="suggestionsss_table_evdience" colSpan="2">
                                            <Row>
                                                <Col lg={12} className="suggestion_indvidual_table_col">
                                                    <Accordion.Collapse eventKey="0">
                                                        <div>
                                                            <table className="individual_evidence_table h6fnhWdeg-publications-evidence-table table table-striped">
                                                                <thead>
                                                                    <tr>
                                                                        <th key="0" className="h6fnhWdeg-first-cell">Evidence</th>
                                                                        <th key="1">Institutional Data</th>
                                                                        <th key="2">Article Data</th>
                                                                    </tr>
                                                                </thead>
                                                                <tbody>
                                                                    {
                                                                        item?.evidence.map((evid) => <tr>
                                                                            <td dangerouslySetInnerHTML={{ __html: evid.label }} className="textAlignRight"></td>
                                                                            <td dangerouslySetInnerHTML={{ __html: evid.institutionalData }}></td>
                                                                            <td dangerouslySetInnerHTML={{ __html: evid.articleData }}></td>
                                                                        </tr>)
                                                                    }
                                                                </tbody>
                                                            </table>
                                                        </div>
                                                    </Accordion.Collapse>
                                                </Col>
                                            </Row>
                                        </td>
                                    </tr>
                                </tbody>
                            </Table>
                        </div>
                    </Accordion>) : null : null}
            </div>
        );
    }
}