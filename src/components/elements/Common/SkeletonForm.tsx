import React from 'react';
import styles from './Skeleton.module.css';

const SkeletonForm = () => {
  return (
    <div className={styles.skeletonFormContainer}>
      {[...Array(4)].map((_, rowIndex) => (
        <div key={rowIndex} className={styles.skeletonFormRow}>
          <div className={`${styles.skeleton} ${styles.skeletonFormLabel}`}></div>
          <div className={`${styles.skeleton} ${styles.skeletonFormInput}`}></div>
        </div>
      ))}
      <div className={`${styles.skeleton} ${styles.skeletonFormButton}`}></div>
    </div>
  );
};

export default SkeletonForm;
