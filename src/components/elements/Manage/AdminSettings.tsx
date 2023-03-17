import React, { useState, useEffect } from "react";
import { useSelector, useDispatch, RootStateOrAny } from "react-redux";
import { reciterConfig } from '../../../../config/local';
import { useRouter } from 'next/router'
import { adminSettingsListAction, updatedAdminSettings } from "../../../redux/actions/actions";
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
    fetchAllAdminSettings()
  }, [])

  const fetchAllAdminSettings = () => {
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
        setSettings(parsedSettingsArray);
        setLoading(false);
      })
      .catch(error => {
        setLoading(false);
      });
  }

  const handleValueChange = (id1, id2, name, e) => {
    setSettings(settings.map((obj, index1) => {
      if (index1 == id1) {
        return {
          ...obj,
          viewAttributes:
          obj.viewAttributes.map((innerObj, index2) => {
              if (index2 == id2) {
                //  return innerObj[name] = e.target.value
                if(name === "isVisible") return { ...innerObj, [name]: !innerObj.isVisible }
                else return { ...innerObj, [name]: e.target.value }
              }
              else return { ...innerObj }
            })
        }
      } else {
        let ParsedObj = typeof(obj.viewAttributes)  === "object"? obj.viewAttributes :  JSON.stringify(obj.viewAttributes)
        let parsed = typeof(ParsedObj)  === "object"? ParsedObj : JSON.parse(ParsedObj)
        let newObj = {
          viewName : obj.viewName,
          viewAttributes : typeof(parsed)  === "object"? parsed : JSON.parse(parsed),
          viewLabel: obj.viewLabel
        }
        return newObj
      }
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
        dispatch(updatedAdminSettings(data))
        setSettings(data);
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
        loading ? <div className="d-flex justify-content-center align-items"><Loader /> </div>
        :
        <>
      <Accordion defaultActiveKey="0">
        <div>
          {
            settings.length > 0 ? settings.map((obj, index) => {
              return <Accordion.Item eventKey={`${index}`} key={`${index}`}>
                <Accordion.Header>{obj.viewLabel}</Accordion.Header>
                <Accordion.Body>
                  {
                    obj.viewAttributes.map((innerObj, index2) => {
                      console.log('innerObj************************',innerObj);
                      const { labelSettingsView, labelUserView, labelUserKey, helpTextSettingsView, isVisible, helpTextUserView, maxLimit,syntax} = innerObj;
                      console.log('labelSettinsView******************',labelSettingsView,helpTextUserView,maxLimit,)
                      return <Card style={{ width: '40rem', marginBottom: '3px' }} key={`${index2}`}>
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
                            { helpTextUserView!=undefined && helpTextUserView!='' &&
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
                            }
                            {isVisible != undefined &&
                            <div className="d-flex">
                              <p className={styles.labelForCheckBox}>Is visible</p>
                              <div>
                                <Form.Check
                                  type="checkbox"
                                  id=""
                                  checked={isVisible}
                                // value={isChecked}
                                onChange={(e) => handleValueChange(index, index2, "isVisible", e)}
                                />
                              </div> 
                            </div>
                           }
                           { maxLimit!=undefined && maxLimit !='' &&
                           <div className="d-flex">
                              <p className={styles.labels}>Max Limit</p>
                              <Form.Control
                                type="text"
                                name="maxLimit"
                                className={`form-control ${styles.searchInput}`}
                                placeholder="Max Limit"
                                value={maxLimit|| ""}
                                onChange={(e) => handleValueChange(index, index2, "maxLimit", e)}
                              />
                            </div>
                           }
                          {/*  { syntax!=undefined && syntax !='' &&
                           <div className="d-flex">
                              <p className={styles.labels}>Image Path</p>
                              <Form.Control
                                type="text"
                                name="syntax"
                                className={`form-control ${styles.searchInput}`}
                                placeholder="Image Path"
                                value={syntax|| ""}
                                onChange={(e) => handleValueChange(index, index2, "syntax", e)}
                              />
                            </div>
                           } */}
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
