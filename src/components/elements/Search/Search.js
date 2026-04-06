import React, { useState, useEffect, useRef } from "react";
import { identityFetchAllData, curateIdsFromSearch, identityFetchPaginatedData, updateFilters, clearFilters, updateFilteredIds, updateFilteredIdentities, identityClearAllData, F, updateIndividualPersonReportCriteria, showEvidenceByDefault, updateAuthorFilter } from '../../../redux/actions/actions'
import styles from './Search.module.css'
import { useSelector, useDispatch } from "react-redux";
import { useRouter } from "next/router";
import Pagination from '../Pagination/Pagination';
import appStyles from '../App/App.module.css';
import publicationStyles from '../Publication/Publication.module.css';
import { useSession } from 'next-auth/react';
import SearchBar from "./SearchBar";
import fetchWithTimeout from "../../../utils/fetchWithTimeout";
import { updatePubFiltersFromSearch } from "../../../redux/actions/actions";
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import { styled } from '@mui/material/styles';
import { Table,Button} from "react-bootstrap";
import SplitDropdown from "../Dropdown/SplitDropdown";
import Loader from "../Common/Loader";
import { reciterConfig } from "../../../../config/local";
import { allowedPermissions, allowedSettings, dropdownItemsReport, dropdownItemsSuper, numberFormation, getCapabilities } from "../../../utils/constants"
//import {RoleManagerHelper} from  "../../../utils/RoleManagerHelper"
import Profile from "../Profile/Profile";
import ProxyBadge from './ProxyBadge';
import ScopeFilterCheckbox from './ScopeFilterCheckbox';
import { isProxyFor } from '../../../utils/scopeResolver';

