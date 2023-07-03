import { Button, Dropdown, DropdownButton, Form } from "react-bootstrap";
import { useEffect, useState } from "react";
import ExportModal from "./ExportModal";
import { sortOptions } from "../../../../config/report";
import { AiOutlineCheck } from "react-icons/ai";
import styles from "./SearchSummary.module.css";
import { reciterConfig } from "../../../../config/local";
import { metrics, labels } from "../../../../config/report";
import { useSelector, RootStateOrAny } from "react-redux";
import { PublicationSearchFilter, ReporstResultId } from "../../../../types/publication.report.search";
import Excel from 'exceljs';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import { setReportFilterDisplayRank, setReportFilterLabels,setIsVisible, setReportFilterKeyNames } from "../../../utils/constants";


const SearchSummary = ({ 
  reportLabelsForSort,
  count, 
  onClick,
  selected,
  onGetReportsDatabyPubFilters,
  exportAuthorShipLabels,
  exportArticleLabels,
  exportArticlesRTF,
}: {exportArticlesRTF:any, exportArticleLabels :any, exportAuthorShipLabels:any, reportLabelsForSort? : any,count: number, onClick: (sort: string, order: string) => void, selected: any, onGetReportsDatabyPubFilters :()=>void}) => {
  const [openCSV, setOpenCSV] = useState(false);
  const [openRTF, setOpenRTF] = useState(false);
  const [exportError, setExportError] = useState(false);
  const [exportArticleLoading, setExportArticleLoading] = useState(false);
  const [exportArticlePplLoading, setExportArticlePplLoading] = useState(false);
  const [exportAuthorshipCsvLoading, setExportAuthorshipCsvLoading] = useState(false);
  const [exportArticleCsvLoading, setExportArticleCsvLoading] = useState(false);
  const formatter = new Intl.NumberFormat('en-US')
  const [formattedSortOptions, serFormatedSOrtOptions] = useState([]);


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
  let authorshipFileName = `AuthorshipReport-ReCiter-${date}`;
  let articleFileName = `ArticleReport-ReCiter-${date}`;
  const articleLimit = exportArticleLabels && exportArticleLabels.length > 0  && exportArticleLabels.find(obj => obj.maxLimit)
  const articleLimitForRTF = exportArticlesRTF && exportArticlesRTF.length > 0  && exportArticlesRTF.find(obj => obj.maxLimit)
  const authorLimit = exportAuthorShipLabels && exportAuthorShipLabels.length > 0  && exportAuthorShipLabels.find(obj => obj.maxLimit)

  useEffect(() => {

    let sortWithDisplayRank = [];
    Object.keys(sortOptions).filter(option => sortOptions[option] === true).map((sortOption, index) => {
      let labelObj = { labelName: setReportFilterLabels(reportLabelsForSort,sortOption), 
        displayRank: setReportFilterDisplayRank(reportLabelsForSort, sortOption),
        isVisible: setIsVisible(reportLabelsForSort, sortOption),
        keyName: setReportFilterKeyNames(reportLabelsForSort, sortOption)
       };
      {
        labelObj.isVisible && sortWithDisplayRank.push(labelObj);
      }
    })
    serFormatedSOrtOptions(sortWithDisplayRank.sort((a: any, b: any) => a.displayRank - b.displayRank))
  }, [])

  const handleSelect = (option) => {
    let optionInfo = option.split('_');

    if (optionInfo.length) {
      let optionType = optionInfo[0];
      let optionOrder = optionInfo[1];
      onClick(optionType, optionOrder);
    }
  }

  const exportArticle = () => {
    
    if (Object.keys(reportsResultsIds)) {
      generateExportArticle (reportsResultsIds);
    } else {
      // TODO: fetch data if it hasn't been on the page load
     
      }
  }

  const generateExportArticle = (requestBody: ReporstResultId) => {
    let articleMaxLimit = exportArticleLabels && exportArticleLabels.length > 0  && exportArticleLabels.find(obj => obj.maxLimit)
    setExportArticleLoading(true);
    let personIdentifiers = pubSearchFilter?.filters?.personIdentifers?.length > 0 ? [...pubSearchFilter.filters.personIdentifers] : [];
    let articlesData = {
      personIdentifiers,
      pmids: [...requestBody.pmids],
      limit: exportArticlesRTF && exportArticlesRTF.length > 0 && exportArticlesRTF[0].maxLimit
    }
   
    fetch(`/api/db/reports/publication`, {
      credentials: "same-origin",
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Authorization': reciterConfig.backendApiKey
      },
      body: JSON.stringify(articlesData)
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

  const getReportsDatabyPubFilters = (exportType)=>{
    if(exportType === "CSV") setOpenCSV(true)
    else setOpenRTF(true)

    onGetReportsDatabyPubFilters();
  }

  const exportAuthorshipCSV = () => {
    let authorMaxLimit = exportAuthorShipLabels && exportAuthorShipLabels.length > 0  && exportAuthorShipLabels.find(obj => obj.maxLimit)
    const modifiedFilters = {...pubSearchFilter, limit:parseInt(authorMaxLimit.maxLimit)}

    setExportAuthorshipCsvLoading(true);
    fetch(`/api/db/reports/publication/authorship`, {
      credentials: "same-origin",
      method: 'POST',
      headers: {
        Accept: 'application/json',
        "Content-Type": "application/json",
        'Authorization': reciterConfig.backendApiKey
      },
      body: JSON.stringify(modifiedFilters)
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

    if (labels.person) {
      Object.keys(labels.person).forEach((labelField) => {
        let labelObj = { header: setReportFilterLabels(exportAuthorShipLabels, labels.person[labelField]) , key: labelField, displayRank : setReportFilterDisplayRank(exportAuthorShipLabels, labels.person[labelField]) };
        if(setIsVisible(exportAuthorShipLabels, labels.person[labelField])) columns.push(labelObj);
      })
    }

    if (labels.articleInfo) {
      Object.keys(labels.articleInfo).forEach((articleInfoField) => {
        let labelObj = { header: setReportFilterLabels(exportAuthorShipLabels,labels.articleInfo[articleInfoField]), key: articleInfoField, displayRank:setReportFilterDisplayRank(exportAuthorShipLabels,labels.articleInfo[articleInfoField]) };
        if(setIsVisible(exportAuthorShipLabels,labels.articleInfo[articleInfoField])) columns.push(labelObj);
      })
    }

    if (metrics.article && labels.article) {
      Object.keys(metrics.article).forEach(articleField => {
        if (metrics.article[articleField] == true) {
          let labelObj = { header: setReportFilterLabels(exportAuthorShipLabels,labels.article[articleField]), key: articleField, displayRank:setReportFilterDisplayRank(exportAuthorShipLabels,labels.article[articleField])};
          if(setIsVisible(exportAuthorShipLabels,labels.article[articleField])) columns.push(labelObj);
        }
      })
    }

    if (labels.article) {
      Object.keys(labels.article).forEach(label => {
        if (!metrics.article.hasOwnProperty(label)) {
          let labelObj = { header: setReportFilterLabels(exportAuthorShipLabels,labels.article[label]), key: label, displayRank:setReportFilterDisplayRank(exportAuthorShipLabels,labels.article[label])};
          if(setIsVisible(exportAuthorShipLabels,labels.article[label])) columns.push(labelObj);
        }
      })
    }

    if (labels.authorsInfo) {
      Object.keys(labels.authorsInfo).forEach(label => {
          let labelObj = { header: setReportFilterLabels(exportAuthorShipLabels,labels.authorsInfo[label]), key: label, displayRank:setReportFilterDisplayRank(exportAuthorShipLabels,labels.authorsInfo[label])};
          if(setIsVisible(exportAuthorShipLabels,labels.authorsInfo[label])) columns.push(labelObj);
        })
    }
    columns.sort((a: any, b: any) => a.displayRank - b.displayRank)

    try {
      let options = {}
      // creating one worksheet in workbook
      const worksheet = workbook.addWorksheet(authorshipFileName);
      // add worksheet columns
      // each columns contains header and its mapping key from data
      worksheet.columns = columns;
      // worksheet.getCell('Article title').alignment = { wrapText: true };
      
      // process the data and add rows to worksheet
      data && data.forEach(item => {
        let itemRow = {};
        Object.keys(item).forEach(obj => {
          if (obj === 'PersonPersonTypes') {
            let personTypes = item[obj].map(personType => personType.personType).join('|');
            itemRow = {...itemRow, personTypes: personTypes};
          } else {
            itemRow = {...itemRow, ...item[obj]};
          }
        })
        itemRow = {...itemRow, authors: item.authors?.replace(/[\])}[{(]/g, '')};
        itemRow = {...itemRow, authorPosition: item.authorPosition?.replace(/[\])}[{(]/g, '')};
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
      // console.error('Something Went Wrong', error.message);
    } finally {
      // removing worksheet's instance to create new one
      workbook.removeWorksheet(authorshipFileName);
    }
  }

  const exportArticleCSV = () => {
    let articleMaxLimit = exportArticleLabels && exportArticleLabels.length > 0  && exportArticleLabels.find(obj => obj.maxLimit)
    const modifiedFilters = {...pubSearchFilter, limit:parseInt(articleMaxLimit.maxLimit)}

    setExportArticleCsvLoading(true);
    fetch(`/api/db/reports/publication/article`, {
      credentials: "same-origin",
      method: 'POST',
      headers: {
        Accept: 'application/json',
        "Content-Type": "application/json",
        'Authorization': reciterConfig.backendApiKey
      },
      body: JSON.stringify(modifiedFilters)
    }).then(response => {
      return response.json();
    }).then(result => {
      generateArticleCSV(result);
      setExportArticleCsvLoading(false);
    }).catch(error => {
      setExportArticleCsvLoading(false);
      console.log(error);
    })
  }

  const generateArticleCSV = async (data) => {
    let columns = [];

    if (labels.articleInfo) {
      Object.keys(labels.articleInfo).forEach((articleInfoField) => {
        let labelObj = { header: setReportFilterLabels(exportArticleLabels, labels.articleInfo[articleInfoField]), key: articleInfoField, displayRank:setReportFilterDisplayRank(exportArticleLabels, labels.articleInfo[articleInfoField]) };
        if(setIsVisible(exportArticleLabels, labels.articleInfo[articleInfoField])) columns.push(labelObj);
      })
    }
    
    if (metrics.article && labels.article) {
      Object.keys(metrics.article).forEach(articleField => {
        if (metrics.article[articleField] == true) {
          let labelObj = { header:setReportFilterLabels(exportArticleLabels,  labels.article[articleField]), key: articleField, displayRank: setReportFilterDisplayRank(exportArticleLabels,  labels.article[articleField])};
          if(setIsVisible(exportArticleLabels,  labels.article[articleField])) columns.push(labelObj);
        }
      })
    }

    
    if (labels.authorsInfo) {
      Object.keys(labels.authorsInfo).forEach(label => {
          let labelObj = { header: setReportFilterLabels(exportArticleLabels,labels.authorsInfo[label]), key: label, displayRank:setReportFilterDisplayRank(exportArticleLabels,labels.authorsInfo[label])};
          if(setIsVisible(exportArticleLabels,labels.authorsInfo[label])) columns.push(labelObj);
        })
    }
    columns.sort((a: any, b: any) => a.displayRank - b.displayRank)
    try {
      // creating one worksheet in workbook
      const worksheet = workbook.addWorksheet(articleFileName);
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
        itemRow = {...itemRow, authors: item.authors?.replace(/[\])}[{(]/g, '')};
        itemRow = {...itemRow, authorPosition: item.authorPosition?.replace(/[\])}[{(]/g, '')};
        worksheet.addRow(itemRow);
      })

      // write the content using writeBuffer
      const buf = await workbook.csv.writeBuffer();
      let blobFromBuffer = new Blob([buf]);
      let fileName = `${articleFileName}.csv`;
      var link = document.createElement('a')  // once we have the file buffer BLOB from the post request we simply need to send a GET request to retrieve the file data
      link.href = window.URL.createObjectURL(blobFromBuffer);
      link.download = fileName;
      link.click()
      link.remove();
    } catch (error) {
      // console.error('Something Went Wrong', error.message);
    } finally {
      // removing worksheet's instance to create new one
      workbook.removeWorksheet(articleFileName);
    }
  }

  return (
    <>
      <div className="d-flex justify-content-between align-items-center pt-5">
        <p className="mb-0"><b>{count ? formatter.format(count) : 0} articles</b></p>
        <div className="search-summary-buttons">
        <DropdownButton className={`d-inline-block mx-2`} title="Sort by" id="dropdown-basic-button" onSelect={(value) => handleSelect(value)}>
          {
            formattedSortOptions.map((sortOption, index) => {
              const {labelName, keyName} = sortOption || {};
              return (
                <div key={index}>
                  <Dropdown.Item eventKey={`${keyName}_DESC`} key={`${keyName}_DESC`} className={`dropdown-item ${selected.type === keyName && selected.order === 'DESC' ? styles.selected : styles.dropdownItem}`}>
                    {selected.type === keyName && selected.order === 'DESC' && <AiOutlineCheck />} 
                    {/* {labels.article[sortOption] || labels.articleInfo[sortOption]} */}
                    {/* {setReportFilterLabels(reportLabelsForSort, labels.article[sortOption] || labels.articleInfo[sortOption])} */}
                    {labelName}

                    {<ArrowDownwardIcon />}
                  </Dropdown.Item>
                  <Dropdown.Item eventKey={`${keyName}_ASC`} key={`${keyName}_ASC`} className={`dropdown-item ${selected.type === keyName && selected.order === 'ASC' ? styles.selected : styles.dropdownItem}`}>
                    {selected.type === keyName && selected.order === 'ASC' && <AiOutlineCheck />} 
                    {/* {labels.article[sortOption] || labels.articleInfo[sortOption]} */}
                    {/* {setReportFilterLabels(reportLabelsForSort, labels.article[sortOption] || labels.articleInfo[sortOption])} */}
                    {labelName}

                    {<ArrowUpwardIcon />}
                  </Dropdown.Item>
                </div>
              )
            })
          }
        </DropdownButton>
          <Button variant="warning" className="m-2" disabled={count == 0} onClick={() =>  getReportsDatabyPubFilters("CSV")}>Export to CSV</Button>
          <Button variant="warning" className="m-2" disabled={count == 0} onClick={() =>  getReportsDatabyPubFilters("RTF")}>Export to RTF</Button>
        </div>
      </div>
      <ExportModal
        show={openCSV}
        handleClose={() => setOpenCSV(false)}
        title="CSV"
        loadingResults={reportsResultsIdsLoading}
        articleLimit = {articleLimit}
        authorLimit= {authorLimit}
        reportsResultsIds = {reportsResultsIds}
        count = {count}
        countInfo={ `${formatter.format(reportsResultsIds?.personIdentifiers?.length || 0)} known authorships and ${count ? formatter.format(count) : 0} articles`}
        buttonsList={
          [
            {title: 'Export authorship report', loading: exportAuthorshipCsvLoading, onClick: exportAuthorshipCSV},
            {title: 'Export article report', loading: exportArticleCsvLoading, onClick: exportArticleCSV}
          ]
        }
        exportAuthorshipCsvLoading = {exportAuthorshipCsvLoading}
        exportArticleCsvLoading = {exportArticleCsvLoading}
      />
      <ExportModal
        show={openRTF}
        handleClose={() => setOpenRTF(false)}
        title="RTF"
        countInfo={`${count ? formatter.format(count) : 0} articles`}
        loadingResults={reportsResultsIdsLoading}
        error={exportError}
        buttonsList={[
          { title: 'Export article report', loading: exportArticleLoading, onClick: exportArticle}
        ]}
        count = {count}
        exportArticleCsvLoading = {exportArticleLoading}
        articleLimit = {articleLimitForRTF}
      />
    </>
  )
}

export default SearchSummary;