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


const Notifications = () => {
  const dispatch = useDispatch()
  const [session, loading] = useSession();
  const router = useRouter()
  const [state, setState] = useState({
    frequency: 7,
    minimumThreshold: 8,
  })

  const getNotificationsByIdLoading = useSelector((state: RootStateOrAny) => state.getNotificationsByIdLoading);
  const saveNotificationsLoading = useSelector((state: RootStateOrAny) => state.saveNotificationsLoading);

  const { frequency, minimumThreshold } = state;
  const [formErrorsInst, setformErrInst] = useState<{ [key: string]: any }>({});
  const [accepted, setAccepted] = useState<boolean>(false);
  const [status, setStatus] = useState<boolean>(true);
  const [evidence, setEvidance] = useState<boolean>(false)
  const [suggested, setSuggested] = useState<boolean>(false)
  const [userId, setUserId] = useState<any>("");
  const [email, setEmail] = useState<string>();
  const [isCuratorSelf, setIsCuratorSelf] = useState<boolean>(false);
  const [isSuperUserORCuratorAll, SetIsSuperUserORCuratorAll] = useState<boolean>(false);
  const [isReporterAll, setIsReporterAll] = useState<boolean>(false);
  const [evidenceScoreStepsCount, setEvidenceScoreStepsCount] = useState<any>();
  const [userName, setUserName] = useState<string>();
  const [disableSaveBtn, setDisableSaveBtn] = useState(false);
  const [isExistingUser, setIsExistingUser] = useState(true);




  useEffect(() => {
    const evidenceScore = [];
    [...Array(10)].map((e, i) => {
      let index = i + 1
      let obj = {
        value: index,
        label: index,
      }
      evidenceScore.push(obj);
    })
    setEvidenceScoreStepsCount(evidenceScore);

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
    let userId = null;
    console.log('window location ********************',window.location.pathname);
    //some times router query userId not updating correctly. Hence,reading the userId from window location. 
    // Will be analyzed when we upgrade the next JS and code will be removed if it is obsolete. 
    if(!router.query.userId && session.data.username)
         userId = window.location.pathname.substring(window.location.pathname.lastIndexOf('/')+1)
    else
       userId = router.query.userId ? router.query.userId : session.data.username
    console.log('router details*********',router);
    console.log('router query userId*****************',router.query.userId);
    console.log('session data username******************',session.data.username);
    getNotification(userId);
  }, [])

  const valuetext = (value: number) => {
    return `${value}`;
  }

  const handleAccept = () => {
    setAccepted(!accepted)
  }

  const getNotification = (personIdentifier) => {
    console.log('personIdentifier*****************',personIdentifier);
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
        if (data.message === "User does not exist") {
          setDisableSaveBtn(true);
          setIsExistingUser(false);
          setEmail(data.email);
          toast.error("User does not exist", {
            position: "top-right",
            autoClose: 2000,
            theme: 'colored'
          });
        } else if(data.message === "No data found"){
          setEmail(data.email);
          setUserId(data.userID)
          setDisableSaveBtn(true);
        }else{
          const { minimumThreshold, suggested, accepted, frequency, email,userID} = data;
          setState(state => ({ ...state, ["minimumThreshold"]: minimumThreshold == 0 ? 8 : minimumThreshold, ["frequency"]: frequency }))
          setSuggested(suggested == 1 ? true : false);
          setEvidance(minimumThreshold == 0 ? false : true);
          setAccepted(accepted == 1 ? true : false);
          setEmail(email);
          setUserId(userID)
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
  const onSave = () => {
    let payload = { frequency, suggested: suggested ? 1 : 0, accepted: accepted === true ? 1 : 0, status: status === true ? 1 : 0, minimumThreshold: suggested ? minimumThreshold : 0, personIdentifier :router.query.userId ? router.query.userId : session.data.username ,userID :userId ? userId:'' ,recipient : email,isReqFrom :"notificationPref", recipientName :userName   }
    dispatch(saveNotification(payload))
  }

  const handleValueChange = (field, e) => {
    let value = field === "minimumThreshold" ? e.target.value : e;
    if (value >= 3 && suggested) {
      if (value != '') formErrorsInst[field] = '';
      setState(state => ({ ...state, [field]: value }))
    } 
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
                          marks={evidenceScoreStepsCount}
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
               
                <p className="mt-4">Emails will be sent to {email}</p>
                <Button variant="warning" className="m-2" onClick={() => onSave()} disabled={(disableSaveBtn  && !accepted && !suggested) || !isExistingUser} >
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