const Search = () => {

  const { data: session, status } = useSession(); const loading = status === "loading";

  // Phase 9: Parse scope/proxy data and derive capabilities
  const scopeData = session?.data?.scopeData ? JSON.parse(session.data.scopeData) : null;
  const proxyPersonIds = session?.data?.proxyPersonIds ? JSON.parse(session.data.proxyPersonIds) : [];
  const userRoles = session?.data?.userRoles ? JSON.parse(session.data.userRoles) : [];
  const caps = getCapabilities(userRoles);
  const showScopeFilter = caps.canCurate.scoped && !caps.canCurate.all;

  const router = useRouter()
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
  const [count, setCount] = useState(100)
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

  const [showProfile, setShowprofile] = useState(false);
  const [showProfileID, setShowprofileID] = useState("");
  const [headShot, setHeadShot] = useState([]);
  const [viewProfileLabels, setViewProfileLabels] = useState([])
  const [selectedAction, setSelectedAction] = useState("Curate Publications")
  const [scopeFilterChecked, setScopeFilterChecked] = useState(true); // Default checked for scoped curators (D-14)

  //ref
  const searchValue = useRef()

  useEffect(() => {
    dispatch(showEvidenceByDefault(null))
    dispatch(clearFilters())
    var viewAttributes = [];
    if (updatedAdminSettings.length > 0) {
      // updated settings from manage settings page
      let updatedData = updatedAdminSettings.find(obj => obj.viewName === "findPeople")
      viewAttributes = updatedData.viewAttributes;

      let cwidLabel = viewAttributes.find(data => data.labelUserKey === "personIdentifier")
      setNameOrcwidLabel(cwidLabel)
    } else if (session?.adminSettings) {
      // regular settings from session
      let adminSettings = JSON.parse(session.adminSettings);
      let data = adminSettings.find(obj => obj.viewName === "findPeople")
      viewAttributes = JSON.parse(data.viewAttributes)
      let cwidLabel = viewAttributes.find(data => data.labelUserKey === "personIdentifier")
      setNameOrcwidLabel(cwidLabel)
    }

    // view attributes data from session or updated settings
    setFindPeopleLabels(viewAttributes)

    let userPermissions = JSON.parse(session.data.userRoles);
    //RoleManagerHelper.showOrHideCurateReportMenu(userPermissions,allowedPermissions);
    if (userPermissions && userPermissions.length === 1 && userPermissions.some(role => role.roleLabel === allowedPermissions.Reporter_All)) {
        setDropdownTitle("Create Report");
        setDropdownMenuItems([]);
        setIsReporterAll(true);
        setLoggedInPersonIdentifier(userPermissions[0].personIdentifier);
    } else if (userPermissions && userPermissions.length === 1 && userPermissions.some(role => role.roleLabel === allowedPermissions.Curator_All)) {
        setDropdownTitle("Curate Publications");
        let dropDownMenuItems = [{ title: 'Create Reports', to: ''},{title: 'View Profile', to:''}];
        setDropdownMenuItems(dropDownMenuItems);
        setIsCuratorAll(true);
        setLoggedInPersonIdentifier(userPermissions[0].personIdentifier);
    }else if (userPermissions && userPermissions.length === 1 && userPermissions.some(role => role.roleLabel === allowedPermissions.Superuser)) {
        setDropdownTitle("Curate Publications");
        let dropDownMenuItems = [{ title: 'Create Reports', to: ''},{title: 'View Profile', to:''}];
        setDropdownMenuItems(dropDownMenuItems);
        setIsSuperUser(true)
        setLoggedInPersonIdentifier(userPermissions[0].personIdentifier);
    }
    else if (userPermissions && userPermissions.length === 1 && userPermissions.some(role => role.roleLabel === allowedPermissions.Curator_Self)) {
      setDropdownTitle("Curate Publications");
      setDropdownMenuItems([{title: 'View Profile', to:''}]);
      setIsCuratorSelf(true)
      setLoggedInPersonIdentifier(userPermissions[0].personIdentifier);
    }
    else if(userPermissions.some(role => role.roleLabel === allowedPermissions.Superuser ))
    {
      setDropdownTitle("Curate Publications");
      let dropDownMenuItems = [{ title: 'Create Reports', to: ''},{title: 'View Profile', to:''}];
      setDropdownMenuItems(dropDownMenuItems);
      setIsCuratorSelf(true);
      setIsReporterAll(true);
      setIsSuperUser(true);
      setIsCuratorAll(true);
      setLoggedInPersonIdentifier(userPermissions[0].personIdentifier);
    }
    else if (userPermissions.some(role => role.roleLabel === allowedPermissions.Curator_Self ) 
      && userPermissions.some(role => role.roleLabel === allowedPermissions.Reporter_All )
      && userPermissions.some(role => role.roleLabel === allowedPermissions.Superuser )) {
      setDropdownTitle("Curate Publications");
      let dropDownMenuItems = [{ title: 'Create Reports', to: ''},{title: 'View Profile', to:''}];
      setDropdownMenuItems(dropDownMenuItems);
      setIsCuratorSelf(true);
      setIsReporterAll(true);
      setIsSuperUser(true);
      setLoggedInPersonIdentifier(userPermissions[0].personIdentifier);
    } 
    else if (userPermissions.some(role => role.roleLabel === allowedPermissions.Curator_Self ) 
      && userPermissions.some(role => role.roleLabel === allowedPermissions.Reporter_All )
      && userPermissions.some(role => role.roleLabel === allowedPermissions.Curator_All )) {
      setDropdownTitle("Curate Publications");
      let dropDownMenuItems = [{ title: 'Create Reports', to: ''},{title: 'View Profile', to:''}];
      setDropdownMenuItems(dropDownMenuItems);
      setIsCuratorSelf(true);
      setIsReporterAll(true);
      setIsCuratorAll(true);
      setLoggedInPersonIdentifier(userPermissions[0].personIdentifier);
    }
    else if (userPermissions.some(role => role.roleLabel === allowedPermissions.Curator_All ) 
      && userPermissions.some(role => role.roleLabel === allowedPermissions.Reporter_All) 
      && userPermissions.some(role => role.roleLabel === allowedPermissions.Superuser  )) {
      setDropdownTitle("Curate Publications");
      let dropDownMenuItems = [{ title: 'Create Reports', to: ''},{title: 'View Profile', to:''}];
      setDropdownMenuItems(dropDownMenuItems);
      setIsReporterAll(true)  
      setIsCuratorAll(true);
      setIsSuperUser(true);
      setLoggedInPersonIdentifier(userPermissions[0].personIdentifier);
    }  
    else if (userPermissions.some(role => role.roleLabel === allowedPermissions.Curator_All ) 
      && userPermissions.some(role => role.roleLabel === allowedPermissions.Reporter_All )) {
        setDropdownTitle("Curate Publications");
        let dropDownMenuItems = [{ title: 'Create Reports', to: ''},{title: 'View Profile', to:''}];
        setDropdownMenuItems(dropDownMenuItems);
        setIsReporterAll(true)  
        setIsCuratorAll(true);
        setLoggedInPersonIdentifier(userPermissions[0].personIdentifier);
    }
    else if (userPermissions.some(role => role.roleLabel === allowedPermissions.Curator_Self ) 
      && userPermissions.some(role => role.roleLabel === allowedPermissions.Reporter_All )) {
      setDropdownTitle("Curate Publications");
      let dropDownMenuItems = [{ title: 'View Profile', to: ''}];
      setDropdownMenuItems(dropDownMenuItems);
      setIsCuratorSelf(true);
      setIsReporterAll(true)
      setLoggedInPersonIdentifier(userPermissions[0].personIdentifier);
    } 
    else if (userPermissions.some(role => role.roleLabel === allowedPermissions.Curator_Self )
    && userPermissions.some(role => role.roleLabel === allowedPermissions.Curator_All )) {
    setDropdownTitle("Curate Publications");
      let dropDownMenuItems = [{title: 'View Profile', to:''}];
      setDropdownMenuItems(dropDownMenuItems);
      setIsCuratorSelf(true);
      setIsCuratorAll(true)
      }
    // Phase 9: Curator_Scoped handling -- same dropdown behavior as Curator_All
    else if (userPermissions.some(role => role.roleLabel === allowedPermissions.Curator_Scoped)) {
      setDropdownTitle("Curate Publications");
      let dropDownMenuItems = [{ title: 'Create Reports', to: ''},{title: 'View Profile', to:''}];
      setDropdownMenuItems(dropDownMenuItems);
      setIsCuratorAll(true); // Scoped curators get same dropdown actions as Curator_All
      setLoggedInPersonIdentifier(userPermissions[0].personIdentifier);
    }
    else { // when CWID has more than 1 role or multiple roles
      setDropdownTitle("Curate Publications");
      let dropDownMenuItems = [{ title: 'Create Reports', to: ''},{title: 'View Profile', to:''}];
      setDropdownMenuItems(dropDownMenuItems);
      setIsSuperUser(true);
      setLoggedInPersonIdentifier(userPermissions[0].personIdentifier);
    }

    // if (identityAllData.length === 0) {
      fetchPaginatedData()
      fetchCount()
    // }
    fetchAllAdminSettings()
  }, [])

  // Re-derive labels when admin settings arrive in Redux (async)
  useEffect(() => {
    if (updatedAdminSettings && updatedAdminSettings.length > 0) {
      let updatedData = updatedAdminSettings.find(obj => obj.viewName === "findPeople")
      if (updatedData) {
        let viewAttributes = updatedData.viewAttributes;
        let cwidLabel = viewAttributes.find(data => data.labelUserKey === "personIdentifier")
        setNameOrcwidLabel(cwidLabel)
        setFindPeopleLabels(viewAttributes)
      }
    }
  }, [updatedAdminSettings])

  // Phase 9: Re-trigger search when scope filter checkbox is toggled
  const scopeFilterInitRef = useRef(true);
  useEffect(() => {
    // Skip the initial render (the main useEffect handles initial load)
    if (scopeFilterInitRef.current) {
      scopeFilterInitRef.current = false;
      return;
    }
    // Build scope-aware filters and re-search
    let updatedFilters = { ...filters };
    if (showScopeFilter && scopeFilterChecked && scopeData) {
      updatedFilters = {
        ...updatedFilters,
        scopeOrgUnits: scopeData.orgUnits || [],
        scopePersonTypes: scopeData.personTypes || [],
        proxyPersonIds: proxyPersonIds,
      };
    } else {
      // Remove scope filters when unchecked
      const { scopeOrgUnits, scopePersonTypes, proxyPersonIds: _p, ...rest } = updatedFilters;
      updatedFilters = rest;
    }
    let request = {
      filters: { ...updatedFilters },
      limit: count,
      offset: 0
    };
    dispatch(updateFilters(updatedFilters));
    dispatch(identityFetchAllData(request));
    setPage(1);
  }, [scopeFilterChecked])

  const fetchAllAdminSettings = () => {
    const request = {};
    fetch(`/api/db/admin/settings`, {
      credentials: "same-origin",
      method: 'POST',
      headers: {
        Accept: 'application/json',
        "Content-Type": "application/json",
        'Authorization': reciterConfig.backendApiKey
      },
      body: JSON.stringify(request),
    }).then(response => response.json())
      .then(data => {
        let parsedSettingsArray = [];
        data.map((obj, index1) => {
          let a = JSON.stringify(obj.viewAttributes)
          let b = JSON.parse(a);
          let c = typeof(b) === "string" ? JSON.parse(b) : b
          let parsedSettings = {
            viewName : obj.viewName,
            viewAttributes: c,
            viewLabel: obj.viewLabel
          }
          parsedSettingsArray.push(parsedSettings)
        })
        var viewAttributes = [];
        var headShotViewAttributes = [];

        let updatedData = parsedSettingsArray.find(obj => obj.viewName === "viewProfile")
        let headShotData = parsedSettingsArray.find(obj => obj.viewName === "headshot")

        viewAttributes = updatedData.viewAttributes;
        headShotViewAttributes = headShotData.viewAttributes
        setViewProfileLabels(viewAttributes)
        setHeadShot(headShotViewAttributes)
      })
      .catch(error => {
        // setLoading(false);
      });
  }


  const fetchIdentityData = () => {
    dispatch(identityFetchAllData(filters));
  }

  const fetchPaginatedData = (newCount) => {
    if (newCount === 'reset') {
      let filters = {}
      dispatch(identityFetchPaginatedData(1, count, filters))
    } else {
      dispatch(identityFetchPaginatedData(page, newCount ? newCount : count, filters))
    }
  }


  const handlePaginationUpdate = (page) => {
    setPage(page)
      dispatch(identityFetchPaginatedData(page, count, filters))
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

    // Phase 9: Add scope filter parameters when scope filter is active
    if (showScopeFilter && scopeFilterChecked && scopeData) {
      updatedFilters = {
        ...updatedFilters,
        scopeOrgUnits: scopeData.orgUnits || [],
        scopePersonTypes: scopeData.personTypes || [],
        proxyPersonIds: proxyPersonIds,
      };
    }

    let request = {
      filters: { ...updatedFilters },
      limit:count,
      offset: page - 1
    }

    dispatch(updateFilters(updatedFilters));
    dispatch(identityFetchAllData(request));
    setPage(1);
    setFilterByPending(false);
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
    // setShowprofile(true);
    // setShowprofileID(personIdentifier)
   
    router.push(`/curate/${personIdentifier}`);
    if (identityAllData && !identityAllFetching) {
      dispatch(identityClearAllData())
      dispatch(clearFilters())
    }
  }

  const handleClose = () => setShowprofile(false);
  const handleShow = () => setShowprofile(false);

  const handleGoAction = () => {
    dispatch(updatePubFiltersFromSearch());
    if (selectedAction === "Curate Publications") {
      dispatch(curateIdsFromSearch(identities.paginatedIdentities))
      router.push({ pathname: '/curate' })
    } else if (selectedAction === "Create Reports") {
      router.push('/report');
    }
  }

  const StyledToggleButtonGroup = styled(ToggleButtonGroup)(({ theme }) => ({
    marginLeft: '8px',
    borderRadius: '5px',
    overflow: 'hidden',
    border: '1px solid #ddd7ce',
    '& .MuiToggleButtonGroup-grouped': {
      textTransform: 'none',
      border: 'none',
      borderRadius: '0 !important',
      fontSize: '12px',
      fontWeight: 600,
      fontFamily: '"DM Sans", sans-serif',
      padding: '5px 12px',
      minHeight: 'auto',
      lineHeight: 'normal',
      color: '#8a94a6',
      backgroundColor: '#eeeae4',
    },
    '& .MuiToggleButton-root.MuiButtonBase-root.Mui-selected': {
      color: '#fff',
      backgroundColor: '#1a2133',
      '&:hover': {
        backgroundColor: '#252d42',
      }
    }
  }));

  const resetData = () => {
    dispatch(clearFilters())
    setPage(1)
    setCount(100)
    fetchPaginatedData('reset')
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

  const redirectToCurate = (isFor, data, title) => {
    if(title === "View Profile"){
      // let isLoggedInUser =  data === loggedInPersonIdentifier
      setShowprofile(true);
      setShowprofileID(data.personIdentifier)
    }else {
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
  }

  // Spinner when navigating between pages
  const isDisplayLoaderTable = () => {
    if (!filtersOn && identityPaginatedFetching) {
      return true;
    }
    return false;
  }
  
  const RoleSplitDropdown = (identity) => {
    
    if(dropdownTitle && dropdownTitle =='Curate Publications' && isCuratorSelf && !isReporterAll && !isCuratorAll && !isSuperUser
        && (loggedInPersonIdentifier === identity.identity.personIdentifier || isProxyFor(proxyPersonIds, identity.identity.personIdentifier)))
    {
        return <Button className="secondary" variant="secondary" onClick={() => redirectToCurate("individual", identity.identity.personIdentifier)}>{"Curate Publications"}</Button>
    }
    else if(dropdownTitle && dropdownTitle =='Create Report' && isReporterAll && !isCuratorAll && !isSuperUser && !isCuratorSelf)
    {
        if (isProxyFor(proxyPersonIds, identity.identity.personIdentifier)) {
          return <Button className="secondary" variant="secondary" onClick={() => redirectToCurate("individual", identity.identity.personIdentifier)}>{"Curate Publications"}</Button>
        }
        return <Button className="secondary" variant="secondary" onClick={() => redirectToCurate("report", identity.identity)}>{"Create Reports"}</Button>
    }
    else if(dropdownTitle && dropdownTitle =='Curate Publications' && isCuratorAll && !isReporterAll && !isSuperUser && !isCuratorSelf) 
    {
        return <Button className="secondary" variant="secondary" onClick={() => redirectToCurate("individual", identity.identity.personIdentifier)}>{"Curate Publications"}</Button>
    }
    else if(isCuratorSelf && isReporterAll && !isCuratorAll && !isSuperUser)
    {
      const canCurateRow = identity && (identity.identity.personIdentifier === loggedInPersonIdentifier || isProxyFor(proxyPersonIds, identity.identity.personIdentifier));
      return  <SplitDropdown
        title={canCurateRow ? "Curate Publications" : "Create Reports"}
        onDropDownClick={canCurateRow ? (e) => redirectToCurate("individual",identity.identity.personIdentifier,e) : (e) => redirectToCurate("report", identity.identity.personIdentifier,e)}
        id={`curate-publications_${identity.identity.personIdentifier}`}
        listItems={canCurateRow ? dropdownMenuItems : []}
        secondary={true}
        onClick={canCurateRow ? (e) => redirectToCurate("report", identity.identity,e): "undefined"}/>
    }
    else if((isCuratorAll && isReporterAll && isCuratorSelf) ||isSuperUser || (isCuratorAll && isReporterAll))
    {
      return  <SplitDropdown
        title={"Curate Publications"}
        //{isUserRole && isUserRole === allowedPermissions.Reporter_All ? "Create Reports" : "Curate Publications"}
        // to={`/curate/${identity.personIdentifier}`}
        //onDropDownClick={isUserRole && isUserRole === allowedPermissions.Reporter_All ? () => redirectToCurate("report",identity.personIdentifier) : () => redirectToCurate("individual", identity.personIdentifier)}
        onDropDownClick={(e) => redirectToCurate("individual",identity.identity.personIdentifier,e)}
        id={`curate-publications_${identity.identity.personIdentifier}`}
        listItems={dropdownMenuItems} 
        secondary={true}
        onClick={(e) => redirectToCurate("report", identity.identity,e)}/>
    }
    else
       return null;
  
  
  }



  // if filters are applied load all data, if not load paginated data
  let filtersOn = Object.keys(filters).length === 0 ? false : true;
  let tableBody;
  let paginatedIdentities = identities.paginatedIdentities;
  if (paginatedIdentities?.length > 0) {
    // setCurateIds(paginatedIdentities);
    tableBody = paginatedIdentities.map(function (identity, identityIndex) {
      return <tr key={identityIndex}>
        <td key={`${identityIndex}__name`} width="30%">
        {

          isCuratorSelf ?
          <Name identity={identity} nameOrcwidLabel={nameOrcwidLabel?.labelUserView} onClickProfile={identity && identity.personIdentifier === loggedInPersonIdentifier ? ()=> onClickProfile(identity.personIdentifier): () => redirectToCurate("report", identity)} proxyPersonIds={proxyPersonIds}></Name>
          :
          <Name identity={identity} nameOrcwidLabel={nameOrcwidLabel?.labelUserView} onClickProfile={ dropdownTitle && dropdownTitle === 'Curate Publications' ? () => onClickProfile(identity.personIdentifier) :() => redirectToCurate("report", identity)} proxyPersonIds={proxyPersonIds}></Name>
        }
        </td>
        <td key={`${identityIndex}__orgUnit`} width="20%" className={styles.colOrg}>
          {identity.primaryOrganizationalUnit && <div>{identity.primaryOrganizationalUnit}</div>}
        </td>
        <td key={`${identityIndex}__institution`} width="20%" className={styles.colInst}>
          {identity.primaryInstitution && <div>{identity.primaryInstitution}</div>}
        </td>
        {isCuratorAll || isSuperUser  ?
        <td key={`${identityIndex}__pending`} width="10%" className={styles.colPending}>
          {identity.countPendingArticles ?
            <span className={styles.pendingBadgeHas}>{identity.countPendingArticles}</span> :
            <span className={styles.pendingBadgeNone}>0</span>
          }
        </td>
         : ""}
        <td key={`${identityIndex}__dropdown`} width="20%">
          {
            <RoleSplitDropdown identity = {identity}></RoleSplitDropdown>
          }
        </td>
      </tr>;
    })
  } else {
    tableBody = (
      <tr>
        <td colSpan="5">
          <p className={styles.noitemsList}>
            {showScopeFilter && scopeFilterChecked
              ? 'No people found matching your scope. Try unchecking the scope filter to see all results.'
              : 'No records found'}
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
          <h1 style={{ paddingBottom: 10, marginBottom: 0 }}>Find People</h1>
          <SearchBar searchData={searchData} resetData={resetData} findPeopleLabels = {findPeopleLabels}/>
          {showScopeFilter && (
            <ScopeFilterCheckbox
              checked={scopeFilterChecked}
              onChange={(checked) => {
                setScopeFilterChecked(checked);
              }}
            />
          )}
          {(isDisplayLoader()) ?
            (
              <Loader />
            ) : (
              <div>
                <div className={styles.resultsBar}>
                  <div className={styles.resultsCount}>
                    <span className={styles.resultsCountNumber}>{numberFormation(totalCountUpdated)}</span>
                    <span className={styles.resultsCountLabel}>{filtersOn ? 'people found using filters' : 'people'}</span>
                  </div>
                  {filtersOn && (
                    <div className={styles.resultsRight}>
                      {(isCuratorAll || isSuperUser) && (
                        <div className={styles.pendingFilter}>
                          <span className={styles.pendingFilterLabel}>Show only pending</span>
                          <StyledToggleButtonGroup
                            color="primary"
                            value={filterByPending}
                            exclusive
                            onChange={(e, val) => { handlePendingFilterUpdate(val); }}
                          >
                            <ToggleButton value={false}>No</ToggleButton>
                            <ToggleButton value={true}>Yes</ToggleButton>
                          </StyledToggleButtonGroup>
                        </div>
                      )}
                      <span className={styles.actionLabel}>Go to</span>
                      <div className={styles.actionSelectWrap}>
                        <select
                          className={styles.actionSelect}
                          value={selectedAction}
                          onChange={(e) => setSelectedAction(e.target.value)}
                        >
                          <option value="Curate Publications">Curate Publications</option>
                          {dropdownMenuItems.filter(i => i.title).map(item => (
                            <option key={item.title} value={item.title}>{item.title}</option>
                          ))}
                        </select>
                      </div>
                      <button className={styles.btnGo} onClick={handleGoAction}>
                        Go
                        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M3 8h10M9 4l4 4-4 4"/></svg>
                      </button>
                    </div>
                  )}
                </div>
                <React.Fragment>
                  <Pagination total={totalCountUpdated} page={page}
                    count={count}
                    onChange={handlePaginationUpdate}
                    onCountChange={handleCountUpdate}
                    merged
                  />
                  {isDisplayLoaderTable() ? <Loader /> :
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

                  <Profile
                    uid={showProfileID}
                    modalShow={showProfile}
                    handleShow={handleShow}
                    handleClose={handleClose}
                    viewProfileLabels={viewProfileLabels}
                    headShotLabelData = {headShot}
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
  let firstName = props.identity.firstName ?? ''
  let middleName = props.identity.middleName ?? ''
  let lastName = props.identity.lastName ?? ''

  if (props.identity.firstName !== undefined) {
    const nameString = `${firstName} ${middleName} ${lastName}`.replace(/\s+/g, ' ').trim()
    return (
      <div>
        <div className={styles.nameRow}>
          <button className={styles.btnLink} onClick={props.onClickProfile}>
            {nameString}
          </button>
          {isProxyFor(props.proxyPersonIds, props.identity.personIdentifier) && <ProxyBadge />}
        </div>
        {props.identity.title && <div className={styles.personRole}>{props.identity.title}</div>}
        <div className={styles.personCwid}>
          <span className={styles.cwidLabel}>{props.nameOrcwidLabel}:</span> {props.identity.personIdentifier}
        </div>
      </div>
    )
  }
  return null
}

export default Search
