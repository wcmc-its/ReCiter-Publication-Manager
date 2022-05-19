import { Modal, Button, Alert } from "react-bootstrap";

interface ExportModalProps {
  title: string,
  show: boolean,
  handleClose: () => void,
  countInfo: string,
  exportArticle: () => void,
  exportAuthorship?: () => void,
  exportArticlePeople?: () => void, 
  error?: boolean
}

const ExportModal = ({ show, handleClose, title, countInfo, exportArticle, exportAuthorship, exportArticlePeople, error }: ExportModalProps) => {
  return (
    <div>
      <Modal show={show} onHide={handleClose}>
        <Modal.Header closeButton>
          <Modal.Title>Export to {title}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p>According to the criteria you have set, there are {countInfo}</p>
        {exportAuthorship && <Button variant="warning" className="m-2">Export authorship report</Button>}
        <Button variant="warning" className="m-2" onClick={exportArticle}>Export Article Report</Button>
        {exportArticlePeople && <Button variant="warning" className="m-2" onClick={exportArticlePeople}>Export articles as RTF</Button>}
        {error && <Alert variant="danger">Error occured exporting, please try again later.</Alert>}
        </Modal.Body>
      </Modal>
    </div>
  )
}

export default ExportModal;