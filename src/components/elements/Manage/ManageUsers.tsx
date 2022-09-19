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



const ManageUsers = () => {

  const createORupdateUserID = useSelector((state: RootStateOrAny) => state.createORupdateUserID);

  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const router = useRouter()
  const dispatch = useDispatch();

  useEffect(() => {
        dispatch(getAdminDepartments());
        dispatch(getAdminRoles());
    setLoading(true);
    fetch(`/api/db/admin/users`, {
      credentials: "same-origin",
      method: 'POST',
      headers: {
        Accept: 'application/json',
        "Content-Type": "application/json",
        'Authorization': reciterConfig.backendApiKey
      },
    }).then(response => response.json())
      .then(data => {
        setUsers(data);
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
  }, [])

  return (
    <div className={appStyles.mainContainer}>
      <PageHeader label="Manage Users" />
      <Button className="my-2" onClick={() => router.push("/admin/users/add")}>Add User</Button>
      {loading ?
        <div className="d-flex justify-content-center align-items"><Loader /> </div>
        :
        <>
          <UsersTable data={users} />
        </>}
      <ToastContainerWrapper />

    </div>
  )
}

export default ManageUsers;