import React, { useEffect, useState } from "react";
import { useSelector } from "react-redux";
import { RootStateOrAny } from "../../../types/redux";
import Image from 'next/image'
import Loader from "../Common/Loader";
import fullName from "../../../utils/fullName";
import styles from "./Profile.module.css";
import { reciterConfig } from '../../../../config/local';
import { metrics, labels } from "../../../../config/report";
import Excel from 'exceljs';
import { useSession } from 'next-auth/react';
import { allowedPermissions } from "../../../utils/constants";
import { toast } from "react-toastify";
import { reportError } from "../../../utils/reportError";

interface PrimaryName {
  firstInitial?: string,
  firstName?: string,
  lastName?: string,
  middleName?: string,
  middleInitial?: string,
}

const Profile = ({
  uid,
  modalShow,
  handleShow,
  handleClose,
  viewProfileLabels,
  headShotLabelData,
  reciterData,
} : {
  uid: string,
  modalShow: boolean,
  handleShow: any,
  handleClose: () => void,
  viewProfileLabels?: any,
  headShotLabelData?: any,
  reciterData?: any,
}) => {
  const updatedAdminSettings = useSelector((state: RootStateOrAny) => state.updatedAdminSettings)
  const [isLoading, setIsLoading] = useState(false);
  const [isError, setIsError] = useState(false);
  const [identity, setIdentity] = useState<any>({});
  const [showBiblioBtn, isShowBiblioBtn] = useState<boolean>(false);
  const [exportArticleCsvLoading, setExportArticleCsvLoading] = useState<boolean>(false);
  const [exportArticlRTFLoading, setExportArticleRTFLoading] = useState<boolean>(false);
  const formatter = new Intl.ListFormat('en', { style: 'long', type: 'conjunction'})
  const { data: session, status } = useSession(); const loading = status === "loading";
  const userPermissions = JSON.parse(session.data.userRoles);
  const [displayImage, setDisplayImage] = useState<boolean>(true);
  const [exportArticlesRTF, setExportArticlesRTF] = useState([])
  const [showAllRels, setShowAllRels] = useState(false);
  const relsDefaultCount = 5;

  // Convert slugs: CO_INVESTIGATOR → Co-investigator, CTSC_PROTOCOL_ASSOCIATE → CTSC protocol associate, HR → HR
  const slugToText = (s: string) => {
    const acronyms = new Set(['CTSC', 'HR', 'NIH', 'PI', 'MD', 'IRB', 'IT', 'EHR', 'NYC', 'NYP', 'NYPH']);
    const tokens = s.split(/[_-]/);
    const parts: string[] = [];
    for (let i = 0; i < tokens.length; i++) {
      const upper = tokens[i].toUpperCase();
      if (upper === 'CO' && i === 0 && tokens.length > 1) {
        parts.push('Co-' + tokens[i + 1].toLowerCase());
        i++;
      } else if (acronyms.has(upper)) {
        parts.push(upper);
      } else {
        parts.push(upper.toLowerCase());
      }
    }
    const text = parts.join(' ');
    return text.charAt(0).toUpperCase() + text.slice(1);
  };

  // for CSV Report
  const workbook = new Excel.Workbook();
  let date = new Date().toISOString().slice(0, 10);
  let articleFileName = `ArticleReport-ReCiter-${date}`;

  // Fetch identity when drawer opens
  useEffect(() => {
    if (modalShow) {
      setIsLoading(true);
      setShowAllRels(false);
      const fetchIdentityPromise = fetchIdentity();
      const showBiblioAnalysisPromise = showBiblioAnalysis();
      Promise.all([fetchIdentityPromise, showBiblioAnalysisPromise]).then(() => { setIsLoading(false); })
    }
  }, [modalShow])

  // RTF export settings
  useEffect(() => {
    let exportArticleRTFViewAttr = [];
    if (updatedAdminSettings.length > 0) {
      let exportRTF = updatedAdminSettings.find(obj => obj.viewName === "reportingArticleRTF")
      exportArticleRTFViewAttr = exportRTF.viewAttributes;
    } else if (session?.adminSettings) {
      let adminSettings = JSON.parse(session.adminSettings);
      let exportRTF = adminSettings.find(obj => obj.viewName === "reportingArticleRTF")
      exportArticleRTFViewAttr = JSON.parse(exportRTF.viewAttributes);
    }
    setExportArticlesRTF(exportArticleRTFViewAttr)
  }, [])

  // Body scroll lock + Escape key
  useEffect(() => {
    if (!modalShow) return;
    document.body.style.overflow = 'hidden';
    const onEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') handleClose(); };
    document.addEventListener('keydown', onEsc);
    return () => {
      document.body.style.overflow = '';
      document.removeEventListener('keydown', onEsc);
    };
  }, [modalShow]);

  // ── Data fetching ──

  const fetchIdentity = async () => {
    return await fetch('/api/reciter/getidentity/' + uid, {
      credentials: "same-origin",
      method: 'GET',
      headers: {
        Accept: 'application/json',
        'Authorization': reciterConfig.backendApiKey
      }
    })
      .then(response => {
        if (response.status === 200) return response.json()
        throw { status: response.status, detail: "Error with " + response.url }
      })
      .then(data => { setIdentity(data.identity); })
      .catch(error => {
        console.error("[ERR-1020]", error);
        reportError("ERR-1020", "Unable to load profile", error);
        setIsError(true);
        toast.error("Unable to load profile. Please try again. (ERR-1020)", {
          position: "top-right",
          autoClose: 2000,
          theme: 'colored'
        });
      })
  }

  const showBiblioAnalysis = async () => {
    return await fetch('/api/db/reports/bibliometric-analysis/show-button/' + uid, {
      credentials: "same-origin",
      method: 'GET',
      headers: {
        Accept: 'application/json',
        'Authorization': reciterConfig.backendApiKey
      }
    })
      .then(response => {
        if (response.status === 200) return response.json()
        throw { status: response.status }
      })
      .then(data => { isShowBiblioBtn(data); })
      .catch(error => {
        console.log(error);
        setIsError(true);
      })
  }

  // ── Export functions ──

  const exportArticleCSV = () => {
    setExportArticleCsvLoading(true);
    fetch(`/api/db/reports/publication/article`, {
      credentials: "same-origin",
      method: 'POST',
      headers: {
        Accept: 'application/json',
        "Content-Type": "application/json",
        'Authorization': reciterConfig.backendApiKey
      },
      body: JSON.stringify({ personIdentifiers: [uid] })
    }).then(response => response.json())
      .then(result => { generateArticleCSV(result); setExportArticleCsvLoading(false); })
      .catch(error => {
        setExportArticleCsvLoading(false);
        console.error("[ERR-8010]", error);
        reportError("ERR-8010", "Unable to export article CSV", error);
        toast.error("Unable to export article CSV. Please try again. (ERR-8010)", {
          position: "top-right",
          autoClose: 2000,
          theme: 'colored'
        });
      })
  }

  const generateArticleCSV = async (data) => {
    let columns = [];
    if (labels.articleInfo) {
      Object.keys(labels.articleInfo).forEach((field) => {
        columns.push({ header: labels.articleInfo[field], key: field });
      })
    }
    if (metrics.article && labels.article) {
      Object.keys(metrics.article).forEach(field => {
        if (metrics.article[field] == true) {
          columns.push({ header: labels.article[field], key: field });
        }
      })
    }
    try {
      const worksheet = workbook.addWorksheet(articleFileName);
      worksheet.columns = columns;
      data.forEach(item => {
        let itemRow = {};
        Object.keys(item).forEach(obj => {
          if (obj === 'PersonPersonTypes') {
            let personTypes = item[obj].map(pt => pt.personType).join('|');
            itemRow = { ...itemRow, personType: personTypes };
          } else {
            itemRow = { ...itemRow, ...item[obj] };
          }
        })
        worksheet.addRow(itemRow);
      })
      const buf = await workbook.csv.writeBuffer();
      let blobFromBuffer = new Blob([buf]);
      var link = document.createElement('a')
      link.href = window.URL.createObjectURL(blobFromBuffer);
      link.download = `${articleFileName}.csv`;
      link.click()
      link.remove();
    } catch (error) {
      console.error('Error generating CSV', error.message);
    } finally {
      workbook.removeWorksheet(articleFileName);
    }
  }

  const generateRTFPeopleOnly = () => {
    setExportArticleRTFLoading(true);
    fetch(`/api/db/reports/publication/people-only`, {
      credentials: "same-origin",
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Authorization': reciterConfig.backendApiKey
      },
      body: JSON.stringify({ personIdentifiers: [uid], limit: exportArticlesRTF && exportArticlesRTF.length > 0 && exportArticlesRTF[0].maxLimit })
    }).then(response => response.blob())
      .then(fileBlob => {
        let d = new Date().toISOString().slice(0, 10);
        var link = document.createElement('a')
        link.href = window.URL.createObjectURL(fileBlob)
        link.download = 'ArticleReport-ReCiter-' + d + ".rtf";
        link.click()
        link.remove();
        setExportArticleRTFLoading(false);
      })
      .catch(error => {
        console.error("[ERR-8011]", error);
        reportError("ERR-8011", "Unable to export article report", error);
        setExportArticleRTFLoading(false);
        toast.error("Unable to export article report. Please try again. (ERR-8011)", {
          position: "top-right",
          autoClose: 2000,
          theme: 'colored'
        });
      })
  }

  const generateBiblioAnalysis = () => {
    fetch('/api/db/reports/bibliometric-analysis/' + uid, {
      credentials: "same-origin",
      method: 'GET',
      headers: {
        Accept: 'application/json',
        'Authorization': reciterConfig.backendApiKey
      }
    })
      .then(response => response.blob())
      .then(fileBlob => {
        var link = document.createElement('a')
        link.href = window.URL.createObjectURL(fileBlob)
        link.download = uid + ".rtf";
        link.click()
        link.remove();
      })
      .catch(error => {
        console.error("[ERR-8012]", error);
        reportError("ERR-8012", "Unable to generate bibliometric analysis", error);
        setIsError(true);
        toast.error("Unable to generate bibliometric analysis. Please try again. (ERR-8012)", {
          position: "top-right",
          autoClose: 2000,
          theme: 'colored'
        });
      })
  }

  // ── Metrics from reciter data ──

  const allArticles = reciterData?.reciter?.reCiterArticleFeatures || [];
  const acceptedCount = allArticles.filter((a: any) => a.userAssertion === 'ACCEPTED').length;
  const suggestedCount = allArticles.filter((a: any) => a.userAssertion === 'NULL').length;

  // ── Render ──

  if (!modalShow) return null;

  // Email permission check
  const roleAccess = userPermissions.some((role: any) =>
    role.roleLabel === (allowedPermissions.Superuser || allowedPermissions.Curator_Self)
  );
  const showEmails = identity.emails && identity.emails.length > 0 && roleAccess;

  return (
    <div className={styles.profileOverlay} onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}>
      <div className={styles.profileDrawer}>

        {isLoading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '60px 24px', flex: 1 }}>
            <Loader />
          </div>
        ) : isError ? (
          <div style={{ padding: '40px 24px', textAlign: 'center', color: '#8a94a6', fontSize: 13 }}>
            Unable to load profile. Please try again.
          </div>
        ) : (
          <>
            {/* ── Drawer Head (sticky) ── */}
            <div className={styles.drawerHead}>
              <button className={styles.drawerClose} onClick={handleClose}>
                <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 3l10 10M13 3L3 13"/></svg>
              </button>

              <div className={styles.drawerIdentity}>
                <div className={styles.drawerPhoto}>
                  {displayImage && identity.identityImageEndpoint && headShotLabelData?.length > 0 && headShotLabelData[0].isVisible ? (
                    <Image
                      className={styles.drawerPhotoImg}
                      alt="Profile photo"
                      width={64}
                      height={64}
                      src={headShotLabelData[0]?.syntax?.replace("{personIdentifier}", identity.uid)}
                      onError={() => setDisplayImage(false)}
                    />
                  ) : (
                    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.2" width="28" height="28">
                      <circle cx="8" cy="5.5" r="3"/><path d="M2 14c0-3.31 2.69-6 6-6s6 2.69 6 6"/>
                    </svg>
                  )}
                </div>
                <div>
                  <div className={styles.drawerName}>{identity.primaryName ? fullName(identity.primaryName) : ''}</div>
                  {identity.title && <div className={styles.drawerTitle}>{identity.title}</div>}
                  {identity.primaryOrganizationalUnit && <div className={styles.drawerDept}>{identity.primaryOrganizationalUnit}</div>}
                  <div className={styles.drawerMetrics}>
                    <div className={styles.drawerMetric}>
                      <div className={styles.drawerMetricVal}>{acceptedCount}</div>
                      <div className={styles.drawerMetricLbl}>Accepted</div>
                    </div>
                    <div className={styles.drawerMetricDivider} />
                    <div className={styles.drawerMetric}>
                      <div className={styles.drawerMetricVal}>{identity.hindexNIH ?? '–'}</div>
                      <div className={styles.drawerMetricLbl}>h-index</div>
                    </div>
                    <div className={styles.drawerMetricDivider} />
                    <div className={styles.drawerMetric}>
                      <div className={styles.drawerMetricVal}>{identity.h5indexNIH ?? '–'}</div>
                      <div className={styles.drawerMetricLbl}>h5-index</div>
                    </div>
                  </div>
                </div>
              </div>

              <div className={styles.drawerActions}>
                <button className={styles.drawerActionBtn} onClick={exportArticleCSV} disabled={exportArticleCsvLoading}>
                  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" width="12" height="12"><path d="M2 4h12v8a1 1 0 01-1 1H3a1 1 0 01-1-1V4z"/><path d="M2 4l6 5 6-5"/></svg>
                  {exportArticleCsvLoading ? 'Exporting…' : 'Export CSV'}
                </button>
                <button className={styles.drawerActionBtn} onClick={generateRTFPeopleOnly} disabled={exportArticlRTFLoading}>
                  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" width="12" height="12"><path d="M2 4h12v8a1 1 0 01-1 1H3a1 1 0 01-1-1V4z"/><path d="M2 4l6 5 6-5"/></svg>
                  {exportArticlRTFLoading ? 'Exporting…' : 'Export RTF'}
                </button>
                {showBiblioBtn && (
                  <button className={styles.drawerActionBtn} onClick={generateBiblioAnalysis}>
                    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" width="12" height="12"><rect x="2" y="3" width="12" height="10" rx="1"/><path d="M5 7h6M5 10h4"/></svg>
                    Bibliometric analysis
                  </button>
                )}
              </div>
            </div>

            {/* ── Drawer Body ── */}
            <div className={styles.drawerBody}>

              {/* Names section */}
              <div className={styles.drawerSection}>
                <div className={styles.drawerSectionTitle}>Names</div>
                <div className={styles.drawerFieldVal}>
                  {identity.primaryName && (
                    <div className={styles.drawerListItem}>
                      {fullName(identity.primaryName)} <span className={styles.primaryDot}>·</span> <span className={styles.primaryLabel}>Primary</span>
                    </div>
                  )}
                  {identity.alternateNames && (() => {
                    const primaryStr = identity.primaryName ? fullName(identity.primaryName) : '';
                    const seen = new Set([primaryStr]);
                    return identity.alternateNames
                      .filter((altName: PrimaryName) => {
                        const str = fullName(altName);
                        if (seen.has(str)) return false;
                        seen.add(str);
                        return true;
                      })
                      .map((altName: PrimaryName, i: number) => (
                        <div key={i} className={`${styles.drawerListItem} ${styles.drawerListItemSecondary}`}>{fullName(altName)}</div>
                      ));
                  })()}
                </div>
              </div>

              {/* Affiliation section */}
              <div className={styles.drawerSection}>
                <div className={styles.drawerSectionTitle}>Affiliation</div>

                {/* Org units */}
                {identity.organizationalUnits && identity.organizationalUnits.length > 0 && (
                  <div className={styles.drawerField}>
                    <div className={styles.drawerFieldLabel}>Org units</div>
                    <div className={styles.drawerFieldVal}>
                      {identity.organizationalUnits.map((unit: any, i: number) => {
                        let dateStr = '';
                        if (unit.startDate) {
                          dateStr = unit.startDate.split('-')[0] + ' – ' + (unit.endDate ? unit.endDate.split('-')[0] : 'present');
                        }
                        return (
                          <div key={i} className={`${styles.drawerListItem} ${i > 0 ? styles.drawerListItemSecondary : ''}`}>
                            {unit.organizationalUnitLabel}
                            {dateStr && <span className={styles.yearBadge}>{dateStr}</span>}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Institutions */}
                {identity.institutions && identity.institutions.length > 0 && (
                  <div className={styles.drawerField}>
                    <div className={styles.drawerFieldLabel}>Institutions</div>
                    <div className={styles.drawerFieldVal}>
                      {[...new Set(identity.institutions)].map((inst: string, i: number) => (
                        <div key={i} className={`${styles.drawerListItem} ${inst !== identity.primaryInstitution ? styles.drawerListItemSecondary : ''}`}>
                          {inst}
                          {inst === identity.primaryInstitution && (
                            <><span className={styles.primaryDot}>·</span> <span className={styles.primaryLabel}>Primary</span></>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Email */}
                {showEmails && (
                  <div className={styles.drawerField}>
                    <div className={styles.drawerFieldLabel}>Email</div>
                    <div className={styles.drawerFieldVal}>
                      {[...new Set(identity.emails as string[])].map((email: string, i: number) => (
                        <div key={i} className={`${styles.drawerListItem} ${i > 0 ? styles.drawerListItemSecondary : ''}`}>{email}</div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Grants */}
                {identity.grants && identity.grants.length > 0 && (
                  <div className={styles.drawerField}>
                    <div className={styles.drawerFieldLabel}>Grants</div>
                    <div className={styles.drawerFieldVal}>
                      <div className={styles.grantPillList}>
                        {identity.grants.map((grant: string, i: number) => (
                          <span key={i} className={styles.grantPill}>{grant}</span>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Known relationships section */}
              {(() => {
                // Group relationships by person, combine types
                const rels = identity.knownRelationships || [];
                const map = new Map<string, { name: any, types: string[] }>();
                rels.forEach((rel: any) => {
                  const personName = fullName(rel.name);
                  if (map.has(personName)) {
                    const existing = map.get(personName)!;
                    if (rel.type && !existing.types.includes(rel.type)) {
                      existing.types.push(rel.type);
                    }
                  } else {
                    map.set(personName, { name: rel.name, types: rel.type ? [rel.type] : [] });
                  }
                });
                const grouped = Array.from(map.values()).sort((a, b) => {
                  if (b.types.length !== a.types.length) return b.types.length - a.types.length;
                  return (a.name.lastName || '').localeCompare(b.name.lastName || '');
                });
                if (grouped.length === 0) return null;
                const visible = showAllRels ? grouped : grouped.slice(0, relsDefaultCount);
                const hiddenCount = grouped.length - relsDefaultCount;
                return (
                  <div className={styles.drawerSection}>
                    <div className={styles.drawerSectionTitle}>Known relationships</div>
                    <div className={styles.drawerRelList}>
                      {visible.map((rel, i) => {
                        const name = fullName(rel.name);
                        const typeStr = rel.types.map(slugToText).join(' · ');
                        return (
                          <div key={i} className={styles.drawerRelItem}>
                            <span className={styles.drawerRelName}>{name}</span>
                            {typeStr && <span className={styles.drawerRelType}>{typeStr}</span>}
                          </div>
                        );
                      })}
                    </div>
                    {hiddenCount > 0 && (
                      <button className={styles.showMoreBtn} onClick={() => setShowAllRels(!showAllRels)}>
                        {showAllRels ? 'Show less \u2191' : `Show ${hiddenCount} more \u2192`}
                      </button>
                    )}
                  </div>
                );
              })()}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default Profile;
