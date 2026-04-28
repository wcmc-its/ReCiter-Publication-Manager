import * as Sequelize from 'sequelize';
import { DataTypes, Model, Optional } from 'sequelize';

export interface PersonArticleAttributes {
  id: number;
  personIdentifier?: string;
  pmid?: number;
  pmcid?: string;
  totalArticleScoreStandardized?: number;
  totalArticleScoreNonStandardized?: number;
  userAssertion?: string;
  publicationDateDisplay?: string;
  publicationDateStandardized?: string;
  publicationTypeCanonical?: string;
  scopusDocID?: string;
  journalTitleVerbose?: string;
  articleTitle?: string;
  feedbackScoreAccepted?: number;
  feedbackScoreRejected?: number;
  feedbackScoreNull?: number;
  articleAuthorNameFirstName?: string;
  articleAuthorNameLastName?: string;
  institutionalAuthorNameFirstName?: string;
  institutionalAuthorNameMiddleName?: string;
  institutionalAuthorNameLastName?: string;
  nameMatchFirstScore?: number;
  nameMatchFirstType?: string;
  nameMatchMiddleScore?: number;
  nameMatchMiddleType?: string;
  nameMatchLastScore?: number;
  nameMatchLastType?: string;
  nameMatchModifierScore?: number;
  nameScoreTotal?: number;
  emailMatch?: string;
  emailMatchScore?: number;
  journalSubfieldScienceMetrixLabel?: string;
  journalSubfieldScienceMetrixID?: string;
  journalSubfieldDepartment?: string;
  journalSubfieldScore?: number;
  relationshipEvidenceTotalScore?: number;
  relationshipMinimumTotalScore?: number;
  relationshipNonMatchCount?: number;
  relationshipNonMatchScore?: number;
  articleYear?: number;
  identityBachelorYear?: string;
  discrepancyDegreeYearBachelor?: number;
  discrepancyDegreeYearBachelorScore?: number;
  identityDoctoralYear?: string;
  discrepancyDegreeYearDoctoral?: number;
  discrepancyDegreeYearDoctoralScore?: number;
  genderScoreArticle?: number;
  genderScoreIdentity?: number;
  genderScoreIdentityArticleDiscrepancy?: number;
  personType?: string;
  personTypeScore?: number;
  countArticlesRetrieved?: number;
  articleCountScore?: number;
  targetAuthorInstitutionalAffiliationArticlePubmedLabel?: string;
  pubmedTargetAuthorInstitutionalAffiliationMatchTypeScore?: number;
  scopusNonTargetAuthorInstitutionalAffiliationSource?: string;
  scopusNonTargetAuthorInstitutionalAffiliationScore?: number;
  totalArticleScoreWithoutClustering?: number;
  clusterScoreAverage?: number;
  clusterReliabilityScore?: number;
  clusterScoreModificationOfTotalScore?: number;
  datePublicationAddedToEntrez?: string;
  clusterIdentifier?: number;
  doi?: string;
  issn?: string;
  issue?: string;
  journalTitleISOabbreviation?: string;
  pages?: string;
  timesCited?: number;
  volume?: string;
}

