import * as Sequelize from 'sequelize';
import { DataTypes, Model, Optional } from 'sequelize';
import type { AdminUser, AdminUserId } from './AdminUser';

export interface AdminUsersProxyAttributes {
  id: number;
  userID?: number;
  personIdentifier?: string;
  createTimestamp: Date;
  modifyTimestamp: Date;
}

export type AdminUsersProxyPk = "id";
export type AdminUsersProxyId = AdminUsersProxy[AdminUsersProxyPk];
export type AdminUsersProxyOptionalAttributes = "id" | "userID" | "personIdentifier" | "createTimestamp" | "modifyTimestamp";
export type AdminUsersProxyCreationAttributes = Optional<AdminUsersProxyAttributes, AdminUsersProxyOptionalAttributes>;

export class AdminUsersProxy extends Model<AdminUsersProxyAttributes, AdminUsersProxyCreationAttributes> implements AdminUsersProxyAttributes {
  id!: number;
  userID?: number;
  personIdentifier?: string;
  createTimestamp!: Date;
  modifyTimestamp!: Date;

  // AdminUsersProxy belongsTo AdminUser via userID
  user!: AdminUser;
  getUser!: Sequelize.BelongsToGetAssociationMixin<AdminUser>;
  setUser!: Sequelize.BelongsToSetAssociationMixin<AdminUser, AdminUserId>;
  createUser!: Sequelize.BelongsToCreateAssociationMixin<AdminUser>;

  static initModel(sequelize: Sequelize.Sequelize): typeof AdminUsersProxy {
    AdminUsersProxy.init({
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
    personIdentifier: {
      type: DataTypes.STRING(128),
      allowNull: true
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
    tableName: 'admin_users_proxy',
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
        name: "idx_personIdentifier",
        using: "BTREE",
        fields: [
          { name: "personIdentifier" },
        ]
      },
      {
        name: "idx_user_person",
        unique: true,
        using: "BTREE",
        fields: [
          { name: "userID" },
          { name: "personIdentifier" },
        ]
      },
    ]
  });
  return AdminUsersProxy;
  }
}
