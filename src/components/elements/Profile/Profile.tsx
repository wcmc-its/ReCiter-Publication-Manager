import React, { useEffect, useState } from "react";
import { useSelector } from "react-redux";
import { RootStateOrAny } from "../../../types/redux";
import Image from 'next/image'
import Loader from "../Common/Loader";
import fullName from "../../../utils/fullName";
import Link from "next/link";
import { useRouter } from "next/router";
import Box from "@mui/material/Box";
import { Sheet, Button } from "../../ui";
import { reciterConfig } from '../../../../config/local';
import { metrics, labels } from "../../../../config/report";
import Excel from 'exceljs';
import { useSession } from 'next-auth/react';
import { allowedPermissions, getCapabilities } from "../../../utils/constants";
import { hasConfiguredScope, isProxyFor } from "../../../utils/scopeResolver";
import { toast } from "react-toastify";
import { reportError } from "../../../utils/reportError";
import { stripHtml } from "../../../utils/htmlText";
import { downloadBibliometricDocx } from "../../../utils/bibliometricDownload";
import { degreeLines } from "../../../utils/degreeLines";
import { AUTHOR_ID_TYPES, AUTHOR_ID_TYPE_LABEL, AuthorIdRow, authorIdUrl } from "../../../utils/authorIds";

// Title/journal fields can carry PubMed inline markup (<i>, <sub>, …); strip to
// plain text for spreadsheet cells, which can't render HTML.
const HTML_BEARING_FIELDS = ['articleTitle', 'articleTitleRTF', 'journalTitleVerbose'];
const stripHtmlFields = (row: any): any => {
  HTML_BEARING_FIELDS.forEach((k) => { if (row && row[k]) row[k] = stripHtml(row[k]); });
  return row;
};

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
  // 5h P5: which bibliometric report the button runs, from the admin_settings bibliometricReport
  // flag. "rtf" (the default, and on any failure) is the v1 RTF path, unchanged.
  const [biblioVersion, setBiblioVersion] = useState<"rtf" | "docx">("rtf");
  const [biblioLoading, setBiblioLoading] = useState<boolean>(false);
  const [exportArticleCsvLoading, setExportArticleCsvLoading] = useState<boolean>(false);
  const [exportArticlRTFLoading, setExportArticleRTFLoading] = useState<boolean>(false);
  const formatter = new Intl.ListFormat('en', { style: 'long', type: 'conjunction'})
  const { data: session, status } = useSession(); const loading = status === "loading";
  const router = useRouter();
  const userPermissions = JSON.parse(session.data.userRoles);
  const [displayImage, setDisplayImage] = useState<boolean>(true);
  const [exportArticlesRTF, setExportArticlesRTF] = useState([])
  const [showAllRels, setShowAllRels] = useState(false);
  const [confirmedIds, setConfirmedIds] = useState<AuthorIdRow[]>([]);
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
      fetchConfirmedIds();
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

  // ── Data fetching ──

  // Confirmed Scopus / OpenAlex author ids (person_author_id). Optional: never blocks the sheet,
  // and an absent table or failed read just leaves the line out.
  const fetchConfirmedIds = () => {
    setConfirmedIds([]);
    fetch('/api/db/author-ids/' + encodeURIComponent(uid), {
      credentials: "same-origin",
      method: 'GET',
      headers: { Accept: 'application/json', 'Authorization': reciterConfig.backendApiKey }
    })
      .then(r => r.ok ? r.json() : null)
      .then(d => setConfirmedIds((d?.ids || []).filter((r: AuthorIdRow) => r.status === 'CONFIRMED')))
      .catch(() => setConfirmedIds([]));
  };

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
        toast.error("Unable to load profile. Please try again. (ERR-1020)");
      })
  }

  // 5h P5: ask the v2 show route first. It answers { version: "rtf" } without touching the v2 data
  // while the flag is rtf, and then (or if it fails) the v1 check below runs exactly as before.
  const showBiblioAnalysis = async () => {
    let v2: any = null;
    try {
      const response = await fetch('/api/db/reports/bibliometric/show/' + encodeURIComponent(uid), {
        credentials: "same-origin",
        method: 'GET',
        headers: { Accept: 'application/json', 'Authorization': reciterConfig.backendApiKey }
      });
      v2 = response.ok ? await response.json() : null;
    } catch (e) {
      v2 = null;
    }
    if (v2?.version === "docx") {
      setBiblioVersion("docx");
      isShowBiblioBtn(!!v2.show);
      return;
    }
    setBiblioVersion("rtf");
    return await showBiblioAnalysisV1();
  }

  const showBiblioAnalysisV1 = async () => {
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
        toast.error("Unable to export article CSV. Please try again. (ERR-8010)");
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
        worksheet.addRow(stripHtmlFields(itemRow));
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

  // Word: the 5g .docx bibliography for this one person, grouped by year (RTF is retired).
  const generateWordForPerson = () => {
    setExportArticleRTFLoading(true);
    fetch(`/api/db/reports/publication/word`, {
      credentials: "same-origin",
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': reciterConfig.backendApiKey
      },
      body: JSON.stringify({ filters: { personIdentifers: [uid] }, groupBy: 'year', includeExternal: true })
    }).then(response => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.blob();
      })
      .then(fileBlob => {
        let d = new Date().toISOString().slice(0, 10);
        var link = document.createElement('a')
        link.href = window.URL.createObjectURL(fileBlob)
        link.download = 'ArticleReport-ReCiter-' + uid + '-' + d + ".docx";
        document.body.appendChild(link); // Chrome honors the download filename only for an anchor in the DOM.
        link.click()
        link.remove();
        setExportArticleRTFLoading(false);
      })
      .catch(error => {
        console.error("[ERR-8011]", error);
        reportError("ERR-8011", "Unable to export article report", error);
        setExportArticleRTFLoading(false);
        toast.error("Unable to export article report. Please try again. (ERR-8011)");
      })
  }

  // 5h P5: the v2 .docx, used only while the flag is "docx".
  const generateBiblioDocx = async () => {
    setBiblioLoading(true);
    try {
      const result = await downloadBibliometricDocx(uid, reciterConfig.backendApiKey);
      if (result.ok === true) {
        toast.success(`Downloaded ${result.fileName}`);
      } else {
        if (result.status >= 500) reportError("ERR-8012", "Unable to generate bibliometric analysis", { status: result.status });
        toast.error(result.status >= 500 ? `${result.message} (ERR-8012)` : result.message);
      }
    } catch (error) {
      console.error("[ERR-8012]", error);
      reportError("ERR-8012", "Unable to generate bibliometric analysis", error);
      toast.error("Unable to generate bibliometric analysis. Please try again. (ERR-8012)");
    } finally {
      setBiblioLoading(false);
    }
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
        toast.error("Unable to generate bibliometric analysis. Please try again. (ERR-8012)");
      })
  }

  // ── Metrics from reciter data ──

  const allArticles = reciterData?.reciter?.reCiterArticleFeatures || [];
  const acceptedCount = allArticles.filter((a: any) => a.userAssertion === 'ACCEPTED').length;
  const suggestedCount = allArticles.filter((a: any) => a.userAssertion === 'NULL').length;

  // ── Render ──

  // Email permission check
  const roleAccess = userPermissions.some((role: any) =>
    role.roleLabel === (allowedPermissions.Superuser || allowedPermissions.Curator_Self)
  );
  const showEmails = identity.emails && identity.emails.length > 0 && roleAccess;

  // Curate link: same rule as Search.js canCuratePerson (curate-all / scoped / proxy-for / self).
  // The curate APIs still enforce scope server-side.
  const caps = getCapabilities(userPermissions);
  const scopeData = safeParse((session?.data as any)?.scopeData, null);
  const proxyPersonIds = safeParse((session?.data as any)?.proxyPersonIds, []);
  const canCurateThisPerson = caps.canCurate.all || caps.canCurate.scoped || hasConfiguredScope(scopeData)
    || isProxyFor(proxyPersonIds, uid)
    || (caps.canCurate.self && uid === caps.canCurate.personIdentifier);
  // Opened from that person's own Curate page, the button just closes the sheet.
  const onThisCuratePage = router.pathname === '/curate/[id]' && router.query.id === uid;

  const name = identity.primaryName ? fullName(identity.primaryName) : '';
  const initials = ((identity.primaryName?.firstName || '').charAt(0) + (identity.primaryName?.lastName || '').charAt(0)).toUpperCase();
  const showPhoto = displayImage && identity.identityImageEndpoint && headShotLabelData?.length > 0 && headShotLabelData[0].isVisible;
  const loaded = !isLoading && !isError;

  const degrees = degreeLines(identity.degreeYear);

  const metricItems = [
    { value: acceptedCount, label: 'Accepted' },
    { value: identity.hindexNIH ?? '–', label: 'h-index' },
    { value: identity.h5indexNIH ?? '–', label: 'h5-index' },
  ];

  const header = loaded ? (
    <Box component="span" sx={{ display: 'flex', gap: 1.75, alignItems: 'flex-start' }}>
      <Box component="span" sx={{
        width: 56, height: 56, borderRadius: '50%', overflow: 'hidden', flexShrink: 0, display: 'grid', placeItems: 'center',
        bgcolor: 'var(--pm-surface-2)', border: '1px solid var(--pm-border)', color: 'var(--pm-slate)', fontSize: 17, fontWeight: 600,
      }}>
        {showPhoto ? (
          <Image
            alt="Profile photo"
            width={56}
            height={56}
            style={{ objectFit: 'cover' }}
            src={headShotLabelData[0]?.syntax?.replace("{personIdentifier}", identity.uid)}
            onError={() => setDisplayImage(false)}
          />
        ) : initials}
      </Box>
      <Box component="span" sx={{ display: 'flex', flexDirection: 'column', gap: 0.25, minWidth: 0 }}>
        <Box component="span" sx={{ fontFamily: 'var(--font-display-serif)', fontSize: 20, fontWeight: 600, lineHeight: 1.25 }}>{name}</Box>
        {identity.title && <Box component="span" sx={subtleSx}>{identity.title}</Box>}
        <Box component="span" sx={subtleSx}>
          {identity.primaryOrganizationalUnit && <>{identity.primaryOrganizationalUnit} · </>}
          <Box component="span" sx={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{uid}</Box>
        </Box>
      </Box>
    </Box>
  ) : 'Profile';

  return (
    <Sheet open={modalShow} onClose={handleClose} title={header}>
        {isLoading ? (
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', py: 7.5 }}>
            <Loader />
          </Box>
        ) : isError ? (
          <Box sx={{ py: 5, textAlign: 'center', color: 'var(--pm-muted-foreground)', fontSize: 13 }}>
            Unable to load profile. Please try again.
          </Box>
        ) : (
          <>
            {/* ── Metrics + actions ── */}
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', border: '1px solid var(--pm-border)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
              {metricItems.map((m, i) => (
                <Box key={m.label} sx={{ px: 1.5, py: 1, display: 'flex', flexDirection: 'column', gap: 0.25, borderLeft: i > 0 ? '1px solid var(--pm-border)' : 'none' }}>
                  <Box component="span" sx={{ fontSize: 20, fontWeight: 600, fontVariantNumeric: 'tabular-nums', lineHeight: 1.2 }}>{m.value}</Box>
                  <Box component="span" sx={capsLabelSx}>{m.label}</Box>
                </Box>
              ))}
            </Box>

            <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap', mt: 1.75, pb: 1, borderBottom: '1px solid var(--pm-border)' }}>
              <Button size="sm" onClick={exportArticleCSV} disabled={exportArticleCsvLoading} sx={slateTintSx}>
                {exportArticleCsvLoading ? 'Exporting…' : 'Excel'}
              </Button>
              <Button size="sm" onClick={generateWordForPerson} disabled={exportArticlRTFLoading} sx={slateTintSx}>
                {exportArticlRTFLoading ? 'Exporting…' : 'Word'}
              </Button>
              {canCurateThisPerson && (onThisCuratePage ? (
                <Button size="sm" onClick={handleClose}>Curate</Button>
              ) : (
                <Button size="sm" component={Link} href={`/curate/${uid}`} onClick={handleClose}>Curate</Button>
              ))}
              {showBiblioBtn && biblioVersion !== "docx" && (
                <Button size="sm" onClick={generateBiblioAnalysis} sx={amberTintSx}>Bibliometric analysis</Button>
              )}
              {showBiblioBtn && biblioVersion === "docx" && (
                <Button size="sm" onClick={generateBiblioDocx} disabled={biblioLoading} sx={amberTintSx} data-testid="profile-bibliometric">
                  {biblioLoading ? 'Generating…' : 'Bibliometric analysis'}
                </Button>
              )}
            </Box>

            {/* ── Names ── */}
            <Section title="Names">
              {identity.primaryName && (
                <Row label="Primary"><span>{fullName(identity.primaryName)}</span></Row>
              )}
              {identity.alternateNames && (() => {
                const primaryStr = identity.primaryName ? fullName(identity.primaryName) : '';
                const seen = new Set([primaryStr]);
                const variants = identity.alternateNames
                  .filter((altName: PrimaryName) => {
                    const str = fullName(altName);
                    if (seen.has(str)) return false;
                    seen.add(str);
                    return true;
                  });
                if (variants.length === 0) return null;
                return (
                  <Row label="Variants" column>
                    {variants.map((altName: PrimaryName, i: number) => (
                      <Box component="span" key={i} sx={{ color: 'var(--pm-muted-foreground)' }}>{fullName(altName)}</Box>
                    ))}
                  </Row>
                );
              })()}
            </Section>

            {/* ── Affiliation ── */}
            <Section title="Affiliation">
              {identity.organizationalUnits && identity.organizationalUnits.length > 0 && (
                <Row label="Org units" column>
                  {identity.organizationalUnits.map((unit: any, i: number) => {
                    let dateStr = '';
                    if (unit.startDate) {
                      dateStr = unit.startDate.split('-')[0] + ' – ' + (unit.endDate ? unit.endDate.split('-')[0] : 'present');
                    }
                    return (
                      <span key={i}>
                        {unit.organizationalUnitLabel}
                        {dateStr && <Note>{dateStr}</Note>}
                      </span>
                    );
                  })}
                </Row>
              )}

              {identity.institutions && identity.institutions.length > 0 && (
                <Row label="Institutions" column>
                  {[...new Set(identity.institutions)].map((inst: string, i: number) => (
                    <span key={i}>
                      {inst}
                      {inst === identity.primaryInstitution && <Note>Primary</Note>}
                    </span>
                  ))}
                </Row>
              )}

              {showEmails && (
                <Row label="Email" column>
                  {[...new Set(identity.emails as string[])].map((email: string, i: number) => (
                    <span key={i}>{email}</span>
                  ))}
                </Row>
              )}

              {degrees.length > 0 && (
                <Row label="Degrees" column>
                  {degrees.map((d) => <span key={d}>{d}</span>)}
                </Row>
              )}

              {identity.grants && identity.grants.length > 0 && (
                <Row label="Grants">
                  {identity.grants.map((grant: string, i: number) => (
                    <Box component="span" key={i} sx={{
                      height: 22, px: 1, display: 'inline-flex', alignItems: 'center', borderRadius: 999,
                      bgcolor: 'var(--pm-surface-2)', border: '1px solid var(--pm-border)', fontSize: 12, fontFamily: 'var(--font-mono)',
                    }}>{grant}</Box>
                  ))}
                </Row>
              )}
            </Section>

            {/* ── Author profiles: confirmed Scopus / OpenAlex ids, managed on Manage Profile ── */}
            {confirmedIds.length > 0 && (
              <Section title="Author profiles">
                {AUTHOR_ID_TYPES.map((t) => {
                  const rows = confirmedIds.filter((r) => r.idType === t);
                  if (rows.length === 0) return null;
                  return (
                    <Row key={t} label={AUTHOR_ID_TYPE_LABEL[t]}>
                      {rows.map((r) => (
                        <Box component="a" key={r.idValue} href={authorIdUrl(r.idType, r.idValue)} target="_blank" rel="noreferrer"
                          sx={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--pm-slate)' }}>{r.idValue}</Box>
                      ))}
                    </Row>
                  );
                })}
                {canCurateThisPerson && (
                  <Box sx={{ fontSize: 12 }}>
                    <Link href={`/manageprofile/${uid}`} onClick={handleClose}>Manage author profiles</Link>
                  </Box>
                )}
              </Section>
            )}

            {/* ── Known relationships ── */}
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
                <Section title="Known relationships">
                  <Row label="People" column>
                    {visible.map((rel, i) => {
                      const typeStr = rel.types.map(slugToText).join(' · ');
                      return (
                        <span key={i}>
                          {fullName(rel.name)}
                          {typeStr && <Note>{typeStr}</Note>}
                        </span>
                      );
                    })}
                  </Row>
                  {hiddenCount > 0 && (
                    <Box>
                      <Button variant="ghost" size="sm" onClick={() => setShowAllRels(!showAllRels)} sx={{ color: 'var(--pm-slate)' }}>
                        {showAllRels ? 'Show less' : `Show ${hiddenCount} more`}
                      </Button>
                    </Box>
                  )}
                </Section>
              );
            })()}
          </>
        )}
    </Sheet>
  );
}

