import * as Sequelize from 'sequelize';
import { DataTypes, Model, Optional } from 'sequelize';

export interface ScienceMetrixAttributes {
  smsid: number;
  publication_name?: string;
  issn?: string;
  issncut?: string;
  eissn?: string;
  domain?: string;
  field?: string;
  subfield?: string;
  subfield_id?: number;
  nlmabbreviation?: string;
}

export type ScienceMetrixPk = "smsid";
export type ScienceMetrixId = ScienceMetrix[ScienceMetrixPk];
export type ScienceMetrixOptionalAttributes = "smsid" | "publication_name" | "issn" | "issncut" | "eissn" | "domain" | "field" | "subfield" | "subfield_id" | "nlmabbreviation";
export type ScienceMetrixCreationAttributes = Optional<ScienceMetrixAttributes, ScienceMetrixOptionalAttributes>;

export class ScienceMetrix extends Model<ScienceMetrixAttributes, ScienceMetrixCreationAttributes> implements ScienceMetrixAttributes {
  smsid!: number;
  publication_name?: string;
  issn?: string;
  issncut?: string;
  eissn?: string;
  domain?: string;
  field?: string;
  subfield?: string;
  subfield_id?: number;
  nlmabbreviation?: string;


  static initModel(sequelize: Sequelize.Sequelize): typeof ScienceMetrix {
    ScienceMetrix.init({
    smsid: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      primaryKey: true
    },
    publication_name: {
      type: DataTypes.STRING(500),
      allowNull: true
    },
    issn: {
      type: DataTypes.STRING(25),
      allowNull: true
    },
    issncut: {
      type: DataTypes.STRING(25),
      allowNull: true
    },
    eissn: {
      type: DataTypes.STRING(25),
      allowNull: true
    },
    domain: {
      type: DataTypes.STRING(100),
      allowNull: true
    },
    field: {
      type: DataTypes.STRING(100),
      allowNull: true
    },
    subfield: {
      type: DataTypes.STRING(100),
      allowNull: true
    },
    subfield_id: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    nlmabbreviation: {
      type: DataTypes.STRING(300),
      allowNull: true
    }
  }, {
    sequelize,
    tableName: 'science_metrix',
    freezeTableName: true,
    timestamps: false,
    indexes: [
      {
        name: "PRIMARY",
        unique: true,
        using: "BTREE",
        fields: [
          { name: "smsid" },
        ]
      },
      {
        name: "scopus_document_pk",
        using: "BTREE",
        fields: [
          { name: "smsid" },
        ]
      },
      {
        name: "issn",
        using: "BTREE",
        fields: [
          { name: "issn" },
          { name: "eissn" },
        ]
      },
      {
        name: "sdhfkjsdjfh",
        using: "BTREE",
        fields: [
          { name: "subfield" },
        ]
      },
    ]
  });
  return ScienceMetrix;
  }
}
