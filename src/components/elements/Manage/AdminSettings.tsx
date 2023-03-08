import React, { useState, useEffect } from "react";
import { useSelector, useDispatch, RootStateOrAny } from "react-redux";
import { reciterConfig } from '../../../../config/local';
import { useRouter } from 'next/router'
import { adminSettingsListAction } from "../../../redux/actions/actions";
import appStyles from '../App/App.module.css';
import styles from "./ManageUsers.module.css";
import { PageHeader } from '../Common/PageHeader';
import { Accordion, Button, Form, InputGroup, Card } from "react-bootstrap"
import Loader from "../Common/Loader";

const AdminSettings = () => {

  const createORupdateUserID = useSelector((state: RootStateOrAny) => state.createORupdateUserID);

  const [loading, setLoading] = useState(false);
  const [settings, setSettings] = useState([]);
  const [settingsDummy, setSettingsDummy] = useState([]);

  const [labelOverRide, setLabelOverride] = useState("");
  const [helpText, setHelpText] = useState("");
  const [isChecked, setIsChecked] = useState(false);

 
  const dispatch = useDispatch();



  useEffect(() => {
    console.log('loading Admin Settings useEffect********************************************');
    fetchAllAdminSettings()
  }, [])

  const fetchAllAdminSettings = () => {
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
        setSettings(data);
        setLoading(false);
      })
      .catch(error => {
        console.log(error)
        setLoading(false);
      });
  }

  const handleValueChange = (id1, id2, name, e) => {
    setSettings(settings.map((obj, index1) => {
      let a = JSON.stringify(obj.viewAttributes)
      let b = JSON.parse(a);
      let c = typeof(b) === "string" ? JSON.parse(b) : b
      if (index1 == id1) {
        return {
          ...obj,
          viewAttributes:
            c.map((innerObj, index2) => {
              if (index2 == id2) {
                //  return innerObj[name] = e.target.value
                return { ...innerObj, [name]: e.target.value }
              }
              else return { ...innerObj }
            })
        }
      } else return { ...obj }
    }))
  }

  const handleSubmit = () => {
    setLoading(true);

    const request = {
      data:settings
    };
    fetch(`/api/db/admin/settings/updateSettings`, {
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
        setSettings(data);
        setLoading(false);
      })
      .catch(error => {
        console.log(error)
        setLoading(false);
      });
  }

  console.log("settings***********", settings)

  return (
    <div className={appStyles.mainContainer}>
      <PageHeader label="Settings" />
      <p>Changes will apply to all users and will be reflected with next login</p>
      {
        loading ? <div className="d-flex justify-content-center align-items"><Loader /> </div>
        :
        <>
      <Accordion defaultActiveKey="0">
        <div>
          {
            settings.length > 0 ? settings.map((obj, index) => {
              console.log("obj ", obj)
              let a = JSON.stringify(obj?.viewAttributes || '')
              console.log("aaa ", typeof(a))

              let b = JSON.parse(a)
              console.log("bbbbbbb ", typeof(b))

              let c = typeof (b) === "string" ? JSON.parse(b) : b;
              console.log("ccccccc", c)

            //  let d = typeof (c) === "string" ? JSON.parse(c) : c



              return <Accordion.Item eventKey={`${index}`}>
                <Accordion.Header>{obj.viewLabel}</Accordion.Header>
                <Accordion.Body>
                  {
                    c.map((innerObj, index2) => {
                      const { labelSettingsView, labelUserView, labelUserKey, helpTextSettingsView, isVisible, helpTextUserView, } = innerObj;
                      return <Card style={{ width: '40rem', marginBottom: '3px' }}>
                        <Card.Body>
                          <Card.Title>{labelSettingsView}</Card.Title>
                          <Card.Subtitle className="mb-2 text-muted">{helpTextSettingsView}</Card.Subtitle>
                          <Card.Text>
                            <div className="d-flex">
                              <p className={styles.labels}>Label Override</p>
                              <Form.Control
                                type="text"
                                name="labelOverRide"
                                className={`form-control ${styles.searchInput}`}
                                placeholder="Label override"
                                value={labelUserView || ""}
                                onChange={(e) => handleValueChange(index, index2, "labelUserView", e)}
                              />
                            </div>
                            <div className="d-flex mt-2 mb-2">
                              <p className={styles.labels}>Help Text</p>
                              <Form.Control
                                type="textarea"
                                as="textarea"
                                className={`form-control ${styles.searchInput} ml-5`}
                                placeholder="Help text"
                                value={helpTextUserView || ""}
                                onChange={(e) => handleValueChange(index, index2, "helpTextUserView", e)}
                              />
                            </div>
                            <div className="d-flex">
                              <p className={styles.labels}>Is visible</p>
                              <div>
                                <Form.Check
                                  type="checkbox"
                                  id=""
                                  checked={isVisible}
                                // value={isChecked}
                                // onChange={(e) => setIsChecked(e.target.value)}
                                />
                              </div>
                            </div>
                          </Card.Text>
                        </Card.Body>
                      </Card>
                    })
                  }
                </Accordion.Body>
              </Accordion.Item>
            }
            ) : <p className={styles.noRecordsFound}>No Records Found</p>
          }
        </div>
      </Accordion>
      <Button variant="primary" className="mt-3" onClick={() => handleSubmit()}>Update</Button>
      </>
      }
    </div>
  )

}

export default AdminSettings;
