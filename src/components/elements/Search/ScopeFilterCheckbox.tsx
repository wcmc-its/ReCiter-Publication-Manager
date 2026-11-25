import React from 'react';
import { Checkbox } from '../../ui';
import styles from './ScopeFilterCheckbox.module.css';

interface ScopeFilterCheckboxProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
}

// Scoped curators only: limits the list to people inside their curation scope. Sits in the
// filter card and applies as soon as it changes.
const ScopeFilterCheckbox: React.FC<ScopeFilterCheckboxProps> = ({ checked, onChange }) => {
  return (
    <span className={styles.scopeFilter}>
      <Checkbox
        id="scopeFilterCheckbox"
        label="Only people I can curate"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
    </span>
  );
};

export default ScopeFilterCheckbox;
