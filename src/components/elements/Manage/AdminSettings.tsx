import React, { useState, useEffect } from "react";
import { useSelector, useDispatch, RootStateOrAny } from "react-redux";
import { reciterConfig } from '../../../../config/local';
import { useRouter } from 'next/router'
import { adminSettingsListAction, updatedAdminSettings ,sendEmailData} from "../../../redux/actions/actions";
import appStyles from '../App/App.module.css';
import styles from "./ManageUsers.module.css";
import { PageHeader } from '../Common/PageHeader';
import { Accordion, Button, Form, InputGroup, Card,Spinner } from "react-bootstrap"
import Loader from "../Common/Loader";
import { toast } from "react-toastify";
import { resolveSrv } from "dns";
import ToastContainerWrapper from "../ToastContainerWrapper/ToastContainerWrapper";
import moment from 'moment-timezone';


const AdminSettings = () => {

  const createORupdateUserID = useSelector((state: RootStateOrAny) => state.createORupdateUserID);

  const [loading, setLoading] = useState(false);
  const [settings, setSettings] = useState([]);
  const [settingsDummy, setSettingsDummy] = useState([]);

  const [labelOverRide, setLabelOverride] = useState("");
  const [helpText, setHelpText] = useState("");
  const [isChecked, setIsChecked] = useState(false);
  const [personIdentifierError, setPersonIdentifierError ] = useState('');
  const [showTestEmailText, setShowTestEmailText] = useState(false)
  const [emailDeliveredTime, setEmailDeliveredTime] = useState("");
  const [emailRecipient, setEmailRecipient] = useState("");
  const [isSendTestEmail, setIsSendTestEmail] = useState(false);
  const[noConfiguredNotifMsg,setNoConfiguredNotifMsg] = useState(""); 
  const[noEligiblePubNotifMsg,setNoEligiblePubNotifMsg] = useState("");
  const[successEmailNotifMsg,setSuccessEmailNotifMsg] = useState("");
  const [senTestEmailLoading, setSendTestEmailLoading] = useState(false);
  const [emailError, setEmailError ] = useState('');

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
    if(name === "personIdentifier" || name === "emailOverride") setIsSendTestEmail(false);

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
                else if(name === "isChecked" && innerObj.hasOwnProperty('isRoleGroup')){
                  return {
                    ...innerObj,
                    roles:
                      innerObj.roles.map((rolesInfo, rolesIndex) => {
                        if(!innerObj.isRoleGroup){
                          if (rolesIndex === labelName) return { ...rolesInfo, [name]: !rolesInfo.isChecked }
                          else return { ...rolesInfo }
                        }else{
                          if (rolesIndex === labelName) return { ...rolesInfo, [name]: !rolesInfo.isChecked }
                          else return { ...rolesInfo, [name]: false }
                        }
                      })
                  }
                }
                else {
                  if(name === "personIdentifier") setPersonIdentifierError("")
                  if(name=== "emailOverride") setEmailError("")
                  return { ...innerObj, [name]: e.target.value }
                 
                }
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
        setIsSendTestEmail(false);
        setLoading(false);
      })
      .catch(error => {
        console.log(error)
        setLoading(false);
      });
  }


  const sendTestEmail = (personIdentifier, emailRecipient) => {
    let personIdentifiersStr = '';
    if(personIdentifier && personIdentifier.length > 0)
    {
      let personIdentifierArr = personIdentifier.split(',');
      personIdentifiersStr = personIdentifierArr.map(s => s.trim()).join(',');
       
    }
    if(!emailRecipient || emailRecipient.length <=0)
    {
      setEmailError("Email is required");
      return;
    }
    let emailSentDate = moment(new Date().toUTCString()).tz("America/New_York").format("hh:mm A zz")
    setEmailDeliveredTime(emailSentDate);
    setSuccessEmailNotifMsg("");
    setNoEligiblePubNotifMsg("");
    setNoConfiguredNotifMsg("");
    if (personIdentifiersStr && personIdentifiersStr.length > 0) {
      // setIsSendTestEmail(true)
      setEmailRecipient(emailRecipient);
      setSendTestEmailLoading(true);
      let payLoad = {
        "personIdentifier": personIdentifiersStr, "emailOverride": emailRecipient
      }

      fetch(`/api/notification/sendEmail`, {
        credentials: "same-origin",
        method: 'POST',
        headers: {
          Accept: 'application/json',
          "Content-Type": "application/json",
          'Authorization': reciterConfig.backendApiKey
        },
        body: JSON.stringify(payLoad)
      }).then(response => {
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
      }).then(data => {
        if (data.message && data.message === "Could not find any notifications") {
          setIsSendTestEmail(false);
          setSendTestEmailLoading(false);
          toast.info("No data found to send an email", {
            position: "top-right",
            autoClose: 4000,
            theme: 'colored'
          });
        } else {
          setIsSendTestEmail(true)
          if(data && data.noConfiguredNotificationMsg)
            setNoConfiguredNotifMsg(data.noConfiguredNotificationMsg);
          if(data && data.noEligiblePubNotifMsg)
            setNoEligiblePubNotifMsg(data.noEligiblePubNotifMsg);
          if(data && data.successEmailNotifMsg)
          {
            let successEmailNotifMsg = data.successEmailNotifMsg;
            setSuccessEmailNotifMsg(successEmailNotifMsg);
          }
          setSendTestEmailLoading(false);
          toast.success("Test email sent Successfully - to " + payLoad.emailOverride, {
            position: "top-right",
            autoClose: 4000,
            theme: 'colored'
          });
        }
      }).catch(error => {
      setSendTestEmailLoading(false);
        toast.error("Send Test Email failed - " + error.title, {
          position: "top-right",
          autoClose: 2000,
          theme: 'colored'
        });
      })

    } else {
      setPersonIdentifierError("Person Identifier(s) are required");
    }
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
                      const { labelSettingsView, labelUserView,errorMessage,isValidate, labelUserKey, helpTextSettingsView, isVisible, helpTextUserView, maxLimit,syntax,displayRank,roles,personIdentifier,emailOverride,submitButton} = innerObj;
                      return <Card style={{ width: '60rem', marginBottom: '3px' }} key={`${viewAttrIndex}`}>
                        <Card.Body>
                          <Card.Title>{labelSettingsView}</Card.Title>
                          <Card.Subtitle className="mb-2 text-muted">{helpTextSettingsView}</Card.Subtitle>
                          <Card.Text>
                          {(innerObj && innerObj.hasOwnProperty('labelUserView'))  && labelSettingsView !== "Email signature" &&
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
                            {(innerObj && innerObj.hasOwnProperty('labelUserView')) && labelSettingsView == "Email signature" &&

                              <div className="d-flex">
                                <p className={styles.labels}>Label</p>
                                <Form.Control
                                  type="textarea"
                                  name="labelOverRide"
                                  as="textarea" rows={3}
                                  className={`form-control ${styles.searchInput}`}
                                  placeholder="Label"
                                  value={labelUserView}
                                  onChange={(e) => handleValueChange(viewLabelIndex, viewAttrIndex, "labelUserView", e)}
                                />
                              </div>
                            }
                            {(innerObj && innerObj.hasOwnProperty('helpTextUserView')) &&
                            <div className="d-flex mt-4 mb-4">
                              <p className={styles.labels}>Help Text</p>
                              <Form.Control
                                type="textarea"
                                as="textarea"
                                className={`form-control ${styles.searchInput} ml-8`}
                                placeholder="Help text"
                                value={helpTextUserView}
                                onChange={(e) => handleValueChange(viewLabelIndex, viewAttrIndex, "helpTextUserView", e)}
                              />
                            </div>
                            }
                            {(innerObj && innerObj.hasOwnProperty('syntax')) && 
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
                           {(innerObj && innerObj.hasOwnProperty('isVisible')) && labelUserKey == 'emailNotifications' &&
                            <div className="d-flex">
                              <p className={styles.labelForCheckBox}>Is enabled</p>
                              <div>
                                <Form.Check
                                  type="checkbox"
                                  id="check"
                                  checked={isVisible}
                                // value={isChecked}
                                onChange={(e) => handleValueChange(viewLabelIndex, viewAttrIndex, "isVisible", e)}
                                />
                              </div> 
                            </div>
                           }  
                          {(innerObj && innerObj.hasOwnProperty('isVisible')) && labelUserKey != 'emailNotifications' && 
                            <div className="d-flex">
                              <p className={styles.labelForCheckBox}>Is visible</p>
                              <div>
                                <Form.Check
                                  type="checkbox"
                                  id="check"
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
                           { (innerObj && innerObj.hasOwnProperty('personIdentifier')) && <>
                            <div className="d-flex mb-2">
                              <p className={styles.labels}>Person Identifier(s)</p>
                              <Form.Control
                                type="textarea"
                                as="textarea" rows={3}
                                name="personIdentifier"
                                className={`form-control ${styles.searchInput}`}
                                placeholder="PersonIdentifier1, PersonIdentifier2, PersonIdentifier3, etc"
                                value={personIdentifier}
                                onChange={(e) => handleValueChange(viewLabelIndex, viewAttrIndex, "personIdentifier", e, obj.viewLabel)}
                              />
                            </div>
                              {personIdentifierError && personIdentifier === "" && <p className="textError" >{personIdentifierError}</p>}
                              </>
                           }
                           { (innerObj && innerObj.hasOwnProperty('emailOverride')) && <>
                            <div className="d-flex">
                              <p className={styles.labels}>Email</p>
                              <Form.Control
                                type="text"
                                name="emailOverride"
                                className={`form-control ${styles.searchInput}`}
                                placeholder="Recipient email address"
                                value={emailOverride}
                                onChange={(e) => handleValueChange(viewLabelIndex, viewAttrIndex, "emailOverride", e, obj.viewLabel)}
                              />
                            </div>
                              {emailError && emailOverride === "" && <p className="textError" >{emailError}</p>}
                              </>
                           }
                          {(innerObj && innerObj.hasOwnProperty('submitButton')) &&
                              <div className="d-flex sendTestEmailInfo">
                                <Button
                                  type="button"
                                  name="submitButton"
                                  variant="primary" className="mt-3"
                                  onClick={() => sendTestEmail(personIdentifier, emailOverride)}
                                > 
                                 { senTestEmailLoading ? <div className="d-flex">
                    <Spinner animation="border" role="status" className="danger">
                      {/* <span className="">Loading...</span> */}
                    </Spinner> <h5>Loading...</h5></div>: "Send test email" }
                                </Button>
                                <div>
                               {isSendTestEmail && <p> {noConfiguredNotifMsg}</p>  }
                               {isSendTestEmail && <p> {noEligiblePubNotifMsg}</p>  }
                               {isSendTestEmail && successEmailNotifMsg ? <p> {successEmailNotifMsg} <span> {emailRecipient}</span> at {emailDeliveredTime}.</p> :'' }
                               </div>
                              </div>
                            }
                           { (innerObj && innerObj.hasOwnProperty('maxLimit')) && labelUserKey !== "suggestedEmailNotificationsLimit" && labelUserKey !== "acceptedEmailNotificationsLimit" && <>
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
                           {(innerObj && innerObj.hasOwnProperty('maxLimit')) && (labelUserKey === "suggestedEmailNotificationsLimit" || labelUserKey === "acceptedEmailNotificationsLimit") && <>
                              <div className="d-flex">
                                <p className={styles.labels}>Max Limit</p>
                                <Form.Select aria-label="Default select example"  value={maxLimit} defaultValue={1} onChange={(e) => handleValueChange(viewLabelIndex, viewAttrIndex, "maxLimit", e, obj.viewLabel)} className={styles.selectFrequecy}>
                                {[ ...Array(20) ].map((e, i) =>{ return <option value={1+i} key={i} >{1+i}</option>})}
                                </Form.Select>
                              </div>
                              {isValidate && <p className={styles.errorMessage}>{errorMessage}</p>}</>
                            }
                            {
                              innerObj && innerObj.hasOwnProperty('isRoleGroup') && roles.map((roleInfo, rolesIndex) => {
                                const { roleId, roleLabel, isChecked } = roleInfo;
                                return <div className="d-flex" key={`${rolesIndex}`}>
                                  <div>
                                    <Form.Check
                                      type="checkbox"
                                      id="rolecheckbox"
                                      checked={isChecked}
                                      // value={isChecked}
                                      onChange={(e) => handleValueChange(viewLabelIndex, viewAttrIndex, "isChecked", e, rolesIndex)}
                                    />
                                  </div>
                                  <p className={styles.rolesLabel}>{roleLabel}</p>
                                </div>
                              })
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

<ToastContainerWrapper />
    </div>
  )

}

export default AdminSettings;
