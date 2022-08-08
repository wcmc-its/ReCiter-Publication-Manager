import React, { useState, useEffect } from "react";
import appStyles from '../App/App.module.css';
import styles from "./ManageUsers.module.css";
import { PageHeader } from '../Common/PageHeader';
import Loader from '../Common/Loader';
import { reciterConfig } from '../../../../config/local';
import UsersTable from "./UsersTable";

const ManageUsers = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
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
      setLoading(false);
    })
    .catch(error => { 
      console.log(error)
      setLoading(false);
    });
  }, [])

  return (
    <div className={appStyles.mainContainer}>
      <PageHeader label="Manage Users" />
      {loading ? 
      <div className="d-flex justify-content-center align-items"><Loader /> </div>
      : 
      <>
        <UsersTable data={users} />
      </>}
    </div>
  )
}

export default ManageUsers;