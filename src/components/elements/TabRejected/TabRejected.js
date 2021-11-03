import React, { useState } from "react";
import { reciterUpdatePublication } from '../../../redux/actions/actions'
import { useSelector, useDispatch } from "react-redux";
import styles from '../Tabs/TabControls.module.css';
import Publication from '../Publication/Publication';
import Pagination from '../Pagination/Pagination';
import Filter from '../Filter/Filter';

const TabRejected = (props) => {
    
    const [sort, setSort] = useState("0")
    const [search, setSearch] = useState("")
    const [page, setPage] = useState(1)
    const [count, setCount] = useState(20)

    const dispatch = useDispatch()

    const identityData = useSelector((state) => state.identityData)
    const reciterData = useSelector((state) => state.reciterData)

    const handlePaginationUpdate = (e, page) => {
        setPage(page)
        if (e.target.value !== undefined) {
            setCount(e.target.value)
        }
    }

    const handleFilterUpdate = filterState => {
        setSearch(filterState.search)
        setPage(1)
        setSort(filterState.sort)
    }

    const acceptPublication = (id) => {
        const request = {
            faculty: identityData,
            publications: [id],
            userAssertion: 'ACCEPTED',
            manuallyAddedFlag: false
        }
        dispatch(reciterUpdatePublication(identityData.uid, request))
    }

    const undoPublication = (id)  => {
        const request = {
            faculty: identityData,
            publications: [id],
            userAssertion: 'NULL'
        }
        dispatch(reciterUpdatePublication(identityData.uid, request))
    }

    const acceptAll = () => {
        const publications = filter();
        var ids = [];
        publications.paginatedPublications.forEach(function(item){
            ids.push(item.pmid);
        });
        const request = {
            faculty: identityData,
            publications: ids,
            userAssertion: 'ACCEPTED'
        }
        dispatch(reciterUpdatePublication(identityData.uid, request))
    }

    const undoAll = () => {
        const publications = filter();
        var ids = [];
        publications.paginatedPublications.forEach(function(item){
            ids.push(item.pmid);
        });
        const request = {
            faculty: identityData,
            publications: ids,
            userAssertion: 'NULL'
        }
        dispatch(reciterUpdatePublication(identityData.uid, request))
    }

    const filter = () => {
        // Filter
        const filteredPublications = []
        reciterData.reciter.forEach((publication) => {
            // Check if publication is Suggested
            if(publication.userAssertion === "REJECTED") {
                // Check search and sort
                if(search !== "") {
                    if(/^[0-9 ]*$/.test(search)) {
                        var pmids = search.split(" ");
                        if(pmids.some(pmid => Number(pmid) === publication.pmid )){
                            filteredPublications.push(publication);
                        }
                    }else {
                        var addPublication = true;
                        // check filter search
                        if (search !== "") {
                            addPublication = false;
                            //pmcid
                            if(publication.pmcid !== undefined && publication.pmcid.toLowerCase().includes(search.toLowerCase())) {
                                addPublication = true
                            }
                            //publicationTypeCanonical
                            if(publication.publicationTypeCanonical !== undefined && publication.publicationTypeCanonical.toLowerCase().includes(search.toLowerCase())) {
                                addPublication = true
                            }
                            //scopusDocID
                            if(publication.scopusDocID !== undefined && publication.scopusDocID.toLowerCase().includes(search.toLowerCase())) {
                                addPublication = true
                            }
                            //journalTitleISOabbreviation
                            if(publication.journalTitleISOabbreviation !== undefined && publication.journalTitleISOabbreviation.toLowerCase().includes(search.toLowerCase())) {
                                addPublication = true
                            }
                            //journalTitleVerbose
                            if(publication.journalTitleVerbose !== undefined && publication.journalTitleVerbose.toLowerCase().includes(search.toLowerCase())) {
                                addPublication = true
                            }
                            //publication date display
                            if(publication.displayDate !== undefined && publication.displayDate.toLowerCase().includes(search.toLowerCase())) {
                                addPublication = true
                            }
                            //doi
                            if(publication.doi !== undefined && publication.doi.toLowerCase().includes(search.toLowerCase())) {
                                addPublication = true
                            }
                            // title
                            if (publication.title.toLowerCase().includes(search.toLowerCase())) {
                                addPublication = true;
                            }
                            // journal
                            if (publication.journal.toLowerCase().includes(search.toLowerCase())) {
                                addPublication = true;
                            }
                            //issn
                            if(publication.issn !== undefined) {
                                var issnArray = publication.issn.map((issn, issnIndex) => {
                                    return issn.issn
                                })
                                if(issnArray.join().toLowerCase().includes(search.toLowerCase())) {
                                    addPublication = true;
                                }
                            }
                            // authors
                            if (publication.authors !== undefined) {
                                var authorsArray = publication.authors.map(function (author, authorIndex) {
                                    return author.authorName;
                                });
                                if (authorsArray.join().toLowerCase().includes(search.toLowerCase())) {
                                    addPublication = true;
                                }
                            }
                            //evidence
                            if (publication.evidence !== undefined) {
                                var evidenceArticleArray = publication.evidence.map(function (evidence, evidenceIndex) {
                                    return evidence.articleData;
                                });
                                var evidenceInstArray = publication.evidence.map(function (evidence, evidenceIndex) {
                                    return evidence.institutionalData;
                                });
                                if (evidenceInstArray.join().toLowerCase().includes(search.toLowerCase())) {
                                    addPublication = true;
                                }
                                if (evidenceArticleArray.join().toLowerCase().includes(search.toLowerCase())) {
                                    addPublication = true;
                                }
                            }
                        }
                        if (addPublication) {
                            filteredPublications.push(publication);
                        }
                    }
                }else {
                    filteredPublications.push(publication);
                }
            }
        })

        // Sort
        filteredPublications.sort((a, b) => {
            switch(sort) {
                case "0":
                    return b.standardScore - a.standardScore;
                case "1":
                    return a.standardScore - b.standardScore;
                case "2":
                    return new Date(b.standardDate) - new Date(a.standardDate);
                case "3":
                    return new Date(a.standardDate) - new Date(b.standardDate);
                default:
                    return b.standardScore - a.standardScore;
            }
        });


        var from = (parseInt(page, 10) - 1) * parseInt(count, 10);
        var to = from + parseInt(count, 10) - 1;
        var publications = [];
        var i = from;
        for(i; i <= to; i++) {
            if(filteredPublications[i] !== undefined) {
                publications.push(filteredPublications[i]);
            }
        }
        return {
            filteredPublications: filteredPublications,
            paginatedPublications: publications
        };
    }

    const publications = filter()

    return (
        <div className="h6fnhWdeg-tab-content">
            <div className={styles.tabControlsContainer}>
                <Filter onChange={handleFilterUpdate} showSort={true} />
                <button
                    className={`btn btn-primary ${styles.acceptAll}`}
                    onClick={undoAll}
                >Undo all on page</button>
                <button
                    className={`btn btn-primary ${styles.acceptAll}`}
                    onClick={acceptAll}
                >Accept all on page</button>
            </div>
            <p>Not finding what you`&apos;`re looking for? <a onClick={() => { props.tabClickHandler("Add Publication"); } }>Search PubMed...</a></p>
            <Pagination total={publications.filteredPublications.length} page={page} count={count} onChange={handlePaginationUpdate} />
            <div className="table-responsive">
                <table className="table table-striped">
                    <tbody>
                        {
                            publications.paginatedPublications.map(function(item, index){
                                return <Publication item={item} key={index} onAccept={acceptPublication} onUndo={undoPublication} />;
                            })
                        }
                    </tbody>
                </table>
            </div>
            <Pagination total={publications.filteredPublications.length} page={page} count={count} onChange={handlePaginationUpdate} />
        </div>
    );
}

export default TabRejected