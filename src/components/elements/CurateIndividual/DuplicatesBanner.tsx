import React, { useEffect, useMemo, useState } from "react";
import { reciterConfig } from "../../../../config/local";
import { useSelector } from "react-redux";
import { toast } from "react-toastify";
import { RootStateOrAny } from "../../../types/redux";
import { crossSourceDuplicates, extSourceLabel, isMarkedDifferent, notDupNote, reopenDupNote } from "../../../lib/pubTypes";
import { showUndoToast } from "../ToastHost/ToastHost";
import { sanitizeInlineHtml } from "../../../utils/htmlText";
import styles from "./CurateIndividual.module.css";

// 2h: accepted external records that duplicate an accepted PubMed record, with two actions,
// both through the existing external-article feedback route (plan 2026-11-09-2h):
// - Keep PubMed record: REJECTED (suppresses the external row) with a "Duplicate of PMID" note.
//   ponytail: REJECTED clears supersededByPmid, so the row won't revive if the PubMed record is
//   later rejected; that needs a Java "supersede by PMID" action.
// - Different papers: PENDING (changes no state) with a marker note; see isMarkedDifferent.
const headers = { Accept: "application/json", "Content-Type": "application/json", Authorization: reciterConfig.backendApiKey };
const DuplicatesBanner: React.FC<{ uid: string, accepted: any[] }> = ({ uid, accepted }) => {
  const [external, setExternal] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!uid) return;
    let live = true;
    fetch(`/api/reciter/external-article/${encodeURIComponent(uid)}`, {
      credentials: "same-origin",
      headers,
    })
      .then((r) => (r.ok ? r.json() : {}))
      .then((b: any) => { if (live) setExternal(Array.isArray(b?.external) ? b.external : []); })
      .catch(() => {}); // the banner is advisory; no banner on a failed read
    return () => { live = false; };
  }, [uid]);

  const feedbacklog = useSelector((state: RootStateOrAny) => state.feedbacklog);
  // Verdicts made this session, by articleId (the feedbacklog slice refreshes only on reload).
  const [local, setLocal] = useState<Record<string, 'kept' | 'different' | undefined>>({});
  const pairs = useMemo(() => crossSourceDuplicates(accepted, external)
    .filter(({ pub, ext }) => local[ext.articleId] === undefined
      ? !isMarkedDifferent(feedbacklog?.[ext.articleId], pub.pmid)
      : false), [accepted, external, feedbacklog, local]);

  const send = (articleId: string, action: 'ACCEPTED' | 'REJECTED' | 'PENDING', note: string) =>
    fetch(`/api/db/external-article/feedback`, {
      credentials: "same-origin", method: "POST", headers,
      body: JSON.stringify({ uid, articleId, action, note }),
    }).then(async (r) => {
      if (!r.ok) { const b = await r.json().catch(() => ({})); throw new Error(b?.message || `HTTP ${r.status}`); }
    });
  const mark = (articleId: string, v: 'kept' | 'different' | undefined) => setLocal((l) => ({ ...l, [articleId]: v }));
  const act = (ext: any, pmid: number, kind: 'kept' | 'different') => {
    const id = ext.articleId;
    const [action, note, undoAction, undoNote, msg] = kind === 'kept'
      ? ['REJECTED', `Duplicate of PMID ${pmid} (kept PubMed record)`, 'ACCEPTED', `Duplicate of PMID ${pmid} undone`, `Kept PMID ${pmid}; hid the ${extSourceLabel(ext)} copy`] as const
      : ['PENDING', notDupNote(pmid), 'PENDING', reopenDupNote(pmid), `Marked as different from PMID ${pmid}`] as const;
    mark(id, kind);
    send(id, action, note)
      .then(() => showUndoToast(msg, () => {
        mark(id, undefined);
        send(id, undoAction, undoNote).catch((e) => { mark(id, kind); toast.error("Could not undo: " + (e.message || e)); });
      }))
      .catch((e) => { mark(id, undefined); toast.error("Could not save: " + (e.message || e)); });
  };
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
              <div className={styles.dupActions}>
                <button type="button" className={styles.dupToggle} onClick={() => act(ext, pub.pmid, 'different')}>Different papers</button>
                <button type="button" className={styles.dupToggle} onClick={() => act(ext, pub.pmid, 'kept')}>Keep PubMed record</button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default DuplicatesBanner;
