import React, { Component } from "react";
import styles from './Pagination.module.css';
import { ArrowRight } from "@mui/icons-material";
import { ArrowLeft } from "@mui/icons-material";
import { DropdownButton, Dropdown } from "react-bootstrap";

interface PaginationProps {
  count: number,
  total: number,
  page: number,
  onChange: (page: number) => void,
  onCountChange: (count: string) => void, 
}

const Pagination: React.FC<PaginationProps> = (props) => {
  const propsTotal = props.total;
  const propsPage = props.page;
  const propsCount = props.count;

  if (propsTotal > 0) {
    // Calculate total pages
    var totalPages = Math.ceil(propsTotal / propsCount);
    if (propsTotal > totalPages * propsCount) totalPages++;
    // Calculate first page number
    var firstPage = propsPage - 5;
    if (firstPage <= 0) {
      firstPage = 1;
    }
    if (totalPages - 10 < firstPage) {
      firstPage = totalPages - 10;
    }
    if (totalPages <= 11) {
      firstPage = 1;
    }
    // Calculate last page
    var lastPage = propsPage + 5;
    if (propsPage + 5 <= 11) {
      lastPage = 11;
    }
    if (lastPage > totalPages) {
      lastPage = totalPages;
    }

    var pages = [];
    var i = firstPage;
    for (i; i <= lastPage; i++) {
      var isActive = false;
      if (i === propsPage) {
        isActive = true;
      }
      pages.push({
        title: i,
        isActive: isActive,
      });
    }

    const onClickNext = () => {
      if (propsPage !== totalPages) {
        props.onChange(propsPage + 1);
      }
    }

    const onClickPrev = () => {
      if (propsPage !== 1) {
        props.onChange(propsPage - 1);
      }
    }

    return (
      <div className={`row g-0 ${styles.paginationContainer} justify-content-between`}>
        <div className="col-lg-3 col-md-4 col-sm-4 col">
          <div className={styles.showRows}>
            <label>Show records</label>
            <DropdownButton className={styles.basicDropdown} id="dropdown-basic-button" title={propsCount} onSelect={(eventKey) => props.onCountChange(eventKey)}>
              <Dropdown.Item eventKey={10}>10</Dropdown.Item>
              <Dropdown.Item eventKey={20}>20</Dropdown.Item>
              <Dropdown.Item eventKey={50}>50</Dropdown.Item>
            </DropdownButton>
          </div>
        </div>
        <div className="col-md-auto">
          <ArrowLeft className={`${propsPage === 1 ? "disabled" : ""}`} color="primary" onClick={() => onClickPrev()}></ArrowLeft>
          Page <span>{propsPage}</span> of {totalPages}
          <ArrowRight className={`${propsPage === totalPages ? "disabled" : ""}`} color="primary" onClick={() => onClickNext()}></ArrowRight>
        </div>
      </div>
    );
  } else {
    return null;
  }
};

export default Pagination;
