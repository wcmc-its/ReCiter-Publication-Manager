import * as Sequelize from 'sequelize';
import { DataTypes, Model, Optional } from 'sequelize';

export interface PersonAttributes {
  id: number;
  personIdentifier: string;
  firstName?: string;
  middleName?: string;
  lastName?: string;
  title?: string;
  primaryOrganizationalUnit?: string;
  primaryInstitution?: string;
  dateAdded?: string;
  dateUpdated?: string;
  precision?: number;
  recall?: number;
  countSuggestedArticles?: number;
  countPendingArticles?: number;
  overallAccuracy?: number;
  mode?: string;
  primaryEmail?: String;
}

export type PersonPk = "id" | "personIdentifier";
export type PersonId = Person[PersonPk];
export type PersonOptionalAttributes = "id" | "personIdentifier" | "firstName" | "middleName" | "lastName" | "title" | "primaryOrganizationalUnit" | "primaryInstitution" | "dateAdded" | "dateUpdated" | "precision" | "recall" | "countSuggestedArticles" | "countPendingArticles" | "overallAccuracy" | "mode";
export type PersonCreationAttributes = Optional<PersonAttributes, PersonOptionalAttributes>;

export class Person extends Model<PersonAttributes, PersonCreationAttributes> implements PersonAttributes {
  id!: number;
  personIdentifier!: string;
  firstName?: string;
  middleName?: string;
  lastName?: string;
  title?: string;
  primaryOrganizationalUnit?: string;
  primaryInstitution?: string;
  dateAdded?: string;
  dateUpdated?: string;
  precision?: number;
  recall?: number;
  countSuggestedArticles?: number;
  countPendingArticles?: number;
  overallAccuracy?: number;
  mode?: string;
  primaryEmail?: String;


  static initModel(sequelize: Sequelize.Sequelize): typeof Person {
    Person.init({
    id: {
      autoIncrement: true,
      type: DataTypes.INTEGER,
      allowNull: false,
      primaryKey: true
    },
    personIdentifier: {
      type: DataTypes.STRING(128),
      allowNull: false,
      primaryKey: true
    },
    firstName: {
      type: DataTypes.STRING(128),
      allowNull: true
    },
    middleName: {
      type: DataTypes.STRING(128),
      allowNull: true
    },
    lastName: {
      type: DataTypes.STRING(128),
      allowNull: true
    },
    title: {
      type: DataTypes.STRING(200),
      allowNull: true
    },
    primaryOrganizationalUnit: {
      type: DataTypes.STRING(200),
      allowNull: true
    },
    primaryInstitution: {
      type: DataTypes.STRING(200),
      allowNull: true
    },
    dateAdded: {
      type: DataTypes.STRING(200),
      allowNull: true
    },
    dateUpdated: {
      type: DataTypes.STRING(128),
      allowNull: true
    },
    precision: {
      type: DataTypes.FLOAT,
      allowNull: true,
      defaultValue: 0
    },
    recall: {
      type: DataTypes.FLOAT,
      allowNull: true,
      defaultValue: 0
    },
    countSuggestedArticles: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: 0
    },
    countPendingArticles: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: 0
    },
    overallAccuracy: {
      type: DataTypes.FLOAT,
      allowNull: true,
      defaultValue: 0
    },
    mode: {
      type: DataTypes.STRING(128),
      allowNull: true
    },
    primaryEmail : {
      type: DataTypes.STRING(200),
      allowNull: true
    }
  }, {
    sequelize,
    tableName: 'person',
    timestamps: false,
    indexes: [
      {
        name: "PRIMARY",
        unique: true,
        using: "BTREE",
        fields: [
          { name: "id" },
          { name: "personIdentifier" },
        ]
      },
      {
        name: "id",
        using: "BTREE",
        fields: [
          { name: "id" },
        ]
      },
    ]
  });
  return Person;
  }
}
