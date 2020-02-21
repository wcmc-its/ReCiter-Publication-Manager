import React, { Component } from "react";
import { Link } from "react-router-dom";
import { Table, Form, Row, Col, Container, FormControl, InputGroup } from "react-bootstrap";
import { identityFetchAllData, updateDeptsPersonTypes, getGroupReviewSuggestions } from '../../../../src/actions';
import { connect } from 'react-redux'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faCoffee, faTimes, faSortDown } from '@fortawesome/free-solid-svg-icons'
import Header from "../../ui/Header";
import Footer from "../../ui/Footer";
import SideNav from "../../ui/SideNav";
import { Pagination } from '../../ui/Pagination'
import "./individual.css";
// import "../../css/Search.css";
// import "../../../css/Search.css";
class Individual extends Component {
    state = {
        sort: "0",
        identitySearch: "",
        identityData: undefined,
        selectedDeps: [],
        selectedPersonTypes: [],
        search: "",
        page: 1,
        count: 20,
        activepage: 1,
        searchText: '',
        data: []

    }

    constructor(props) {
        super(props);
        // this.search = this.search.bind(this);
        // this.handlePaginationUpdate = this.handlePaginationUpdate.bind(this);
        // this.filter = this.filter.bind(this);
        // this.handleFilterUpdate = this.handleFilterUpdate.bind(this);
        // this.handleSearchUpdate = this.handleSearchUpdate.bind(this);
        // this.handleRedirect = this.handleRedirect.bind(this);
        // Name = Name.bind(this)
        this.onRecordsLimitChange = this.onRecordsLimitChange.bind(this);
        this.handleDepartmentSelect = this.handleDepartmentSelect.bind(this);
        this.handlePersonTypeSelect = this.handlePersonTypeSelect.bind(this);
        this.removeDepartmentFilter = this.removeDepartmentFilter.bind(this);
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
        console.log("identitiyfetcll did mount", this.props.identityAllData)
        this.setState({ data: this.props.identityAllData })
    }

    componentWillReceiveProps(nextProps) {
        console.log("identitiyfetcll receive mount", nextProps.identityAllData)
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
        return [...new Set(this.props.identityAllData.map((data) => data.organizationalUnits).flat())]
            .filter((orgUnit) => {
                if (orgUnit != null) {
                    return orgUnit.organizationalUnitType === "DEPARTMENT"
                }
            });
    }

    getPersonTypes() {
        return [...new Set(this.props.identityAllData.map((data) => data.personTypes).flat())]
    }

    onRecordsLimitChange(e) {
        this.setState({
            count: e.target.value
        })
    }



    handleDepartmentSelect(event) {
        let newDepartment = event.target.value;
        let selectedDeps = [...this.state.selectedDeps, newDepartment];
        this.props.updateDeptsPersonTypes(selectedDeps, this.state.selectedPersonTypes)
        this.setState({ selectedDeps });
    }

    handlePersonTypeSelect(event) {
        let personType = event.target.value;
        let selectedPersonTypes = [...this.state.selectedPersonTypes, personType];
        this.props.updateDeptsPersonTypes(this.state.selectedDeps, selectedPersonTypes)
        this.setState({ selectedPersonTypes });
    }

    removeDepartmentFilter(dep, event) {

        this.setState(prevState => {
            return { selectedDeps: prevState.selectedDeps.filter(selectedDep => selectedDep !== dep) };
        })
    }

    removePersonTypeFilter(pType, event) {

        this.setState(prevState => {
            return { selectedPersonTypes: prevState.selectedPersonTypes.filter(selectedPType => selectedPType !== pType) };
        })
    }

    clearAllFilters() {
        this.setState({ selectedDeps: [], selectedPersonTypes: [],data:this.props.identityAllData });
        this.refs['search-field'].value=""
    }

