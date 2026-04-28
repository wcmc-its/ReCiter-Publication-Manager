import * as Sequelize from 'sequelize';
import { DataTypes, Model, Optional } from 'sequelize';

export interface AnalysisSummaryAuthorListAttributes {
  id: number;
  pmid?: number;
  authorLastName?: string;
  authorFirstName?: string;
  rank?: number;
  personIdentifier?: string;
}

export type AnalysisSummaryAuthorListPk = "id";
export type AnalysisSummaryAuthorListId = AnalysisSummaryAuthorList[AnalysisSummaryAuthorListPk];
export type AnalysisSummaryAuthorListOptionalAttributes = "id" | "pmid" | "authorLastName" | "authorFirstName" | "rank" | "personIdentifier";
export type AnalysisSummaryAuthorListCreationAttributes = Optional<AnalysisSummaryAuthorListAttributes, AnalysisSummaryAuthorListOptionalAttributes>;

export class AnalysisSummaryAuthorList extends Model<AnalysisSummaryAuthorListAttributes, AnalysisSummaryAuthorListCreationAttributes> implements AnalysisSummaryAuthorListAttributes {
  id!: number;
  pmid?: number;
  authorLastName?: string;
  authorFirstName?: string;
  rank?: number;
  personIdentifier?: string;


  static initModel(sequelize: Sequelize.Sequelize): typeof AnalysisSummaryAuthorList {
    AnalysisSummaryAuthorList.init({
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
    authorLastName: {
      type: DataTypes.STRING(200),
      allowNull: true
    },
    authorFirstName: {
      type: DataTypes.STRING(200),
      allowNull: true
    },
    rank: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    personIdentifier: {
      type: DataTypes.STRING(128),
      allowNull: true
    }
  }, {
    sequelize,
    tableName: 'analysis_summary_author_list',
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
  return AnalysisSummaryAuthorList;
  }
}
