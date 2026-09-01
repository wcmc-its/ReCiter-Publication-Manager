import { useState } from 'react';
import { Modal } from 'react-bootstrap';
import { useSession } from 'next-auth/react';
import { reciterConfig } from '../../../../config/local';
import styles from './ViewAs.module.css';

const REASON_MESSAGES = {
  not_found: 'No active Publication Manager user with that CWID',
  target_is_superuser: "You can't view as another Superuser",
  self: "That's you",
  missing_cwid: 'Enter a CWID',
};

// Superuser-only "View as <cwid>" -- always confirm-before-commit (never a direct action).
// The lookup here is advisory display only; the jwt() callback re-validates everything
// server-side when the overlay is actually started.
const ViewAsModal = ({ show, onHide }) => {
  const { update } = useSession();
  const [cwid, setCwid] = useState('');
  const [looking, setLooking] = useState(false);
  const [target, setTarget] = useState(null);
  const [error, setError] = useState('');
  const [starting, setStarting] = useState(false);

  const reset = () => {
    setCwid('');
    setLooking(false);
    setTarget(null);
    setError('');
    setStarting(false);
  };

  const handleHide = () => {
    reset();
    onHide();
  };

  const handleLookup = async () => {
    const trimmed = cwid.trim();
    if (!trimmed) {
      setError(REASON_MESSAGES.missing_cwid);
      return;
    }
    setLooking(true);
    setError('');
    setTarget(null);
    try {
      const res = await fetch(`/api/db/admin/view-as/lookup?cwid=${encodeURIComponent(trimmed)}`, {
        headers: { Authorization: reciterConfig.backendApiKey },
      });
      const body = await res.json().catch(() => ({}));
      if (res.ok) {
        setTarget(body);
      } else {
        setError(REASON_MESSAGES[body.reason] || `Lookup failed (HTTP ${res.status})`);
      }
    } catch (err) {
      console.error('[ViewAsModal] lookup error:', err);
      setError('Lookup failed. Please try again.');
    } finally {
      setLooking(false);
    }
  };

  const handleConfirm = async () => {
    if (!target) return;
    setStarting(true);
    try {
      await update({ viewAs: target.personIdentifier });
      window.location.reload();
    } catch (err) {
      console.error('[ViewAsModal] start error:', err);
      setError('Could not start View as. Please try again.');
      setStarting(false);
    }
  };

  return (
    <Modal show={show} onHide={handleHide} centered>
      <Modal.Header closeButton>
        <Modal.Title style={{ fontSize: 13, fontWeight: 600, color: '#1a2133' }}>
          View as…
        </Modal.Title>
      </Modal.Header>
      <Modal.Body>
        {!target ? (
          <>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                type="text"
                placeholder="CWID"
                value={cwid}
                onChange={(e) => setCwid(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleLookup()}
                style={{ flex: 1, padding: '6px 10px', border: '1px solid #ddd7ce', borderRadius: 4 }}
              />
              <button
                type="button"
                className={styles.returnButton}
                style={{ background: '#1a2133', color: '#fff' }}
                onClick={handleLookup}
                disabled={looking}
              >
                {looking ? 'Looking up…' : 'Look up'}
              </button>
            </div>
            {error && <div className={styles.errorText}>{error}</div>}
          </>
        ) : (
          <div className={styles.confirmBody}>
            <p>
              View as {target.name} ({target.personIdentifier})? Roles: {(target.roleLabels || []).join(', ') || 'none'}.
            </p>
            <p>
              You will see and act on the Publication Manager exactly as {target.name}. Any changes you make are
              applied as them but logged to you. Your view returns to your own after 30 minutes.
            </p>
            {error && <div className={styles.errorText}>{error}</div>}
          </div>
        )}
      </Modal.Body>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, padding: 12 }}>
        {target ? (
          <>
            <button type="button" className={styles.returnButton} style={{ background: '#eee', color: '#1a2133' }} onClick={() => setTarget(null)}>
              Cancel
            </button>
            <button
              type="button"
              className={styles.returnButton}
              style={{ background: '#1a2133', color: '#fff' }}
              onClick={handleConfirm}
              disabled={starting}
            >
              {starting ? 'Starting…' : `View as ${target.name}`}
            </button>
          </>
        ) : (
          <button type="button" className={styles.returnButton} style={{ background: '#eee', color: '#1a2133' }} onClick={handleHide}>
            Cancel
          </button>
        )}
      </div>
    </Modal>
  );
};

export default ViewAsModal;
