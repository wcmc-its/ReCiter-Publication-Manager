import * as Sequelize from 'sequelize';
import { DataTypes, Model, Optional } from 'sequelize';
import type { AdminPermission, AdminPermissionId } from './AdminPermission';

export interface AdminPermissionResourceAttributes {
  id: number;
  permissionID: number;
  resourceType: string;
  resourceKey: string;
  displayOrder: number;
  icon?: string;
  label: string;
  route?: string;
  createTimestamp: Date;
}

export type AdminPermissionResourcePk = "id";
export type AdminPermissionResourceId = AdminPermissionResource[AdminPermissionResourcePk];
export type AdminPermissionResourceOptionalAttributes = "id" | "displayOrder" | "icon" | "route" | "createTimestamp";
export type AdminPermissionResourceCreationAttributes = Optional<AdminPermissionResourceAttributes, AdminPermissionResourceOptionalAttributes>;

export class AdminPermissionResource extends Model<AdminPermissionResourceAttributes, AdminPermissionResourceCreationAttributes> implements AdminPermissionResourceAttributes {
  id!: number;
  permissionID!: number;
  resourceType!: string;
  resourceKey!: string;
  displayOrder!: number;
  icon?: string;
  label!: string;
  route?: string;
  createTimestamp!: Date;

  // AdminPermissionResource belongsTo AdminPermission via permissionID
  permission!: AdminPermission;
  getPermission!: Sequelize.BelongsToGetAssociationMixin<AdminPermission>;
  setPermission!: Sequelize.BelongsToSetAssociationMixin<AdminPermission, AdminPermissionId>;
  createPermission!: Sequelize.BelongsToCreateAssociationMixin<AdminPermission>;

  static initModel(sequelize: Sequelize.Sequelize): typeof AdminPermissionResource {
    AdminPermissionResource.init({
    id: {
      autoIncrement: true,
      type: DataTypes.INTEGER,
      allowNull: false,
      primaryKey: true
    },
    permissionID: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'adminPermissions',
        key: 'permissionID'
      }
    },
    resourceType: {
      type: DataTypes.STRING(32),
      allowNull: false
    },
    resourceKey: {
      type: DataTypes.STRING(128),
      allowNull: false
    },
    displayOrder: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0
    },
    icon: {
      type: DataTypes.STRING(64),
      allowNull: true
    },
    label: {
      type: DataTypes.STRING(255),
      allowNull: false
    },
    route: {
      type: DataTypes.STRING(255),
      allowNull: true
    },
    createTimestamp: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: Sequelize.Sequelize.fn('current_timestamp')
    }
  }, {
    sequelize,
    tableName: 'admin_permission_resources',
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
        name: "uq_permission_resource",
        unique: true,
        using: "BTREE",
        fields: [
          { name: "permissionID" },
          { name: "resourceKey" },
        ]
      },
      {
        name: "fk_apr_permission",
        using: "BTREE",
        fields: [
          { name: "permissionID" },
        ]
      },
    ]
  });
  return AdminPermissionResource;
  }
}
