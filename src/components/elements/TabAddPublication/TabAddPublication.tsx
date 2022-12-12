// @ts-nocheck
import React, { useState, FunctionComponent, useRef, useEffect } from "react";
import styles from './TabAddPublication.module.css';
import appStyles from '../App/App.module.css';
import AddPublication from '../AddPublication/AddPublication';
import { reciterUpdatePublication, pubmedFetchData, UpdatePubMadeData, reCalcPubMedPubCount,clearPubMedData, addPubMedFetchMoreData, clearPubMedFetchMoreData } from '../../../redux/actions/actions'
import { RootStateOrAny, useSelector, useDispatch } from "react-redux";
import Pagination from '../Pagination/Pagination';
import Filter from '../Filter/Filter';
import { YearPicker } from 'react-dropdown-date';
import { useSession } from "next-auth/client";
// import { VrpanoSharp, ClearIcon } from "@mui/icons-material";
import ClearIcon from '@mui/icons-material/Clear';
import {Form,Button} from "react-bootstrap"
import { toast } from "react-toastify"
import filterPublicationsBySearchText from "../../../utils/filterPublicationsBySearchText";
import { publicationsPreviousDataFetching } from "../../../redux/reducers/reducers";
import ToastContainerWrapper from "../ToastContainerWrapper/ToastContainerWrapper";


interface FuncProps {
    tabType: string,
    personIdentifier: string,
    updatePublicationAssertion: (reciterArticle: any, userAssertion: string, prevUserAssertion: string) => void,
    pubSearchFilters? : any,
    handleUpdateSearchFilters : any
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
    const [showFiltersCount, setShowFiltersCount] = useState<boolean>(false)
    const [allPubs, setAllPubs] = useState<number>()

    const [publications, setpublications] = useState<any>({})

    const [latestYear, setLatestYear] = useState<any>("")
    const [earliestYear, setEarliestYear] = useState<any>("")
    const userId = session?.data?.databaseUser?.userID;

    const [acceptRejecteMsg, setAcceptRejecteMsg] = useState<String>()

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
        if(props.pubSearchFilters){
            const {pubMendSearchText, pubMedLatestYear, pubMedEarliestYear,pubMedshowFiltersCount} = props.pubSearchFilters
            setPubmedSearch(pubMendSearchText);
            setLatestYear(pubMedLatestYear);
            setEarliestYear(pubMedEarliestYear);
            setShowFiltersCount(pubMedshowFiltersCount);
        }
        filter()
    }, [])

     useEffect(() => {
        if(props.pubSearchFilters){
            const {pubMendSearchText, pubMedLatestYear, pubMedEarliestYear,pubMedshowFiltersCount} = props.pubSearchFilters
            setPubmedSearch(pubMendSearchText);
            setLatestYear(pubMedLatestYear);
            setEarliestYear(pubMedEarliestYear);
            setShowFiltersCount(pubMedshowFiltersCount);
        }
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
        let acceptRejecteMsg=''
        let reciterPublications: Array<any> = []
        reciterData.reciterPending.forEach(function (publication: any) {
            pubmedIds.push(publication)
           reciterPublications.push(publication)
        })
        let acceptPubs = 0;
        let rejectPubs = 0;
        let acceptRejectCount = pubmedData.filter(key  => "acceptedPubMedCount" in key || "rejectedPubMedCount" in key)
        acceptRejectCount.length && acceptRejectCount.map(key => {
          if(key.acceptedPubMedCount) {setAcceptCount(key.acceptedPubMedCount); acceptPubs = key.acceptedPubMedCount}
          else  { setRejectedCount(key.rejectedPubMedCount); rejectPubs = key.rejectedPubMedCount}
        })
        //setAcceptCount(searchAcceptedCountTemp);
        //setRejectedCount(searchRejectedCountTemp);
        acceptRejecteMsg = <span><strong>{acceptPubs }</strong>{" already accepted "}<strong>{rejectPubs}</strong>{' already rejected'}</span>;
        // acceptRejecteMsg = <b>{"text"}</b>

        setAcceptRejecteMsg(acceptRejecteMsg)
        

        // Filter
        var filteredPublications: Array<any> = [];
        if (pubmedData && pubmedData.length > 0) {
            setShowFiltersCount(true)
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
       if(pubmedData && pubmedData.length ==102  && pubmedData[0].greaterThan100 && filteredPublications &&  filteredPublications.length === 100) 
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

        console.log("latestYear", latestYear)
        console.log("earliestYear", earliestYear)
        e.preventDefault();
        if(latestYear >= earliestYear){
        setAllPubs(0 + ' publication displayed');
        setAcceptCount(0);
        setRejectedCount(0);
        setAcceptRejecteMsg("")
        
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
        let pubFilters = {"pubMendSearchText": pubmedSearch, "pubMedLatestYear": latestYear, "pubMedEarliestYear": earliestYear,"pubMedshowFiltersCount":true}
        if(pubmedSearch || earliestYear || latestYear)
        {
            dispatch(pubmedFetchData(query))
            props.handleUpdateSearchFilters(pubFilters)
            filter()
        }
    }else{
        toast.error("Earliest year should not be greater than latest year", {
            position: "top-right",
            autoClose: 2000,
            theme: 'colored'
          });
    }
    }

    

    //Clears Search box text, resets Latest Year and Earliest Year to default value
    const clearFilters = () => {
        setPubmedSearch(' ');
        setLatestYear('');
        setEarliestYear('');
        let pubFilters = {"pubMendSearchText": "", "pubMedLatestYear": "", "pubMedEarliestYear": "","pubMedshowFiltersCount":false}
        props.handleUpdateSearchFilters(pubFilters)
        dispatch(clearPubMedData());
        dispatch(reCalcPubMedPubCount(0))
        dispatch(clearPubMedFetchMoreData())
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
                                            {
                                                showFiltersCount?<>
                                                <p className={styles.totalresult}><b>{allPubs}</b></p>
                                                <p className={styles.totalresult}>{acceptRejecteMsg}</p></>:""
                                            }
                                        </div>
                                        <div className="col-md-8" style={{ float: "right" }}>
                                            <Filter onSearch={handleFilterUpdate} showSort={false} isFrom="pubMed"/>
                                        </div>
                                    </div>

            </div>

            {

                (!pubmedFetchingMore && !pubmedFetchingMore.message) ?

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
                    <div style={{display:"flex"}} className={`${styles.noDataFoundTxet}`}><ClearIcon style={{color:"#ffffff", backgroundColor:"red", borderRadius:"50%", fontSize:"15px", margin:"5px"}} color="danger"/><p>{pubmedFetchingMore.message}</p></div>
            }
            <ToastContainerWrapper/>
        </div>
    );
}

export default TabAddPublication;