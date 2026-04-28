import * as Sequelize from 'sequelize';
import { DataTypes, Model, Optional } from 'sequelize';

export interface PersonArticleAuthorAttributes {
  id: number;
  personIdentifier?: string;
  pmid?: number;
  authorFirstName?: string;
  authorLastName?: string;
  targetAuthor?: string;
  rank?: number;
  orcid?: string;
}

export type PersonArticleAuthorPk = "id";
export type PersonArticleAuthorId = PersonArticleAuthor[PersonArticleAuthorPk];
export type PersonArticleAuthorOptionalAttributes = "id" | "personIdentifier" | "pmid" | "authorFirstName" | "authorLastName" | "targetAuthor" | "rank" | "orcid";
export type PersonArticleAuthorCreationAttributes = Optional<PersonArticleAuthorAttributes, PersonArticleAuthorOptionalAttributes>;

export class PersonArticleAuthor extends Model<PersonArticleAuthorAttributes, PersonArticleAuthorCreationAttributes> implements PersonArticleAuthorAttributes {
  id!: number;
  personIdentifier?: string;
  pmid?: number;
  authorFirstName?: string;
  authorLastName?: string;
  targetAuthor?: string;
  rank?: number;
  orcid?: string;


  static initModel(sequelize: Sequelize.Sequelize): typeof PersonArticleAuthor {
    PersonArticleAuthor.init({
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
    authorFirstName: {
      type: DataTypes.STRING(128),
      allowNull: true,
      defaultValue: "'NULL'"
    },
    authorLastName: {
      type: DataTypes.STRING(150),
      allowNull: true,
      defaultValue: "'NULL'"
    },
    targetAuthor: {
      type: DataTypes.STRING(128),
      allowNull: true,
      defaultValue: "'NULL'"
    },
    rank: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: 0
    },
    orcid: {
      type: DataTypes.STRING(50),
      allowNull: true
    }
  }, {
    sequelize,
    tableName: 'person_article_author',
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
  return PersonArticleAuthor;
  }
}
