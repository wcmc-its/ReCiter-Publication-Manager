import React from 'react';
import { Form } from 'react-bootstrap';

interface ScopeFilterCheckboxProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
}

const ScopeFilterCheckbox: React.FC<ScopeFilterCheckboxProps> = ({ checked, onChange }) => {
  return (
    <Form.Check
      type="checkbox"
      id="scopeFilterCheckbox"
      controlId="scopeFilterCheckbox"
      label="Show only people I can curate"
      checked={checked}
      onChange={(e) => onChange(e.target.checked)}
      className="mt-2"
      style={{ minHeight: '44px', display: 'flex', alignItems: 'center' }}
    />
  );
};

export default ScopeFilterCheckbox;
