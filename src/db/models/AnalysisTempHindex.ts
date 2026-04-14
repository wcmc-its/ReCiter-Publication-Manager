import * as Sequelize from 'sequelize';
import { DataTypes, Model, Optional } from 'sequelize';

export interface AnalysisTempHindexAttributes {
  id: number;
  personIdentifier?: string;
  citation_count?: number;
}

export type AnalysisTempHindexPk = "id";
export type AnalysisTempHindexId = AnalysisTempHindex[AnalysisTempHindexPk];
export type AnalysisTempHindexOptionalAttributes = "id" | "personIdentifier" | "citation_count";
export type AnalysisTempHindexCreationAttributes = Optional<AnalysisTempHindexAttributes, AnalysisTempHindexOptionalAttributes>;

export class AnalysisTempHindex extends Model<AnalysisTempHindexAttributes, AnalysisTempHindexCreationAttributes> implements AnalysisTempHindexAttributes {
  id!: number;
  personIdentifier?: string;
  citation_count?: number;


  static initModel(sequelize: Sequelize.Sequelize): typeof AnalysisTempHindex {
    AnalysisTempHindex.init({
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
    citation_count: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: 0
    }
  }, {
    sequelize,
    tableName: 'analysis_temp_hindex',
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
          { name: "personIdentifier" },
        ]
      },
    ]
  });
  return AnalysisTempHindex;
  }
}
