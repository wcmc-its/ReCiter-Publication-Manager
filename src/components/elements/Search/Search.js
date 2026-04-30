import React, { useState, useEffect, useRef } from "react";
import { identityFetchAllData, curateIdsFromSearch, identityFetchPaginatedData, updateFilters, clearFilters, updateFilteredIds, updateFilteredIdentities, identityClearAllData, F, updateIndividualPersonReportCriteria, showEvidenceByDefault, updateAuthorFilter, updateScopeFilter } from '../../../redux/actions/actions'
import styles from './Search.module.css'
import { useSelector, useDispatch } from "react-redux";
import { useRouter } from "next/router";
import Pagination from '../Pagination/Pagination';
import appStyles from '../App/App.module.css';
import publicationStyles from '../Publication/Publication.module.css';
import { useSession } from 'next-auth/client';
import SearchBar from "./SearchBar";
import FilterReview from "./FilterReview";
import ScopeFilterCheckbox from './ScopeFilterCheckbox';
import fetchWithTimeout from "../../../utils/fetchWithTimeout";
import { Table,Button} from "react-bootstrap";
import SkeletonTable from "../Common/SkeletonTable";
import { reciterConfig } from "../../../../config/local";
import { useHistory } from "react-router-dom";
import { allowedPermissions, allowedSettings, dropdownItemsReport, dropdownItemsSuper, numberFormation, getCapabilities } from "../../../utils/constants"
import { isPersonInScope, isProxyFor } from '../../../utils/scopeResolver';
import ProxyBadge from './ProxyBadge';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import Tooltip from '@mui/material/Tooltip';
//import {RoleManagerHelper} from  "../../../utils/RoleManagerHelper"

