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
  buttonsList: Array<ExportButtonProps>
}

const ExportModal = ({ show, handleClose, title, countInfo, error, loadingResults, buttonsList }: ExportModalProps) => {
  if (loadingResults) {
    return (
      <div className="d-flex justify-content-center align-items-center">
        <Loader />
      </div>
    )
  }

  return (
    <div>
      <Modal show={show} onHide={handleClose}>
        <Modal.Header closeButton>
          <Modal.Title>Export to {title}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p>According to the criteria you have set, there are {countInfo}.</p>
        {
          buttonsList.map((btn, index) => {
            return (
              <ExportButton key={index} {...btn} />
            )
          })
        }
        {error && <Alert variant="danger">Error occured exporting, please try again later.</Alert>}
        </Modal.Body>
      </Modal>
    </div>
  )
}

export default ExportModal;