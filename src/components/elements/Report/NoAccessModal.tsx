import { Modal, Button, Alert } from "react-bootstrap";
import { ExportButton } from "./ExportButton";
import Loader from "../Common/Loader";
import { ExportButtonProps } from "../../../../types/Export";

interface ExportModalProps {
  title: string,
  show: boolean,
  handleClose: () => void,
  error?: boolean,
}

const NoAccessModal = ({ show, handleClose, title, error }: ExportModalProps) => {

  return (
    <div>
      <Modal show={show}>
        {/* <Modal.Header closeButton>
          <Modal.Title> {title}</Modal.Title>
        </Modal.Header> */}
        <Modal.Body >
            <p>You do not have sufficient privileges to visit other profiles..</p>
            <div className="textAlignCenter">
            <ExportButton title="Ok Continue" onClick={()=> handleClose()}/>
            </div>
        </Modal.Body>
      </Modal>
    </div>
  )
}

export default NoAccessModal;