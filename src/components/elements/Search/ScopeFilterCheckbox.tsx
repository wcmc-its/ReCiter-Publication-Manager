import React from 'react';
import { Form } from 'react-bootstrap';
import styles from './ScopeFilterCheckbox.module.css';

interface ScopeFilterCheckboxProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
}

const ScopeFilterCheckbox: React.FC<ScopeFilterCheckboxProps> = ({ checked, onChange }) => {
  return (
    <Form.Check
      type="checkbox"
      id="scopeFilterCheckbox"
      label="Show only people I can curate"
      checked={checked}
      onChange={(e) => onChange(e.target.checked)}
      className={`mt-2 ${styles.scopeFilter}`}
    />
  );
};

export default ScopeFilterCheckbox;
