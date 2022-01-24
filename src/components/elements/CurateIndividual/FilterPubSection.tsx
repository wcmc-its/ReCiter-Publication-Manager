import React, { useState } from "react";
import { Button, Row, Form } from "react-bootstrap";
import styles from "./CurateIndividual.module.css";

interface FilterPubSectionProps {
  searchTextUpdate: (searchText: string) => void
}

const FilterPubSection: React.FC<FilterPubSectionProps> = (props) => {
  const [searchText, setSearchText] = useState<string>('');

  const handleInputChange = (e) =>{
    setSearchText(e.target.value);
    // TODO: filter
    props.searchTextUpdate(e.target.value);
  }

  return (
    <Row className={`${styles.filterPubSection} py-4 d-flex flex-column justify-content-between`}>
      <div className="filter-section-buttons d-flex flex-basis-content">
        <Button className="m-2" variant="primary">Accept All</Button>
        <Button className={`m-2 ${styles.whiteBtn}`} variant="outline-primary">Reject All</Button>
      </div>
      <Form className="d-flex flex-basis-content">
        <Form.Control type="text" placeholder="Filter..." value={searchText} onChange={(e) => handleInputChange(e)}/>
      </Form>
    </Row>
  )
}

export default FilterPubSection