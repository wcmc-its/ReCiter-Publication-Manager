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

const Report = () => {
  const dispatch = useDispatch()

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


  const [authorInput, setAuthorInput] = useState<string>('');
  const [journalInput, setJournalInput] = useState<string>('');
  const [reset, setReset] = useState<boolean>(false);
  const [isFiltersOn, setIsFiltersOn] = useState<boolean>(false);



  /* Custom Hooks */
  // pagination
  const [count, page, handlePaginationUpdate, handleCountUpdate] = usePagination(0);

  // modal management
  const [openModal, uid, updateUid, handleClose, handleShow] = useModal();

  // fetch filters on mount
  useEffect(() => {
    SetIsFirstLoad(true);
    dispatch(showEvidenceByDefault(null));
    const {personIdentifers,personTypes,institutions,orgUnits } = pubSearchFilter.filters
    if(personIdentifers.length > 0 || personTypes.length > 0 || institutions.length > 0 || orgUnits.length > 0){
      if(personIdentifers.length > 0) updateAuthorFilterData(personIdentifers, 10, "fromSearchPage")

      setIsFiltersOn(true);
      dispatch(getReportsResults(pubSearchFilter, true));
    } else {
       dispatch(reportsFilters(authorInput , journalInput));
       dispatch(updateAuthorFilter());
       dispatch(getReportsResultsInitial());
      }
    // searchResults();
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
          />
        {reportsSearchResultsLoading && 
          <Container fluid className="h-100 p-5">
            <Loader />
          </Container>
        }
        {!reportsSearchResultsLoading && 
        <div className="search-results-container">
          {reportsSearchResults && 
          <SearchSummary
            count={reportsSearchResults.count}
            onClick={updateSort}
            onGetReportsDatabyPubFilters = { ()=> dispatch(fetchReportsResultsIds(pubSearchFilter))}
            selected={getSelectedValues(pubSearchFilter)}
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
          />
            <Profile 
              uid={uid}
              modalShow={openModal}
              handleShow={handleShow}
              handleClose={handleClose}
              />
        </div>}
      </div>
    </div>
  )
}

export default Report;