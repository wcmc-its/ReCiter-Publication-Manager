import React from 'react';
import { Form } from 'react-bootstrap';
import styles from './ScopeFilterCheckbox.module.css';

interface ScopeFilterCheckboxProps {
    checked: boolean;
    onChange: (checked: boolean) => void;
}

const ScopeFilterCheckbox: React.FC<ScopeFilterCheckboxProps> = ({ checked, onChange }) => (
    <div className={styles.scopeFilter}>
        <Form.Check
            type="switch"
            id="scopeFilterCheckbox"
            label="Show only people in my scope"
            checked={checked}
            onChange={(e) => onChange(e.target.checked)}
            className={styles.switchControl}
        />
        <span className={styles.hint}>
            Filters results to your assigned person types and organizational units
        </span>
    </div>
);

export default ScopeFilterCheckbox;
