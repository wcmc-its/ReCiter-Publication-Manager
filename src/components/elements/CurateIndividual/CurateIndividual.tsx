import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from 'next/router';
import { useDispatch, useSelector } from "react-redux";
import { RootStateOrAny } from "../../../types/redux";
import { identityFetchData, reciterFetchData, reCalcPubMedPubCount, fetchFeedbacklog, addError, identityClearData, reciterClearData, clearIdentityORFeatureGenError } from "../../../redux/actions/actions";
import Loader from "../Common/Loader";
import fullName from "../../../utils/fullName";
import { Container, Button, Row, Toast } from "react-bootstrap";
import appStyles from '../App/App.module.css';
import styles from "./CurateIndividual.module.css";
import InferredKeywords from "./InferredKeywords"
import SuggestionsBanner from "./SuggestionsBanner";
import ReciterTabs from "./ReciterTabs";
import Image from "next/image";
import Profile from "../Profile/Profile";
import { useSession } from "next-auth/react";
import { allowedPermissions, toastMessage, getCapabilities } from "../../../utils/constants";
import ToastContainerWrapper from "../ToastContainerWrapper/ToastContainerWrapper";
import { reciterConfig } from "../../../../config/local";
import { toast } from "react-toastify";
import { reportError } from "../../../utils/reportError";
import GrantProxyModal from "./GrantProxyModal";



interface PrimaryName {
  firstInitial?: string,
  firstName?: string,
  lastName?: string,
  middleName?: string,
  middleInitial?: string,
}

