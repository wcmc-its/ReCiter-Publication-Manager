import React, { useState } from "react"; 
import appStyles from '../App/App.module.css';
import styles from './Report.module.css';
import QuickReport from './QuickReport';
import SearchSummary from './SearchSummary';
import { FilterSection } from './FilterSection';
import { useDispatch , useSelector, RootStateOrAny } from 'react-redux';
import { useEffect } from 'react';
import { reportsFilters, updatePubSearchFilters, clearPubSearchFilters, updateAuthorFilter, updateJournalFilter, getReportsResults, getReportsResultsInitial } from '../../../redux/actions/actions';
import { ReportsResultPane } from "./ReportsResultPane";
import { usePagination } from "../../../hooks/usePagination";
import Pagination from "../Pagination/Pagination";
import { getOffset } from "../../../utils/pagination";
import Loader from "../Common/Loader";

const Report = () => {
  const dispatch = useDispatch()

  // state to manage what content to display on inital load
  const [isInitialLoad, setIsInitialLoad] = useState<boolean>(true);

  // filters loading state
  const reportingFiltersLoading = useSelector((state: RootStateOrAny) => state.reportingFiltersLoading)

  // search results loading state
  const reportsSearchResultsLoading = useSelector((state: RootStateOrAny) => state.reportsSearchResultsLoading)

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

  // pagination
  const [count, page, handlePaginationUpdate, handleCountUpdate] = usePagination(0);

  // fetch filters on mount
  useEffect(() => {
    dispatch(reportsFilters(authorInput, journalInput));
    dispatch(getReportsResultsInitial());
  }, [])

  // fetch new data on page and count update
  useEffect(() => {

    if (!isInitialLoad) {
      // update offset and limit
      let updatedSearchFilter = updatePagination(page, count, pubSearchFilter);

      // dispatch redux filter state update
      dispatch(updatePubSearchFilters(updatedSearchFilter));

      // fetch data
      dispatch(getReportsResults(updatedSearchFilter));
    }

  }, [page, count])

  const updatePagination = (page: number, count: number, prevPubSearchFilter: any) => {
    // calculate the offset
    let offset = getOffset(page, count);

    // update the filter object
    let updatedSearchFilter = {
      ...prevPubSearchFilter, 
      filters: {
        ...pubSearchFilter.filters,
        offset: offset,
        limit: count,
      }
    };

    return updatedSearchFilter;
  }


  const updateAuthorFilterData = (input: string) => {
    dispatch(updateAuthorFilter(input))
  }

  const updateJournalFilterData = (input: string) => {
    dispatch(updateJournalFilter(input));
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
        [filterLower]: lowerBound,
        [filterUpper]: upperBound
      }
    };
    // dispatch redux state update
    dispatch(updatePubSearchFilters(updatedSearchFilter));
  }

  const clearFilters = () => {
    dispatch(clearPubSearchFilters());
  }

  const searchResults = () => {
    dispatch(getReportsResults(pubSearchFilter));
    if (isInitialLoad) {
      setIsInitialLoad(false);
    }
  }

  if (reportingFiltersLoading) {
    return (
      <Loader />
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
          />
        {reportsSearchResultsLoading && <Loader />}
        {!reportsSearchResultsLoading && 
        <div className="search-results-container">
          {reportsSearchResults && <SearchSummary count={reportsSearchResults.count}/>}
          <Pagination
            count={count}
            total={reportsSearchResults?.count}
            page={page}
            onChange={handlePaginationUpdate}
            onCountChange={handleCountUpdate}
            />
          {Object.keys(reportsSearchResults).length > 0 && reportsSearchResults?.rows.map((row) => {
            return (
              <ReportsResultPane
                key={row.pmid}
                title={row.articleTitle}
                pmid={row.pmid}
                doi={row.doi}
                citationCount={row.citationCountNIH}
                percentileRank={row.percentileNIH}
                relativeCitationRatio={row.relativeCitationRatioNIH}
                trendingPubsScore={row.trendingPubsScore}
                journalImpactScore1={row.journalImpactScore1}
                authors={row.authors}
                journalTitleVerbose={row.journalTitleVerbose}
                publicationDateDisplay={row.publicationDateDisplay}
                publicationTypeCanonical={row.publicationTypeCanonical}
              />
            )
          })}
        </div>}
      </div>
    </div>
  )
}

export default Report;