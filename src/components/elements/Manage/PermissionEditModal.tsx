import React, { useState, useEffect, FunctionComponent } from "react";
import { Modal, Button, Form } from "react-bootstrap";
import Autocomplete from "@mui/material/Autocomplete";
import TextField from "@mui/material/TextField";
import { reciterConfig } from "../../../../config/local";
import ResourceRow from "./ResourceRow";
import styles from "./PermissionEditModal.module.css";

interface PermissionResource {
  id?: number;
  resourceType: string;
  resourceKey: string;
  displayOrder: number;
  icon: string | null;
  label: string;
  route: string | null;
}

interface PermissionData {
  permissionID: number;
  permissionKey: string;
  label: string;
  description: string | null;
  category: string;
  resources: PermissionResource[];
}

interface PermissionEditModalProps {
  show: boolean;
  onHide: () => void;
  permission: PermissionData | null;
  onSave: (data: {
    permissionKey?: string;
    label: string;
    description: string | null;
    category: string;
    resources: any[];
  }) => void;
}

interface ValidationErrors {
  permissionKey?: string;
  label?: string;
  category?: string;
}

const PermissionEditModal: FunctionComponent<PermissionEditModalProps> = ({
  show,
  onHide,
  permission,
  onSave,
}) => {
  const [permissionKey, setPermissionKey] = useState<string>("");
  const [label, setLabel] = useState<string>("");
  const [description, setDescription] = useState<string>("");
  const [category, setCategory] = useState<string>("");
  const [resources, setResources] = useState<PermissionResource[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [saving, setSaving] = useState<boolean>(false);
  const [errors, setErrors] = useState<ValidationErrors>({});

  useEffect(() => {
    if (show) {
      if (permission) {
        setPermissionKey(permission.permissionKey || "");
        setLabel(permission.label || "");
        setDescription(permission.description || "");
        setCategory(permission.category || "");
        setResources(
          (permission.resources || []).map((r) => ({
            resourceType: r.resourceType,
            resourceKey: r.resourceKey,
            displayOrder: r.displayOrder,
            icon: r.icon,
            label: r.label,
            route: r.route,
          }))
        );
      } else {
        setPermissionKey("");
        setLabel("");
        setDescription("");
        setCategory("");
        setResources([]);
      }
      setErrors({});
      setSaving(false);
    }
  }, [show, permission]);

  useEffect(() => {
    if (!show) return;
    const fetchCategories = async () => {
      try {
        const response = await fetch("/api/db/admin/permissions/categories", {
          credentials: "same-origin",
          method: "GET",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
            Authorization: reciterConfig.backendApiKey,
          },
        });
        const data = await response.json();
        if (Array.isArray(data)) {
          setCategories(data);
        }
      } catch (error) {
        console.log(error);
      }
    };
    fetchCategories();
  }, [show]);

  const handleResourceChange = (
    index: number,
    field: string,
    value: any
  ) => {
    const next = [...resources];
    next[index] = { ...next[index], [field]: value };
    setResources(next);
  };

  const handleRemoveResource = (index: number) => {
    setResources(resources.filter((_, i) => i !== index));
  };

  const handleAddResource = () => {
    setResources([
      ...resources,
      {
        resourceType: "nav",
        resourceKey: "",
        icon: "",
        label: "",
        route: "",
        displayOrder: 0,
      },
    ]);
  };

  const handleSave = async () => {
    const nextErrors: ValidationErrors = {};
    if (!permission && !permissionKey.trim()) {
      nextErrors.permissionKey = "Permission key is required.";
    }
    if (!label.trim()) {
      nextErrors.label = "Label is required.";
    }
    if (!category.trim()) {
      nextErrors.category = "Category is required.";
    }
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    setSaving(true);
    try {
      const payload: {
        permissionKey?: string;
        label: string;
        description: string | null;
        category: string;
        resources: any[];
      } = {
        label: label.trim(),
        description: description.trim() || null,
        category: category.trim(),
        resources,
      };
      if (!permission) {
        payload.permissionKey = permissionKey.trim();
      }
      await onSave(payload);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal show={show} onHide={onHide} size="lg">
      <Modal.Header closeButton>
        <Modal.Title style={{ fontSize: "16px", fontWeight: 600 }}>
          {permission ? "Edit Permission" : "Add Permission"}
        </Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <Form.Group className="mb-3">
          <Form.Label>Permission Key</Form.Label>
          {permission ? (
            <Form.Control
              type="text"
              plaintext
              readOnly
              value={permissionKey}
              style={{
                backgroundColor: "#e9ecef",
                padding: "6px 12px",
              }}
            />
          ) : (
            <>
              <Form.Control
                type="text"
                value={permissionKey}
                onChange={(e) => {
                  setPermissionKey(e.target.value);
                  setErrors({ ...errors, permissionKey: undefined });
                }}
                isInvalid={!!errors.permissionKey}
              />
              <Form.Control.Feedback type="invalid">
                {errors.permissionKey}
              </Form.Control.Feedback>
            </>
          )}
        </Form.Group>
        <Form.Group className="mb-3">
          <Form.Label>Label</Form.Label>
          <Form.Control
            type="text"
            value={label}
            onChange={(e) => {
              setLabel(e.target.value);
              setErrors({ ...errors, label: undefined });
            }}
            isInvalid={!!errors.label}
          />
          <Form.Control.Feedback type="invalid">
            {errors.label}
          </Form.Control.Feedback>
        </Form.Group>
        <Form.Group className="mb-3">
          <Form.Label>Description</Form.Label>
          <Form.Control
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </Form.Group>
        <Form.Group className="mb-3">
          <Form.Label>Category</Form.Label>
          <Autocomplete
            freeSolo
            id="permission-category"
            options={categories}
            value={category}
            onChange={(event, value) => {
              setCategory((value as string) || "");
              setErrors({ ...errors, category: undefined });
            }}
            onInputChange={(event, value) => {
              setCategory(value);
              setErrors({ ...errors, category: undefined });
            }}
            renderInput={(params) => (
              <TextField
                variant="outlined"
                {...params}
                size="small"
                error={!!errors.category}
                helperText={errors.category || ""}
              />
            )}
          />
        </Form.Group>
        <hr style={{ borderColor: "#ddd" }} />
        <div
          style={{
            fontSize: "16px",
            fontWeight: 600,
            marginBottom: "8px",
          }}
        >
          UI Resources
        </div>
        {resources.map((r, i) => (
          <ResourceRow
            key={i}
            resource={r}
            index={i}
            onChange={handleResourceChange}
            onRemove={handleRemoveResource}
          />
        ))}
        <Button
          variant="link"
          onClick={handleAddResource}
          style={{
            color: "#0d6efd",
            padding: 0,
            textDecoration: "none",
            fontSize: "14px",
          }}
        >
          + Add Resource
        </Button>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={onHide}>
          Cancel
        </Button>
        <Button variant="primary" onClick={handleSave} disabled={saving}>
          {saving ? "Saving..." : "Save Permission"}
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

export default PermissionEditModal;
