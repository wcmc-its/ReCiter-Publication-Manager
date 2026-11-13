import React from 'react';
import styles from './Search.module.css';

// "Proxy" label on a Find People row the viewer holds a proxy for. Same neutral pill as the
// "Cornell Ithaca" label.
const ProxyBadge: React.FC = () => (
    <span className={styles.rowTag} title="You are a proxy for this person">Proxy</span>
);

export default ProxyBadge;