export type PersonArticlePk = "id";
export type PersonArticleId = PersonArticle[PersonArticlePk];
export type PersonArticleOptionalAttributes = "id" | "personIdentifier" | "pmid" | "pmcid" | "totalArticleScoreStandardized" | "totalArticleScoreNonStandardized" | "userAssertion" | "publicationDateDisplay" | "publicationDateStandardized" | "publicationTypeCanonical" | "scopusDocID" | "journalTitleVerbose" | "articleTitle" | "feedbackScoreAccepted" | "feedbackScoreRejected" | "feedbackScoreNull" | "articleAuthorNameFirstName" | "articleAuthorNameLastName" | "institutionalAuthorNameFirstName" | "institutionalAuthorNameMiddleName" | "institutionalAuthorNameLastName" | "nameMatchFirstScore" | "nameMatchFirstType" | "nameMatchMiddleScore" | "nameMatchMiddleType" | "nameMatchLastScore" | "nameMatchLastType" | "nameMatchModifierScore" | "nameScoreTotal" | "emailMatch" | "emailMatchScore" | "journalSubfieldScienceMetrixLabel" | "journalSubfieldScienceMetrixID" | "journalSubfieldDepartment" | "journalSubfieldScore" | "relationshipEvidenceTotalScore" | "relationshipMinimumTotalScore" | "relationshipNonMatchCount" | "relationshipNonMatchScore" | "articleYear" | "identityBachelorYear" | "discrepancyDegreeYearBachelor" | "discrepancyDegreeYearBachelorScore" | "identityDoctoralYear" | "discrepancyDegreeYearDoctoral" | "discrepancyDegreeYearDoctoralScore" | "genderScoreArticle" | "genderScoreIdentity" | "genderScoreIdentityArticleDiscrepancy" | "personType" | "personTypeScore" | "countArticlesRetrieved" | "articleCountScore" | "targetAuthorInstitutionalAffiliationArticlePubmedLabel" | "pubmedTargetAuthorInstitutionalAffiliationMatchTypeScore" | "scopusNonTargetAuthorInstitutionalAffiliationSource" | "scopusNonTargetAuthorInstitutionalAffiliationScore" | "totalArticleScoreWithoutClustering" | "clusterScoreAverage" | "clusterReliabilityScore" | "clusterScoreModificationOfTotalScore" | "datePublicationAddedToEntrez" | "clusterIdentifier" | "doi" | "issn" | "issue" | "journalTitleISOabbreviation" | "pages" | "timesCited" | "volume";
export type PersonArticleCreationAttributes = Optional<PersonArticleAttributes, PersonArticleOptionalAttributes>;

export class PersonArticle extends Model<PersonArticleAttributes, PersonArticleCreationAttributes> implements PersonArticleAttributes {
  id!: number;
  personIdentifier?: string;
  pmid?: number;
  pmcid?: string;
  totalArticleScoreStandardized?: number;
  totalArticleScoreNonStandardized?: number;
  userAssertion?: string;
  publicationDateDisplay?: string;
  publicationDateStandardized?: string;
  publicationTypeCanonical?: string;
  scopusDocID?: string;
  journalTitleVerbose?: string;
  articleTitle?: string;
  feedbackScoreAccepted?: number;
  feedbackScoreRejected?: number;
  feedbackScoreNull?: number;
  articleAuthorNameFirstName?: string;
  articleAuthorNameLastName?: string;
  institutionalAuthorNameFirstName?: string;
  institutionalAuthorNameMiddleName?: string;
  institutionalAuthorNameLastName?: string;
  nameMatchFirstScore?: number;
  nameMatchFirstType?: string;
  nameMatchMiddleScore?: number;
  nameMatchMiddleType?: string;
  nameMatchLastScore?: number;
  nameMatchLastType?: string;
  nameMatchModifierScore?: number;
  nameScoreTotal?: number;
  emailMatch?: string;
  emailMatchScore?: number;
  journalSubfieldScienceMetrixLabel?: string;
  journalSubfieldScienceMetrixID?: string;
  journalSubfieldDepartment?: string;
  journalSubfieldScore?: number;
  relationshipEvidenceTotalScore?: number;
  relationshipMinimumTotalScore?: number;
  relationshipNonMatchCount?: number;
  relationshipNonMatchScore?: number;
  articleYear?: number;
  identityBachelorYear?: string;
  discrepancyDegreeYearBachelor?: number;
  discrepancyDegreeYearBachelorScore?: number;
  identityDoctoralYear?: string;
  discrepancyDegreeYearDoctoral?: number;
  discrepancyDegreeYearDoctoralScore?: number;
  genderScoreArticle?: number;
  genderScoreIdentity?: number;
  genderScoreIdentityArticleDiscrepancy?: number;
  personType?: string;
  personTypeScore?: number;
  countArticlesRetrieved?: number;
  articleCountScore?: number;
  targetAuthorInstitutionalAffiliationArticlePubmedLabel?: string;
  pubmedTargetAuthorInstitutionalAffiliationMatchTypeScore?: number;
  scopusNonTargetAuthorInstitutionalAffiliationSource?: string;
  scopusNonTargetAuthorInstitutionalAffiliationScore?: number;
  totalArticleScoreWithoutClustering?: number;
  clusterScoreAverage?: number;
  clusterReliabilityScore?: number;
  clusterScoreModificationOfTotalScore?: number;
  datePublicationAddedToEntrez?: string;
  clusterIdentifier?: number;
  doi?: string;
  issn?: string;
  issue?: string;
  journalTitleISOabbreviation?: string;
  pages?: string;
  timesCited?: number;
  volume?: string;


