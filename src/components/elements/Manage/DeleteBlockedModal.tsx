import React, { FunctionComponent } from "react";
import { Modal, Button } from "react-bootstrap";

interface DeleteBlockedModalProps {
  show: boolean;
  onHide: () => void;
  itemName: string;
  itemType: "role" | "permission";
  dependencies: {
    userCount?: number;
    users?: { name: string }[];
    roles?: { roleLabel: string; userCount: number }[];
  } | null;
}

const DeleteBlockedModal: FunctionComponent<DeleteBlockedModalProps> = ({
  show,
  onHide,
  itemName,
  itemType,
  dependencies,
}) => {
  return (
    <Modal show={show} onHide={onHide}>
      <Modal.Header closeButton>
        <Modal.Title style={{ fontSize: "16px", fontWeight: 600 }}>
          Cannot Delete {itemName}
        </Modal.Title>
      </Modal.Header>
      <Modal.Body>
        {itemType === "role" && (
          <>
            <p>
              {itemName} cannot be deleted because{" "}
              {dependencies?.userCount || 0} user
              {dependencies?.userCount !== 1 ? "s are" : " is"} assigned.
            </p>
            <ul>
              {dependencies?.users?.map((u, i) => (
                <li key={i}>{u.name}</li>
              ))}
            </ul>
            <p style={{ fontStyle: "italic", color: "#666363" }}>
              Remove these assignments first.
            </p>
          </>
        )}
        {itemType === "permission" && (
          <>
            <p>
              {itemName} is assigned to {dependencies?.roles?.length || 0}{" "}
              role{dependencies?.roles?.length !== 1 ? "s" : ""}:
            </p>
            <ul>
              {dependencies?.roles?.map((r, i) => (
                <li key={i}>
                  {r.roleLabel} ({r.userCount} user
                  {r.userCount !== 1 ? "s" : ""})
                </li>
              ))}
            </ul>
            <p style={{ fontStyle: "italic", color: "#666363" }}>
              Remove from all roles first.
            </p>
          </>
        )}
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={onHide}>
          Close
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

export default DeleteBlockedModal;