    onSearchUpdate(e) {
        console.log(e.target.value, 'asdsad')
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
        if (this.state.selectedDeps.length > 0 || this.state.selectedPersonTypes.length > 0) {
            this.props.getGroupReviewSuggestions(this.props.deptTypes, this.props.personTypes, () => this.props.history.push('/individual_suggestions'))
        } else {
            if (this.refs['search-field'].value != "" && this.refs['search-field'].value != undefined) {
                const { identityAllData } = this.props;
                let foundObj = identityAllData.find((item) => item ? item.uid == this.refs['search-field'].value : false)
                this.setState({ data: [foundObj] })
            } else {
                this.setState({ data: this.props.identityAllData })
            }
        }
        // this.props.history.push({
        //     pathname:'/individual_suggestions',
        //     state:{
        //         deptTypes:this.state.selectedDeps,
        //         personTypes:this.state.selectedPersonTypes
        //     }
        // })
        // const thisObject = this
        // const searchText = this.refs['search-field'].value

        // this.setState({
        //     identityData: thisObject.props.identityAllData
        // })

        // this.setState({
        //     identitySearch: searchText
        // }, function () {
        //     if (thisObject.props.identityAllData !== undefined) {
        //         var searchResults = []
        //         searchResults = thisObject.props.identityAllData.filter(identity => {
        //             let matchesText = false;
        //             let matchesDeps = false;
        //             let matchesPersonTypes = false;
        //             if (identity.uid === searchText
        //                 ||
        //                 identity.primaryName.firstName.toLowerCase().includes(searchText.toLowerCase())
        //                 ||
        //                 identity.primaryName.lastName.toLowerCase().includes(searchText.toLowerCase())) {
        //                 // matchesText = true;
        //                 return identity
        //             }
        //             // if (this.state.selectedDepFilters.length > 0) {
        //             //     let deps = identity.organizationalUnits.map(ou => ou.organizationalUnitLabel);
        //             //     matchesDeps = this.state.selectedDepFilters.every(selectedDep => deps.includes(selectedDep));

        //             // } else {
        //             //     matchesDeps = true;
        //             // }

        //             // if (this.state.selectedPersonTypesFilters.length > 0) {
        //             //     matchesPersonTypes = this.state.selectedPersonTypesFilters
        //             //         .every(selectedPType => identity.personTypes.includes(selectedPType));

        //             // } else {
        //             //     matchesPersonTypes = true;
        //             // }

        //             // if (matchesText && matchesDeps && matchesPersonTypes) {
        //             //     return identity;
        //             // }

        //         })
        //         this.setState({
        //             identityData: searchResults
        //         })
        //     }

        // })

    }

