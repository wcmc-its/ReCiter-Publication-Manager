import { Dropdown, DropdownButton } from "react-bootstrap";
import Popover from "@mui/material/Popover";
import { useEffect, useState } from "react";
import ExportModal from "./ExportModal";
import { sortOptions } from "../../../../config/report";
import { AiOutlineCheck } from "react-icons/ai";
import styles from "./SearchSummary.module.css";
import { reciterConfig } from "../../../../config/local";
import { metrics, labels } from "../../../../config/report";
import { useSelector } from "react-redux";
import { RootStateOrAny } from "../../../types/redux";
import { PublicationSearchFilter, ReporstResultId } from "../../../../types/publication.report.search";
import Excel from 'exceljs';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import { ArrowLeft, ArrowRight } from "@mui/icons-material";
import { setReportFilterDisplayRank, setReportFilterLabels,setIsVisible, setReportFilterKeyNames } from "../../../utils/constants";
import { toast } from "react-toastify";
import { reportError } from "../../../utils/reportError";
import { stripHtml } from "../../../utils/htmlText";

// Title/journal fields can carry PubMed inline markup (<i>, <sub>, …); strip to
// plain text for spreadsheet cells, which can't render HTML.
const HTML_BEARING_FIELDS = ['articleTitle', 'articleTitleRTF', 'journalTitleVerbose'];
const stripHtmlFields = (row: any): any => {
  HTML_BEARING_FIELDS.forEach((k) => { if (row && row[k]) row[k] = stripHtml(row[k]); });
  return row;
};


