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
import { Author } from "../../../../types/Author";
import { PublicationSearchFilter } from "../../../../types/publication.report.search";
import Profile from "../Profile/Profile";
import { useModal } from "../../../hooks/useModal";

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

  /* Custom Hooks */
  // pagination
  const [count, page, handlePaginationUpdate, handleCountUpdate] = usePagination(0);

  // modal management
  const [openModal, uid, updateUid, handleClose, handleShow] = useModal();

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
      offset: offset,
      limit: count,
    };

    return updatedSearchFilter;
  }


  const updateAuthorFilterData = (input: string) => {
    dispatch(updateAuthorFilter(input))
  }

  const updateJournalFilterData = (input: string) => {
    dispatch(updateJournalFilter(input));
  }

  const onPaginationUpdate = (newPage: number) => {
    // update the state of pagination
    handlePaginationUpdate(newPage);

    // fetch data
    let updatedSearchFilter = updatePagination(newPage, count, pubSearchFilter);
    dispatch(updatePubSearchFilters(updatedSearchFilter));
    dispatch(getReportsResults(updatedSearchFilter));
  }

  const onCountUpdate = (newCount: string) => {
    // update count state
    handleCountUpdate(newCount);

    // fetch data
    let updatedSearchFilter = updatePagination(page, count, pubSearchFilter);
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

  const updateSort = (sort: string, value: boolean) => {
    let updatedSearchFilter = {
      ...pubSearchFilter,
      sort: {
        ...pubSearchFilter.sort,
        [sort]: value
      }
    }

    // dispatch redux filter state update
    dispatch(updatePubSearchFilters(updatedSearchFilter));

    // fetch data
    dispatch(getReportsResults(updatedSearchFilter));
  }

  const getSelectedValues = (list) => {
    if (list.sort) {
      let selected = Object.keys(pubSearchFilter.sort).map((key) => {
        if (pubSearchFilter.sort[key]) {
          return key;
        }
      })
      return selected;
    } else {
      return [];
    }
  }

  // authors that have been selected in tthe filters need to be highlighted
  const highlightSelectedAuthors = (authors: Author[], pubSearchFilter: PublicationSearchFilter) => {
    let updatedAuthors = authors.map((author: Author) => {
      let updatedAuthor;
      // check if author id is one of selected person idenitfies
      if (pubSearchFilter.filters.personIdentifers.includes(author.personIdentifier)) {
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

    // // open modal
    // handleShow();
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
          {reportsSearchResults && 
          <SearchSummary
            count={reportsSearchResults.count}
            onClick={updateSort}
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
                onClickAuthor={onClickAuthor}
              />
            )
          })}
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