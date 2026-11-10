import models from "../../../src/db/sequelize";

// The report controllers' Sequelize associations, registered ONCE per process. Both controllers
// used to register their own at module load against the same shared `models`, so whichever
// loaded second could throw SequelizeAssociationError ("You have used the alias
// AnalysisSummaryAuthor in two separate associations"): an export or count request first after
// a pod restart left /report search failing until the next restart (prod, 2026-11-10). This
// order (search's block, then the export controller's) is the one that loads cleanly.
models.AnalysisSummaryArticle.hasOne(models.Person, { constraints: false, foreignKey: "AnalysisSummaryArticleId" });
models.AnalysisSummaryArticle.hasMany(models.PersonPersonType, { constraints: false, foreignKey: "AnalysisSummaryArticleId" });
models.PersonPersonType.belongsToMany(models.AnalysisSummaryArticle, { through: models.AnalysisSummaryAuthor });
models.AnalysisSummaryArticle.hasOne(models.AnalysisSummaryAuthor, { constraints: false, foreignKey: "AnalysisSummaryArticleId" });
models.AnalysisSummaryAuthor.hasOne(models.AnalysisSummaryArticle, { constraints: false });
