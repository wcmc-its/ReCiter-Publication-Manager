import React, { useState, useEffect, useRef } from "react";
import { identityFetchAllData, curateIdsFromSearch, identityFetchPaginatedData, updateFilters, clearFilters, updateFilteredIds, updateFilteredIdentities, identityClearAllData, F, updateIndividualPersonReportCriteria, showEvidenceByDefault, updateAuthorFilter, clearError } from '../../../redux/actions/actions'
import styles from './Search.module.css'
import { useSelector, useDispatch } from "react-redux";
import { useRouter } from "next/router";
import Pagination from '../Pagination/Pagination';
import appStyles from '../App/App.module.css';
import { useSession } from 'next-auth/react';
import SearchBar from "./SearchBar";
import fetchWithTimeout from "../../../utils/fetchWithTimeout";
import { updatePubFiltersFromSearch } from "../../../redux/actions/actions";
import { reciterConfig } from "../../../../config/local";
import { allowedPermissions, allowedSettings, dropdownItemsReport, dropdownItemsSuper, numberFormation,
getCapabilities } from "../../../utils/constants"
//import {RoleManagerHelper} from  "../../../utils/RoleManagerHelper"
import Profile from "../Profile/Profile";
import ProxyBadge from './ProxyBadge';
import ScopeFilterCheckbox from './ScopeFilterCheckbox';
import { hasConfiguredScope, isProxyFor, rowInScopeCanCurate, withoutScopeKeys } from '../../../utils/scopeResolver';
import { searchTokens, newSearchRequest, matchedPersonIds, reportHandoffCapped, REPORT_HANDOFF_CAP, peopleRowActions, pendingCell, personDisplayName, cwidListNotFound, peopleEmptyState } from '../../../utils/searchRequest';
import RowActions from './RowActions';
import { Button as UiButton, Switch } from '../../ui';

// Guard against malformed/absent session claims so a bad JWT value can't white-screen the page.
const safeParse = (value, fallback) => {
  try { return value != null ? JSON.parse(value) : fallback; } catch { return fallback; }
};

const SKELETON_ROWS = 6;
// A long paste lists this many not-found CWIDs, then "and N more".
const NOT_FOUND_SHOWN = 25;

