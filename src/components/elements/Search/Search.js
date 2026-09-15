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
import { allowedPermissions, allowedSettings, dropdownItemsReport, dropdownItemsSuper, numberFormation,
getCapabilities } from "../../../utils/constants"
//import {RoleManagerHelper} from  "../../../utils/RoleManagerHelper"
import Profile from "../Profile/Profile";
import ProxyBadge from './ProxyBadge';
import ScopeFilterCheckbox from './ScopeFilterCheckbox';
import { isProxyFor } from '../../../utils/scopeResolver';

// Guard against malformed/absent session claims so a bad JWT value can't white-screen the page.
const safeParse = (value, fallback) => {
  try { return value != null ? JSON.parse(value) : fallback; } catch { return fallback; }
};

const Search = () => {

  const { data: session, status } = useSession();
  const loading = status === 'loading';

  // Phase 9: Parse scope/proxy data and derive capabilities
  //const scopeData =typeof session?.data?.scopeData === "string" ? JSON.parse(session.data.scopeData): null;
  //const proxyPersonIds = typeof session?.data?.proxyPersonIds === "string" ? JSON.parse(session.data.proxyPersonIds): [];
  //const userRoles = typeof session?.data?.userRoles === "string" ? JSON.parse(session.data.userRoles): [];

  const scopeData = typeof session?.data?.scopeData === "string" && session.data.scopeData !== ""
    ? JSON.parse(session.data.scopeData)
    : (typeof session?.data?.scopeData === "object" && session?.data?.scopeData !== null
      ? session.data.scopeData
      : null);

  const proxyPersonIds = typeof session?.data?.proxyPersonIds === "string" && session.data.proxyPersonIds !== ""
    ? JSON.parse(session.data.proxyPersonIds)
    : (typeof session?.data?.proxyPersonIds === "object" && session?.data?.proxyPersonIds !== null
      ? session.data.proxyPersonIds
      : []);

  const userRoles = typeof session?.data?.userRoles === "string" && session.data.userRoles !== ""
    ? JSON.parse(session.data.userRoles)
    : (typeof session?.data?.userRoles === "object" && session?.data?.userRoles !== null
      ? session.data.userRoles
      : []);


  const caps = getCapabilities(userRoles);
  // Mirrors authorization.controller.ts's canCurate hasScope computation exactly: a configured
  // scope is self-sufficient and shouldn't require the token to also carry the Curator_Scoped
  // role (that role only lands on a user's DB row on a future admin save, never retroactively).
  const hasScope = scopeData && (
    (Array.isArray(scopeData.personTypes) && scopeData.personTypes.length > 0) ||
    (Array.isArray(scopeData.orgUnits) && scopeData.orgUnits.length > 0)
  );
  const showScopeFilter = (caps.canCurate.scoped || hasScope) && !caps.canCurate.all;
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
      let adminSettings = safeParse(session.adminSettings, []);
      let data = adminSettings.find(obj => obj.viewName === "findPeople")
      viewAttributes = data ? safeParse(data.viewAttributes, []) : []
      let cwidLabel = viewAttributes.find(data => data.labelUserKey === "personIdentifier")
      setNameOrcwidLabel(cwidLabel)
    }

    // view attributes data from session or updated settings
    setFindPeopleLabels(viewAttributes)

    let userPermissions = safeParse(session.data.userRoles, []);
    //RoleManagerHelper.showOrHideCurateReportMenu(userPermissions,allowedPermissions);
    // Self-sufficiency: a user with a configured scope (or the Curator_Scoped role) always gets
    // the same Curate Publications dropdown as Curator_All, regardless of what other baseline
    // roles (Reporter_All, Curator_Self, etc.) they also hold -- unless they're already a real
    // Superuser/Curator_All, who fall through to keep their existing branch below unaffected.
    // Must be checked before every role-combo branch below: a strict if/else-if chain means a
    // scope-only user would otherwise land in an earlier combo branch (e.g. Curator_Self &&
    // Reporter_All) and never reach a dedicated Curator_Scoped branch placed later.
    if ((caps.canCurate.scoped || hasScope) && !caps.canCurate.all) {
      setDropdownTitle("Curate Publications");
      let dropDownMenuItems = [{ title: 'Create Reports', to: ''},{title: 'View Profile', to:''}];
      setDropdownMenuItems(dropDownMenuItems);
      setIsCuratorAll(true); // Scoped curators get same dropdown actions as Curator_All
      // Defensive: unlike every other branch in this chain (which assumes at least one role
      // row), a scope-only user could in principle have zero role rows.
      setLoggedInPersonIdentifier(userPermissions[0]?.personIdentifier);
    }
    else if (userPermissions && userPermissions.length === 1 && userPermissions.some(role => role.roleLabel === allowedPermissions.Reporter_All)) {
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
          //let c = typeof(obj.viewAttributes) === "string" ? JSON.parse(obj.viewAttributes) : JSON.parse(JSON.stringify(obj.viewAttributes));
          let c = typeof obj.viewAttributes === "string"
            ? JSON.parse(obj.viewAttributes)
            : (typeof obj.viewAttributes === "object" && obj.viewAttributes !== null && !Array.isArray(obj.viewAttributes)
              ? obj.viewAttributes
              : {});
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
      // Split on any run of whitespace or commas, not just a single space, so a CWID
      // list pasted from a spreadsheet column (newline-separated) or a comma-separated
      // list parses into one token per person instead of collapsing into one mangled
      // string that then misses the bulk-CWID threshold below.
      let searchWords = searchText.trim().split(/[\s,]+/).filter(Boolean);
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
  const handleShow = () => setShowprofile(true);

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
      fontFamily: '"Inter", sans-serif',
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
  
	// Per-row curate authorization for the Actions dropdown. Mirrors the backend
  // checkCurationScope gate so the UI never offers "Curate Publications" for a
  // person the user cannot actually curate: curate-all roles (Superuser /
  // Curator_All / scoped, which set isCuratorAll) may curate anyone; a proxy
  // holder may curate the people they proxy for; a self-only curator may curate
  // only their own row. Everyone else (e.g. a pure Reporter_All) gets
  // report/profile actions but no Curate Publications.
  const canCuratePerson = (identity) => {
    if (isSuperUser || isCuratorAll) return true;
    const pid = identity?.personIdentifier;
    if (isProxyFor(proxyPersonIds, pid)) return true;
    if (isCuratorSelf) return pid === loggedInPersonIdentifier;
    return false;
  };			 
  // Note: an earlier RoleSplitDropdown() helper duplicated this same role-branching logic to
  // render the Actions dropdown, but was never actually called -- the real Actions cell (in
  // tableBody below) used a separate raw react-bootstrap Dropdown instead, which is why it
  // didn't match Manage Users' styling. Removed the dead helper rather than leave two
  // implementations of the same decision to drift out of sync again.



  // if filters are applied load all data, if not load paginated data
  let filtersOn = Object.keys(filters).length === 0 ? false : true;
  let tableBody;
  let paginatedIdentities = identities.paginatedIdentities;
  if (paginatedIdentities?.length > 0) {
    // setCurateIds(paginatedIdentities);
    tableBody = paginatedIdentities.map(function (identity, identityIndex) {
	const rowCanCurate = canCuratePerson(identity);											 
      return <tr key={identityIndex}>
        <td key={`${identityIndex}__name`} width="30%">
        { 
          
          isCuratorSelf ?
          <Name identity={identity} nameOrcwidLabel={nameOrcwidLabel?.labelUserView} onClickProfile={identity && identity.personIdentifier === loggedInPersonIdentifier ? ()=> onClickProfile(identity.personIdentifier): () => redirectToCurate("report", identity)} proxyPersonIds={proxyPersonIds}></Name>
          :
          <Name identity={identity} nameOrcwidLabel={nameOrcwidLabel?.labelUserView} onClickProfile={ dropdownTitle && dropdownTitle === 'Curate Publications' ? () => onClickProfile(identity.personIdentifier) :() => redirectToCurate("report", identity)} proxyPersonIds={proxyPersonIds}></Name>
        }
        </td>
        <td key={`${identityIndex}__affiliation`} width="32%" className={styles.colAffiliation}>
          {identity.primaryOrganizationalUnit && <div className={styles.affilOrg}>{identity.primaryOrganizationalUnit}</div>}
		  {identity.primaryInstitution && <div className={styles.affilInst}>{identity.primaryInstitution}</div>}
        </td>
        {isCuratorAll || isSuperUser  ?
        <td key={`${identityIndex}__pending`} width="10%" className={styles.colPending}>
          {identity.countPendingArticles ?
            <span className={styles.pendingBadgeHas}>{identity.countPendingArticles}</span> :
            <span className={styles.pendingBadgeNone}>0</span>
          }
        </td>
         : ""}
        <td key={`${identityIndex}__actions`} width="24%" className={styles.actionsCell}>
          {/* Was a raw react-bootstrap Dropdown (bootstrap variant="primary" styling) -- switched
              to the shared SplitDropdown component so this matches the Manage Users row action
              button (dark-navy split button, icons, "Actions for this person" header). */}
          <SplitDropdown
            title={rowCanCurate ? "Curate Publications" : "Create Reports"}
            onDropDownClick={rowCanCurate ? () => onClickProfile(identity.personIdentifier) : () => redirectToCurate("report", identity)}
            id={`actions_${identity.personIdentifier}`}
            listItems={rowCanCurate
              ? [
                  { title: 'Create Reports', onClick: () => redirectToCurate("report", identity) },
                  { title: 'View Profile', onClick: () => { setShowprofileID(identity.personIdentifier); handleShow(); } },
                ]
              : [
                  { title: 'View Profile', onClick: () => { setShowprofileID(identity.personIdentifier); handleShow(); } },
                ]
            }
            secondary={true}
          />
        </td>
      </tr>;;
    })
  } else {
    tableBody = (
      <tr>
        <td colSpan={(isCuratorAll || isSuperUser) ? 4 : 3}>
          <p className={styles.noitemsList}>
			 {showScopeFilter && scopeFilterChecked
              ? 'No people found matching your scope. Try unchecking the scope filter to see all results.': 'No records found'}									  
 
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
                            <th key="1">Affiliation</th>
                            {isCuratorAll || isSuperUser  ? <th key="3">Pending</th> : null}
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
        <button className={styles.btnLink} onClick={props.onClickProfile}>
          {nameString}
        </button>
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
