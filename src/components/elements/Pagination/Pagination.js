import React, { Component } from "react";
import styles from './Pagination.module.css';
import { ArrowRight } from "@mui/icons-material";
import { ArrowLeft } from "@mui/icons-material";
import { DropdownButton, Dropdown } from "react-bootstrap";

const Pagination = (props) => {
  const propsTotal = parseInt(props.total, 10);
  const propsPage = parseInt(props.page, 10);
  const propsCount = parseInt(props.count, 10);

  if (propsTotal > 0) {
    // Calculate total pages
    var totalPages = parseInt(propsTotal / propsCount, 10);
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
              <Dropdown.Item eventKey={100}>100</Dropdown.Item>
            </DropdownButton>
          </div>
        </div>
        <div className="col-lg-2 col-md-4 col-sm-4 col">
          <ArrowLeft className={`${propsPage === 1 ? "disabled" : ""}`} color="primary" onClick={(event) => onClickPrev(event)}></ArrowLeft>
          Page <span>{propsPage}</span> of {totalPages}
          <ArrowRight className={`${propsPage === totalPages ? "disabled" : ""}`} color="primary" onClick={(event) => onClickNext(event)}></ArrowRight>
        </div>
      </div>
    );
  } else {
    return null;
  }
};

export default Pagination;
