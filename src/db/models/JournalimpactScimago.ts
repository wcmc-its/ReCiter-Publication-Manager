import * as Sequelize from 'sequelize';
import { DataTypes, Model, Optional } from 'sequelize';

export interface JournalimpactScimagoAttributes {
  id: number;
  sourceID?: string;
  rank?: number;
  title?: string;
  issn?: string;
  issn1?: string;
  issn2?: string;
  issn3?: string;
  sjr?: number;
  sjrBestQuartlie?: string;
  type?: string;
  hindex?: number;
  totalDocs?: number;
  totalDocs3Years?: number;
  citableDocs3Years?: number;
  totalRefs?: number;
  totalCites3Years?: number;
  citesPerDoc2Years?: number;
  refPerDoc?: number;
  country?: string;
  region?: string;
  publisher?: string;
  coverage?: string;
  categories?: string;
}

export type JournalimpactScimagoPk = "id";
export type JournalimpactScimagoId = JournalimpactScimago[JournalimpactScimagoPk];
export type JournalimpactScimagoOptionalAttributes = "id" | "sourceID" | "rank" | "title" | "issn" | "issn1" | "issn2" | "issn3" | "sjr" | "sjrBestQuartlie" | "type" | "hindex" | "totalDocs" | "totalDocs3Years" | "citableDocs3Years" | "totalRefs" | "totalCites3Years" | "citesPerDoc2Years" | "refPerDoc" | "country" | "region" | "publisher" | "coverage" | "categories";
export type JournalimpactScimagoCreationAttributes = Optional<JournalimpactScimagoAttributes, JournalimpactScimagoOptionalAttributes>;

export class JournalimpactScimago extends Model<JournalimpactScimagoAttributes, JournalimpactScimagoCreationAttributes> implements JournalimpactScimagoAttributes {
  id!: number;
  sourceID?: string;
  rank?: number;
  title?: string;
  issn?: string;
  issn1?: string;
  issn2?: string;
  issn3?: string;
  sjr?: number;
  sjrBestQuartlie?: string;
  type?: string;
  hindex?: number;
  totalDocs?: number;
  totalDocs3Years?: number;
  citableDocs3Years?: number;
  totalRefs?: number;
  totalCites3Years?: number;
  citesPerDoc2Years?: number;
  refPerDoc?: number;
  country?: string;
  region?: string;
  publisher?: string;
  coverage?: string;
  categories?: string;


  static initModel(sequelize: Sequelize.Sequelize): typeof JournalimpactScimago {
    JournalimpactScimago.init({
    id: {
      autoIncrement: true,
      type: DataTypes.INTEGER,
      allowNull: false,
      primaryKey: true
    },
    sourceID: {
      type: DataTypes.STRING(128),
      allowNull: true
    },
    rank: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    title: {
      type: DataTypes.STRING(1000),
      allowNull: true
    },
    issn: {
      type: DataTypes.STRING(128),
      allowNull: true
    },
    issn1: {
      type: DataTypes.STRING(12),
      allowNull: true
    },
    issn2: {
      type: DataTypes.STRING(12),
      allowNull: true
    },
    issn3: {
      type: DataTypes.STRING(12),
      allowNull: true
    },
    sjr: {
      type: DataTypes.FLOAT(8,5),
      allowNull: true
    },
    sjrBestQuartlie: {
      type: DataTypes.STRING(10),
      allowNull: true
    },
    type: {
      type: DataTypes.STRING(30),
      allowNull: true
    },
    hindex: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    totalDocs: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    totalDocs3Years: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    citableDocs3Years: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    totalRefs: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    totalCites3Years: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    citesPerDoc2Years: {
      type: DataTypes.FLOAT(6,2),
      allowNull: true
    },
    refPerDoc: {
      type: DataTypes.FLOAT(6,2),
      allowNull: true
    },
    country: {
      type: DataTypes.STRING(128),
      allowNull: true
    },
    region: {
      type: DataTypes.STRING(128),
      allowNull: true
    },
    publisher: {
      type: DataTypes.STRING(400),
      allowNull: true
    },
    coverage: {
      type: DataTypes.STRING(400),
      allowNull: true
    },
    categories: {
      type: DataTypes.STRING(1000),
      allowNull: true
    }
  }, {
    sequelize,
    tableName: 'journalimpactScimago',
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
        name: "index1",
        using: "BTREE",
        fields: [
          { name: "issn1" },
        ]
      },
      {
        name: "index2",
        using: "BTREE",
        fields: [
          { name: "issn2" },
        ]
      },
    ]
  });
  return JournalimpactScimago;
  }
}
