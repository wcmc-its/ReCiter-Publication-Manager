import React, { useState } from "react"; 
import appStyles from '../App/App.module.css';
import styles from './Report.module.css';
import QuickReport from './QuickReport';
import SearchSummary from './SearchSummary';
import { FilterSection } from './FilterSection';
import { useDispatch , useSelector, RootStateOrAny } from 'react-redux';
import { useEffect } from 'react';
import { reportsFilters, updatePubSearchFilters, clearPubSearchFilters, updateAuthorFilter, updateJournalFilter, getReportsResults, getReportsResultsInitial, fetchReportsResultsIds, showEvidenceByDefault } from '../../../redux/actions/actions';
import { ReportsResultPane } from "./ReportsResultPane";
import { usePagination } from "../../../hooks/usePagination";
import Pagination from "../Pagination/Pagination";
import { getOffset } from "../../../utils/pagination";
import Loader from "../Common/Loader";
import { Author } from "../../../../types/Author";
import { PublicationSearchFilter } from "../../../../types/publication.report.search";
import Profile from "../Profile/Profile";
import { useModal } from "../../../hooks/useModal";
import { Container } from "react-bootstrap";
import { ReportResults } from "./ReportResults";
import { countPersons } from "../../../../controllers/db/person.controller";
import { useSession } from 'next-auth/client';

