import React, { useState, useEffect, useRef } from "react";
import { Button, Form } from "react-bootstrap";
import 'bootstrap/dist/css/bootstrap.min.css';
import { identityFetchAllData } from '../../../redux/actions/actions'
import styles from './Search.module.css'
import Header from "../Header/Header";
import { Footer } from "../Footer/Footer";
import { useSelector, useDispatch } from "react-redux";
import { useRouter } from "next/router";
import Pagination  from '../Pagination/Pagination';
import Image from 'next/image';
import appStyles from '../App/App.module.css';
import publicationStyles from '../Publication/Publication.module.css';



const Search = () => {

    const router = useRouter()
    const dispatch = useDispatch()

    const identityAllData = useSelector((state) => state.identityAllData)
    const identityAllFetching = useSelector((state) => state.identityAllFetching)
    const errors = useSelector((state) => state.errors)
    const auth = useSelector((state) => state.auth)

    const [sort, setSort] = useState("0")
    const [identitySearch, setIdentitySearch] = useState("")
    const [identityData, setIdentityData] = useState([])
    const [search, setSearch] = useState("")
    const [page, setPage] = useState(1)
    const [count, setCount] = useState(20)

    //ref
    const searchValue = useRef()

    useEffect(() => {
        dispatch(identityFetchAllData())
    },[])


    const handlePaginationUpdate = (e, page) => {
        setPage(page)
        if (e.target.value !== undefined) {
            setCount(e.target.value)
        }
    }

    const handleSearchUpdate = e => {
        setIdentitySearch(e.target.value)
    }

    const handleFilterUpdate = filterState => {
        setSearch(filterState.search)
        setPage(1)
    }

    const handleRedirect = uid => {
        return router.push('/app/' + uid)
    }

    const filter = () => {
        var from = (parseInt(page, 10) - 1) * parseInt(count, 10);
        var to = from + parseInt(count, 10) - 1;
        var identities = [];
        var i = from;
        for (i; i <= to; i++) {
            if(identityData !== undefined && identityData.length > 0) {
                if (identityData[i] !== undefined) {
                    identities.push(identityData[i]);
                }
            } else {
                if (identityAllData[i] !== undefined) {
                    identities.push(identityAllData[i]);
                }
            }
            
        }
        return {
            paginatedIdentities: identities
        }
    }

    const searchData = () => {
        const searchText = searchValue.current.value
        setIdentityData(identityAllData)
        setIdentitySearch(searchText)
        if(identityAllData !== undefined) {
            console.log(searchResults)
            var searchResults = []
            searchResults = identityAllData.filter(identity => {
                if(identity.uid === searchText 
                    || 
                    identity.primaryName.firstName.toLowerCase().includes(searchText.toLowerCase())
                    ||
                    identity.primaryName.lastName.toLowerCase().includes(searchText.toLowerCase())) {
                    return identity
                }
            })
            console.log(searchResults)
            setIdentityData(searchResults)
        }
        
    }

    const identities = filter()

    if(errors && errors.length > 0) {
        return (
            <div className={appStyles.mainContainer}>

                {/* <div className="side-nav-position">
                    <SideNav uid={this.props.match.params.uid} history={this.props.history} />
                </div> */}
                <div>
                    {/* <Error {...errors} /> */}
                </div>
                
            </div>
        );
    }
    if (identityAllData.length <= 0) {
        return (
                <div className={appStyles.h6fnhWdegAppLoader}> </div>
        );
    } else {
        //const thisObject = this
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
            <div className={appStyles.mainContainer}>
                {/* <div className="side-nav-position">
                    <SideNav uid={this.props.match.params.uid} history={this.props.history} />
                </div> */}
                <div className={styles.searchContentContainer}>
                    <div className={styles.searchBar}>
                        <h1>Find a scholar(s)</h1>
                        <Form.Group controlId="formSearch">
                            <Form.Control
                                type="input"
                                placeholder="Enter name or person identifier"
                                ref={searchValue}
                            />
                        </Form.Group>
                        <Button className="primary" onClick={searchData} >Search</Button>
                        <div>
                            <br/>
                            <div className="row">
                                <div className="col-md-4">
                                    <h3>Number of results: <strong>{(identityData !==undefined && identityData.length > 0)?identityData.length: identityAllData.length}</strong></h3>
                                </div>
                            </div>
                            <React.Fragment>
                                <Pagination total={(identityData.length > 0 && identitySearch.length > 0)? identitySearch.length: identityAllData.length} page={page}
                                            count={count}
                                            onChange={handlePaginationUpdate}/>
                                <div className="table-responsive">
                                    <table className={`${publicationStyles.h6fnhWdegPublicationsEvidenceTable} table table-striped`}>
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
                                <Pagination total={(identityData.length > 0 && identitySearch.length > 0)? identitySearch.length: identityAllData.length} page={page}
                                            count={count}
                                            onChange={handlePaginationUpdate}/>
                            </React.Fragment>
                        </div>
                    </div>
                </div>
            </div>
        );
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
            imageUrl = '../../../images/generic-headshot.png'
    }
    if(props.identity.primaryName !== undefined) {
        const nameString = props.identity.primaryName.firstName + ((props.identity.primaryName.middleName !== undefined) ? ' ' + props.identity.primaryName.middleName + ' ' : ' ') + props.identity.primaryName.lastName
        nameArray.push(<p key="0"><img src={`${imageUrl}`} width="80" style={{float: "left"}} alt="Headshot"/> <a href={`/app/${props.identity.uid}`} target="_blank" rel="noreferrer">
            <b>{nameString}</b>
            </a></p>)
        
    }
    if(props.identity.title !== undefined) {
        nameArray.push(<p key="1"><span>{props.identity.title}</span></p>)
    }
    return (
        nameArray
    )
}



export default Search