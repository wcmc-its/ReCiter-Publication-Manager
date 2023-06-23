import * as Sequelize from 'sequelize';
import { DataTypes, Model, Optional } from 'sequelize';

export interface AnalysisRcrAttributes {
  id: number;
  pmid?: number;
  year?: number;
  is_research_article?: string;
  is_clinical?: string;
  relative_citation_ratio?: number;
  nih_percentile?: number;
  citation_count?: number;
  citations_per_year?: number;
  expected_citations_per_year?: number;
  field_citation_rate?: number;
  provisional?: string;
  doi?: string;
  human?: number;
  animal?: number;
  molecular_cellular?: number;
  apt?: number;
  x_coord?: number;
  y_coord?: number;
}

export type AnalysisRcrPk = "id";
export type AnalysisRcrId = AnalysisRcr[AnalysisRcrPk];
export type AnalysisRcrOptionalAttributes = "id" | "pmid" | "year" | "is_research_article" | "is_clinical" | "relative_citation_ratio" | "nih_percentile" | "citation_count" | "citations_per_year" | "expected_citations_per_year" | "field_citation_rate" | "provisional" | "doi" | "human" | "animal" | "molecular_cellular" | "apt" | "x_coord" | "y_coord";
export type AnalysisRcrCreationAttributes = Optional<AnalysisRcrAttributes, AnalysisRcrOptionalAttributes>;

export class AnalysisRcr extends Model<AnalysisRcrAttributes, AnalysisRcrCreationAttributes> implements AnalysisRcrAttributes {
  id!: number;
  pmid?: number;
  year?: number;
  is_research_article?: string;
  is_clinical?: string;
  relative_citation_ratio?: number;
  nih_percentile?: number;
  citation_count?: number;
  citations_per_year?: number;
  expected_citations_per_year?: number;
  field_citation_rate?: number;
  provisional?: string;
  doi?: string;
  human?: number;
  animal?: number;
  molecular_cellular?: number;
  apt?: number;
  x_coord?: number;
  y_coord?: number;


  static initModel(sequelize: Sequelize.Sequelize): typeof AnalysisRcr {
    AnalysisRcr.init({
    id: {
      autoIncrement: true,
      type: DataTypes.INTEGER,
      allowNull: false,
      primaryKey: true
    },
    pmid: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: 0
    },
    year: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    is_research_article: {
      type: DataTypes.STRING(11),
      allowNull: true
    },
    is_clinical: {
      type: DataTypes.STRING(11),
      allowNull: true
    },
    relative_citation_ratio: {
      type: DataTypes.FLOAT(6,2),
      allowNull: true
    },
    nih_percentile: {
      type: DataTypes.FLOAT(5,2),
      allowNull: true
    },
    citation_count: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    citations_per_year: {
      type: DataTypes.FLOAT(7,3),
      allowNull: true
    },
    expected_citations_per_year: {
      type: DataTypes.FLOAT(7,3),
      allowNull: true
    },
    field_citation_rate: {
      type: DataTypes.FLOAT(7,3),
      allowNull: true
    },
    provisional: {
      type: DataTypes.STRING(12),
      allowNull: true
    },
    doi: {
      type: DataTypes.STRING(150),
      allowNull: true
    },
    human: {
      type: DataTypes.FLOAT(4,2),
      allowNull: true
    },
    animal: {
      type: DataTypes.FLOAT(4,2),
      allowNull: true
    },
    molecular_cellular: {
      type: DataTypes.FLOAT(4,2),
      allowNull: true
    },
    apt: {
      type: DataTypes.FLOAT(4,2),
      allowNull: true
    },
    x_coord: {
      type: DataTypes.FLOAT(5,4),
      allowNull: true
    },
    y_coord: {
      type: DataTypes.FLOAT(5,4),
      allowNull: true
    }
  }, {
    sequelize,
    tableName: 'analysis_rcr',
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
          { name: "pmid" },
        ]
      },
    ]
  });
  return AnalysisRcr;
  }
}
