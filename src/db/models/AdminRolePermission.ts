import * as Sequelize from 'sequelize';
import { DataTypes, Model, Optional } from 'sequelize';
import type { AdminRole, AdminRoleId } from './AdminRole';
import type { AdminPermission, AdminPermissionId } from './AdminPermission';

export interface AdminRolePermissionAttributes {
  id: number;
  roleID: number;
  permissionID: number;
  createTimestamp: Date;
}

export type AdminRolePermissionPk = "id";
export type AdminRolePermissionId = AdminRolePermission[AdminRolePermissionPk];
export type AdminRolePermissionOptionalAttributes = "id" | "createTimestamp";
export type AdminRolePermissionCreationAttributes = Optional<AdminRolePermissionAttributes, AdminRolePermissionOptionalAttributes>;

export class AdminRolePermission extends Model<AdminRolePermissionAttributes, AdminRolePermissionCreationAttributes> implements AdminRolePermissionAttributes {
  id!: number;
  roleID!: number;
  permissionID!: number;
  createTimestamp!: Date;

  // AdminRolePermission belongsTo AdminRole via roleID
  role!: AdminRole;
  getRole!: Sequelize.BelongsToGetAssociationMixin<AdminRole>;
  setRole!: Sequelize.BelongsToSetAssociationMixin<AdminRole, AdminRoleId>;
  createRole!: Sequelize.BelongsToCreateAssociationMixin<AdminRole>;
  // AdminRolePermission belongsTo AdminPermission via permissionID
  permission!: AdminPermission;
  getPermission!: Sequelize.BelongsToGetAssociationMixin<AdminPermission>;
  setPermission!: Sequelize.BelongsToSetAssociationMixin<AdminPermission, AdminPermissionId>;
  createPermission!: Sequelize.BelongsToCreateAssociationMixin<AdminPermission>;

  static initModel(sequelize: Sequelize.Sequelize): typeof AdminRolePermission {
    AdminRolePermission.init({
    id: {
      autoIncrement: true,
      type: DataTypes.INTEGER,
      allowNull: false,
      primaryKey: true
    },
    roleID: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'adminRoles',
        key: 'roleID'
      }
    },
    permissionID: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'adminPermissions',
        key: 'permissionID'
      }
    },
    createTimestamp: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: Sequelize.Sequelize.fn('current_timestamp')
    }
  }, {
    sequelize,
    tableName: 'admin_role_permissions',
    timestamps: false,
    indexes: [
      {
        name: "PRIMARY",
        unique: true,
        using: "BTREE",
        fields: [
          { name: "id" },
        ]
      },
      {
        name: "uq_role_permission",
        unique: true,
        using: "BTREE",
        fields: [
          { name: "roleID" },
          { name: "permissionID" },
        ]
      },
      {
        name: "fk_arp_role",
        using: "BTREE",
        fields: [
          { name: "roleID" },
        ]
      },
      {
        name: "fk_arp_permission",
        using: "BTREE",
        fields: [
          { name: "permissionID" },
        ]
      },
    ]
  });
  return AdminRolePermission;
  }
}
