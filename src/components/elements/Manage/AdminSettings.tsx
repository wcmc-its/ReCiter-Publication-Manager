import React, { useState, useEffect, useMemo } from "react";
import { useSelector, useDispatch } from "react-redux";
import { RootStateOrAny } from "../../../types/redux";
import { reciterConfig } from '../../../../config/local';
import { updatedAdminSettings } from "../../../redux/actions/actions";
import appStyles from '../App/App.module.css';
import styles from "./AdminSettings.module.css";
import Loader from "../Common/Loader";
import { toast } from "react-toastify";
import { reportError } from "../../../utils/reportError";
import ToastContainerWrapper from "../ToastContainerWrapper/ToastContainerWrapper";
import moment from 'moment-timezone';

/* ── Group classification ── */
const getGroup = (viewLabel: string): string => {
  const l = (viewLabel || '').toLowerCase();
  // Check Reporting first (some labels like "Reporting Web Display" contain 'display')
  if (l.includes('report') || l.includes('csv') || l.includes('rtf') ||
      l.includes('web display') || l.includes('web view') || l.includes('sort') || l.includes('authorship'))
    return 'Reporting';
  if (l.includes('find people') || l.includes('findpeople') || (l.includes('view') && l.includes('profile')) || l.includes('role'))
    return 'People';
  if (l.includes('display') || (l.includes('email') && l.includes('notification')) || l.includes('headshot'))
    return 'General';
  return 'General';
};

/* ── Icons for each setting ── */
const getIcon = (viewLabel: string): JSX.Element => {
  const l = (viewLabel || '').toLowerCase();
  // Check specific patterns before generic ones
  if (l.includes('web display'))
    return <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="2" y="3" width="12" height="10" rx="1.5"/><path d="M5 7h6M5 10h4"/></svg>;
  if (l.includes('web view') || l.includes('sort'))
    return <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M4 3v10M4 13l-2-2M4 13l2-2M12 3v10M12 3l-2 2M12 3l2 2"/></svg>;
  if (l.includes('display'))
    return <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M2 3h12v8H2zM5 14h6"/><path d="M8 11v3"/></svg>;
  if (l.includes('email') && l.includes('notification'))
    return <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="2" y="4" width="12" height="9" rx="1"/><path d="M2 5l6 5 6-5"/></svg>;
  if (l.includes('headshot'))
    return <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="2" y="2" width="12" height="12" rx="2"/><circle cx="8" cy="6" r="2"/><path d="M4 13c0-2.21 1.79-4 4-4s4 1.79 4 4"/></svg>;
  if (l.includes('find') && l.includes('people'))
    return <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="6.5" cy="6.5" r="4"/><path d="M11 11l2.5 2.5"/></svg>;
  if (l.includes('view') && l.includes('profile'))
    return <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="8" cy="5.5" r="2.5"/><path d="M3 13c0-2.76 2.24-5 5-5s5 2.24 5 5"/></svg>;
  if (l.includes('role'))
    return <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="8" cy="5.5" r="2.5"/><path d="M3 13c0-2.76 2.24-5 5-5s5 2.24 5 5"/><path d="M12 2l1.5 1.5-4 4"/></svg>;
  if (l.includes('csv') && l.includes('article'))
    return <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M3 2h7l4 4v9H3z"/><path d="M10 2v4h4"/><path d="M5 9h6M5 12h4"/></svg>;
  if (l.includes('rtf'))
    return <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M3 2h7l4 4v9H3z"/><path d="M10 2v4h4"/><path d="M5 7h2M5 10h6M5 13h4"/></svg>;
  if (l.includes('authorship'))
    return <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M3 2h7l4 4v9H3z"/><path d="M10 2v4h4"/><path d="M5 9h6M5 12h3"/></svg>;
  if (l.includes('filter'))
    return <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M2 4h12M4 8h8M6 12h4"/></svg>;
  return <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="8" cy="8" r="2"/><path d="M8 2v2M8 12v2M2 8h2M12 8h2"/></svg>;
};

