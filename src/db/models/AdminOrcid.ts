import * as Sequelize from 'sequelize';
import { DataTypes, Model, Optional } from 'sequelize';
import type { AdminUser, AdminUserId } from './AdminUser';

export interface AdminOrcidAttributes {
  id: number;
  personIdentifier :String;
  orcid :String;
  // createTimestamp: Date;
  // modifyTimestamp: Date;
}

export type AdminOrcidPk = "personIdentifier";
export type AdminOrcidId = AdminOrcid[AdminOrcidPk];
export type AdminOrcidOptionalAttributes = "id" | "personIdentifier" | "orcid";
export type AdminOrcidCreationAttributes = Optional<AdminOrcidAttributes,AdminOrcidOptionalAttributes>;

export class AdminOrcid extends Model<AdminOrcidAttributes, AdminOrcidCreationAttributes> implements AdminOrcidAttributes {
  id!: number;
  personIdentifier:string; 
  orcid :String;
  // createTimestamp!: Date;
  // modifyTimestamp!: Date;

  // AdminNotificationPreference belongsTo AdminUser via userID
  user!: AdminUser;
  getUser!: Sequelize.BelongsToGetAssociationMixin<AdminUser>;
  setUser!: Sequelize.BelongsToSetAssociationMixin<AdminUser, AdminUserId>;
  createUser!: Sequelize.BelongsToCreateAssociationMixin<AdminUser>;

  static initModel(sequelize: Sequelize.Sequelize): typeof AdminOrcid {
    AdminOrcid.init({
    id: {
      autoIncrement: true,
      type: DataTypes.INTEGER,
      allowNull: false,
      primaryKey: true
    },
    personIdentifier: {
       type : DataTypes.STRING,
       allowNull:false,
       primaryKey: true
    },
    orcid: {
        type : DataTypes.STRING,
        allowNull:false,
        primaryKey: true
     },
    // createTimestamp: {
    //   type: DataTypes.DATE,
    //   allowNull: false,
    //   defaultValue: "0000-00-00 00:00:00"
    // },
    // modifyTimestamp: {
    //   type: DataTypes.DATE,
    //   allowNull: false,
    //   defaultValue: Sequelize.Sequelize.fn('current_timestamp')
    // }
  }, {
    sequelize,
    tableName: 'admin_orcid',
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
        name: "admin_orcid_ibfk_1",
        using: "BTREE",
        fields: [
          { name: "personIdentifier" },
        ]
      },
    ]
  });
  return AdminOrcid;
  }
}
