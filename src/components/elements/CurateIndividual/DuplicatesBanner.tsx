import React, { useEffect, useMemo, useState } from "react";
import { reciterConfig } from "../../../../config/local";
import { crossSourceDuplicates, extSourceLabel } from "../../../lib/pubTypes";
import { sanitizeInlineHtml } from "../../../utils/htmlText";
import styles from "./CurateIndividual.module.css";

// 2h, read-only first step: accepted external records that duplicate an accepted PubMed record.
// No actions yet ("Keep PubMed record" and "Different papers" come next).
const DuplicatesBanner: React.FC<{ uid: string, accepted: any[] }> = ({ uid, accepted }) => {
  const [external, setExternal] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!uid) return;
    let live = true;
    fetch(`/api/reciter/external-article/${encodeURIComponent(uid)}`, {
      credentials: "same-origin",
      headers: { Accept: "application/json", "Content-Type": "application/json", Authorization: reciterConfig.backendApiKey },
    })
      .then((r) => (r.ok ? r.json() : {}))
      .then((b: any) => { if (live) setExternal(Array.isArray(b?.external) ? b.external : []); })
      .catch(() => {}); // the banner is advisory; no banner on a failed read
    return () => { live = false; };
  }, [uid]);

  const pairs = useMemo(() => crossSourceDuplicates(accepted, external), [accepted, external]);
  if (!pairs.length) return null;
  const allDefinite = pairs.every((p) => p.definite);
  const n = pairs.length;

  return (
    <div className={styles.dupBanner} role="region" aria-label="Possible duplicates">
      <div className={styles.dupHead}>
        <div className={styles.dupText}>
          <strong>{n} {allDefinite ? 'duplicate' : 'possible duplicate'}{n === 1 ? '' : 's'} across sources</strong>
          <span>Accepted Scopus, OpenAlex or Crossref records that match an accepted PubMed record by PMID, DOI or source id, or by title and year.</span>
        </div>
        <button type="button" className={styles.dupToggle} aria-expanded={open} onClick={() => setOpen((o) => !o)}>{open ? 'Hide' : 'Review'}</button>
      </div>
      {open && (
        <ul className={styles.dupList}>
          {pairs.map(({ pub, ext, reason, definite }) => (
            <li key={ext.articleId} className={styles.dupPair}>
              <span className={styles.dupReason} data-definite={definite || undefined}>{reason}</span>
              <div className={styles.dupRecs}>
                <div className={styles.dupRec}>
                  <span className={styles.dupId}>PubMed · PMID {pub.pmid}</span>
                  <span dangerouslySetInnerHTML={{ __html: sanitizeInlineHtml(pub.articleTitleRTF || pub.articleTitle) }} />
                  <span className={styles.dupMeta}>{pub.journalTitleVerbose} · {String(pub.publicationDateStandardized || '').slice(0, 4)}</span>
                </div>
                <div className={styles.dupRec}>
                  <span className={styles.dupId}>{extSourceLabel(ext)} · {ext.articleId}</span>
                  <span>{ext.title || '(untitled)'}</span>
                  <span className={styles.dupMeta}>{[ext.journalOrVenue, String(ext.pubDate || ext.publicationDate || ext.displayDate || '').slice(0, 4)].filter(Boolean).join(' · ')}</span>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default DuplicatesBanner;
