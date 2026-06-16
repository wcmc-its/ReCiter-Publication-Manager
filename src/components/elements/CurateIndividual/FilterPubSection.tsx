import React, { useState, FormEvent, useEffect } from "react";
import { Dropdown, DropdownButton } from "react-bootstrap";
import { Publication } from "../../../../types/publication";
import styles from "./CurateIndividual.module.css";
import Pagination from '../Pagination/Pagination';

interface FilterPubSectionProps {
  searchTextUpdate: (searchText: string) => void
  sortUpdate: (sort: string) => void
  publications: Array<Publication>
  updateAll: any
  tabType: string
  isSearchText: any
  page?: number
  count?: number
  totalCount?: number
  handlePaginationUpdate?: (page: number) => void
  handleCountUpdate?: (count: string) => void
}

const FilterPubSection: React.FC<FilterPubSectionProps> = (props) => {
  const [searchText, setSearchText] = useState<any>(props.isSearchText.searchedText);

  const handleInputChange = (e: any) => {
    setSearchText(e.target.value);
    props.searchTextUpdate(e.target.value);
  }

  const handleSortChange = (e: string) => {
    props.sortUpdate(e);
  }

  useEffect(() => {
    const { searchedText, userAssertion } = props.isSearchText;
    // if (userAssertion === props.tabType) setSearchText(searchedText);
    if (searchedText){
      props.searchTextUpdate(searchedText);
    } 
  }, [props.isSearchText])

  const updateAll = (userAssertion: string) => {
    // TODO: call redux action
    props.updateAll(userAssertion);
    let filteredIds = props.publications.map((publication: Publication) => publication.pmid);
  }

  const handleFormSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
  }


  return (
    <div className={styles.controlsBar}>
      {props.tabType !== 'ACCEPTED' && <button className={styles.btnBulkAccept} onClick={() => updateAll('ACCEPTED')}>Accept All</button>}
      {props.tabType !== 'REJECTED' && <button className={styles.btnBulkReject} onClick={() => updateAll('REJECTED')}>Reject All</button>}
      {props.tabType !== 'NULL' && <button className={styles.btnBulkUndo} onClick={() => updateAll('NULL')}>Undo All</button>}
      <div className={styles.controlsSpacer} />
      <form onSubmit={handleFormSubmit} style={{display:'flex', gap: 8, alignItems:'center'}}>
        <input
          className={styles.searchInput}
          type="text"
          placeholder="Filter..."
          value={searchText}
          onChange={handleInputChange}
        />
      </form>
      <DropdownButton className={styles.sortDropdown} title="Sort by" id="curate-sort" onSelect={(eventKey) => handleSortChange(eventKey)}>
        <Dropdown.Item eventKey="1" className={styles.sortItem}>Score ↓</Dropdown.Item>
        <Dropdown.Item eventKey="3" className={styles.sortItem}>Score ↑</Dropdown.Item>
        <Dropdown.Item eventKey="2" className={styles.sortItem}>Date ↓</Dropdown.Item>
        <Dropdown.Item eventKey="4" className={styles.sortItem}>Date ↑</Dropdown.Item>
      </DropdownButton>
      {props.totalCount > 0 && props.handlePaginationUpdate && (
        <Pagination
          total={props.totalCount}
          page={props.page}
          count={props.count}
          onChange={props.handlePaginationUpdate}
          onCountChange={props.handleCountUpdate}
          merged
        />
      )}
    </div>
  )
}

export default FilterPubSection