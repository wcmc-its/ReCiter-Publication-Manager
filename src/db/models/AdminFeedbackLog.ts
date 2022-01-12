import * as Sequelize from 'sequelize';
import { DataTypes, Model, Optional } from 'sequelize';
import type { AdminUser, AdminUserId } from './AdminUser';

export interface AdminFeedbackLogAttributes {
  feedbackID: number;
  userID?: number;
  personIdentifier?: string;
  articleIdentifier?: number;
  feedback?: string;
  createTimestamp: Date;
  modifyTimestamp: Date;
}

export type AdminFeedbackLogPk = "feedbackID";
export type AdminFeedbackLogId = AdminFeedbackLog[AdminFeedbackLogPk];
export type AdminFeedbackLogOptionalAttributes = "feedbackID" | "userID" | "personIdentifier" | "articleIdentifier" | "feedback" | "createTimestamp" | "modifyTimestamp";
export type AdminFeedbackLogCreationAttributes = Optional<AdminFeedbackLogAttributes, AdminFeedbackLogOptionalAttributes>;

export class AdminFeedbackLog extends Model<AdminFeedbackLogAttributes, AdminFeedbackLogCreationAttributes> implements AdminFeedbackLogAttributes {
  feedbackID!: number;
  userID?: number;
  personIdentifier?: string;
  articleIdentifier?: number;
  feedback?: string;
  createTimestamp!: Date;
  modifyTimestamp!: Date;

  // AdminFeedbackLog belongsTo AdminUser via userID
  user!: AdminUser;
  getUser!: Sequelize.BelongsToGetAssociationMixin<AdminUser>;
  setUser!: Sequelize.BelongsToSetAssociationMixin<AdminUser, AdminUserId>;
  createUser!: Sequelize.BelongsToCreateAssociationMixin<AdminUser>;

  static initModel(sequelize: Sequelize.Sequelize): typeof AdminFeedbackLog {
    AdminFeedbackLog.init({
    feedbackID: {
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
      type: DataTypes.STRING(20),
      allowNull: true
    },
    articleIdentifier: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    feedback: {
      type: DataTypes.STRING(11),
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
    tableName: 'adminFeedbackLog',
    timestamps: false,
    indexes: [
      {
        name: "PRIMARY",
        unique: true,
        using: "BTREE",
        fields: [
          { name: "feedbackID" },
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
          { name: "articleIdentifier" },
        ]
      },
    ]
  });
  return AdminFeedbackLog;
  }
}
