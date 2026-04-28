import * as Sequelize from 'sequelize';
import { DataTypes, Model, Optional } from 'sequelize';

export interface NlmAttributes {
  nlmabbreviation?: string;
  nlmfulltitle?: string;
  nlmissn?: string;
  nlmeissn?: string;
  nlmisoabbreviation?: string;
  nlmcatalog: string;
}

export type NlmPk = "nlmcatalog";
export type NlmId = Nlm[NlmPk];
export type NlmOptionalAttributes = "nlmabbreviation" | "nlmfulltitle" | "nlmissn" | "nlmeissn" | "nlmisoabbreviation" | "nlmcatalog";
export type NlmCreationAttributes = Optional<NlmAttributes, NlmOptionalAttributes>;

export class Nlm extends Model<NlmAttributes, NlmCreationAttributes> implements NlmAttributes {
  nlmabbreviation?: string;
  nlmfulltitle?: string;
  nlmissn?: string;
  nlmeissn?: string;
  nlmisoabbreviation?: string;
  nlmcatalog!: string;


  static initModel(sequelize: Sequelize.Sequelize): typeof Nlm {
    Nlm.init({
    nlmabbreviation: {
      type: DataTypes.STRING(200),
      allowNull: true
    },
    nlmfulltitle: {
      type: DataTypes.STRING(300),
      allowNull: true
    },
    nlmissn: {
      type: DataTypes.STRING(9),
      allowNull: true
    },
    nlmeissn: {
      type: DataTypes.STRING(9),
      allowNull: true
    },
    nlmisoabbreviation: {
      type: DataTypes.STRING(100),
      allowNull: true
    },
    nlmcatalog: {
      type: DataTypes.STRING(12),
      allowNull: false,
      defaultValue: "0",
      primaryKey: true
    }
  }, {
    sequelize,
    tableName: 'NLM',
    timestamps: false,
    indexes: [
      {
        name: "PRIMARY",
        unique: true,
        using: "BTREE",
        fields: [
          { name: "nlmcatalog" },
        ]
      },
      {
        name: "nlm",
        using: "BTREE",
        fields: [
          { name: "nlmissn" },
        ]
      },
      {
        name: "idx_nlmeissn",
        using: "BTREE",
        fields: [
          { name: "nlmeissn" },
        ]
      },
      {
        name: "idx_nlmfulltitle",
        using: "BTREE",
        fields: [
          { name: "nlmfulltitle" },
        ]
      },
      {
        name: "idx_nlmabbreviation",
        using: "BTREE",
        fields: [
          { name: "nlmabbreviation" },
        ]
      },
    ]
  });
  return Nlm;
  }
}
