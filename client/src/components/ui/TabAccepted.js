import React, { Component } from 'react';
import '../../css/TabAccepted.css';
import '../../css/TabControls.css';
import Publication from './Publication';
import { Pagination } from './Pagination';
import { Filter } from './Filter';

export class TabAccepted extends Component {

    state = {
        page: 1,
        count: 20,
        search: "",
        sort: "0"
    }

    constructor(props) {
        super(props);
        this.handlePaginationUpdate = this.handlePaginationUpdate.bind(this);
        this.handleFilterUpdate = this.handleFilterUpdate.bind(this);
        this.rejectPublication = this.rejectPublication.bind(this);
        this.undoPublication = this.undoPublication.bind(this);
        this.rejectAll = this.rejectAll.bind(this);
        this.filter = this.filter.bind(this);
    }

    handlePaginationUpdate(event, page) {
        this.setState({
            page: page
        });
        if (event.target.value !== undefined) {
            this.setState({
                count: event.target.value
            });
        }
    }

    handleFilterUpdate(filterState) {
        this.setState({
            search: filterState.search,
            sort: filterState.sort,
            page: 1
        });
    }

    rejectPublication(id) {
        const request = {
            faculty: this.props.identityData,
            publications: [id],
            userAssertion: 'REJECTED',
            manuallyAddedFlag: false
        }
        this.props.updatePublication(this.props.identityData.uid, request)
    }

    undoPublication(id) {
        const request = {
            faculty: this.props.identityData,
            publications: [id],
            userAssertion: 'NULL',
            manuallyAddedFlag: false
        }
        this.props.updatePublication(this.props.identityData.uid, request)
    }

    rejectAll() {
        const publications = this.filter();
        var ids = [];
        publications.paginatedPublications.forEach(function (item) {
            ids.push(item.pmid);
        });
        const request = {
            faculty: this.props.identityData,
            publications: ids,
            userAssertion: 'REJECTED'
        }
        this.props.updatePublication(this.props.identityData.uid, request)
    }

