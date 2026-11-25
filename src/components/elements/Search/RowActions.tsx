import React, { useState } from 'react';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import { Button } from '../../ui';
import type { PeopleRowAction } from '../../../utils/searchRequest';
import styles from './Search.module.css';

const LABELS: Record<PeopleRowAction, string> = {
  curate: 'Curate',
  report: 'Report',
  authorships: 'Authorships',
};

interface RowActionsProps {
  personName: string;
  primary: PeopleRowAction | null;
  secondary: PeopleRowAction | null;
  onAction: (action: PeopleRowAction) => void;
  onViewProfile: () => void;
}

// A Find People row's actions: up to two buttons (the first outlined, the second ghost) and a
// "⋯" menu holding View profile. The MUI Menu closes on Escape and returns focus to the trigger.
const RowActions: React.FC<RowActionsProps> = ({ personName, primary, secondary, onAction, onViewProfile }) => {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const close = () => setAnchor(null);
  return (
    <div className={styles.rowActions}>
      {primary && (
        <Button size="sm" variant="secondary" onClick={() => onAction(primary)}>{LABELS[primary]}</Button>
      )}
      {secondary && (
        <Button size="sm" variant="ghost" onClick={() => onAction(secondary)}>{LABELS[secondary]}</Button>
      )}
      <button
        type="button"
        className={styles.moreBtn}
        aria-label={`More actions for ${personName}`}
        aria-haspopup="menu"
        aria-expanded={!!anchor}
        onClick={(e) => setAnchor(e.currentTarget)}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="5" cy="12" r="1.8" /><circle cx="12" cy="12" r="1.8" /><circle cx="19" cy="12" r="1.8" /></svg>
      </button>
      <Menu
        anchorEl={anchor}
        open={!!anchor}
        onClose={close}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        <MenuItem onClick={() => { close(); onViewProfile(); }} sx={{ fontSize: 13 }}>View profile</MenuItem>
      </Menu>
    </div>
  );
};

export default RowActions;
