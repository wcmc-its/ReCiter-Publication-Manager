import React, { FunctionComponent } from "react";
import { Modal, Button } from "react-bootstrap";

interface DeleteConfirmModalProps {
  show: boolean;
  onHide: () => void;
  itemName: string;
  onConfirm: () => void;
}

const DeleteConfirmModal: FunctionComponent<DeleteConfirmModalProps> = ({
  show,
  onHide,
  itemName,
  onConfirm,
}) => {
  return (
    <Modal show={show} onHide={onHide}>
      <Modal.Header closeButton>
        <Modal.Title style={{ fontSize: "16px", fontWeight: 600 }}>
          Delete {itemName}?
        </Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <p>
          Delete {itemName}? This action cannot be undone.
        </p>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={onHide}>
          Cancel
        </Button>
        <Button variant="danger" onClick={onConfirm}>
          Delete
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

export default DeleteConfirmModal;
