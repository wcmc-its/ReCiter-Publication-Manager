import { useState } from 'react';
import Box from '@mui/material/Box';
import { useSession } from 'next-auth/react';
import { reciterConfig } from '../../../../config/local';
import { Dialog, Button, Input } from '../../ui';

const REASON_MESSAGES = {
  not_found: 'No active Publication Manager user with that CWID',
  target_is_superuser: "You can't view as another Superuser",
  self: "That's you",
  missing_cwid: 'Enter a CWID',
};

const initials = (name = '') => {
  const parts = name.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '';
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
};

const errorSx = { mt: 1, fontSize: 13, color: 'var(--pm-red)' };

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
    <Dialog
      open={!!show}
      onClose={handleHide}
      width={440}
      title="View as…"
      description="See Publication Manager exactly as another user does."
      footer={target ? (
        <>
          <Button onClick={() => setTarget(null)}>Back</Button>
          <Button variant="primary" onClick={handleConfirm} disabled={starting}>
            {starting ? 'Starting…' : `View as ${target.name}`}
          </Button>
        </>
      ) : (
        <Button onClick={handleHide}>Cancel</Button>
      )}
    >
      {!target ? (
        <>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Input
              autoFocus
              placeholder="CWID"
              value={cwid}
              onChange={(e) => setCwid(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleLookup()}
              inputProps={{ 'aria-label': 'CWID' }}
              sx={{ flex: 1, minWidth: 0, fontFamily: 'var(--font-mono)' }}
            />
            <Button variant="primary" onClick={handleLookup} disabled={looking}>
              {looking ? 'Looking up…' : 'Look up'}
            </Button>
          </Box>
          {error && <Box role="alert" sx={errorSx}>{error}</Box>}
        </>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          <Box sx={{
            display: 'flex', gap: 1.5, alignItems: 'center', px: 1.5, py: 1.25,
            borderRadius: 'var(--radius-md)', bgcolor: 'var(--pm-surface-2)', border: '1px solid var(--pm-border)',
          }}>
            <Box component="span" sx={{
              width: 34, height: 34, borderRadius: '50%', bgcolor: 'var(--pm-bar)', color: '#fff', flexShrink: 0,
              display: 'grid', placeItems: 'center', fontSize: 12, fontWeight: 600,
            }}>
              {initials(target.name)}
            </Box>
            <Box sx={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
              <Box component="span" sx={{ fontSize: 14, fontWeight: 600 }}>{target.name}</Box>
              <Box component="span" sx={{ fontSize: 12.5, color: 'var(--pm-muted-foreground)' }}>
                {target.personIdentifier} · Roles: {(target.roleLabels || []).join(', ') || 'none'}
              </Box>
            </Box>
          </Box>
          <Box component="p" sx={{ m: 0, lineHeight: 1.55 }}>
            You will see and act on the Publication Manager exactly as {target.name}. Any changes you make are
            applied as them but logged to you. Your view returns to your own after 30 minutes.
          </Box>
          {error && <Box role="alert" sx={errorSx}>{error}</Box>}
        </Box>
      )}
    </Dialog>
  );
};

export default ViewAsModal;
