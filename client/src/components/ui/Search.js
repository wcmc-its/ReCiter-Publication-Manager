import React, { Component } from "react";
import { Button, Form } from "react-bootstrap";
import 'bootstrap/dist/css/bootstrap.min.css';
import { connect } from 'react-redux';
import { identityFetchAllData } from '../../actions'
import "../../css/Search.css";
import Header from "../ui/Header";
import Footer from "../ui/Footer";
import SideNav from "../ui/SideNav";
import { Pagination } from './Pagination';
import {Error} from "./Error";



class Search extends Component {

    state = {
        sort: "0",
        identitySearch: "",
        identityData: undefined,
        search: "",
        page: 1,
        count: 20

    }

    constructor(props) {
        super(props);
        this.search = this.search.bind(this);
        this.handlePaginationUpdate = this.handlePaginationUpdate.bind(this);
        this.filter = this.filter.bind(this);
        this.handleFilterUpdate = this.handleFilterUpdate.bind(this);
        this.handleSearchUpdate = this.handleSearchUpdate.bind(this);
        this.handleRedirect = this.handleRedirect.bind(this);
        Name = Name.bind(this)
    }

    componentDidMount() {
        if(this.props.identityAllData.length<=0) {
            this.props.identityFetchAllData()
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

    handleSearchUpdate(event) {
        this.setState({
            identitySearch: event.target.value
        });
    }

    handleFilterUpdate(filterState) {
        this.setState({
            search: filterState.search,
            page: 1
        });
    }

    handleRedirect(uid) {
        return this.props.history.push('/app/' + uid)
    }

    filter() {
        const thisObject = this;
        var from = (parseInt(this.state.page, 10) - 1) * parseInt(this.state.count, 10);
        var to = from + parseInt(this.state.count, 10) - 1;
        var identities = [];
        var i = from;
        for (i; i <= to; i++) {
            if(this.state.identityData !== undefined && this.state.identityData.length > 0) {
                if (this.state.identityData[i] !== undefined) {
                    identities.push(this.state.identityData[i]);
                }
            } else {
                if (thisObject.props.identityAllData[i] !== undefined) {
                    identities.push(thisObject.props.identityAllData[i]);
                }
            }
            
        }
        return {
            paginatedIdentities: identities
        };
    }

    search() {
        const thisObject = this
        const searchText = this.refs['search-field'].value

        this.setState({
            identityData: thisObject.props.identityAllData
        })

        this.setState({
            identitySearch: searchText
        }, function () {
            if(thisObject.props.identityAllData !== undefined) {
                var searchResults = []
                searchResults = thisObject.props.identityAllData.filter(identity => {
                    if(identity.uid === searchText 
                        || 
                        identity.primaryName.firstName.toLowerCase().includes(searchText.toLowerCase())
                        ||
                        identity.primaryName.lastName.toLowerCase().includes(searchText.toLowerCase())) {
                        return identity
                    }
                })
                this.setState({
                    identityData: searchResults
                })
            }
            
        })

    }

    render() {
        const identities = this.filter();

        if(this.props.errors && this.props.errors.length > 0) {
            return (
                <div className="main-container">
                    <div className="header-position">
                        <Header  username={this.props.username}  />
                    </div>

                    <div className="side-nav-position">
                        <SideNav uid={this.props.match.params.uid} history={this.props.history} />
                    </div>
                    <div>
                        <Error {...this.props} />
                    </div>
                    <div className="footer-position">
                        <Footer />
                    </div>
                </div>
            );
        }
        if (this.props.identityAllData.length <= 0) {
            return (
                    <div className="h6fnhWdeg-app-loader"> </div>
            );
        } else {
            const thisObject = this
            let tableBody
            tableBody = identities.paginatedIdentities.map(function (identity, identityIndex) {
                return <tr key={identityIndex}>
                    <td key="0" align="right">
                        <Name identity={identity}></Name>
                    </td>
                    <td key="1" width="40%">
                        <List list={identity.organizationalUnits} orgUnit="true"></List>
                    </td>
                    <td key="2" width="40%">
                        <List list={identity.institutions} orgUnit="false"></List>
                    </td>
                </tr>;
            })
            return (
                <div className="main-container">
                    <div className="header-position">
                        <Header  username={this.props.username}  />
                    </div>

                    <div className="side-nav-position">
                        <SideNav uid={this.props.match.params.uid} history={this.props.history} />
                    </div>
                    <div className="search-content-container">
                        <div className="search-bar">
                            <h1>Find a scholar(s)</h1>
                            <Form.Group controlId="formSearch">
                                <Form.Control
                                    type="input"
                                    placeholder="Enter name or person identifier"
                                    ref="search-field"
                                />
                            </Form.Group>
                            <Button className="primary" onClick={this.search} >Search</Button>
                            <div>
                                <br/>
                                <div className="row">
                                    <div className="col-md-4">
                                        <h3>Number of results: <strong>{(this.state.identityData !==undefined && this.state.identityData.length > 0)?this.state.identityData.length: thisObject.props.identityAllData.length}</strong></h3>
                                    </div>
                                </div>
                                <React.Fragment>
                                    <Pagination total={this.props.identityAllData.length} page={this.state.page}
                                                count={this.state.count}
                                                onChange={this.handlePaginationUpdate}/>
                                    <div className="table-responsive">
                                        <table className="h6fnhWdeg-publications-evidence-table table table-striped">
                                            <thead>
                                                <tr>
                                                    <th key="0">Name</th>
                                                    <th key="1">Organizational units</th>
                                                    <th key="2">Institutions</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {tableBody}
                                            </tbody>
                                        </table>
                                    </div>
                                    <Pagination total={this.props.identityAllData.length} page={this.state.page}
                                                count={this.state.count}
                                                onChange={this.handlePaginationUpdate}/>
                                </React.Fragment>
                            </div>
                        </div>
                    </div>
                    <div className="footer-position">
                        <Footer />
                    </div>
                </div>
            );
        }
    }
}


function List(props) {
    if(props.list === undefined || props.list === null) {
        return null
    } 
    let listArray = []
    if(props.orgUnit === "true") {
        props.list.map((item, idx) => {
            listArray.push(<li key={idx}>{item.organizationalUnitLabel}</li>)
        })
    } else {
        props.list.map((item, idx) => {
            listArray.push(<li key={idx}>{item}</li>)
        })
    }
    return(
        (<ul>{listArray}</ul>)
    )
}

function Name(props) {
    let nameArray = []
    let imageUrl = ''
    if(props.identity.identityImageEndpoint !== undefined) {
        if(props.identity.identityImageEndpoint.length > 0) 
            imageUrl = props.identity.identityImageEndpoint
        else
            imageUrl = '../images/generic-headshot.png'
    }
    if(props.identity.primaryName !== undefined) {
        const nameString = props.identity.primaryName.firstName + ((props.identity.primaryName.middleName !== undefined) ? ' ' + props.identity.primaryName.middleName + ' ' : ' ') + props.identity.primaryName.lastName
        nameArray.push(<p key="0"><img src={`${imageUrl}`} width="80" style={{float: "left"}}/> <a href={`/app/${props.identity.uid}`} target="_blank">
            {nameString}
            </a></p>)
        
    }
    if(props.identity.title !== undefined) {
        nameArray.push(<p key="1"><span>{props.identity.title}</span></p>)
    }
    return (
        nameArray
    )
}

function mapStateToProps(state) {
    return {
        identityAllData: state.identityAllData,
        identityAllFetching: state.identityAllFetching,
        errors: state.errors,
        auth: state.auth
    }
}

export default connect(mapStateToProps, { identityFetchAllData })(Search)