/* ── Descriptions for each setting ── */
const getDescription = (viewLabel: string): string => {
  const l = (viewLabel || '').toLowerCase();
  if (l.includes('web display')) return 'Layout and column settings for the report results view';
  if (l.includes('web view') || l.includes('sort')) return 'Default sort field and direction for report results';
  if (l.includes('display')) return 'Custom banners and notices shown to all users';
  if (l.includes('email') && l.includes('notification')) return 'Automated digest and alert email settings';
  if (l.includes('headshot')) return 'Source URL pattern for faculty profile photos';
  if (l.includes('find') && l.includes('people')) return 'Default filters and display settings for the people list';
  if (l.includes('view') && l.includes('profile')) return 'Sections and fields visible on the public faculty profile page';
  if (l.includes('role')) return 'Roles automatically assigned to new user accounts on creation';
  if (l.includes('csv') && l.includes('article')) return 'Column selection and row limits for CSV reports';
  if (l.includes('rtf')) return 'Layout and record limits for RTF bibliography reports';
  if (l.includes('authorship')) return 'Fields and limits for authorship-level CSV reports';
  if (l.includes('filter')) return 'Default filter values applied to new reports';
  return '';
};

const GROUP_ORDER = ['General', 'People', 'Reporting'];

const AdminSettings = () => {
  const createORupdateUserID = useSelector((state: RootStateOrAny) => state.createORupdateUserID);

  const [loading, setLoading] = useState(false);
  const [settings, setSettings] = useState([]);
  const [openSections, setOpenSections] = useState<Set<string>>(new Set());
  const [personIdentifierError, setPersonIdentifierError] = useState('');
  const [emailDeliveredTime, setEmailDeliveredTime] = useState("");
  const [emailRecipient, setEmailRecipient] = useState("");
  const [isSendTestEmail, setIsSendTestEmail] = useState(false);
  const [noConfiguredNotifMsg, setNoConfiguredNotifMsg] = useState("");
  const [noEligiblePubNotifMsg, setNoEligiblePubNotifMsg] = useState("");
  const [successEmailNotifMsg, setSuccessEmailNotifMsg] = useState("");
  const [senTestEmailLoading, setSendTestEmailLoading] = useState(false);
  const [emailError, setEmailError] = useState('');

  const dispatch = useDispatch();

  useEffect(() => {
    fetchAllAdminSettings();
  }, []);

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
            viewName: obj.viewName,
            viewAttributes: c,
            viewLabel: obj.viewLabel
          }
          parsedSettingsArray.push(parsedSettings)
        })
        setSettings(parsedSettingsArray);
        setLoading(false);
      })
      .catch(error => {
        console.error("[ERR-9001]", error);
        reportError("ERR-9001", "Unable to load settings", error);
        setLoading(false);
        toast.error("Unable to load settings. Please try again. (ERR-9001)", {
          position: "top-right",
          autoClose: 2000,
          theme: 'colored'
        });
      });
  }

  const handleValueChange = (viewLabelIndex?: number, viewAttrIndex?: number, name?: string, e?: any, labelName?: string | number) => {
    if (name === "personIdentifier" || name === "emailOverride") setIsSendTestEmail(false);

    setSettings(settings.map((obj, index1) => {
      if (index1 == viewLabelIndex) {
        return {
          ...obj,
          viewAttributes:
            obj.viewAttributes.map((innerObj, index2) => {
              if (index2 == viewAttrIndex) {
                if (name === "isVisible") return { ...innerObj, [name]: !innerObj.isVisible }
                else if (name === "useEmailForScheduledJobs") return { ...innerObj, [name]: !innerObj.useEmailForScheduledJobs }
                else if (labelName === "Reporting Article RTF" && e.target.value > 30000) return { ...innerObj, [name]: e.target.value || 0, ["isValidate"]: true }
                else if (labelName === "Reporting Article RTF" && e.target.value < 30000) return { ...innerObj, [name]: e.target.value || 0, ["isValidate"]: false }
                else if (name === "isChecked" && innerObj.hasOwnProperty('isRoleGroup')) {
                  return {
                    ...innerObj,
                    roles:
                      innerObj.roles.map((rolesInfo, rolesIndex) => {
                        if (!innerObj.isRoleGroup) {
                          if (rolesIndex === labelName) return { ...rolesInfo, [name]: !rolesInfo.isChecked }
                          else return { ...rolesInfo }
                        } else {
                          if (rolesIndex === labelName) return { ...rolesInfo, [name]: !rolesInfo.isChecked }
                          else return { ...rolesInfo, [name]: false }
                        }
                      })
                  }
                }
                else {
                  if (name === "personIdentifier") setPersonIdentifierError("")
                  if (name === "emailOverride") setEmailError("")
                  return { ...innerObj, [name]: e.target.value }
                }
              }
              else return { ...innerObj }
            })
        }
      } else {
        let ParsedObj = typeof(obj.viewAttributes) === "object" ? obj.viewAttributes : JSON.stringify(obj.viewAttributes)
        let parsed = typeof(ParsedObj) === "object" ? ParsedObj : JSON.parse(ParsedObj)
        let newObj = {
          viewName: obj.viewName,
          viewAttributes: typeof(parsed) === "object" ? parsed : JSON.parse(parsed),
          viewLabel: obj.viewLabel
        }
        return newObj
      }
    }))
  }

  const handleSubmit = () => {
    setLoading(true);
    const request = { data: settings };
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
        const parsed = (data || []).map(obj => ({
          ...obj,
          viewAttributes: typeof obj.viewAttributes === 'string' ? JSON.parse(obj.viewAttributes) : obj.viewAttributes
        }));
        dispatch(updatedAdminSettings(parsed))
        setSettings(parsed);
        setIsSendTestEmail(false);
        setLoading(false);
      })
      .catch(error => {
        console.error("[ERR-9002]", error);
        reportError("ERR-9002", "Unable to save settings", error);
        setLoading(false);
        toast.error("Unable to save settings. Please try again. (ERR-9002)", {
          position: "top-right",
          autoClose: 2000,
          theme: 'colored'
        });
      });
  }

  const sendTestEmail = (personIdentifier, emailRecipient) => {
    let personIdentifiersStr = '';
    if (personIdentifier && personIdentifier.length > 0) {
      let personIdentifierArr = personIdentifier.split(',');
      personIdentifiersStr = personIdentifierArr.map(s => s.trim()).join(',');
    }
    if (!emailRecipient || emailRecipient.length <= 0) {
      setEmailError("Email is required");
      return;
    }
    let emailSentDate = moment(new Date().toUTCString()).tz("America/New_York").format("hh:mm A zz")
    setEmailDeliveredTime(emailSentDate);
    setSuccessEmailNotifMsg("");
    setNoEligiblePubNotifMsg("");
    setNoConfiguredNotifMsg("");
    if (personIdentifiersStr && personIdentifiersStr.length > 0) {
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
          if (data && data.noConfiguredNotificationMsg)
            setNoConfiguredNotifMsg(data.noConfiguredNotificationMsg);
          if (data && data.noEligiblePubNotifMsg)
            setNoEligiblePubNotifMsg(data.noEligiblePubNotifMsg);
          if (data && data.successEmailNotifMsg) {
            setSuccessEmailNotifMsg(data.successEmailNotifMsg);
          }
          setSendTestEmailLoading(false);
          toast.success("Test email sent Successfully - to " + payLoad.emailOverride, {
            position: "top-right",
            autoClose: 4000,
            theme: 'colored'
          });
        }
      }).catch(error => {
        console.error("[ERR-9003]", error);
        reportError("ERR-9003", "Unable to send test email", error);
        setSendTestEmailLoading(false);
        toast.error("Unable to send test email. Please try again. (ERR-9003)", {
          position: "top-right",
          autoClose: 2000,
          theme: 'colored'
        });
      })
    } else {
      setPersonIdentifierError("Person Identifier(s) are required");
    }
  }

  const toggleSection = (key: string) => {
    setOpenSections(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const groupedSettings = useMemo(() => {
    const groups = GROUP_ORDER.map(label => ({
      label,
      items: [] as { setting: any; originalIndex: number }[]
    }));

    settings.forEach((setting: any, index: number) => {
      const groupName = getGroup(setting.viewLabel);
      const target = groups.find(g => g.label === groupName);
      if (target) target.items.push({ setting, originalIndex: index });
      else groups[0].items.push({ setting, originalIndex: index });
    });

    return groups.filter(g => g.items.length > 0);
  }, [settings]);

  return (
    <div className={appStyles.mainContainer}>
      <h1 className={styles.pageTitle}>Configuration</h1>

      <div className={styles.infoBanner}>
        <svg className={styles.infoBannerIcon} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
          <circle cx="8" cy="8" r="6"/><path d="M8 7v4M8 5.5v.5"/>
        </svg>
        Changes apply to all users and take effect on next login.
      </div>

      {loading ? (
        <div className="d-flex justify-content-center align-items"><Loader /></div>
      ) : (
        groupedSettings.map(group => (
          <div key={group.label} className={styles.settingsGroup}>
            <div className={styles.groupLabel}>{group.label}</div>
            <div className={styles.accordion}>
              {group.items.map(({ setting, originalIndex }) => {
                const accKey = `acc-${originalIndex}`;
                const isOpen = openSections.has(accKey);

                return (
                  <div key={accKey} className={styles.accItem}>
                    <button
                      className={`${styles.accTrigger} ${isOpen ? styles.accTriggerOpen : ''}`}
                      onClick={() => toggleSection(accKey)}
                    >
                      <div className={styles.accTriggerLeft}>
                        <div className={`${styles.accTriggerIcon} ${isOpen ? styles.accTriggerIconOpen : ''}`}>
                          {getIcon(setting.viewLabel)}
                        </div>
                        <div>
                          <div className={styles.accName}>{setting.viewLabel}</div>
                          <div className={styles.accDesc}>{getDescription(setting.viewLabel)}</div>
                        </div>
                      </div>
                      <svg className={`${styles.accChevron} ${isOpen ? styles.accChevronOpen : ''}`} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M4 6l4 4 4-4"/>
                      </svg>
                    </button>

                    {isOpen && (
                      <div className={styles.accBody}>
                        {setting.viewAttributes.map((innerObj: any, viewAttrIndex: number) => {
                          const viewLabelIndex = originalIndex;
                          const {
                            labelSettingsView, labelUserView, errorMessage, isValidate,
                            labelUserKey, helpTextSettingsView, isVisible, helpTextUserView,
                            maxLimit, syntax, displayRank, roles, personIdentifier,
                            emailOverride, submitButton, useEmailForScheduledJobs
                          } = innerObj;

                          /* Detect "toggle-only" attributes */
                          const isToggleOnly = innerObj.hasOwnProperty('isVisible') &&
                            !innerObj.hasOwnProperty('labelUserView') &&
                            !innerObj.hasOwnProperty('helpTextUserView') &&
                            !innerObj.hasOwnProperty('syntax') &&
                            !innerObj.hasOwnProperty('maxLimit') &&
                            !innerObj.hasOwnProperty('displayRank') &&
                            !innerObj.hasOwnProperty('isRoleGroup') &&
                            !innerObj.hasOwnProperty('personIdentifier') &&
                            !innerObj.hasOwnProperty('emailOverride');

                          return (
                            <div key={viewAttrIndex} className={styles.setting}>
                              {isToggleOnly ? (
                                /* ── Toggle-only row ── */
                                <div className={styles.toggleRow}>
                                  <div className={styles.toggleInfo}>
                                    <div className={styles.settingTitle}>{labelSettingsView}</div>
                                    {helpTextSettingsView && (
                                      <div className={styles.settingDesc}>{helpTextSettingsView}</div>
                                    )}
                                  </div>
                                  <label className={styles.toggle}>
                                    <input
                                      type="checkbox"
                                      checked={isVisible}
                                      onChange={(e) => handleValueChange(viewLabelIndex, viewAttrIndex, "isVisible", e)}
                                    />
                                    <span className={`${styles.toggleSlider} ${isVisible ? styles.toggleChecked : ''}`} />
                                  </label>
                                </div>
                              ) : (
                                /* ── Multi-field setting ── */
                                <>
                                  {/* Header */}
                                  {labelSettingsView && (
                                    <div className={styles.settingHeader}>
                                      <div className={styles.settingTitle}>{labelSettingsView}</div>
                                      {helpTextSettingsView && (
                                        <div className={styles.settingDesc}>{helpTextSettingsView}</div>
                                      )}
                                    </div>
                                  )}

                                  {/* isVisible toggle */}
                                  {innerObj.hasOwnProperty('isVisible') && (
                                    <div className={styles.toggleRow} style={{ marginBottom: 12 }}>
                                      <div className={styles.settingDesc}>
                                        {labelUserKey === 'emailNotifications' ? 'Enabled' : 'Visible'}
                                      </div>
                                      <label className={styles.toggle}>
                                        <input
                                          type="checkbox"
                                          checked={isVisible}
                                          onChange={(e) => handleValueChange(viewLabelIndex, viewAttrIndex, "isVisible", e)}
                                        />
                                        <span className={`${styles.toggleSlider} ${isVisible ? styles.toggleChecked : ''}`} />
                                      </label>
                                    </div>
                                  )}

                                  {/* Label override - text input */}
                                  {innerObj.hasOwnProperty('labelUserView') && labelSettingsView !== "Email signature" && (
                                    <>
                                      <div className={styles.subLabel}>Label Override</div>
                                      <input
                                        className={styles.fieldInput}
                                        type="text"
                                        placeholder="Label override"
                                        value={labelUserView}
                                        onChange={(e) => handleValueChange(viewLabelIndex, viewAttrIndex, "labelUserView", e)}
                                      />
                                    </>
                                  )}

                                  {/* Label - textarea (Email signature) */}
                                  {innerObj.hasOwnProperty('labelUserView') && labelSettingsView === "Email signature" && (
                                    <>
                                      <div className={styles.subLabel}>Label</div>
                                      <textarea
                                        className={styles.fieldTextarea}
                                        placeholder="Label"
                                        value={labelUserView}
                                        rows={3}
                                        onChange={(e) => handleValueChange(viewLabelIndex, viewAttrIndex, "labelUserView", e)}
                                      />
                                    </>
                                  )}

                                  {/* Help text */}
                                  {innerObj.hasOwnProperty('helpTextUserView') && (
                                    <>
                                      <div className={styles.subLabel}>Help Text</div>
                                      <textarea
                                        className={styles.fieldTextarea}
                                        placeholder="Help text"
                                        value={helpTextUserView}
                                        onChange={(e) => handleValueChange(viewLabelIndex, viewAttrIndex, "helpTextUserView", e)}
                                      />
                                    </>
                                  )}

                                  {/* Image path (syntax) */}
                                  {innerObj.hasOwnProperty('syntax') && (
                                    <>
                                      <div className={styles.subLabel}>Image Path</div>
                                      <input
                                        className={styles.fieldInput}
                                        type="text"
                                        placeholder="Image path URL"
                                        value={syntax || ""}
                                        onChange={(e) => handleValueChange(viewLabelIndex, viewAttrIndex, "syntax", e)}
                                      />
                                    </>
                                  )}

                                  {/* Display rank */}
                                  {innerObj.hasOwnProperty('displayRank') && (
                                    <>
                                      <div className={styles.subLabel}>Display Rank</div>
                                      <div className={styles.settingField}>
                                        <input
                                          className={styles.fieldInputSmall}
                                          type="text"
                                          placeholder="Rank"
                                          value={displayRank}
                                          onChange={(e) => handleValueChange(viewLabelIndex, viewAttrIndex, "displayRank", e, setting.viewLabel)}
                                        />
                                      </div>
                                    </>
                                  )}

                                  {/* Person identifier */}
                                  {innerObj.hasOwnProperty('personIdentifier') && (
                                    <>
                                      <div className={styles.subLabel}>Person Identifier(s)</div>
                                      <textarea
                                        className={styles.fieldTextarea}
                                        placeholder="PersonIdentifier1, PersonIdentifier2, PersonIdentifier3, etc"
                                        value={personIdentifier}
                                        rows={3}
                                        onChange={(e) => handleValueChange(viewLabelIndex, viewAttrIndex, "personIdentifier", e, setting.viewLabel)}
                                      />
                                      {personIdentifierError && personIdentifier === "" && (
                                        <p className={styles.errorMessage}>{personIdentifierError}</p>
                                      )}
                                    </>
                                  )}

                                  {/* Email override */}
                                  {innerObj.hasOwnProperty('emailOverride') && (
                                    <>
                                      <div className={styles.subLabel}>Email</div>
                                      <input
                                        className={styles.fieldInput}
                                        type="text"
                                        placeholder="Recipient email address"
                                        value={emailOverride}
                                        onChange={(e) => handleValueChange(viewLabelIndex, viewAttrIndex, "emailOverride", e, setting.viewLabel)}
                                      />
                                      {emailError && emailOverride === "" && (
                                        <p className={styles.errorMessage}>{emailError}</p>
                                      )}
                                    </>
                                  )}

                                  {/* Use email for scheduled jobs */}
                                  {innerObj.hasOwnProperty('useEmailForScheduledJobs') && (
                                    <div className={styles.toggleRow} style={{ marginTop: 12 }}>
                                      <div className={styles.settingDesc}>Use Email Override in all regularly scheduled jobs</div>
                                      <label className={styles.toggle}>
                                        <input
                                          type="checkbox"
                                          checked={useEmailForScheduledJobs}
                                          onChange={(e) => handleValueChange(viewLabelIndex, viewAttrIndex, "useEmailForScheduledJobs", e)}
                                        />
                                        <span className={`${styles.toggleSlider} ${useEmailForScheduledJobs ? styles.toggleChecked : ''}`} />
                                      </label>
                                    </div>
                                  )}

                                  {/* Send test email button */}
                                  {innerObj.hasOwnProperty('submitButton') && (
                                    <div style={{ marginTop: 10 }}>
                                      <button
                                        className={styles.btnTestEmail}
                                        onClick={() => sendTestEmail(personIdentifier, emailOverride)}
                                      >
                                        {senTestEmailLoading && <span className={styles.spinner} />}
                                        {senTestEmailLoading ? 'Sending...' : 'Send test email'}
                                      </button>
                                      {isSendTestEmail && (
                                        <div className={styles.emailResults}>
                                          {noConfiguredNotifMsg && <p>{noConfiguredNotifMsg}</p>}
                                          {noEligiblePubNotifMsg && <p>{noEligiblePubNotifMsg}</p>}
                                          {successEmailNotifMsg && (
                                            <p>{successEmailNotifMsg} <span>{emailRecipient}</span> at {emailDeliveredTime}.</p>
                                          )}
                                        </div>
                                      )}
                                    </div>
                                  )}

                                  {/* Max limit - text input */}
                                  {innerObj.hasOwnProperty('maxLimit') && labelUserKey !== "suggestedEmailNotificationsLimit" && labelUserKey !== "acceptedEmailNotificationsLimit" && (
                                    <>
                                      <div className={styles.subLabel}>Max Limit</div>
                                      <div className={styles.settingField}>
                                        <input
                                          className={styles.fieldInputSmall}
                                          type="number"
                                          placeholder="Max Limit"
                                          value={maxLimit}
                                          onChange={(e) => handleValueChange(viewLabelIndex, viewAttrIndex, "maxLimit", e, setting.viewLabel)}
                                        />
                                        {isValidate && (
                                          <span className={styles.fieldHint}>
                                            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="8" cy="8" r="6"/><path d="M8 7v4M8 5.5v.5"/></svg>
                                            {errorMessage}
                                          </span>
                                        )}
                                      </div>
                                    </>
                                  )}

                                  {/* Max limit - select (email notification limits) */}
                                  {innerObj.hasOwnProperty('maxLimit') && (labelUserKey === "suggestedEmailNotificationsLimit" || labelUserKey === "acceptedEmailNotificationsLimit") && (
                                    <>
                                      <div className={styles.subLabel}>Max Limit</div>
                                      <div className={styles.settingField}>
                                        <select
                                          className={styles.fieldSelect}
                                          value={maxLimit}
                                          onChange={(e) => handleValueChange(viewLabelIndex, viewAttrIndex, "maxLimit", e, setting.viewLabel)}
                                        >
                                          {[...Array(20)].map((_, i) => (
                                            <option key={i} value={1 + i}>{1 + i}</option>
                                          ))}
                                        </select>
                                      </div>
                                    </>
                                  )}

                                  {/* Roles checkboxes */}
                                  {innerObj.hasOwnProperty('isRoleGroup') && (
                                    <div className={styles.checkboxList}>
                                      {roles.map((roleInfo: any, rolesIndex: number) => (
                                        <label key={rolesIndex} className={styles.checkboxLabel}>
                                          <input
                                            type="checkbox"
                                            checked={roleInfo.isChecked}
                                            onChange={(e) => handleValueChange(viewLabelIndex, viewAttrIndex, "isChecked", e, rolesIndex)}
                                          />
                                          {roleInfo.roleLabel}
                                        </label>
                                      ))}
                                    </div>
                                  )}
                                </>
                              )}
                            </div>
                          );
                        })}

                        {/* Save / Cancel per section */}
                        <div className={styles.saveRow}>
                          <button className={styles.btnSave} onClick={handleSubmit}>Save</button>
                          <button className={styles.btnCancel} onClick={fetchAllAdminSettings}>Cancel</button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))
      )}

      <ToastContainerWrapper />
    </div>
  );
}

export default AdminSettings;