const Search = () => {

  const { data: session, status } = useSession();
  const loading = status === 'loading';

  // Phase 9: Parse scope/proxy data and derive capabilities
  const scopeData = session?.data?.scopeData ? JSON.parse(session.data.scopeData) : null;
  const proxyPersonIds = session?.data?.proxyPersonIds ? JSON.parse(session.data.proxyPersonIds) : [];
  const userRoles = session?.data?.userRoles ? JSON.parse(session.data.userRoles) : [];
  const caps = getCapabilities(userRoles);
  // Mirrors authorization.controller.ts's canCurate hasScope computation exactly: a configured
  // scope is self-sufficient and shouldn't require the token to also carry the Curator_Scoped
  // role (that role only lands on a user's DB row on a future admin save, never retroactively).
  const hasScope = hasConfiguredScope(scopeData);
  const showScopeFilter = (caps.canCurate.scoped || hasScope) && !caps.canCurate.all;
  // Scope keys must ride on EVERY list request for a scoped curator (initial load and pagination
  // included), not only after the checkbox is toggled or a search is submitted.
  const applyScopeFilters = (base) => {
    const { scopeOrgUnits, scopePersonTypes, scopeInstitutions, proxyPersonIds: _p, ...rest } = base || {};
    if (showScopeFilter && scopeFilterChecked && scopeData) {
      return { ...rest, scopeOrgUnits: scopeData.orgUnits || [], scopePersonTypes: scopeData.personTypes || [], scopeInstitutions: scopeData.institutions || [], proxyPersonIds };
    }
    return rest;
  };
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
  const [scopeFilterChecked, setScopeFilterChecked] = useState(true); // Default checked for scoped curators (D-14)
  //ref
  const searchValue = useRef()

  // List fetches report failure here instead of through the global errors array (which sends the
  // whole app to /_error). Only the latest fetch may set or clear the error; Retry re-runs it.
  const [loadError, setLoadError] = useState(false);
  const fetchSeq = useRef(0);
  const lastFetch = useRef(null);
  const runListFetch = (makeThunk) => {
    const seq = ++fetchSeq.current;
    lastFetch.current = makeThunk;
    setLoadError(false);
    return Promise.resolve(dispatch(makeThunk())).then((result) => {
      if (seq === fetchSeq.current) setLoadError(!!(result && result.ok === false));
    });
  };

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
      // 'reset': the redux filters were just cleared above, but this closure still holds the
      // pre-clear value -- fetching with it would re-hydrate a previous visit's name filter.
      fetchPaginatedData('reset')
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
    let updatedFilters = applyScopeFilters(filters);
    let request = newSearchRequest(updatedFilters, count);
    dispatch(updateFilters(updatedFilters));
    runListFetch(() => identityFetchAllData(request));
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
    const f = applyScopeFilters(newCount === 'reset' ? {} : filters);
    dispatch(updateFilters(f));
    if (newCount === 'reset') {
      runListFetch(() => identityFetchPaginatedData(1, count, f))
    } else {
      const limit = newCount ? newCount : count
      runListFetch(() => identityFetchPaginatedData(page, limit, f))
    }
  }


  const handlePaginationUpdate = (page) => {
    setPage(page)
    runListFetch(() => identityFetchPaginatedData(page, count, filters))
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
      let searchWords = searchTokens(searchText);
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
    updatedFilters = applyScopeFilters(updatedFilters);
    // A new search always starts at the first row, whatever page was showing.
    let request = newSearchRequest(updatedFilters, count);

    dispatch(updateFilters(updatedFilters));
    runListFetch(() => identityFetchAllData(request));
    setPage(1);
    setFilterByPending(false);
  }

  const handlePendingFilterUpdate = (value) => {
    const filterPending = value ? value : false;
    setFilterByPending(filterPending);
    let updatedFilters = { ...filters, showOnlyPending: filterPending };
    let request = newSearchRequest(updatedFilters, count);
    dispatch(updateFilters(updatedFilters));
    runListFetch(() => identityFetchAllData(request));
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

  // Cornell-only people (src/utils/cornellOnly.ts) aren't run through ReCiter, so they have no
  // /curate page; their data is the authorships the review lanes attributed to them. /authorships
  // is Curator_All/Superuser only (middleware), so for anyone else the row isn't a link.
  const canOpenAuthorships = caps.canCurate.all || isSuperUser;
  const onClickCornellOnly = (personIdentifier) => {
    router.push({ pathname: '/authorships', query: { cwid: personIdentifier } });
  }

  const handleClose = () => setShowprofile(false);
  const handleShow = () => setShowprofile(true);

  // Every CWID the search matched (all pages), from findAll's per-person grouped count.
  const matchedIds = matchedPersonIds(identityPaginatedData?.totalPersonsCount);
  const handoffCapped = reportHandoffCapped(filters, matchedIds.length);

  const handleGoAction = () => {
    dispatch(updatePubFiltersFromSearch(matchedIds));
    router.push('/report');
  }

  const resetData = () => {
    dispatch(clearFilters())
    // The reset list carries no showOnlyPending, so the switch goes off with it.
    setFilterByPending(false)
    setPage(1)
    setCount(100)
    fetchPaginatedData('reset')
    fetchCount()
  }

  // Empty-state buttons. "Clear filters" clears the filter card the same way Reset does; "Show
  // everyone" unchecks "only people I can curate" (the scope effect re-runs the search). Both
  // buttons vanish with the empty state, so focus goes back to the search box.
  const [clearSignal, setClearSignal] = useState(0);
  const focusQuery = () => {
    if (typeof document !== 'undefined') document.getElementById('people-search-query')?.focus();
  };
  const clearAllFilters = () => {
    setClearSignal((n) => n + 1);
    focusQuery();
  };
  const showEveryone = () => {
    setScopeFilterChecked(false);
    focusQuery();
  };

  const identities = filter()

  const showLoadError = loadError || (errors && errors.length > 0);
  const retryLoad = () => {
    // The Retry button goes away with the error card, so focus goes back to the search box.
    focusQuery();
    if (errors && errors.length > 0) dispatch(clearError());
    if (lastFetch.current) runListFetch(lastFetch.current);
    else fetchPaginatedData('reset');
  }

  // Skeleton rows while the list loads: any list fetch in flight (initial load, search, filter,
  // pending/scope toggle, page or page size), or an unscoped, unfiltered list that is still empty
  // (an unscoped list is never empty, so empty means "not loaded yet" -- but a scope or a filter
  // can legitimately match nobody, and that must render the empty state). The filter card, the
  // results header and the table header stay on screen, so the count's live region is announced.
  // The /users/count fetch no longer holds the list back: the header uses findAll's own count.
  // Before the first response the store still holds its initial [] (no `persons`): that is "not
  // loaded yet" too, also for a scoped curator, whose first render otherwise flashed the scope
  // empty state and announced "0 people" before the scoped fetch started.
  const isListLoading = () => {
    const neverLoaded = !Array.isArray(identityPaginatedData?.persons);
    return !!(identityAllFetching || identityPaginatedFetching || neverLoaded ||
      (!filtersOn && !showScopeFilter && !(identityPaginatedData?.persons?.length > 0)));
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


	// Per-row curate authorization for the Actions dropdown. Mirrors the backend
  // checkCurationScope gate so the UI never offers "Curate Publications" for a
  // person the user cannot actually curate: curate-all roles (Superuser /
  // Curator_All / scoped, which set isCuratorAll) may curate anyone; a proxy
  // holder may curate the people they proxy for; a self-only curator may curate
  // only their own row. Everyone else (e.g. a pure Reporter_All) gets
  // report/profile actions but no Curate Publications.
  //
  // A scoped curator also gets isCuratorAll (for the shared dropdown/Pending layout), so for them
  // the per-row `inScope` flag decides instead: /api/db/users computes it from the session's own
  // scope, the same rule canCurate applies, and sends it only to scoped viewers. Without it a
  // scoped curator who unchecked "only people I can curate" was offered Curate on everyone.
  const canCuratePerson = (identity) => {
    if (isSuperUser) return true;
    const pid = identity?.personIdentifier;
    // A Curator_Scoped role with no scope configured gets no flag, and canCurate fails closed
    // for it: treat every row as out of scope (proxy and own row still allowed).
    const inScope = identity?.inScope ?? (showScopeFilter && !hasScope ? 0 : null);
    if (identity && inScope !== null) {
      return rowInScopeCanCurate(inScope,isProxyFor(proxyPersonIds, pid), caps.canCurate.self && pid === loggedInPersonIdentifier);
    }
    if (isCuratorAll) return true;
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
  // Scope keys are implicit for a scoped curator (applyScopeFilters stamps them on every list
  // request), so they must not count as "filters on" -- otherwise the initial load renders the
  // filtered empty state instead of the spinner while the first response is in flight.
  let filtersOn = Object.keys(withoutScopeKeys(filters)).length !== 0;
  const listLoading = isListLoading();
  const idLabel = nameOrcwidLabel?.labelUserView || 'CWID';
  let tableBody;
  let paginatedIdentities = identities.paginatedIdentities;
  const showPending = isCuratorAll || isSuperUser;
  if (paginatedIdentities?.length > 0) {
    tableBody = paginatedIdentities.map(function (identity, identityIndex) {
      const rowCanCurate = canCuratePerson(identity);
      const cornellOnly = Number(identity.cornellOnly) === 1;
      const viewProfile = () => { setShowprofileID(identity.personIdentifier); handleShow(); };
      const actions = peopleRowActions({ cornellOnly, canCurate: rowCanCurate, canOpenAuthorships });
      const runAction = (action) => {
        if (action === 'curate') onClickProfile(identity.personIdentifier);
        else if (action === 'report') redirectToCurate("report", identity);
        else if (action === 'authorships') onClickCornellOnly(identity.personIdentifier);
      };
      // The name (and a click on the row's empty space) does what the first button does, so a
      // Superuser's name click now opens Curate like the button, not Report as it used to.
      const openName = actions.primary ? () => runAction(actions.primary) : null;
      const pending = pendingCell(identity.countPendingArticles, cornellOnly);
      // A click on the row's empty space does what the name does; buttons, links and the
      // (portaled) "⋯" menu handle their own clicks. Keyboard users use the name itself.
      const onRowClick = openName ? (e) => {
        if (!e.currentTarget.contains(e.target)) return;
        if (e.target.closest && e.target.closest('button, a, input, [role="menu"]')) return;
        openName();
      } : undefined;
      return <tr key={identity.personIdentifier || identityIndex} className={openName ? styles.rowClickable : undefined} onClick={onRowClick}>
        <td className={styles.colName}>
          <Name identity={identity} nameOrcwidLabel={nameOrcwidLabel?.labelUserView} onClickProfile={openName}
            cornellOnly={cornellOnly} isProxy={!cornellOnly && isProxyFor(proxyPersonIds, identity.personIdentifier)} />
        </td>
        <td className={styles.colOrg}>
          {identity.primaryOrganizationalUnit}
          {/* Narrow widths drop the Institution column and show it here, as a second muted line. */}
          {identity.primaryInstitution && <span className={styles.instUnder}>{identity.primaryInstitution}</span>}
        </td>
        <td className={styles.colInst}>{identity.primaryInstitution}</td>
        {showPending ?
        <td className={styles.colPending}>
          {/* Screen readers get the sentence ("20 pending suggestions"), not the bare number. */}
          <span
            className={pending.hasPending ? styles.pendingPill : styles.pendingNone}
            title={cornellOnly ? pending.label : undefined}
          ><span aria-hidden="true">{pending.text}</span><span className={styles.srOnly}>{pending.label}</span></span>
          {/* Card layout (under 640px) has no column header, so the count gets a word. */}
          {!cornellOnly && <span className={styles.pendingCaption} aria-hidden="true">pending</span>}
        </td>
         : null}
        <td className={styles.colActions}>
          <RowActions
            personName={personDisplayName(identity) || identity.personIdentifier}
            primary={actions.primary}
            secondary={actions.secondary}
            onAction={runAction}
            onViewProfile={viewProfile}
          />
        </td>
      </tr>;
    })
  } else {
    const emptyKind = peopleEmptyState({ scopeFilterShown: showScopeFilter, scopeFilterChecked });
    tableBody = (
      <tr className={styles.emptyRow}>
        <td colSpan={showPending ? 5 : 4}>
          <div className={styles.emptyState}>
            {emptyKind === 'scope' ? (
              <>
                <p className={styles.emptyText}>No one in your curation scope matches.</p>
                <UiButton variant="ghost" size="sm" onClick={showEveryone}>Show everyone</UiButton>
              </>
            ) : (
              <>
                <p className={styles.emptyText}>No people match. Try a {idLabel} or clear a filter.</p>
                <UiButton variant="ghost" size="sm" onClick={clearAllFilters}>Clear filters</UiButton>
              </>
            )}
          </div>
        </td>
      </tr>
    )
  }
  if (listLoading) {
    tableBody = Array.from({ length: SKELETON_ROWS }, (_, i) => (
      <tr key={`sk-${i}`} className={styles.skeletonRow} aria-hidden="true">
        <td className={styles.colName}>
          <div className={styles.skLine} style={{ width: `${62 - (i % 3) * 9}%`, height: 13 }} />
          <div className={styles.skLine} style={{ width: `${44 - (i % 2) * 8}%` }} />
        </td>
        <td className={styles.colOrg}><div className={styles.skLine} style={{ width: `${70 - (i % 3) * 12}%` }} /></td>
        <td className={styles.colInst}><div className={styles.skLine} style={{ width: `${58 - (i % 2) * 14}%` }} /></td>
        {showPending ? <td className={styles.colPending}><div className={styles.skPill} /></td> : null}
        <td className={styles.colActions}><div className={styles.skActions} /></td>
      </tr>
    ));
  }

  const totalCountUpdated = identityPaginatedData?.totalPersonsCount?.length ?? 0
  // Sum of countPendingArticles over every matched person (findAll's pendingTotal); null if absent.
  const pendingTotal = typeof identityPaginatedData?.pendingTotal === 'number' ? identityPaginatedData.pendingTotal : null
  // A pasted CWID list: which CWIDs matched nobody (client-side diff, no API change).
  const listNotFound = cwidListNotFound(filters?.nameOrUids, matchedIds)
  return (
    <div className={appStyles.mainContainer}>
      <div className={styles.searchContentContainer}>
        <div className={styles.searchBar}>
          <h1 className={styles.pageTitle}>People</h1>
          <SearchBar
            searchData={searchData}
            resetData={resetData}
            clearSignal={clearSignal}
            findPeopleLabels={findPeopleLabels}
            toggles={(isCuratorAll || isSuperUser || showScopeFilter) && (
              <div className={styles.filterToggles}>
                {(isCuratorAll || isSuperUser) && (
                  <Switch
                    label="Pending only"
                    checked={filterByPending}
                    onChange={(e) => handlePendingFilterUpdate(e.target.checked)}
                  />
                )}
                {showScopeFilter && (
                  <ScopeFilterCheckbox
                    checked={scopeFilterChecked}
                    onChange={(checked) => {
                      setScopeFilterChecked(checked);
                    }}
                  />
                )}
              </div>
            )}
          />
          {showLoadError ? (
            <div className={styles.loadError} role="alert">
              <p className={styles.loadErrorText}>Couldn&apos;t load people.</p>
              <UiButton variant="secondary" size="sm" onClick={retryLoad}>Retry</UiButton>
            </div>
          ) : (
              <div className={styles.resultsCard}>
                <div className={styles.resultsHeader}>
                  {/* Polite live region: a new count (or "Loading people…") is read out after a
                      search, a filter change or a page change. It stays mounted while loading. */}
                  <div className={styles.resultsCount} aria-live="polite" aria-atomic="true">
                    {listLoading ? (
                      <span className={styles.resultsLoading}>Loading people…</span>
                    ) : (
                      <>
                        <strong className={styles.resultsCountNumber}>{numberFormation(totalCountUpdated)}</strong>
                        {' '}{totalCountUpdated === 1 ? 'person' : 'people'}
                        {showPending && pendingTotal !== null && (
                          <>
                            {' '}<span className={styles.resultsSep} aria-hidden="true">·</span>{' '}
                            {numberFormation(pendingTotal)} pending suggestion{pendingTotal === 1 ? '' : 's'}
                          </>
                        )}
                      </>
                    )}
                  </div>
                  {/* #967 follow-up: this acts on the result set, so it must not hang off filtersOn.
                      filtersOn deliberately ignores scope keys, which meant a scoped curator --
                      whose only "filter" is their scope -- could never reach it. Gate on rows. */}
                  {!listLoading && totalCountUpdated > 0 && (
                    <UiButton
                      variant="secondary"
                      size="sm"
                      onClick={handleGoAction}
                      title={handoffCapped
                        ? `More than ${REPORT_HANDOFF_CAP} people match this name search, so the report uses only the Organization, Institution and Person type filters`
                        : undefined}
                    >
                      Create report for these people
                    </UiButton>
                  )}
                </div>
                {!listLoading && listNotFound && listNotFound.notFound.length > 0 && (
                  <div className={styles.notFound}>
                    <span className={styles.notFoundLead}>
                      Showing {numberFormation(listNotFound.found)} of {numberFormation(listNotFound.listed)} {idLabel}s.
                    </span>{' '}
                    Not found{showScopeFilter && scopeFilterChecked ? ' in your curation scope' : ''}:{' '}
                    <span className={styles.notFoundIds}>
                      {listNotFound.notFound.slice(0, NOT_FOUND_SHOWN).join(', ')}
                      {listNotFound.notFound.length > NOT_FOUND_SHOWN
                        ? ` and ${numberFormation(listNotFound.notFound.length - NOT_FOUND_SHOWN)} more`
                        : ''}
                    </span>
                  </div>
                )}
                <div className={styles.tableWrap}>
                  <table className={styles.table} aria-busy={listLoading ? 'true' : undefined} aria-label="People">
                    <colgroup>
                      <col />
                      <col className={styles.colOrgW} />
                      <col className={styles.colInstW} />
                      {showPending ? <col className={styles.colPendingW} /> : null}
                      <col className={styles.colActionsW} />
                    </colgroup>
                    <thead>
                      <tr>
                        <th scope="col">Name</th>
                        <th scope="col" className={styles.colOrg}>Organization</th>
                        <th scope="col" className={styles.colInst}>Institution</th>
                        {showPending ? <th scope="col" className={styles.colPending}>Pending</th> : null}
                        <th scope="col" className={styles.colActions}><span className={styles.srOnly}>Actions</span></th>
                      </tr>
                    </thead>
                    <tbody>
                      {tableBody}
                    </tbody>
                  </table>
                </div>
                {/* Stays mounted while a page loads, so focus stays on the page button pressed. A
                    new search hides it until its own total arrives. */}
                {!identityAllFetching && (
                  <Pagination total={totalCountUpdated} page={page}
                    count={count}
                    onChange={handlePaginationUpdate}
                    onCountChange={handleCountUpdate}
                    inCard
                  />
                )}
              </div>
            )
          }
          <Profile
            uid={showProfileID}
            modalShow={showProfile}
            handleShow={handleShow}
            handleClose={handleClose}
            viewProfileLabels={viewProfileLabels}
            headShotLabelData = {headShot}
          />
        </div>
      </div>
    </div>
  );
}

function Name(props) {
  const { identity } = props;
  const nameString = personDisplayName(identity)
  return (
    <div className={styles.nameBlock}>
      <div className={styles.nameLine}>
        {props.onClickProfile ?
          <button type="button" className={styles.btnLink} onClick={props.onClickProfile}>
            {nameString || identity.personIdentifier}
          </button> :
          <span className={styles.nameText}>{nameString || identity.personIdentifier}</span>}
        {props.isProxy && <ProxyBadge />}
        {props.cornellOnly && <span className={styles.rowTag}>Cornell Ithaca</span>}
      </div>
      {/* The title ellipsizes and the CWID never does, so a long title can't hide the CWID. */}
      <div className={styles.personSub}>
        {identity.title && <span className={styles.personTitle}>{identity.title}<span aria-hidden="true">{'\u00a0·\u00a0'}</span></span>}
        {props.nameOrcwidLabel && <span className={styles.srOnly}>{props.nameOrcwidLabel} </span>}
        <span className={styles.personCwid}>{identity.personIdentifier}</span>
      </div>
    </div>
  )
}

export default Search
