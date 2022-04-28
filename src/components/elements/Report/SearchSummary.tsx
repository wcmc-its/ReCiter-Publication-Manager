import { Button, Dropdown, DropdownButton } from "react-bootstrap";
import { useState } from "react";
import ExportModal from "./ExportModal";
import { sortOptions } from "../../../../config/report";

const SortOptionTitles = {
  datePublicationAddedToEntrez: "date added",
  journalImpactScore1: "journal impact score",
  percentileNIH: "percentile NIH",
  citationCountNIH: "citation count NIH",
  trendingPubsScore: "trending Publication score",
  readersMendeley: "reader's mendeley",
  publicationDateStandarized: "date standardized"
}

const SearchSummary = ({ count }, { count: number}) => {
  const [openCSV, setOpenCSV] = useState(false);
  const [openRTF, setOpenRTF] = useState(false);
  const formatter = new Intl.NumberFormat('en-US')

  return (
    <>
      <div className="d-flex justify-content-between align-items-center pt-5">
        <p className="mb-0"><b>{formatter.format(count)} publications</b></p>
        <div className="search-summary-buttons">
        <DropdownButton className={`d-inline-block mx-2`} title="Sort by" id="dropdown-basic-button" onSelect={() => console.log('sort')}>
          {
            Object.keys(sortOptions).filter(option => sortOptions[option] === true).map((sortOption, index) => {
              return (
                <Dropdown.Item eventKey={index} key={index} value={sortOption}>{SortOptionTitles[sortOption]}</Dropdown.Item>
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