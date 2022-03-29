import * as Sequelize from 'sequelize';
import { DataTypes, Model, Optional } from 'sequelize';

export interface AnalysisTempOutputAuthorAttributes {
  id: number;
  personIdentifier?: string;
  pmid?: number;
}

export type AnalysisTempOutputAuthorPk = "id";
export type AnalysisTempOutputAuthorId = AnalysisTempOutputAuthor[AnalysisTempOutputAuthorPk];
export type AnalysisTempOutputAuthorOptionalAttributes = "id" | "personIdentifier" | "pmid";
export type AnalysisTempOutputAuthorCreationAttributes = Optional<AnalysisTempOutputAuthorAttributes, AnalysisTempOutputAuthorOptionalAttributes>;

export class AnalysisTempOutputAuthor extends Model<AnalysisTempOutputAuthorAttributes, AnalysisTempOutputAuthorCreationAttributes> implements AnalysisTempOutputAuthorAttributes {
  id!: number;
  personIdentifier?: string;
  pmid?: number;


  static initModel(sequelize: Sequelize.Sequelize): typeof AnalysisTempOutputAuthor {
    AnalysisTempOutputAuthor.init({
    id: {
      autoIncrement: true,
      type: DataTypes.INTEGER,
      allowNull: false,
      primaryKey: true
    },
    personIdentifier: {
      type: DataTypes.STRING(50),
      allowNull: true,
      defaultValue: "0"
    },
    pmid: {
      type: DataTypes.INTEGER,
      allowNull: true
    }
  }, {
    sequelize,
    tableName: 'analysis_temp_output_author',
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
        name: "pmid",
        using: "BTREE",
        fields: [
          { name: "pmid" },
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
  return AnalysisTempOutputAuthor;
  }
}
