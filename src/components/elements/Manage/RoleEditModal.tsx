import React, { useState, useEffect, FunctionComponent } from "react";
import { Modal, Button, Form } from "react-bootstrap";

interface RolePermission {
  permissionID: number;
  permissionKey: string;
  label: string;
}

interface RoleData {
  roleID: number;
  roleLabel: string;
  permissions: RolePermission[];
}

interface PermissionItem {
  permissionID: number;
  permissionKey: string;
  label: string;
}

interface RoleEditModalProps {
  show: boolean;
  onHide: () => void;
  role: RoleData | null;
  allPermissions: PermissionItem[];
  onSave: (data: { roleLabel: string; permissionIDs: number[] }) => void;
}

const RoleEditModal: FunctionComponent<RoleEditModalProps> = ({
  show,
  onHide,
  role,
  allPermissions,
  onSave,
}) => {
  const [roleLabel, setRoleLabel] = useState<string>("");
  const [selectedPermissions, setSelectedPermissions] = useState<Set<number>>(
    new Set()
  );
  const [saving, setSaving] = useState<boolean>(false);
  const [validationError, setValidationError] = useState<string>("");

  useEffect(() => {
    if (show) {
      if (role) {
        setRoleLabel(role.roleLabel || "");
        setSelectedPermissions(
          new Set(role.permissions?.map((p) => p.permissionID) || [])
        );
      } else {
        setRoleLabel("");
        setSelectedPermissions(new Set());
      }
      setValidationError("");
      setSaving(false);
    }
  }, [show, role]);

  const handleSave = async () => {
    if (!roleLabel.trim()) {
      setValidationError("Role name is required.");
      return;
    }

    setSaving(true);
    try {
      await onSave({
        roleLabel: roleLabel.trim(),
        permissionIDs: Array.from(selectedPermissions),
      });
    } finally {
      setSaving(false);
    }
  };

  const handlePermissionToggle = (
    permissionID: number,
    checked: boolean
  ) => {
    const next = new Set(selectedPermissions);
    if (checked) {
      next.add(permissionID);
    } else {
      next.delete(permissionID);
    }
    setSelectedPermissions(next);
  };

  const sortedPermissions = [...allPermissions].sort((a, b) =>
    a.permissionKey.localeCompare(b.permissionKey)
  );

  return (
    <Modal show={show} onHide={onHide}>
      <Modal.Header closeButton>
        <Modal.Title style={{ fontSize: "16px", fontWeight: 600 }}>
          {role ? "Edit Role" : "Add Role"}
        </Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <Form.Group className="mb-3">
          <Form.Label>Role Name</Form.Label>
          <Form.Control
            type="text"
            value={roleLabel}
            onChange={(e) => {
              setRoleLabel(e.target.value);
              setValidationError("");
            }}
            isInvalid={!!validationError}
          />
          <Form.Control.Feedback type="invalid">
            {validationError}
          </Form.Control.Feedback>
        </Form.Group>
        <div
          style={{ fontSize: "16px", fontWeight: 600, marginBottom: "8px" }}
        >
          Assigned Permissions:
        </div>
        {sortedPermissions.map((p) => (
          <Form.Check
            key={p.permissionID}
            type="checkbox"
            id={`perm-${p.permissionID}`}
            label={
              <>
                <code style={{ fontSize: "13px" }}>{p.permissionKey}</code>{" "}
                - {p.label}
              </>
            }
            checked={selectedPermissions.has(p.permissionID)}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              handlePermissionToggle(p.permissionID, e.target.checked)
            }
          />
        ))}
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={onHide}>
          Cancel
        </Button>
        <Button variant="primary" onClick={handleSave} disabled={saving}>
          {saving ? "Saving..." : "Save Role"}
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

export default RoleEditModal;