    render() {
        // console.log('Testing', this.props.identityAllData)
        console.log('Testing', this.props.identityAllData)
        console.log('asdsad', this.state)
        if (this.props.identityAllData.length <= 0) {
            return (
                <div className="h6fnhWdeg-app-loader"> </div>
            )
        } else {
            const identities = this.filter(this.state.data);
            let tableData = identities.paginatedIdentities.map((identity, index) => {
                return <tr>
                    <td >
                        <ul className="list-inline">
                            <li><img src={identity.identityImageEndpoint} width="80" style={{ float: "left" }} /></li>
                            <li><p><b>{identity.primaryName.firstName}</b></p>
                                <p>{identity.title}</p>
                            </li>
                        </ul>
                    </td>
                    <td><ul className="pl-4">
                        {/* {identity.organizationalUnits.map((label, index) => {
                            return <li>{`${label.organizationalUnitLabel}`}</li>
                        }
                        )} */}
                        <RenderListItems list={identity.organizationalUnits} orgUnit="true">

                        </RenderListItems>
                    </ul></td>
                    <td>
                        <ul className="pl-4">
                            {/* {identity.institutions.map((label, index) => {
                                return <li>{`${label}`}</li>
                            }
                            )} */}
                            <RenderListItems list={identity.institutions} orgUnit="false"></RenderListItems>
                        </ul>
                    </td>
                </tr>
            })

            let depOptions = this.getDepartments().map((dep) => {
                return <option value={dep.organizationalUnitLabel}>{dep.organizationalUnitLabel}</option>
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
                        <Header />
                    </div>
                    {/* <div className="side-nav-position"> */}
                    {/* <SideNav uid={this.props.match.params.uid} history={this.props.history} /> */}
                    <SideNav />
                    {/* </div>
                    <div className="mt-5 manage-profile-content-container"> */}
                    <div className="container">
                        <div className="row">
                            <div className="col-md-12">
                                <h4 className="heading">Find Scholar</h4>
                            </div>
                            <div className=" mb-5 col-md-6">
                                <div className="individual_search_well well well-sm">

                                    <Form className="individual_search">
                                        <div className="form-group">
                                            <div className="input-group">
                                                <input type="text" className="mt-0 font-italic form-control" placeholder="Enter name or CWID" aria-describedby="basic-addon2" onChange={this.onSearchUpdate} ref="search-field" />
                                                <span onClick={() => this.search()} className="inputadds input-group-addon" id="basic-addon2"><span className="glyphicon glyphicon-search searchicon" aria-hidden="true"></span></span>
                                            </div>
                                        </div>
                                        {/* <Form.Row>
                                            <InputGroup className="mb-3">
                                                <FormControl
                                                    placeholder="Username"
                                                    aria-label="Username"
                                                    aria-describedby="basic-addon1"
                                                    className="d-inline-block"
                                                />
                                                <InputGroup.Prepend className="d-inline-block">
                                                    <InputGroup.Text id="basic-addon1">@</InputGroup.Text>
                                                </InputGroup.Prepend>
                                            </InputGroup>
                                            </Form.Row> */}
                                        <div>
                                            <p><span className="font-italic">Advanced Search</span> : <a href="#"><u onClick={this.clearAllFilters}>Clear All</u></a></p>
                                        </div>
                                        <Row>
                                            <Col md={4}>
                                                <Form.Group controlId="exampleForm.ControlSelect1" className="individual_searchfilter">
                                                    <FontAwesomeIcon icon={faSortDown} size='1x' className="search_carot_icon" />
                                                    <Form.Control as="select" onChange={this.handleDepartmentSelect} className="border-forms_ids pl-2 font-weight-bold border-bottom-1">
                                                        {depOptions}
                                                    </Form.Control>

                                                </Form.Group>
                                                <div className="tags-info">
                                                    {this.state.selectedDeps.map((dep) => {
                                                        return <p className="tags bg-primary"><span>{dep}</span> <span className="close_icons" onClick={() => this.removeDepartmentFilter(dep)}> <span class="glyphicon glyphicon-remove" aria-hidden="true"></span> </span></p>
                                                    })}
                                                </div>
                                            </Col>
                                            <Col md={4}>
                                                <Form.Group controlId="exampleForm.ControlSelect1" className="individual_searchfilter">
                                                    <FontAwesomeIcon icon={faSortDown} size='1x' className="search_carot_icon" />
                                                    <Form.Control as="select" className="select_box border-forms_ids pl-2 font-weight-bold border-bottom-1">
                                                        <option>Affiliation</option>
                                                        <option>Affiliation Affiliation</option>
                                                    </Form.Control>

                                                </Form.Group>
                                                <div>
                                                    <p className="bg-primary tags"><span>Affiliation Affiliation</span> <span className="close_icons"> <FontAwesomeIcon icon={faTimes} size='1x' /> </span></p>
                                                    <p className="bg-primary tags"><span>Affiliation</span> <span className="close_icons"> <FontAwesomeIcon icon={faTimes} size='1x' /></span></p>
                                                    <p className="bg-primary tags"><span>Affiliation Affiliation</span> <span className="close_icons"><FontAwesomeIcon icon={faTimes} size='1x' /></span></p>
                                                </div>
                                            </Col>
                                            <Col md={4}>
                                                <Form.Group controlId="exampleForm.ControlSelect1" className="individual_searchfilter">
                                                    <FontAwesomeIcon icon={faSortDown} size='1x' className="search_carot_icon" />
                                                    <Form.Control as="select" onChange={this.handlePersonTypeSelect} className="border-forms_ids pl-2 font-weight-bold border-bottom-1">
                                                        {personTypeOptions}
                                                    </Form.Control>

                                                </Form.Group>
                                                <div>
                                                    {this.state.selectedPersonTypes.map((ptype) => {
                                                        return <p className="bg-primary tags"><span>{ptype} </span> <span className="close_icons" onClick={() => this.removePersonTypeFilter(ptype)}> <span class="glyphicon glyphicon-remove" aria-hidden="true"></span> </span></p>
                                                    })
                                                    }

                                                </div>
                                            </Col>
                                        </Row>
                                    </Form>
                                </div>
                            </div>
                        </div>
                        <div className="row">
                            <div className="col-md-12">
                                <h4><span className="scholars"> {this.props.identityAllData.length} scholar </span> <span className="btn-span"> <Link to="/individual_suggestions">  <button type="button" class="btn-primes btn btn-primary">Review  All Pending Suggestions</button> </Link></span></h4>
                            </div>
                        </div>
                        <div className="row">
                            <div className="col-xs-12">
                                <div className="individual">
                                    <div className="searchHeader">
                                        <div className="col-sm-4 pt-1">

                                            <div className="individual_search">
                                                <Form>

                                                    <Form.Group as={Row} id="form_group">

                                                        <Form.Label column sm="4" id="form-label_number" className="pt-1 font-weight-normal">Show records</Form.Label>
                                                        <Col sm="2" className="pl-0 individual_searchfilter">
                                                            <FontAwesomeIcon icon={faSortDown} size='1x' className="show_recordscaret" />
                                                            <Form.Control as="select" className="mt-0 pl-3 pr-0 selectoption" onChange={this.onRecordsLimitChange}>
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
                                        </div>
                                        <div className="col-sm-8">
                                            {/* <Pagination id="individual_page" items={4}>
                                                {PaginationData}
                                            </Pagination> */}
                                            <Pagination total={this.props.identityAllData.length} page={this.state.page}
                                                count={this.state.count}
                                                onChange={this.handlePaginationUpdate} />
                                        </div>
                                    </div>
                                    <div className="row">
                                        <div className="col-md-12 pr-5 pl-5">
                                            <Table responsive className="individual_table">
                                                <thead>
                                                    <tr>
                                                        <th>Name</th>
                                                        <th>Organizational units</th>
                                                        <th>Institutions</th>
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
                    </div>
                    {/* </div> */}
                    <div className="footer-position">
                        <Footer />
                    </div>
                </div>
            );
        }
    }
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
        (<ul>{listArray}</ul>)
    )
}

function mapStateToProps(state) {
    return {
        identityAllData: state.identityAllData,
        identityAllFetching: state.identityAllFetching,
        errors: state.errors,
        deptTypes: state.selectedDeptTypes,
        personTypes: state.selectedPersonTypes,
        auth: state.auth
    }
}

const mapDispatchToProps = dispatch => ({
    identityFetchAllData() {
        dispatch(identityFetchAllData())
    },
    updateDeptsPersonTypes(deptTypes, personTypes) {
        console.log("deptTypes", deptTypes)
        dispatch(updateDeptsPersonTypes(deptTypes, personTypes))
    },
    getGroupReviewSuggestions(deptTypes, personTypes, cb) {
        dispatch(getGroupReviewSuggestions(deptTypes, personTypes, cb))
    }
})


// export default Individual;
export default connect(mapStateToProps, mapDispatchToProps)(Individual)