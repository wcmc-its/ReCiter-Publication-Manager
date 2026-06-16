import React from 'react';
import Tooltip from '@mui/material/Tooltip';
import styles from './ScopeLabel.module.css';

interface ScopeLabelProps {
    scopeData: { personTypes: string[] | null; orgUnits: string[] | null } | null;
    proxyCount: number;
}

const MAX_DISPLAY_ITEMS = 3;

const ScopeLabel: React.FC<ScopeLabelProps> = ({ scopeData, proxyCount }) => {
    // Collect all scope items into a single array
    const scopeItems: string[] = [];
    if (scopeData?.personTypes) {
        scopeItems.push(...scopeData.personTypes);
    }
    if (scopeData?.orgUnits) {
        scopeItems.push(...scopeData.orgUnits);
    }

    // Build proxy text
    let proxyText = '';
    if (proxyCount === 1) {
        proxyText = '1 proxy';
    } else if (proxyCount > 1) {
        proxyText = `${proxyCount} proxies`;
    }

    // Return null if nothing to display
    if (scopeItems.length === 0 && !proxyText) {
        return null;
    }

    // Truncate scope items for display
    const displayItems = scopeItems.slice(0, MAX_DISPLAY_ITEMS);
    const overflow = scopeItems.length - MAX_DISPLAY_ITEMS;
    let displayText = displayItems.join(', ');
    if (overflow > 0) {
        displayText += ` +${overflow} more`;
    }
    if (proxyText) {
        displayText += displayText ? ` + ${proxyText}` : proxyText;
    }

    // Build full tooltip text (untruncated)
    const fullItems = [...scopeItems];
    if (proxyText) {
        fullItems.push(proxyText);
    }
    const tooltipText = fullItems.join(', ');

    return (
        <Tooltip title={tooltipText} placement="right" arrow>
            <div className={styles.scopeLabel} aria-label={`Scope: ${tooltipText}`}>
                {displayText}
            </div>
        </Tooltip>
    );
};

export default ScopeLabel;
