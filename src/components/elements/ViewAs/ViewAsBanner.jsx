import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import styles from './ViewAs.module.css';

const formatRemaining = (secondsLeft) => {
  const clamped = Math.max(0, secondsLeft);
  const mm = String(Math.floor(clamped / 60)).padStart(2, '0');
  const ss = String(clamped % 60).padStart(2, '0');
  return `${mm}:${ss}`;
};

// Sticky, always-visible, non-dismissible while "View as" is active -- deliberately
// off-brand amber so it cannot be missed. Renders nothing when no overlay is active.
const ViewAsBanner = () => {
  const { data: session, update } = useSession();
  const viewAs = session?.viewAs || null;
  const [secondsLeft, setSecondsLeft] = useState(0);

  useEffect(() => {
    if (!viewAs) return undefined;
    const tick = () => {
      const remaining = viewAs.expiresAt - Math.floor(Date.now() / 1000);
      setSecondsLeft(remaining);
      if (remaining <= 0) {
        // Forces the jwt() expiry sweep, then reload so every surface re-renders as the
        // real user again.
        update({}).finally(() => window.location.reload());
      }
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewAs?.expiresAt]);

  if (!viewAs) return null;

  const handleReturn = async () => {
    await update({ viewAs: null });
    window.location.reload();
  };

  return (
    <div className={styles.banner} role="status" aria-live="polite">
      <span>
        Viewing as {viewAs.name} ({viewAs.targetCwid}) — changes you make are logged to you · {formatRemaining(secondsLeft)} left
      </span>
      <button type="button" className={styles.returnButton} onClick={handleReturn}>
        Return to my view
      </button>
    </div>
  );
};

export default ViewAsBanner;
