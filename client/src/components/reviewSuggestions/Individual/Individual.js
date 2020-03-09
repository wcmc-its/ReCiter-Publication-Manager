import React, { Component } from "react";
import {Table, Form, Row, Col, Container, FormControl, InputGroup, Button} from "react-bootstrap";
import { identityFetchAllData, updateDeptsPersonTypes, getGroupReviewSuggestions, updateAffiliationType, clearDeptPersonAffiliTypesData } from '../../../../src/actions';
import { connect } from 'react-redux'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faTimes, faSortDown, faSearch } from '@fortawesome/free-solid-svg-icons'
import Header from "../../ui/Header";
import Footer from "../../ui/Footer";
import SideNav from "../../ui/SideNav";
import { Pagination } from '../../ui/Pagination'
import GenericheadShot from '../../../images/generic_headshot.png'
import "./individual.css";
// import "../../css/Search.css";
// import "../../../css/Search.css";
class Individual extends Component {
    state = {
        sort: "0",
        identitySearch: "",
        identityData: undefined,
        selectedDeps: [],
        selectedAffiliations: [],
        selectedPersonTypes: [],
        search: "",
        page: 1,
        count: 20,
        activepage: 1,
        searchText: '',
        data: [],
        selectedAffiliationValue: '',
        selectedDepartmentValue: '',
        selectedPersonValue: ''

    }

    constructor(props) {
        super(props);
        this.onRecordsLimitChange = this.onRecordsLimitChange.bind(this);
        this.handleDepartmentSelect = this.handleDepartmentSelect.bind(this);
        this.handlePersonTypeSelect = this.handlePersonTypeSelect.bind(this);
        this.handleAffiliationSelect = this.handleAffiliationSelect.bind(this);
        this.removeDepartmentFilter = this.removeDepartmentFilter.bind(this);
        this.removeAffiliationFilter = this.removeAffiliationFilter.bind(this);
        this.removePersonTypeFilter = this.removePersonTypeFilter.bind(this);
        this.onSearchUpdate = this.onSearchUpdate.bind(this);
        this.handlePaginationUpdate = this.handlePaginationUpdate.bind(this);
        this.search = this.search.bind(this)
        this.clearAllFilters = this.clearAllFilters.bind(this)
        if (this.props.identityAllData.length <= 0) {
            this.props.identityFetchAllData()
        }
    }

    componentDidMount() {
        this.setState({
            data: this.props.identityAllData,
            selectedDeps: this.props.deptTypes,
            selectedPersonTypes: this.props.personTypes,
            selectedAffiliations: this.props.affiliationTypes
        })
    }

