import * as Sequelize from 'sequelize';
import { DataTypes, Model, Optional } from 'sequelize';
import type { AdminFeedbackLog, AdminFeedbackLogId } from './AdminFeedbackLog';
import type { AdminNotificationLog, AdminNotificationLogId } from './AdminNotificationLog';
import type { AdminNotificationPreference, AdminNotificationPreferenceId } from './AdminNotificationPreference';
import type { AdminUsersDepartment, AdminUsersDepartmentId } from './AdminUsersDepartment';
import type { AdminUsersRole, AdminUsersRoleId } from './AdminUsersRole';

export interface AdminUserAttributes {
  userID: number;
  personIdentifier?: string;
  nameFirst?: string;
  nameMiddle?: string;
  nameLast?: string;
  email?: string;
  status?: number;
  createTimestamp: Date;
  modifyTimestamp: Date;
}

export type AdminUserPk = "userID";
export type AdminUserId = AdminUser[AdminUserPk];
export type AdminUserOptionalAttributes = "userID" | "personIdentifier" | "nameFirst" | "nameMiddle" | "nameLast" | "email" | "status" | "createTimestamp" | "modifyTimestamp";
export type AdminUserCreationAttributes = Optional<AdminUserAttributes, AdminUserOptionalAttributes>;

export class AdminUser extends Model<AdminUserAttributes, AdminUserCreationAttributes> implements AdminUserAttributes {
  userID!: number;
  personIdentifier?: string;
  nameFirst?: string;
  nameMiddle?: string;
  nameLast?: string;
  email?: string;
  status?: number;
  createTimestamp!: Date;
  modifyTimestamp!: Date;

