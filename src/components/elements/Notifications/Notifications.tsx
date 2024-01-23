import React, { useEffect, useState } from "react";
import styles from './Notifications.module.css';
import appStyles from '../App/App.module.css';
import { useSelector, useDispatch, RootStateOrAny } from "react-redux";
import Loader from "../Common/Loader";
import { Form, Button, Spinner,Carousel } from "react-bootstrap";
import { saveNotification, sendNotification, sendEmailData, disableNotificationbyID } from "../../../redux/actions/actions";
import { useSession } from "next-auth/client";
import { useRouter } from "next/router";
import { reciterConfig } from "../../../../config/local";
import ToastContainerWrapper from '../ToastContainerWrapper/ToastContainerWrapper';
import { allowedPermissions } from "../../../utils/constants";
import { toast } from "react-toastify";
import Slider from '@mui/material/Slider';
import Box from '@mui/material/Box';
import { redirect } from "next/dist/server/api-utils";


const Notifications = () => {
  const dispatch = useDispatch()
  const [session, loading] = useSession();
  const router = useRouter()
  const [state, setState] = useState({
    frequency: 7,
    minimumThreshold: 8,
  })

  const getNotificationsByIdLoading = useSelector((state: RootStateOrAny) => state.getNotificationsByIdLoading);
  const getNotificationsDataById = useSelector((state: RootStateOrAny) => state.getNotificationsDataById);
  const saveNotificationsLoading = useSelector((state: RootStateOrAny) => state.saveNotificationsLoading);
  const notificationEmailCarier = useSelector((state: RootStateOrAny) => state.notificationEmailCarier)

  const { frequency, minimumThreshold } = state;
  const [formErrorsInst, setformErrInst] = useState<{ [key: string]: any }>({});
  const [accepted, setAccepted] = useState<boolean>(false);
  const [status, setStatus] = useState<boolean>(true);
  const [evidence, setEvidance] = useState<boolean>(false)
  const [suggested, setSuggested] = useState<boolean>(false)
  const [userId, setUserId] = useState<any>("");
  const [disableAll, setDisableAll] = useState<boolean>(true);
  const [email, setEmail] = useState<string>();
  const [isCuratorSelf, setIsCuratorSelf] = useState<boolean>(false);
  const [isSuperUserORCuratorAll, SetIsSuperUserORCuratorAll] = useState<boolean>(false);
  const [isReporterAll, setIsReporterAll] = useState<boolean>(false);
  const [stepsCount, setStepsCount] = useState<any>();
  const [useName, setUserName] = useState<string>();
  const [disableSaveBtn, setDisableSaveBtn] = useState(false);



  useEffect(() => {
    const marks = [];
    [...Array(10)].map((e, i) => {
      let index = i + 1
      let obj = {
        value: index,
        label: index,
      }
      marks.push(obj);
    })
    setStepsCount(marks);

    let userPermissions = JSON.parse(session.data.userRoles);
    let curatorSelfRole = userPermissions.some(role => role.roleLabel === allowedPermissions.Curator_Self);
    let curatorAllfRole = userPermissions.some(role => role.roleLabel === allowedPermissions.Curator_All);
    let superUserRole = userPermissions.some(role => role.roleLabel === allowedPermissions.Superuser);

    if(router.query.userId === session.data.username ){
      if (!curatorSelfRole) {
        if (superUserRole || curatorAllfRole) {
          SetIsSuperUserORCuratorAll(true)
        } else {
          setIsReporterAll(true)
        }
      } else {
        setIsCuratorSelf(true)
      }
    }else{
      setIsCuratorSelf(true)
    }

    // setUserId(router.query.userId)
    // if (router.query.userId === session.data.username) {
    //   setEmail(session.data.email);
    //   setUserName(session.data.databaseUser.nameFirst)
    // }
    // else {
    //   setEmail(notificationEmailCarier.email);
    //   setUserName(notificationEmailCarier.userName);
    // }

    getNotification(router.query.userId ? router.query.userId : session.data.username );
  }, [])

  const valuetext = (value: number) => {
    return `${value}`;
  }

  const handleAccept = () => {
    setAccepted(!accepted)
  }

  const getNotification = (personIdentifier) => {
    let url = `/api/db/admin/notifications/getNotificationsByID?personIdentifier=${personIdentifier || ""}`
    fetch(url, {
      credentials: "same-origin",
      method: 'GET',
      headers: {
        Accept: 'application/json',
        "Content-Type": "application/json",
        'Authorization': reciterConfig.backendApiKey
      },
    }).then(response => response.json())
      .then(data => {
        console.log("data", data)
        if (data.message === "User does not exist") {
          toast.error("User does not exist", {
            position: "top-right",
            autoClose: 2000,
            theme: 'colored'
          });
        } else if(data.message === "No data found"){
          setEmail(data.email);
          setDisableSaveBtn(true);
        }else{
          const { minimumThreshold, suggested, accepted, frequency, email} = data;
          setState(state => ({ ...state, ["minimumThreshold"]: minimumThreshold == 0 ? 3 : minimumThreshold, ["frequency"]: frequency }))
          setSuggested(suggested == 1 ? true : false);
          setEvidance(minimumThreshold == 0 ? false : true);
          setAccepted(accepted == 1 ? true : false);
          setEmail(email);
          setDisableSaveBtn(false);
        }
      })
      .catch(error => {
        console.log(error)
      });
  }

  const handleSuggested = () => {
    setSuggested(!suggested)
  }

  const handleEvidence = () => {
    setEvidance(!evidence)
  }

  const onSave = () => {
    let payload = { frequency, suggested: suggested ? 1 : 0, accepted: accepted === true ? 1 : 0, status: status === true ? 1 : 0, minimumThreshold: suggested ? minimumThreshold : 0, userId :router.query.userId ? router.query.userId : session.data.username ,recipient : notificationEmailCarier || email,isReqFrom :"notificationPref", recipientName :useName   }
    dispatch(saveNotification(payload))
  }

  const handleValueChange = (field, e) => {
    let value = field === "minimumThreshold" ? e.target.value : e;
    if (value >= 3) {
      if (value != '') formErrorsInst[field] = '';
      setState(state => ({ ...state, [field]: value }))
    } else {
      
    }
  }

  const redirectToManageUsers = () => {
    // router.push(`/manageusers/${userId}`)
  }
 
  return (
    <div className={appStyles.mainContainer}>
        <h1 className={styles.header}>Manage Notifications</h1>
      {
        isCuratorSelf && !isSuperUserORCuratorAll && !isReporterAll ? <>
        
          {
            getNotificationsByIdLoading ? <div className="d-flex justify-content-center align-items">  <Loader /></div>
              :
              <>
                <div className="mt-2">
                  <Form.Group className="mb-3" >
                    <Form.Check type="checkbox" checked={accepted} label="A new publication has been accepted on your behalf" onChange={() => handleAccept()} />
                  </Form.Group>
                  <Form.Group className="mb-3" >
                    <Form.Check type="checkbox" checked={suggested} label="A new publication has been suggested" onChange={() => handleSuggested()} />
                  </Form.Group>
                  <div className={styles.nestedMenu}>
                    {/* <Form.Group className="mb-3" >
                      <Form.Check type="checkbox" checked={evidence} label="Minimum evidence score for triggering a notification (higher scores indicate greater confidence)" onChange={() => handleEvidence()} />
                    </Form.Group> */}
                    <p>Minimum evidence score for triggering a notification (higher scores indicate greater confidence)</p>
                     <div className="my-3 mx-4">
                     <Box sx={{ width: 400 }}>
                        <Slider
                          aria-labelledby="track-false-slider"
                          getAriaValueText={valuetext}
                          step={1}
                          min={1}
                          max={10}
                          valueLabelDisplay="auto"
                          marks={stepsCount}
                          track={false}
                          onChange={(e) => handleValueChange("minimumThreshold", e)}
                          value={minimumThreshold}
                          disabled={!suggested}
                        />
                      </Box>
      </div>
                  </div>
                </div>
                <div className="mt-5">
					 
                  <Form.Label >Frequency of notifications</Form.Label>
                  <Form.Select aria-label="Default select example" value={frequency} defaultValue={1} onChange={(e) => handleValueChange("frequency", e.target.value)} className={styles.selectFrequecy}>
                    <option value="1">Daily</option>
                    <option value="7">Every 7 days</option>
                    <option value="14">Every 14 days</option>
                    <option value="28">Every 28 days</option>
                  </Form.Select>
                </div>
               
                <p className="mt-4">Emails will be sent to {notificationEmailCarier || email}</p>
                <Button variant="warning" className="m-2" onClick={() => onSave()} disabled={disableSaveBtn  && !accepted && !suggested} >
                  {saveNotificationsLoading ?
                    <Spinner animation="border" role="status" className="danger">
                      <span className="visually-hidden">Loading...</span>
                    </Spinner> : "Save"}
                </Button>

              </>
          }

          <ToastContainerWrapper />
        </>
          : isSuperUserORCuratorAll && !isCuratorSelf && !isReporterAll ? <div className="noAccessRole">
            <p>Your user does not have the Curator Self role. To edit the Manage Notification preferences for another user, first click on the Manager Users tab.</p>
          </div>
            :  !isSuperUserORCuratorAll && !isCuratorSelf && isReporterAll  ? <div className="noAccessRole">
            </div> :"" }
    </div>
  )
}



export default Notifications;
