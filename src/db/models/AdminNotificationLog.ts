import * as Sequelize from 'sequelize';
import { DataTypes, Model, Optional } from 'sequelize';
import type { AdminUser, AdminUserId } from './AdminUser';

export interface AdminNotificationLogAttributes {
  notificationID: number;
  userID?: number;
  articleIdentifier?: number;
  articleScore?: number;
  email?: string;
  dateSent?: Date;
  createTimestamp: Date;
  modifyTimestamp: Date;
}

export type AdminNotificationLogPk = "notificationID";
export type AdminNotificationLogId = AdminNotificationLog[AdminNotificationLogPk];
export type AdminNotificationLogOptionalAttributes = "notificationID" | "userID" | "articleIdentifier" | "articleScore" | "email" | "dateSent" | "createTimestamp" | "modifyTimestamp";
export type AdminNotificationLogCreationAttributes = Optional<AdminNotificationLogAttributes, AdminNotificationLogOptionalAttributes>;

export class AdminNotificationLog extends Model<AdminNotificationLogAttributes, AdminNotificationLogCreationAttributes> implements AdminNotificationLogAttributes {
  notificationID!: number;
  userID?: number;
  articleIdentifier?: number;
  articleScore?: number;
  email?: string;
  dateSent?: Date;
  createTimestamp!: Date;
  modifyTimestamp!: Date;

  // AdminNotificationLog belongsTo AdminUser via userID
  user!: AdminUser;
  getUser!: Sequelize.BelongsToGetAssociationMixin<AdminUser>;
  setUser!: Sequelize.BelongsToSetAssociationMixin<AdminUser, AdminUserId>;
  createUser!: Sequelize.BelongsToCreateAssociationMixin<AdminUser>;

  static initModel(sequelize: Sequelize.Sequelize): typeof AdminNotificationLog {
    AdminNotificationLog.init({
    notificationID: {
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
    articleIdentifier: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    articleScore: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    email: {
      type: DataTypes.STRING(128),
      allowNull: true
    },
    dateSent: {
      type: DataTypes.DATE,
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
    tableName: 'admin_notification_log',
    timestamps: false,
    indexes: [
      {
        name: "PRIMARY",
        unique: true,
        using: "BTREE",
        fields: [
          { name: "notificationID" },
        ]
      },
      {
        name: "admin_notification_log_ibfk_1",
        using: "BTREE",
        fields: [
          { name: "userID" },
        ]
      },
    ]
  });
  return AdminNotificationLog;
  }
}
