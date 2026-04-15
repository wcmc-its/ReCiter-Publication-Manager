import React, { useState, useEffect, FunctionComponent } from "react";
import { Button, Table } from "react-bootstrap";
import Chip from "@mui/material/Chip";
import Loader from "../Common/Loader";
import { reciterConfig } from "../../../../config/local";
import { toast } from "react-toastify";
import { useDispatch } from "react-redux";
import { getAdminRoles } from "../../../redux/actions/actions";
import RoleEditModal from "./RoleEditModal";
import DeleteBlockedModal from "./DeleteBlockedModal";
import DeleteConfirmModal from "./DeleteConfirmModal";
import styles from "./RolesTab.module.css";

interface RolePermission {
  permissionID: number;
  permissionKey: string;
  label: string;
}

interface Role {
  roleID: number;
  roleLabel: string;
  permissions: RolePermission[];
  userCount: number;
}

interface Permission {
  permissionID: number;
  permissionKey: string;
  label: string;
  description: string | null;
  category: string;
  resourceCount: number;
  resources: any[];
}

interface DeleteBlockedInfo {
  name: string;
  userCount: number;
  users: { name: string }[];
}

const RolesTab: FunctionComponent = () => {
  const dispatch = useDispatch();

  const [roles, setRoles] = useState<Role[]>([]);
  const [allPermissions, setAllPermissions] = useState<Permission[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [showEditModal, setShowEditModal] = useState<boolean>(false);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [showDeleteBlocked, setShowDeleteBlocked] = useState<boolean>(false);
  const [deleteBlockedInfo, setDeleteBlockedInfo] = useState<DeleteBlockedInfo | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<boolean>(false);
  const [deletingRole, setDeletingRole] = useState<Role | null>(null);

  const fetchHeaders = {
    Accept: "application/json",
    "Content-Type": "application/json",
    Authorization: reciterConfig.backendApiKey,
  };

  const fetchRoles = async () => {
    try {
      const response = await fetch("/api/db/admin/roles", {
        credentials: "same-origin",
        method: "GET",
        headers: fetchHeaders,
      });
      const data = await response.json();
      setRoles(data);
    } catch (error) {
      console.log(error);
      toast.error("Failed to load roles. Please try again.", {
        position: "top-right",
        autoClose: 2000,
        theme: "colored",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchAllPermissions = async () => {
    try {
      const response = await fetch("/api/db/admin/permissions", {
        credentials: "same-origin",
        method: "GET",
        headers: fetchHeaders,
      });
      const data = await response.json();
      setAllPermissions(data);
    } catch (error) {
      console.log(error);
    }
  };

  useEffect(() => {
    fetchRoles();
    fetchAllPermissions();
  }, []);

  const handleDeleteClick = async (role: Role) => {
    try {
      const response = await fetch(
        `/api/db/admin/roles/${role.roleID}?check=true`,
        {
          credentials: "same-origin",
          method: "DELETE",
          headers: fetchHeaders,
        }
      );

      if (response.status === 409) {
        const data = await response.json();
        setDeleteBlockedInfo({
          name: role.roleLabel,
          userCount: data.userCount,
          users: data.users,
        });
        setShowDeleteBlocked(true);
      } else if (response.status === 200) {
        const data = await response.json();
        if (data.canDelete) {
          setDeletingRole(role);
          setShowDeleteConfirm(true);
        }
      } else {
        toast.error("Failed to check role dependencies. Please try again.", {
          position: "top-right",
          autoClose: 2000,
          theme: "colored",
        });
      }
    } catch (error) {
      console.log(error);
      toast.error("Failed to check role dependencies. Please try again.", {
        position: "top-right",
        autoClose: 2000,
        theme: "colored",
      });
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deletingRole) return;

    try {
      const response = await fetch(
        `/api/db/admin/roles/${deletingRole.roleID}`,
        {
          credentials: "same-origin",
          method: "DELETE",
          headers: fetchHeaders,
        }
      );

      if (response.status === 200) {
        toast.success(`${deletingRole.roleLabel} deleted successfully`, {
          position: "top-right",
          autoClose: 2000,
          theme: "colored",
        });
        fetchRoles();
        dispatch(getAdminRoles());
      } else {
        toast.error("Failed to delete role. Please try again.", {
          position: "top-right",
          autoClose: 2000,
          theme: "colored",
        });
      }
    } catch (error) {
      console.log(error);
      toast.error("Failed to delete role. Please try again.", {
        position: "top-right",
        autoClose: 2000,
        theme: "colored",
      });
    } finally {
      setShowDeleteConfirm(false);
      setDeletingRole(null);
    }
  };

  const handleSaveRole = async (roleData: {
    roleLabel: string;
    permissionIDs: number[];
  }) => {
    try {
      let response: Response;
      const isEdit = editingRole !== null;

      if (isEdit) {
        response = await fetch(
          `/api/db/admin/roles/${editingRole.roleID}`,
          {
            credentials: "same-origin",
            method: "PUT",
            headers: fetchHeaders,
            body: JSON.stringify({
              roleLabel: roleData.roleLabel,
              permissionIDs: roleData.permissionIDs,
            }),
          }
        );
      } else {
        response = await fetch("/api/db/admin/roles/create", {
          credentials: "same-origin",
          method: "POST",
          headers: fetchHeaders,
          body: JSON.stringify({
            roleLabel: roleData.roleLabel,
            permissionIDs: roleData.permissionIDs,
          }),
        });
      }

      if (response.ok) {
        const actionLabel = isEdit ? "updated" : "created";
        toast.success(
          `${roleData.roleLabel} ${actionLabel} successfully`,
          {
            position: "top-right",
            autoClose: 2000,
            theme: "colored",
          }
        );
        setShowEditModal(false);
        setEditingRole(null);
        fetchRoles();
        dispatch(getAdminRoles());
      } else {
        const errorData = await response.json().catch(() => null);
        toast.error(
          errorData?.error || "Failed to save role. Please try again.",
          {
            position: "top-right",
            autoClose: 2000,
            theme: "colored",
          }
        );
      }
    } catch (error) {
      console.log(error);
      toast.error("Failed to save role. Please try again.", {
        position: "top-right",
        autoClose: 2000,
        theme: "colored",
      });
    }
  };

  return (
    <>
      <div className={styles.toolbar}>
        <Button
          variant="primary"
          onClick={() => {
            setEditingRole(null);
            setShowEditModal(true);
          }}
        >
          Add Role
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
              <th scope="col">Role Name</th>
              <th scope="col">Permissions</th>
              <th scope="col">Actions</th>
            </tr>
          </thead>
          <tbody>
            {roles.length === 0 ? (
              <tr>
                <td colSpan={3}>
                  <em>No roles defined.</em>
                </td>
              </tr>
            ) : (
              roles.map((role) => (
                <tr key={role.roleID}>
                  <td>{role.roleLabel}</td>
                  <td>
                    {role.permissions?.map((p) => (
                      <Chip
                        key={p.permissionID}
                        size="small"
                        label={p.label}
                        style={{ marginRight: 4, marginBottom: 4 }}
                      />
                    ))}
                  </td>
                  <td>
                    <Button
                      variant="outline-dark"
                      size="sm"
                      onClick={() => {
                        setEditingRole(role);
                        setShowEditModal(true);
                      }}
                      style={{ marginRight: 8 }}
                    >
                      Edit
                    </Button>
                    <Button
                      variant="outline-danger"
                      size="sm"
                      onClick={() => handleDeleteClick(role)}
                      aria-label={`Delete ${role.roleLabel}`}
                    >
                      Delete
                    </Button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </Table>
      )}
      <RoleEditModal
        show={showEditModal}
        onHide={() => {
          setShowEditModal(false);
          setEditingRole(null);
        }}
        role={editingRole}
        allPermissions={allPermissions}
        onSave={handleSaveRole}
      />
      <DeleteBlockedModal
        show={showDeleteBlocked}
        onHide={() => setShowDeleteBlocked(false)}
        itemName={deleteBlockedInfo?.name || ""}
        itemType="role"
        dependencies={deleteBlockedInfo}
      />
      <DeleteConfirmModal
        show={showDeleteConfirm}
        onHide={() => {
          setShowDeleteConfirm(false);
          setDeletingRole(null);
        }}
        itemName={deletingRole?.roleLabel || ""}
        onConfirm={handleDeleteConfirm}
      />
    </>
  );
};

export default RolesTab;
