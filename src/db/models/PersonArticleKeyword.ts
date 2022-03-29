import * as Sequelize from 'sequelize';
import { DataTypes, Model, Optional } from 'sequelize';

export interface PersonArticleKeywordAttributes {
  id: number;
  personIdentifier?: string;
  pmid?: number;
  keyword?: string;
}

export type PersonArticleKeywordPk = "id";
export type PersonArticleKeywordId = PersonArticleKeyword[PersonArticleKeywordPk];
export type PersonArticleKeywordOptionalAttributes = "id" | "personIdentifier" | "pmid" | "keyword";
export type PersonArticleKeywordCreationAttributes = Optional<PersonArticleKeywordAttributes, PersonArticleKeywordOptionalAttributes>;

export class PersonArticleKeyword extends Model<PersonArticleKeywordAttributes, PersonArticleKeywordCreationAttributes> implements PersonArticleKeywordAttributes {
  id!: number;
  personIdentifier?: string;
  pmid?: number;
  keyword?: string;


  static initModel(sequelize: Sequelize.Sequelize): typeof PersonArticleKeyword {
    PersonArticleKeyword.init({
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
    keyword: {
      type: DataTypes.STRING(128),
      allowNull: true
    }
  }, {
    sequelize,
    tableName: 'personArticleKeyword',
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
        name: "sdfsdfsdf",
        using: "BTREE",
        fields: [
          { name: "personIdentifier" },
          { name: "pmid" },
        ]
      },
    ]
  });
  return PersonArticleKeyword;
  }
}
