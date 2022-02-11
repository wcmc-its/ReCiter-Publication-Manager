import React, { useState, useEffect, useRef } from "react";
import { identityFetchAllData, identityFetchPaginatedData, updateFilters, updateFilteredIds, updateFilteredIdentities, identityClearAllData } from '../../../redux/actions/actions'
import styles from './Search.module.css'
import { useSelector, useDispatch } from "react-redux";
import { useRouter } from "next/router";
import Pagination  from '../Pagination/Pagination';
import appStyles from '../App/App.module.css';
import publicationStyles from '../Publication/Publication.module.css';
import { useSession } from 'next-auth/client';
import SearchBar from "./SearchBar";
import FilterReview from "./FilterReview";
import fetchWithTimeout from "../../../utils/fetchWithTimeout";
import { Table } from "react-bootstrap";
import SplitDropdown from "../Dropdown/SplitDropdown";
import Loader from "../Common/Loader";
import { reciterConfig } from "../../../../config/local";

const dropdownItems =  [
  { title: 'Create Reports', to: '/create-reports'},
  { title: 'Perform Analysis', to: '/perform-analysis'},
]

const Search = () => {

    const [session,loading] = useSession();
    const router = useRouter()
    const dispatch = useDispatch()

    const identityAllData = useSelector((state) => state.identityAllData)
    const identityAllFetching = useSelector((state) => state.identityAllFetching)
    const identityPaginatedData = useSelector((state) => state.identityPaginatedData)
    const identityPaginatedFetching = useSelector((state) => state.identityPaginatedFetching)
    const filters = useSelector((state) => state.filters)
    const errors = useSelector((state) => state.errors)
    const auth = useSelector((state) => state.auth)

    const [sort, setSort] = useState("0")
    const [identitySearch, setIdentitySearch] = useState("")
    const [identityData, setIdentityData] = useState([])
    const [search, setSearch] = useState("")
    const [page, setPage] = useState(1)
    const [count, setCount] = useState(20)
    const [filterByPending, setFilterByPending] = useState(false);
    const [totalCount, setTotalCount] = useState(0);

    //ref
    const searchValue = useRef()

    useEffect(() => {
        // dispatch(identityFetchPaginatedData(page, count))
        fetchPaginatedData()
        fetchCount()
        // fetchIdentityData()

        // if (Object.keys(filters).length > 0 && identityData.length === 0) {
        //   let searchText = filters.searchText ? filters.searchText : "";
        //   let orgUnits = filters.orgUnits ? filters.orgUnits : [];
        //   let institutions = filters.institutions ? filters.institutions : [];
        //   let personTypes = filters.personTypes ? filters.personTypes : [];
        //   searchData(searchText, orgUnits, institutions, personTypes);
        // }
    },[])

    const fetchIdentityData = () => {
      dispatch(identityFetchAllData(filters));
    }

    const fetchPaginatedData = () => {
      dispatch(identityFetchPaginatedData(page, count))
    }


    const handlePaginationUpdate = ( page ) => {
        setPage(page)

        if (Object.keys(filters).length === 0) {
          dispatch(identityFetchPaginatedData(page, count))
        }
    }

    const handleCountUpdate = (count) => {
      if (count) {
        setPage(1);
        setCount(parseInt(count));
      }
    }

    const filter = () => {

      if (Object.keys(filters).length === 0)  {
        return {
          paginatedIdentities: identityPaginatedData
        }
      } else {
        var from = (parseInt(page, 10) - 1) * parseInt(count, 10);
        var to = from + parseInt(count, 10) - 1;
        var identities = [];
        var i = from;
        for (i; i <= to; i++) {
            if(identityAllData !== undefined && identityAllData.length > 0) {
                if (identityAllData[i] !== undefined) {
                    identities.push(identityAllData[i]);
                }
            } 
        }
        return {
            paginatedIdentities: identities
        }
      }
    }

    const fetchCount = () => {
      fetchWithTimeout('/api/db/users/count', {
        credentials: "same-origin",
        method: 'GET',
        headers: {
            Accept: 'application/json',
            "Content-Type": "application/json",
            'Authorization': reciterConfig.backendApiKey,
        }
      }, 300000)
      .then(response => {
          if(response.status === 200) {
              return response.json()
          }else {
              throw {
                  type: response.type,
                  title: response.statusText,
                  status: response.status,
                  detail: "Error occurred with api " + response.url + ". Please, try again later "
              }
          }
      })
      .then(data => {
        if (data.countPersonIdentifier && Object.keys(filters).length === 0) {
          setTotalCount(data.countPersonIdentifier);
        }
      }) 
      .catch(error => {
          console.log(error)
      })
    }

    const fullName = (person) => {
      let userName = "";
      if(person !== undefined) {
          if(person.firstName !== undefined) {
            userName += person.firstName + ' ';
          }
          if(person.middleName !== undefined) {
            userName += person.middleName + ' ';
          }
          if(person.lastName !== undefined) {
            userName += person.lastName + ' ';
          }
      }
      return userName; 
    }

    const searchData = (searchText, orgUnits, institutions, personTypes) => {
        setIdentitySearch(searchText)
        let updatedFilters = {}
        if (searchText) {
          let searchWords = searchText.split(' ');
          updatedFilters = { ...updateFilters, nameOrUids: searchWords};
        }

        if (orgUnits && orgUnits.length) {
          updatedFilters = { ...updateFilters, orgUnits: [...orgUnits]};
        }

        if (institutions && institutions.length) {
          updatedFilters = { ...updateFilters, institutions: [...institutions]};
        }

        if (personTypes && personTypes.length) {
          updatedFilters = { ...updateFilters, personTypes: [...personTypes]};
        }

        let request = {
          filters: {...updatedFilters}
        }

        dispatch(updateFilters(updatedFilters));
        dispatch(identityFetchAllData(request));
        setPage(1);

        // TODO: update filteredIds & filteredIdentities
        // setTotalCount 
        /*
        dispatch(updateFilteredIds(filteredIds));
            dispatch(updateFilteredIdentities(filteredIdentities))
            */
    }

    const handlePendingFilterUpdate = (value) => {
      const filterPending = value ? value : false;
      setFilterByPending(filterPending);
      let updatedFilters = {...filters, showOnlyPending: filterPending};
      let request = {
        filters: {...updatedFilters}
      }
      dispatch(identityFetchAllData(request));
      dispatch(updateFilters(updatedFilters));
      setPage(1);
    }

    const onCLickProfile = (personIdentifier) => {
      router.push(`/curate/${personIdentifier}`);
      if (identityAllData && !identityAllFetching) {
        dispatch(identityClearAllData())
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

    const isDisplayLoader = () => {
      if ((!filtersOn && identityPaginatedFetching && page === 1) ||
        (!filtersOn && identityPaginatedData.length <= 0 ) || 
        (filtersOn && identityAllFetching)) {
          return true;
        } else {
          return false;
       }
    }
    // if filters are applied load all data, if not load paginated data
    let filtersOn = Object.keys(filters).length === 0 ? false : true;
    let tableBody;
    let paginatedIdentities = identities.paginatedIdentities;
    if (paginatedIdentities.length > 0)  {
      tableBody = paginatedIdentities.map(function (identity, identityIndex) {
        return <tr key={identityIndex}>
            <td key={`${identityIndex}__name`} width="30%">
                <Name identity={identity} onCLickProfile={() => onCLickProfile(identity.personIdentifier)}></Name>
            </td>
            <td key={`${identityIndex}__orgUnit`} width="20%">
                {identity.primaryOrganizationalUnit && <div>{identity.primaryOrganizationalUnit}</div>}
            </td>
            <td key={`${identityIndex}__institution`} width="20%">
                {identity.primaryInstitution && <div>{identity.primaryInstitution}</div>}
            </td>
            <td key={`${identityIndex}__pending`} width="10%">
                {identity.countPendingArticles && <div>{identity.countPendingArticles}</div>}
            </td>
            <td key={`${identityIndex}__dropdown`} width="20%">
              <SplitDropdown
                title='Curate Publications'
                to={`/app/${identity.personIdentifier}`}
                id={`curate-publications_${identity.personIdentifier}`}
                listItems={dropdownItems}
                secondary={true}
                />
            </td>
        </tr>;
    }) } else {
      tableBody = (
        <tr>
          <td colSpan="5">
              <p className={styles.noitemsList}>
                  No records found
              </p>
          </td>
        </tr>
      )
      
    } 
    return (
        <div className={appStyles.mainContainer}>
            {/* <div className="side-nav-position">
                <SideNav uid={this.props.match.params.uid} history={this.props.history} />
            </div> */}
            <div className={styles.searchContentContainer}>
                <div className={styles.searchBar}>
                  <h1>Find People</h1>
                  <SearchBar searchData={searchData}/>
                  { (isDisplayLoader()) ? 
                   (
                     <Loader />
                   ) : (
                      <div>
                        <br/>
                        {!filtersOn && 
                          <div className="row">
                            <div className="col-md-4">
                                <h3><strong>{totalCount.toLocaleString("en-US")}</strong> people</h3>
                            </div>
                          </div>}
                        {filtersOn && <FilterReview count={identityAllData.length} filterByPending={filterByPending} onToggle={handlePendingFilterUpdate}/>}
                        <React.Fragment>
                          {

                          }
                            <Pagination total={filtersOn ? identityAllData.length : totalCount} page={page}
                                        count={count}
                                        onChange={handlePaginationUpdate}
                                        onCountChange={handleCountUpdate}
                                        />
                            <div className="table-responsive">
                                <Table className={`${publicationStyles.h6fnhWdegPublicationsEvidenceTable} ${styles.table} table`}>
                                    <thead>
                                        <tr>
                                            <th key="0">Name</th>
                                            <th key="1">Organization</th>
                                            <th key="2">Institution</th>
                                            <th key="3">Pending</th>
                                            <th key="4">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {tableBody}
                                    </tbody>
                                </Table>
                            </div>
                            <Pagination total={filtersOn ? identityAllData.length : totalCount} page={page}
                                        count={count}
                                        onChange={handlePaginationUpdate}
                                        onCountChange={handleCountUpdate}
                                        />
                        </React.Fragment>
                      </div>
                   )
                  }
                </div>
            </div>
        </div>
    );
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
    if(props.identity.firstName !== undefined) {
        const nameString = props.identity.firstName + ((props.identity.middleName !== undefined) ? ' ' + props.identity.middleName + ' ' : ' ') + props.identity.lastName
        nameArray.push(<p key="0"> <button className={`text-btn ${styles.btnLink}`} onClick={props.onCLickProfile}>
            <b>{nameString}</b>
            </button>
            <br />
            {props.identity.title && <>{props.identity.title}<br /></>}
            CWID: {props.identity.personIdentifier}</p>)
        
    }
    if(props.title !== undefined) {
        nameArray.push(<p key="1"><span>{props.title}</span></p>)
    }
    return (
        nameArray
    )
}



export default Search
