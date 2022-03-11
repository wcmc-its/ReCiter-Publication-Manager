import { Modal, Button } from "react-bootstrap";

interface ExportModalProps {
  title: string,
  show: boolean,
  handleClose: () => void,
  countInfo: string,
  exportArticle: () => void,
  exportAuthorship?: () => void
}

const ExportModal = ({ show, handleClose, title, countInfo, exportArticle, exportAuthorship }: ExportModalProps) => {
  return (
    <div>
      <Modal show={show} onHide={handleClose}>
        <Modal.Header closeButton>
          <Modal.Title>Export to {title}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p>According to the criteria you have set, there are {countInfo}</p>
        {exportAuthorship && <Button variant="warning" className="m-2">Export authorship report</Button>}
        <Button variant="warning" className="m-2">Export Article Report</Button>
        </Modal.Body>
      </Modal>
    </div>
  )
}

export default ExportModal;