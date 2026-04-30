import React from 'react';
import Badge from 'react-bootstrap/Badge';

const ProxyBadge: React.FC = () => (
    <Badge
        pill
        style={{
            backgroundColor: '#2563a8',
            color: '#fff',
            fontSize: '11px',
            fontWeight: 600,
            marginLeft: '8px',
            verticalAlign: 'middle',
        }}
    >
        Proxy
    </Badge>
);

export default ProxyBadge;
