import * as Sequelize from 'sequelize';
import { DataTypes, Model, Optional } from 'sequelize';

export interface PersonArticleDepartmentAttributes {
  id: number;
  personIdentifier?: string;
  pmid?: number;
  identityOrganizationalUnit?: string;
  articleAffiliation?: string;
  organizationalUnitType?: string;
  organizationalUnitMatchingScore?: number;
  organizationalUnitModifier?: string;
  organizationalUnitModifierScore?: number;
}

export type PersonArticleDepartmentPk = "id";
export type PersonArticleDepartmentId = PersonArticleDepartment[PersonArticleDepartmentPk];
export type PersonArticleDepartmentOptionalAttributes = "id" | "personIdentifier" | "pmid" | "identityOrganizationalUnit" | "articleAffiliation" | "organizationalUnitType" | "organizationalUnitMatchingScore" | "organizationalUnitModifier" | "organizationalUnitModifierScore";
export type PersonArticleDepartmentCreationAttributes = Optional<PersonArticleDepartmentAttributes, PersonArticleDepartmentOptionalAttributes>;

export class PersonArticleDepartment extends Model<PersonArticleDepartmentAttributes, PersonArticleDepartmentCreationAttributes> implements PersonArticleDepartmentAttributes {
  id!: number;
  personIdentifier?: string;
  pmid?: number;
  identityOrganizationalUnit?: string;
  articleAffiliation?: string;
  organizationalUnitType?: string;
  organizationalUnitMatchingScore?: number;
  organizationalUnitModifier?: string;
  organizationalUnitModifierScore?: number;


  static initModel(sequelize: Sequelize.Sequelize): typeof PersonArticleDepartment {
    PersonArticleDepartment.init({
    id: {
      autoIncrement: true,
      type: DataTypes.INTEGER,
      allowNull: false,
      primaryKey: true
    },
    personIdentifier: {
      type: DataTypes.STRING(128),
      allowNull: true
    },
    pmid: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: 0
    },
    identityOrganizationalUnit: {
      type: DataTypes.STRING(128),
      allowNull: true
    },
    articleAffiliation: {
      type: DataTypes.STRING(10000),
      allowNull: true,
      defaultValue: "NULL"
    },
    organizationalUnitType: {
      type: DataTypes.STRING(128),
      allowNull: true
    },
    organizationalUnitMatchingScore: {
      type: DataTypes.FLOAT,
      allowNull: true,
      defaultValue: 0
    },
    organizationalUnitModifier: {
      type: DataTypes.STRING(128),
      allowNull: true
    },
    organizationalUnitModifierScore: {
      type: DataTypes.FLOAT,
      allowNull: true,
      defaultValue: 0
    }
  }, {
    sequelize,
    tableName: 'person_article_department',
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
        name: "personIdentifier",
        using: "BTREE",
        fields: [
          { name: "personIdentifier" },
          { name: "pmid" },
        ]
      },
    ]
  });
  return PersonArticleDepartment;
  }
}
