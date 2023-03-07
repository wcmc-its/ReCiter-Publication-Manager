import * as Sequelize from 'sequelize';
import { DataTypes, Model } from 'sequelize';

export interface AdminSettingAttributes {
  id: number;
  viewName: string;
  viewAttributes: string;
  viewLabel: string; 
  createTimestamp?: Date;
  modifyTimestamp?: Date;
}

export type AdminSettingsPk = "id";
export type AdminSettingsId = AdminSettings[AdminSettingsPk];


export class AdminSettings extends Model<AdminSettingAttributes> implements AdminSettingAttributes {
  id!: number;
  viewName: string;
  viewAttributes: string;
  viewLabel: string;
  createTimestamp?: Date;
  modifyTimestamp?: Date;


  static initModel(sequelize: Sequelize.Sequelize): typeof AdminSettings {
    AdminSettings.init({
    id: {
      autoIncrement: true,
      type: DataTypes.INTEGER,
      allowNull: false,
      primaryKey: true
    },
    viewName: {
      type: DataTypes.STRING(128),
      allowNull: false
    },
    viewAttributes: {
      type: DataTypes.JSON,
      allowNull: false
    },
    viewLabel: {
        type: DataTypes.STRING(128),
        allowNull: false
      },
    createTimestamp: {
      type: DataTypes.DATE,
      allowNull: true,
      defaultValue: Sequelize.Sequelize.fn('current_timestamp')
    },
    modifyTimestamp: {
      type: DataTypes.DATE,
      allowNull: true,
      defaultValue: Sequelize.Sequelize.fn('current_timestamp')
    }
  }, {
    sequelize,
    tableName: 'admin_settings',
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
        name: "asdfsddf",
        using: "BTREE",
        fields: [
          { name: "cwid" },
        ]
      },
    ]
  });
  return AdminSettings;
  }
}
