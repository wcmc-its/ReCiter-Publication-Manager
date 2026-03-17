import * as Sequelize from 'sequelize';
import { DataTypes, Model, Optional } from 'sequelize';
import type { AdminUser, AdminUserId } from './AdminUser';

export interface AdminUsersPersonTypeAttributes {
  id: number;
  userID?: number;
  personType?: string;
  createTimestamp: Date;
  modifyTimestamp: Date;
}

export type AdminUsersPersonTypePk = "id";
export type AdminUsersPersonTypeId = AdminUsersPersonType[AdminUsersPersonTypePk];
export type AdminUsersPersonTypeOptionalAttributes = "id" | "userID" | "personType" | "createTimestamp" | "modifyTimestamp";
export type AdminUsersPersonTypeCreationAttributes = Optional<AdminUsersPersonTypeAttributes, AdminUsersPersonTypeOptionalAttributes>;

export class AdminUsersPersonType extends Model<AdminUsersPersonTypeAttributes, AdminUsersPersonTypeCreationAttributes> implements AdminUsersPersonTypeAttributes {
  id!: number;
  userID?: number;
  personType?: string;
  createTimestamp!: Date;
  modifyTimestamp!: Date;

  // AdminUsersPersonType belongsTo AdminUser via userID
  user!: AdminUser;
  getUser!: Sequelize.BelongsToGetAssociationMixin<AdminUser>;
  setUser!: Sequelize.BelongsToSetAssociationMixin<AdminUser, AdminUserId>;
  createUser!: Sequelize.BelongsToCreateAssociationMixin<AdminUser>;

  static initModel(sequelize: Sequelize.Sequelize): typeof AdminUsersPersonType {
    AdminUsersPersonType.init({
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
    personType: {
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
    tableName: 'admin_users_person_types',
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
        name: "idx_userID",
        using: "BTREE",
        fields: [
          { name: "userID" },
        ]
      },
      {
        name: "idx_personType",
        using: "BTREE",
        fields: [
          { name: "personType" },
        ]
      },
    ]
  });
  return AdminUsersPersonType;
  }
}
