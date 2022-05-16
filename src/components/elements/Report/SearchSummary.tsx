import { Button, Dropdown, DropdownButton, Form } from "react-bootstrap";
import { useState } from "react";
import ExportModal from "./ExportModal";
import { sortOptions } from "../../../../config/report";
import { AiOutlineCheck } from "react-icons/ai";
import styles from "./SearchSummary.module.css";

const SortOptionTitles = {
  datePublicationAddedToEntrez: "date added",
  journalImpactScore1: "journal impact score",
  percentileNIH: "percentile NIH",
  citationCountNIH: "citation count NIH",
  trendingPubsScore: "trending Publication score",
  readersMendeley: "reader's mendeley",
  publicationDateStandarized: "date standardized"
}

const SearchSummary = ({ 
  count, 
  onClick,
  selected 
}: { count: number, onClick: (sort: string, value: boolean) => void, selected: string[]}) => {
  const [openCSV, setOpenCSV] = useState(false);
  const [openRTF, setOpenRTF] = useState(false);
  const formatter = new Intl.NumberFormat('en-US')

  const handleSelect = (option) => {
    let value = true;
    if (selected.includes(option)) {
      value = false;
    }

    onClick(option, value);
  }

  return (
    <>
      <div className="d-flex justify-content-between align-items-center pt-5">
        <p className="mb-0"><b>{formatter.format(count)} publications</b></p>
        <div className="search-summary-buttons">
        <DropdownButton className={`d-inline-block mx-2`} title="Sort by" id="dropdown-basic-button" onSelect={(value) => handleSelect(value)}>
          {
            Object.keys(sortOptions).filter(option => sortOptions[option] === true).map((sortOption, index) => {
              return (
                <Dropdown.Item eventKey={sortOption} key={index} className={`dropdown-item ${selected.includes(sortOption) ? styles.selected : styles.dropdownItem}`}>
                  {selected.includes(sortOption) && <AiOutlineCheck />} 
                  {SortOptionTitles[sortOption]}
                </Dropdown.Item>
              )
            })
          }
        </DropdownButton>
          <Button variant="warning" className="m-2" onClick={() => setOpenCSV(true)}>Export to CSV</Button>
          <Button variant="warning" className="m-2" onClick={() => setOpenRTF(true)}>Export to RTF</Button>
        </div>
      </div>
      <ExportModal
        show={openCSV}
        handleClose={() => setOpenCSV(false)}
        title="CSV"
        countInfo=""
        exportArticle={() => console.log('Export Article')}
        exportAuthorship={() => console.log('Export Authorship')}
      />
      <ExportModal
        show={openRTF}
        handleClose={() => setOpenRTF(false)}
        title="RTF"
        countInfo=""
        exportArticle={() => console.log('Export Article')}
      />
    </>
  )
}

export default SearchSummary;