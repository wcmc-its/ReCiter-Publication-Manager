import React, { useState, useEffect, FunctionComponent } from "react";
import { Button, Table } from "react-bootstrap";
import Loader from "../Common/Loader";
import { reciterConfig } from "../../../../config/local";
import { toast } from "react-toastify";
import PermissionEditModal from "./PermissionEditModal";
import DeleteBlockedModal from "./DeleteBlockedModal";
import DeleteConfirmModal from "./DeleteConfirmModal";
import styles from "./PermissionsTab.module.css";

interface PermissionResource {
  id?: number;
  resourceType: string;
  resourceKey: string;
  displayOrder: number;
  icon: string | null;
  label: string;
  route: string | null;
}

interface Permission {
  permissionID: number;
  permissionKey: string;
  label: string;
  description: string | null;
  category: string;
  resourceCount: number;
  resources: PermissionResource[];
}

interface DeleteBlockedInfo {
  name: string;
  roles: { roleLabel: string; userCount: number }[];
}

const PermissionsTab: FunctionComponent = () => {
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [showEditModal, setShowEditModal] = useState<boolean>(false);
  const [editingPermission, setEditingPermission] = useState<Permission | null>(null);
  const [showDeleteBlocked, setShowDeleteBlocked] = useState<boolean>(false);
  const [deleteBlockedInfo, setDeleteBlockedInfo] = useState<DeleteBlockedInfo | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<boolean>(false);
  const [deletingPermission, setDeletingPermission] = useState<Permission | null>(null);

  const fetchHeaders = {
    Accept: "application/json",
    "Content-Type": "application/json",
    Authorization: reciterConfig.backendApiKey,
  };

  const fetchPermissions = async () => {
    try {
      const response = await fetch("/api/db/admin/permissions", {
        credentials: "same-origin",
        method: "GET",
        headers: fetchHeaders,
      });
      const data = await response.json();
      setPermissions(data);
    } catch (error) {
      console.log(error);
      toast.error("Failed to load permissions. Please try again.", {
        position: "top-right",
        autoClose: 2000,
        theme: "colored",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPermissions();
  }, []);

  const handleDeleteClick = async (permission: Permission) => {
    try {
      const response = await fetch(
        `/api/db/admin/permissions/${permission.permissionID}?check=true`,
        {
          credentials: "same-origin",
          method: "DELETE",
          headers: fetchHeaders,
        }
      );

      if (response.status === 409) {
        const data = await response.json();
        setDeleteBlockedInfo({
          name: permission.label,
          roles: data.roles,
        });
        setShowDeleteBlocked(true);
      } else if (response.status === 200) {
        const data = await response.json();
        if (data.canDelete) {
          setDeletingPermission(permission);
          setShowDeleteConfirm(true);
        }
      } else {
        toast.error("Failed to check permission dependencies. Please try again.", {
          position: "top-right",
          autoClose: 2000,
          theme: "colored",
        });
      }
    } catch (error) {
      console.log(error);
      toast.error("Failed to check permission dependencies. Please try again.", {
        position: "top-right",
        autoClose: 2000,
        theme: "colored",
      });
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deletingPermission) return;

    try {
      const response = await fetch(
        `/api/db/admin/permissions/${deletingPermission.permissionID}`,
        {
          credentials: "same-origin",
          method: "DELETE",
          headers: fetchHeaders,
        }
      );

      if (response.status === 200) {
        toast.success(`${deletingPermission.label} deleted successfully`, {
          position: "top-right",
          autoClose: 2000,
          theme: "colored",
        });
        fetchPermissions();
      } else {
        toast.error("Failed to delete permission. Please try again.", {
          position: "top-right",
          autoClose: 2000,
          theme: "colored",
        });
      }
    } catch (error) {
      console.log(error);
      toast.error("Failed to delete permission. Please try again.", {
        position: "top-right",
        autoClose: 2000,
        theme: "colored",
      });
    } finally {
      setShowDeleteConfirm(false);
      setDeletingPermission(null);
    }
  };

  const handleSavePermission = async (permissionData: {
    permissionKey?: string;
    label: string;
    description: string | null;
    category: string;
    resources: any[];
  }) => {
    try {
      let response: Response;
      const isEdit = editingPermission !== null;

      if (isEdit) {
        response = await fetch(
          `/api/db/admin/permissions/${editingPermission.permissionID}`,
          {
            credentials: "same-origin",
            method: "PUT",
            headers: fetchHeaders,
            body: JSON.stringify({
              label: permissionData.label,
              description: permissionData.description,
              category: permissionData.category,
              resources: permissionData.resources,
            }),
          }
        );
      } else {
        response = await fetch("/api/db/admin/permissions/create", {
          credentials: "same-origin",
          method: "POST",
          headers: fetchHeaders,
          body: JSON.stringify({
            permissionKey: permissionData.permissionKey,
            label: permissionData.label,
            description: permissionData.description,
            category: permissionData.category,
            resources: permissionData.resources,
          }),
        });
      }

      if (response.ok) {
        const actionLabel = isEdit ? "updated" : "created";
        toast.success(`${permissionData.label} ${actionLabel} successfully`, {
          position: "top-right",
          autoClose: 2000,
          theme: "colored",
        });
        setShowEditModal(false);
        setEditingPermission(null);
        fetchPermissions();
      } else if (response.status === 409) {
        toast.error("A permission with this key already exists.", {
          position: "top-right",
          autoClose: 2000,
          theme: "colored",
        });
      } else {
        toast.error("Failed to save permission. Please try again.", {
          position: "top-right",
          autoClose: 2000,
          theme: "colored",
        });
      }
    } catch (error) {
      console.log(error);
      toast.error("Failed to save permission. Please try again.", {
        position: "top-right",
        autoClose: 2000,
        theme: "colored",
      });
    }
  };

  const renderRows = () => {
    let lastCategory = "";
    const rows: JSX.Element[] = [];
    permissions.forEach((perm) => {
      if (perm.category !== lastCategory) {
        lastCategory = perm.category;
        rows.push(
          <tr key={`cat-${perm.category}`} className={styles.categoryHeader}>
            <td colSpan={5}>{perm.category}</td>
          </tr>
        );
      }
      rows.push(
        <tr key={perm.permissionID}>
          <td>
            <code style={{ fontSize: "13px" }}>{perm.permissionKey}</code>
          </td>
          <td>{perm.label}</td>
          <td>{perm.category}</td>
          <td>{perm.resourceCount}</td>
          <td>
            <Button
              variant="outline-dark"
              size="sm"
              onClick={() => {
                setEditingPermission(perm);
                setShowEditModal(true);
              }}
              style={{ marginRight: 8 }}
            >
              Edit
            </Button>
            <Button
              variant="outline-danger"
              size="sm"
              onClick={() => handleDeleteClick(perm)}
              aria-label={`Delete ${perm.label}`}
            >
              Delete
            </Button>
          </td>
        </tr>
      );
    });
    return rows;
  };

  return (
    <>
      <div className={styles.toolbar}>
        <Button
          variant="primary"
          onClick={() => {
            setEditingPermission(null);
            setShowEditModal(true);
          }}
        >
          Add Permission
        </Button>
      </div>
      {loading ? (
        <div className="d-flex justify-content-center align-items-center">
          <Loader />
        </div>
      ) : (
        <Table striped hover>
          <thead>
            <tr>
              <th scope="col">Key</th>
              <th scope="col">Label</th>
              <th scope="col">Category</th>
              <th scope="col">Resources</th>
              <th scope="col">Actions</th>
            </tr>
          </thead>
          <tbody>
            {permissions.length === 0 ? (
              <tr>
                <td colSpan={5}>
                  <em>No permissions defined.</em>
                </td>
              </tr>
            ) : (
              renderRows()
            )}
          </tbody>
        </Table>
      )}
      <PermissionEditModal
        show={showEditModal}
        onHide={() => {
          setShowEditModal(false);
          setEditingPermission(null);
        }}
        permission={editingPermission}
        onSave={handleSavePermission}
      />
      <DeleteBlockedModal
        show={showDeleteBlocked}
        onHide={() => setShowDeleteBlocked(false)}
        itemName={deleteBlockedInfo?.name || ""}
        itemType="permission"
        dependencies={deleteBlockedInfo}
      />
      <DeleteConfirmModal
        show={showDeleteConfirm}
        onHide={() => {
          setShowDeleteConfirm(false);
          setDeletingPermission(null);
        }}
        itemName={deletingPermission?.label || ""}
        onConfirm={handleDeleteConfirm}
      />
    </>
  );
};

export default PermissionsTab;
