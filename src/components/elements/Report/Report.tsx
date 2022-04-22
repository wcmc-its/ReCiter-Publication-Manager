import React, { useState } from "react"; 
import appStyles from '../App/App.module.css';
import styles from './Report.module.css';
import QuickReport from './QuickReport';
import SearchSummary from './SearchSummary';
import { FilterSection } from './FilterSection';
import { useDispatch , useSelector, RootStateOrAny } from 'react-redux';
import { useEffect } from 'react';
import { reportsFilters, updatePubSearchFilters, clearPubSearchFilters, updateAuthorFilter, updateJournalFilter, getReportsResults } from '../../../redux/actions/actions';

const Report = () => {
  const dispatch = useDispatch()

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

  // fetch filters on mount
  useEffect(() => {
    dispatch(reportsFilters(authorInput, journalInput));
  }, [])


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
    // TODO: pass filters
    dispatch(getReportsResults(pubSearchFilter));
  }

  return (
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
        {reportsSearchResults && <SearchSummary count={reportsSearchResults.count}/>}
      </div>
    </div>
  )
}

export default Report;