import React from "react";
import { Dropdown, DropdownButton } from "react-bootstrap";
import styles from './Pagination.module.css';

interface PaginationProps {
  count: number,
  total: number,
  page: number,
  onChange: (page: number) => void,
  onCountChange?: (count: string) => void,
  // Footer of a results card (Find People): no box of its own, just a top rule.
  inCard?: boolean,
}

const Pagination: React.FC<PaginationProps> = ({ total, page, count, onChange, onCountChange, inCard }) => {
  if (total <= 0) return null;

  const totalPages = Math.ceil(total / count);

  const onClickNext = () => {
    if (page < totalPages) onChange(page + 1);
  };

  const onClickPrev = () => {
    if (page > 1) onChange(page - 1);
  };

  return (
    <div className={inCard ? styles.controlsInCard : styles.controls}>
      <span className={styles.showLabel}>Show</span>
      <DropdownButton
        className={styles.countDropdown}
        id="pagination-count"
        title={count}
        onSelect={(eventKey) => onCountChange?.(eventKey)}
      >
        <Dropdown.Item eventKey="10" className={`${styles.showItem} ${count === 10 ? styles.showItemActive : ''}`}>
          <span>10</span>{count === 10 && <span className={styles.showCheck}>✓</span>}
        </Dropdown.Item>
        <Dropdown.Item eventKey="20" className={`${styles.showItem} ${count === 20 ? styles.showItemActive : ''}`}>
          <span>20</span>{count === 20 && <span className={styles.showCheck}>✓</span>}
        </Dropdown.Item>
        <Dropdown.Item eventKey="50" className={`${styles.showItem} ${count === 50 ? styles.showItemActive : ''}`}>
          <span>50</span>{count === 50 && <span className={styles.showCheck}>✓</span>}
        </Dropdown.Item>
        <Dropdown.Item eventKey="100" className={`${styles.showItem} ${count === 100 ? styles.showItemActive : ''}`}>
          <span>100</span>{count === 100 && <span className={styles.showCheck}>✓</span>}
        </Dropdown.Item>
        <Dropdown.Item eventKey="200" className={`${styles.showItem} ${count === 200 ? styles.showItemActive : ''}`}>
          <span>200</span>{count === 200 && <span className={styles.showCheck}>✓</span>}
        </Dropdown.Item>
      </DropdownButton>
      <div className={styles.pageNav}>
        <button
          className={styles.pageBtn}
          onClick={onClickPrev}
          disabled={page === 1}
          aria-label="Previous page"
        >&#8249;</button>
        <span className={styles.pageInfo}>
          Page <strong>{page.toLocaleString()}</strong> of {totalPages.toLocaleString()}
        </span>
        <button
          className={styles.pageBtn}
          onClick={onClickNext}
          disabled={page >= totalPages}
          aria-label="Next page"
        >&#8250;</button>
      </div>
    </div>
  );
};

export default Pagination;
