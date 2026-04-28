import React from 'react';
import Tooltip from '@mui/material/Tooltip';

interface ScopeLabelProps {
  scopeData: { personTypes: string[] | null; orgUnits: string[] | null } | null;
  proxyCount?: number;
}

const ScopeLabel: React.FC<ScopeLabelProps> = ({ scopeData, proxyCount }) => {
  const items: string[] = [];
  if (scopeData) {
    if (scopeData.personTypes) items.push(...scopeData.personTypes);
    if (scopeData.orgUnits) items.push(...scopeData.orgUnits);
  }

  const proxyText = proxyCount
    ? proxyCount === 1
      ? '1 proxied person'
      : `${proxyCount} proxied people`
    : '';

  // Nothing to display if no scope items and no proxy count
  if (items.length === 0 && !proxyText) return null;

  const maxDisplay = 3;
  const displayItems = items.slice(0, maxDisplay);
  const remaining = items.length - maxDisplay;
  const scopeDisplayText = displayItems.join(', ') + (remaining > 0 ? `, +${remaining} more` : '');
  const fullScopeText = items.join(', ');

  // Build label text
  let labelText = '';
  if (items.length > 0 && proxyText) {
    labelText = `Curating: ${scopeDisplayText} + ${proxyText}`;
  } else if (items.length > 0) {
    labelText = `Curating: ${scopeDisplayText}`;
  } else if (proxyText) {
    labelText = `Curating: ${proxyText}`;
  }

  // Build aria-label
  const ariaLabel = items.length > 0
    ? `Curation scope: ${fullScopeText}${proxyText ? ' plus ' + proxyText : ''}`
    : `Curation scope: ${proxyText}`;

  return (
    <Tooltip title={items.length > maxDisplay ? fullScopeText : ''} placement="right">
      <div
        aria-label={ariaLabel}
        style={{
          fontSize: '12px',
          fontWeight: 600,
          lineHeight: 1.4,
          color: '#777777',
          padding: '4px 16px 8px 16px',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
      >
        {labelText}
      </div>
    </Tooltip>
  );
};

export default ScopeLabel;