// ── Sheet section layout (prototype: uppercase section title, 92px label column) ──

const subtleSx = { fontSize: 13, fontWeight: 400, color: 'var(--pm-muted-foreground)', lineHeight: 1.4 };
const capsLabelSx = { fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--pm-muted-foreground)' } as const;
const slateTintSx = {
  color: 'var(--pm-slate)', bgcolor: 'var(--pm-slate-tint)', borderColor: 'var(--pm-slate-tint-border)',
  '&:hover': { bgcolor: 'var(--pm-surface)', borderColor: 'var(--pm-slate-tint-border)' },
};
const amberTintSx = {
  color: 'var(--pm-amber)', bgcolor: 'var(--pm-amber-tint)', borderColor: 'var(--pm-amber-tint-border)',
  '&:hover': { bgcolor: 'var(--pm-surface)', borderColor: 'var(--pm-amber-tint-border)' },
};

const Section = ({ title, children }: { title: string, children: React.ReactNode }) => (
  <Box component="section" sx={{ py: 1.75, borderBottom: '1px solid var(--pm-border)', display: 'flex', flexDirection: 'column', gap: 1.25 }}>
    <Box component="h3" sx={{ m: 0, ...capsLabelSx }}>{title}</Box>
    {children}
  </Box>
);

const Row = ({ label, column, children }: { label: string, column?: boolean, children: React.ReactNode }) => (
  <Box sx={{ display: 'grid', gridTemplateColumns: '92px minmax(0, 1fr)', gap: 1.5, alignItems: 'start' }}>
    <Box component="span" sx={{ fontSize: 12, color: 'var(--pm-muted-foreground)', pt: '2px' }}>{label}</Box>
    <Box sx={{ display: 'flex', flexDirection: column ? 'column' : 'row', flexWrap: 'wrap', gap: column ? 0.5 : 0.75, minWidth: 0, fontSize: 13, lineHeight: 1.45 }}>
      {children}
    </Box>
  </Box>
);

const Note = ({ children }: { children: React.ReactNode }) => (
  <Box component="span" sx={{ color: 'var(--pm-muted-foreground)', fontSize: 12 }}> · {children}</Box>
);

const safeParse = (value: any, fallback: any) => {
  try { return value != null ? JSON.parse(value) : fallback; } catch { return fallback; }
};

export default Profile;
