import * as Sequelize from 'sequelize';
import { DataTypes, Model, Optional } from 'sequelize';
import type { AdminUsersDepartment, AdminUsersDepartmentId } from './AdminUsersDepartment';

export interface AdminDepartmentAttributes {
  departmentID: number;
  institutionalDepartmentCode?: string;
  departmentLabel?: string;
  source?: string;
  status?: number;
  createTimestamp: Date;
  modifyTimestamp: Date;
}

export type AdminDepartmentPk = "departmentID";
export type AdminDepartmentId = AdminDepartment[AdminDepartmentPk];
export type AdminDepartmentOptionalAttributes = "departmentID" | "institutionalDepartmentCode" | "departmentLabel" | "source" | "status" | "createTimestamp" | "modifyTimestamp";
export type AdminDepartmentCreationAttributes = Optional<AdminDepartmentAttributes, AdminDepartmentOptionalAttributes>;

export class AdminDepartment extends Model<AdminDepartmentAttributes, AdminDepartmentCreationAttributes> implements AdminDepartmentAttributes {
  departmentID!: number;
  institutionalDepartmentCode?: string;
  departmentLabel?: string;
  source?: string;
  status?: number;
  createTimestamp!: Date;
  modifyTimestamp!: Date;

  // AdminDepartment hasMany AdminUsersDepartment via departmentID
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

  static initModel(sequelize: Sequelize.Sequelize): typeof AdminDepartment {
    AdminDepartment.init({
    departmentID: {
      autoIncrement: true,
      type: DataTypes.INTEGER,
      allowNull: false,
      primaryKey: true
    },
    institutionalDepartmentCode: {
      type: DataTypes.STRING(128),
      allowNull: true
    },
    departmentLabel: {
      type: DataTypes.STRING(128),
      allowNull: true
    },
    source: {
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
    tableName: 'admin_departments',
    timestamps: false,
    indexes: [
      {
        name: "PRIMARY",
        unique: true,
        using: "BTREE",
        fields: [
          { name: "departmentID" },
        ]
      },
    ]
  });
  return AdminDepartment;
  }
}
