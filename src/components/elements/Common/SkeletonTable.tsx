import React from 'react';
import styles from './Skeleton.module.css';

const SkeletonTable = () => {
  return (
    <div className={styles.skeletonTableContainer}>
      <div className={styles.skeletonTableHeader}></div>
      {[...Array(5)].map((_, rowIndex) => (
        <div key={rowIndex} className={styles.skeletonTableRow}>
          <div className={`${styles.skeleton} ${styles.skeletonTableCell}`} style={{ maxWidth: '30%' }}></div>
          <div className={`${styles.skeleton} ${styles.skeletonTableCell}`} style={{ maxWidth: '25%' }}></div>
          <div className={`${styles.skeleton} ${styles.skeletonTableCell}`} style={{ maxWidth: '25%' }}></div>
          <div className={`${styles.skeleton} ${styles.skeletonTableCell}`} style={{ maxWidth: '20%' }}></div>
        </div>
      ))}
    </div>
  );
};

export default SkeletonTable;
