import React, { Component } from "react";
import { Row, Col } from "react-bootstrap";
import { Link } from "react-router-dom";
import Header from "../../ui/Header";
import Footer from "../../ui/Footer";
import SideNav from "../../ui/SideNav";
import { Pagination } from '../../ui/Pagination';
import "./individual_suggestions.css";
import { connect } from 'react-redux'
import { editIndividualSearch, getGroupReviewSuggestions, reciterUpdatePublication, identityFetchData, clearGroupReviewSuggestions } from '../../../../src/actions';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faChevronRight } from '@fortawesome/free-solid-svg-icons'
import Suggestions from './Suggestions'

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
        if (groupReviewSuggestions && groupReviewSuggestions.reciter.length >= 0) {
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
        if (this.props.selectedDeptTypes.length || this.props.selectedPersonTypes.length || this.props.selectedAffiliationTypes.length) {
            this.props.clearGroupReviewSuggestions()
            this.props.editsearch(this.props.selectedDeptTypes, this.props.selectedPersonTypes, this.props.selectedAffiliationTypes, () => this.props.history.push('/individual'))
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
        const { groupReviewSuggestions, selectedDeptTypes, selectedPersonTypes, selectedAffiliations, identityAllData } = this.state;
        const { page, count } = this.state;
        let elementsUI = [], loopCount;
        if (count < groupReviewSuggestions.length) loopCount = count;
        else loopCount = groupReviewSuggestions.length;
        for (let j = ((page - 1) * loopCount); j < ((page - 1) * loopCount) + loopCount; j++) {
            let i = groupReviewSuggestions[j]
            if(i != undefined){
            console.log(i.personIdentifier, 'i')
            let userObj = identityAllData.find((item) => item ? item.uid == i.personIdentifier : false)
            elementsUI.push(
                <div className="firsttable">
                    <div className="row">
                        <div className="col-md-12">
                            <h4 className="group_heeader_main"><span className="link"><a href={`/app/${userObj?.uid}`} target="_blank">{userObj?.primaryName?.firstName + " " + userObj?.primaryName?.lastName}</a></span><span className="name">{userObj?.title}</span></h4>
                        </div>
                    </div>
                    <div className="row recordstable">
                        <div className="col-md-12">
                            <Suggestions articles={i} />
                        </div>
                    </div>
                </div>)
            }

        }
        let mainContent = [];
        if (this.state.resultMode === "EMPTY") {
            mainContent.push(<div class="alert_to_many alert alert-danger" role="alert">
                No data
                        </div>)

        } else {
            if (this.state.resultMode === "LARGE_RESULTS") {
                mainContent.push(<div class="alert_to_many alert alert-danger" role="alert">
                    Too many results
                        </div>)

            }
            // mainContent.push()
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
                    <div className="side-nav-position">
                        <SideNav uid={this.props.match.params.uid} history={this.props.history} />
                    </div>
                    {/* <SideNav uid={this.props.match.params.uid} history={this.props.history} /> */}
                    <div>
                        <div className="individual_suggest_container container">
                            <div className="row">
                                <div className="col-md-12 findscholar">
                                    <h4> <span className="scholarlink"><Link to="/individual"><a href="#">Find Scholar </a></Link></span><span className="gtsymbol"><FontAwesomeIcon icon={faChevronRight} /></span><span className="review">Review Pending Suggestions</span></h4>
                                </div>
                            </div>
                            <div className="searchby">
                                <Row>
                                    <Col md={6} className="search well well-sm">
                                        <Col md={12}>
                                            <p className="Searchby_font font-italic">Searched by:</p>
                                        </Col>
                                        <Row className="search_filterss">
                                            <Col md={4}>
                                                <h5> <b> Department</b></h5>

                                                {selectedDeptTypes ? selectedDeptTypes.map((dept) => <li>{dept}</li>) : null}
                                            </Col>
                                            <Col md={4}>
                                                <h5><b>Affiliation</b></h5>
                                                {selectedAffiliations ? selectedAffiliations.map(type => <li>{type}</li>) : null}
                                            </Col>
                                            <Col md={4} className="suggestions_edit_lastchild">
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
                                <div className="col-md-12">
                                    {mainContent}
                                </div>
                            </div>
                        </div>
                        <div className="individual_suggest_containers12">
                            <div className="row">
                                <div className="col-xs-12">
                                    <div className="individual_suggestions">
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

                        </div>
                        <div className="individual_suggest_containers">
                            {elementsUI}
                        </div>

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
