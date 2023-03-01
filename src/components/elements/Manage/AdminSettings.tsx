import React, { useState, useEffect } from "react";
import { useSelector, useDispatch, RootStateOrAny } from "react-redux";
import { reciterConfig } from '../../../../config/local';
import { useRouter } from 'next/router'
import { adminSettingsListAction} from "../../../redux/actions/actions";
import appStyles from '../App/App.module.css';
import styles from "./ManageUsers.module.css";
import { PageHeader } from '../Common/PageHeader';

const AdminSettings = () => {

  const createORupdateUserID = useSelector((state: RootStateOrAny) => state.createORupdateUserID);

  const [loading, setLoading] = useState(false);
  const [settings, setSettings] = useState([]);
 
  const dispatch = useDispatch();

 
 
  useEffect(() => {
     console.log('loading Admin Settings useEffect********************************************');
        fetchAllAdminSettings()
  }, [])

  const fetchAllAdminSettings=()=>{
    console.log('loading Admin Settings********************************************');
    setLoading(true);
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
        console.log('Fetching Admins settings data ***************************',JSON.parse(data))
        //dispatch(adminSettingsListAction(data))
        setSettings(JSON.parse(data));
        setLoading(false);
       
      })
      .catch(error => {
        console.log(error)
        setLoading(false);
      });
  }

  

  return (
      <div className={appStyles.mainContainer}>
        <PageHeader label="Settings" />
        <p>Changes will apply to all users and will be reflected with next login</p>
        {
          settings.length > 0 ? settings.map((viewName, index) => {
            {viewName}
          }): <p className={styles.noRecordsFound}>No Records Found</p>
       }
    </div>
   
  )
 
}

export default AdminSettings;