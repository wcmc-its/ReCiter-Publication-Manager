import { Button, Dropdown, DropdownButton, Form } from "react-bootstrap";
import { useState } from "react";
import ExportModal from "./ExportModal";
import { sortOptions } from "../../../../config/report";
import { AiOutlineCheck } from "react-icons/ai";
import styles from "./SearchSummary.module.css";
import { reciterConfig } from "../../../../config/local";
import { metrics, labels } from "../../../../config/report";
import { useSelector, RootStateOrAny } from "react-redux";
import { PublicationSearchFilter, ReporstResultId } from "../../../../types/publication.report.search";
import Excel from 'exceljs';

const SearchSummary = ({ 
  count, 
  onClick,
  selected 
}: { count: number, onClick: (sort: string, value: boolean) => void, selected: string[]}) => {
  const [openCSV, setOpenCSV] = useState(false);
  const [openRTF, setOpenRTF] = useState(false);
  const [exportError, setExportError] = useState(false);
  const [exportArticleLoading, setExportArticleLoading] = useState(false);
  const [exportArticlePplLoading, setExportArticlePplLoading] = useState(false);
  const [exportAuthorshipCsvLoading, setExportAuthorshipCsvLoading] = useState(false);
  const formatter = new Intl.NumberFormat('en-US')

  // Search Results
  const reportsSearchResults = useSelector((state: RootStateOrAny) => state.reportsSearchResults)

  // Selected Filters
  const pubSearchFilter = useSelector((state: RootStateOrAny) => state.pubSearchFilter)

  // PersonIdentifiers and pmids of all Search Results
  const reportsResultsIds = useSelector((state: RootStateOrAny) => state.reportsResultsIds)
  const reportsResultsIdsLoading = useSelector((state: RootStateOrAny) => state.reportsResultsIdsLoading)

  // for CSV Report
  const workbook = new Excel.Workbook();
  let date = new Date().toISOString().slice(0, 10);
  let authorshipFileName = `Authorship-ReCiter-${date}`;

  const handleSelect = (option) => {
    let value = true;
    if (selected.includes(option)) {
      value = false;
    }

    onClick(option, value);
  }

  const exportArticle = () => {
    
    if (Object.keys(reportsResultsIds)) {
      generateExportArticle (reportsResultsIds);
    } else {
      // TODO: fetch data if it hasn't been on the page load
     
      }
  }

  const generateExportArticle = (requestBody: ReporstResultId) => {
    setExportArticleLoading(true);
    fetch(`/api/db/reports/publication`, {
      credentials: "same-origin",
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Authorization': reciterConfig.backendApiKey
      },
      body: JSON.stringify(requestBody)
    }).then(response => {
      return response.blob();
    })
    .then(fileBlob => {
      let date = new Date().toISOString().slice(0, 10);
      let fileName = 'ArticleReport-ReCiter-' + date + ".rtf";
      var link = document.createElement('a')  // once we have the file buffer BLOB from the post request we simply need to send a GET request to retrieve the file data
      link.href = window.URL.createObjectURL(fileBlob)
      link.download = fileName;
      link.click()
      link.remove();
      setExportArticleLoading(false);
    })
    .catch(error => {
      console.log(error)
      setExportError(true);
      setExportArticleLoading(false);
    })
  }

  const exportArticlePeopleOnly = () => {

    if (Object.keys(reportsResultsIds)) {
      generateRTFPeopleOnly(reportsResultsIds);
    } else {
      // TODO: fetch data if it hasn't been on the page load
     
      }
  }

  const generateRTFPeopleOnly = (requestBody: ReporstResultId) => {
    setExportArticlePplLoading(true);
    fetch(`/api/db/reports/publication/people-only`, {
      credentials: "same-origin",
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Authorization': reciterConfig.backendApiKey
      },
      body: JSON.stringify({ personIdentifiers: requestBody.personIdentifiers })
    }).then(response => {
      return response.blob();
    })
    .then(fileBlob => {
      let date = new Date().toISOString().slice(0, 10);
      let fileName = 'ArticleReport-ReCiter-' + date + ".rtf";
      var link = document.createElement('a')  // once we have the file buffer BLOB from the post request we simply need to send a GET request to retrieve the file data
      link.href = window.URL.createObjectURL(fileBlob)
      link.download = fileName;
      link.click()
      link.remove();
      setExportArticlePplLoading(false);
    })
    .catch(error => {
      console.log(error)
      setExportError(true);
      setExportArticlePplLoading(false);
    })
  }

  const exportAuthorshipCSV = (requestBody: PublicationSearchFilter) => {
    setExportAuthorshipCsvLoading(true);
    fetch(`/api/db/reports/publication/authorship`, {
      credentials: "same-origin",
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Authorization': reciterConfig.backendApiKey
      },
      body: JSON.stringify(requestBody)
    }).then(response => {
      return response.json();
    }).then(result => {
      generateAuthorshipCSV(result);
      setExportAuthorshipCsvLoading(false);
    }).catch(error => {
      setExportAuthorshipCsvLoading(false);
      console.log(error);
    })
  }

  const generateAuthorshipCSV = async (data) => {
    let columns = [];
    let metricsKeys = Object.keys(metrics);
    Object.keys(labels).forEach(labelItem => {
      if (metricsKeys.includes(labelItem)) {
        // filter ones to display that are set in config file to true
        Object.keys(labels[labelItem]).forEach((labelField) => {
          if (metrics[labelItem][labelField] === true) {
            let labelObj = { header: labels[labelItem][labelField], key: labelField};
            columns = [ ...columns, labelObj];
          }
        })
      } else {
        Object.keys(labels[labelItem]).forEach((labelField) => {
          let labelObj = { header: labels[labelItem][labelField], key: labelField};
          columns = [ ...columns, labelObj];
        })
      }
    })
    try {
      // creating one worksheet in workbook
      const worksheet = workbook.addWorksheet(authorshipFileName);
      // add worksheet columns
      // each columns contains header and its mapping key from data
      worksheet.columns = columns;
      
      // process the data and add rows to worksheet
      data.forEach(item => {
        let itemRow = {};
        Object.keys(item).forEach(obj => {
          if (obj === 'PersonPersonTypes') {
            let personTypes = item[obj].map(personType => personType.personType).join('|');
            itemRow = {...itemRow, personType: personTypes};
          } else {
            itemRow = {...itemRow, ...item[obj]};
          }
        })
        worksheet.addRow(itemRow);
      })

      // write the content using writeBuffer
      const buf = await workbook.csv.writeBuffer();
      let blobFromBuffer = new Blob([buf]);
      let fileName = `${authorshipFileName}.csv`;
      var link = document.createElement('a')  // once we have the file buffer BLOB from the post request we simply need to send a GET request to retrieve the file data
      link.href = window.URL.createObjectURL(blobFromBuffer);
      link.download = fileName;
      link.click()
      link.remove();
    } catch (error) {
      console.error('<<<ERRROR>>>', error);
      console.error('Something Went Wrong', error.message);
    } finally {
      // removing worksheet's instance to create new one
      workbook.removeWorksheet(authorshipFileName);
    }
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
                  {labels.article[sortOption]}
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
        countInfo={Object.keys(reportsResultsIds).length > 0 ? `${formatter.format(reportsResultsIds.personIdentifiers.length)} known authorships` : ""}
        buttonsList={
          [
            {title: 'Export Authorship', loading: exportAuthorshipCsvLoading, onClick: exportAuthorshipCSV}
          ]
        }
      />
      <ExportModal
        show={openRTF}
        handleClose={() => setOpenRTF(false)}
        title="RTF"
        countInfo={Object.keys(reportsResultsIds).length > 0 ? `${formatter.format(reportsResultsIds.pmids.length)} articles` : ""}
        loadingResults={reportsResultsIdsLoading}
        error={exportError}
        buttonsList={[
          { title: 'Export article report', loading: exportArticleLoading, onClick: exportArticle}
        ]}
      />
    </>
  )
}

export default SearchSummary;