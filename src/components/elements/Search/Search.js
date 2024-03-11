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
import FilterReview from "./FilterReview";
import fetchWithTimeout from "../../../utils/fetchWithTimeout";
import { Table,Button} from "react-bootstrap";
import SplitDropdown from "../Dropdown/SplitDropdown";
import Loader from "../Common/Loader";
import { reciterConfig } from "../../../../config/local";
import { useHistory } from "react-router-dom";
import { allowedPermissions, allowedSettings, dropdownItemsReport, dropdownItemsSuper, numberFormation } from "../../../utils/constants"
//import {RoleManagerHelper} from  "../../../utils/RoleManagerHelper"
import Profile from "../Profile/Profile";

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

  const [showProfile, setShowprofile] = useState(false);
  const [showProfileID, setShowprofileID] = useState("");
  const [headShot, setHeadShot] = useState([]);
  const [viewProfileLabels, setViewProfileLabels] = useState([])
  
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
      viewAttributes = updatedData.viewAttributes;

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

  const resetData = () => {
    dispatch(clearFilters())
    setPage(1)
    setCount(20)
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
    
    if(dropdownTitle && dropdownTitle =='Curate Publications' && isCuratorSelf && !isReporterAll && !isCuratorAll && !isSuperUser && loggedInPersonIdentifier === identity.identity.personIdentifier) 
    {
        return <Button className="secondary" variant="secondary" onClick={() => redirectToCurate("individual", identity.identity.personIdentifier)}>{"Curate Publications"}</Button>
    }
    else if(dropdownTitle && dropdownTitle =='Create Report' && isReporterAll && !isCuratorAll && !isSuperUser && !isCuratorSelf)
    {
        return <Button className="secondary" variant="secondary" onClick={() => redirectToCurate("report", identity.identity)}>{"Create Reports"}</Button>
    }
    else if(dropdownTitle && dropdownTitle =='Curate Publications' && isCuratorAll && !isReporterAll && !isSuperUser && !isCuratorSelf) 
    {
        return <Button className="secondary" variant="secondary" onClick={() => redirectToCurate("individual", identity.identity.personIdentifier)}>{"Curate Publications"}</Button>
    }
    else if(isCuratorSelf && isReporterAll && !isCuratorAll && !isSuperUser)
    {
      return  <SplitDropdown
        title={identity && identity.identity.personIdentifier === loggedInPersonIdentifier ? "Curate Publications" : "Create Reports"}
        onDropDownClick={identity && identity.identity.personIdentifier === loggedInPersonIdentifier ? (e) => redirectToCurate("individual",identity.identity.personIdentifier,e) : (e) => redirectToCurate("report", identity.identity.personIdentifier,e)}
        id={`curate-publications_${identity.identity.personIdentifier}`}
        listItems={identity && identity.identity.personIdentifier === loggedInPersonIdentifier ? dropdownMenuItems : []} //{isUserRole && isUserRole === allowedPermissions.Superuser ? dropdownItemsSuper : dropdownItemsReport}
        secondary={true}
        onClick={identity && identity.identity.personIdentifier === loggedInPersonIdentifier ? (e) => redirectToCurate("report", identity.identity,e): "undefined"}/>
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
          <Name identity={identity} nameOrcwidLabel={nameOrcwidLabel?.labelUserView} onClickProfile={identity && identity.personIdentifier === loggedInPersonIdentifier ? ()=> onClickProfile(identity.personIdentifier): () => redirectToCurate("report", identity)}></Name>
          :
          <Name identity={identity} nameOrcwidLabel={nameOrcwidLabel?.labelUserView} onClickProfile={ dropdownTitle && dropdownTitle === 'Curate Publications' ? () => onClickProfile(identity.personIdentifier) :() => redirectToCurate("report", identity)}></Name>
        }
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
              <Loader />
            ) : (
              <div>
                <br />
                {!filtersOn &&
                  <div className="row">
                    <div className="col-md-4">
                      <h3><strong>{ numberFormation(totalCountUpdated)}</strong> people</h3>
                    </div>
                  </div>}
                {filtersOn && <FilterReview count={totalCountUpdated}  onCurate={redirectToCurate} filterByPending={filterByPending} onToggle={handlePendingFilterUpdate} showPendingToggle = {isCuratorAll || isSuperUser} />}
                <React.Fragment>
                  <Pagination total={totalCountUpdated} page={page}
                    count={count}
                    onChange={handlePaginationUpdate}
                    onCountChange={handleCountUpdate}
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
