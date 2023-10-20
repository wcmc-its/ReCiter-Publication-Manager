import React, { useEffect, useState } from "react";
import styles from './Notifications.module.css';
import appStyles from '../App/App.module.css';
import { useSelector, useDispatch, RootStateOrAny } from "react-redux";
import Loader from "../Common/Loader";
import { Form, Button, Spinner } from "react-bootstrap";
import { saveNotification, sendNotification, sendEmailData, disableNotificationbyID } from "../../../redux/actions/actions";
import { useSession } from "next-auth/client";
import { useRouter } from "next/router";
import { reciterConfig } from "../../../../config/local";
import ToastContainerWrapper from '../ToastContainerWrapper/ToastContainerWrapper';
import { allowedPermissions } from "../../../utils/constants";
import { toast } from "react-toastify"
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


  useEffect(() => {
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

    setUserId(router.query.userId)
    if (router.query.userId === session.data.username) setEmail(session.data.email)
    else setEmail(notificationEmailCarier)
    // dispatch(getNotificationByID(router.query.userId))
    getNotification(router.query.userId);
  }, [])

  const handleAccept = () => {
    setAccepted(!accepted)
  }

  const getNotification = (personIdentifier) => {
    let url = `/api/db/admin/notifications/getNotificationsByID?personIdentifier=${personIdentifier || ''}`;
    return fetch(url, {
      credentials: "same-origin",
      method: 'GET',
      headers: {
        Accept: 'application/json',
        'Authorization': reciterConfig.backendApiKey
      },
    }).then(response => response.json())
      .then(data => {
        console.log("data", data)
        if ('userID' in data) {
          const { minimumThreshold, suggested, accepted, frequency } = data;
          setState(state => ({ ...state, ["minimumThreshold"]: minimumThreshold, ["frequency"]: frequency }))
          setSuggested(suggested == 1 ? true : false);
          setEvidance(minimumThreshold == 0 ? false : true);
          setAccepted(accepted == 1 ? true : false);
        } else {
          toast.error("User Doest Not Exist", {
            position: "top-right",
            autoClose: 2000,
            theme: 'colored'
          });
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
    let payload = { frequency, suggested: suggested ? 1 : 0, accepted: accepted === true ? 1 : 0, status: status === true ? 1 : 0, minimumThreshold: evidence ? minimumThreshold : 0, userId }
    dispatch(saveNotification(payload))
  }

  const handleValueChange = (field, value) => {
    if (value != '') formErrorsInst[field] = '';
    setState(state => ({ ...state, [field]: value }))
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
                  <Form.Group className="mb-3" controlId="formBasicCheckbox">
                    <Form.Check type="checkbox" checked={accepted} label="Accepted publications notifications" onChange={() => handleAccept()} />
                  </Form.Group>
                  <Form.Group className="mb-3" controlId="formBasicCheckbox">
                    <Form.Check type="checkbox" checked={suggested} label="Suggested publications notifications" onChange={() => handleSuggested()} />
                  </Form.Group>
                  <div className={styles.nestedMenu}>
                    <Form.Group className="mb-3" controlId="formBasicCheckbox">
                      <Form.Check type="checkbox" checked={evidence} label="Choose minimum Evidence Score for triggering a notification (higher scores indicate greater confidence)" onChange={() => handleEvidence()} />
                    </Form.Group>
                    <Form.Select aria-label="Default select example" value={minimumThreshold} disabled={!evidence} onChange={(e) => handleValueChange("minimumThreshold", e.target.value)} className={styles.selectCount}>
                      {/* <option>7</option> */}
                      <option value="10">10</option>
                      <option value="9">9</option>
                      <option value="8">8</option>
                      <option value="7">7</option>
                      <option value="6">6</option>
                      <option value="5">5</option>
                      <option value="4">4</option>
                    </Form.Select>
                  </div>
                </div>
                <p></p>
                <div>
                  <Form.Label className="fw">Frequency of notifications</Form.Label>
                  <Form.Select aria-label="Default select example" value={frequency} defaultValue={1} onChange={(e) => handleValueChange("frequency", e.target.value)} className={styles.selectFrequecy}>
                    <option value="1">Daily</option>
                    <option value="7">Every 7 days</option>
                    <option value="14">Every 14 days</option>
                    <option value="28">Every 28 days</option>
                  </Form.Select>
                </div>
                <p className="mt-3">Emails will be sent to {notificationEmailCarier || email}</p>
                <Button variant="warning" className="m-2" onClick={() => onSave()} >
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
              <p>Currently there is no way to test this as reporter all role we don't show Manage Notifications page at all</p>
            </div> :"" }
    </div>
  )
}

export default Notifications;