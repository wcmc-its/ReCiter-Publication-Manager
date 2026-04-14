import * as Sequelize from 'sequelize';
import { DataTypes, Model, Optional } from 'sequelize';

export interface JournalImpactAlternativeAttributes {
  id: number;
  journalTitle?: string;
  issn?: string;
  eissn?: string;
  impactScore1?: number;
  impactScore2?: number;
  rank?: number;
  cites?: number;
}

export type JournalImpactAlternativePk = "id";
export type JournalImpactAlternativeId = JournalImpactAlternative[JournalImpactAlternativePk];
export type JournalImpactAlternativeOptionalAttributes = "id" | "journalTitle" | "issn" | "eissn" | "impactScore1" | "impactScore2" | "rank" | "cites";
export type JournalImpactAlternativeCreationAttributes = Optional<JournalImpactAlternativeAttributes, JournalImpactAlternativeOptionalAttributes>;

export class JournalImpactAlternative extends Model<JournalImpactAlternativeAttributes, JournalImpactAlternativeCreationAttributes> implements JournalImpactAlternativeAttributes {
  id!: number;
  journalTitle?: string;
  issn?: string;
  eissn?: string;
  impactScore1?: number;
  impactScore2?: number;
  rank?: number;
  cites?: number;


  static initModel(sequelize: Sequelize.Sequelize): typeof JournalImpactAlternative {
    JournalImpactAlternative.init({
    id: {
      autoIncrement: true,
      type: DataTypes.INTEGER,
      allowNull: false,
      primaryKey: true
    },
    journalTitle: {
      type: DataTypes.STRING(200),
      allowNull: true
    },
    issn: {
      type: DataTypes.STRING(12),
      allowNull: true
    },
    eissn: {
      type: DataTypes.STRING(12),
      allowNull: true
    },
    impactScore1: {
      type: DataTypes.FLOAT(7,3),
      allowNull: true
    },
    impactScore2: {
      type: DataTypes.FLOAT(6,5),
      allowNull: true
    },
    rank: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    cites: {
      type: DataTypes.INTEGER,
      allowNull: true
    }
  }, {
    sequelize,
    tableName: 'journalImpactAlternative',
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
        name: "idx_EISSN",
        using: "BTREE",
        fields: [
          { name: "eissn" },
        ]
      },
      {
        name: "idx_FullJournalTitle",
        using: "BTREE",
        fields: [
          { name: "journalTitle" },
        ]
      },
      {
        name: "idx_issn",
        using: "BTREE",
        fields: [
          { name: "issn" },
        ]
      },
    ]
  });
  return JournalImpactAlternative;
  }
}
