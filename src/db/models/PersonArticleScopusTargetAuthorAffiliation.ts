import * as Sequelize from 'sequelize';
import { DataTypes, Model, Optional } from 'sequelize';

export interface PersonArticleScopusTargetAuthorAffiliationAttributes {
  id: number;
  personIdentifier?: string;
  pmid?: number;
  targetAuthorInstitutionalAffiliationSource?: string;
  scopusTargetAuthorInstitutionalAffiliationIdentity?: string;
  targetAuthorInstitutionalAffiliationArticleScopusLabel?: string;
  targetAuthorInstitutionalAffiliationArticleScopusAffiliationId?: string;
  targetAuthorInstitutionalAffiliationMatchType?: string;
  targetAuthorInstitutionalAffiliationMatchTypeScore?: number;
}

export type PersonArticleScopusTargetAuthorAffiliationPk = "id";
export type PersonArticleScopusTargetAuthorAffiliationId = PersonArticleScopusTargetAuthorAffiliation[PersonArticleScopusTargetAuthorAffiliationPk];
export type PersonArticleScopusTargetAuthorAffiliationOptionalAttributes = "id" | "personIdentifier" | "pmid" | "targetAuthorInstitutionalAffiliationSource" | "scopusTargetAuthorInstitutionalAffiliationIdentity" | "targetAuthorInstitutionalAffiliationArticleScopusLabel" | "targetAuthorInstitutionalAffiliationArticleScopusAffiliationId" | "targetAuthorInstitutionalAffiliationMatchType" | "targetAuthorInstitutionalAffiliationMatchTypeScore";
export type PersonArticleScopusTargetAuthorAffiliationCreationAttributes = Optional<PersonArticleScopusTargetAuthorAffiliationAttributes, PersonArticleScopusTargetAuthorAffiliationOptionalAttributes>;

export class PersonArticleScopusTargetAuthorAffiliation extends Model<PersonArticleScopusTargetAuthorAffiliationAttributes, PersonArticleScopusTargetAuthorAffiliationCreationAttributes> implements PersonArticleScopusTargetAuthorAffiliationAttributes {
  id!: number;
  personIdentifier?: string;
  pmid?: number;
  targetAuthorInstitutionalAffiliationSource?: string;
  scopusTargetAuthorInstitutionalAffiliationIdentity?: string;
  targetAuthorInstitutionalAffiliationArticleScopusLabel?: string;
  targetAuthorInstitutionalAffiliationArticleScopusAffiliationId?: string;
  targetAuthorInstitutionalAffiliationMatchType?: string;
  targetAuthorInstitutionalAffiliationMatchTypeScore?: number;


  static initModel(sequelize: Sequelize.Sequelize): typeof PersonArticleScopusTargetAuthorAffiliation {
    PersonArticleScopusTargetAuthorAffiliation.init({
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
    targetAuthorInstitutionalAffiliationSource: {
      type: DataTypes.STRING(128),
      allowNull: true,
      defaultValue: "NULL"
    },
    scopusTargetAuthorInstitutionalAffiliationIdentity: {
      type: DataTypes.STRING(128),
      allowNull: true
    },
    targetAuthorInstitutionalAffiliationArticleScopusLabel: {
      type: DataTypes.STRING(2000),
      allowNull: true,
      defaultValue: "'NULL'"
    },
    targetAuthorInstitutionalAffiliationArticleScopusAffiliationId: {
      type: DataTypes.STRING(128),
      allowNull: true,
      defaultValue: "NULL"
    },
    targetAuthorInstitutionalAffiliationMatchType: {
      type: DataTypes.STRING(128),
      allowNull: true
    },
    targetAuthorInstitutionalAffiliationMatchTypeScore: {
      type: DataTypes.FLOAT,
      allowNull: true,
      defaultValue: 0
    }
  }, {
    sequelize,
    tableName: 'personArticleScopusTargetAuthorAffiliation',
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
  return PersonArticleScopusTargetAuthorAffiliation;
  }
}
