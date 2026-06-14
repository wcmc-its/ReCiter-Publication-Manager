/**
 * "View as" (impersonation) controls for the app shell.
 *
 * Mounted by AppLayout in the top-right user bar. The client learns impersonation
 * state ONLY from session.data (via useSession()) — there is no separate state
 * endpoint and the overlay cookie is HttpOnly:
 *
 *   - NOT impersonating: session.data is the real user. session.data.impersonating
 *     is absent/falsey. The "View as…" entry shows only for Superusers.
 *   - Impersonating: /api/auth/session is overlaid, so session.data carries the
 *     TARGET's username/userRoles/databaseUser, PLUS impersonating:true,
 *     realUser, realUserName, expiresAt (epoch seconds). The amber banner shows
 *     and "Return to my view" exits.
 *
 * Server-only impersonation utils (src/utils/impersonation.ts, effectiveSession.ts)
 * are NEVER imported here — role parsing is done inline from session.data.userRoles,
 * the same way other client components do it.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useSession } from 'next-auth/client';
import { Modal } from 'react-bootstrap';
import { reciterConfig } from '../../../../config/local';
import styles from './ViewAsControls.module.css';

interface SearchRow {
  userID: number;
  personIdentifier: string;
  nameFirst: string;
  nameMiddle: string;
  nameLast: string;
  // search-users does not return a role label; kept optional so the UI can show
  // it if a future row ever carries one.
  roleLabel?: string;
}

interface ParsedRole {
  roleLabel?: string;
}

// ---- inline role parsing (client-safe; mirrors existing components) ----
function parseRoles(userRoles: unknown): ParsedRole[] {
  if (!userRoles) return [];
  try {
    const parsed = typeof userRoles === 'string' ? JSON.parse(userRoles) : userRoles;
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function isSuperuserRoles(userRoles: unknown): boolean {
  return parseRoles(userRoles).some((r) => r && r.roleLabel === 'Superuser');
}

function primaryRoleLabel(userRoles: unknown): string {
  const roles = parseRoles(userRoles);
  const labels = roles.map((r) => (r && r.roleLabel ? r.roleLabel : '')).filter(Boolean);
  if (labels.length === 0) return 'No role';
  // Make the scoped-curator label readable, matching UsersTable's treatment.
  return labels.map((l) => (l === 'Curator_Scoped' ? 'Curator — Scoped' : l)).join(', ');
}

function rowName(row: SearchRow): string {
  return [row.nameFirst, row.nameLast].filter(Boolean).join(' ').trim() || row.personIdentifier;
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

function formatRemaining(secondsLeft: number): string {
  const safe = Math.max(0, secondsLeft);
  const m = Math.floor(safe / 60);
  const s = safe % 60;
  return `${pad2(m)}:${pad2(s)}`;
}

const EyeIcon: React.FC = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    style={{ display: 'block' }}
  >
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

// ============================================================================
// Banner — shown while impersonating
// ============================================================================
const ImpersonationBanner: React.FC = () => {
  const [session] = useSession();
  const data: any = session?.data || {};

  const targetName = useMemo(() => {
    const du = data.databaseUser || {};
    const name = [du.nameFirst, du.nameLast].filter(Boolean).join(' ').trim();
    return name || data.username || 'this user';
  }, [data]);

  const targetRole = useMemo(() => primaryRoleLabel(data.userRoles), [data.userRoles]);
  const realUserName: string = data.realUserName || data.realUser || 'you';
  const expiresAt: number = Number(data.expiresAt) || 0;

  const [remaining, setRemaining] = useState<number>(() =>
    expiresAt ? Math.max(0, expiresAt - Math.floor(Date.now() / 1000)) : 0
  );
  const [exiting, setExiting] = useState(false);
  const reloadedRef = useRef(false);

  useEffect(() => {
    if (!expiresAt) return undefined;
    const tick = () => {
      const left = Math.max(0, expiresAt - Math.floor(Date.now() / 1000));
      setRemaining(left);
      if (left <= 0 && !reloadedRef.current) {
        // Cookie has (or is about to) expire — re-resolve the session.
        reloadedRef.current = true;
        window.location.reload();
      }
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [expiresAt]);

  const handleReturn = async () => {
    setExiting(true);
    try {
      await fetch('/api/impersonation', { method: 'DELETE' });
    } catch {
      // Even if the call fails, reload so the user isn't stuck; the cookie may
      // already be cleared and the session will re-resolve to the real user.
    }
    window.location.reload();
  };

  return (
    <div className={styles.banner} role="status" aria-live="polite">
      <div className={styles.bannerText}>
        Viewing as <strong>{targetName}</strong>
        {targetRole ? <span className={styles.bannerRole}> · {targetRole}</span> : null}
        {' — you are '}
        <strong>{realUserName}</strong>. Changes are logged to you.
      </div>
      <div className={styles.bannerRight}>
        {expiresAt ? (
          <span className={styles.bannerExpires}>Expires in {formatRemaining(remaining)}</span>
        ) : null}
        <button
          type="button"
          className={styles.bannerExit}
          onClick={handleReturn}
          disabled={exiting}
        >
          {exiting ? 'Returning…' : 'Return to my view'}
        </button>
      </div>
    </div>
  );
};

// ============================================================================
// Picker modal + confirm dialog
// ============================================================================
const ViewAsPicker: React.FC<{ show: boolean; onHide: () => void }> = ({ show, onHide }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchRow[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [confirmTarget, setConfirmTarget] = useState<SearchRow | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!show) {
      // Reset everything when the picker closes.
      setQuery('');
      setResults([]);
      setSearching(false);
      setSearchError(null);
      setConfirmTarget(null);
      setSubmitting(false);
      setActionError(null);
      if (searchTimer.current) {
        clearTimeout(searchTimer.current);
        searchTimer.current = null;
      }
    }
  }, [show]);

  const runSearch = (value: string) => {
    setQuery(value);
    setSearchError(null);
    if (searchTimer.current) {
      clearTimeout(searchTimer.current);
    }
    if (!value || value.trim().length < 2) {
      setResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    searchTimer.current = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/db/admin/proxy/search-users?q=${encodeURIComponent(value.trim())}`,
          { headers: { Authorization: reciterConfig.backendApiKey } }
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const raw = await res.json();
        const rows: SearchRow[] = (Array.isArray(raw) ? raw : []).map((item: any) => ({
          userID: item.userID,
          personIdentifier: item.personIdentifier || '',
          nameFirst: item.nameFirst || '',
          nameMiddle: item.nameMiddle || '',
          nameLast: item.nameLast || '',
          roleLabel: item.roleLabel,
        }));
        setResults(rows);
      } catch (err) {
        console.error('[ViewAsControls] search error:', err);
        setResults([]);
        setSearchError('Could not search people. Please try again.');
      } finally {
        setSearching(false);
      }
    }, 300);
  };

  const startImpersonation = async (target: SearchRow) => {
    setSubmitting(true);
    setActionError(null);
    try {
      const res = await fetch('/api/impersonation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetPersonIdentifier: target.personIdentifier }),
      });
      if (res.status === 200) {
        // Re-resolve /api/auth/session to the target by reloading.
        window.location.reload();
        return;
      }
      let message = 'Could not start View as. Please try again.';
      if (res.status === 400) message = 'You cannot view as this user.';
      else if (res.status === 403) message = 'You cannot view as another superuser.';
      else if (res.status === 404) message = 'That user was not found. They may not have signed in yet.';
      else if (res.status === 422) message = 'That user has no email on record, so their access cannot be verified.';
      try {
        const body = await res.json();
        if (body && body.error) message = body.error;
      } catch {
        /* keep default message */
      }
      setActionError(message);
      setSubmitting(false);
    } catch (err) {
      console.error('[ViewAsControls] impersonation error:', err);
      setActionError('Could not start View as. Please try again.');
      setSubmitting(false);
    }
  };

  const confirmName = confirmTarget ? rowName(confirmTarget) : '';

  return (
    <>
      <Modal show={show && !confirmTarget} onHide={onHide} centered size="lg">
        <Modal.Header closeButton>
          <Modal.Title style={{ fontSize: 13, fontWeight: 600, color: '#1a2133' }}>
            View as another user
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <div className={styles.pickerSubtitle}>
            Search for a person to see Publication Manager exactly as they do.
          </div>
          <input
            type="text"
            className={styles.searchInput}
            placeholder="Search by name or CWID…"
            value={query}
            autoFocus
            onChange={(e) => runSearch(e.target.value)}
          />

          {searchError && <div className={styles.inlineError}>{searchError}</div>}

          <div className={styles.results}>
            {searching && <div className={styles.resultsHint}>Searching…</div>}
            {!searching && query.trim().length >= 2 && results.length === 0 && !searchError && (
              <div className={styles.resultsHint}>No users found matching your search.</div>
            )}
            {!searching && query.trim().length < 2 && (
              <div className={styles.resultsHint}>Type at least 2 characters to search.</div>
            )}
            {results.map((row) => (
              <div key={row.userID} className={styles.resultRow}>
                <div className={styles.resultInfo}>
                  <div className={styles.resultName}>{rowName(row)}</div>
                  <div className={styles.resultMeta}>
                    {row.roleLabel ? `${row.roleLabel} · ` : ''}
                    {row.personIdentifier}
                  </div>
                </div>
                <button
                  type="button"
                  className={styles.rowAction}
                  onClick={() => {
                    setActionError(null);
                    setConfirmTarget(row);
                  }}
                >
                  View as
                </button>
              </div>
            ))}
          </div>
        </Modal.Body>
        <div className={styles.footer}>
          <button type="button" className={styles.btnCancel} onClick={onHide}>
            Cancel
          </button>
        </div>
      </Modal>

      {/* Confirm dialog */}
      <Modal
        show={show && !!confirmTarget}
        onHide={() => !submitting && setConfirmTarget(null)}
        centered
        size="sm"
      >
        <Modal.Header closeButton>
          <Modal.Title style={{ fontSize: 13, fontWeight: 600, color: '#1a2133' }}>
            View as {confirmName}?
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <div className={styles.confirmBody}>
            You&apos;ll see Publication Manager exactly as {confirmName} does. Actions are applied as
            them but logged to you.
          </div>
          {actionError && <div className={styles.inlineError}>{actionError}</div>}
        </Modal.Body>
        <div className={styles.footer}>
          <button
            type="button"
            className={styles.btnCancel}
            onClick={() => setConfirmTarget(null)}
            disabled={submitting}
          >
            Cancel
          </button>
          <button
            type="button"
            className={styles.btnPrimary}
            onClick={() => confirmTarget && startImpersonation(confirmTarget)}
            disabled={submitting}
          >
            {submitting ? 'Starting…' : `View as ${confirmName}`}
          </button>
        </div>
      </Modal>
    </>
  );
};

// ============================================================================
// Entry control (the "View as…" trigger in the top bar)
// ============================================================================
export const ViewAsTrigger: React.FC = () => {
  const [session] = useSession();
  const [showPicker, setShowPicker] = useState(false);
  const data: any = session?.data || {};

  const impersonating = !!data.impersonating;
  const realIsSuperuser = useMemo(() => isSuperuserRoles(data.userRoles), [data.userRoles]);

  // Entry shows ONLY when the real user is a Superuser AND not already impersonating.
  // While impersonating, session.data.userRoles is the target's, so this hides
  // naturally; the banner's "Return to my view" is the exit.
  if (impersonating || !realIsSuperuser) {
    return null;
  }

  return (
    <>
      <button type="button" className={styles.trigger} onClick={() => setShowPicker(true)}>
        <EyeIcon />
        View as…
      </button>
      <ViewAsPicker show={showPicker} onHide={() => setShowPicker(false)} />
    </>
  );
};

// ============================================================================
// Default export — banner only (mounted at top of content)
// ============================================================================
const ViewAsControls: React.FC = () => {
  const [session] = useSession();
  const data: any = session?.data || {};
  if (!data.impersonating) return null;
  return <ImpersonationBanner />;
};

export default ViewAsControls;
