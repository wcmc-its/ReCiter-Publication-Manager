import React, { useState, FunctionComponent, useRef, useEffect } from "react";
import styles from './TabAddPublication.module.css';
import appStyles from '../App/App.module.css';
import AddPublication from '../AddPublication/AddPublication';
import { reciterUpdatePublication, pubmedFetchData } from '../../../redux/actions/actions'
import { RootStateOrAny, useSelector, useDispatch } from "react-redux";
import Pagination from '../Pagination/Pagination';
import Filter from '../Filter/Filter';
import { YearPicker } from 'react-dropdown-date';

interface FuncProps {
    onReject(id: number): void,
    onUndo(id: Number): void
}

const TabAddPublication: FunctionComponent<FuncProps> = (props) => {

    const useStateWithCallback = (initialState: any) => {
        const [state, setState] = useState(initialState)
        const callbackRef = useRef(() => undefined)
      
        const setStateCB = (newState: any, callback: any) => {
          callbackRef.current = callback
          setState(newState)
        }
      
        useEffect(() => {
          callbackRef.current?.()
        }, [state])
      
        return [state, setStateCB]
      };

    const dispatch = useDispatch()

    const identityData = useSelector((state: RootStateOrAny) => state.identityData)
    const reciterData = useSelector((state: RootStateOrAny) => state.reciterData)
    const pubmedFetching = useSelector((state: RootStateOrAny) => state.pubmedFetching)
    const pubmedData = useSelector((state: RootStateOrAny) => state.pubmedData)
    const errors = useSelector((state: RootStateOrAny) => state.errors)

    const [sort, setSort] = useState<string>("0")
    const [search, setSearch] = useState<string>("")
    const [page, setPage] = useState<number>(1)
    const [pubmedSearch, setPubmedSearch] = useState<string>("")
    const [count, setCount] = useState<number>(20)
    const [latestYear, setLatestYear] = useState<any>("")
    const [earliestYear, setEarliestYear] = useState<any>("")
    const [resultMode, setResultMode] = useState<any>("")

    const handlePaginationUpdate = (event: React.ChangeEvent<HTMLInputElement>, page: number) => {
        setPage(page)
        if(event.target.value !== undefined) {
            setCount(Number(event.target.value))
        }
    }

    const handleFilterUpdate = (filterState: any) => {
        setSearch(filterState.search)
        setPage(1)
    }

    const acceptPublication = (id: number) => {

        const pubmedPublications: any = []
        pubmedData.forEach(function(publication: any){
            if(publication.pmid === id) {
                publication.evidence = []
                pubmedPublications.push(publication)
            }
        })
        const request = {
            faculty: identityData,
            publications: pubmedPublications,
            userAssertion: 'ACCEPTED',
            manuallyAddedFlag: true
        }
        dispatch(reciterUpdatePublication(identityData.uid, request))
    }

    const rejectPublication = (id: number) => {
        const pubmedPublications: any = []
        pubmedData.forEach(function(publication: any){
            if(publication.pmid === id) {
                publication.evidence = []
                pubmedPublications.push(publication)
            }
        })

        const request = {
            faculty: identityData,
            publications: pubmedPublications,
            userAssertion: 'REJECTED',
            manuallyAddedFlag: true
        }
        dispatch(reciterUpdatePublication(identityData.uid, request))
    }

    const filter = () => {

        // Get array of PMIDs from pending publications
        const pubmedIds: Array<number> = []
        reciterData.reciterPending.forEach(function(publication: any){
            pubmedIds.push(publication.pmid)
        })

        reciterData.reciter.forEach(function(publication: any){
            if(publication.userAssertion === 'ACCEPTED' || publication.userAssertion === 'REJECTED')
            pubmedIds.push(publication.pmid)
        })

        // Filter
        var filteredPublications: Array<any> = [];
        if(pubmedData !== undefined && pubmedData.length  > 0) {
            pubmedData.forEach((publication: any) =>{
                if(!pubmedIds.includes(publication.pmid)) {
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
                                    var issnArray = publication.issn.map((issn: any, issnIndex: number) => {
                                        return issn.issn
                                    })
                                    if(issnArray.join().toLowerCase().includes(search.toLowerCase())) {
                                        addPublication = true;
                                    }
                                }
                                // authors
                                if (publication.authors !== undefined) {
                                    var authorsArray = publication.authors.map(function (author: any, authorIndex: number) {
                                        return author.authorName;
                                    });
                                    if (authorsArray.join().toLowerCase().includes(search.toLowerCase())) {
                                        addPublication = true;
                                    }
                                }
                                //evidence
                                if (publication.evidence !== undefined) {
                                    var evidenceArticleArray = publication.evidence.map(function (evidence: any, evidenceIndex: number) {
                                        return evidence.articleData;
                                    });
                                    var evidenceInstArray = publication.evidence.map(function (evidence: any, evidenceIndex: number) {
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
        }

        var from = (page - 1) * count
        var to = from + count - 1
        var publications = []
        var i = from;
        for(i; i <= to; i++) {
            if(filteredPublications[i] !== undefined) {
                publications.push(filteredPublications[i]);
            }
        }
        if(publications.length === 0 && reciterData.pubmedSearchResults !== undefined && reciterData.pubmedSearchResults.length > 0) {
            publications = reciterData.pubmedSearchResults;
        }
        return {
            filteredPublications: filteredPublications,
            paginatedPublications: publications
        };
    }

    const searchFunction = () => {
        var query = {
            "strategy-query": pubmedSearch,
            start: '',
            end: ''
        };

        if(earliestYear !== '' && latestYear !== '') {
            query = {
                "strategy-query": pubmedSearch,
                "start": earliestYear + '/01/01',
                "end": latestYear + '/12/31'
            }
        }
        if(earliestYear !== '' && (latestYear === '' || latestYear === undefined)) {
            query = {
                "strategy-query": pubmedSearch,
                "start": earliestYear + '/01/01',
                "end": '2500/12/31'
            }
        }
        if((earliestYear === '' || earliestYear === undefined) && latestYear !== '') {
            query = {
                "strategy-query": pubmedSearch,
                "start": '1600/01/01',
                "end": latestYear + '/12/31'
            }
        }
        dispatch(pubmedFetchData(query))
    }
    const publications = filter();

    const reciterPublications: Array<any> = []
    reciterData.reciterPending.forEach(function(publication: any){
        reciterPublications.push(publication)
    })

    reciterData.reciter.forEach(function(publication: any){
        reciterPublications.push(publication)
    })

    var searchAcceptedCount = 0;
    var searchRejectedCount = 0;

    if(pubmedData !== undefined && pubmedData.length  > 0) {
            pubmedData.forEach((searchPub: any) => {
            if (reciterPublications.some(publication => publication.pmid === searchPub.pmid && publication.userAssertion === "ACCEPTED")) {
                searchAcceptedCount++;
            }
            if (reciterPublications.some(publication => publication.pmid === searchPub.pmid && publication.userAssertion === "REJECTED")) {
                searchRejectedCount++;
            }
        })
    }
    console.log(errors)

    return (
        <div>
            <div className={styles.addPublicationSearchContainer}>
                <div className="row">
                    <div className="col-md-6">
                        <input
                            type="text"
                            className="form-control"
                            placeholder="Search..."
                            onChange={(e) => {setPubmedSearch(e.target.value)}}
                            defaultValue={(pubmedSearch !== undefined)?pubmedSearch:''}
                        />
                    </div>
                    <div className="col-md-2" >
                        <div className="show-rows">
                            <label className={styles.yearLabel}>Earliest</label>
                            <YearPicker
                                defaultValue={''}
                                // default is 1900
                                start={new Date().getFullYear()-20}
                                // default is false
                                required={true}
                                // mandatory
                                value={(earliestYear !== undefined)?earliestYear:(earliestYear !== undefined)? earliestYear:''}
                                // mandatory
                                onChange={(year: string) => {
                                    setEarliestYear(year);
                                }}
                                classes={"form-control"}
                                id={'year'}
                                name={'year'}
                                optionClasses={'option classes'}
                            />
                        </div>
                    </div>
                    <div className="col-md-2" >
                        <div className="show-rows">
                            <label className={styles.yearLabel}>Latest</label>
                            <YearPicker
                                defaultValue={''}
                                // default is 1900
                                start={new Date().getFullYear()-20}
                                // default is false
                                required={true}
                                // mandatory
                                value={(latestYear !== undefined)?latestYear:(latestYear !== undefined)?latestYear:''}
                                // mandatory
                                onChange={(year: string) => {
                                    setLatestYear(year);
                                }}
                                classes={"form-control"}
                                id={'year'}
                                name={'year'}
                                optionClasses={'option classes'}
                            />
                        </div>
                    </div>
                    <div className="col-md-2">
                        <button
                            className="btn btn-primary"
                            onClick={searchFunction}
                        >Search</button>
                    </div>
                </div>
            </div>

            {
                (pubmedFetching) ? <div className={appStyles.appLoader}></div> :
                <div>
                    {(pubmedSearch != "") ?
                        <div>
                            {(pubmedData.length > 0)?
                                <div className="row">
                                    <div className="col-md-4">
                                        <p>Number of results: <strong>{pubmedData.length}</strong></p>
                                        <p><span>See also: <strong>{searchAcceptedCount}</strong> already accepted, <strong>{searchRejectedCount}</strong> already rejected</span></p>
                                    </div>
                                    <div className="col-md-4" style={{float: "right"}}>
                                        <Filter onChange={handleFilterUpdate} showSort={false}/>
                                    </div>
                                </div>:null
                            }

                            {
                                (errors && errors.length == 0) ?
                                    <React.Fragment>
                                        <Pagination total={pubmedData.length} page={page}
                                                    count={count}
                                                    onChange={handlePaginationUpdate}/>
                                        <div className="table-responsive">
                                            <table className="h6fnhWdeg-publications-table table table-striped">
                                                <tbody>
                                                {
                                                    publications.paginatedPublications.map(function (item: any, index: number) {
                                                        return <AddPublication item={item} key={index}
                                                                                onAccept={acceptPublication}
                                                                                onReject={rejectPublication}/>;
                                                    })
                                                }
                                                </tbody>
                                            </table>
                                        </div>
                                        <Pagination total={publications.filteredPublications.length}
                                                    page={page} count={count}
                                                    onChange={handlePaginationUpdate}/>
                                    </React.Fragment>
                                    :
                                    <div><strong>Too many results. Please provide additional search parameters</strong></div>
                            }

                        </div> : null
                    }
                </div>
            }


        </div>
    );
}

export default TabAddPublication;