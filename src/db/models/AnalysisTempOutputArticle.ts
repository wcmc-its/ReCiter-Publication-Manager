import * as Sequelize from 'sequelize';
import { DataTypes, Model, Optional } from 'sequelize';

export interface AnalysisTempOutputArticleAttributes {
  id: number;
  pmid?: number;
  authors?: string;
  authorsRTF?: string;
  specialCharacterFixNeeded?: number;
}

export type AnalysisTempOutputArticlePk = "id";
export type AnalysisTempOutputArticleId = AnalysisTempOutputArticle[AnalysisTempOutputArticlePk];
export type AnalysisTempOutputArticleOptionalAttributes = "id" | "pmid" | "authors" | "authorsRTF" | "specialCharacterFixNeeded";
export type AnalysisTempOutputArticleCreationAttributes = Optional<AnalysisTempOutputArticleAttributes, AnalysisTempOutputArticleOptionalAttributes>;

export class AnalysisTempOutputArticle extends Model<AnalysisTempOutputArticleAttributes, AnalysisTempOutputArticleCreationAttributes> implements AnalysisTempOutputArticleAttributes {
  id!: number;
  pmid?: number;
  authors?: string;
  authorsRTF?: string;
  specialCharacterFixNeeded?: number;


  static initModel(sequelize: Sequelize.Sequelize): typeof AnalysisTempOutputArticle {
    AnalysisTempOutputArticle.init({
    id: {
      autoIncrement: true,
      type: DataTypes.INTEGER,
      allowNull: false,
      primaryKey: true
    },
    pmid: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    authors: {
      type: DataTypes.STRING(500),
      allowNull: true
    },
    authorsRTF: {
      type: DataTypes.STRING(500),
      allowNull: true
    },
    specialCharacterFixNeeded: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: 0
    }
  }, {
    sequelize,
    tableName: 'analysis_temp_output_article',
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
        name: "pmid",
        using: "BTREE",
        fields: [
          { name: "pmid" },
        ]
      },
    ]
  });
  return AnalysisTempOutputArticle;
  }
}
