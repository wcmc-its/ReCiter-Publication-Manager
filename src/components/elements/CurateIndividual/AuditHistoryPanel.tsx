import React, { useState, useCallback } from 'react';
import { reciterConfig } from '../../../../config/local';
import styles from './AuditHistoryPanel.module.css';

interface AuditEntry {
  articleId?: string;
  feedback?: string;
  curatedBy?: number;
  curatorName?: string | null;
  createTimestamp?: number;
  sk?: string;
}

interface Props {
  uid: string;
}

const ACTION_CLASS: { [key: string]: string } = {
  ACCEPTED: styles.accepted,
  REJECTED: styles.rejected,
  PENDING: styles.pending,
};

/**
 * Collapsible "Audit History" panel on the curate page. Lazily loads the
 * person's curation action history (accept/reject/pending) from
 * /api/reciter/feedback-log/[uid] on first expand. Newest first.
 */
const AuditHistoryPanel: React.FC<Props> = ({ uid }) => {
  const [expanded, setExpanded] = useState(false);
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!uid) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/reciter/feedback-log/${encodeURIComponent(uid)}`, {
        credentials: 'same-origin',
        headers: {
          Accept: 'application/json',
          'Authorization': reciterConfig.backendApiKey,
        },
      });
      if (!res.ok) {
        throw new Error(`Request failed (${res.status})`);
      }
      const data = await res.json();
      setEntries(Array.isArray(data) ? data : []);
      setLoaded(true);
    } catch (e) {
      setError('Unable to load audit history.');
    } finally {
      setLoading(false);
    }
  }, [uid]);

  const toggle = () => {
    const next = !expanded;
    setExpanded(next);
    if (next && !loaded && !loading) {
      load();
    }
  };

  const formatDate = (epochSeconds?: number) => {
    if (!epochSeconds) return '—';
    try {
      return new Date(epochSeconds * 1000).toLocaleString();
    } catch (e) {
      return '—';
    }
  };

  return (
    <div className={styles.panel}>
      <button type="button" className={styles.header} onClick={toggle} aria-expanded={expanded}>
        <span className={styles.caret}>{expanded ? '▼' : '▶'}</span>
        Audit History
        {loaded && <span className={styles.count}>{entries.length}</span>}
      </button>

      {expanded && (
        <div className={styles.body}>
          {loading && <p className={styles.muted}>Loading…</p>}
          {!loading && error && <p className={styles.error}>{error}</p>}
          {!loading && !error && loaded && entries.length === 0 && (
            <p className={styles.muted}>No curation actions recorded for this person yet.</p>
          )}
          {!loading && !error && entries.length > 0 && (
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Action</th>
                  <th>PMID</th>
                  <th>Curator</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((e, i) => (
                  <tr key={(e.sk || '') + i}>
                    <td>{formatDate(e.createTimestamp)}</td>
                    <td>
                      <span className={`${styles.badge} ${ACTION_CLASS[e.feedback || ''] || ''}`}>
                        {e.feedback || '—'}
                      </span>
                    </td>
                    <td>
                      {e.articleId ? (
                        <a
                          href={`https://pubmed.ncbi.nlm.nih.gov/${e.articleId}/`}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          {e.articleId}
                        </a>
                      ) : '—'}
                    </td>
                    <td>{e.curatorName || (e.curatedBy ? `#${e.curatedBy}` : '—')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
};

export default AuditHistoryPanel;
