import React, { Component } from "react";
import styles from './Pagination.module.css';

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

    return (
      <div className={`row ${styles.paginationContainer}`}>
        <div className="col-lg-3 col-md-4 col-sm-4 col">
          <div className={styles.showRows}>
            <label>Show records</label>
            <select
              className="form-control"
              value={propsCount}
              onChange={(event) => props.onChange(event, 1)}
            >
              <option value="10">10</option>
              <option value="20">20</option>
              <option value="50">50</option>
              <option value="100">100</option>
            </select>
          </div>
        </div>
        <div className="col-lg-9 col-md-8 col-sm-8 col">
          <div>
            <ul className="pagination">
              <li className={`page-item ${propsPage === 1 ? "disabled" : ""}`}>
                <span
                  className="page-link"
                  onClick={(event) =>
                    props.onChange(event, propsPage - 1)
                  }
                >
                  &laquo;
                </span>
              </li>
              {pages.map(function (page, index) {
                return (
                  <li
                    className={`page-item ${page.isActive ? "active" : ""}`}
                    key={`page-item-${page.title}`}
                  >
                    <span
                      className="page-link"
                      onClick={(event) =>
                        props.onChange(event, page.title)
                      }
                    >
                      {page.title}
                    </span>
                  </li>
                );
              })}
              <li
                className={`page-item ${
                  propsPage === totalPages ? "disabled" : ""
                }`}
              >
                <span
                  className="page-link"
                  onClick={(event) =>
                    props.onChange(event, propsPage + 1)
                  }
                >
                  &raquo;
                </span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    );
  } else {
    return null;
  }
};

export default Pagination;
