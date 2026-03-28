import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from 'next/router';
import { useDispatch, useSelector } from "react-redux";
import { RootStateOrAny } from "../../../types/redux";
import { identityFetchData, reciterFetchData, reCalcPubMedPubCount, fetchFeedbacklog, addError } from "../../../redux/actions/actions";
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
import GrantProxyModal from './GrantProxyModal';



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

  const reciterFetching = useSelector((state: RootStateOrAny) => state.reciterFetching)
  const [displayImage, setDisplayImage] = useState<boolean>(true);
  const [modalShow, setModalShow] = useState(false);
  const { data: session, status } = useSession(); const loading = status === "loading";
  const updatedAdminSettings = useSelector((state: RootStateOrAny) => state.updatedAdminSettings)
  const [viewProfileLabels, setViewProfileLabels] = useState([])
  const [isLoading, setLoading] = useState(false);
  const [headShot, setHeadShot] = useState<any>([]);
  const [showNoPermitError, setShowNoPermitError] = useState(false)
  const [headShotLoaded, setHeadShotLoaded] = useState(false)
  const [showGrantProxy, setShowGrantProxy] = useState(false)

  // Derive capabilities from session roles
  const userRoles = (() => {
    try {
      if (session?.data?.userRoles) {
        return JSON.parse(session.data.userRoles as string);
      }
    } catch (e) { /* ignore parse errors */ }
    return [];
  })();
  const caps = getCapabilities(userRoles);
  const canGrantProxy = caps.canCurate.all || caps.canManageUsers;

  useEffect(() => {

    if (!id) {
      return;
    }
    setHeadShotLoaded(false);
    fetchAllAdminSettings();
    let nextPersonIdentifier = "";
    setNewId(id);
    dispatch(identityFetchData(id));
    fetchData();
  }, [id])

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

  if (identityORFeatureGenError) {
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
        showNoPermitError ? <p className="text-center">{`${id} does not have an identity to view this page. Please contact system administartor`}</p> : <>
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
                <button className={styles.viewProfileBtn} onClick={handleShow}>View Profile</button>
                {canGrantProxy && (
                  <button
                    type="button"
                    className={styles.viewProfileBtn}
                    onClick={() => setShowGrantProxy(true)}
                    style={{ marginLeft: 8, display: 'inline-flex', alignItems: 'center', gap: 6 }}
                  >
                    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: 14, height: 14 }}>
                      <circle cx="6" cy="6" r="4" />
                      <path d="M10.5 10.5L14 14" />
                      <path d="M12 8v4M10 10h4" />
                    </svg>
                    Grant Proxy
                  </button>
                )}
              </div>
            </div>
          }

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
          {canGrantProxy && (
            <GrantProxyModal
              show={showGrantProxy}
              onHide={() => setShowGrantProxy(false)}
              personIdentifier={id as string}
              personName={personFullName}
              onSave={() => {
                // Proxy changes saved; no additional refresh needed on curate page
              }}
            />
          )}
        </>
      }
    </div>
  )
}

export default CurateIndividual;