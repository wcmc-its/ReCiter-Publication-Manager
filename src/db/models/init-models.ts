import type { Sequelize } from "sequelize";
import { Nlm } from "./Nlm";
import type { NlmAttributes, NlmCreationAttributes } from "./Nlm";
import { AdminDepartment } from "./AdminDepartment";
import type { AdminDepartmentAttributes, AdminDepartmentCreationAttributes } from "./AdminDepartment";
import { AdminFeedbackLog } from "./AdminFeedbackLog";
import type { AdminFeedbackLogAttributes, AdminFeedbackLogCreationAttributes } from "./AdminFeedbackLog";
import { AdminNotificationLog } from "./AdminNotificationLog";
import type { AdminNotificationLogAttributes, AdminNotificationLogCreationAttributes } from "./AdminNotificationLog";
import { AdminNotificationPreference } from "./AdminNotificationPreference";
import type { AdminNotificationPreferenceAttributes, AdminNotificationPreferenceCreationAttributes } from "./AdminNotificationPreference";
import { AdminRole } from "./AdminRole";
import type { AdminRoleAttributes, AdminRoleCreationAttributes } from "./AdminRole";
import { AdminUser } from "./AdminUser";
import type { AdminUserAttributes, AdminUserCreationAttributes } from "./AdminUser";
import { AdminUsersDepartment } from "./AdminUsersDepartment";
import type { AdminUsersDepartmentAttributes, AdminUsersDepartmentCreationAttributes } from "./AdminUsersDepartment";
import { AdminUsersRole } from "./AdminUsersRole";
import type { AdminUsersRoleAttributes, AdminUsersRoleCreationAttributes } from "./AdminUsersRole";
import { Altmetric } from "./Altmetric";
import type { AltmetricAttributes, AltmetricCreationAttributes } from "./Altmetric";
import { AnalysisOverrideAuthorPosition } from "./AnalysisOverrideAuthorPosition";
import type { AnalysisOverrideAuthorPositionAttributes, AnalysisOverrideAuthorPositionCreationAttributes } from "./AnalysisOverrideAuthorPosition";
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
import { AnalysisSpecialCharacter } from "./AnalysisSpecialCharacter";
import type { AnalysisSpecialCharacterAttributes, AnalysisSpecialCharacterCreationAttributes } from "./AnalysisSpecialCharacter";
import { AnalysisSummaryArticle } from "./AnalysisSummaryArticle";
import type { AnalysisSummaryArticleAttributes, AnalysisSummaryArticleCreationAttributes } from "./AnalysisSummaryArticle";
import { AnalysisSummaryAuthor } from "./AnalysisSummaryAuthor";
import type { AnalysisSummaryAuthorAttributes, AnalysisSummaryAuthorCreationAttributes } from "./AnalysisSummaryAuthor";
import { AnalysisSummaryAuthorList } from "./AnalysisSummaryAuthorList";
import type { AnalysisSummaryAuthorListAttributes, AnalysisSummaryAuthorListCreationAttributes } from "./AnalysisSummaryAuthorList";
import { AnalysisSummaryPerson } from "./AnalysisSummaryPerson";
import type { AnalysisSummaryPersonAttributes, AnalysisSummaryPersonCreationAttributes } from "./AnalysisSummaryPerson";
import { AnalysisTempArticle } from "./AnalysisTempArticle";
import type { AnalysisTempArticleAttributes, AnalysisTempArticleCreationAttributes } from "./AnalysisTempArticle";
import { AnalysisTempHindex } from "./AnalysisTempHindex";
import type { AnalysisTempHindexAttributes, AnalysisTempHindexCreationAttributes } from "./AnalysisTempHindex";
import { AnalysisTempOutputArticle } from "./AnalysisTempOutputArticle";
import type { AnalysisTempOutputArticleAttributes, AnalysisTempOutputArticleCreationAttributes } from "./AnalysisTempOutputArticle";
import { AnalysisTempOutputAuthor } from "./AnalysisTempOutputAuthor";
import type { AnalysisTempOutputAuthorAttributes, AnalysisTempOutputAuthorCreationAttributes } from "./AnalysisTempOutputAuthor";
import { Identity } from "./Identity";
import type { IdentityAttributes, IdentityCreationAttributes } from "./Identity";
import { JournalImpactAlternative } from "./JournalImpactAlternative";
import type { JournalImpactAlternativeAttributes, JournalImpactAlternativeCreationAttributes } from "./JournalImpactAlternative";
import { JournalimpactScimago } from "./JournalimpactScimago";
import type { JournalimpactScimagoAttributes, JournalimpactScimagoCreationAttributes } from "./JournalimpactScimago";
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
import { PersonArticleKeyword } from "./PersonArticleKeyword";
import type { PersonArticleKeywordAttributes, PersonArticleKeywordCreationAttributes } from "./PersonArticleKeyword";
import { PersonArticleRelationship } from "./PersonArticleRelationship";
import type { PersonArticleRelationshipAttributes, PersonArticleRelationshipCreationAttributes } from "./PersonArticleRelationship";
import { PersonArticleScopusNonTargetAuthorAffiliation } from "./PersonArticleScopusNonTargetAuthorAffiliation";
import type { PersonArticleScopusNonTargetAuthorAffiliationAttributes, PersonArticleScopusNonTargetAuthorAffiliationCreationAttributes } from "./PersonArticleScopusNonTargetAuthorAffiliation";
import { PersonArticleScopusTargetAuthorAffiliation } from "./PersonArticleScopusTargetAuthorAffiliation";
import type { PersonArticleScopusTargetAuthorAffiliationAttributes, PersonArticleScopusTargetAuthorAffiliationCreationAttributes } from "./PersonArticleScopusTargetAuthorAffiliation";
import { PersonPersonType } from "./PersonPersonType";
import type { PersonPersonTypeAttributes, PersonPersonTypeCreationAttributes } from "./PersonPersonType";
import { ScienceMetrix } from "./ScienceMetrix";
import type { ScienceMetrixAttributes, ScienceMetrixCreationAttributes } from "./ScienceMetrix";
import { AdminSettings } from "./AdminSettings";
import { AdminOrcid } from "./AdminOrcid";
import type {AdminOrcidAttributes,
  AdminOrcidCreationAttributes, } from "./AdminOrcid";