const CurateIndividual = () => {
  const router = useRouter()
  const { id } = router.query;
  const [newId, setNewId] = useState<any>();
  const dispatch = useDispatch();
  const identityData = useSelector((state: RootStateOrAny) => state.identityData)
  const identityFetching = useSelector((state: RootStateOrAny) => state.identityFetching)
  const reciterData = useSelector((state: RootStateOrAny) => state.reciterData)
  const identityORFeatureGenError = useSelector((state: RootStateOrAny) => state.identityORFeatureGenError)
  const feedbacklog = useSelector((state: RootStateOrAny) => state.feedbacklog)

  const reciterFetching = useSelector((state: RootStateOrAny) => state.reciterFetching)
  const [displayImage, setDisplayImage] = useState<boolean>(true);
  const [modalShow, setModalShow] = useState(false);
  const { data: session, status } = useSession(); const loading = status === "loading";
  const updatedAdminSettings = useSelector((state: RootStateOrAny) => state.updatedAdminSettings)
  const [viewProfileLabels, setViewProfileLabels] = useState([])
  const [isLoading, setLoading] = useState(false);
  const [headShot, setHeadShot] = useState<any>([]);
  const [showNoPermitError, setShowNoPermitError] = useState(false)
  const [showRecentActivity, setShowRecentActivity] = useState(true)
  const [headShotLoaded, setHeadShotLoaded] = useState(false)
  const [grantProxyShow, setGrantProxyShow] = useState(false);
  // Grant Proxy hits Superuser-only API routes (see PM#849 / proxy.controller.ts) -- match
  // that gate here so the button isn't shown to someone who'd just get a 403.
  const userRoles = session?.data?.userRoles ? JSON.parse(session.data.userRoles) : [];
  const canManageUsers = getCapabilities(userRoles).canManageUsers;

  useEffect(() => {

    if (!id) {
      return;
    }
    setHeadShotLoaded(false);
    // Clear the previous uid's identity/reciter state (and any error it left behind)
    // before kicking off this uid's fetches, so a previous uid's data or a stale
    // identity-404 cannot bleed into this uid's render while its own fetches are
    // still in flight.
    dispatch(identityClearData());
    dispatch(reciterClearData());
    dispatch(clearIdentityORFeatureGenError());
    fetchAllAdminSettings();
    let nextPersonIdentifier = "";
    setNewId(id);
    dispatch(identityFetchData(id));
    fetchData();
  }, [id])

  // Show the "no identity" message only for a real identity-404, not for a generic
  // feature-generator failure -- and clear it once the error condition clears (e.g.
  // on navigating to a valid uid).
  useEffect(() => {
    const hasIdentityNotFoundError = Array.isArray(identityORFeatureGenError) &&
      identityORFeatureGenError.includes("Identity-Error");
    setShowNoPermitError(hasIdentityNotFoundError);
  }, [identityORFeatureGenError])

  const fetchData = () => {
    dispatch(reciterFetchData(id, false));
    dispatch(fetchFeedbacklog(id));
  }

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
          let c = typeof (b) === "string" ? JSON.parse(b) : b
          let parsedSettings = {
            viewName: obj.viewName,
            viewAttributes: c,
            viewLabel: obj.viewLabel
          }
          parsedSettingsArray.push(parsedSettings)
        })
        var viewAttributes = [];
        var headShotViewAttributes = [];

        let updatedData = parsedSettingsArray.find(obj => obj.viewName === "viewProfile")
        let headShotData = parsedSettingsArray.find(obj => obj.viewName === "headshot")

        viewAttributes = updatedData.viewAttributes;
        headShotViewAttributes = headShotData.viewAttributes
        setViewProfileLabels(viewAttributes)
        setHeadShot(headShotViewAttributes)
      })
      .catch(error => {
        console.error("[ERR-9010]", error);
        reportError("ERR-9010", "Unable to load display settings", error);
        toast.error("Unable to load display settings. Please try again. (ERR-9010)", {
          position: "top-right",
          autoClose: 2000,
          theme: 'colored'
        });
      });
  }

  const personFullName = identityData ? fullName(identityData.primaryName) : '';

  const handleClose = () => setModalShow(false);
  const handleShow = () => setModalShow(true);

  // Mirrors Publication.tsx's per-article History popover date formatting (date +
  // time-of-day, seconds included) so rapid same-day actions stay distinguishable here too.
  const formatActivityDate = (timestamp: string | Date) => {
    const d = new Date(timestamp);
    return d.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  // Person-level "Recent activity": flatten feedbacklog (keyed by pmid, each an array
  // of curation entries) across every pmid into one list, newest first. No new API
  // calls -- feedbacklog and reCiterArticleFeatures are already fetched for this page.
  const recentActivity = useMemo(() => {
    if (!feedbacklog || typeof feedbacklog !== 'object') return [];

    const allArticles = (reciterData && reciterData.reciter && reciterData.reciter.reCiterArticleFeatures) || [];
    const titleByPmid: { [pmid: string]: string } = {};
    allArticles.forEach((a: any) => {
      if (a && a.pmid !== undefined && a.pmid !== null && a.articleTitle) {
        titleByPmid[String(a.pmid)] = a.articleTitle;
      }
    });

    const flat: any[] = [];
    Object.keys(feedbacklog).forEach((pmid) => {
      const entries = feedbacklog[pmid];
      if (Array.isArray(entries)) {
        entries.forEach((entry: any) => flat.push({ ...entry, pmid }));
      }
    });

    flat.sort((a, b) => (Number(b.createTimestamp) || 0) - (Number(a.createTimestamp) || 0));

    return flat.slice(0, 15).map((entry) => {
      // Same verb labeling as the per-article History popover in Publication.tsx.
      const verb = entry.feedback === 'ACCEPTED' ? 'Accepted' : entry.feedback === 'REJECTED' ? 'Rejected' : 'Suggested';
      return {
        key: entry.feedbackID || `${entry.pmid}-${entry.createTimestamp}`,
        label: titleByPmid[String(entry.pmid)] || `PMID ${entry.pmid}`,
        verb,
        curatorName: entry.curatorName || 'Unknown',
        date: entry.modifyTimestamp ? formatActivityDate(entry.modifyTimestamp) : ''
      };
    });
  }, [feedbacklog, reciterData]);

  if (identityFetching || reciterFetching) {
    return (
      <div className={appStyles.mainContainer}>
        <div className={styles.loadingRow}>
          <div className={styles.loadingSpinner} />
          <span>Loading publications…</span>
        </div>
        <div className={styles.skeletonCard}><div className={styles.skTitle} /><div className={styles.skAuthors} /><div className={styles.skMeta} /></div>
        <div className={styles.skeletonCard}><div className={styles.skTitle} style={{ width: '60%' }} /><div className={styles.skAuthors} style={{ width: '50%' }} /><div className={styles.skMeta} style={{ width: '38%' }} /></div>
        <div className={styles.skeletonCard}><div className={styles.skTitle} style={{ width: '74%' }} /><div className={styles.skAuthors} style={{ width: '44%' }} /><div className={styles.skMeta} style={{ width: '32%' }} /></div>
      </div>
    )
  }

 // A real identity-404 (showNoPermitError) gets its own specific message below, in
 // place of this generic one -- the two are mutually exclusive.
 if (identityORFeatureGenError && identityORFeatureGenError.length > 0 && !showNoPermitError) {
    return (
      <div className={appStyles.mainContainer}>
        <ToastContainerWrapper />
        <div style={{ padding: '40px 24px', textAlign: 'center', color: '#8a94a6', fontSize: 14 }}>
          Unable to load publication data. The page may be temporarily unavailable.
        </div>
      </div>
    )
  }

  return (
    <div className={appStyles.mainContainer}>
      <ToastContainerWrapper />
      {
        showNoPermitError ? <p className="text-center">{`${id} does not have an identity to view this page. Please contact system administrator`}</p> : <>
          {identityData &&
            <div className={styles.personHeader}>
              <div className={styles.personPhotoWrap}>
                <svg className={styles.personPhotoPlaceholder} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.2"><circle cx="8" cy="5.5" r="3"/><path d="M2 14c0-3.31 2.69-6 6-6s6 2.69 6 6"/></svg>
                {identityData.uid && (
                  <img
                    className={`${styles.personPhoto}${headShotLoaded ? ` ${styles.personPhotoLoaded}` : ''}`}
                    src={`https://directory.weill.cornell.edu/api/v1/person/profile/${identityData.uid.replace(/^_/, '')}.png?returnGenericOn404=false`}
                    alt=""
                    loading="lazy"
                    onLoad={() => setHeadShotLoaded(true)}
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                  />
                )}
              </div>
              <div className={styles.personInfo}>
                <h2 className={styles.personName}>{personFullName}</h2>
                {identityData.title && <div className={styles.personRole}>{identityData.title}</div>}
                {identityData.primaryOrganizationalUnit && <div className={styles.personDept}>{identityData.primaryOrganizationalUnit}</div>}
                {reciterData && reciterData.reciter && reciterData.reciter.articleKeywordsAcceptedArticles &&
                  reciterData.reciter.articleKeywordsAcceptedArticles.length > 0 && (() => {
                    const keywords = reciterData.reciter.articleKeywordsAcceptedArticles;
                    const allArticles = reciterData.reciter.reCiterArticleFeatures || [];
                    const totalAccepted = allArticles.filter((a: any) => a.userAssertion === 'ACCEPTED').length;
                    const counts = keywords.map((kw: any) => kw.count || 0);
                    const sorted = [...counts].sort((a: number, b: number) => b - a);
                    const n = keywords.length;
                    const maxTier = totalAccepted < 5 ? 'low' : totalAccepted < 10 ? 'medium' : 'high';
                    return (
                      <div className={styles.personKeywords}>
                        <span className={styles.kwLabel}>Keywords</span>
                        {keywords.map((kw: any, i: number) => {
                          const count = kw.count || 0;
                          const rank = sorted.indexOf(count) / n;
                          let tier = rank < 0.25 ? 'high' : rank < 0.75 ? 'medium' : 'low';
                          if (maxTier === 'low') tier = 'low';
                          else if (maxTier === 'medium' && tier === 'high') tier = 'medium';
                          const tierClass = tier === 'high' ? styles.kwHigh : tier === 'medium' ? styles.kwMedium : styles.kwLow;
                          return (
                            <span key={i} className={`${styles.kwTag} ${tierClass}`}>
                              {kw.keyword}
                              <span className={styles.kwTip}>
                                <strong>{count}</strong> of {totalAccepted} accepted publications
                              </span>
                            </span>
                          );
                        })}
                      </div>
                    );
                  })()
                }
              </div>
              <div className={styles.personActions}>
                {canManageUsers && (
                  <button className={styles.viewProfileBtn} onClick={() => setGrantProxyShow(true)}>Grant Proxy</button>
                )}
                <button className={styles.viewProfileBtn} onClick={handleShow}>View Profile</button>
              </div>
            </div>
          }

          {recentActivity.length > 0 && (
            <div style={{ margin: '0 0 16px', border: '1px solid #e2e5ea', borderRadius: 8, background: 'var(--card-bg, #fff)' }}>
              <button
                type="button"
                onClick={() => setShowRecentActivity(!showRecentActivity)}
                style={{ width: '100%', textAlign: 'left', padding: '10px 14px', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 13, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
              >
                <span>Recent activity</span>
                <span style={{ fontSize: 11, color: '#8a94a6', fontWeight: 400 }}>{showRecentActivity ? 'Hide' : 'Show'}</span>
              </button>
              {showRecentActivity && (
                <div style={{ maxHeight: 260, overflowY: 'auto', borderTop: '1px solid #e2e5ea' }}>
                  {recentActivity.map((activity: any) => (
                    <div key={activity.key} style={{ padding: '8px 14px', borderBottom: '1px solid #f0f1f3', fontSize: 12.5, display: 'flex', flexDirection: 'column', gap: 2 }}>
                      <span>
                        <strong>{activity.verb}</strong>{' — '}{activity.label}
                      </span>
                      <span style={{ color: '#8a94a6' }}>{activity.curatorName} · {activity.date}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <ReciterTabs
            reciterData={reciterData}
            fullName={personFullName}
            fetchOriginalData={fetchData}
          />
          <Profile
            uid={identityData.uid}
            modalShow={modalShow}
            handleShow={handleShow}
            handleClose={handleClose}
            viewProfileLabels={viewProfileLabels}
            headShotLabelData={headShot}
            reciterData={reciterData}
          />
          {canManageUsers && (
            <GrantProxyModal
              show={grantProxyShow}
              onHide={() => setGrantProxyShow(false)}
              personIdentifier={String(id)}
              personName={personFullName}
              onSave={() => {}}
            />
          )}
        </>
      }
    </div>
  )
}

export default CurateIndividual;