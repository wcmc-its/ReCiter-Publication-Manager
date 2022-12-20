import * as Sequelize from 'sequelize';
import { DataTypes, Model, Optional } from 'sequelize';
import type { AdminUsersRole, AdminUsersRoleId } from './AdminUsersRole';

export interface AdminRoleAttributes {
  roleID: number;
  roleLabel?: string;
  createTimestamp: Date;
  modifyTimestamp: Date;
}

export type AdminRolePk = "roleID";
export type AdminRoleId = AdminRole[AdminRolePk];
export type AdminRoleOptionalAttributes = "roleID" | "roleLabel" | "createTimestamp" | "modifyTimestamp";
export type AdminRoleCreationAttributes = Optional<AdminRoleAttributes, AdminRoleOptionalAttributes>;

export class AdminRole extends Model<AdminRoleAttributes, AdminRoleCreationAttributes> implements AdminRoleAttributes {
  roleID!: number;
  roleLabel?: string;
  createTimestamp!: Date;
  modifyTimestamp!: Date;

  // AdminRole hasMany AdminUsersRole via roleID
  adminUsersRoles!: AdminUsersRole[];
  getAdminUsersRoles!: Sequelize.HasManyGetAssociationsMixin<AdminUsersRole>;
  setAdminUsersRoles!: Sequelize.HasManySetAssociationsMixin<AdminUsersRole, AdminUsersRoleId>;
  addAdminUsersRole!: Sequelize.HasManyAddAssociationMixin<AdminUsersRole, AdminUsersRoleId>;
  addAdminUsersRoles!: Sequelize.HasManyAddAssociationsMixin<AdminUsersRole, AdminUsersRoleId>;
  createAdminUsersRole!: Sequelize.HasManyCreateAssociationMixin<AdminUsersRole>;
  removeAdminUsersRole!: Sequelize.HasManyRemoveAssociationMixin<AdminUsersRole, AdminUsersRoleId>;
  removeAdminUsersRoles!: Sequelize.HasManyRemoveAssociationsMixin<AdminUsersRole, AdminUsersRoleId>;
  hasAdminUsersRole!: Sequelize.HasManyHasAssociationMixin<AdminUsersRole, AdminUsersRoleId>;
  hasAdminUsersRoles!: Sequelize.HasManyHasAssociationsMixin<AdminUsersRole, AdminUsersRoleId>;
  countAdminUsersRoles!: Sequelize.HasManyCountAssociationsMixin;

  static initModel(sequelize: Sequelize.Sequelize): typeof AdminRole {
    AdminRole.init({
    roleID: {
      autoIncrement: true,
      type: DataTypes.INTEGER,
      allowNull: false,
      primaryKey: true
    },
    roleLabel: {
      type: DataTypes.STRING(128),
      allowNull: true
    },
    createTimestamp: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: "0000-00-00 00:00:00"
    },
    modifyTimestamp: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: Sequelize.Sequelize.fn('current_timestamp')
    }
  }, {
    sequelize,
    tableName: 'admin_roles',
    timestamps: false,
    indexes: [
      {
        name: "PRIMARY",
        unique: true,
        using: "BTREE",
        fields: [
          { name: "roleID" },
        ]
      },
    ]
  });
  return AdminRole;
  }
}
