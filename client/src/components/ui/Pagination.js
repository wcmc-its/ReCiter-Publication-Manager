import React, { Component } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {faCaretRight,faCaretLeft} from '@fortawesome/free-solid-svg-icons'
import '../../css/Pagination.css';

export class Pagination extends Component {

    render() {
        const thisObject = this;
        const propsTotal = parseInt(this.props.total, 10);
        const propsPage = parseInt(this.props.page, 10);
        const propsCount = parseInt(this.props.count, 10);

        if(propsTotal > 0) {
            // Calculate total pages
            var totalPages = parseInt((propsTotal / propsCount), 10);
            if(propsTotal > totalPages*propsCount) totalPages++;
            // Calculate first page number
            var firstPage = propsPage - 5;
            if(firstPage <= 0) {
                firstPage = 1;
            }
            if((totalPages - 10) < firstPage) {
                firstPage = totalPages - 10;
            }
            if(totalPages <= 11) {
                firstPage = 1;
            }
            // Calculate last page
            var lastPage = propsPage + 5;
            if(propsPage + 5 <= 11) {
                lastPage = 11;
            }
            if(lastPage > totalPages) {
                lastPage = totalPages;
            }

            var pages = [];
            var i = firstPage;
            for (i; i <= lastPage; i++) {
                var isActive = false;
                if(i === propsPage) {
                    isActive = true;
                }
                pages.push({
                    title: i,
                    isActive: isActive
                });
            }

            return (
                <div className="row pagination-container">
                    <div className="col-lg-3 col-xl-3 col-xs-6 col-md-4 col-sm-5">
                        <div className="show-rows">
                            <label>Show records</label>
                            <select
                                className="form-control show_records_select pl-0 pr-0 mt-0"
                                value={(propsCount)}
                                onChange={(event) => thisObject.props.onChange(event, 1)}
                            >
                                <option value="10">10</option>
                                <option value="20">20</option>
                                <option value="50">50</option>
                                <option value="100">100</option>
                            </select>
                        </div>
                    </div>
                    <div className="col-lg-9 c0l-xl-9 col-xs-6 col-md-8 col-sm-7">
                        <div>
                            <ul className="pagination">
                                <li className={`page-item ${(propsPage === 1)?'disabled':''}`}>
                                <span
                                    className="page-link"
                                    onClick={(event) => thisObject.props.onChange(event, propsPage-1)}
                                ><FontAwesomeIcon icon={faCaretLeft} size='1x' className="pagination_carot_icon" /></span>
                                </li>
                                {
                                    pages.map(function(page, index){
                                        return <li className={`page-item ${(page.isActive)?"active":""}`} key={`page-item-${page.title}`}>
                                        <span
                                            className="page-link"
                                            onClick={(event) => thisObject.props.onChange(event, page.title)}
                                        >{page.title}</span>
                                        </li>
                                    })
                                }
                                <li className={`page-item ${(propsPage === totalPages)?'disabled':''}`}>
                                <span
                                    className="page-link"
                                    onClick={(event) => thisObject.props.onChange(event, propsPage+1)}
                                ><FontAwesomeIcon icon={faCaretRight} size='1x' className="pagination_carot_icon" /></span>
                                </li>
                            </ul>
                        </div>

                    </div>
                </div>
            );
        }else {
            return null;
        }
    }

}