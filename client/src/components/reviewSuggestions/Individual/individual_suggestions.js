import React, { Component } from "react";
import { Table, Button, Form, Row, Col, Container, Accordion } from "react-bootstrap";
import { Link } from "react-router-dom";
import Header from "../../ui/Header";
import Footer from "../../ui/Footer";
import SideNav from "../../ui/SideNav";
import { Pagination } from '../../ui/Pagination';
import "./individual_suggestions.css";
import { connect } from 'react-redux'
import { editIndividualSearch, getGroupReviewSuggestions, reciterUpdatePublication, identityFetchData, clearGroupReviewSuggestions } from '../../../../src/actions';


class Individuals extends Component {
    state = {
        groupReviewSuggestions: [],
        selectedDeptTypes: [],
        selectedAffiliations: [],
        selectedPersonTypes: [],
        identityAllData: [],
        resultMode: "EMPTY",
        loading: false,
        page: 1,
        count: 10
    }

    constructor(props) {
        super(props);
        this.editsearch = this.editsearch.bind(this);
        this.handlePaginationUpdate = this.handlePaginationUpdate.bind(this);
        this.filter = this.filter.bind(this);

    }

    componentDidMount() {
        this.setState({
            selectedDeptTypes: this.props.selectedDeptTypes || [],
            selectedPersonTypes: this.props.selectedPersonTypes || [],
            selectedAffiliations: this.props.selectedAffiliationTypes || [],
            identityAllData: this.props.identityAllData || [],
            loading: true
        });

        this.props.getGroupReviewSuggestions(this.props.selectedDeptTypes,
            this.props.selectedPersonTypes, this.props.selectedAffiliationTypes, this.setGroupReviewSuggestions);

        if (this.props.selectedDeptTypes.length == 0
            && this.props.selectedAffiliationTypes.length == 0 && this.props.selectedPersonTypes.length == 0) {
            this.props.history.push('/individual');
        }
    }

    setGroupReviewSuggestions = (groupReviewSuggestions) => {
        if (groupReviewSuggestions && groupReviewSuggestions.reciter.length > 0) {
            this.setState({
                groupReviewSuggestions: groupReviewSuggestions.reciter,
                resultMode: groupReviewSuggestions.resultMode,
                loading: false
            })

        } else {
            this.props.history.push('/individual')
        }

    }

    handlePaginationUpdate(event, page) {
        this.setState({
            page: page
        });
        if (event.target.value !== undefined) {
            this.setState({
                count: event.target.value
            });
        }
    }

    editsearch() {
        if (this.props.selectedDeptTypes.length || this.props.selectedPersonTypes.length || this.props.selectedAffiliations.length) {
            this.props.clearGroupReviewSuggestions()
            this.props.editsearch(this.props.selectedDeptTypes, this.props.selectedPersonTypes, this.props.selectedAffiliations, () => this.props.history.push('/individual'))
        }
    }

    filter() {
        const thisObject = this;
        let suggestionsData = []
        thisObject.props.groupReviewSuggestions.forEach((suggestion) => {

            let userObj = this.props.identityAllData.find((identity) => identity ? identity.uid == suggestion.personIdentifier : false)
            let articles = suggestion.reciterArticleFeatures.length ? suggestion.reciterArticleFeatures : 0
            suggestionsData.push({
                userName: userObj,
                articles: articles
            })
        })

        var from = (parseInt(this.state.page, 10) - 1) * parseInt(this.state.count, 10);
        var to = from + parseInt(this.state.count, 10) - 1;
        var suggestions = [];
        var i = from;
        return {
            paginatedSuggestions: suggestionsData
        }
        // for (i; i <= to; i++) {
        //     if (filteredPublications[i] !== undefined) {
        //         suggestions.push(filteredPublications[i]);
        //     }
        // }
        // return {
        //     paginatedSuggestions: suggestions
        // };

    }

