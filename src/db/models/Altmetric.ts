import * as Sequelize from 'sequelize';
import { DataTypes, Model, Optional } from 'sequelize';

export interface AltmetricAttributes {
  id: number;
  doi?: string;
  pmid?: number;
  altmetric_jid?: string;
  'context-all-count'?: number;
  'context-all-mean'?: number;
  'context-all-rank'?: number;
  'context-all-pct'?: number;
  'context-all-higher_than'?: number;
  'context-similar_age_3m-count'?: number;
  'context-similar_age_3m-mean'?: number;
  'context-similar_age_3m-rank'?: number;
  'context-similar_age_3m-pct'?: number;
  'context-similar_age_3m-higher_than'?: number;
  altmetric_id?: number;
  cited_by_msm_count?: number;
  is_oa?: string;
  cited_by_posts_count?: number;
  cited_by_tweeters_count?: number;
  cited_by_feeds_count?: number;
  cited_by_fbwalls_count?: number;
  cited_by_rh_count?: number;
  cited_by_accounts_count?: number;
  last_updated?: number;
  score?: number;
  'history-1y'?: number;
  'history-6m'?: number;
  'history-3m'?: number;
  'history-1m'?: number;
  'history-1w'?: number;
  'history-at'?: number;
  added_on?: number;
  published_on?: number;
  'readers-mendeley'?: number;
  createTimestamp?: Date;
}

export type AltmetricPk = "id";
export type AltmetricId = Altmetric[AltmetricPk];
export type AltmetricOptionalAttributes = "id" | "doi" | "pmid" | "altmetric_jid" | "context-all-count" | "context-all-mean" | "context-all-rank" | "context-all-pct" | "context-all-higher_than" | "context-similar_age_3m-count" | "context-similar_age_3m-mean" | "context-similar_age_3m-rank" | "context-similar_age_3m-pct" | "context-similar_age_3m-higher_than" | "altmetric_id" | "cited_by_msm_count" | "is_oa" | "cited_by_posts_count" | "cited_by_tweeters_count" | "cited_by_feeds_count" | "cited_by_fbwalls_count" | "cited_by_rh_count" | "cited_by_accounts_count" | "last_updated" | "score" | "history-1y" | "history-6m" | "history-3m" | "history-1m" | "history-1w" | "history-at" | "added_on" | "published_on" | "readers-mendeley" | "createTimestamp";
export type AltmetricCreationAttributes = Optional<AltmetricAttributes, AltmetricOptionalAttributes>;

export class Altmetric extends Model<AltmetricAttributes, AltmetricCreationAttributes> implements AltmetricAttributes {
  id!: number;
  doi?: string;
  pmid?: number;
  altmetric_jid?: string;
  'context-all-count'?: number;
  'context-all-mean'?: number;
  'context-all-rank'?: number;
  'context-all-pct'?: number;
  'context-all-higher_than'?: number;
  'context-similar_age_3m-count'?: number;
  'context-similar_age_3m-mean'?: number;
  'context-similar_age_3m-rank'?: number;
  'context-similar_age_3m-pct'?: number;
  'context-similar_age_3m-higher_than'?: number;
  altmetric_id?: number;
  cited_by_msm_count?: number;
  is_oa?: string;
  cited_by_posts_count?: number;
  cited_by_tweeters_count?: number;
  cited_by_feeds_count?: number;
  cited_by_fbwalls_count?: number;
  cited_by_rh_count?: number;
  cited_by_accounts_count?: number;
  last_updated?: number;
  score?: number;
  'history-1y'?: number;
  'history-6m'?: number;
  'history-3m'?: number;
  'history-1m'?: number;
  'history-1w'?: number;
  'history-at'?: number;
  added_on?: number;
  published_on?: number;
  'readers-mendeley'?: number;
  createTimestamp?: Date;


  static initModel(sequelize: Sequelize.Sequelize): typeof Altmetric {
    Altmetric.init({
    id: {
      autoIncrement: true,
      type: DataTypes.INTEGER,
      allowNull: false,
      primaryKey: true
    },
    doi: {
      type: DataTypes.STRING(128),
      allowNull: true
    },
    pmid: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    altmetric_jid: {
      type: DataTypes.STRING(128),
      allowNull: true
    },
    'context-all-count': {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    'context-all-mean': {
      type: DataTypes.FLOAT(10,4),
      allowNull: true
    },
    'context-all-rank': {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    'context-all-pct': {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    'context-all-higher_than': {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    'context-similar_age_3m-count': {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: 0
    },
    'context-similar_age_3m-mean': {
      type: DataTypes.FLOAT(10,4),
      allowNull: true,
      defaultValue: 0.0000
    },
    'context-similar_age_3m-rank': {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: 0
    },
    'context-similar_age_3m-pct': {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: 0
    },
    'context-similar_age_3m-higher_than': {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: 0
    },
    altmetric_id: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    cited_by_msm_count: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    is_oa: {
      type: DataTypes.STRING(12),
      allowNull: true
    },
    cited_by_posts_count: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    cited_by_tweeters_count: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    cited_by_feeds_count: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    cited_by_fbwalls_count: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    cited_by_rh_count: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    cited_by_accounts_count: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    last_updated: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    score: {
      type: DataTypes.FLOAT(10,4),
      allowNull: true
    },
    'history-1y': {
      type: DataTypes.FLOAT(10,4),
      allowNull: true
    },
    'history-6m': {
      type: DataTypes.FLOAT(10,4),
      allowNull: true
    },
    'history-3m': {
      type: DataTypes.FLOAT(10,4),
      allowNull: true
    },
    'history-1m': {
      type: DataTypes.FLOAT(10,4),
      allowNull: true
    },
    'history-1w': {
      type: DataTypes.FLOAT(10,4),
      allowNull: true
    },
    'history-at': {
      type: DataTypes.FLOAT(10,4),
      allowNull: true
    },
    added_on: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    published_on: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    'readers-mendeley': {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    createTimestamp: {
      type: DataTypes.DATE,
      allowNull: true,
      defaultValue: Sequelize.Sequelize.literal('CURRENT_TIMESTAMP')
    }
  }, {
    sequelize,
    tableName: 'altmetric',
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
          { name: "doi" },
        ]
      },
      {
        name: "x",
        using: "BTREE",
        fields: [
          { name: "pmid" },
        ]
      },
    ]
  });
  return Altmetric;
  }
}