  // AdminUser hasMany AdminFeedbackLog via userID
  adminFeedbackLogs!: AdminFeedbackLog[];
  getAdminFeedbackLogs!: Sequelize.HasManyGetAssociationsMixin<AdminFeedbackLog>;
  setAdminFeedbackLogs!: Sequelize.HasManySetAssociationsMixin<AdminFeedbackLog, AdminFeedbackLogId>;
  addAdminFeedbackLog!: Sequelize.HasManyAddAssociationMixin<AdminFeedbackLog, AdminFeedbackLogId>;
  addAdminFeedbackLogs!: Sequelize.HasManyAddAssociationsMixin<AdminFeedbackLog, AdminFeedbackLogId>;
  createAdminFeedbackLog!: Sequelize.HasManyCreateAssociationMixin<AdminFeedbackLog>;
  removeAdminFeedbackLog!: Sequelize.HasManyRemoveAssociationMixin<AdminFeedbackLog, AdminFeedbackLogId>;
  removeAdminFeedbackLogs!: Sequelize.HasManyRemoveAssociationsMixin<AdminFeedbackLog, AdminFeedbackLogId>;
  hasAdminFeedbackLog!: Sequelize.HasManyHasAssociationMixin<AdminFeedbackLog, AdminFeedbackLogId>;
  hasAdminFeedbackLogs!: Sequelize.HasManyHasAssociationsMixin<AdminFeedbackLog, AdminFeedbackLogId>;
  countAdminFeedbackLogs!: Sequelize.HasManyCountAssociationsMixin;
  // AdminUser hasMany AdminNotificationLog via userID
  adminNotificationLogs!: AdminNotificationLog[];
  getAdminNotificationLogs!: Sequelize.HasManyGetAssociationsMixin<AdminNotificationLog>;
  setAdminNotificationLogs!: Sequelize.HasManySetAssociationsMixin<AdminNotificationLog, AdminNotificationLogId>;
  addAdminNotificationLog!: Sequelize.HasManyAddAssociationMixin<AdminNotificationLog, AdminNotificationLogId>;
  addAdminNotificationLogs!: Sequelize.HasManyAddAssociationsMixin<AdminNotificationLog, AdminNotificationLogId>;
  createAdminNotificationLog!: Sequelize.HasManyCreateAssociationMixin<AdminNotificationLog>;
  removeAdminNotificationLog!: Sequelize.HasManyRemoveAssociationMixin<AdminNotificationLog, AdminNotificationLogId>;
  removeAdminNotificationLogs!: Sequelize.HasManyRemoveAssociationsMixin<AdminNotificationLog, AdminNotificationLogId>;
  hasAdminNotificationLog!: Sequelize.HasManyHasAssociationMixin<AdminNotificationLog, AdminNotificationLogId>;
  hasAdminNotificationLogs!: Sequelize.HasManyHasAssociationsMixin<AdminNotificationLog, AdminNotificationLogId>;
  countAdminNotificationLogs!: Sequelize.HasManyCountAssociationsMixin;
  // AdminUser hasMany AdminNotificationPreference via userID
  adminNotificationPreferences!: AdminNotificationPreference[];
  getAdminNotificationPreferences!: Sequelize.HasManyGetAssociationsMixin<AdminNotificationPreference>;
  setAdminNotificationPreferences!: Sequelize.HasManySetAssociationsMixin<AdminNotificationPreference, AdminNotificationPreferenceId>;
  addAdminNotificationPreference!: Sequelize.HasManyAddAssociationMixin<AdminNotificationPreference, AdminNotificationPreferenceId>;
  addAdminNotificationPreferences!: Sequelize.HasManyAddAssociationsMixin<AdminNotificationPreference, AdminNotificationPreferenceId>;
  createAdminNotificationPreference!: Sequelize.HasManyCreateAssociationMixin<AdminNotificationPreference>;
  removeAdminNotificationPreference!: Sequelize.HasManyRemoveAssociationMixin<AdminNotificationPreference, AdminNotificationPreferenceId>;
  removeAdminNotificationPreferences!: Sequelize.HasManyRemoveAssociationsMixin<AdminNotificationPreference, AdminNotificationPreferenceId>;
  hasAdminNotificationPreference!: Sequelize.HasManyHasAssociationMixin<AdminNotificationPreference, AdminNotificationPreferenceId>;
  hasAdminNotificationPreferences!: Sequelize.HasManyHasAssociationsMixin<AdminNotificationPreference, AdminNotificationPreferenceId>;
  countAdminNotificationPreferences!: Sequelize.HasManyCountAssociationsMixin;
  // AdminUser hasMany AdminUsersDepartment via userID
  adminUsersDepartments!: AdminUsersDepartment[];
  getAdminUsersDepartments!: Sequelize.HasManyGetAssociationsMixin<AdminUsersDepartment>;
  setAdminUsersDepartments!: Sequelize.HasManySetAssociationsMixin<AdminUsersDepartment, AdminUsersDepartmentId>;
  addAdminUsersDepartment!: Sequelize.HasManyAddAssociationMixin<AdminUsersDepartment, AdminUsersDepartmentId>;
  addAdminUsersDepartments!: Sequelize.HasManyAddAssociationsMixin<AdminUsersDepartment, AdminUsersDepartmentId>;
  createAdminUsersDepartment!: Sequelize.HasManyCreateAssociationMixin<AdminUsersDepartment>;
  removeAdminUsersDepartment!: Sequelize.HasManyRemoveAssociationMixin<AdminUsersDepartment, AdminUsersDepartmentId>;
  removeAdminUsersDepartments!: Sequelize.HasManyRemoveAssociationsMixin<AdminUsersDepartment, AdminUsersDepartmentId>;
  hasAdminUsersDepartment!: Sequelize.HasManyHasAssociationMixin<AdminUsersDepartment, AdminUsersDepartmentId>;
  hasAdminUsersDepartments!: Sequelize.HasManyHasAssociationsMixin<AdminUsersDepartment, AdminUsersDepartmentId>;
  countAdminUsersDepartments!: Sequelize.HasManyCountAssociationsMixin;
  // AdminUser hasMany AdminUsersRole via userID
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

  static initModel(sequelize: Sequelize.Sequelize): typeof AdminUser {
    AdminUser.init({
    userID: {
      autoIncrement: true,
      type: DataTypes.INTEGER,
      allowNull: false,
      primaryKey: true
    },
    personIdentifier: {
      type: DataTypes.STRING(128),
      allowNull: true
    },
    nameFirst: {
      type: DataTypes.STRING(128),
      allowNull: true
    },
    nameMiddle: {
      type: DataTypes.STRING(128),
      allowNull: true
    },
    nameLast: {
      type: DataTypes.STRING(128),
      allowNull: true
    },
    email: {
      type: DataTypes.STRING(128),
      allowNull: true
    },
    status: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: 1
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
    tableName: 'admin_users',
    timestamps: false,
    indexes: [
      {
        name: "PRIMARY",
        unique: true,
        using: "BTREE",
        fields: [
          { name: "userID" },
        ]
      },
    ]
  });
  return AdminUser;
  }
}