export {
  Nlm,
  AdminDepartment,
  AdminFeedbackLog,
  AdminNotificationLog,
  AdminNotificationPreference,
  AdminRole,
  AdminUser,
  AdminOrcid,
  AdminUsersDepartment,
  AdminUsersRole,
  Altmetric,
  AnalysisOverrideAuthorPosition,
  AnalysisRcr,
  AnalysisRcrCite,
  AnalysisRcrCitesClin,
  AnalysisRcrSummary,
  AnalysisRcrYear,
  AnalysisSpecialCharacter,
  AnalysisSummaryArticle,
  AnalysisSummaryAuthor,
  AnalysisSummaryAuthorList,
  AnalysisSummaryPerson,
  AnalysisTempArticle,
  AnalysisTempHindex,
  AnalysisTempOutputArticle,
  AnalysisTempOutputAuthor,
  Identity,
  JournalImpactAlternative,
  JournalimpactScimago,
  Person,
  PersonArticle,
  PersonArticleAuthor,
  PersonArticleDepartment,
  PersonArticleGrant,
  PersonArticleKeyword,
  PersonArticleRelationship,
  PersonArticleScopusNonTargetAuthorAffiliation,
  PersonArticleScopusTargetAuthorAffiliation,
  PersonPersonType,
  ScienceMetrix,
};

