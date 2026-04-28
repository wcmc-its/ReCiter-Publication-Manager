export type Author = {
  authorName: string
  target: boolean
}

export type PublicationType = {
  publicationTypeCanonical: string
}

export type ArticleKeyword = {
  keyword: string
  type: string
  count: number
}

export type ArticleAuthor = {
  lastName: string
  firstName: string
  initials: string
  email: string
  targetAuthor: boolean
}

export type Name = {
  firstNAme: string
  firstInitial?: string
  middleName?: string
  middleInitial?: string
  lastName: string
}

export type AuthorNameEvidence = {
  institutionalAuthorName?: Name
  articleAuthorName?: Name
}

export type JournalCategoryEvidence = {
  journalSubfieldDepartment?: string
  journalSubfieldScore?: number
}

export type TargetAuthorInstitutionalAffiliation = {
  targetAuthorInstitutionalAffiliationSource?: string
  targetAuthorInstitutionalAffiliationIdentity?: string
  targetAuthorInstitutionalAffiliationArticleScopusLabel?: string
  targetAuthorInstitutionalAffiliationArticleScopusAffiliationId?: number
  targetAuthorInstitutionalAffiliationMatchType?: string
  targetAuthorInstitutionalAffiliationMatchTypeScore?: number
}

export type NonTargetAuthorInstitutionalAffiliation = {
  nonTargetAuthorInstitutionalAffiliationSource?: string
  nonTargetAuthorInstitutionalAffiliationMatchKnownInstitution?: Array<string>
  nonTargetAuthorInstitutionalAffiliationScore?: number
}

export type AffiliationEvidence = {
  scopusTargetAuthorAffiliation?: Array<TargetAuthorInstitutionalAffiliation>
  scopusNonTargetAuthorAffiliation?: NonTargetAuthorInstitutionalAffiliation
}

export type RelationshipPositiveMatch = {
    relationshipNameArticle: Name,
    relationshipNameIdentity: NAme,
    relationshipType: Array<String>,
    relationshipMatchType: string,
    relationshipMatchingScore: number,
    relationshipVerboseMatchModifierScore: number,
}

export type RelationshipEvidence = {
  relationshipEvidenceTotalScore: number,
  relationshipNegativeMatch: {
    relationshipNonMatchCount: number,
    relationshipNonMatchScore: number,
    relationshipMinimumTotalScore: number
  },
  relationshipPositiveMatch?: Array<RelationshipPositiveMatch>
}

export type GrantEvidence = {
  institutionGrant?: string,
  articleGrant?: string,
  grantMatchScore?: number
}

export type EducationYearEvidence = {
  identityBachelorYear?: number
  identityDoctoralYear:? number
  articleYear?: number
  discrepancyDegreeYearBachelorScore?: number
  discrepancyDegreeYearDoctoral?: number
  discrepancyDegreeYearDoctoralScore?: number
}

export type PersonTypeEvidence = {
  personType?: string
  personTypeScore?: number
}

export type GenderEvidence = {
  genderScoreArticle?: number
  genderScoreIdentity?: number
  genderScoreIdentityArticleDiscrepancy?: number
}

export type ArticleCountEvidence = {
  countArticlesRetrieved: number
  articleCountScore: number
}

export type AverageClusteringEvidence = {
  totalArticleScoreWithoutClustering: number
  clusterScoreAverage: number
  clusterReliabilityScore: number
  clusterScoreModificationOfTotalScore: number
  clusterIdentifier: number
}

export type Evidence = {
  authorNameEvidence?: AuthorNameEvidence
  journalCategoryEvidence?: JournalCategoryEvidence
  affiliationEvidence?: AffiliationEvidence
  relationshipEvidence?: RelationshipEvidence
  grantEvidence?: {
    grants: Array<GrantEvidence>
  }
  educationYearEvidence?: EducationYearEvidence
  personTypeEvidence?: PersonTypeEvidence
  genderEvidence?: GenderEvidence
  articleCountEvidence?: ArticleCountEvidence
  averageClusteringEvidence?: AverageClusteringEvidence
}

export type Publication = {
  pmid: number
  totalArticleScoreStandardized: number
  totalArticleScoreNonStandardized: number
  userAssertion: string | null
  publicationDateDisplay: string
  publicationDateStandardized: string
  doi: string
  publicationType: PublicationType
  timesCited: number
  publicationAbstract: string
  articleKeywords: ArticleKeyword
  journalTitleVerbose: string
  articleTitle: string
  reCiterARticleAuthorFeatures: ArticleAuthor
  evidence?: Evidence
}