const Search = () => {

  const [session, loading] = useSession();

  const router = useRouter()
  const history = useHistory();
  const dispatch = useDispatch()

  const identityAllData = useSelector((state) => state.identityAllData)
  const identityAllFetching = useSelector((state) => state.identityAllFetching)

  const identityPaginatedData = useSelector((state) => state.identityPaginatedData)
  const identityPaginatedFetching = useSelector((state) => state.identityPaginatedFetching)
  const filters = useSelector((state) => state.filters)
  const updatedAdminSettings = useSelector((state) => state.updatedAdminSettings)


  const errors = useSelector((state) => state.errors)


  const [sort, setSort] = useState("0")
  const [identitySearch, setIdentitySearch] = useState("")
  const [identityData, setIdentityData] = useState([])

  const [search, setSearch] = useState("")
  const [isUserRole, setIsuserRole] = useState([])

  const [page, setPage] = useState(1)
  const [count, setCount] = useState(20)
  const [filterByPending, setFilterByPending] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  const [countAllData, setCountAllData] = useState(0);
  const [isCountLoading, setIsCountLoading] = useState(false);

  const[dropdownTitle, setDropdownTitle] = useState("");
  const[dropdownMenuItems, setDropdownMenuItems] = useState([]);
  const[isCuratorSelf ,setIsCuratorSelf] = useState(false);
  const[isCuratorAll ,setIsCuratorAll] = useState(false);
  const[isReporterAll ,setIsReporterAll] = useState(false);
  const[isSuperUser ,setIsSuperUser] = useState(false);
  const[loggedInPersonIdentifier, setLoggedInPersonIdentifier] = useState("");
  const [findPeopleLabels, setFindPeopleLabels] = useState([])
  const [nameOrcwidLabel, setNameOrcwidLabel] = useState()

  // Scope filter state from Redux
  const showOnlyScopeFiltered = useSelector((state) => state.showOnlyScopeFiltered);

  // Derive scope capabilities from session
  const userRoles = session?.data?.userRoles ? JSON.parse(session.data.userRoles) : [];
  const caps = getCapabilities(userRoles);
  const scopeData = session?.data?.scopeData ? JSON.parse(session.data.scopeData) : null;
  const proxyPersonIds = session?.data?.proxyPersonIds
    ? JSON.parse(session.data.proxyPersonIds)
    : [];
  const showScopeCheckbox = caps.canCurate.scoped && !caps.canCurate.all;

  //ref
  const searchValue = useRef()

  useEffect(() => {
    dispatch(showEvidenceByDefault(null))

    dispatch(clearFilters())
    let adminSettings = JSON.parse(session.adminSettings);
    var viewAttributes = [];
    if (updatedAdminSettings.length > 0) {
      // updated settings from manage settings page
      let updatedData = updatedAdminSettings.find(obj => obj.viewName === "findPeople")
      viewAttributes = typeof updatedData.viewAttributes === "string"
        ? JSON.parse(updatedData.viewAttributes)
        : updatedData.viewAttributes;

      let cwidLabel = viewAttributes.find(data => data.labelUserKey === "personIdentifier")
      setNameOrcwidLabel(cwidLabel)
    } else {
      // regular settings from session
      let data = adminSettings.find(obj => obj.viewName === "findPeople")
      viewAttributes = JSON.parse(data.viewAttributes)
      let cwidLabel = viewAttributes.find(data => data.labelUserKey === "personIdentifier")
      setNameOrcwidLabel(cwidLabel)
    }

    // view attributes data from session or updated settings
    setFindPeopleLabels(viewAttributes)

    let userPermissions = JSON.parse(session.data.userRoles);

    // Use capability model from Plan 01
    const caps = getCapabilities(userPermissions);
    setIsCuratorSelf(caps.canCurate.self && !caps.canCurate.all);
    setIsCuratorAll(caps.canCurate.all);
    setIsReporterAll(caps.canReport);
    setIsSuperUser(caps.canManageUsers);

    if (caps.canCurate.self && !caps.canCurate.all) {
      setLoggedInPersonIdentifier(caps.canCurate.personIdentifier);
    }

    // UIBUG-01: No "Curate publications" in dropdown for ANY user
    // Dropdown shows only "Create Reports" as a simple button
    setDropdownTitle("Create Reports");
    setDropdownMenuItems([]);

    // if (identityAllData.length === 0) {
      fetchPaginatedData()
      fetchCount()
    // }
  }, [])

  // Pre-check scope filter from query param (e.g., from "Curate Publications" nav link)
  useEffect(() => {
    if (router.query.scopeFilter === 'true' && showScopeCheckbox) {
      dispatch(updateScopeFilter(true));
    }
  }, [router.query.scopeFilter])

  const handleScopeFilterChange = (checked) => {
    dispatch(updateScopeFilter(checked));
    // Re-fetch with scope filter applied
    if (checked && scopeData) {
      let scopeFilters = {};
      if (scopeData.personTypes) {
        scopeFilters = { ...scopeFilters, personTypes: scopeData.personTypes };
      }
      if (scopeData.orgUnits) {
        scopeFilters = { ...scopeFilters, orgUnits: scopeData.orgUnits };
      }
      // Include proxy matches via OR logic
      if (proxyPersonIds.length > 0) {
        scopeFilters = { ...scopeFilters, proxyPersonIds: proxyPersonIds };
      }
      let updatedFilters = { ...filters, ...scopeFilters };
      let request = {
        filters: { ...updatedFilters },
        limit: count,
        offset: 0
      };
      dispatch(updateFilters(updatedFilters));
      dispatch(identityFetchAllData(request));
      setPage(1);
    } else if (!checked) {
      // Reset to unfiltered paginated data
      dispatch(clearFilters());
      fetchPaginatedData();
      fetchCount();
    }
  };

  const fetchIdentityData = () => {
    dispatch(identityFetchAllData(filters));
  }

  const fetchPaginatedData = (newCount) => {
    const options = showScopeCheckbox ? { includeScopeData: true } : {};
    dispatch(identityFetchPaginatedData(page, newCount ? newCount : count, filters, options))
  }


  const handlePaginationUpdate = (page) => {
    setPage(page)

    if (Object.keys(filters).length === 0) {
      const options = showScopeCheckbox ? { includeScopeData: true } : {};
      dispatch(identityFetchPaginatedData(page, count, filters, options))
    }
  }

  const handleCountUpdate = (count) => {
    if (count) {
      setPage(page);
      setCount(parseInt(count));
      fetchPaginatedData(parseInt(count))
    }
  }

  const filter = () => {

      return {
        paginatedIdentities: identityPaginatedData?.persons
      }
  }

  const fetchCount = () => {
    setIsCountLoading(true);
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
        if (response.status === 200) {
          return response.json()
        } else {
          throw {
            type: response.type,
            title: response.statusText,
            status: response.status,
            detail: "Error occurred with api " + response.url + ". Please, try again later "
          }
        }
      })
      .then(data => {
        if (data.countPersonIdentifier) {
          setTotalCount(data.countPersonIdentifier);
          setCountAllData(data.countPersonIdentifier);
        }
        setIsCountLoading(false);
      })
      .catch(error => {
        console.log(error)
        setIsCountLoading(false);
      })
  }

  const fullName = (person) => {
    let userName = "";
    if (person !== undefined) {
      if (person.firstName !== undefined) {
        userName += person.firstName + ' ';
      }
      if (person.middleName !== undefined) {
        userName += person.middleName + ' ';
      }
      if (person.lastName !== undefined) {
        userName += person.lastName + ' ';
      }
    }
    return userName;
  }

  const searchData = (searchText, orgUnits, institutions, personTypes) => {
    setIdentitySearch(searchText)
    let updatedFilters = {}

    if (!searchText && !orgUnits.length && !institutions.length && !personTypes.length) {
      setTotalCount(countAllData);
    }
    if (searchText) {
      let searchWords = searchText.trim().split(' ');
      dispatch(updateAuthorFilter(searchWords.join(),10));

      updatedFilters = { ...updatedFilters, nameOrUids: searchWords };
    }

    if (orgUnits && orgUnits.length) {
      updatedFilters = { ...updatedFilters, orgUnits: [...orgUnits] };
    }

    if (institutions && institutions.length) {
      updatedFilters = { ...updatedFilters, institutions: [...institutions] };
    }

    if (personTypes && personTypes.length) {
      updatedFilters = { ...updatedFilters, personTypes: [...personTypes] };
    }

    // Apply scope filters when scope checkbox is checked
    if (showOnlyScopeFiltered && scopeData) {
      if (scopeData.personTypes) {
        updatedFilters = { ...updatedFilters, personTypes: scopeData.personTypes };
      }
      if (scopeData.orgUnits) {
        updatedFilters = { ...updatedFilters, orgUnits: scopeData.orgUnits };
      }
      // Include proxy matches via OR logic
      if (proxyPersonIds.length > 0) {
        updatedFilters = { ...updatedFilters, proxyPersonIds: proxyPersonIds };
      }
    }

    let request = {
      filters: { ...updatedFilters },
      limit:count,
      offset: page - 1
    }

    dispatch(updateFilters(updatedFilters));
    dispatch(identityFetchAllData(request));
    setPage(1);
  }

  const handlePendingFilterUpdate = (value) => {
    const filterPending = value ? value : false;
    setFilterByPending(filterPending);
    let updatedFilters = { ...filters, showOnlyPending: filterPending };
    let request = {
      filters: { ...updatedFilters },
      limit:count,
      offset: page - 1 
    }
    dispatch(updateFilters(updatedFilters));
    dispatch(identityFetchAllData(request));
    setPage(1);
  }

  const onClickProfile = (personIdentifier) => {
    router.push(`/curate/${personIdentifier}`);
    if (identityAllData && !identityAllFetching) {
      dispatch(identityClearAllData())
      dispatch(clearFilters())
    }
  }

  const resetData = () => {
    dispatch(clearFilters())
    fetchPaginatedData()
    fetchCount()
  }

  const identities = filter()

  if (errors && errors.length > 0) {
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

  // Spinner for when Search gets updated
  const isDisplayLoader = () => {
    if ((!filtersOn && (identityPaginatedFetching || isCountLoading) && page === 1) ||
      (!filtersOn && identityPaginatedData?.persons?.length <= 0) ||
      (filtersOn && identityAllFetching)) {
      return true;
    } else {
      return false;
    }
  }

  const redirectToCurate = (isFor, data) => {

    // if()
    if (isFor === "individual") {
      router.push({
        pathname: `/curate/${data}`,
      })
    } else if (isFor === "report") {
      data.personIdentifier && dispatch(updateAuthorFilter(data.personIdentifier,10));
      
      dispatch(updateIndividualPersonReportCriteria(data));
      router.push({
        pathname: '/report',
      })
    } else {
      dispatch(curateIdsFromSearch(identities.paginatedIdentities))
      router.push({
        pathname: '/curate',
      })
    }
  }

  // Spinner when navigating between pages
  const isDisplayLoaderTable = () => {
    if (!filtersOn && identityPaginatedFetching) {
      return true;
    }
    return false;
  }
  
  const RoleSplitDropdown = (identity) => {
    // UIBUG-01: "Curate publications" removed from dropdown for ALL users
    // Remaining action: Create Reports button only
    return (
      <Button
        className="secondary"
        variant="secondary"
        onClick={() => redirectToCurate("report", identity.identity)}
      >
        {"Create Reports"}
      </Button>
    );
  }



  // if filters are applied load all data, if not load paginated data
  let filtersOn = Object.keys(filters).length === 0 ? false : true;
  let tableBody;
  let paginatedIdentities = identities.paginatedIdentities;
  if (paginatedIdentities?.length > 0) {
    // setCurateIds(paginatedIdentities);
    tableBody = paginatedIdentities.map(function (identity, identityIndex) {
      // Determine if this person is in scope for scoped curators
      const personInScope = caps.canCurate.all || isSuperUser || (caps.canCurate.scoped && scopeData && isPersonInScope(
        scopeData,
        identity.primaryOrganizationalUnit,
        identity.PersonPersonTypes?.map(pt => pt.personType) || []
      )) || isProxyFor(proxyPersonIds, identity.personIdentifier);

      // Name click handler: in-scope goes to curate, out-of-scope goes to report
      const handleNameClick = () => {
        if (isCuratorSelf && identity.personIdentifier !== loggedInPersonIdentifier) {
          redirectToCurate("report", identity);
        } else if (caps.canCurate.all || isSuperUser || (caps.canCurate.scoped && personInScope)) {
          onClickProfile(identity.personIdentifier);
        } else {
          redirectToCurate("report", identity);
        }
      };

      return <tr key={identityIndex}>
        <td key={`${identityIndex}__name`} width="30%">
          <Name identity={identity} nameOrcwidLabel={nameOrcwidLabel?.labelUserView} onClickProfile={handleNameClick} isProxy={isProxyFor(proxyPersonIds, identity.personIdentifier)}></Name>
        </td>
        <td key={`${identityIndex}__orgUnit`} width="20%">
          {identity.primaryOrganizationalUnit && <div>{identity.primaryOrganizationalUnit}</div>}
        </td>
        <td key={`${identityIndex}__institution`} width="20%">
          {identity.primaryInstitution && <div>{identity.primaryInstitution}</div>}
        </td>
        {isCuratorAll || isSuperUser  ?
        <td key={`${identityIndex}__pending`} width="10%">
          {identity.countPendingArticles && <div>{identity.countPendingArticles}</div>}
        </td>
         : ""}
        <td key={`${identityIndex}__dropdown`} width="20%">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {personInScope && (caps.canCurate.all || caps.canCurate.scoped || isSuperUser) && (
              <Tooltip title="Curate publications">
                <EditOutlinedIcon
                  titleAccess="Curate publications"
                  sx={{ color: '#337ab7', fontSize: 20, cursor: 'pointer', minWidth: 44, minHeight: 44, padding: '12px' }}
                  onClick={() => router.push(`/curate/${identity.personIdentifier}`)}
                />
              </Tooltip>
            )}
            <RoleSplitDropdown identity={identity}></RoleSplitDropdown>
          </div>
        </td>
      </tr>;
    })
  } else {
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

  const totalCountUpdated = identityPaginatedData?.totalPersonsCount?.length ?? 0 
  return (
    <div className={appStyles.mainContainer}>
      <div className={styles.searchContentContainer}>
        <div className={styles.searchBar}>
          <h1>Find People</h1>
          <SearchBar searchData={searchData} resetData={resetData} findPeopleLabels = {findPeopleLabels}/>
          {(isDisplayLoader()) ?
            (
              <SkeletonTable />
            ) : (
              <div>
                <br />
                {!filtersOn &&
                  <div className="row">
                    <div className="col-md-4">
                      <h3><strong>{ numberFormation(totalCountUpdated)}</strong> people</h3>
                    </div>
                  </div>}
                {showScopeCheckbox && (
                  <ScopeFilterCheckbox
                    checked={showOnlyScopeFiltered}
                    onChange={handleScopeFilterChange}
                  />
                )}
                {filtersOn && <FilterReview count={totalCountUpdated}  onCurate={redirectToCurate} filterByPending={filterByPending} onToggle={handlePendingFilterUpdate} showPendingToggle = {isCuratorAll || isSuperUser} />}
                <React.Fragment>
                  <Pagination total={totalCountUpdated} page={page}
                    count={count}
                    onChange={handlePaginationUpdate}
                    onCountChange={handleCountUpdate}
                  />
                  {isDisplayLoaderTable() ? <SkeletonTable /> :
                    <div className="table-responsive">
                      <Table className={`${publicationStyles.h6fnhWdegPublicationsEvidenceTable} ${styles.table} table`}>
                        <thead>
                          <tr>
                            <th key="0">Name</th>
                            <th key="1">Organization</th>
                            <th key="2">Institution</th>
                            {isCuratorAll || isSuperUser  ? <th key="3">Pending</th> : ""}
                            <th key="4">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {tableBody}
                        </tbody>
                      </Table>
                    </div>
                  }
                  <Pagination total={totalCountUpdated} page={page}
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
  if (props.identity.identityImageEndpoint !== undefined) {
    if (props.identity.identityImageEndpoint.length > 0)
      imageUrl = props.identity.identityImageEndpoint
    else
      imageUrl = '../../../images/generic-headshot.png'
  }
  let firstName = props.identity.firstName ?? ''
  let middleName = props.identity.middleName ?? ''
  let lastName = props.identity.lastName ?? ''
  

  if (props.identity.firstName !== undefined ) {
    const nameString = `${firstName}  ${middleName} ${lastName}`
    nameArray.push(<p key="0"> <button className={`text-btn ${styles.btnLink}`} onClick={props.onClickProfile}>
      <b>{nameString}</b>
    </button>
      {props.isProxy && <ProxyBadge />}
      <br />
      {props.identity.title && <>{props.identity.title}<br /></>}
      {props.nameOrcwidLabel}: {props.identity.personIdentifier}</p>)

  }
  if (props.title) {
    nameArray.push(<p key="1"><span>{props.title}</span></p>)
  }
  return (
    nameArray
  )
}

export default Search
