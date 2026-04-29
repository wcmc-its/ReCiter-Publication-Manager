import React, { useEffect, useState } from "react";
import styles from './Notifications.module.css';
import appStyles from '../App/App.module.css';
import { useSelector, useDispatch } from "react-redux";
import { RootStateOrAny } from "../../../types/redux";
import Loader from "../Common/Loader";
import { Spinner } from "react-bootstrap";
import { saveNotification } from "../../../redux/actions/actions";
import { useSession } from "next-auth/react";
import { useRouter } from "next/router";
import { reciterConfig } from "../../../../config/local";
import ToastContainerWrapper from '../ToastContainerWrapper/ToastContainerWrapper';
import { allowedPermissions } from "../../../utils/constants";
import { toast } from "react-toastify";
import { reportError } from "../../../utils/reportError";


const Notifications = () => {
  const dispatch = useDispatch()
  const { data: session, status: sessionStatus } = useSession(); const loading = sessionStatus === "loading";
  const router = useRouter()
  const [state, setState] = useState({
    frequency: 70,
    minimumThreshold: 80,
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
  const [userName, setUserName] = useState<string>();
  const [disableSaveBtn, setDisableSaveBtn] = useState(false);
  const [isExistingUser, setIsExistingUser] = useState(true);



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
    let userId = null;
    if(!router.query.userId && session.data.username)
         userId = window.location.pathname.substring(window.location.pathname.lastIndexOf('/')+1)
    else
       userId = router.query.userId ? router.query.userId : session.data.username
    getNotification(userId);
  }, [router.query.userId])

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
    }).then(response => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json();
      })
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
          setState(state => ({ ...state, ["minimumThreshold"]: minimumThreshold == 0 ? 80 : minimumThreshold, ["frequency"]: frequency }))
          setSuggested(suggested == 1 ? true : false);
          setEvidance(minimumThreshold == 0 ? false : true);
          setAccepted(accepted == 1 ? true : false);
          setEmail(email);
          setUserId(userID)
          setDisableSaveBtn(false);
        }
      })
      .catch(error => {
        console.error("[ERR-6010]", error);
        reportError("ERR-6010", "Unable to load notification preferences", error);
        toast.error("Unable to load notification preferences. Please try again. (ERR-6010)", {
          position: "top-right",
          autoClose: 2000,
          theme: 'colored'
        });
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
    let value = field === "minimumThreshold" ? parseInt(e.target.value) : e;
    if (field === "minimumThreshold") {
      setState(state => ({ ...state, [field]: value }))
    } else {
      setState(state => ({ ...state, [field]: value }))
    }
  }

  const sliderPct = ((minimumThreshold) / 100) * 100;
  const sliderBg = `linear-gradient(to right, #1a2133 0%, #1a2133 ${sliderPct}%, #ddd7ce ${sliderPct}%, #ddd7ce 100%)`;

  return (
    <div className={appStyles.mainContainer}>
      <h1 className={styles.header}>Manage Notifications</h1>
      <p className={styles.subtitle}>Control when and how often ReCiter sends you email alerts.</p>

      {(isCuratorSelf || isSuperUserORCuratorAll) ? (
        <>
          {getNotificationsByIdLoading ? (
            <Loader />
          ) : (
            <>
              {/* ── SECTION: Notification triggers ── */}
              <div className={styles.section}>
                <div className={styles.sectionLabel}>Notification triggers</div>
                <div className={styles.card}>
                  <div className={styles.cardHead}>
                    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M8 2a5 5 0 015 5c0 2.5-.8 4-1.5 5H4.5C3.8 11 3 9.5 3 7a5 5 0 015-5zM6 13h4M8 2v-.5"/></svg>
                    Send me an email when…
                  </div>
                  <div className={styles.cardBody}>
                    <div className={styles.toggleRow}>
                      <div className={styles.toggleInfo}>
                        <div className={styles.toggleTitle}>A publication has been accepted on my behalf</div>
                        <div className={styles.toggleDesc}>Notifies you when an admin or curator accepts a publication and attributes it to your profile.</div>
                      </div>
                      {/* eslint-disable-next-line jsx-a11y/label-has-associated-control -- toggle label wraps checkbox; visible text is in sibling div */}
                      <label className={styles.toggle} aria-label="Toggle accepted publication notifications">
                        <input type="checkbox" checked={accepted} onChange={handleAccept} />
                        <span className={styles.toggleSlider}></span>
                      </label>
                    </div>
                    <div className={styles.toggleRow}>
                      <div className={styles.toggleInfo}>
                        <div className={styles.toggleTitle}>A new publication has been suggested</div>
                        <div className={styles.toggleDesc}>Notifies you when ReCiter identifies a new publication that may belong to you and is pending your review.</div>
                      </div>
                      {/* eslint-disable-next-line jsx-a11y/label-has-associated-control -- toggle label wraps checkbox; visible text is in sibling div */}
                      <label className={styles.toggle} aria-label="Toggle suggested publication notifications">
                        <input type="checkbox" checked={suggested} onChange={handleSuggested} />
                        <span className={styles.toggleSlider}></span>
                      </label>
                    </div>
                  </div>
                </div>
              </div>

              {/* ── SECTION: Confidence threshold ── */}
              <div className={styles.section}>
                <div className={styles.sectionLabel}>Confidence threshold</div>
                <div className={styles.card}>
                  <div className={styles.cardHead}>
                    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M2 12l4-4 3 3 5-7"/></svg>
                    Minimum evidence score
                  </div>
                  <div className={styles.cardBody}>
                    <div className={styles.sliderSection}>
                      <div className={styles.sliderHeader}>
                        <div>
                          <div className={styles.sliderTitle}>Only notify me for high-confidence suggestions</div>
                          <div className={styles.sliderDesc}>Higher values reduce noise by filtering out low-confidence matches. A score of 0 notifies you about all suggestions regardless of confidence.</div>
                        </div>
                        <div className={styles.sliderValueBadge}>
                          <div className={styles.sliderValueNum}>{minimumThreshold}</div>
                          <div className={styles.sliderValueLabel}>score</div>
                        </div>
                      </div>
                      <div className={styles.sliderWrap}>
                        <input
                          type="range"
                          min="0"
                          max="100"
                          value={minimumThreshold}
                          step="1"
                          disabled={!suggested}
                          onChange={(e) => handleValueChange("minimumThreshold", e)}
                          style={{ background: sliderBg }}
                        />
                      </div>
                      <div className={styles.sliderScale}>
                        <span>0</span><span>25</span><span>50</span><span>75</span><span>100</span>
                      </div>
                      <div className={styles.sliderHintRow}>
                        <span className={styles.sliderHint}>Notify for all suggestions</span>
                        <span className={styles.sliderHint}>Only very high confidence</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* ── SECTION: Delivery ── */}
              <div className={styles.section}>
                <div className={styles.sectionLabel}>Delivery</div>
                <div className={styles.card}>
                  <div className={styles.cardHead}>
                    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="2" y="4" width="12" height="9" rx="1"/><path d="M2 5l6 5 6-5"/></svg>
                    Email frequency and address
                  </div>
                  <div className={styles.cardBody}>
                    <div className={styles.toggleRow} style={{ borderBottom: 'none', paddingBottom: 0 }}>
                      <div className={styles.toggleInfo}>
                        <div className={styles.toggleTitle}>Notification frequency</div>
                        <div className={styles.toggleDesc}>How often qualifying notifications are batched and sent.</div>
                      </div>
                    </div>
                    <div style={{ marginTop: 10 }}>
                      <select
                        className={styles.fieldSelect}
                        value={frequency}
                        onChange={(e) => handleValueChange("frequency", e.target.value)}
                      >
                        <option value="1">Every day</option>
                        <option value="7">Every 7 days</option>
                        <option value="14">Every 14 days</option>
                        <option value="28">Every 30 days</option>
                      </select>
                    </div>
                    {email && (
                      <div className={styles.emailNote}>
                        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="2" y="4" width="12" height="9" rx="1"/><path d="M2 5l6 5 6-5"/></svg>
                        Emails will be sent to <strong>{email}</strong>
                        <span className={styles.emailNoteHint}>· Change in profile settings</span>
                      </div>
                    )}
                  </div>
                  <div className={styles.formFooter}>
                    <button
                      className={styles.btnSave}
                      onClick={onSave}
                      disabled={(disableSaveBtn && !accepted && !suggested) || !isExistingUser}
                    >
                      {saveNotificationsLoading ? (
                        <Spinner animation="border" size="sm" />
                      ) : (
                        <>
                          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M2 8l4 4 8-8"/></svg>
                          Save preferences
                        </>
                      )}
                    </button>
                    <button className={styles.btnCancel} onClick={() => router.back()}>Cancel</button>
                  </div>
                </div>
              </div>
            </>
          )}
          <ToastContainerWrapper />
        </>
      ) : (!isCuratorSelf || !isReporterAll) ? (
        <div className={styles.noAccess}>
          <p>Your user does not have the Curator Self role. To edit the Manage Notification preferences for another user, first click on the Manage Users tab.</p>
        </div>
      ) : null}
    </div>
  )
}

export default Notifications;
