import * as Sequelize from 'sequelize';
import { DataTypes, Model, Optional } from 'sequelize';

export interface PersonArticleRelationshipAttributes {
  id: number;
  personIdentifier?: string;
  pmid?: number;
  relationshipNameArticleFirstName?: string;
  relationshipNameArticleLastName?: string;
  relationshipNameIdentityFirstName?: string;
  relationshipNameIdentityLastName?: string;
  relationshipType?: string;
  relationshipMatchType?: string;
  relationshipMatchingScore?: number;
  relationshipVerboseMatchModifierScore?: number;
  relationshipMatchModifierMentor?: number;
  relationshipMatchModifierMentorSeniorAuthor?: number;
  relationshipMatchModifierManager?: number;
  relationshipMatchModifierManagerSeniorAuthor?: number;
}

export type PersonArticleRelationshipPk = "id";
export type PersonArticleRelationshipId = PersonArticleRelationship[PersonArticleRelationshipPk];
export type PersonArticleRelationshipOptionalAttributes = "id" | "personIdentifier" | "pmid" | "relationshipNameArticleFirstName" | "relationshipNameArticleLastName" | "relationshipNameIdentityFirstName" | "relationshipNameIdentityLastName" | "relationshipType" | "relationshipMatchType" | "relationshipMatchingScore" | "relationshipVerboseMatchModifierScore" | "relationshipMatchModifierMentor" | "relationshipMatchModifierMentorSeniorAuthor" | "relationshipMatchModifierManager" | "relationshipMatchModifierManagerSeniorAuthor";
export type PersonArticleRelationshipCreationAttributes = Optional<PersonArticleRelationshipAttributes, PersonArticleRelationshipOptionalAttributes>;

export class PersonArticleRelationship extends Model<PersonArticleRelationshipAttributes, PersonArticleRelationshipCreationAttributes> implements PersonArticleRelationshipAttributes {
  id!: number;
  personIdentifier?: string;
  pmid?: number;
  relationshipNameArticleFirstName?: string;
  relationshipNameArticleLastName?: string;
  relationshipNameIdentityFirstName?: string;
  relationshipNameIdentityLastName?: string;
  relationshipType?: string;
  relationshipMatchType?: string;
  relationshipMatchingScore?: number;
  relationshipVerboseMatchModifierScore?: number;
  relationshipMatchModifierMentor?: number;
  relationshipMatchModifierMentorSeniorAuthor?: number;
  relationshipMatchModifierManager?: number;
  relationshipMatchModifierManagerSeniorAuthor?: number;


  static initModel(sequelize: Sequelize.Sequelize): typeof PersonArticleRelationship {
    PersonArticleRelationship.init({
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
    relationshipNameArticleFirstName: {
      type: DataTypes.STRING(128),
      allowNull: true,
      defaultValue: "'NULL'"
    },
    relationshipNameArticleLastName: {
      type: DataTypes.STRING(128),
      allowNull: true,
      defaultValue: "'NULL'"
    },
    relationshipNameIdentityFirstName: {
      type: DataTypes.STRING(128),
      allowNull: true,
      defaultValue: "'NULL'"
    },
    relationshipNameIdentityLastName: {
      type: DataTypes.STRING(128),
      allowNull: true,
      defaultValue: "'NULL'"
    },
    relationshipType: {
      type: DataTypes.STRING(128),
      allowNull: true
    },
    relationshipMatchType: {
      type: DataTypes.STRING(128),
      allowNull: true
    },
    relationshipMatchingScore: {
      type: DataTypes.FLOAT,
      allowNull: true,
      defaultValue: 0
    },
    relationshipVerboseMatchModifierScore: {
      type: DataTypes.FLOAT,
      allowNull: true,
      defaultValue: 0
    },
    relationshipMatchModifierMentor: {
      type: DataTypes.FLOAT,
      allowNull: true
    },
    relationshipMatchModifierMentorSeniorAuthor: {
      type: DataTypes.FLOAT,
      allowNull: true
    },
    relationshipMatchModifierManager: {
      type: DataTypes.FLOAT,
      allowNull: true
    },
    relationshipMatchModifierManagerSeniorAuthor: {
      type: DataTypes.FLOAT,
      allowNull: true
    }
  }, {
    sequelize,
    tableName: 'personArticleRelationship',
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
  return PersonArticleRelationship;
  }
}
