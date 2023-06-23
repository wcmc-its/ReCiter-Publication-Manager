import * as Sequelize from 'sequelize';
import { DataTypes, Model, Optional } from 'sequelize';

export interface AnalysisRcrSummaryAttributes {
  id: number;
  personIdentifier?: string;
  nameFirst?: string;
  nameMiddle?: string;
  nameLast?: string;
  facultyRank?: string;
  department?: string;
  division?: string;
  countAll?: number;
  countFirst?: number;
  countSenior?: number;
  top10PercentileAll?: number;
  top10RankAll?: number;
  top10DenominatorAll?: number;
  top5PercentileAll?: number;
  top5RankAll?: number;
  top5DenominatorAll?: number;
  top10PercentileFirst?: number;
  top10RankFirst?: number;
  top10DenominatorFirst?: number;
  top5PercentileFirst?: number;
  top5RankFirst?: number;
  top5DenominatorFirst?: number;
  top10PercentileSenior?: number;
  top10RankSenior?: number;
  top10DenominatorSenior?: number;
  top5PercentileSenior?: number;
  top5RankSenior?: number;
  top5DenominatorSenior?: number;
  top10PercentileFirstSenior?: number;
  top10RankFirstSenior?: number;
  top10DenominatorFirstSenior?: number;
  top5PercentileFirstSenior?: number;
  top5RankFirstSenior?: number;
  top5DenominatorFirstSenior?: number;
}

export type AnalysisRcrSummaryPk = "id";
export type AnalysisRcrSummaryId = AnalysisRcrSummary[AnalysisRcrSummaryPk];
export type AnalysisRcrSummaryOptionalAttributes = "id" | "personIdentifier" | "nameFirst" | "nameMiddle" | "nameLast" | "facultyRank" | "department" | "division" | "countAll" | "countFirst" | "countSenior" | "top10PercentileAll" | "top10RankAll" | "top10DenominatorAll" | "top5PercentileAll" | "top5RankAll" | "top5DenominatorAll" | "top10PercentileFirst" | "top10RankFirst" | "top10DenominatorFirst" | "top5PercentileFirst" | "top5RankFirst" | "top5DenominatorFirst" | "top10PercentileSenior" | "top10RankSenior" | "top10DenominatorSenior" | "top5PercentileSenior" | "top5RankSenior" | "top5DenominatorSenior" | "top10PercentileFirstSenior" | "top10RankFirstSenior" | "top10DenominatorFirstSenior" | "top5PercentileFirstSenior" | "top5RankFirstSenior" | "top5DenominatorFirstSenior";
export type AnalysisRcrSummaryCreationAttributes = Optional<AnalysisRcrSummaryAttributes, AnalysisRcrSummaryOptionalAttributes>;

export class AnalysisRcrSummary extends Model<AnalysisRcrSummaryAttributes, AnalysisRcrSummaryCreationAttributes> implements AnalysisRcrSummaryAttributes {
  id!: number;
  personIdentifier?: string;
  nameFirst?: string;
  nameMiddle?: string;
  nameLast?: string;
  facultyRank?: string;
  department?: string;
  division?: string;
  countAll?: number;
  countFirst?: number;
  countSenior?: number;
  top10PercentileAll?: number;
  top10RankAll?: number;
  top10DenominatorAll?: number;
  top5PercentileAll?: number;
  top5RankAll?: number;
  top5DenominatorAll?: number;
  top10PercentileFirst?: number;
  top10RankFirst?: number;
  top10DenominatorFirst?: number;
  top5PercentileFirst?: number;
  top5RankFirst?: number;
  top5DenominatorFirst?: number;
  top10PercentileSenior?: number;
  top10RankSenior?: number;
  top10DenominatorSenior?: number;
  top5PercentileSenior?: number;
  top5RankSenior?: number;
  top5DenominatorSenior?: number;
  top10PercentileFirstSenior?: number;
  top10RankFirstSenior?: number;
  top10DenominatorFirstSenior?: number;
  top5PercentileFirstSenior?: number;
  top5RankFirstSenior?: number;
  top5DenominatorFirstSenior?: number;


  static initModel(sequelize: Sequelize.Sequelize): typeof AnalysisRcrSummary {
    AnalysisRcrSummary.init({
    id: {
      autoIncrement: true,
      type: DataTypes.INTEGER,
      allowNull: false,
      primaryKey: true
    },
    personIdentifier: {
      type: DataTypes.STRING(20),
      allowNull: true
    },
    nameFirst: {
      type: DataTypes.STRING(128),
      allowNull: true
    },
    nameMiddle: {
      type: DataTypes.STRING(128),
      allowNull: true
    },
    nameLast: {
      type: DataTypes.STRING(128),
      allowNull: true
    },
    facultyRank: {
      type: DataTypes.STRING(25),
      allowNull: true
    },
    department: {
      type: DataTypes.STRING(128),
      allowNull: true
    },
    division: {
      type: DataTypes.STRING(128),
      allowNull: true
    },
    countAll: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: 0
    },
    countFirst: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: 0
    },
    countSenior: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: 0
    },
    top10PercentileAll: {
      type: DataTypes.FLOAT(6,3),
      allowNull: true
    },
    top10RankAll: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    top10DenominatorAll: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    top5PercentileAll: {
      type: DataTypes.FLOAT(7,3),
      allowNull: true
    },
    top5RankAll: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    top5DenominatorAll: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    top10PercentileFirst: {
      type: DataTypes.FLOAT(6,3),
      allowNull: true
    },
    top10RankFirst: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    top10DenominatorFirst: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    top5PercentileFirst: {
      type: DataTypes.FLOAT(7,3),
      allowNull: true
    },
    top5RankFirst: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    top5DenominatorFirst: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    top10PercentileSenior: {
      type: DataTypes.FLOAT(6,3),
      allowNull: true
    },
    top10RankSenior: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    top10DenominatorSenior: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    top5PercentileSenior: {
      type: DataTypes.FLOAT(7,3),
      allowNull: true
    },
    top5RankSenior: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    top5DenominatorSenior: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    top10PercentileFirstSenior: {
      type: DataTypes.FLOAT(6,3),
      allowNull: true
    },
    top10RankFirstSenior: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    top10DenominatorFirstSenior: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    top5PercentileFirstSenior: {
      type: DataTypes.FLOAT(7,3),
      allowNull: true
    },
    top5RankFirstSenior: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    top5DenominatorFirstSenior: {
      type: DataTypes.INTEGER,
      allowNull: true
    }
  }, {
    sequelize,
    tableName: 'analysis_rcr_summary',
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
  return AnalysisRcrSummary;
  }
}