    componentWillReceiveProps(nextProps) {
        this.setState({ data: nextProps.identityAllData })
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

    getDepartments() {
        let departments = [...new Set(this.props.identityAllData.map((data) => data.organizationalUnits).flat())]
            .filter((orgUnit) => {
                if (orgUnit != null) {
                    return orgUnit.organizationalUnitType === "DEPARTMENT"
                }
            });
        departments = this.getUnique(departments, 'organizationalUnitLabel')
        departments.sort((a, b) => {
            let nameA = a.organizationalUnitLabel.toLowerCase(), nameB = b.organizationalUnitLabel.toLowerCase()
            if (nameA < nameB) //sort string ascending
                return -1
            if (nameA > nameB)
                return 1
            return 0
        })
        return departments
    }

    getUnique(arr, comp) {

        const unique = arr
            .map(e => e[comp])

            // store the keys of the unique objects
            .map((e, i, final) => final.indexOf(e) === i && i)

            // eliminate the dead keys & store unique objects
            .filter(e => arr[e]).map(e => arr[e]);

        return unique;
    }

    numberWithCommas(number) {
        return number.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    }

    getPersonTypes() {
        let personTypes = [...new Set(this.props.identityAllData.map((data) => data.personTypes).flat())]
            .filter((personItem) => personItem != null ? true : false)
        return personTypes.sort()
    }

    getAffiliationTypes() {
        let affiliationTypes = [...new Set(this.props.identityAllData.map((data) => data.institutions).flat())]
            .filter((affliItem) => affliItem != null ? true : false)
        return affiliationTypes.sort()
    }

    onRecordsLimitChange(e) {
        this.setState({
            count: e.target.value
        })
    }



    handleDepartmentSelect(event) {
        let newDepartment = event.target.value;
        if (newDepartment != "Department") {
            // let selectedDeps = [...this.state.selectedDeps, newDepartment];
            let selectedDeps = [...new Set([...this.state.selectedDeps, newDepartment])];
            this.props.updateDeptsPersonTypes(selectedDeps, this.state.selectedPersonTypes)
            this.setState({ selectedDeps, selectedDepartmentValue: "Department" });
        }
    }

    handleAffiliationSelect(event) {
        let newAffiliation = event.target.value;
        if (newAffiliation != "Affiliation") {
            let selectedAffiliations = [...new Set([...this.state.selectedAffiliations, newAffiliation])];
            this.props.updateAffiliationType(selectedAffiliations)
            this.setState({ selectedAffiliations, selectedAffiliationValue: "Affiliation" });
        }
    }


    handlePersonTypeSelect(event) {
        let personType = event.target.value;
        if (personType != "Person Type") {
            let selectedPersonTypes = [...new Set([...this.state.selectedPersonTypes, personType])];
            this.props.updateDeptsPersonTypes(this.state.selectedDeps, selectedPersonTypes)
            this.setState({ selectedPersonTypes, selectedPersonValue: "Person Type" });
        }
    }

    removeDepartmentFilter(dep, event) {

        this.setState(prevState => {
            return { selectedDeps: prevState.selectedDeps.filter(selectedDep => selectedDep !== dep) };
        })
    }

    removeAffiliationFilter(affiliation, event) {
        this.setState(prevState => {
            return { selectedAffiliations: prevState.selectedAffiliations.filter(selectedAffiliation => selectedAffiliation !== affiliation) };
        })
    }

    removePersonTypeFilter(pType, event) {

        this.setState(prevState => {
            return { selectedPersonTypes: prevState.selectedPersonTypes.filter(selectedPType => selectedPType !== pType) };
        })
    }

    clearAllFilters() {
        this.props.clearDeptPersonAffiliTypesData()
        this.setState({ selectedDeps: [], selectedPersonTypes: [], selectedAffiliations: [], data: this.props.identityAllData });
        this.refs['search-field'].value = ""
    }

    onSearchUpdate(e) {
        this.setState({
            searchText: e.target.value
        })
    }

    filter(identityAllData) {
        const thisObject = this;
        var from = (parseInt(this.state.page, 10) - 1) * parseInt(this.state.count, 10);
        var to = from + parseInt(this.state.count, 10) - 1;
        var identities = [];
        var i = from;
        for (i; i <= to; i++) {
            if (identityAllData !== undefined && identityAllData.length > 0) {
                if (identityAllData[i] !== undefined) {
                    identities.push(identityAllData[i]);
                }
            } else {
                if (identityAllData[i] !== undefined) {
                    identities.push(identityAllData[i]);
                }
            }

        }
        return {
            paginatedIdentities: identities
        };
    }

    search() {
        // if (this.state.selectedDeps.length > 0 || this.state.selectedPersonTypes.length > 0 || this.state.selectedAffiliations.length > 0) {
        //     this.props.getGroupReviewSuggestions(this.props.deptTypes, this.props.personTypes, this.props.affiliationTypes, () => this.props.history.push('/individual_suggestions'))
        // } else {
        if (this.refs['search-field'].value != "" && this.refs['search-field'].value != undefined) {
            const { identityAllData } = this.props;
            // let foundObj = identityAllData.find((item) => item ? item.uid == this.refs['search-field'].value : false)
            let searchText = this.refs['search-field'].value;
            let foundObj = identityAllData.filter(identity => {
                if (identity.uid === searchText
                    ||
                    identity.primaryName.firstName.toLowerCase().includes(searchText.toLowerCase())
                    ||
                    identity.primaryName.lastName.toLowerCase().includes(searchText.toLowerCase())) {
                    return identity
                }
            })
            this.setState({ data: foundObj })
        } else {
            this.setState({ data: this.props.identityAllData })
        }
    }

    reviewSuggestions() {
        if (this.state.selectedDeps.length || this.state.selectedPersonTypes.length || this.state.selectedAffiliations.length) {
            this.props.getGroupReviewSuggestions(this.state.selectedDeps, this.state.selectedPersonTypes, this.state.selectedAffiliations, () => this.props.history.push('/individual_suggestions'))
        }
    }

    render() {
        if (this.props.identityAllData.length <= 0) {
            return (
                <div className="h6fnhWdeg-app-loader"> </div>
            )
        } else {
            const identities = this.filter(this.state.data);
            let tableData = identities.paginatedIdentities.map((identity, index) => {
                return <tr className="row">
                    <td className="col-md-3 col-lg-3 col-sm-3 col-xs-3 col-xl-3">
                        <RenderProfileDetails identity={identity} />
                    </td>
                    <td className="col-md-4 col-lg-4 col-sm-4 col-xs-4 col-xl-4"><ul className="pl-0">
                        <RenderListItems list={identity.organizationalUnits} orgUnit="true">

                        </RenderListItems>
                    </ul></td>
                    <td className="col-md-5 col-lg-5 col-sm-5 col-xs-5 col-xl-5">
                        <ul className="pl-0">
                            <RenderListItems list={identity.institutions} orgUnit="false"></RenderListItems>
                        </ul>
                    </td>
                </tr>
            })

            let depOptions = this.getDepartments().map((dep) => {
                return <option value={dep.organizationalUnitLabel}>{dep.organizationalUnitLabel}</option>
            });
            let affiliationOptions = this.getAffiliationTypes().map((affiliation) => {
                return <option value={affiliation}>{affiliation}</option>
            });
            let personTypeOptions = this.getPersonTypes().map((ptype) => {
                return <option value={ptype}>{ptype}</option>
            });
            // let PaginationData = this.props.identityAllData.map((identities, index) => {
            //     return <Pagination.Item key={index + 1} active={index + 1 === this.state.activepage} onSelect={(e) => console.log(e)}>
            //         {index + 1}
            //     </Pagination.Item>
            // })
            return (
                <div className="main-container">
                    <div className="header-position">
                        <Header username={this.props.username} />
                    </div>
                    {/* <div className="side-nav-position"> */}
                    {/* <SideNav uid={this.props.match.params.uid} history={this.props.history} /> */}
                    <SideNav />
                    {/* </div>
                    <div className="mt-5 manage-profile-content-container"> */}
                    <Container className="indivdual_container">
                        <div className="row">
                            <div className="col-md-12">
                                <h4 className="heading">Find Scholar</h4>
                            </div>
                            <div className=" mb-7 col-md-12 col-sm-12 col-xs-12 col-lg-7 col-xl-7">
                                <div className="individual_search_well well well-sm">

                                    <Form className="individual_search">
                                        <div className="form-group">
                                            <div className="input-group">
                                                <input type="text" className="search_indivdual_input mt-0 font-italic form-control" placeholder="Enter name or CWID" aria-describedby="basic-addon2" onChange={this.onSearchUpdate} ref="search-field" />
                                                <span onClick={() => this.search()} className="inputadds input-group-addon" id="basic-addon2"><FontAwesomeIcon icon={faSearch} className="searchicon" /></span>
                                            </div>
                                        </div>

                                        <div>
                                            <p><span className="font-italic advanced_search_font">Advanced Search:</span> <a href="#"><u onClick={this.clearAllFilters}>Clear All</u></a></p>
                                        </div>
                                        <Row>
                                            <Col md={4}>
                                                <Form.Group controlId="exampleForm.ControlSelect1" className="individual_searchfilter">
                                                    {/* <FontAwesomeIcon icon={faSortDown} size='1x' className="search_carot_icon" /> */}
                                                    <Form.Control id="indivdual_search_selectopts" as="select" placeholder={"Department"} value={this.state.selectedDepartmentValue} onChange={this.handleDepartmentSelect} className="border-forms_ids pl-2 font-weight-bold">
                                                        <option value='Department'>Department</option>
                                                        {depOptions}
                                                    </Form.Control>

                                                </Form.Group>
                                                <div className="tags-info">
                                                    {this.state.selectedDeps.map((dep) => {
                                                        return <p className="tags bg-primary"><span className="tags_main_child">{dep}</span> <span className="close_icons" onClick={() => this.removeDepartmentFilter(dep)}> <FontAwesomeIcon icon={faTimes} /> </span></p>
                                                    })}
                                                </div>
                                            </Col>
                                            <Col md={4}>
                                                <Form.Group controlId="exampleForm.ControlSelect1" className="individual_searchfilter">
                                                    {/* <FontAwesomeIcon icon={faSortDown} size='1x' className="search_carot_icon" /> */}
                                                    <Form.Control id="indivdual_search_selectopts" as="select" placeholder={"Affiliation"} value={this.state.selectedAffiliationValue} onChange={this.handleAffiliationSelect} className="select_box border-forms_ids pl-2 font-weight-bold">
                                                        <option>Affiliation</option>
                                                        {affiliationOptions}
                                                    </Form.Control>

                                                </Form.Group>
                                                <div>
                                                    {this.state.selectedAffiliations.map((dep) => {
                                                        return <p className="tags bg-primary"><span className="tags_main_child">{dep}</span> <span className="close_icons" onClick={() => this.removeAffiliationFilter(dep)}><FontAwesomeIcon icon={faTimes} /> </span></p>
                                                    })}
                                                </div>
                                            </Col>
                                            <Col md={4}>
                                                <Form.Group controlId="exampleForm.ControlSelect1" className="individual_searchfilter">
                                                    {/* <FontAwesomeIcon icon={faSortDown} size='1x' className="search_carot_icon" /> */}
                                                    <Form.Control id="indivdual_search_selectopts" as="select" placeholder={"Person Type"} value={this.state.selectedPersonValue} onChange={this.handlePersonTypeSelect} className="border-forms_ids pl-2 font-weight-bold">
                                                        <option value='Person Type'>Person Type</option>
                                                        {personTypeOptions}
                                                    </Form.Control>

                                                </Form.Group>
                                                <div>
                                                    {this.state.selectedPersonTypes.map((ptype) => {
                                                        return <p className="bg-primary tags"><span className="tags_main_child">{ptype} </span> <span className="close_icons" onClick={() => this.removePersonTypeFilter(ptype)}> <FontAwesomeIcon icon={faTimes} /> </span></p>
                                                    })
                                                    }

                                                </div>
                                            </Col>
                                        </Row>
                                    </Form>
                                </div>
                            </div>
                        </div>
                        <div className="row page-title">
                            <div className="col-md-12">
                                <h4 className="scholarHeading"><span className="scholars"> {this.numberWithCommas(this.props.identityAllData.length)} scholar </span> <span className="btn-span"> <button type="button" class="btn-primes btn btn-primary" onClick={() => this.props.history.push('/individual_suggestions')}>Review  All Pending Suggestions</button></span></h4>
                            </div>
                        </div>
                        <div className="row">
                            <div className="col-xs-12 col-md-12 col-lg-12 col-xl-12 col-sm-12 pl-0 pr-0">
                                <div className="individual">
                                    <div className="individual_searchshowrec searchHeader">

                                        <div className="col-sm-12">
                                            {/* <Pagination id="individual_page" items={4}>
                                                {PaginationData}
                                            </Pagination> */}
                                            <Pagination total={this.props.identityAllData.length} page={this.state.page}
                                                count={this.state.count}
                                                onChange={this.handlePaginationUpdate} />
                                        </div>
                                    </div>
                                    <div className="row">
                                        <div className="indvidualbody col-md-12 pr-5 pl-5">
                                            <Table responsive className="individual_table">
                                                <thead>
                                                    <tr className="row">
                                                        <th className="col-md-3 col-lg-3 col-sm-3 col-xs-3 col-xl-3">Name</th>
                                                        <th className="col-md-4 col-lg-4 col-sm-4 col-xs-4 col-xl-4">Organizational Units</th>
                                                        <th className="col-md-5 col-lg-5 col-sm-5 col-xs-5 col-xl-5">Institutions</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {tableData}
                                                </tbody>
                                            </Table>
                                        </div>
                                    </div>

                                </div>
                            </div>
                        </div>
                    </Container>
                    {/* </div> */}
                    <div className="footer-position">
                        <Footer />
                    </div>
                </div>
            );
        }
    }
}

function RenderProfileDetails(identity) {
    let imageUrl = ''
    if (identity.identity.identityImageEndpoint !== undefined) {
        if (identity.identity.identityImageEndpoint.length > 0)
            imageUrl = identity.identity.identityImageEndpoint
        else
            imageUrl = GenericheadShot
    }
    let profileName = identity.identity.primaryName.firstName + ((identity.identity.primaryName.middleName !== undefined) ? ' ' + identity.identity.primaryName.middleName + ' ' : ' ') + identity.identity.primaryName.lastName
    return (<Row>
        <Col md={4} xs={4} sm={4} lg={4} xl={4}>
            <img className="userimg_individual" src={`${imageUrl}`} onError={(e) => { e.target.onerror = null; e.target.src = GenericheadShot }} width="80" style={{ float: "left" }} />
        </Col>
        <Col md={8} xs={8} sm={8} lg={8} xl={8}>
            <p className="username_individual"><a href={`/app/${identity.identity.uid}`} target="_blank">
                <b>{profileName}</b>
            </a></p>
            <p className="title_individual">{identity.identity.title}</p>
        </Col>
    </Row>
    )
}

function RenderListItems(props) {
    if (props.list === undefined || props.list === null) {
        return null
    }
    let listArray = []
    if (props.orgUnit === "true") {
        props.list.map((item, idx) => {
            listArray.push(<li key={idx}>{item.organizationalUnitLabel}</li>)
        })
    } else {
        props.list.map((item, idx) => {
            listArray.push(<li key={idx}>{item}</li>)
        })
    }
    return (
        (<ul className="idvidual_ul pl-0">{listArray}</ul>)
    )
}

function mapStateToProps(state) {
    return {
        identityAllData: state.identityAllData,
        identityAllFetching: state.identityAllFetching,
        errors: state.errors,
        deptTypes: state.selectedDeptTypes,
        personTypes: state.selectedPersonTypes,
        affiliationTypes: state.selectedAffiliationTypes,
        auth: state.auth
    }
}

const mapDispatchToProps = dispatch => ({
    identityFetchAllData() {
        dispatch(identityFetchAllData())
    },
    updateDeptsPersonTypes(deptTypes, personTypes) {
        dispatch(updateDeptsPersonTypes(deptTypes, personTypes))
    },
    getGroupReviewSuggestions(deptTypes, personTypes, affiliationTypes, cb) {
        dispatch(getGroupReviewSuggestions(deptTypes, personTypes, affiliationTypes, cb))
    },
    updateAffiliationType(affiliationTypes) {
        dispatch(updateAffiliationType(affiliationTypes))
    },
    clearDeptPersonAffiliTypesData() {
        dispatch(clearDeptPersonAffiliTypesData())
    }
})


// export default Individual;
export default connect(mapStateToProps, mapDispatchToProps)(Individual)
