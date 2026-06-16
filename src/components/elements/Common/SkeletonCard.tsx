import React from 'react';
import styles from './Skeleton.module.css';

const SkeletonCard = () => {
  return (
    <div className={styles.skeletonCardContainer}>
      {[...Array(3)].map((_, cardIndex) => (
        <div key={cardIndex} className={styles.skeletonCard}>
          <div className={`${styles.skeleton} ${styles.skeletonCardTitle}`}></div>
          <div className={`${styles.skeleton} ${styles.skeletonCardMeta} ${styles.skeletonCardMeta1}`}></div>
          <div className={`${styles.skeleton} ${styles.skeletonCardMeta} ${styles.skeletonCardMeta2}`}></div>
          <div className={styles.skeletonCardButtons}>
            <div className={`${styles.skeleton} ${styles.skeletonCardButton}`}></div>
            <div className={`${styles.skeleton} ${styles.skeletonCardButton}`}></div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default SkeletonCard;
