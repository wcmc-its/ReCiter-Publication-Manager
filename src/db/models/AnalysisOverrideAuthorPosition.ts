import * as Sequelize from 'sequelize';
import { DataTypes, Model, Optional } from 'sequelize';

export interface AnalysisOverrideAuthorPositionAttributes {
  id: number;
  personIdentifier?: string;
  pmid?: number;
  position?: string;
}

export type AnalysisOverrideAuthorPositionPk = "id";
export type AnalysisOverrideAuthorPositionId = AnalysisOverrideAuthorPosition[AnalysisOverrideAuthorPositionPk];
export type AnalysisOverrideAuthorPositionOptionalAttributes = "id" | "personIdentifier" | "pmid" | "position";
export type AnalysisOverrideAuthorPositionCreationAttributes = Optional<AnalysisOverrideAuthorPositionAttributes, AnalysisOverrideAuthorPositionOptionalAttributes>;

export class AnalysisOverrideAuthorPosition extends Model<AnalysisOverrideAuthorPositionAttributes, AnalysisOverrideAuthorPositionCreationAttributes> implements AnalysisOverrideAuthorPositionAttributes {
  id!: number;
  personIdentifier?: string;
  pmid?: number;
  position?: string;


  static initModel(sequelize: Sequelize.Sequelize): typeof AnalysisOverrideAuthorPosition {
    AnalysisOverrideAuthorPosition.init({
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
      allowNull: true
    },
    position: {
      type: DataTypes.STRING(128),
      allowNull: true
    }
  }, {
    sequelize,
    tableName: 'analysis_override_author_position',
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
        name: "idx_pmid",
        using: "BTREE",
        fields: [
          { name: "pmid" },
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
  return AnalysisOverrideAuthorPosition;
  }
}