const SearchSummary = ({
  reportLabelsForSort,
  articlesCount,
  onClick,
  selected,
  onGetReportsDatabyPubFilters,
  exportAuthorShipLabels,
  exportArticleLabels,
  exportArticlesRTF,
  count,
  total,
  page,
  onPaginationUpdate,
  onCountUpdate,
  exportType,
  onExportClose,
}: {exportType?: "CSV" | "RTF" | null, onExportClose?: () => void, exportArticlesRTF:any, exportArticleLabels :any, exportAuthorShipLabels:any, reportLabelsForSort? : any,articlesCount: number, onClick: (sort: string, order: string) => void, selected: any, onGetReportsDatabyPubFilters :()=>void, count?: number, total?: number, page?: number, onPaginationUpdate?: (page: number) => void, onCountUpdate?: (count: string) => void}) => {
  // The Export Excel / Export Word buttons live in the page title row (Report.tsx); it opens the
  // matching modal here through exportType.
  const openCSV = exportType === "CSV";
  const openRTF = exportType === "RTF";
  const [sortAnchor, setSortAnchor] = useState<HTMLElement | null>(null);
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
  const articleLimit = exportArticleLabels && exportArticleLabels.length > 0  && Array.isArray(exportArticleLabels) && exportArticleLabels.find(obj => obj.maxLimit)
  const articleLimitForRTF = exportArticlesRTF && exportArticlesRTF.length > 0  && Array.isArray(exportArticlesRTF)  && exportArticlesRTF.find(obj => obj.maxLimit)
  const authorLimit = exportAuthorShipLabels && exportAuthorShipLabels.length > 0 && Array.isArray(exportAuthorShipLabels)  && exportAuthorShipLabels.find(obj => obj.maxLimit)

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
    // Publication date sort: admin settings may carry either spelling, or (dev) neither.
    const hasPubDateSetting = Array.isArray(reportLabelsForSort) && reportLabelsForSort.some((l: any) =>
      l.labelUserKey === 'publicationDateStandardized' || l.labelUserKey === 'publicationDateStandarized');
    if (Array.isArray(reportLabelsForSort) && reportLabelsForSort.length && !hasPubDateSetting) {
      sortWithDisplayRank.push({ labelName: 'Publication date', displayRank: 1.5, isVisible: true, keyName: 'publicationDateStandardized' });
    }
    serFormatedSOrtOptions(sortWithDisplayRank.sort((a: any, b: any) => a.displayRank - b.displayRank))
  }, [reportLabelsForSort])

  const isDateKey = (keyName?: string, labelName?: string) => /date/i.test(keyName || '') || /date/i.test(labelName || '');
  const activeSort = formattedSortOptions.find((o: any) => o.keyName === selected?.type);
  const sortLabel = activeSort
    ? `${activeSort.labelName} ${isDateKey(activeSort.keyName, activeSort.labelName) ? (selected.order === 'ASC' ? '· oldest' : '· newest') : (selected.order === 'ASC' ? '↑' : '↓')}`
    : 'Date added · newest';
  const firstRow = total > 0 && count && page ? (page - 1) * count + 1 : 0;
  const lastRow = total > 0 && count && page ? Math.min(page * count, total) : 0;
  const pageCount = total > 0 && count ? Math.ceil(total / count) : 1;

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
      document.body.appendChild(link); // Chrome honors the download filename only for an anchor in the DOM; detached anchors save as a blob UUID.
      link.click()
      link.remove();
      setExportArticleLoading(false);
    })
    .catch(error => {
      console.error("[ERR-8001]", error);
      reportError("ERR-8001", "Unable to export article report", error);
      setExportError(true);
      setExportArticleLoading(false);
      toast.error("Unable to export article report. Please try again. (ERR-8001)");
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
      document.body.appendChild(link); // Chrome honors the download filename only for an anchor in the DOM; detached anchors save as a blob UUID.
      link.click()
      link.remove();
      setExportArticlePplLoading(false);
    })
    .catch(error => {
      console.error("[ERR-8002]", error);
      reportError("ERR-8002", "Unable to export article report", error);
      setExportError(true);
      setExportArticlePplLoading(false);
      toast.error("Unable to export article report. Please try again. (ERR-8002)");
    })
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
      console.error("[ERR-8003]", error);
      reportError("ERR-8003", "Unable to export authorship report", error);
      toast.error("Unable to export authorship report. Please try again. (ERR-8003)");
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
        worksheet.addRow(stripHtmlFields(itemRow));
      })

      // write the content using writeBuffer
      const buf = await workbook.csv.writeBuffer();
      let blobFromBuffer = new Blob([buf]);
      let fileName = `${authorshipFileName}.csv`;
      var link = document.createElement('a')  // once we have the file buffer BLOB from the post request we simply need to send a GET request to retrieve the file data
      link.href = window.URL.createObjectURL(blobFromBuffer);
      link.download = fileName;
      document.body.appendChild(link); // Chrome honors the download filename only for an anchor in the DOM; detached anchors save as a blob UUID.
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
      console.error("[ERR-8004]", error);
      reportError("ERR-8004", "Unable to export article CSV", error);
      toast.error("Unable to export article CSV. Please try again. (ERR-8004)");
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
        worksheet.addRow(stripHtmlFields(itemRow));
      })

      // write the content using writeBuffer
      const buf = await workbook.csv.writeBuffer();
      let blobFromBuffer = new Blob([buf]);
      let fileName = `${articleFileName}.csv`;
      var link = document.createElement('a')  // once we have the file buffer BLOB from the post request we simply need to send a GET request to retrieve the file data
      link.href = window.URL.createObjectURL(blobFromBuffer);
      link.download = fileName;
      document.body.appendChild(link); // Chrome honors the download filename only for an anchor in the DOM; detached anchors save as a blob UUID.
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
      <div className={styles.controlsRow} data-testid="report-results-header">
        <div className={styles.countBlock}>
          <span className={styles.articlesCount}>{articlesCount && articlesCount > 0 ? formatter.format(articlesCount) : 0}</span>
          <span className={styles.countNoun}>{articlesCount === 1 ? 'publication' : 'publications'}</span>
        </div>
        <div className={styles.controls}>
          {total > 0 && count && page && (
            <div className={styles.inlinePagination}>
              <span className={styles.pageInfo}>{formatter.format(firstRow)}–{formatter.format(lastRow)} of {formatter.format(total)}</span>
              <button type="button" className={styles.pageBtn} aria-label="Previous page" disabled={page <= 1} onClick={() => page > 1 && onPaginationUpdate(page - 1)}><ArrowLeft fontSize="small" /></button>
              <button type="button" className={styles.pageBtn} aria-label="Next page" disabled={page >= pageCount} onClick={() => page < pageCount && onPaginationUpdate(page + 1)}><ArrowRight fontSize="small" /></button>
              <DropdownButton className={styles.countDropdown} id="count-dropdown" title={`${count} per page`} onSelect={(eventKey) => onCountUpdate(eventKey)}>
                {[10, 20, 50, 100, 200].map((n) => (
                  <Dropdown.Item key={n} eventKey={n} className={`${styles.showItem} ${count == n ? styles.showItemActive : ''}`}>
                    <span>{n} per page</span>
                    {count == n ? <span className={styles.showCheck}>✓</span> : n === 10 ? <span className={styles.showHint}>faster</span> : n === 200 ? <span className={styles.showHint}>slower</span> : null}
                  </Dropdown.Item>
                ))}
              </DropdownButton>
            </div>
          )}
          <button type="button" className={styles.sortButton} aria-haspopup="menu" aria-expanded={!!sortAnchor} onClick={(e) => setSortAnchor(e.currentTarget)}>
            <span className={styles.sortByLabel}>Sort by</span>{sortLabel}
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"></path></svg>
          </button>
          <Popover open={!!sortAnchor} anchorEl={sortAnchor} onClose={() => setSortAnchor(null)}
            anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }} transformOrigin={{ vertical: 'top', horizontal: 'right' }}
            PaperProps={{ className: styles.sortMenu }}>
            <div role="menu" aria-label="Sort by">
              {formattedSortOptions.map((sortOption: any, index) => {
                const { labelName, keyName } = sortOption || {};
                const isActive = selected.type === keyName;
                // Date columns read oddly as "High → Low"; show newest/oldest instead.
                const isDateSort = isDateKey(keyName, labelName);
                const pick = (order: string) => { onClick(keyName, order); setSortAnchor(null); };
                return (
                  <div key={index} className={`${styles.sortItem} ${isActive ? styles.sortItemActive : ''}`}>
                    <span className={styles.sortLabel}>{labelName}</span>
                    <div className={styles.sortToggle}>
                      <button
                        type="button" role="menuitemradio" aria-checked={isActive && selected.order === 'DESC'}
                        className={`${styles.sortToggleBtn} ${isActive && selected.order === 'DESC' ? styles.sortToggleBtnActive : ''}`}
                        onClick={() => pick('DESC')}
                      >{isDateSort ? 'Newest' : 'High'}</button>
                      <button
                        type="button" role="menuitemradio" aria-checked={isActive && selected.order === 'ASC'}
                        className={`${styles.sortToggleBtn} ${isActive && selected.order === 'ASC' ? styles.sortToggleBtnActive : ''}`}
                        onClick={() => pick('ASC')}
                      >{isDateSort ? 'Oldest' : 'Low'}</button>
                    </div>
                  </div>
                )
              })}
            </div>
          </Popover>
        </div>
      </div>
      <ExportModal
        show={openCSV}
        handleClose={() => onExportClose && onExportClose()}
        title="CSV"
        loadingResults={reportsResultsIdsLoading}
        articleLimit = {articleLimit}
        authorLimit= {authorLimit}
        reportsResultsIds = {reportsResultsIds}
        articlesCount = {articlesCount}
        countInfo={ `${formatter.format(reportsResultsIds?.authorshipsCount || 0)} known authorships and ${articlesCount ? formatter.format(articlesCount) : 0} articles`}
        buttonsList={
          [
            {title: 'Authorship report', loading: exportAuthorshipCsvLoading, onClick: exportAuthorshipCSV},
            {title: 'Article report', loading: exportArticleCsvLoading, onClick: exportArticleCSV}
          ]
        }
        exportAuthorshipCsvLoading = {exportAuthorshipCsvLoading}
        exportArticleCsvLoading = {exportArticleCsvLoading}
      />
      <ExportModal
        show={openRTF}
        handleClose={() => onExportClose && onExportClose()}
        title="RTF"
        countInfo={`${articlesCount ? formatter.format(articlesCount) : 0} articles`}
        loadingResults={reportsResultsIdsLoading}
        error={exportError}
        buttonsList={[
          { title: 'Export article report', loading: exportArticleLoading, onClick: exportArticle}
        ]}
        articlesCount = {articlesCount}
        exportArticleCsvLoading = {exportArticleLoading}
        articleLimit = {articleLimitForRTF}
      />
    </>
  )
}

export default SearchSummary;