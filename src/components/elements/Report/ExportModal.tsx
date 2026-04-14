import { Modal, Button, Alert } from "react-bootstrap";
import { ExportButton } from "./ExportButton";
import Loader from "../Common/Loader";
import { ExportButtonProps } from "../../../../types/Export";

interface ExportModalProps {
  title: string,
  show: boolean,
  handleClose: () => void,
  countInfo: string,
  loadingResults?: boolean,
  error?: boolean,
  buttonsList: Array<ExportButtonProps>,
  exportArticleCsvLoading?: any,
  exportAuthorshipCsvLoading?:any
  articleLimit?:any,
  authorLimit?:any,
  reportsResultsIds?:any,
  articlesCount?: any
}

const ExportModal = ({ articlesCount, reportsResultsIds,articleLimit,authorLimit, exportArticleCsvLoading,exportAuthorshipCsvLoading, show, handleClose, title, countInfo, error, loadingResults, buttonsList }: ExportModalProps) => {
  const formatter = new Intl.NumberFormat('en-US')
  const isDownloading = (exportAuthorshipCsvLoading && reportsResultsIds?.authorshipsCount  > authorLimit?.maxLimit )|| (exportArticleCsvLoading && articlesCount > articleLimit?.maxLimit )
  return (
    <div>
      <Modal show={show} onHide={handleClose}>
        <Modal.Header closeButton>
          <Modal.Title>Export to {title}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {
            loadingResults ? 
            <div className="d-flex justify-content-center align-items-center">
              <Loader />
              </div> : <>
                <p>According to the criteria you have set, there are {countInfo}.</p>
                {
                  isDownloading &&
                    <Alert variant="light"><b>Downloading the first {exportArticleCsvLoading ? formatter.format(articleLimit?.maxLimit) : formatter.format(authorLimit?.maxLimit)} records.</b></Alert>
                }
                
                {
                  buttonsList.map((btn, index) => {
                    return (
                      <ExportButton key={index} {...btn} />
                    )
                  })
                }
                {error && <Alert variant="danger">Error occured exporting, please try again later.</Alert>}
              </>
          }
        </Modal.Body>
      </Modal>
    </div>
  )
}

export default ExportModal;