export type {
  NlmAttributes,
  NlmCreationAttributes,
  AdminDepartmentAttributes,
  AdminDepartmentCreationAttributes,
  AdminFeedbackLogAttributes,
  AdminFeedbackLogCreationAttributes,
  AdminNotificationLogAttributes,
  AdminNotificationLogCreationAttributes,
  AdminNotificationPreferenceAttributes,
  AdminNotificationPreferenceCreationAttributes,
  AdminOrcidAttributes,
  AdminOrcidCreationAttributes,
  AdminRoleAttributes,
  AdminRoleCreationAttributes,
  AdminUserAttributes,
  AdminUserCreationAttributes,
  AdminUsersDepartmentAttributes,
  AdminUsersDepartmentCreationAttributes,
  AdminUsersRoleAttributes,
  AdminUsersRoleCreationAttributes,
  AltmetricAttributes,
  AltmetricCreationAttributes,
  AnalysisOverrideAuthorPositionAttributes,
  AnalysisOverrideAuthorPositionCreationAttributes,
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
  AnalysisSpecialCharacterAttributes,
  AnalysisSpecialCharacterCreationAttributes,
  AnalysisSummaryArticleAttributes,
  AnalysisSummaryArticleCreationAttributes,
  AnalysisSummaryAuthorAttributes,
  AnalysisSummaryAuthorCreationAttributes,
  AnalysisSummaryAuthorListAttributes,
  AnalysisSummaryAuthorListCreationAttributes,
  AnalysisSummaryPersonAttributes,
  AnalysisSummaryPersonCreationAttributes,
  AnalysisTempArticleAttributes,
  AnalysisTempArticleCreationAttributes,
  AnalysisTempHindexAttributes,
  AnalysisTempHindexCreationAttributes,
  AnalysisTempOutputArticleAttributes,
  AnalysisTempOutputArticleCreationAttributes,
  AnalysisTempOutputAuthorAttributes,
  AnalysisTempOutputAuthorCreationAttributes,
  IdentityAttributes,
  IdentityCreationAttributes,
  JournalImpactAlternativeAttributes,
  JournalImpactAlternativeCreationAttributes,
  JournalimpactScimagoAttributes,
  JournalimpactScimagoCreationAttributes,
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
  PersonArticleKeywordAttributes,
  PersonArticleKeywordCreationAttributes,
  PersonArticleRelationshipAttributes,
  PersonArticleRelationshipCreationAttributes,
  PersonArticleScopusNonTargetAuthorAffiliationAttributes,
  PersonArticleScopusNonTargetAuthorAffiliationCreationAttributes,
  PersonArticleScopusTargetAuthorAffiliationAttributes,
  PersonArticleScopusTargetAuthorAffiliationCreationAttributes,
  PersonPersonTypeAttributes,
  PersonPersonTypeCreationAttributes,
  ScienceMetrixAttributes,
  ScienceMetrixCreationAttributes,
};

