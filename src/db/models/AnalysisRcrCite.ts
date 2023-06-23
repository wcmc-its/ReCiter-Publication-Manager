import * as Sequelize from 'sequelize';
import { DataTypes, Model, Optional } from 'sequelize';

export interface AnalysisRcrCiteAttributes {
  id: number;
  citing_pmid?: number;
  cited_pmid?: number;
}

export type AnalysisRcrCitePk = "id";
export type AnalysisRcrCiteId = AnalysisRcrCite[AnalysisRcrCitePk];
export type AnalysisRcrCiteOptionalAttributes = "id" | "citing_pmid" | "cited_pmid";
export type AnalysisRcrCiteCreationAttributes = Optional<AnalysisRcrCiteAttributes, AnalysisRcrCiteOptionalAttributes>;

export class AnalysisRcrCite extends Model<AnalysisRcrCiteAttributes, AnalysisRcrCiteCreationAttributes> implements AnalysisRcrCiteAttributes {
  id!: number;
  citing_pmid?: number;
  cited_pmid?: number;


  static initModel(sequelize: Sequelize.Sequelize): typeof AnalysisRcrCite {
    AnalysisRcrCite.init({
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
    tableName: 'analysis_rcr_cites',
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
  return AnalysisRcrCite;
  }
}
