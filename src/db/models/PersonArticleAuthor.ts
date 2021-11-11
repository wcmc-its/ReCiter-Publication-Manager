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
}

export type PersonArticleAuthorPk = "id";
export type PersonArticleAuthorId = PersonArticleAuthor[PersonArticleAuthorPk];
export type PersonArticleAuthorOptionalAttributes = "id" | "personIdentifier" | "pmid" | "authorFirstName" | "authorLastName" | "targetAuthor" | "rank";
export type PersonArticleAuthorCreationAttributes = Optional<PersonArticleAuthorAttributes, PersonArticleAuthorOptionalAttributes>;

export class PersonArticleAuthor extends Model<PersonArticleAuthorAttributes, PersonArticleAuthorCreationAttributes> implements PersonArticleAuthorAttributes {
  id!: number;
  personIdentifier?: string;
  pmid?: number;
  authorFirstName?: string;
  authorLastName?: string;
  targetAuthor?: string;
  rank?: number;


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
      type: DataTypes.STRING(128),
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
    }
  }, {
    sequelize,
    tableName: 'personArticleAuthor',
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
