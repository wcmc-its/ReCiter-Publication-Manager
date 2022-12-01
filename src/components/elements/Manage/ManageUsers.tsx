import React, { useState, useEffect } from "react";
import { useSelector, useDispatch, RootStateOrAny } from "react-redux";
import appStyles from '../App/App.module.css';
import styles from "./ManageUsers.module.css";
import { PageHeader } from '../Common/PageHeader';
import Loader from '../Common/Loader';
import { reciterConfig } from '../../../../config/local';
import UsersTable from "./UsersTable";
import { useRouter } from 'next/router'
import Button from 'react-bootstrap/Button';
import { adminUsersListAction, createORupdateUserIDAction, getAdminDepartments, getAdminRoles } from "../../../redux/actions/actions";
import ToastContainerWrapper from '../ToastContainerWrapper/ToastContainerWrapper';
import { toast } from "react-toastify"
import Pagination from '../Pagination/Pagination';


const ManageUsers = () => {

  const createORupdateUserID = useSelector((state: RootStateOrAny) => state.createORupdateUserID);

  const [users, setUsers] = useState([]);
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

  const fetchAllAdminUsers=(page ?: any, limit?:any)=>{
    setLoading(true);
    const offset = (page - 1) * limit;
    const request = { limit, offset };
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

  const fetchPaginatedData = (newCount) => {
    // dispatch(identityFetchPaginatedData(page, newCount ? newCount : count))
    fetchAllAdminUsers(page, newCount ? newCount : count)
  }


  const handlePaginationUpdate = (page) => {
    setPage(page)
    fetchAllAdminUsers(page, count)
  }

  
  const handleCountUpdate = (count) => {
    if (count) {
      setPage(page);
      setCount(parseInt(count));
      fetchPaginatedData(parseInt(count))
    }
  }

  return (
    <div className={appStyles.mainContainer}>
      <PageHeader label="Manage Users" />
      <Button className="my-2" onClick={() => router.push("/admin/users/add")}>Add User</Button>
      {loading ?
        <div className="d-flex justify-content-center align-items"><Loader /> </div>
        :
        <>
          <Pagination total={totalCount} page={page} count={count} onCountChange={handleCountUpdate} onChange={handlePaginationUpdate} />
            <UsersTable data={users} />
          <Pagination total={totalCount} page={page} count={count}  onCountChange={handleCountUpdate} onChange={handlePaginationUpdate} />
        </>}
      <ToastContainerWrapper />

    </div>
  )
}

export default ManageUsers;