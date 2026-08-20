import React, { useState } from "react";
import { reciterUpdatePublication } from '../../../redux/actions/actions'
import { useSelector, useDispatch } from "react-redux";
import styles from '../Tabs/TabControls.module.css';
import Publication from '../Publication/Publication';
import Pagination from '../Pagination/Pagination';
import Filter from '../Filter/Filter';
import fullName from '../../../utils/fullName';
import filterPublicationsBySearchText from '../../../utils/filterPublicationsBySearchText';

const TabAccepted = (props) => {
    
    const [sort, setSort] = useState("0")
    const [search, setSearch] = useState("")
    const [page, setPage] = useState(1)
    const [count, setCount] = useState(100)

    const dispatch = useDispatch()

    const identityData = useSelector((state) => state.identityData)
    const reciterData = useSelector((state) => state.reciterData)
    const showEvidenceDefault = useSelector((state) => state.showEvidenceDefault)

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

    // Publication.tsx's CardFooter calls updatePublication(personIdentifier, pmid,
    // userAssertion) for accept, reject, and undo alike; keep dispatching the same
    // reciterUpdatePublication action the old per-assertion handlers used.
    const updatePublication = (uid, pmid, userAssertion) => {
        const request = {
            faculty: identityData,
            publications: [pmid],
            userAssertion: userAssertion,
            manuallyAddedFlag: false
        }
        dispatch(reciterUpdatePublication(uid, request))
    }

    const rejectAll = () => {
        const publications = filter();
        var ids = [];
        publications.paginatedPublications.forEach(function(item){
            ids.push(item.pmid);
        });
        const request = {
            faculty: identityData,
            publications: ids,
            userAssertion: 'REJECTED'
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
        // ReCiter-Publication-Manager#873: reciterData.reciter undefined until fetch completes.
        const accepted = (reciterData?.reciter?.reCiterArticleFeatures || []).filter(
            (publication) => publication.userAssertion === "ACCEPTED"
        )
        // The hand-rolled search here read fields this article shape doesn't have
        // (title, journal, array-shaped evidence) and threw on the first non-numeric
        // search character; the curator flow's shared util guards the real field names.
        const filteredPublications = filterPublicationsBySearchText(accepted, search)

        // Sort
        filteredPublications.sort((a, b) => {
            switch(sort) {
                case "0":
                    return b.authorshipLikelihoodScore - a.authorshipLikelihoodScore;
                case "1":
                    return a.authorshipLikelihoodScore - b.authorshipLikelihoodScore;
                case "2":
                    return new Date(b.publicationDateStandardized) - new Date(a.publicationDateStandardized);
                case "3":
                    return new Date(a.publicationDateStandardized) - new Date(b.publicationDateStandardized);
                default:
                    return b.authorshipLikelihoodScore - a.authorshipLikelihoodScore;
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
                    className={`btn btn-primary ${styles.rejectAll}`}
                    onClick={rejectAll}
                >Reject all on page</button>
            </div>
            <p>Not finding what you&apos;re looking for? <a onClick={() => { props.tabClickHandler("Add Publication"); } }>Search PubMed...</a></p>
            <Pagination total={publications.filteredPublications.length} page={page} count={count} onChange={handlePaginationUpdate} />
            <div>
                {
                    publications.paginatedPublications.map((item, index) => (
                        <Publication
                            key={item.pmid || index}
                            index={`page${page}${index + 1}`}
                            reciterArticle={item}
                            personIdentifier={identityData.uid}
                            fullName={fullName(identityData.primaryName)}
                            updatePublication={updatePublication}
                            activekey="ACCEPTED"
                            totalCount={publications.filteredPublications.length}
                            paginatedPubsCount={publications.paginatedPublications.length}
                            page={page}
                            showEvidenceDefault={showEvidenceDefault}
                        />
                    ))
                }
            </div>
            <Pagination total={publications.filteredPublications.length} page={page} count={count} onChange={handlePaginationUpdate} />
        </div>
    );
}

export default TabAccepted