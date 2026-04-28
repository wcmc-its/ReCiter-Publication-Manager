import * as Sequelize from 'sequelize';
import { DataTypes, Model, Optional } from 'sequelize';

export interface AnalysisRcrYearAttributes {
  id: number;
  personIdentifier?: string;
  year: number;
  aggregateRCR?: number;
  personLabel?: string;
}

export type AnalysisRcrYearPk = "id";
export type AnalysisRcrYearId = AnalysisRcrYear[AnalysisRcrYearPk];
export type AnalysisRcrYearOptionalAttributes = "id" | "personIdentifier" | "year" | "aggregateRCR" | "personLabel";
export type AnalysisRcrYearCreationAttributes = Optional<AnalysisRcrYearAttributes, AnalysisRcrYearOptionalAttributes>;

export class AnalysisRcrYear extends Model<AnalysisRcrYearAttributes, AnalysisRcrYearCreationAttributes> implements AnalysisRcrYearAttributes {
  id!: number;
  personIdentifier?: string;
  year!: number;
  aggregateRCR?: number;
  personLabel?: string;


  static initModel(sequelize: Sequelize.Sequelize): typeof AnalysisRcrYear {
    AnalysisRcrYear.init({
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
    year: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0
    },
    aggregateRCR: {
      type: DataTypes.FLOAT(5,2),
      allowNull: true,
      defaultValue: 0.00
    },
    personLabel: {
      type: DataTypes.STRING(128),
      allowNull: true
    }
  }, {
    sequelize,
    tableName: 'analysis_rcr_year',
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
      {
        name: "idx_year",
        using: "BTREE",
        fields: [
          { name: "year" },
        ]
      },
    ]
  });
  return AnalysisRcrYear;
  }
}
