import * as Sequelize from 'sequelize';
import { DataTypes, Model, Optional } from 'sequelize';
import type { AdminDepartment, AdminDepartmentId } from './AdminDepartment';
import type { AdminUser, AdminUserId } from './AdminUser';

export interface AdminUsersDepartmentAttributes {
  id: number;
  userID?: number;
  departmentID?: number;
  createTimestamp: Date;
  modifyTimestamp: Date;
}

export type AdminUsersDepartmentPk = "id";
export type AdminUsersDepartmentId = AdminUsersDepartment[AdminUsersDepartmentPk];
export type AdminUsersDepartmentOptionalAttributes = "id" | "userID" | "departmentID" | "createTimestamp" | "modifyTimestamp";
export type AdminUsersDepartmentCreationAttributes = Optional<AdminUsersDepartmentAttributes, AdminUsersDepartmentOptionalAttributes>;

export class AdminUsersDepartment extends Model<AdminUsersDepartmentAttributes, AdminUsersDepartmentCreationAttributes> implements AdminUsersDepartmentAttributes {
  id!: number;
  userID?: number;
  departmentID?: number;
  createTimestamp!: Date;
  modifyTimestamp!: Date;

  // AdminUsersDepartment belongsTo AdminDepartment via departmentID
  department!: AdminDepartment;
  getDepartment!: Sequelize.BelongsToGetAssociationMixin<AdminDepartment>;
  setDepartment!: Sequelize.BelongsToSetAssociationMixin<AdminDepartment, AdminDepartmentId>;
  createDepartment!: Sequelize.BelongsToCreateAssociationMixin<AdminDepartment>;
  // AdminUsersDepartment belongsTo AdminUser via userID
  user!: AdminUser;
  getUser!: Sequelize.BelongsToGetAssociationMixin<AdminUser>;
  setUser!: Sequelize.BelongsToSetAssociationMixin<AdminUser, AdminUserId>;
  createUser!: Sequelize.BelongsToCreateAssociationMixin<AdminUser>;

  static initModel(sequelize: Sequelize.Sequelize): typeof AdminUsersDepartment {
    AdminUsersDepartment.init({
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
    departmentID: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'adminDepartments',
        key: 'departmentID'
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
    tableName: 'adminUsersDepartments',
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
        name: "admin_users_departments_ibfk_1",
        using: "BTREE",
        fields: [
          { name: "departmentID" },
        ]
      },
      {
        name: "idx_userID",
        using: "BTREE",
        fields: [
          { name: "userID" },
        ]
      },
    ]
  });
  return AdminUsersDepartment;
  }
}
