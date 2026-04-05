import React, { useEffect, useState } from "react";
import styles from './ManageProfile.module.css';
import { useSelector, useDispatch } from "react-redux";
import { RootStateOrAny } from "../../../types/redux";
import { useSession } from "next-auth/react";
import { useRouter } from "next/router";
import ToastContainerWrapper from '../ToastContainerWrapper/ToastContainerWrapper';
import { reciterConfig } from "../../../../config/local";
import { toast } from "react-toastify";
import { reportError } from "../../../utils/reportError";
import { allowedPermissions } from "../../../utils/constants";
import Loader from "../Common/Loader";

const ManageProfle = () => {
    const dispatch = useDispatch()
    const { data: session, status } = useSession(); const loading = status === "loading";
    const router = useRouter()
    const [suggested, setSuggested] = useState<boolean>(false);
    const [manualORCID, setManualORCID] = useState('');
    const [profileData, setProfileData] = useState([]);
    const [selectedOrcidValue, setSelectOrcid] = useState('');
    const [clearRadioBtns, setClearRadioBtns] = useState(false)
    const [loadProfileData, setLoadProfileData] = useState(false)
    const [errorMessage, setErrorMessage] = useState('');
    const [isCuratorSelf, setIsCuratorSelf] = useState<boolean>(false);
    const [isSuperUserORCuratorAll, SetIsSuperUserORCuratorAll] = useState<boolean>(false);
    const [isReporterAll, setIsReporterAll] = useState<boolean>(false);
    const [serverValue, setServerValue] = useState('');
    const [identityOrcid, setIdentityOrcid] = useState<string | null>(null);

    useEffect(() => {
        let userPermissions = JSON.parse(session.data.userRoles);
        let curatorSelfRole = userPermissions.some(role => role.roleLabel === allowedPermissions.Curator_Self);
        let curatorAllfRole = userPermissions.some(role => role.roleLabel === allowedPermissions.Curator_All);
        let superUserRole = userPermissions.some(role => role.roleLabel === allowedPermissions.Superuser);

        if (router.query.userId === session.data.username) {
            if (!curatorSelfRole) {
                if (superUserRole || curatorAllfRole) {
                    SetIsSuperUserORCuratorAll(true)
                } else {
                    setIsReporterAll(true)
                }
            } else {
                setIsCuratorSelf(true)
            }
        } else {
            setIsCuratorSelf(true)
        }
        let userId = null;
        if (!router.query.userId && session.data.username)
            userId = window.location.pathname.substring(window.location.pathname.lastIndexOf('/') + 1)
        else
            userId = router.query.userId ? router.query.userId : session.data.username
        getManageProfileData(userId)
        fetchIdentityOrcid(userId)
    }, [router.query.userId])

    const fetchIdentityOrcid = (personIdentifier) => {
        fetch(`/api/reciter/getidentity/${personIdentifier}`, {
            credentials: "same-origin",
            method: 'GET',
            headers: {
                Accept: 'application/json',
                'Authorization': reciterConfig.backendApiKey
            },
        })
            .then(response => response.json())
            .then(data => {
                if (data.statusCode === 200 && data.identity) {
                    setIdentityOrcid(data.identity.orcid || null)
                }
            })
            .catch(error => {
                console.log('Failed to fetch Identity ORCID:', error)
            })
    }

    const onSave = () => {
        const orcidValue = manualORCID || selectedOrcidValue;
        const uid = router.query.userId as string;
        // Save to DynamoDB via Identity API
        fetch(`/api/reciter/saveIdentityOrcid`, {
            credentials: "same-origin",
            method: 'POST',
            headers: {
                Accept: 'application/json',
                "Content-Type": "application/json",
                'Authorization': reciterConfig.backendApiKey
            },
            body: JSON.stringify({ personIdentifier: uid, orcid: orcidValue })
        }).then(response => response.json())
        .then(data => {
            if (data.success) {
                toast.success("ORCID Saved Successfully", {
                    position: "top-right",
                    autoClose: 2000,
                    theme: 'colored'
                });
                setIdentityOrcid(orcidValue);
                getManageProfileData(uid);
            } else {
                throw new Error(data.error || 'Save failed');
            }
        }).catch(error => {
            console.error("[ERR-1010]", error);
            reportError("ERR-1010", "Unable to save ORCID", error);
            toast.error("Unable to save ORCID. Please try again. (ERR-1010)", {
                position: "top-right",
                autoClose: 2000,
                theme: 'colored'
            });
        })
    }

    const onReset = () => {
        const uid = router.query.userId as string;
        fetch(`/api/reciter/saveIdentityOrcid`, {
            credentials: "same-origin",
            method: 'POST',
            headers: {
                Accept: 'application/json',
                "Content-Type": "application/json",
                'Authorization': reciterConfig.backendApiKey
            },
            body: JSON.stringify({ personIdentifier: uid, orcid: '' })
        })
            .then(res => res.json())
            .then(data => {
                if (data.success) {
                    toast.success("ORCID has been deleted successfully", {
                        position: "top-right",
                        autoClose: 2000,
                        theme: 'colored'
                    });
                    setManualORCID("");
                    setSelectOrcid("");
                    setIdentityOrcid(null);
                } else {
                    throw new Error(data.error || 'Remove failed');
                }
            })
            .catch(error => {
                console.error("[ERR-1011]", error);
                reportError("ERR-1011", "Unable to remove ORCID", error);
                toast.error("Unable to remove ORCID. Please try again. (ERR-1011)", {
                    position: "top-right",
                    autoClose: 2000,
                    theme: 'colored'
                });
            });
    }

    const getManageProfileData = (personIdentifier) => {
        setLoadProfileData(true)
        let url = `/api/db/admin/manageProfile/getORCIDProfileDataByID?personIdentifier=${personIdentifier}`
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
                    toast.error("User does not exist", {
                        position: "top-right",
                        autoClose: 2000,
                        theme: 'colored'
                    });
                    setLoadProfileData(false)
                } else if (data.message === "No data found") {
                    setLoadProfileData(false)
                } else {
                    let orcidData = data?.data || ""
                    let recentUpdatedOrcid = orcidData.find(value => value.recently_selected_orcid == value.orcid);
                    if(recentUpdatedOrcid)
                        setSelectOrcid(recentUpdatedOrcid?.recently_selected_orcid);
                    else
                       setManualORCID(orcidData && orcidData.length > 0?orcidData[0].recently_selected_orcid:"");
                    setProfileData(orcidData);
                    setLoadProfileData(false);
                }
            })
            .catch(error => {
                setLoadProfileData(false)
                console.error("[ERR-1012]", error);
                reportError("ERR-1012", "Unable to load profile data", error);
                toast.error("Unable to load profile data. Please try again. (ERR-1012)", {
                    position: "top-right",
                    autoClose: 2000,
                    theme: 'colored'
                });
            });
    }

    const onManualOrcidChange = (e) => {
        setClearRadioBtns(true);
        setSelectOrcid("");
        const value = e.target.value;
        const numericValue = value.replace(/\D/g, '');
        const formattedValue = formatInput(numericValue);
        if (formattedValue.length === 19) {
            setErrorMessage('');
        } else {
            setErrorMessage('Please enter the value in the format ####-####-####-####');
        }
        setManualORCID(formattedValue);
    }

    const onRadioChange = (orcidValue) => {
        if (orcidValue == selectedOrcidValue) {
            setSelectOrcid('')
        } else {
            setSelectOrcid(orcidValue)
            setManualORCID('');
        }
        setErrorMessage('');
    }

    const handleUseOrcid = (orcid) => {
        setSelectOrcid(orcid);
        setManualORCID('');
        setErrorMessage('');
        const uid = router.query.userId as string;
        fetch(`/api/reciter/saveIdentityOrcid`, {
            credentials: "same-origin",
            method: 'POST',
            headers: {
                Accept: 'application/json',
                "Content-Type": "application/json",
                'Authorization': reciterConfig.backendApiKey
            },
            body: JSON.stringify({ personIdentifier: uid, orcid })
        }).then(response => response.json())
        .then(data => {
            if (data.success) {
                toast.success("ORCID Saved Successfully", {
                    position: "top-right",
                    autoClose: 2000,
                    theme: 'colored'
                });
                setIdentityOrcid(orcid);
                getManageProfileData(uid);
            } else {
                throw new Error(data.error || 'Save failed');
            }
        }).catch(error => {
            console.error("[ERR-1013]", error);
            reportError("ERR-1013", "Unable to save ORCID", error);
            toast.error("Unable to save ORCID. Please try again. (ERR-1013)", {
                position: "top-right",
                autoClose: 2000,
                theme: 'colored'
            });
        });
    }

    const formatInput = (value) => {
        const formattedValue = value
            .replace(/(\d{4})/g, '$1-')
            .slice(0, 19);
        return formattedValue;
    };

    /* Current confirmed ORCID from ReCiter Identity (DynamoDB) */
    const currentOrcid = identityOrcid || '';

    return (
        <>
            <h1 className={styles.pageTitle}>Manage Profile</h1>

            {(isCuratorSelf || isSuperUserORCuratorAll) ? (
                <>
                    {/* ── ORCID section ── */}
                    <div className={styles.section}>
                        <div className={styles.sectionLabel}>ORCID</div>

                        {/* Intro card */}
                        <div className={styles.orcidIntro}>
                            <div className={styles.orcidLogo}>iD</div>
                            <div>
                                <div className={styles.orcidIntroTitle}>
                                    ORCID Identifier
                                    <a className={styles.orcidIntroLink} href="https://orcid.org/" target="_blank" rel="noreferrer">orcid.org</a>
                                </div>
                                <p className={styles.orcidIntroDesc}>
                                    Provide your unique ORCID iD to retrieve unclaimed PubMed publications.
                                    This persistent digital identifier distinguishes you from other researchers
                                    and ensures your work is properly attributed.
                                </p>
                                <div className={styles.orcidPrivacyNote}>
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                                        <path d="M7 11V7a5 5 0 0110 0v4" />
                                    </svg>
                                    <span>Your ORCID may be shared with select authorized parties to streamline administrative tasks.</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* ── Suggested ORCIDs ── */}
                    <div className={styles.section}>
                        <div className={styles.suggestionsCard}>
                            <div className={styles.suggestionsHead}>
                                <div className={styles.suggestionsHeadTitle}>
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <circle cx="12" cy="12" r="10" />
                                        <path d="M12 16v-4M12 8h.01" />
                                    </svg>
                                    Suggested ORCIDs
                                </div>
                                <span className={styles.suggestionsHeadDesc}>
                                    Based on accepted &amp; rejected publication history
                                </span>
                            </div>
                            <div className={styles.suggestionsBody}>
                                {loadProfileData ? (
                                    <div style={{ display: 'flex', justifyContent: 'center', padding: 20 }}><Loader /></div>
                                ) : profileData && profileData.length > 0 ? (
                                    profileData.map((values, i) => {
                                        const { orcid, articleCount_accepted, articleCount_null, articleCount_rejected, pmids_accepted, pmids_null, pmids_rejected } = values;
                                        return (
                                            <div className={styles.suggestionRow} key={i}>
                                                <label className={styles.suggestionRadioLabel}>
                                                    <input
                                                        type="radio"
                                                        className={styles.suggestionRadio}
                                                        name="orcid-suggestion"
                                                        checked={selectedOrcidValue === orcid}
                                                        onChange={() => onRadioChange(orcid)}
                                                    />
                                                    <span className={styles.suggestionOrcidId}>{orcid}</span>
                                                </label>
                                                <div className={styles.suggestionPills}>
                                                    {articleCount_accepted > 0 && (
                                                        <a href={pmids_accepted} target="_blank" rel="noreferrer" className={`${styles.pill} ${styles.pillAccepted}`}>
                                                            {articleCount_accepted} accepted
                                                        </a>
                                                    )}
                                                    {articleCount_rejected > 0 && (
                                                        <a href={pmids_rejected} target="_blank" rel="noreferrer" className={`${styles.pill} ${styles.pillRejected}`}>
                                                            {articleCount_rejected} rejected
                                                        </a>
                                                    )}
                                                </div>
                                                <button
                                                    type="button"
                                                    className={styles.btnUse}
                                                    onClick={() => handleUseOrcid(orcid)}
                                                >
                                                    Use this iD
                                                </button>
                                            </div>
                                        );
                                    })
                                ) : (
                                    <div className={styles.emptyState}>
                                        <div className={styles.emptyIcon}>
                                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                <circle cx="11" cy="11" r="8" />
                                                <path d="M21 21l-4.35-4.35" />
                                            </svg>
                                        </div>
                                        <div className={styles.emptyTitle}>No suggestions available</div>
                                        <div className={styles.emptyDesc}>
                                            We couldn&apos;t find any ORCID suggestions based on your publication history. You can manually enter your ORCID below.
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* ── Manual entry ── */}
                    <div className={styles.section}>
                        <div className={styles.manualCard}>
                            <div className={styles.manualHead}>Manually Enter ORCID</div>
                            <div className={styles.manualBody}>
                                {currentOrcid && (
                                    <div className={styles.currentOrcidBanner}>
                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M20 6L9 17l-5-5" />
                                        </svg>
                                        Current ORCID: <strong>{currentOrcid}</strong>
                                    </div>
                                )}

                                <div className={styles.fieldLabel}>ORCID iD</div>
                                <div className={styles.fieldRow}>
                                    <input
                                        className={styles.fieldInput}
                                        type="text"
                                        value={manualORCID}
                                        onChange={onManualOrcidChange}
                                        placeholder="0000-0000-0000-0000"
                                        maxLength={19}
                                    />
                                    <button
                                        type="button"
                                        className={styles.btnSave}
                                        onClick={onSave}
                                        disabled={selectedOrcidValue === "" && manualORCID === ""}
                                    >
                                        Save
                                    </button>
                                    <button
                                        type="button"
                                        className={styles.btnRemove}
                                        onClick={onReset}
                                    >
                                        Remove
                                    </button>
                                </div>
                                {errorMessage && <div className={styles.errorText}>{errorMessage}</div>}

                                <div className={styles.orcidFormatHint}>
                                    Format: <code>####-####-####-####</code>
                                    &middot;
                                    <a href="https://orcid.org/" target="_blank" rel="noreferrer">Find your ORCID</a>
                                </div>
                            </div>
                        </div>
                    </div>

                    <ToastContainerWrapper />
                </>
            ) : (!isCuratorSelf || !isReporterAll) ? (
                <div className={styles.noAccess}>
                    <p>Your user does not have the Curator Self role. To edit the Manage Profile for another user, first click on the Manage Users tab.</p>
                </div>
            ) : null}
        </>
    )
}

export default ManageProfle;