export function initModels(sequelize: Sequelize) {
  Nlm.initModel(sequelize);
  AdminDepartment.initModel(sequelize);
  AdminFeedbackLog.initModel(sequelize);
  AdminNotificationLog.initModel(sequelize);
  AdminNotificationPreference.initModel(sequelize);
  AdminRole.initModel(sequelize);
  AdminUser.initModel(sequelize);
  AdminUsersDepartment.initModel(sequelize);
  AdminUsersRole.initModel(sequelize);
  AdminOrcid.initModel(sequelize);
  Altmetric.initModel(sequelize);
  AnalysisOverrideAuthorPosition.initModel(sequelize);
  AnalysisRcr.initModel(sequelize);
  AnalysisRcrCite.initModel(sequelize);
  AnalysisRcrCitesClin.initModel(sequelize);
  AnalysisRcrSummary.initModel(sequelize);
  AnalysisRcrYear.initModel(sequelize);
  AnalysisSpecialCharacter.initModel(sequelize);
  AnalysisSummaryArticle.initModel(sequelize);
  AnalysisSummaryAuthor.initModel(sequelize);
  AnalysisSummaryAuthorList.initModel(sequelize);
  AnalysisSummaryPerson.initModel(sequelize);
  AnalysisTempArticle.initModel(sequelize);
  AnalysisTempHindex.initModel(sequelize);
  AnalysisTempOutputArticle.initModel(sequelize);
  AnalysisTempOutputAuthor.initModel(sequelize);
  Identity.initModel(sequelize);
  JournalImpactAlternative.initModel(sequelize);
  JournalimpactScimago.initModel(sequelize);
  Person.initModel(sequelize);
  PersonArticle.initModel(sequelize);
  PersonArticleAuthor.initModel(sequelize);
  PersonArticleDepartment.initModel(sequelize);
  PersonArticleGrant.initModel(sequelize);
  PersonArticleKeyword.initModel(sequelize);
  PersonArticleRelationship.initModel(sequelize);
  PersonArticleScopusNonTargetAuthorAffiliation.initModel(sequelize);
  PersonArticleScopusTargetAuthorAffiliation.initModel(sequelize);
  PersonPersonType.initModel(sequelize);
  ScienceMetrix.initModel(sequelize);
  AdminSettings.initModel(sequelize);

  AdminUsersDepartment.belongsTo(AdminDepartment, { as: "department", foreignKey: "departmentID"});
  AdminDepartment.hasMany(AdminUsersDepartment, { as: "adminUsersDepartments", foreignKey: "departmentID"});
  AdminUsersRole.belongsTo(AdminRole, { as: "role", foreignKey: "roleID"});
  AdminRole.hasMany(AdminUsersRole, { as: "adminUsersRoles", foreignKey: "roleID"});
  AdminFeedbackLog.belongsTo(AdminUser, { as: "user", foreignKey: "userID"});
  AdminUser.hasMany(AdminFeedbackLog, { as: "adminFeedbackLogs", foreignKey: "userID"});
  AdminNotificationLog.belongsTo(AdminUser, { as: "user", foreignKey: "userID"});
  AdminUser.hasMany(AdminNotificationLog, { as: "adminNotificationLogs", foreignKey: "userID"});
  AdminNotificationPreference.belongsTo(AdminUser, { as: "user", foreignKey: "userID"});
  AdminUser.hasMany(AdminNotificationPreference, { as: "adminNotificationPreferences", foreignKey: "userID"});
  AdminUsersDepartment.belongsTo(AdminUser, { as: "user", foreignKey: "userID"});
  AdminUser.hasMany(AdminUsersDepartment, { as: "adminUsersDepartments", foreignKey: "userID"});
  AdminUsersRole.belongsTo(AdminUser, { as: "user", foreignKey: "userID"});
  AdminUser.hasMany(AdminUsersRole, { as: "adminUsersRoles", foreignKey: "userID"});
  AdminOrcid.belongsTo(AdminUser, { as: "user", foreignKey: "personIdentifier"});


  return {
    Nlm: Nlm,
    AdminDepartment: AdminDepartment,
    AdminFeedbackLog: AdminFeedbackLog,
    AdminNotificationLog: AdminNotificationLog,
    AdminNotificationPreference: AdminNotificationPreference,
    AdminRole: AdminRole,
    AdminUser: AdminUser,
    AdminUsersDepartment: AdminUsersDepartment,
    AdminUsersRole: AdminUsersRole,
    AdminOrcid: AdminOrcid,
    Altmetric: Altmetric,
    AnalysisOverrideAuthorPosition: AnalysisOverrideAuthorPosition,
    AnalysisRcr: AnalysisRcr,
    AnalysisRcrCite: AnalysisRcrCite,
    AnalysisRcrCitesClin: AnalysisRcrCitesClin,
    AnalysisRcrSummary: AnalysisRcrSummary,
    AnalysisRcrYear: AnalysisRcrYear,
    AnalysisSpecialCharacter: AnalysisSpecialCharacter,
    AnalysisSummaryArticle: AnalysisSummaryArticle,
    AnalysisSummaryAuthor: AnalysisSummaryAuthor,
    AnalysisSummaryAuthorList: AnalysisSummaryAuthorList,
    AnalysisSummaryPerson: AnalysisSummaryPerson,
    AnalysisTempArticle: AnalysisTempArticle,
    AnalysisTempHindex: AnalysisTempHindex,
    AnalysisTempOutputArticle: AnalysisTempOutputArticle,
    AnalysisTempOutputAuthor: AnalysisTempOutputAuthor,
    Identity: Identity,
    JournalImpactAlternative: JournalImpactAlternative,
    JournalimpactScimago: JournalimpactScimago,
    Person: Person,
    PersonArticle: PersonArticle,
    PersonArticleAuthor: PersonArticleAuthor,
    PersonArticleDepartment: PersonArticleDepartment,
    PersonArticleGrant: PersonArticleGrant,
    PersonArticleKeyword: PersonArticleKeyword,
    PersonArticleRelationship: PersonArticleRelationship,
    PersonArticleScopusNonTargetAuthorAffiliation: PersonArticleScopusNonTargetAuthorAffiliation,
    PersonArticleScopusTargetAuthorAffiliation: PersonArticleScopusTargetAuthorAffiliation,
    PersonPersonType: PersonPersonType,
    ScienceMetrix: ScienceMetrix,
    AdminSettings:AdminSettings
  };
}
