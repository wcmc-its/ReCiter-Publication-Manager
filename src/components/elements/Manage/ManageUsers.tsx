import React, { useState, useEffect } from "react";
import { useSelector, useDispatch, RootStateOrAny } from "react-redux";
import appStyles from '../App/App.module.css';
import styles from "./ManageUsers.module.css";
import { PageHeader } from '../Common/PageHeader';
import Loader from '../Common/Loader';
import { reciterConfig } from '../../../../config/local';
import UsersTable from "./UsersTable";
import { useRouter } from 'next/router'
import { Button, Card, Row, Col,InputGroup,Form } from 'react-bootstrap';
import { adminUsersListAction, createORupdateUserIDAction, getAdminDepartments, getAdminRoles, sendNotification } from "../../../redux/actions/actions";
import ToastContainerWrapper from '../ToastContainerWrapper/ToastContainerWrapper';
import { toast } from "react-toastify"
import Pagination from '../Pagination/Pagination';
import Filter from "../Filter/Filter";
import { useSession } from 'next-auth/react';



const ManageUsers = () => {

  const createORupdateUserID = useSelector((state: RootStateOrAny) => state.createORupdateUserID);
  const updatedAdminSettings = useSelector((state: RootStateOrAny) => state.updatedAdminSettings)

  const { data: session, status } = useSession();

  const [users, setUsers] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [searchText, setSearchText] = useState("")
  const [pageLoading, setpageLoading] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  const [nameOrcwidLabel, setNameOrcwidLabel] = useState()
  const [isVisibleNotification, setVisibleNotification] =useState(true)



  const router = useRouter()
  const dispatch = useDispatch();

  const [page, setPage] = useState(1)
  const [count, setCount] = useState(50)

 
  useEffect(() => {
        dispatch(getAdminDepartments());
        dispatch(getAdminRoles());
        fetchAllAdminUsers(page, count)
        adminConfigurations();
  }, [])

  const adminConfigurations = ()=>{
   // let adminSettings = JSON.parse(JSON.stringify(session?.adminSettings));
   let adminSettings = JSON.parse(JSON.stringify((session as any)?.adminSettings));
    var viewAttributes = [];
    var emailNotifications = [];

    if (updatedAdminSettings.length > 0) {
      // updated settings from manage settings page
      let updatedData = updatedAdminSettings.find(obj => obj.viewName === "findPeople")
      let notificationsData = updatedAdminSettings.find(obj => obj.viewName === "EmailNotifications")

      viewAttributes = updatedData.viewAttributes;
      emailNotifications = notificationsData.viewAttributes;
      let cwidLabel = viewAttributes.find(data => data.labelUserKey === "personIdentifier")
      setNameOrcwidLabel(cwidLabel.labelUserView)
    } else {
      // regular settings from session
      let data = JSON.parse(adminSettings).find(obj => obj.viewName === "findPeople")
      let cwidLabel = viewAttributes.find(data => data.labelUserKey === "personIdentifier")
      let notificationsData = JSON.parse(adminSettings).find(obj => obj.viewName === "EmailNotifications")

      viewAttributes = JSON.parse(data.viewAttributes)
      emailNotifications = JSON.parse(notificationsData.viewAttributes);
      cwidLabel && setNameOrcwidLabel(cwidLabel.labelUserView)
    }
    let settingsObj = emailNotifications && emailNotifications.find(data=> data.isVisible)
    setVisibleNotification(settingsObj && settingsObj.isVisible || false)
  }

  const fetchAllAdminUsers=(page ?: number, limit?:number, searchTextInput? :string)=>{
    setpageLoading(true);
    const offset = (page - 1) * limit;
    const request = { limit, offset , searchTextInput};
    fetch(`/api/db/admin/users`, {
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
        prepareTabelData(data.usersData)
        setTotalCount( data.totalUsersCount)
        dispatch(adminUsersListAction(data))
        setpageLoading(false);
        if (createORupdateUserID) toast.success(createORupdateUserID + " successfully", {
          position: "top-right",
          autoClose: 2000,
          theme: 'colored'
        });
        dispatch(createORupdateUserIDAction(""))
      })
      .catch(error => {
        console.log(error)
        setpageLoading(false);
      });
  }

  const prepareTabelData = (usersData) => {
    let tableData = [];
    usersData.map((data) => {
      const {nameFirst, nameLast, userID,personIdentifier,email, department,person} = data;
     if(data.AdminUserDept?.length > 0){
       data.AdminUserDept && data.AdminUserDept.map((deptData => {
        let obj = {
          email : email,
          personIdentifier : personIdentifier,
          userID: userID,
          nameFirst: nameFirst,
          nameLast : nameLast,
          department : deptData.departmentLabel,
          primaryOrganizationalUnit: person && Object.keys(person).length > 0 && person.primaryOrganizationalUnit || ""
        }
        tableData.push(obj);
      }))
    }else{
      let obj = {
          email : email,
          personIdentifier : personIdentifier,
          userID: userID,
          nameFirst: nameFirst,
          nameLast : nameLast,
          department : "",
          primaryOrganizationalUnit: person && Object.keys(person).length > 0 && person.primaryOrganizationalUnit || ""
      }
      tableData.push(obj);
    }
    })
    setUsers(tableData);
    setAllUsers(tableData)
  }

  const onReset = ()=>{
    setPage(1);
    setCount(50);
    setSearchText("");
    fetchAllAdminUsers(1,50);
  }

  const fetchPaginatedData = (newCount) => {
    // dispatch(identityFetchPaginatedData(page, newCount ? newCount : count))
    fetchAllAdminUsers(page, newCount ? newCount : count)
  }


  const handlePaginationUpdate = (page) => {
    setPage(page)
    // if(searchText.trim().length >= 3) fetchAllAdminUsers(page, count, searchText)
    // else 
     fetchAllAdminUsers(page, count)
  }

  const handleFilterUpdate= (searchText)=>{
    filter(searchText ? searchText.trim() : "");
  }

  const filter = (search) => {
    let filteredUsers = []
    if (allUsers && allUsers.length > 0) {
      allUsers.forEach((user) => {
        if (search) {
          var addUser = true;
          if (search) {
            addUser = false;
            //nameFirst
            if (user.nameFirst && user.nameFirst.toLowerCase().includes(search.toLowerCase())) {
              addUser = true
            }
            //nameLast
            if (user.nameLast && user.nameLast.toLowerCase().includes(search.toLowerCase())) {
              addUser = true
            }
            //personIdentifier
            if (user.personIdentifier && user.personIdentifier.toLowerCase().includes(search.toLowerCase())) {
              addUser = true
            }
            //departmentLabel
            if (user.department && user.department.toLowerCase().includes(search.toLowerCase())) {
              addUser = true
            }
            //primaryOrganizationalUnit
            if (user.primaryOrganizationalUnit && user.primaryOrganizationalUnit.toLowerCase().includes(search.toLowerCase())) {
              addUser = true
            }
          }
          if (addUser) {
            filteredUsers.push(user);
          }
        }else{
          filteredUsers.push(user)
        }
      })
    }
    setUsers(filteredUsers)
  }

  
  const handleCountUpdate = (count) => {
    if (count) {
      setPage(page);
      setCount(parseInt(count));
      fetchPaginatedData(parseInt(count))
    }
  }

  const handleSearchUpdate = async (e) => {
    let inputBySearch = e.target.value;
    await setSearchText(inputBySearch);
    }

    const onSendNotifications = ()=>{
     sendNotification()
    }

    const onSearch = ()=>{
     if(searchText.trim().length >= 3) {
      fetchAllAdminUsers(page, count, searchText)
     }}

  return (
    <div className={appStyles.mainContainer}>
      <PageHeader label="Manage Users" />
      <Row className={styles.globalfilter}>
        <Col md={6} className={styles.pt5}>
          <InputGroup className="mb-3">
            <Form.Control
              type="text"
              className={`form-control ${styles.searchInput}`}
              placeholder="Search users"
              value={searchText}
              onChange={handleSearchUpdate}
            />
            <InputGroup.Text id="basic-addon2" onClick={onSearch}>search</InputGroup.Text>
          </InputGroup>
        </Col>
        <Col md={1}>
        <div className={`mt-1 pt-2 ${styles.textButton}`} onClick={onReset}>Reset</div>
        </Col>
        <Col md={5}>
          <Button className="my-1 floatRight" onClick={() => router.push("/manageusers/add")}>Add User</Button>
        </Col>
      </Row>
      {/* <Button className="my-2" onClick={() => router.push("/admin/users/add")}>Add User</Button> */}
      {pageLoading ?
        <div className="d-flex justify-content-center align-items"><Loader /> </div>
        :
        <>
          <Pagination total={totalCount} page={page} count={count} onCountChange={handleCountUpdate} onChange={handlePaginationUpdate} />
          <div className={`row ${styles.filterSecbgColor}`}>
          <div className="col-md-5"></div>
            <div className="col-md-7">
              <Filter onSearch={handleFilterUpdate} showSort={false} isFrom="pubMed"/>
            </div>
          </div>
            <UsersTable isVisibleNotification ={isVisibleNotification} data={users} onSendNotifications = {onSendNotifications} nameOrcwidLabel={nameOrcwidLabel}/>
          <Pagination total={totalCount} page={page} count={count}  onCountChange={handleCountUpdate} onChange={handlePaginationUpdate} />
        </>}
      <ToastContainerWrapper />
    </div>
  )
}

export default ManageUsers;