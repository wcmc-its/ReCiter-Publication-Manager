import { Button } from "react-bootstrap";
import { useState } from "react";
import ExportModal from "./ExportModal";

const SearchSummary = ({ count }, { count: number}) => {
  const [openCSV, setOpenCSV] = useState(false);
  const [openRTF, setOpenRTF] = useState(false);

  return (
    <>
      <div className="d-flex justify-content-between align-items-center">
        <p className="mb-0"><b>{count} publications</b></p>
        <div className="search-summary-buttons">
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