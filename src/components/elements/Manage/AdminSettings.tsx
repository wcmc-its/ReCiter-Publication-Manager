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
        console.log(error);
        setLoading(false);
      });
  }

  const handleValueChange = (viewLabelIndex?: number, viewAttrIndex?: number, name? : string, e?:any , labelName? : string) => {
    setSettings(settings.map((obj, index1) => {
      if (index1 == viewLabelIndex) {
        return {
          ...obj,
          viewAttributes:
          obj.viewAttributes.map((innerObj, index2) => {
              if (index2 == viewAttrIndex) {
                //  return innerObj[name] = e.target.value
                if(name === "isVisible") return { ...innerObj, [name]: !innerObj.isVisible }
                else if(labelName === "Reporting Article RTF" && e.target.value > 30000) return { ...innerObj, [name]: e.target.value || 0, ["isValidate"]: true }
                else if(labelName === "Reporting Article RTF" && e.target.value < 30000) return { ...innerObj, [name]: e.target.value || 0, ["isValidate"]: false }

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
            settings.length > 0 ? settings.map((obj, viewLabelIndex) => {
              return <Accordion.Item eventKey={`${viewLabelIndex}`} key={`${viewLabelIndex}`}>
                <Accordion.Header>{obj.viewLabel}</Accordion.Header>
                <Accordion.Body>
                  {
                    obj.viewAttributes.map((innerObj, viewAttrIndex) => {
                      const { labelSettingsView, labelUserView,errorMessage,isValidate, labelUserKey, helpTextSettingsView, isVisible, helpTextUserView, maxLimit,syntax,displayRank} = innerObj;
                      return <Card style={{ width: '40rem', marginBottom: '3px' }} key={`${viewAttrIndex}`}>
                        <Card.Body>
                          <Card.Title>{labelSettingsView}</Card.Title>
                          <Card.Subtitle className="mb-2 text-muted">{helpTextSettingsView}</Card.Subtitle>
                          <Card.Text>
                          { labelUserView &&
                            <div className="d-flex">
                              <p className={styles.labels}>Label Override</p>
                              <Form.Control
                                type="text"
                                name="labelOverRide"
                                className={`form-control ${styles.searchInput}`}
                                placeholder="Label override"
                                value={labelUserView}
                                onChange={(e) => handleValueChange(viewLabelIndex, viewAttrIndex, "labelUserView", e)}
                              />
                            </div>
                            }
                            { helpTextUserView &&
                            <div className="d-flex mt-2 mb-2">
                              <p className={styles.labels}>Help Text</p>
                              <Form.Control
                                type="textarea"
                                as="textarea"
                                className={`form-control ${styles.searchInput} ml-5`}
                                placeholder="Help text"
                                value={helpTextUserView}
                                onChange={(e) => handleValueChange(viewLabelIndex, viewAttrIndex, "helpTextUserView", e)}
                              />
                            </div>
                            }
                            {
                              syntax && 
                              <div className="d-flex">
                              <p className={styles.labels}>Image Path</p>
                              <Form.Control
                                type="text"
                                name="labelOverRide"
                                className={`form-control ${styles.searchInput}`}
                                placeholder="Label override"
                                value={syntax || ""}
                                onChange={(e) => handleValueChange(viewLabelIndex, viewAttrIndex, "syntax", e)}
                              />
                            </div>
                            } 
                          {isVisible &&
                            <div className="d-flex">
                              <p className={styles.labelForCheckBox}>Is visible</p>
                              <div>
                                <Form.Check
                                  type="checkbox"
                                  id=""
                                  checked={isVisible}
                                // value={isChecked}
                                onChange={(e) => handleValueChange(viewLabelIndex, viewAttrIndex, "isVisible", e)}
                                />
                              </div> 
                            </div>
                           }
                           { (innerObj && innerObj.hasOwnProperty('displayRank')) &&
                            <div className="d-flex">
                              <p className={styles.labelForCheckBox}>Display Rank</p>
                              <Form.Control
                                type="text"
                                name="displayRank"
                                className={`form-control ${styles.searchInput}`}
                                placeholder="Display Rank"
                                value={displayRank}
                                onChange={(e) => handleValueChange(viewLabelIndex, viewAttrIndex, "displayRank", e, obj.viewLabel)}
                              />
                            </div>
                           }
                           { maxLimit && maxLimit >= 0 && <>
                           <div className="d-flex">
                              <p className={styles.labels}>Max Limit</p>
                              <Form.Control
                                type="text"
                                name="maxLimit"
                                className={`form-control ${styles.searchInput}`}
                                placeholder="Max Limit"
                                defaultValue="30000"
                                value={maxLimit}
                                onChange={(e) => handleValueChange(viewLabelIndex, viewAttrIndex, "maxLimit", e, obj.viewLabel)}
                              />
                            </div>
                            {isValidate && <p className={styles.errorMessage}>{errorMessage}</p>}</>
                           }
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
