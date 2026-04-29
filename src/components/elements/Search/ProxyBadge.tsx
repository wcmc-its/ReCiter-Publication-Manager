import React from 'react';
import Badge from 'react-bootstrap/Badge';

const ProxyBadge: React.FC = () => (
  <Badge
    pill
    style={{
      backgroundColor: '#17a2b8',
      color: '#fff',
      fontSize: '10px',
      fontWeight: 600,
      marginLeft: '8px',
      verticalAlign: 'middle',
    }}
  >
    PROXY
  </Badge>
);

export default ProxyBadge;
