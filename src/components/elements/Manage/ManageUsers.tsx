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
import { adminUsersListAction, createORupdateUserIDAction, getAdminDepartments, getAdminRoles } from "../../../redux/actions/actions";
import ToastContainerWrapper from '../ToastContainerWrapper/ToastContainerWrapper';
import { toast } from "react-toastify"
import Pagination from '../Pagination/Pagination';
import Filter from "../Filter/Filter";


const ManageUsers = () => {

  const createORupdateUserID = useSelector((state: RootStateOrAny) => state.createORupdateUserID);

  const [users, setUsers] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [searchText, setSearchText] = useState("")
  const [loading, setLoading] = useState(false);
  const [totalCount, setTotalCount] = useState(0);

  const router = useRouter()
  const dispatch = useDispatch();

  const [page, setPage] = useState(1)
  const [count, setCount] = useState(50)

 
  useEffect(() => {
        dispatch(getAdminDepartments());
        dispatch(getAdminRoles());
        fetchAllAdminUsers(page, count)
  }, [])

  const fetchAllAdminUsers=(page ?: number, limit?:number, searchTextInput? :string)=>{
    setLoading(true);
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
        setUsers(data.usersData);
        setAllUsers(data.usersData)
        setTotalCount( data.totalUsersCount)
        dispatch(adminUsersListAction(data))
        setLoading(false);
        if (createORupdateUserID) toast.success(createORupdateUserID + " successfully", {
          position: "top-right",
          autoClose: 2000,
          theme: 'colored'
        });
        dispatch(createORupdateUserIDAction(""))
      })
      .catch(error => {
        console.log(error)
        setLoading(false);
      });
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
    filter(searchText ? searchText : "");
  }

  const filter = (search) => { 
    let filteredUsers = []
    if (users  && users.length > 0) {
      users.forEach((user) => {
    if (search ) {
      if (/^[0-9 ]*$/.test(search)) {
        var userIds = search.split(" ");
        if (userIds.some(userId => Number(userId) === user.userID)) {
            filteredUsers.push(user);
        }
      }else{
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
        }
        if (addUser) {
          filteredUsers.push(user);
        }
      }
    }
  })
  }
  if(filteredUsers && filteredUsers.length > 0 ) setUsers( filteredUsers)
  else setUsers( allUsers)
 
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
          <Button className="my-1 floatRight" onClick={() => router.push("/admin/users/add")}>Add User</Button>
        </Col>
      </Row>
      {/* <Button className="my-2" onClick={() => router.push("/admin/users/add")}>Add User</Button> */}
      {loading ?
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
            <UsersTable data={users} />
          <Pagination total={totalCount} page={page} count={count}  onCountChange={handleCountUpdate} onChange={handlePaginationUpdate} />
        </>}
      <ToastContainerWrapper />

    </div>
  )
}

export default ManageUsers;