    render() {
        const { groupReviewSuggestions, selectedDeptTypes, selectedPersonTypes, selectedAffiliationTypes, identityAllData } = this.state;
        const { page, count } = this.state;

        let elementsUI = [], loopCount;
        if (count < groupReviewSuggestions.length) loopCount = count;
        else loopCount = groupReviewSuggestions.length;
        for (let j = page - 1; j < loopCount; j++) {
            let i = groupReviewSuggestions[j]
            let userObj = identityAllData.find((item) => item ? item.uid == i.personIdentifier : false)
            elementsUI.push(
                <div className="firsttable">
                    <div className="row">
                        <div className="col-md-12">
                            <h4><span className="link"><a href={`/app/${userObj?.uid}`} target="_blank">{userObj?.primaryName?.firstName + " " + userObj?.primaryName?.lastName}</a></span><span className="name">{userObj?.title}</span></h4>
                        </div>
                    </div>
                    <div className="row recordstable">
                        <div className="col-md-12">
                            {i.reciterArticleFeatures.length ? i.reciterArticleFeatures.map((item) =>
                                <Accordion defaultActiveKey="-1">

                                    <div className="tableBody backgroundColorWhite">
                                        <Table responsive className="individual2_table">
                                            <tbody>
                                                <tr>
                                                    <td>
                                                        <div className="displayflex padding5px margin0px justifyContentSpaceBt borderRadius0">
                                                            <Button className="backgroundColorGreen btn-success"> <span className="glyphicon glyphicon-ok margin10 padding10" /> Accept</Button>
                                                            <Button className="backgroundColorRed"> <span className="glyphicon glyphicon-remove" /> Reject</Button>
                                                        </div>
                                                        <div className="padding15px ">
                                                            <div className="displayflex flexDirectionCol backgroundColor202b3b textAlignCenter colorWhite ">
                                                                <p className="evidence">Evidence Score</p>
                                                                <h1 className="score"><b>{item.standardScore}</b></h1>
                                                            </div>
                                                        </div>
                                                        {/* </Col> */}
                                                        {/* </Row> */}
                                                    </td>
                                                    <td>
                                                        <Row>
                                                            <Col lg={12} className="pt-1">
                                                                {item.authors.length ? <p><b>Authors:</b>{item.authors.map((author, index) => index != item.authors.length - 1 ? author.authorName + ', ' : author.authorName)}</p> : null}
                                                                <p> <b>Title:</b> {item.title}</p>
                                                                <p>  <b>Journal:</b> {item.journal}</p>
                                                                <p> <b>Date:</b> {item.displayDate} </p>
                                                            </Col>
                                                        </Row>
                                                        <Row>
                                                            <Col lg={8} md={8} sm={8} xs={8} xl={8}>
                                                                <Accordion.Toggle  variant="link" eventKey="0" className="accoedins_btns">
                                                                    <p className="suggestionText">+ Show evidence behind this suggestion</p>
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
                                                    <td colSpan="2">
                                                        <Row>
                                                            <Col lg={12}>


                                                                <Accordion.Collapse eventKey="0">
                                                                    <div>
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
                                </Accordion>) : null}
                        </div>

                    </div>
                </div>)

        }
        let mainContent = [];
        if (this.state.resultMode === "EMPTY") {
            mainContent.push(<div class="alert alert-danger" role="alert">
                No data
                        </div>)

        } else {
            if (this.state.resultMode === "LARGE_RESULTS") {
                mainContent.push(<div class="alert alert-danger" role="alert">
                    Too many results
                        </div>)

            }
            mainContent.push(<div className="row">
                <div className="col-xs-12">
                    <div className="individual">
                        <div className="searchHeader">
                            {/* <div className="col-sm-4">
                                            <div className="individual_search">
                                                <Form>
                                                    <Form.Group as={Row} id="form_group">
                                                        <Form.Label column sm="4" id="form-label_number">Show records</Form.Label>
                                                        <Col sm="3"> <Form.Control as="select" className="pl-1 border">
                                                            <option>10</option>
                                                            <option>20</option>
                                                            <option>30</option>
                                                            <option>40</option>
                                                            <option>50</option>
                                                        </Form.Control>
                                                        </Col>
                                                    </Form.Group>
                                                </Form>
                                            </div>
                                        </div> */}
                            <div className="col-sm-12">
                                {/* <button className="btn button1" type="button">First</button> */}
                                <Pagination total={groupReviewSuggestions.length} page={this.state.page}
                                    count={this.state.count}
                                    onChange={this.handlePaginationUpdate} />
                                {/* <Pagination id="individual_page" className="mt-0 mb-0">
                                                {/* <Pagination.First /> */}
                                {/* <Pagination.Prev />
                                                <Pagination.Item disabled>{10}</Pagination.Item>
                                                <Pagination.Item>{11}</Pagination.Item>
                                                <Pagination.Ellipsis />
                                                <Pagination.Item>{25}</Pagination.Item>
                                                <Pagination.Item >{26}</Pagination.Item>
                                                <Pagination.Next /> */}
                                {/* <Pagination.Last /> */}
                                {/* <button className="btn button2" type="button">Last</button>
                                            </Pagination> */}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            )
        }
        if (this.state.loading) {
            return (<div className="h6fnhWdeg-app-loader"> </div>)
        }
        else {
            return (
                <div className="main-container">
                    <div className="header-position">
                        <Header username={this.props.username} />
                    </div>
                    {/* <SideNav uid={this.props.match.params.uid} history={this.props.history} /> */}
                    <SideNav />
                    <div className="container">
                        <div className="row">
                            <div className="col-md-12 findscholar">
                                <h4> <span className="scholarlink"><Link to="/individual"><a href="#">Find Scholar </a></Link></span><span className="gtsymbol">&gt;</span><span className="review">Review Pendings Suggestions</span></h4>
                            </div>
                        </div>
                        <div className="searchby">
                            <Row>
                                <Col md={6} className="search well well-sm">
                                    <Col md={12}>
                                        <p className="font-italic">Searched by:</p>
                                    </Col>
                                    <Row className="search_filterss">
                                        <Col md={4}>
                                            <h5> <b> Department</b></h5>

                                            {selectedDeptTypes ? selectedDeptTypes.map((dept) => <li>{dept}</li>) : null}
                                        </Col>
                                        <Col md={4}>
                                            <h5><b>Affiliation</b></h5>
                                            {selectedAffiliationTypes ? selectedAffiliationTypes.map(type => <li>{type}</li>) : null}
                                        </Col>
                                        <Col md={4}>
                                            <h5> <b>Person Type</b></h5>
                                            {selectedPersonTypes ? selectedPersonTypes.map((personType) => <li>{personType}</li>) : null}
                                        </Col>
                                    </Row>
                                    <Col md={12} className="searchfilter_edit">
                                        <a href="#" onClick={() => this.editsearch()}>Edit Search</a>
                                    </Col>
                                </Col>

                            </Row>
                            {/* <div className="row edit">
                                <div className="col-md-12">
                                  
                                </div>
                            </div> */}
                        </div>
                        <div className="row scholars">
                            <div className="col-md-2">
                                <h4>{groupReviewSuggestions.length} scholars</h4>
                            </div>
                        </div>
                        {mainContent}
                        {elementsUI}
                    </div>
                    <div className="footer-position">
                        <Footer />
                    </div>
                </div >
            );

        }
    }
}

const mapStateToProps = state => ({
    groupReviewSuggestions: state.groupReviewSuggestions,
    selectedDeptTypes: state.selectedDeptTypes,
    selectedPersonTypes: state.selectedPersonTypes,
    selectedAffiliationTypes: state.selectedAffiliationTypes,
    identityAllData: state.identityAllData
})

const mapDispatchToProps = dispatch => ({
    editsearch(deptTypes, personTypes, affiliationTypes, cb) {
        dispatch(editIndividualSearch(deptTypes, personTypes, affiliationTypes, cb))
    },
    getGroupReviewSuggestions(deptTypes, personTypes, affiliationTypes, cb) {
        dispatch(getGroupReviewSuggestions(deptTypes, personTypes, affiliationTypes, cb))
    },
    updatePublication(uid, request) {
        dispatch(
            reciterUpdatePublication(uid, request)
        )
    },
    identityFetchData(uid) {
        dispatch(identityFetchData(uid))
    },
    clearGroupReviewSuggestions() {
        dispatch(clearGroupReviewSuggestions())
    }
});

// export default Individual;
export default connect(mapStateToProps, mapDispatchToProps)(Individuals)