const Report = () => {
  const dispatch = useDispatch()
  const [session, loading] = useSession();

  // state to manage what content to display on inital load
  const [isInitialLoad, setIsInitialLoad] = useState<boolean>(true);
  const [isFilterClear, setIsFilterClear] = useState<boolean>(false);
  const [isFirstLoad, SetIsFirstLoad] = useState<boolean>(false);



  // filters loading state
  const reportingFiltersLoading = useSelector((state: RootStateOrAny) => state.reportingFiltersLoading)

  // search results loading state
  const reportsSearchResultsLoading = useSelector((state: RootStateOrAny) => state.reportsSearchResultsLoading)


  // search results loading state on pagination update
  const reportsPaginatedResultsLoading = useSelector((state: RootStateOrAny) => state.reportsPaginatedResultsLoading)

  // list of options for filters
  const articleTypeFilterData = useSelector((state: RootStateOrAny) => state.articleTypeFilterData)
  const authorFilterData = useSelector((state: RootStateOrAny) => state.authorFilterData)
  const dateFilterData = useSelector((state: RootStateOrAny) => state.dateFilterData)
  const journalFilterData = useSelector((state: RootStateOrAny) => state.journalFilterData)
  const journalRankFilterData = useSelector((state: RootStateOrAny) => state.journalRankFilterData)
  const orgUnitsData = useSelector((state: RootStateOrAny) => state.orgUnitsData)
  const institutionsData = useSelector((state: RootStateOrAny) => state.institutionsData)
  const personTypesData = useSelector((state: RootStateOrAny) => state.personTypesData)

  // selected filter options
  const pubSearchFilter = useSelector((state: RootStateOrAny) => state.pubSearchFilter)
  // search results
  const reportsSearchResults = useSelector((state: RootStateOrAny) => state.reportsSearchResults)
  const updatedAdminSettings = useSelector((state: RootStateOrAny) => state.updatedAdminSettings)
  const reportsResultsIds = useSelector((state: RootStateOrAny) => state.reportsResultsIds)


  const [authorInput, setAuthorInput] = useState<string>('');
  const [journalInput, setJournalInput] = useState<string>('');
  const [reset, setReset] = useState<boolean>(false);
  const [isFiltersOn, setIsFiltersOn] = useState<boolean>(false);
  const [reportFiltersLabes, setReportFiltersLabes] = useState([])
  const [viewProfileLabels, setViewProfileLabels] = useState([])
  const [reportLabelsForSort, setReportLabelsForSort] = useState([])
  const [headShotLabelData, setHeadShotLabelData] = useState([])
  const [exportAuthorShipLabels, setExportAuthorShipLabels] = useState([])
  const [exportArticleLabels, setExportArticleLabels] = useState([])
  const [reportingWebDisplay, setReportingWebDisplay] = useState([])
  const [isOnlyAuthorFilters, setIsOnlyAuthorFilters] = useState<boolean>(false)
  const [exportArticlesRTF, setExportArticlesRTF] = useState([])



  /* Custom Hooks */
  // pagination
  const [count, page, handlePaginationUpdate, handleCountUpdate] = usePagination(0);

  // modal management
  const [openModal, uid, updateUid, handleClose, handleShow] = useModal();

  // fetch filters on mount
  useEffect(() => {
    // let parsedAdminSettings:adminSettings["adminSettings"]  = 
    let adminSettings = JSON.parse(JSON.stringify(session?.adminSettings));
    var viewAttributes = [];
    var profileViewAttributes = [];
    var sortLabelViewAttributes = [];
    var headShotLabels = [];
    var exportAuthorShipCSVLabels = [];
    var exportArticleCSVLabels = [];
    var reportingWeb = [];
    var exportArticleRTF = [];


    if (updatedAdminSettings.length > 0) {
      // updated settings from manage settings page
      let updatedData = updatedAdminSettings.find(obj => obj.viewName === "reportingFilters")
      let viewProfileUpdatedData = updatedAdminSettings.find(obj => obj.viewName === "viewProfile")
      let sortLabelsUpdatedData = updatedAdminSettings.find(obj => obj.viewName === "reportingWebViewSort")
      let headShotData = updatedAdminSettings.find(obj => obj.viewName === "headshot")
      let exportAuthors = updatedAdminSettings.find(obj => obj.viewName === "reportingAuthorshipCSV")
      let exportArticle = updatedAdminSettings.find(obj => obj.viewName === "reportingArticleCSV")
      let reportingWebDisplay = updatedAdminSettings.find(obj => obj.viewName === "reportingWebDisplay")
      let exportRTF = updatedAdminSettings.find(obj => obj.viewName === "reportingArticleRTF")


      sortLabelViewAttributes = sortLabelsUpdatedData.viewAttributes;
      profileViewAttributes = viewProfileUpdatedData.viewAttributes;
      viewAttributes = updatedData.viewAttributes;
      headShotLabels = headShotData.viewAttributes;
      exportArticleCSVLabels = exportArticle.viewAttributes;
      exportAuthorShipCSVLabels = exportAuthors.viewAttributes;
      reportingWeb = reportingWebDisplay.viewAttributes;
      exportArticleRTF = exportRTF.viewAttributes;

    } else {
      // regular settings from session
      let data = JSON.parse(adminSettings).find(obj => obj.viewName === "reportingFilters")
      let viewProfileUpdatedData = JSON.parse(adminSettings).find(obj => obj.viewName === "viewProfile")
      let sortLabelsUpdatedData = JSON.parse(adminSettings).find(obj => obj.viewName === "reportingWebViewSort")
      let headShotData =JSON.parse(adminSettings).find(obj => obj.viewName === "headshot")
      let exportAuthors = JSON.parse(adminSettings).find(obj => obj.viewName === "reportingAuthorshipCSV")
      let exportArticle = JSON.parse(adminSettings).find(obj => obj.viewName === "reportingArticleCSV")
      let reportingWebDisplay = JSON.parse(adminSettings).find(obj => obj.viewName === "reportingWebDisplay")
      let exportRTF = JSON.parse(adminSettings).find(obj => obj.viewName === "reportingArticleRTF")


      sortLabelViewAttributes = JSON.parse(sortLabelsUpdatedData.viewAttributes);
      profileViewAttributes = JSON.parse(viewProfileUpdatedData.viewAttributes);
      viewAttributes = JSON.parse(data.viewAttributes);
      headShotLabels = JSON.parse(headShotData.viewAttributes);
      exportArticleCSVLabels = JSON.parse(exportArticle.viewAttributes);
      exportAuthorShipCSVLabels = JSON.parse(exportAuthors.viewAttributes);
      reportingWeb = JSON.parse(reportingWebDisplay.viewAttributes);
      exportArticleRTF = JSON.parse(exportRTF.viewAttributes);

    }

    // view attributes data from session or updated settings
    setReportFiltersLabes(viewAttributes);
    setViewProfileLabels(profileViewAttributes);
    setReportLabelsForSort(sortLabelViewAttributes);
    setHeadShotLabelData(headShotLabels)
    setExportAuthorShipLabels(exportAuthorShipCSVLabels)
    setExportArticleLabels(exportArticleCSVLabels)
    setReportingWebDisplay(reportingWeb)
    setExportArticlesRTF(exportArticleRTF)


    SetIsFirstLoad(true);
    dispatch(showEvidenceByDefault(null));
    const {personIdentifers,personTypes,institutions,orgUnits } = pubSearchFilter.filters;

    if(personIdentifers.length > 0 || personTypes.length > 0 || institutions.length > 0 || orgUnits.length > 0){

      if(personIdentifers.length > 0) updateAuthorFilterData(personIdentifers, 10, "fromSearchPage")

      setIsFiltersOn(true);
      dispatch(getReportsResults(pubSearchFilter, true));
      dispatch(reportsFilters(authorInput , journalInput));
    } else {
       dispatch(reportsFilters(authorInput , journalInput));
       dispatch(updateAuthorFilter());
       dispatch(getReportsResultsInitial());
      }


  }, [])


  // fetch new data on page and count update
  useEffect(() => {
    if (isFirstLoad) {
      if (!isInitialLoad) {
        // update offset and limit
        let updatedSearchFilter = updatePagination(page, count, pubSearchFilter);

        // dispatch redux filter state update
        dispatch(updatePubSearchFilters(updatedSearchFilter));

        // fetch data
        dispatch(getReportsResults(updatedSearchFilter, true));
      } else if(isInitialLoad &&  isFiltersOn){
         // update offset and limit
         let updatedSearchFilter = updatePagination(page, count, pubSearchFilter);

         // dispatch redux filter state update
         dispatch(updatePubSearchFilters(updatedSearchFilter));
 
         // fetch data
         dispatch(getReportsResults(updatedSearchFilter, true));
      }else if(isInitialLoad &&  !isFiltersOn){
        // calculate the offset
        let offset = getOffset(page, count);
        // fetch data with default settings by passing limit and offset
        dispatch(getReportsResultsInitial(count, offset));
        // fetch all personidentifiers and pmids
      }
    }

  }, [page, count])

  const updatePagination = (page: number, count: number, prevPubSearchFilter: any) => {
    // calculate the offset
    let offset = getOffset(page, count);

    // update the filter object
    let updatedSearchFilter = {
      ...prevPubSearchFilter,
      offset: offset,
      limit: count,
    };

    return updatedSearchFilter;
  }


  const updateAuthorFilterData = (input: string, count: number = 10, isFrom: string ) => {
    if( input || isFrom) dispatch(updateAuthorFilter(input, input ? 0 : count, isFrom))
  }

  const updateJournalFilterData = (input: string, count: number = 10) => {
    if(input) dispatch(updateJournalFilter(input, count));
  }

  const onPaginationUpdate = (newPage: number) => {
    // update the state of pagination
    handlePaginationUpdate(newPage);

    // if (!isInitialLoad) {
    //   // fetch data
    //   let updatedSearchFilter = updatePagination(newPage, count, pubSearchFilter);
    //   dispatch(updatePubSearchFilters(updatedSearchFilter));
    //   dispatch(getReportsResults(updatedSearchFilter, true));
    // }
  }

  const onCountUpdate = (newCount: string) => {
    // update count state
    handleCountUpdate(newCount);

    // fetch data
    let updatedSearchFilter = updatePagination(page, parseInt(newCount), pubSearchFilter);
    dispatch(updatePubSearchFilters(updatedSearchFilter));
    dispatch(getReportsResults(updatedSearchFilter));
  }

  let filters = {
    articleTypeFilterData : [...articleTypeFilterData],
    authorFilterData: [...authorFilterData],
    dateFilterData: [...dateFilterData],
    journalFilterData: [...journalFilterData],
    journalRankFilterData: [...journalRankFilterData],
    orgUnitsData: [...orgUnitsData],
    institutionsData: [...institutionsData],
    personTypesData: [...personTypesData],
  }

  let filterUpdateOptions = {
    authorFilterData: updateAuthorFilterData,
    journalFilterData: updateJournalFilterData,
  }

  const onLoadMore = (seemoreCount)=>{
    dispatch(updateAuthorFilter("", seemoreCount));
  }

  const onSetSearchFilters = (filter, value) => {
    // update the filter object
    let updatedSearchFilter = { 
      ...pubSearchFilter, 
      filters: {
        ...pubSearchFilter.filters,
        [filter]: value
      }
    };
    // dispatch redux state update
    dispatch(updatePubSearchFilters(updatedSearchFilter));
  }

  // filters that determine range are different since they accept 2 values: upper and lower bound
  const onSetRangeFilters = (filterLower, filterUpper, lowerBound, upperBound) => {
  
    // update the filter object
    let updatedSearchFilter = { 
      ...pubSearchFilter, 
      filters: {
        ...pubSearchFilter.filters,
        [filterLower]: lowerBound == null ? "" : lowerBound ,
        [filterUpper]: upperBound == null ? "" : upperBound
      }
    };
    // dispatch redux state update
    dispatch(updatePubSearchFilters(updatedSearchFilter));
  }

  const clearFilters = () => {
    setIsFilterClear(!isFilterClear)
    dispatch(clearPubSearchFilters());
    setReset(!reset)
    dispatch(updateAuthorFilter());
  }

  const searchResults = () => {

    dispatch(getReportsResults(pubSearchFilter));
    handlePaginationUpdate(1);
    if (isInitialLoad) {
      setIsInitialLoad(false);
    }
  }

  const updateSort = (sort: string, order: string) => {
    let updatedSearchFilter = {
      ...pubSearchFilter,
      sort: {
       type: sort, order: order
      }
    }

    // dispatch redux filter state update
    dispatch(updatePubSearchFilters(updatedSearchFilter));

    // fetch data
    dispatch(getReportsResults(updatedSearchFilter, true));
  }

  const getSelectedValues = (list) => {
    if (list.sort) {
      return list.sort;
    } else {
      return {};
    }
  }

  // authors that have been selected in tthe filters need to be highlighted
  const highlightSelectedAuthors = (authors: Author[], pubSearchFilter: PublicationSearchFilter) => {
    let updatedAuthors = authors.map((author: Author) => {
      let updatedAuthor;
      // check if author id is one of selected person idenitfies
      if (author && author.personIdentifier && pubSearchFilter.filters.personIdentifers.includes(author.personIdentifier)) {
        updatedAuthor = {
          ...author,
          highlightAuthor: "1"
        }
      } else {
        updatedAuthor = {
          ...author,
          highlightAuthor: "0"
        }
      }

      return updatedAuthor;
    });

    return updatedAuthors;
  }

  // open modal on highlighted author click
  const onClickAuthor = (personIdentifier: string) => {
    // set author uid
    updateUid(personIdentifier);
    // open modal
    handleShow();
  }

  const onGetReportsDatabyPubFilters =()=>{
    const {personIdentifers,personTypes,institutions,orgUnits ,datePublicationAddedToEntrezLowerBound,datePublicationAddedToEntrezUpperBound,journalTitleVerbose,publicationTypeCanonical, authorPosition } = pubSearchFilter.filters;

    if((personIdentifers.length > 0 || personTypes.length > 0 || institutions.length > 0 || orgUnits.length > 0 || authorPosition.length > 0) && (datePublicationAddedToEntrezLowerBound == "" && datePublicationAddedToEntrezUpperBound == "" && journalTitleVerbose.length === 0 && publicationTypeCanonical.length === 0)) {
        
    }  else  dispatch(fetchReportsResultsIds(pubSearchFilter)) 
  }

  if (reportingFiltersLoading) {
    return (
      <Container fluid className="h-100 justify-content-center align-items-center">
        <Loader />
      </Container>
    )
  } else return (
    <div>
      <div className={appStyles.mainContainer}>
        <h1 className={styles.header}>Create Reports</h1>
        <FilterSection 
          filterOptions={filters}
          filterUpdateOptions={filterUpdateOptions}
          onSetSearchFilters={onSetSearchFilters}
          onSetRangeFilters={onSetRangeFilters}
          selectedFilters={pubSearchFilter.filters}
          clearFilters={clearFilters}
          searchResults={searchResults}
          isFilterClear={isFilterClear}
          onLoadMore = {onLoadMore}
          reportFiltersLabes = {reportFiltersLabes}
          />
        {reportsSearchResultsLoading ? 
          <Container fluid className="h-100 p-5">
            <Loader />
          </Container>
          :
        <div className="search-results-container">
          {reportsSearchResults && 
          <SearchSummary
            count={reportsSearchResults.count}
            onClick={updateSort}
            onGetReportsDatabyPubFilters = { ()=> onGetReportsDatabyPubFilters()}
            selected={getSelectedValues(pubSearchFilter)}
            reportLabelsForSort={reportLabelsForSort}
            exportAuthorShipLabels = {exportAuthorShipLabels}
            exportArticleLabels = {exportArticleLabels}
          exportArticlesRTF = {exportArticlesRTF}
            />
            }
          <Pagination
            count={count}
            total={reportsSearchResults?.count}
            page={page}
            onChange={onPaginationUpdate}
            onCountChange={onCountUpdate}
            />
          <ReportResults
            results={reportsSearchResults}
            loading={reportsPaginatedResultsLoading}
            onClickAuthor={onClickAuthor}
            pubSearchFilter={pubSearchFilter}
            highlightSelectedAuthors={highlightSelectedAuthors}
            reportingWebDisplay = {reportingWebDisplay}
          />
            <Profile 
              uid={uid}
              modalShow={openModal}
              handleShow={handleShow}
              handleClose={handleClose}
              viewProfileLabels={viewProfileLabels}
              headShotLabelData={headShotLabelData}
              />
        </div>}
      </div>
    </div>
  )
}

export default Report;