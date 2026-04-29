import React from 'react';
import styles from './Skeleton.module.css';

const SkeletonProfile = () => {
  const pillWidths = [80, 60, 100, 70, 90];
  return (
    <div className={styles.skeletonProfileContainer}>
      <div className={`${styles.skeleton} ${styles.skeletonAvatar}`}></div>
      <div className={styles.skeletonProfileContent}>
        <div className={`${styles.skeleton} ${styles.skeletonProfileName}`}></div>
        <div className={`${styles.skeleton} ${styles.skeletonProfileTitle}`}></div>
        <div className={styles.skeletonProfileMeta}>
          <div className={`${styles.skeleton} ${styles.skeletonProfileMetaItem1}`}></div>
          <div className={`${styles.skeleton} ${styles.skeletonProfileMetaItem2}`}></div>
          <div className={`${styles.skeleton} ${styles.skeletonProfileMetaItem3}`}></div>
        </div>
        <div className={styles.skeletonKeywords}>
          {pillWidths.map((width, i) => (
            <div key={i} className={`${styles.skeleton} ${styles.skeletonPill}`} style={{ width: `${width}px` }}></div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default SkeletonProfile;
