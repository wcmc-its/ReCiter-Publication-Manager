import * as Sequelize from 'sequelize';
import { DataTypes, Model, Optional } from 'sequelize';

export interface AnalysisSummaryArticleAttributes {
  id: number;
  pmid?: number;
  pmcid?: string;
  publicationDateDisplay?: string;
  publicationDateStandardized?: string;
  datePublicationAddedToEntrez?: string;
  articleTitle?: string;
  articleTitleRTF?: string;
  publicationTypeCanonical?: string;
  publicationTypeNIH?: string;
  journalTitleVerbose?: string;
  issn?: string;
  journalImpactScore1?: number;
  journalImpactScore2?: number;
  articleYear?: number;
  doi?: string;
  volume?: string;
  issue?: string;
  pages?: string;
  citationCountScopus?: number;
  citationCountNIH?: number;
  percentileNIH?: number;
  relativeCitationRatioNIH?: number;
  readersMendeley?: number;
  trendingPubsScore?: number;
}

export type AnalysisSummaryArticlePk = "id";
//export type AnalysisSummaryArticleId = AnalysisSummaryArticle[AnalysisSummaryArticlePk];
export type AnalysisSummaryArticleOptionalAttributes = "id" | "pmid" | "pmcid" | "publicationDateDisplay" | "publicationDateStandardized" | "datePublicationAddedToEntrez" | "articleTitle" | "articleTitleRTF" | "publicationTypeCanonical" | "publicationTypeNIH" | "journalTitleVerbose" | "issn" | "journalImpactScore1" | "journalImpactScore2" | "articleYear" | "doi" | "volume" | "issue" | "pages" | "citationCountScopus" | "citationCountNIH" | "percentileNIH" | "relativeCitationRatioNIH" | "readersMendeley" | "trendingPubsScore";
export type AnalysisSummaryArticleCreationAttributes = Optional<AnalysisSummaryArticleAttributes, AnalysisSummaryArticleOptionalAttributes>;

export class AnalysisSummaryArticle extends Model<AnalysisSummaryArticleAttributes, AnalysisSummaryArticleCreationAttributes> implements AnalysisSummaryArticleAttributes {
  id!: number;
  pmid?: number;
  pmcid?: string;
  publicationDateDisplay?: string;
  publicationDateStandardized?: string;
  datePublicationAddedToEntrez?: string;
  articleTitle?: string;
  articleTitleRTF?: string;
  publicationTypeCanonical?: string;
  publicationTypeNIH?: string;
  journalTitleVerbose?: string;
  issn?: string;
  journalImpactScore1?: number;
  journalImpactScore2?: number;
  articleYear?: number;
  doi?: string;
  volume?: string;
  issue?: string;
  pages?: string;
  citationCountScopus?: number;
  citationCountNIH?: number;
  percentileNIH?: number;
  relativeCitationRatioNIH?: number;
  readersMendeley?: number;
  trendingPubsScore?: number;


  static initModel(sequelize: Sequelize.Sequelize): typeof AnalysisSummaryArticle {
    AnalysisSummaryArticle.init({
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
    pmcid: {
      type: DataTypes.STRING(128),
      allowNull: true
    },
    publicationDateDisplay: {
      type: DataTypes.STRING(200),
      allowNull: true
    },
    publicationDateStandardized: {
      type: DataTypes.STRING(128),
      allowNull: true
    },
    datePublicationAddedToEntrez: {
      type: DataTypes.STRING(128),
      allowNull: true
    },
    articleTitle: {
      type: DataTypes.STRING(1000),
      allowNull: true
    },
    articleTitleRTF: {
      type: DataTypes.STRING(2000),
      allowNull: true
    },
    publicationTypeCanonical: {
      type: DataTypes.STRING(128),
      allowNull: true
    },
    publicationTypeNIH: {
      type: DataTypes.STRING(128),
      allowNull: true
    },
    journalTitleVerbose: {
      type: DataTypes.STRING(500),
      allowNull: true,
      defaultValue: "NULL"
    },
    issn: {
      type: DataTypes.STRING(12),
      allowNull: true
    },
    journalImpactScore1: {
      type: DataTypes.FLOAT(6,3),
      allowNull: true
    },
    journalImpactScore2: {
      type: DataTypes.FLOAT(6,3),
      allowNull: true
    },
    articleYear: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: 0
    },
    doi: {
      type: DataTypes.STRING(128),
      allowNull: true
    },
    volume: {
      type: DataTypes.STRING(500),
      allowNull: true,
      defaultValue: "NULL"
    },
    issue: {
      type: DataTypes.STRING(500),
      allowNull: true,
      defaultValue: "NULL"
    },
    pages: {
      type: DataTypes.STRING(500),
      allowNull: true,
      defaultValue: "NULL"
    },
    citationCountScopus: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    citationCountNIH: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    percentileNIH: {
      type: DataTypes.FLOAT(5,2),
      allowNull: true
    },
    relativeCitationRatioNIH: {
      type: DataTypes.FLOAT(6,2),
      allowNull: true
    },
    readersMendeley: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    trendingPubsScore: {
      type: DataTypes.FLOAT(7,2),
      allowNull: true
    }
  }, {
    sequelize,
    tableName: 'analysis_summary_article',
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
        name: "x",
        using: "BTREE",
        fields: [
          { name: "doi" },
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
        name: "w",
        using: "BTREE",
        fields: [
          { name: "issn" },
        ]
      },
    ]
  });
  return AnalysisSummaryArticle;
  }
}
