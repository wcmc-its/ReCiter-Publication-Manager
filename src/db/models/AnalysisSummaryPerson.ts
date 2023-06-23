import * as Sequelize from 'sequelize';
import { DataTypes, Model, Optional } from 'sequelize';

export interface AnalysisSummaryPersonAttributes {
  id: number;
  personIdentifier?: string;
  nameFirst?: string;
  nameMiddle?: string;
  nameLast?: string;
  facultyRank?: string;
  department?: string;
  hindexNIH?: number;
  h5indexNIH?: number;
  hindexScopus?: number;
  h5indexScopus?: number;
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
  hindexStatus?: number;
}

export type AnalysisSummaryPersonPk = "id";
export type AnalysisSummaryPersonId = AnalysisSummaryPerson[AnalysisSummaryPersonPk];
export type AnalysisSummaryPersonOptionalAttributes = "id" | "personIdentifier" | "nameFirst" | "nameMiddle" | "nameLast" | "facultyRank" | "department" | "hindexNIH" | "h5indexNIH" | "hindexScopus" | "h5indexScopus" | "countAll" | "countFirst" | "countSenior" | "top10PercentileAll" | "top10RankAll" | "top10DenominatorAll" | "top5PercentileAll" | "top5RankAll" | "top5DenominatorAll" | "top10PercentileFirst" | "top10RankFirst" | "top10DenominatorFirst" | "top5PercentileFirst" | "top5RankFirst" | "top5DenominatorFirst" | "top10PercentileSenior" | "top10RankSenior" | "top10DenominatorSenior" | "top5PercentileSenior" | "top5RankSenior" | "top5DenominatorSenior" | "top10PercentileFirstSenior" | "top10RankFirstSenior" | "top10DenominatorFirstSenior" | "top5PercentileFirstSenior" | "top5RankFirstSenior" | "top5DenominatorFirstSenior" | "hindexStatus";
export type AnalysisSummaryPersonCreationAttributes = Optional<AnalysisSummaryPersonAttributes, AnalysisSummaryPersonOptionalAttributes>;

export class AnalysisSummaryPerson extends Model<AnalysisSummaryPersonAttributes, AnalysisSummaryPersonCreationAttributes> implements AnalysisSummaryPersonAttributes {
  id!: number;
  personIdentifier?: string;
  nameFirst?: string;
  nameMiddle?: string;
  nameLast?: string;
  facultyRank?: string;
  department?: string;
  hindexNIH?: number;
  h5indexNIH?: number;
  hindexScopus?: number;
  h5indexScopus?: number;
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
  hindexStatus?: number;


  static initModel(sequelize: Sequelize.Sequelize): typeof AnalysisSummaryPerson {
    AnalysisSummaryPerson.init({
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
    hindexNIH: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    h5indexNIH: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    hindexScopus: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    h5indexScopus: {
      type: DataTypes.INTEGER,
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
    },
    hindexStatus: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: 0
    }
  }, {
    sequelize,
    tableName: 'analysis_summary_person',
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
        name: "idx_personIdentifier",
        using: "BTREE",
        fields: [
          { name: "personIdentifier" },
        ]
      },
    ]
  });
  return AnalysisSummaryPerson;
  }
}
