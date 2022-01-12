import type { Sequelize } from "sequelize";
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
  AdminDepartment,
  AdminFeedbackLog,
  AdminNotificationLog,
  AdminNotificationPreference,
  AdminRole,
  AdminUser,
  AdminUsersDepartment,
  AdminUsersRole,
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
  AdminDepartmentAttributes,
  AdminDepartmentCreationAttributes,
  AdminFeedbackLogAttributes,
  AdminFeedbackLogCreationAttributes,
  AdminNotificationLogAttributes,
  AdminNotificationLogCreationAttributes,
  AdminNotificationPreferenceAttributes,
  AdminNotificationPreferenceCreationAttributes,
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
  AdminDepartment.initModel(sequelize);
  AdminFeedbackLog.initModel(sequelize);
  AdminNotificationLog.initModel(sequelize);
  AdminNotificationPreference.initModel(sequelize);
  AdminRole.initModel(sequelize);
  AdminUser.initModel(sequelize);
  AdminUsersDepartment.initModel(sequelize);
  AdminUsersRole.initModel(sequelize);
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

  return {
    AdminDepartment: AdminDepartment,
    AdminFeedbackLog: AdminFeedbackLog,
    AdminNotificationLog: AdminNotificationLog,
    AdminNotificationPreference: AdminNotificationPreference,
    AdminRole: AdminRole,
    AdminUser: AdminUser,
    AdminUsersDepartment: AdminUsersDepartment,
    AdminUsersRole: AdminUsersRole,
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
