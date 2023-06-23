import * as Sequelize from 'sequelize';
import { DataTypes, Model, Optional } from 'sequelize';

export interface AnalysisTempArticleAttributes {
  id: number;
  pmid?: number;
  position?: string;
}

export type AnalysisTempArticlePk = "id";
export type AnalysisTempArticleId = AnalysisTempArticle[AnalysisTempArticlePk];
export type AnalysisTempArticleOptionalAttributes = "id" | "pmid" | "position";
export type AnalysisTempArticleCreationAttributes = Optional<AnalysisTempArticleAttributes, AnalysisTempArticleOptionalAttributes>;

export class AnalysisTempArticle extends Model<AnalysisTempArticleAttributes, AnalysisTempArticleCreationAttributes> implements AnalysisTempArticleAttributes {
  id!: number;
  pmid?: number;
  position?: string;


  static initModel(sequelize: Sequelize.Sequelize): typeof AnalysisTempArticle {
    AnalysisTempArticle.init({
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
    position: {
      type: DataTypes.STRING(20),
      allowNull: true
    }
  }, {
    sequelize,
    tableName: 'analysis_temp_article',
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
          { name: "pmid" },
        ]
      },
    ]
  });
  return AnalysisTempArticle;
  }
}
