import * as Sequelize from 'sequelize';
import { DataTypes, Model, Optional } from 'sequelize';

export interface PersonArticleGrantAttributes {
  id: number;
  personIdentifier?: string;
  pmid?: number;
  articleGrant?: string;
  grantMatchScore?: number;
  institutionGrant?: string;
}

export type PersonArticleGrantPk = "id";
export type PersonArticleGrantId = PersonArticleGrant[PersonArticleGrantPk];
export type PersonArticleGrantOptionalAttributes = "id" | "personIdentifier" | "pmid" | "articleGrant" | "grantMatchScore" | "institutionGrant";
export type PersonArticleGrantCreationAttributes = Optional<PersonArticleGrantAttributes, PersonArticleGrantOptionalAttributes>;

export class PersonArticleGrant extends Model<PersonArticleGrantAttributes, PersonArticleGrantCreationAttributes> implements PersonArticleGrantAttributes {
  id!: number;
  personIdentifier?: string;
  pmid?: number;
  articleGrant?: string;
  grantMatchScore?: number;
  institutionGrant?: string;


  static initModel(sequelize: Sequelize.Sequelize): typeof PersonArticleGrant {
    PersonArticleGrant.init({
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
    articleGrant: {
      type: DataTypes.STRING(128),
      allowNull: true
    },
    grantMatchScore: {
      type: DataTypes.FLOAT,
      allowNull: true,
      defaultValue: 0
    },
    institutionGrant: {
      type: DataTypes.STRING(128),
      allowNull: true
    }
  }, {
    sequelize,
    tableName: 'person_article_grant',
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
    ]
  });
  return PersonArticleGrant;
  }
}
