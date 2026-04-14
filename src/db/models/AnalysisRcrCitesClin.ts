import * as Sequelize from 'sequelize';
import { DataTypes, Model, Optional } from 'sequelize';

export interface AnalysisRcrCitesClinAttributes {
  id: number;
  citing_pmid?: number;
  cited_pmid?: number;
}

export type AnalysisRcrCitesClinPk = "id";
export type AnalysisRcrCitesClinId = AnalysisRcrCitesClin[AnalysisRcrCitesClinPk];
export type AnalysisRcrCitesClinOptionalAttributes = "id" | "citing_pmid" | "cited_pmid";
export type AnalysisRcrCitesClinCreationAttributes = Optional<AnalysisRcrCitesClinAttributes, AnalysisRcrCitesClinOptionalAttributes>;

export class AnalysisRcrCitesClin extends Model<AnalysisRcrCitesClinAttributes, AnalysisRcrCitesClinCreationAttributes> implements AnalysisRcrCitesClinAttributes {
  id!: number;
  citing_pmid?: number;
  cited_pmid?: number;


  static initModel(sequelize: Sequelize.Sequelize): typeof AnalysisRcrCitesClin {
    AnalysisRcrCitesClin.init({
    id: {
      autoIncrement: true,
      type: DataTypes.INTEGER,
      allowNull: false,
      primaryKey: true
    },
    citing_pmid: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: 0
    },
    cited_pmid: {
      type: DataTypes.INTEGER,
      allowNull: true
    }
  }, {
    sequelize,
    tableName: 'analysis_rcr_cites_clin',
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
        name: "y",
        using: "BTREE",
        fields: [
          { name: "cited_pmid" },
        ]
      },
      {
        name: "x",
        using: "BTREE",
        fields: [
          { name: "citing_pmid" },
        ]
      },
    ]
  });
  return AnalysisRcrCitesClin;
  }
}
