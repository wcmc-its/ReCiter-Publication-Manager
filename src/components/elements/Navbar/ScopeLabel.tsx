import React from 'react';
import Tooltip from '@mui/material/Tooltip';

interface ScopeLabelProps {
  scopeData: { personTypes: string[] | null; orgUnits: string[] | null } | null;
}

const ScopeLabel: React.FC<ScopeLabelProps> = ({ scopeData }) => {
  if (!scopeData) return null;

  const items: string[] = [];
  if (scopeData.personTypes) items.push(...scopeData.personTypes);
  if (scopeData.orgUnits) items.push(...scopeData.orgUnits);

  if (items.length === 0) return null;

  const maxDisplay = 3;
  const displayItems = items.slice(0, maxDisplay);
  const remaining = items.length - maxDisplay;
  const displayText = displayItems.join(', ') + (remaining > 0 ? `, +${remaining} more` : '');
  const fullText = items.join(', ');

  return (
    <Tooltip title={items.length > maxDisplay ? fullText : ''} placement="right">
      <div
        aria-label={`Curation scope: ${fullText}`}
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
        Curating: {displayText}
      </div>
    </Tooltip>
  );
};

export default ScopeLabel;
