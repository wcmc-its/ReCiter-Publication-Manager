import * as Sequelize from 'sequelize';
import { DataTypes, Model, Optional } from 'sequelize';

export interface PersonArticleScopusNonTargetAuthorAffiliationAttributes {
  id: number;
  personIdentifier?: string;
  pmid?: number;
  nonTargetAuthorInstitutionLabel?: string;
  nonTargetAuthorInstitutionID?: string;
  nonTargetAuthorInstitutionCount?: number;
}

export type PersonArticleScopusNonTargetAuthorAffiliationPk = "id";
export type PersonArticleScopusNonTargetAuthorAffiliationId = PersonArticleScopusNonTargetAuthorAffiliation[PersonArticleScopusNonTargetAuthorAffiliationPk];
export type PersonArticleScopusNonTargetAuthorAffiliationOptionalAttributes = "id" | "personIdentifier" | "pmid" | "nonTargetAuthorInstitutionLabel" | "nonTargetAuthorInstitutionID" | "nonTargetAuthorInstitutionCount";
export type PersonArticleScopusNonTargetAuthorAffiliationCreationAttributes = Optional<PersonArticleScopusNonTargetAuthorAffiliationAttributes, PersonArticleScopusNonTargetAuthorAffiliationOptionalAttributes>;

export class PersonArticleScopusNonTargetAuthorAffiliation extends Model<PersonArticleScopusNonTargetAuthorAffiliationAttributes, PersonArticleScopusNonTargetAuthorAffiliationCreationAttributes> implements PersonArticleScopusNonTargetAuthorAffiliationAttributes {
  id!: number;
  personIdentifier?: string;
  pmid?: number;
  nonTargetAuthorInstitutionLabel?: string;
  nonTargetAuthorInstitutionID?: string;
  nonTargetAuthorInstitutionCount?: number;


  static initModel(sequelize: Sequelize.Sequelize): typeof PersonArticleScopusNonTargetAuthorAffiliation {
    PersonArticleScopusNonTargetAuthorAffiliation.init({
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
      allowNull: true
    },
    nonTargetAuthorInstitutionLabel: {
      type: DataTypes.STRING(128),
      allowNull: true,
      defaultValue: "NULL"
    },
    nonTargetAuthorInstitutionID: {
      type: DataTypes.STRING(128),
      allowNull: true,
      defaultValue: "NULL"
    },
    nonTargetAuthorInstitutionCount: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: 0
    }
  }, {
    sequelize,
    tableName: 'person_article_scopus_non_target_atuthor_affiliation',
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
  return PersonArticleScopusNonTargetAuthorAffiliation;
  }
}