  static initModel(sequelize: Sequelize.Sequelize): typeof PersonArticle {
    PersonArticle.init({
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
      allowNull: true,
      defaultValue: 0
    },
    pmcid: {
      type: DataTypes.STRING(20),
      allowNull: true
    },
    totalArticleScoreStandardized: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: 0
    },
    totalArticleScoreNonStandardized: {
      type: DataTypes.FLOAT,
      allowNull: true,
      defaultValue: 0
    },
    userAssertion: {
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
    publicationTypeCanonical: {
      type: DataTypes.STRING(128),
      allowNull: true
    },
    scopusDocID: {
      type: DataTypes.STRING(128),
      allowNull: true
    },
    journalTitleVerbose: {
      type: DataTypes.STRING(2000),
      allowNull: true,
      defaultValue: "NULL"
    },
    articleTitle: {
      type: DataTypes.STRING(5000),
      allowNull: true,
      defaultValue: "'NULL'"
    },
    feedbackScoreAccepted: {
      type: DataTypes.FLOAT,
      allowNull: true
    },
    feedbackScoreRejected: {
      type: DataTypes.FLOAT,
      allowNull: true
    },
    feedbackScoreNull: {
      type: DataTypes.FLOAT,
      allowNull: true
    },
    articleAuthorNameFirstName: {
      type: DataTypes.STRING(128),
      allowNull: true,
      defaultValue: "'NULL'"
    },
    articleAuthorNameLastName: {
      type: DataTypes.STRING(128),
      allowNull: true,
      defaultValue: "'NULL'"
    },
    institutionalAuthorNameFirstName: {
      type: DataTypes.STRING(128),
      allowNull: true,
      defaultValue: "'NULL'"
    },
    institutionalAuthorNameMiddleName: {
      type: DataTypes.STRING(128),
      allowNull: true,
      defaultValue: "'NULL'"
    },
    institutionalAuthorNameLastName: {
      type: DataTypes.STRING(128),
      allowNull: true,
      defaultValue: "'NULL'"
    },
    nameMatchFirstScore: {
      type: DataTypes.FLOAT,
      allowNull: true,
      defaultValue: 0
    },
    nameMatchFirstType: {
      type: DataTypes.STRING(128),
      allowNull: true,
      defaultValue: "NULL"
    },
    nameMatchMiddleScore: {
      type: DataTypes.FLOAT,
      allowNull: true,
      defaultValue: 0
    },
    nameMatchMiddleType: {
      type: DataTypes.STRING(128),
      allowNull: true,
      defaultValue: "NULL"
    },
    nameMatchLastScore: {
      type: DataTypes.FLOAT,
      allowNull: true,
      defaultValue: 0
    },
    nameMatchLastType: {
      type: DataTypes.STRING(128),
      allowNull: true,
      defaultValue: "NULL"
    },
    nameMatchModifierScore: {
      type: DataTypes.FLOAT,
      allowNull: true,
      defaultValue: 0
    },
    nameScoreTotal: {
      type: DataTypes.FLOAT,
      allowNull: true,
      defaultValue: 0
    },
    emailMatch: {
      type: DataTypes.STRING(128),
      allowNull: true
    },
    emailMatchScore: {
      type: DataTypes.FLOAT,
      allowNull: true
    },
    journalSubfieldScienceMetrixLabel: {
      type: DataTypes.STRING(128),
      allowNull: true,
      defaultValue: "NULL"
    },
    journalSubfieldScienceMetrixID: {
      type: DataTypes.STRING(128),
      allowNull: true
    },
    journalSubfieldDepartment: {
      type: DataTypes.STRING(128),
      allowNull: true
    },
    journalSubfieldScore: {
      type: DataTypes.FLOAT,
      allowNull: true,
      defaultValue: 0
    },
    relationshipEvidenceTotalScore: {
      type: DataTypes.FLOAT,
      allowNull: true,
      defaultValue: 0
    },
    relationshipMinimumTotalScore: {
      type: DataTypes.FLOAT,
      allowNull: true,
      defaultValue: 0
    },
    relationshipNonMatchCount: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: 0
    },
    relationshipNonMatchScore: {
      type: DataTypes.FLOAT,
      allowNull: true,
      defaultValue: 0
    },
    articleYear: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: 0
    },
    identityBachelorYear: {
      type: DataTypes.STRING(128),
      allowNull: true,
      defaultValue: "NULL"
    },
    discrepancyDegreeYearBachelor: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: 0
    },
    discrepancyDegreeYearBachelorScore: {
      type: DataTypes.FLOAT,
      allowNull: true,
      defaultValue: 0
    },
    identityDoctoralYear: {
      type: DataTypes.STRING(128),
      allowNull: true
    },
    discrepancyDegreeYearDoctoral: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: 0
    },
    discrepancyDegreeYearDoctoralScore: {
      type: DataTypes.FLOAT,
      allowNull: true,
      defaultValue: 0
    },
    genderScoreArticle: {
      type: DataTypes.FLOAT,
      allowNull: true,
      defaultValue: 0
    },
    genderScoreIdentity: {
      type: DataTypes.FLOAT,
      allowNull: true,
      defaultValue: 0
    },
    genderScoreIdentityArticleDiscrepancy: {
      type: DataTypes.FLOAT,
      allowNull: true,
      defaultValue: 0
    },
    personType: {
      type: DataTypes.STRING(128),
      allowNull: true
    },
    personTypeScore: {
      type: DataTypes.FLOAT,
      allowNull: true
    },
    countArticlesRetrieved: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: 0
    },
    articleCountScore: {
      type: DataTypes.FLOAT,
      allowNull: true,
      defaultValue: 0
    },
    targetAuthorInstitutionalAffiliationArticlePubmedLabel: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    pubmedTargetAuthorInstitutionalAffiliationMatchTypeScore: {
      type: DataTypes.FLOAT,
      allowNull: true
    },
    scopusNonTargetAuthorInstitutionalAffiliationSource: {
      type: DataTypes.STRING(128),
      allowNull: true,
      defaultValue: "'''NULL'''"
    },
    scopusNonTargetAuthorInstitutionalAffiliationScore: {
      type: DataTypes.FLOAT,
      allowNull: true,
      defaultValue: 0
    },
    totalArticleScoreWithoutClustering: {
      type: DataTypes.FLOAT,
      allowNull: true,
      defaultValue: 0
    },
    clusterScoreAverage: {
      type: DataTypes.FLOAT,
      allowNull: true,
      defaultValue: 0
    },
    clusterReliabilityScore: {
      type: DataTypes.FLOAT,
      allowNull: true,
      defaultValue: 0
    },
    clusterScoreModificationOfTotalScore: {
      type: DataTypes.FLOAT,
      allowNull: true,
      defaultValue: 0
    },
    datePublicationAddedToEntrez: {
      type: DataTypes.STRING(128),
      allowNull: true
    },
    clusterIdentifier: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    doi: {
      type: DataTypes.STRING(128),
      allowNull: true
    },
    issn: {
      type: DataTypes.STRING(128),
      allowNull: true
    },
    issue: {
      type: DataTypes.STRING(500),
      allowNull: true,
      defaultValue: "NULL"
    },
    journalTitleISOabbreviation: {
      type: DataTypes.STRING(128),
      allowNull: true
    },
    pages: {
      type: DataTypes.STRING(500),
      allowNull: true,
      defaultValue: "NULL"
    },
    timesCited: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    volume: {
      type: DataTypes.STRING(500),
      allowNull: true,
      defaultValue: "NULL"
    }
  }, {
    sequelize,
    tableName: 'person_article',
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
        name: "idx_issn",
        using: "BTREE",
        fields: [
          { name: "issn" },
        ]
      },
      {
        name: "idx_scopusDocID",
        using: "BTREE",
        fields: [
          { name: "scopusDocID" },
        ]
      },
      {
        name: "idx_doi",
        using: "BTREE",
        fields: [
          { name: "doi" },
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
        name: "personIdentifier",
        using: "BTREE",
        fields: [
          { name: "personIdentifier" },
          { name: "pmid" },
        ]
      },
    ]
  });
  return PersonArticle;
  }
}