    filter() {
        const thisObject = this;

        // Filter
        var filteredPublications = [];
        this.props.reciterData.reciter.forEach((publication) => {
            // Check if publication is Suggested
            if (publication.userAssertion === "ACCEPTED") {
                // Check search and sort
                if (thisObject.state.search !== "") {
                    if (/^[0-9 ]*$/.test(thisObject.state.search)) {
                        var pmids = thisObject.state.search.split(" ");
                        if (pmids.some(pmid => Number(pmid) === publication.pmid)) {
                            filteredPublications.push(publication);
                        }
                        if (publication.scopusDocID !== undefined && publication.scopusDocID.toLowerCase().includes(thisObject.state.search.toLowerCase())) {
                            filteredPublications.push(publication);
                        }
                    } else {
                        var addPublication = true;
                        // check filter search
                        if (thisObject.state.search !== "") {
                            addPublication = false;
                            //pmcid
                            if (publication.pmcid !== undefined && publication.pmcid.toLowerCase().includes(thisObject.state.search.toLowerCase())) {
                                addPublication = true
                            }
                            //publicationTypeCanonical
                            if (publication.publicationTypeCanonical !== undefined && publication.publicationTypeCanonical.toLowerCase().includes(thisObject.state.search.toLowerCase())) {
                                addPublication = true
                            }
                            //scopusDocID
                            if (publication.scopusDocID !== undefined && publication.scopusDocID.toLowerCase().includes(thisObject.state.search.toLowerCase())) {
                                addPublication = true
                            }
                            //journalTitleISOabbreviation
                            if (publication.journalTitleISOabbreviation !== undefined && publication.journalTitleISOabbreviation.toLowerCase().includes(thisObject.state.search.toLowerCase())) {
                                addPublication = true
                            }
                            //journalTitleVerbose
                            if (publication.journalTitleVerbose !== undefined && publication.journalTitleVerbose.toLowerCase().includes(thisObject.state.search.toLowerCase())) {
                                addPublication = true
                            }
                            //publication date display
                            if (publication.displayDate !== undefined && publication.displayDate.toLowerCase().includes(thisObject.state.search.toLowerCase())) {
                                addPublication = true
                            }
                            //doi
                            if (publication.doi !== undefined && publication.doi.toLowerCase().includes(thisObject.state.search.toLowerCase())) {
                                addPublication = true
                            }
                            // title
                            if (publication.title.toLowerCase().includes(thisObject.state.search.toLowerCase())) {
                                addPublication = true;
                            }
                            // journal
                            if (publication.journal.toLowerCase().includes(thisObject.state.search.toLowerCase())) {
                                addPublication = true;
                            }
                            //issn
                            if (publication.issn !== undefined) {
                                var issnArray = publication.issn.map((issn, issnIndex) => {
                                    return issn.issn
                                })
                                if (issnArray.join().toLowerCase().includes(thisObject.state.search.toLowerCase())) {
                                    addPublication = true;
                                }
                            }
                            // authors
                            if (publication.authors !== undefined) {
                                var authorsArray = publication.authors.map(function (author, authorIndex) {
                                    return author.authorName;
                                });
                                if (authorsArray.join().toLowerCase().includes(thisObject.state.search.toLowerCase())) {
                                    addPublication = true;
                                }
                            }
                            //evidence
                            if (publication.evidence !== undefined) {
                                var evidenceArticleArray = publication.evidence.map(function (evidence, evidenceIndex) {
                                    return evidence.articleData;
                                });
                                if (evidenceArticleArray.join().toLowerCase().includes(thisObject.state.search.toLowerCase())) {
                                    addPublication = true;
                                }
                            }
                        }
                        if (addPublication) {
                            filteredPublications.push(publication);
                        }
                    }
                } else {
                    filteredPublications.push(publication);
                }
            }
        })
        // Sort
        filteredPublications.sort((a, b) => {
            switch (this.state.sort) {
                case "0":
                    return parseInt(b.standardScore) - parseInt(a.standardScore);
                case "1":
                    return parseInt(a.standardScore) - parseInt(b.standardScore);
                case "2":
                    return new Date(b.standardDate) - new Date(a.standardDate);
                case "3":
                    return new Date(a.standardDate) - new Date(b.standardDate);
                default:
                    return parseInt(b.standardScore) - parseInt(a.standardScore);
            }
        });


        var from = (parseInt(this.state.page, 10) - 1) * parseInt(this.state.count, 10);
        var to = from + parseInt(this.state.count, 10) - 1;
        var publications = [];
        var i = from;
        for (i; i <= to; i++) {
            if (filteredPublications[i] !== undefined) {
                publications.push(filteredPublications[i]);
            }
        }
        return {
            filteredPublications: filteredPublications,
            paginatedPublications: publications
        };
    }

    render() {

        const thisObject = this;
        const publications = this.filter();

        return (
            <div className="Tabssuggestion_main_body12">
                <div className="Tabs_main_body1 h6fnhWdeg-tab-content">
                    <div className="Accepted_tabs_filter h6fnhWdeg-tab-controls-container">
                        <Filter onChange={this.handleFilterUpdate} showSort={true}  page={this.state.page} count={this.state.count} onFilterChange={this.handlePaginationUpdate}/>
                        <button className="btn btn-primary  backgroundColorBlue  h6fnhWdeg-accept-all borderRadius0">Accept All</button>
                        <button className="btn btn-default h6fnhWdeg-reject-all borderRadius0" onClick={this.rejectAll}>Reject All</button>
                    </div>
                    {/* <p className="suggested_filter_text">Not finding what you're looking for? <a onClick={() => { this.props.tabClickHandler("Add Publication"); }}>Search PubMed...</a></p> */}
                    {/* <Pagination total={publications.filteredPublications.length} page={this.state.page} count={this.state.count} onChange={this.handlePaginationUpdate} /> */}
                    <div className="tabs_responsive_table col-md-12">
                        <div className="table-responsive">
                            <table className="tabs_tables h6fnhWdeg-publications-table table">
                                <tbody>
                                    {
                                        publications.paginatedPublications.map(function (item, index) {
                                            return <Publication item={item} key={index} onAccept={thisObject.acceptPublication} onReject={thisObject.rejectPublication} onUndo={thisObject.undoPublication} />;
                                        })
                                    }
                                </tbody>
                            </table>
                        </div>
                    </div>

                </div>
                <Pagination total={publications.filteredPublications.length} page={this.state.page} count={this.state.count} onChange={this.handlePaginationUpdate} />
            </div>
        );
    }
}
