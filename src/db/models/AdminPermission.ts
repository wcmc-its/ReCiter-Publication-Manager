import * as Sequelize from 'sequelize';
import { DataTypes, Model, Optional } from 'sequelize';
import type { AdminRolePermission, AdminRolePermissionId } from './AdminRolePermission';
import type { AdminPermissionResource, AdminPermissionResourceId } from './AdminPermissionResource';

export interface AdminPermissionAttributes {
  permissionID: number;
  permissionKey: string;
  label: string;
  description?: string;
  category: string;
  createTimestamp: Date;
  modifyTimestamp: Date;
}

export type AdminPermissionPk = "permissionID";
export type AdminPermissionId = AdminPermission[AdminPermissionPk];
export type AdminPermissionOptionalAttributes = "permissionID" | "description" | "createTimestamp" | "modifyTimestamp";
export type AdminPermissionCreationAttributes = Optional<AdminPermissionAttributes, AdminPermissionOptionalAttributes>;

export class AdminPermission extends Model<AdminPermissionAttributes, AdminPermissionCreationAttributes> implements AdminPermissionAttributes {
  permissionID!: number;
  permissionKey!: string;
  label!: string;
  description?: string;
  category!: string;
  createTimestamp!: Date;
  modifyTimestamp!: Date;

  // AdminPermission hasMany AdminRolePermission via permissionID
  adminRolePermissions!: AdminRolePermission[];
  getAdminRolePermissions!: Sequelize.HasManyGetAssociationsMixin<AdminRolePermission>;
  setAdminRolePermissions!: Sequelize.HasManySetAssociationsMixin<AdminRolePermission, AdminRolePermissionId>;
  addAdminRolePermission!: Sequelize.HasManyAddAssociationMixin<AdminRolePermission, AdminRolePermissionId>;
  addAdminRolePermissions!: Sequelize.HasManyAddAssociationsMixin<AdminRolePermission, AdminRolePermissionId>;
  createAdminRolePermission!: Sequelize.HasManyCreateAssociationMixin<AdminRolePermission>;
  removeAdminRolePermission!: Sequelize.HasManyRemoveAssociationMixin<AdminRolePermission, AdminRolePermissionId>;
  removeAdminRolePermissions!: Sequelize.HasManyRemoveAssociationsMixin<AdminRolePermission, AdminRolePermissionId>;
  hasAdminRolePermission!: Sequelize.HasManyHasAssociationMixin<AdminRolePermission, AdminRolePermissionId>;
  hasAdminRolePermissions!: Sequelize.HasManyHasAssociationsMixin<AdminRolePermission, AdminRolePermissionId>;
  countAdminRolePermissions!: Sequelize.HasManyCountAssociationsMixin;

  // AdminPermission hasMany AdminPermissionResource via permissionID
  adminPermissionResources!: AdminPermissionResource[];
  getAdminPermissionResources!: Sequelize.HasManyGetAssociationsMixin<AdminPermissionResource>;
  setAdminPermissionResources!: Sequelize.HasManySetAssociationsMixin<AdminPermissionResource, AdminPermissionResourceId>;
  addAdminPermissionResource!: Sequelize.HasManyAddAssociationMixin<AdminPermissionResource, AdminPermissionResourceId>;
  addAdminPermissionResources!: Sequelize.HasManyAddAssociationsMixin<AdminPermissionResource, AdminPermissionResourceId>;
  createAdminPermissionResource!: Sequelize.HasManyCreateAssociationMixin<AdminPermissionResource>;
  removeAdminPermissionResource!: Sequelize.HasManyRemoveAssociationMixin<AdminPermissionResource, AdminPermissionResourceId>;
  removeAdminPermissionResources!: Sequelize.HasManyRemoveAssociationsMixin<AdminPermissionResource, AdminPermissionResourceId>;
  hasAdminPermissionResource!: Sequelize.HasManyHasAssociationMixin<AdminPermissionResource, AdminPermissionResourceId>;
  hasAdminPermissionResources!: Sequelize.HasManyHasAssociationsMixin<AdminPermissionResource, AdminPermissionResourceId>;
  countAdminPermissionResources!: Sequelize.HasManyCountAssociationsMixin;

  static initModel(sequelize: Sequelize.Sequelize): typeof AdminPermission {
    AdminPermission.init({
    permissionID: {
      autoIncrement: true,
      type: DataTypes.INTEGER,
      allowNull: false,
      primaryKey: true
    },
    permissionKey: {
      type: DataTypes.STRING(128),
      allowNull: false,
      unique: true
    },
    label: {
      type: DataTypes.STRING(255),
      allowNull: false
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    category: {
      type: DataTypes.STRING(64),
      allowNull: false
    },
    createTimestamp: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: Sequelize.Sequelize.fn('current_timestamp')
    },
    modifyTimestamp: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: Sequelize.Sequelize.fn('current_timestamp')
    }
  }, {
    sequelize,
    tableName: 'admin_permissions',
    timestamps: false,
    indexes: [
      {
        name: "PRIMARY",
        unique: true,
        using: "BTREE",
        fields: [
          { name: "permissionID" },
        ]
      },
      {
        name: "uq_permission_key",
        unique: true,
        using: "BTREE",
        fields: [
          { name: "permissionKey" },
        ]
      },
    ]
  });
  return AdminPermission;
  }
}
