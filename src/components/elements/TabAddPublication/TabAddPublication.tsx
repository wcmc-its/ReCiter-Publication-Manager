// @ts-nocheck
import React, { useState, FunctionComponent, useRef, useEffect } from "react";
import styles from './TabAddPublication.module.css';
import appStyles from '../App/App.module.css';
import AddPublication from '../AddPublication/AddPublication';
import { reciterUpdatePublication, pubmedFetchData, UpdatePubMadeData, reCalcPubMedPubCount } from '../../../redux/actions/actions'
import { RootStateOrAny, useSelector, useDispatch } from "react-redux";
import Pagination from '../Pagination/Pagination';
import Filter from '../Filter/Filter';
import { YearPicker } from 'react-dropdown-date';
import { useSession } from "next-auth/client";
import { VrpanoSharp } from "@mui/icons-material";
import {Form,Button} from "react-bootstrap"
import filterPublicationsBySearchText from "../../../utils/filterPublicationsBySearchText";
import { publicationsPreviousDataFetching } from "../../../redux/reducers/reducers";

interface FuncProps {
    tabType: string,
    personIdentifier: string,
    updatePublicationAssertion: (reciterArticle: any, userAssertion: string, prevUserAssertion: string) => void
}

const TabAddPublication: FunctionComponent<FuncProps> = (props) => {

    



    const dispatch = useDispatch()

    const identityData = useSelector((state: RootStateOrAny) => state.identityData)
    const reciterData = useSelector((state: RootStateOrAny) => state.reciterData)
    const pubmedFetching = useSelector((state: RootStateOrAny) => state.pubmedFetching)
    const pubmedData = useSelector((state: RootStateOrAny) => state.pubmedData)
    const pubmedFetchingMore = useSelector((state: RootStateOrAny) => state.pubmedFetchingMore)
    const isAcceptedCount = useSelector((state: RootStateOrAny) => state.acceptedCount)
    const isRejectedCount = useSelector((state: RootStateOrAny) => state.rejectedCount)
    const totalPubMedPubCount = useSelector((state: RootStateOrAny) => state.pubMedCount)


    const errors = useSelector((state: RootStateOrAny) => state.errors)
    const [session, loading] = useSession();

    const [sort, setSort] = useState<string>("0")
    const [search, setSearch] = useState<string>("")
    const [page, setPage] = useState<number>(1)
    const [pubmedSearch, setPubmedSearch] = useState<string>("")
    const [count, setCount] = useState<number>(100)
    const [acceptedCountState, setAcceptCount] = useState<number>(0)
    const [rejectedCountState, setRejectedCount] = useState<number>(0)

    const [allPubs, setAllPubs] = useState<number>()

    const [publications, setpublications] = useState<any>({})

    const [latestYear, setLatestYear] = useState<any>("")
    const [earliestYear, setEarliestYear] = useState<any>("")
    const userId = session?.data?.databaseUser?.userID;

    const handlePaginationUpdate = (event: React.ChangeEvent<HTMLInputElement>, page: number) => {
        setPage(page)
        if (event.target.value !== undefined) {
            setCount(Number(event.target.value))
        }
    }

    const handleFilterUpdate = (filterState: any) => {
        const newSearch = filterState ? filterState : ""
        setSearch(filterState)
        setPage(1)
        filter(filterState ? filterState : "");
    }

    const mapPubMedAuthorsToReciterAuthors = (authosList) => {
        let authorsPrepared = [];
        authosList && authosList.map((author, index) => {
            authorsPrepared.push({
                firstName: author.authorName,
                initials: "",
                lastName: "",
                rank: author.rank,
                targetAuthor: false
            })
        })

        return authorsPrepared
    }

    const acceptPublication = async (id: number, userAssertion: string) => {
        setAcceptCount(acceptedCountState + 1)
       // setAllPubs(allPubs - 1)

        const pubmedPublications: any = [];
        let updatedpubs: any = [];
        let newReciterData = reciterData.reciter.reCiterArticleFeatures
        pubmedData.forEach(function (publication: any) {
            if (publication.pmid === id) {
                publication.evidence = []
                pubmedPublications.push(publication)
                let newObject = Object.assign(publication, {
                    "userAssertion": "ACCEPTED",
                    "articleTitle": publication.title,
                    "reCiterArticleAuthorFeatures": mapPubMedAuthorsToReciterAuthors(publication.authors)
                })
                newReciterData.push(newObject);
            } else {
                updatedpubs.push(publication);
            }
        })
        const request = {
            faculty: identityData,
            publications: pubmedPublications.length > 0 ? [pubmedPublications[0].pmid] : "",
            userAssertion: 'ACCEPTED',
            manuallyAddedFlag: true,
            userID: userId,
            personIdentifier: props.personIdentifier,
        }
        dispatch(reciterUpdatePublication(identityData.uid, request))
        dispatch(UpdatePubMadeData(updatedpubs))

        props.updatePublicationAssertion( (pubmedPublications.length > 0 ? pubmedPublications[0] : ""), userAssertion = "ACCEPTED", props.tabType);
    }

    const rejectPublication = (id: number, userAssertion: string) => {
        setRejectedCount(rejectedCountState + 1);
       // setAllPubs(allPubs - 1);
        const pubmedPublications: any = []
        let updatedpubs: any = [];
        let newReciterData = reciterData.reciter.reCiterArticleFeatures
        pubmedData.forEach(function (publication: any) {
            if (publication.pmid === id) {
                publication.evidence = []
                pubmedPublications.push(publication)
                let newObject = Object.assign(publication, {
                    "userAssertion": "REJECTED",
                    "articleTitle": publication.title,
                    "reCiterArticleAuthorFeatures": mapPubMedAuthorsToReciterAuthors(publication.authors)
                })
                newReciterData.push(newObject)
            }
            else {
                updatedpubs.push(publication)
            }
        })

        const request = {
            faculty: identityData,
            publications: pubmedPublications.length > 0 ? [pubmedPublications[0].pmid] : "",
            userAssertion: 'REJECTED',
            manuallyAddedFlag: true,
            userID: userId,
            personIdentifier: props.personIdentifier,
        }
        dispatch(reciterUpdatePublication(identityData.uid, request))
        dispatch(UpdatePubMadeData(updatedpubs))
        props.updatePublicationAssertion((pubmedPublications.length > 0 ? pubmedPublications[0] : ""), userAssertion = "REJECTED", props.tabType);
    }
    useEffect(() => {
        filter()
    }, [])

     useEffect(() => {
        filter()
    }, [pubmedData])
    
    var totalPubs = 0;

    const allReciterPubData = ()=>{
        let reciterPublications: Array<any> = []
        reciterData.reciterPending.forEach(function (publication: any) {
            reciterPublications.push(publication)
        })

        reciterData.reciter.reCiterArticleFeatures.forEach(function (publication: any) {
            reciterPublications.push(publication)
        })
        return reciterPublications
    }

    const filter = (search) => {
        // Get array of PMIDs from pending publications
        const pubmedIds: Array<number> = []
        let reciterPublications: Array<any> = []
        reciterData.reciterPending.forEach(function (publication: any) {
            pubmedIds.push(publication)
           reciterPublications.push(publication)
        })
        let searchAcceptedCountTemp = 0;
        let searchRejectedCountTemp = 0;
        reciterData.reciter.reCiterArticleFeatures.forEach(function (publication: any) {
            if(publication.userAssertion ==='ACCEPTED')
                searchAcceptedCountTemp++;
            else if(publication.userAssertion === "REJECTED")
                searchRejectedCountTemp++; 
        })
        setAcceptCount(searchAcceptedCountTemp);
        setRejectedCount(searchRejectedCountTemp);
        //setAllPubs(pubmedData && pubmedData.length ==100  && pubmedData[0].greaterThan100? 'Showing the first 100 records':pubmedData.length +' publications displayed');
      /*if (pubmedData !== undefined && pubmedData.length) {
            let searchAcceptedCountTemp = 0;
            let searchRejectedCountTemp = 0;
            pubmedData.forEach((searchPub: any) => {
                reciterPublications.map(publication => {
                    if (publication.pmid === searchPub.pmid && publication.userAssertion === "ACCEPTED") {
                        searchAcceptedCountTemp++;
                    }
                    if (publication.pmid === searchPub.pmid && publication.userAssertion === "REJECTED") {
                        searchRejectedCountTemp++;
                    }
                })
            })

            totalPubs = pubmedData.length - searchAcceptedCountTemp - searchRejectedCountTemp;
            totalPubs = totalPubs >= 0 ? totalPubs : 0;
            // if(accessToUpdate){
                setAcceptCount(searchAcceptedCountTemp);
                setRejectedCount(searchRejectedCountTemp);
            // }
            setAllPubs(totalPubs);
        }*/

        // Filter
        var filteredPublications: Array<any> = [];
        if (pubmedData !== undefined && pubmedData.length > 0) {
            pubmedData.forEach((publication: any) => {
               // if (!pubmedIds.includes(publication.pmid)) {
                if (publication && publication.pmid) {
                    if (search !== "" && search !== undefined) {
                        if (/^[0-9 ]*$/.test(search)) {
                            var pmids = search.split(" ");
                            if (pmids.some(pmid => Number(pmid) === publication.pmid)) {
                                filteredPublications.push(publication);
                            }
                        } else {
                            console.log("searchText", search)
                            var addPublication = true;
                            // check filter search
                            if (search !== "") {
                                addPublication = false;
                                //pmcid
                                if (publication.pmcid && publication.pmcid.toLowerCase().includes(search.toLowerCase())) {
                                    addPublication = true
                                }
                                //publicationTypeCanonical
                                if (publication.publicationTypeCanonical && publication.publicationTypeCanonical.toLowerCase().includes(search.toLowerCase())) {
                                    addPublication = true
                                }
                                //scopusDocID
                                if (publication.scopusDocID  && publication.scopusDocID.toLowerCase().includes(search.toLowerCase())) {
                                    addPublication = true
                                }
                                //journalTitleISOabbreviation
                                if (publication.journalTitleISOabbreviation && publication.journalTitleISOabbreviation.toLowerCase().includes(search.toLowerCase())) {
                                    addPublication = true
                                }
                                //journalTitleVerbose
                                if (publication.journalTitleVerbose  && publication.journalTitleVerbose.toLowerCase().includes(search.toLowerCase())) {
                                    addPublication = true
                                }
                                //publication date display
                                if (publication.displayDate  && publication.displayDate.toLowerCase().includes(search.toLowerCase())) {
                                    addPublication = true
                                }
                                //doi
                                if (publication.doi  && publication.doi.toLowerCase().includes(search.toLowerCase())) {
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
                                if (publication.issn) {
                                    var issnArray = publication.issn.map((issn: any, issnIndex: number) => {
                                        return issn.issn
                                    })
                                    if (issnArray.join().toLowerCase().includes(search.toLowerCase())) {
                                        addPublication = true;
                                    }
                                }
                                // authors
                                if (publication.authors) {
                                    var authorsArray = publication.authors.map(function (author: any, authorIndex: number) {
                                        return author.authorName;
                                    });
                                    if (authorsArray.join().toLowerCase().includes(search.toLowerCase())) {
                                        addPublication = true;
                                    }
                                }
                                //evidence
                                if (publication.evidence) {
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
                    } else {
                        filteredPublications.push(publication);
                    }
                }
            })

            
        }

        var from = (page - 1) * count
        var to = from + count - 1
        var publications = []
        var i = from;
        for (i; i <= to ; i++) {
            if (filteredPublications[i] !== undefined) {
                publications.push(filteredPublications[i]);
            }
        }
        if (publications.length === 0 && reciterData.pubmedSearchResults !== undefined && reciterData.pubmedSearchResults.length > 0) {
            publications = reciterData.pubmedSearchResults;
        }
        var publications = {
            filteredPublications: filteredPublications,
            paginatedPublications: publications
        };
       //recaluclating allPubs after the filter
       if(pubmedData && pubmedData.length ==100  && pubmedData[0].greaterThan100 && filteredPublications && pubmedData.length == filteredPublications.length) 
           setAllPubs('Showing the first 100 records');
        else if(pubmedData && pubmedData.length <= 100 && filteredPublications && pubmedData.length == filteredPublications.length)
           setAllPubs(pubmedData.length + `${filteredPublications.length == 1 ? " publication displayed" : " publications displayed" }`  )
        else if(filteredPublications && filteredPublications.length > 0) 
           setAllPubs(filteredPublications.length + `${filteredPublications.length == 1 ? " publication displayed" : " publications displayed" }`)
        else
            setAllPubs(filteredPublications.length + ' publication displayed')
        setpublications(publications)
    }

    const searchFunction =  (e) => {
        e.preventDefault();
        let query='';
         query = {
            "strategy-query": pubmedSearch,
            "start" : '',
            "end" : '',
            "personIdentifier": props.personIdentifier
        };

        if (earliestYear !== '' && latestYear !== '') {
            query['start'] = earliestYear + '/01/01';
            query['end'] =  latestYear + '/12/31';
            
        }
        if (earliestYear !== '' && (latestYear === '' || latestYear === undefined)) {
           
            query['start'] = earliestYear + '/01/01';
            query['end'] =  '2500/12/31';
          
        }
        if ((earliestYear === '' || earliestYear === undefined) && latestYear !== '') {
           
            query['start'] = '1600/01/01';
            query['end'] =  latestYear + '/12/31';
            
        }
        dispatch(pubmedFetchData(query))
        filter()
    }

    

    //Clears Search box text, resets Latest Year and Earliest Year to default value
    const clearFilters = () => {
        setPubmedSearch(' ');
        setLatestYear('');
        setEarliestYear('');
        dispatch(reCalcPubMedPubCount(0))
    }

    return (
        <div>
            <div className={styles.addPublicationSearchContainer}>
                <div className="row">
                    <Form onSubmit={searchFunction} style={{display:"flex"}}>
                    <div className="col-md-5">
                        <input
                            type="text"
                            className="form-control"
                            placeholder="Search..."
                            onChange={(e) => { setPubmedSearch(e.target.value) }}
                            // defaultValue={(pubmedSearch !== undefined)?pubmedSearch:''}
                            value={pubmedSearch}
                        />
                    </div>
                    <div className={`col-md-2 ${styles.adjustColPostion}`}>
                        <label className={styles.yearLabel}>Earliest</label>
                        {/* </div>
                    <div className="col-md-1" >  */}
                        <div className="show-rows">
                            {/*  */}
                            <YearPicker
                                defaultValue={'Years'}
                                // default is 1900
                                start={new Date().getFullYear() - 20}
                                // default is false
                                // required={true}
                                // mandatory
                                value={(earliestYear !== undefined) ? earliestYear : (earliestYear !== undefined) ? earliestYear : ''}
                                // mandatory
                                onChange={(year: string) => {
                                    setEarliestYear(year);
                                }}
                                classes={styles.yeardropdownborder}//{"form-control"}
                                id={'year'}
                                name={'year'}
                                optionClasses={'option classes'}

                            />

                        </div>
                    </div>
                    <div className={`col-md-2 ${styles.adjustColPostion}`} >
                        <label className={styles.yearLabel}>Latest</label>
                        {/* </div>
                    <div className="col-md-1" > */}
                        <div className="show-rows">
                            {/* <label className={styles.yearLabel}>Latest</label> */}
                            <YearPicker
                                defaultValue={'Years'}
                                // default is 1900
                                start={new Date().getFullYear() - 20}
                                // default is false
                                // required={true}
                                // mandatory
                                value={(latestYear !== undefined) ? latestYear : (latestYear !== undefined) ? latestYear : ''}
                                // mandatory
                                onChange={(year: string) => {
                                    setLatestYear(year);
                                }}
                                classes={styles.yeardropdownborder}//"form-control"}
                                id={'year'}
                                name={'year'}
                                optionClasses={'option classes'}

                            />
                        </div>
                    </div>

                    <div className={`col-md-2 ${styles.adjustColPostion}`}>
                        <Button
                            className={styles.searchButtonCss}
                            onClick={searchFunction}
                            type="submit"
                        >Search</Button>
                        <a className={styles.resetButtonCss} onClick={clearFilters}>Reset</a>
                    </div>
                    </Form>

                </div>
                <div className={`row ${styles.filterSecbgColor}`}>
                                        <div className="col-md-4">
                                            <p className={styles.totalresult}><strong>{allPubs}</strong></p>
                                            <p className={styles.totalresult}><span><strong>{acceptedCountState}</strong> already accepted, <strong>{rejectedCountState}</strong> already rejected</span></p>
                                        </div>
                                        <div className="col-md-8" style={{ float: "right" }}>
                                            <Filter onSearch={handleFilterUpdate} showSort={false} isFrom="pubMed"/>
                                        </div>
                                    </div>

            </div>

            {

                (pubmedFetchingMore === false) ?

                    (pubmedFetching) ? <div className={appStyles.appLoader}></div> :
                        <div>
                            {(publications?.paginatedPublications?.length > 0) ?
                                <div>
                                    {/* <div className={`row ${styles.filterSecbgColor}`}>
                                        <div className="col-md-4">
                                            <p className={styles.totalresult}><strong>{allPubs}</strong></p>
                                            <p className={styles.totalresult}><span><strong>{acceptedCountState}</strong> already accepted, <strong>{rejectedCountState}</strong> already rejected</span></p>
                                        </div>
                                        <div className="col-md-8" style={{ float: "right" }}>
                                            <Filter onChange={handleFilterUpdate} showSort={false} />
                                        </div>
                                    </div> */}

                                    {

                                        <React.Fragment>
                                            {/* <Pagination total={pubmedData.length} page={page}
                                                    count={count}
                                                    onChange={handlePaginationUpdate}/> */}
                                            <div className="table-responsive">
                                                <table className=" table table-striped">
                                                    <tbody>
                                                        {
                                                            publications?.paginatedPublications?.map(function (item: any, index: number) {
                                                                return <AddPublication item={item} key={index}
                                                                    onAccept={acceptPublication}
                                                                    onReject={rejectPublication} />;
                                                            })
                                                        }
                                                    </tbody>
                                                </table>
                                            </div>
                                            {/*  <Pagination total={publications.filteredPublications.length}
                                                    page={page} count={count}
                                                    onChange={handlePaginationUpdate}/> */}
                                        </React.Fragment>

                                    }

                                </div>
                                : ""
                            }
                        </div>
                    :
                    <div className={`${styles.noDataFoundTxet}`}><strong>Too many results. Please provide additional search parameters</strong></div>
            }
        </div>
    );
}

export default TabAddPublication;