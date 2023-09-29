import * as Sequelize from 'sequelize';
import { DataTypes, Model, Optional } from 'sequelize';
import type { AdminUser, AdminUserId } from './AdminUser';

export interface AdminNotificationPreferenceAttributes {
  id: number;
  userID?: number;
  minimumThreshold?: number;
  frequency?: number;
  accepted?: number;
  suggested?:number;
  status?: number;
  personIdentifier :String;
  createTimestamp: Date;
  modifyTimestamp: Date;
}

export type AdminNotificationPreferencePk = "id";
export type AdminNotificationPreferenceId = AdminNotificationPreference[AdminNotificationPreferencePk];
export type AdminNotificationPreferenceOptionalAttributes = "id" | "userID" | "minimumThreshold" | "frequency" | "accepted" | "status" | "createTimestamp" | "modifyTimestamp";
export type AdminNotificationPreferenceCreationAttributes = Optional<AdminNotificationPreferenceAttributes, AdminNotificationPreferenceOptionalAttributes>;

export class AdminNotificationPreference extends Model<AdminNotificationPreferenceAttributes, AdminNotificationPreferenceCreationAttributes> implements AdminNotificationPreferenceAttributes {
  id!: number;
  userID?: number;
  minimumThreshold?: number;
  frequency?: number;
  accepted?: number;
  suggested?: number;
  status?: number;
  personIdentifier:string; 
  createTimestamp!: Date;
  modifyTimestamp!: Date;

  // AdminNotificationPreference belongsTo AdminUser via userID
  user!: AdminUser;
  getUser!: Sequelize.BelongsToGetAssociationMixin<AdminUser>;
  setUser!: Sequelize.BelongsToSetAssociationMixin<AdminUser, AdminUserId>;
  createUser!: Sequelize.BelongsToCreateAssociationMixin<AdminUser>;

  static initModel(sequelize: Sequelize.Sequelize): typeof AdminNotificationPreference {
    AdminNotificationPreference.init({
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
    minimumThreshold: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    frequency: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    accepted: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: 1
    },
    suggested: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: 1
    },
    status: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: 1
    },
    personIdentifier: {
       type : DataTypes.STRING,
       allowNull:false,
       primaryKey: true
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
    tableName: 'admin_notification_preferences',
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
        name: "admin_notification_preferences_ibfk_1",
        using: "BTREE",
        fields: [
          { name: "userID" },
        ]
      },
    ]
  });
  return AdminNotificationPreference;
  }
}
