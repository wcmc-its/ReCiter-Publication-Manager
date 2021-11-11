import type { Sequelize } from "sequelize";
import { Altmetric } from "./Altmetric";
import type { AltmetricAttributes, AltmetricCreationAttributes } from "./Altmetric";
import { AnalysisRcr } from "./AnalysisRcr";
import type { AnalysisRcrAttributes, AnalysisRcrCreationAttributes } from "./AnalysisRcr";
import { AnalysisRcrCite } from "./AnalysisRcrCite";
import type { AnalysisRcrCiteAttributes, AnalysisRcrCiteCreationAttributes } from "./AnalysisRcrCite";
import { AnalysisRcrCitesClin } from "./AnalysisRcrCitesClin";
import type { AnalysisRcrCitesClinAttributes, AnalysisRcrCitesClinCreationAttributes } from "./AnalysisRcrCitesClin";
import { AnalysisRcrSummary } from "./AnalysisRcrSummary";
import type { AnalysisRcrSummaryAttributes, AnalysisRcrSummaryCreationAttributes } from "./AnalysisRcrSummary";
import { AnalysisRcrYear } from "./AnalysisRcrYear";
import type { AnalysisRcrYearAttributes, AnalysisRcrYearCreationAttributes } from "./AnalysisRcrYear";
import { Person } from "./Person";
import type { PersonAttributes, PersonCreationAttributes } from "./Person";
import { PersonArticle } from "./PersonArticle";
import type { PersonArticleAttributes, PersonArticleCreationAttributes } from "./PersonArticle";
import { PersonArticleAuthor } from "./PersonArticleAuthor";
import type { PersonArticleAuthorAttributes, PersonArticleAuthorCreationAttributes } from "./PersonArticleAuthor";
import { PersonArticleDepartment } from "./PersonArticleDepartment";
import type { PersonArticleDepartmentAttributes, PersonArticleDepartmentCreationAttributes } from "./PersonArticleDepartment";
import { PersonArticleGrant } from "./PersonArticleGrant";
import type { PersonArticleGrantAttributes, PersonArticleGrantCreationAttributes } from "./PersonArticleGrant";
import { PersonArticleRelationship } from "./PersonArticleRelationship";
import type { PersonArticleRelationshipAttributes, PersonArticleRelationshipCreationAttributes } from "./PersonArticleRelationship";
import { PersonArticleScopusNonTargetAuthorAffiliation } from "./PersonArticleScopusNonTargetAuthorAffiliation";
import type { PersonArticleScopusNonTargetAuthorAffiliationAttributes, PersonArticleScopusNonTargetAuthorAffiliationCreationAttributes } from "./PersonArticleScopusNonTargetAuthorAffiliation";
import { PersonArticleScopusTargetAuthorAffiliation } from "./PersonArticleScopusTargetAuthorAffiliation";
import type { PersonArticleScopusTargetAuthorAffiliationAttributes, PersonArticleScopusTargetAuthorAffiliationCreationAttributes } from "./PersonArticleScopusTargetAuthorAffiliation";
import { PersonPersonType } from "./PersonPersonType";
import type { PersonPersonTypeAttributes, PersonPersonTypeCreationAttributes } from "./PersonPersonType";

export {
  Altmetric,
  AnalysisRcr,
  AnalysisRcrCite,
  AnalysisRcrCitesClin,
  AnalysisRcrSummary,
  AnalysisRcrYear,
  Person,
  PersonArticle,
  PersonArticleAuthor,
  PersonArticleDepartment,
  PersonArticleGrant,
  PersonArticleRelationship,
  PersonArticleScopusNonTargetAuthorAffiliation,
  PersonArticleScopusTargetAuthorAffiliation,
  PersonPersonType,
};

export type {
  AltmetricAttributes,
  AltmetricCreationAttributes,
  AnalysisRcrAttributes,
  AnalysisRcrCreationAttributes,
  AnalysisRcrCiteAttributes,
  AnalysisRcrCiteCreationAttributes,
  AnalysisRcrCitesClinAttributes,
  AnalysisRcrCitesClinCreationAttributes,
  AnalysisRcrSummaryAttributes,
  AnalysisRcrSummaryCreationAttributes,
  AnalysisRcrYearAttributes,
  AnalysisRcrYearCreationAttributes,
  PersonAttributes,
  PersonCreationAttributes,
  PersonArticleAttributes,
  PersonArticleCreationAttributes,
  PersonArticleAuthorAttributes,
  PersonArticleAuthorCreationAttributes,
  PersonArticleDepartmentAttributes,
  PersonArticleDepartmentCreationAttributes,
  PersonArticleGrantAttributes,
  PersonArticleGrantCreationAttributes,
  PersonArticleRelationshipAttributes,
  PersonArticleRelationshipCreationAttributes,
  PersonArticleScopusNonTargetAuthorAffiliationAttributes,
  PersonArticleScopusNonTargetAuthorAffiliationCreationAttributes,
  PersonArticleScopusTargetAuthorAffiliationAttributes,
  PersonArticleScopusTargetAuthorAffiliationCreationAttributes,
  PersonPersonTypeAttributes,
  PersonPersonTypeCreationAttributes,
};

export function initModels(sequelize: Sequelize) {
  Altmetric.initModel(sequelize);
  AnalysisRcr.initModel(sequelize);
  AnalysisRcrCite.initModel(sequelize);
  AnalysisRcrCitesClin.initModel(sequelize);
  AnalysisRcrSummary.initModel(sequelize);
  AnalysisRcrYear.initModel(sequelize);
  Person.initModel(sequelize);
  PersonArticle.initModel(sequelize);
  PersonArticleAuthor.initModel(sequelize);
  PersonArticleDepartment.initModel(sequelize);
  PersonArticleGrant.initModel(sequelize);
  PersonArticleRelationship.initModel(sequelize);
  PersonArticleScopusNonTargetAuthorAffiliation.initModel(sequelize);
  PersonArticleScopusTargetAuthorAffiliation.initModel(sequelize);
  PersonPersonType.initModel(sequelize);


  return {
    Altmetric: Altmetric,
    AnalysisRcr: AnalysisRcr,
    AnalysisRcrCite: AnalysisRcrCite,
    AnalysisRcrCitesClin: AnalysisRcrCitesClin,
    AnalysisRcrSummary: AnalysisRcrSummary,
    AnalysisRcrYear: AnalysisRcrYear,
    Person: Person,
    PersonArticle: PersonArticle,
    PersonArticleAuthor: PersonArticleAuthor,
    PersonArticleDepartment: PersonArticleDepartment,
    PersonArticleGrant: PersonArticleGrant,
    PersonArticleRelationship: PersonArticleRelationship,
    PersonArticleScopusNonTargetAuthorAffiliation: PersonArticleScopusNonTargetAuthorAffiliation,
    PersonArticleScopusTargetAuthorAffiliation: PersonArticleScopusTargetAuthorAffiliation,
    PersonPersonType: PersonPersonType,
  };
}
