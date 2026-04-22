import React, { FunctionComponent } from "react";
import { Form, Button } from "react-bootstrap";
import ClearIcon from "@mui/icons-material/Clear";

interface Resource {
  resourceType: string;
  resourceKey: string;
  icon: string | null;
  label: string;
  route: string | null;
  displayOrder: number;
}

interface ResourceRowProps {
  resource: Resource;
  index: number;
  onChange: (index: number, field: string, value: any) => void;
  onRemove: (index: number) => void;
}

const ResourceRow: FunctionComponent<ResourceRowProps> = ({
  resource,
  index,
  onChange,
  onRemove,
}) => {
  return (
    <div
      style={{
        display: "flex",
        gap: "8px",
        alignItems: "center",
        marginBottom: "8px",
      }}
    >
      <Form.Select
        size="sm"
        value={resource.resourceType}
        onChange={(e) => onChange(index, "resourceType", e.target.value)}
        style={{ width: "100px" }}
      >
        <option value="nav">nav</option>
        <option value="tab">tab</option>
        <option value="feature">feature</option>
      </Form.Select>
      <Form.Control
        size="sm"
        type="text"
        placeholder="Key"
        value={resource.resourceKey}
        onChange={(e) => onChange(index, "resourceKey", e.target.value)}
        style={{ width: "120px" }}
      />
      <Form.Control
        size="sm"
        type="text"
        placeholder="Icon"
        value={resource.icon || ""}
        onChange={(e) => onChange(index, "icon", e.target.value)}
        style={{ width: "100px" }}
      />
      <Form.Control
        size="sm"
        type="text"
        placeholder="Label"
        value={resource.label}
        onChange={(e) => onChange(index, "label", e.target.value)}
        style={{ flex: 1 }}
      />
      <Form.Control
        size="sm"
        type="text"
        placeholder="Route"
        value={resource.route || ""}
        onChange={(e) => onChange(index, "route", e.target.value)}
        style={{ width: "120px" }}
      />
      <Form.Control
        size="sm"
        type="number"
        value={resource.displayOrder}
        onChange={(e) =>
          onChange(index, "displayOrder", parseInt(e.target.value) || 0)
        }
        style={{ width: "60px" }}
      />
      <Button
        variant="link"
        className="text-danger"
        onClick={() => onRemove(index)}
        aria-label="Remove resource"
        style={{ padding: "2px" }}
      >
        <ClearIcon fontSize="small" />
      </Button>
    </div>
  );
};

export default ResourceRow;
