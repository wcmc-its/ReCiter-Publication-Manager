import * as Sequelize from 'sequelize';
import { DataTypes, Model, Optional } from 'sequelize';

export interface AnalysisSummaryAuthorAttributes {
  id: number;
  personIdentifier?: string;
  pmid?: number;
  authors?: string;
  authorsRTF?: string;
  authorPosition?: string;
}

export type AnalysisSummaryAuthorPk = "id";
export type AnalysisSummaryAuthorId = AnalysisSummaryAuthor[AnalysisSummaryAuthorPk];
export type AnalysisSummaryAuthorOptionalAttributes = "id" | "personIdentifier" | "pmid" | "authors" | "authorsRTF" | "authorPosition";
export type AnalysisSummaryAuthorCreationAttributes = Optional<AnalysisSummaryAuthorAttributes, AnalysisSummaryAuthorOptionalAttributes>;

export class AnalysisSummaryAuthor extends Model<AnalysisSummaryAuthorAttributes, AnalysisSummaryAuthorCreationAttributes> implements AnalysisSummaryAuthorAttributes {
  id!: number;
  personIdentifier?: string;
  pmid?: number;
  authors?: string;
  authorsRTF?: string;
  authorPosition?: string;


  static initModel(sequelize: Sequelize.Sequelize): typeof AnalysisSummaryAuthor {
    AnalysisSummaryAuthor.init({
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
    authors: {
      type: DataTypes.STRING(1000),
      allowNull: true
    },
    authorsRTF: {
      type: DataTypes.STRING(1000),
      allowNull: true
    },
    authorPosition: {
      type: DataTypes.STRING(20),
      allowNull: true
    }
  }, {
    sequelize,
    tableName: 'analysis_summary_author',
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
        name: "z",
        using: "BTREE",
        fields: [
          { name: "pmid" },
        ]
      },
      {
        name: "y",
        using: "BTREE",
        fields: [
          { name: "personIdentifier" },
        ]
      },
    ]
  });
  return AnalysisSummaryAuthor;
  }
}
