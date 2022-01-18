import * as Sequelize from 'sequelize';
import { DataTypes, Model, Optional } from 'sequelize';
import type { AdminRole, AdminRoleId } from './AdminRole';
import type { AdminUser, AdminUserId } from './AdminUser';

export interface AdminUsersRoleAttributes {
  id: number;
  userID?: number;
  roleID?: number;
  createTimestamp: Date;
  modifyTimestamp: Date;
}

export type AdminUsersRolePk = "id";
export type AdminUsersRoleId = AdminUsersRole[AdminUsersRolePk];
export type AdminUsersRoleOptionalAttributes = "id" | "userID" | "roleID" | "createTimestamp" | "modifyTimestamp";
export type AdminUsersRoleCreationAttributes = Optional<AdminUsersRoleAttributes, AdminUsersRoleOptionalAttributes>;

export class AdminUsersRole extends Model<AdminUsersRoleAttributes, AdminUsersRoleCreationAttributes> implements AdminUsersRoleAttributes {
  id!: number;
  userID?: number;
  roleID?: number;
  createTimestamp!: Date;
  modifyTimestamp!: Date;

  // AdminUsersRole belongsTo AdminRole via roleID
  role!: AdminRole;
  getRole!: Sequelize.BelongsToGetAssociationMixin<AdminRole>;
  setRole!: Sequelize.BelongsToSetAssociationMixin<AdminRole, AdminRoleId>;
  createRole!: Sequelize.BelongsToCreateAssociationMixin<AdminRole>;
  // AdminUsersRole belongsTo AdminUser via userID
  user!: AdminUser;
  getUser!: Sequelize.BelongsToGetAssociationMixin<AdminUser>;
  setUser!: Sequelize.BelongsToSetAssociationMixin<AdminUser, AdminUserId>;
  createUser!: Sequelize.BelongsToCreateAssociationMixin<AdminUser>;

  static initModel(sequelize: Sequelize.Sequelize): typeof AdminUsersRole {
    AdminUsersRole.init({
    id: {
      autoIncrement: true,
      type: DataTypes.INTEGER,
      allowNull: false,
      primaryKey: true
    },
    userID: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'adminUsers',
        key: 'userID'
      }
    },
    roleID: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'adminRoles',
        key: 'roleID'
      }
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
    tableName: 'adminUsersRoles',
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
        name: "admin_users_roles_ibfk_1",
        using: "BTREE",
        fields: [
          { name: "userID" },
        ]
      },
      {
        name: "admin_users_roles_ibfk_2",
        using: "BTREE",
        fields: [
          { name: "roleID" },
        ]
      },
    ]
  });
  return AdminUsersRole;
  }
}
