import React, { useState, ChangeEvent } from "react";
import { Button, Row, Form, Dropdown, DropdownButton } from "react-bootstrap";
import { Publication } from "../../../../types/publication";
import styles from "./CurateIndividual.module.css";
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';

interface FilterPubSectionProps {
  searchTextUpdate: (searchText: string) => void
  sortUpdate: (sort: string) => void
  publications: Array<Publication>
  updateAll: any
  tabType: string
}

const FilterPubSection: React.FC<FilterPubSectionProps> = (props) => {
  const [searchText, setSearchText] = useState<string>('');

  const handleInputChange = (e: any) =>{
    setSearchText(e.target.value);
    props.searchTextUpdate(e.target.value);
  }

  const handleSortChange = (e: string) => {
    props.sortUpdate(e);
  }

  const updateAll = (userAssertion: string) => {
    // TODO: call redux action
    props.updateAll(userAssertion);
    let filteredIds = props.publications.map((publication: Publication) => publication.pmid);
  }

  return (
    <div className={`${styles.filterPubSection} py-4 d-flex justify-content-between`}>
      <div className="filter-section-buttons d-flex flex-basis-content">
        { props.tabType !== 'ACCEPTED' && <Button className="m-2" variant="primary" onClick={() => updateAll('ACCEPTED')}>Accept All</Button>}
        { props.tabType !== 'REJECTED' && <Button className={`m-2 ${styles.whiteBtn}`} variant="outline-primary" onClick={() => updateAll('REJECTED')}>Reject All</Button>}
        { props.tabType !== 'NULL' && <Button className={`m-2 ${styles.whiteBtn}`} variant="outline-primary" onClick={() => updateAll('NULL')}>Undo All</Button>}
      </div>
      <div className="d-flex align-items-end">
        <Form className="d-flex flex-basis-content mx-2">
          <Form.Control type="text" placeholder="Filter..." value={searchText} onChange={(e) => handleInputChange(e)}/>
        </Form>
        <DropdownButton className={`${styles.basicDropdown} mx-2`} title="Sort by" id="dropdown-basic-button" onSelect={(eventKey) => handleSortChange(eventKey)}>
          <Dropdown.Item eventKey="1">Score <ArrowDownwardIcon /></Dropdown.Item>
          <Dropdown.Item eventKey="2">Date <ArrowDownwardIcon /></Dropdown.Item>
          <Dropdown.Item eventKey="3">Score <ArrowUpwardIcon /></Dropdown.Item>
          <Dropdown.Item eventKey="4">Date <ArrowUpwardIcon /></Dropdown.Item>
        </DropdownButton>
      </div>
    </div>
  )
}

export default FilterPubSection