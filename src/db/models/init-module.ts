import type { Sequelize, Model } from "sequelize";
var DataTypes = require("sequelize").DataTypes;
var _Clination = require("./Clination");
var _EmoCueType = require("./EmoCueType");
var _EmoFeedbackType = require("./EmoFeedbackType");
var _FamiliarityFeedbackType = require("./FamiliarityFeedbackType");
var _FamiliarityFeedbackTypeQuestionOption = require("./FamiliarityFeedbackTypeQuestionOption");
var _FamiliarityFeedbackTypeQuestion = require("./FamiliarityFeedbackTypeQuestion");
var _Game = require("./Game");
var _GameBlock = require("./GameBlock");
var _GameRound = require("./GameRound");
var _LookupSubjectStudy = require("./LookupSubjectStudy");
var _Role = require("./Role");
var _Study = require("./Study");
var _Subject = require("./Subject");
var _SubjectCategory = require("./SubjectCategory");
var _SubjectGameRoundTrial = require("./SubjectGameRoundTrial");
var _SubjectGameRound = require("./SubjectGameRound");
var _SubjectGameRoundsFeedbackQuestion = require("./SubjectGameRoundsFeedbackQuestion");
var _User = require("./User");
var _UserRole = require("./UserRole");

function initModels(sequelize: Sequelize) {
  var Clination = _Clination(sequelize, DataTypes);
  var EmoCueType = _EmoCueType(sequelize, DataTypes);
  var EmoFeedbackType = _EmoFeedbackType(sequelize, DataTypes);
  var FamiliarityFeedbackType = _FamiliarityFeedbackType(sequelize, DataTypes);
  var FamiliarityFeedbackTypeQuestionOption = _FamiliarityFeedbackTypeQuestionOption(sequelize, DataTypes);
  var FamiliarityFeedbackTypeQuestion = _FamiliarityFeedbackTypeQuestion(sequelize, DataTypes);
  var Game = _Game(sequelize, DataTypes);
  var GameBlock = _GameBlock(sequelize, DataTypes);
  var GameRound = _GameRound(sequelize, DataTypes);
  var LookupSubjectStudy = _LookupSubjectStudy(sequelize, DataTypes);
  var Role = _Role(sequelize, DataTypes);
  var Study = _Study(sequelize, DataTypes);
  var Subject = _Subject(sequelize, DataTypes);
  var SubjectCategory = _SubjectCategory(sequelize, DataTypes);
  var SubjectGameRoundTrial = _SubjectGameRoundTrial(sequelize, DataTypes);
  var SubjectGameRound = _SubjectGameRound(sequelize, DataTypes);
  var SubjectGameRoundsFeedbackQuestion = _SubjectGameRoundsFeedbackQuestion(sequelize, DataTypes);
  var User = _User(sequelize, DataTypes);
  var UserRole = _UserRole(sequelize, DataTypes);

  Subject.belongsTo(Clination, { as: "familiar_clination", foreignKey: "familiar_clination_id"});
  Clination.hasMany(Subject, { as: "subjects", foreignKey: "familiar_clination_id"});
  Subject.belongsTo(Clination, { as: "unfamiliar_clination", foreignKey: "unfamiliar_clination_id"});
  Clination.hasMany(Subject, { as: "unfamiliar_clination_subjects", foreignKey: "unfamiliar_clination_id"});
  SubjectGameRoundTrial.belongsTo(EmoCueType, { as: "emo_cue_type", foreignKey: "emo_cue_type_id"});
  EmoCueType.hasMany(SubjectGameRoundTrial, { as: "subject_game_round_trials", foreignKey: "emo_cue_type_id"});
  FamiliarityFeedbackTypeQuestion.belongsTo(EmoFeedbackType, { as: "emo_feedback_type", foreignKey: "emo_feedback_type_id"});
  EmoFeedbackType.hasMany(FamiliarityFeedbackTypeQuestion, { as: "familiarity_feedback_type_questions", foreignKey: "emo_feedback_type_id"});
  SubjectGameRoundTrial.belongsTo(EmoFeedbackType, { as: "emo_feedback_type", foreignKey: "emo_feedback_type_id"});
  EmoFeedbackType.hasMany(SubjectGameRoundTrial, { as: "subject_game_round_trials", foreignKey: "emo_feedback_type_id"});
  FamiliarityFeedbackTypeQuestion.belongsTo(FamiliarityFeedbackType, { as: "familiarity_feedback_type", foreignKey: "familiarity_feedback_type_id"});
  FamiliarityFeedbackType.hasMany(FamiliarityFeedbackTypeQuestion, { as: "familiarity_feedback_type_questions", foreignKey: "familiarity_feedback_type_id"});
  GameBlock.belongsTo(FamiliarityFeedbackType, { as: "familiarity_feedback_type", foreignKey: "familiarity_feedback_type_id"});
  FamiliarityFeedbackType.hasMany(GameBlock, { as: "game_blocks", foreignKey: "familiarity_feedback_type_id"});
  SubjectGameRoundsFeedbackQuestion.belongsTo(FamiliarityFeedbackTypeQuestionOption, { as: "familiarity_feedback_type_question_option", foreignKey: "familiarity_feedback_type_question_option_id"});
  FamiliarityFeedbackTypeQuestionOption.hasMany(SubjectGameRoundsFeedbackQuestion, { as: "subject_game_rounds_feedback_questions", foreignKey: "familiarity_feedback_type_question_option_id"});
  FamiliarityFeedbackTypeQuestionOption.belongsTo(FamiliarityFeedbackTypeQuestion, { as: "familiarity_feedback_type_question", foreignKey: "familiarity_feedback_type_question_id"});
  FamiliarityFeedbackTypeQuestion.hasMany(FamiliarityFeedbackTypeQuestionOption, { as: "familiarity_feedback_type_question_options", foreignKey: "familiarity_feedback_type_question_id"});
  FamiliarityFeedbackTypeQuestion.belongsTo(Game, { as: "game", foreignKey: "game_id"});
  Game.hasMany(FamiliarityFeedbackTypeQuestion, { as: "familiarity_feedback_type_questions", foreignKey: "game_id"});
  GameBlock.belongsTo(Game, { as: "game", foreignKey: "game_id"});
  Game.hasMany(GameBlock, { as: "game_blocks", foreignKey: "game_id"});
  GameRound.belongsTo(Game, { as: "game", foreignKey: "game_id"});
  Game.hasMany(GameRound, { as: "game_rounds", foreignKey: "game_id"});
  Study.belongsTo(Game, { as: "game", foreignKey: "game_id"});
  Game.hasMany(Study, { as: "studies", foreignKey: "game_id"});
  SubjectGameRoundTrial.belongsTo(GameBlock, { as: "game_block", foreignKey: "game_block_id"});
  GameBlock.hasMany(SubjectGameRoundTrial, { as: "subject_game_round_trials", foreignKey: "game_block_id"});
  SubjectGameRound.belongsTo(GameRound, { as: "game_round", foreignKey: "game_round_id"});
  GameRound.hasMany(SubjectGameRound, { as: "subject_game_rounds", foreignKey: "game_round_id"});
  SubjectGameRound.belongsTo(LookupSubjectStudy, { as: "lookup_subject_study", foreignKey: "lookup_subject_study_id"});
  LookupSubjectStudy.hasMany(SubjectGameRound, { as: "subject_game_rounds", foreignKey: "lookup_subject_study_id"});
  UserRole.belongsTo(Role, { as: "role", foreignKey: "role_id"});
  Role.hasMany(UserRole, { as: "user_roles", foreignKey: "role_id"});
  LookupSubjectStudy.belongsTo(Study, { as: "study", foreignKey: "study_id"});
  Study.hasMany(LookupSubjectStudy, { as: "lookup_subject_studies", foreignKey: "study_id"});
  LookupSubjectStudy.belongsTo(Subject, { as: "subject", foreignKey: "subject_id"});
  Subject.hasMany(LookupSubjectStudy, { as: "lookup_subject_studies", foreignKey: "subject_id"});
  Subject.belongsTo(SubjectCategory, { as: "category", foreignKey: "category_id"});
  SubjectCategory.hasMany(Subject, { as: "subjects", foreignKey: "category_id"});
  SubjectGameRoundTrial.belongsTo(SubjectGameRound, { as: "subject_game_round", foreignKey: "subject_game_round_id"});
  SubjectGameRound.hasMany(SubjectGameRoundTrial, { as: "subject_game_round_trials", foreignKey: "subject_game_round_id"});
  SubjectGameRoundsFeedbackQuestion.belongsTo(SubjectGameRound, { as: "game_round", foreignKey: "game_round_id"});
  SubjectGameRound.hasMany(SubjectGameRoundsFeedbackQuestion, { as: "subject_game_rounds_feedback_questions", foreignKey: "game_round_id"});
  Clination.belongsTo(User, { as: "created_by_user", foreignKey: "created_by"});
  User.hasMany(Clination, { as: "clinations", foreignKey: "created_by"});
  Clination.belongsTo(User, { as: "updated_by_user", foreignKey: "updated_by"});
  User.hasMany(Clination, { as: "updated_by_clinations", foreignKey: "updated_by"});
  Game.belongsTo(User, { as: "created_by_user", foreignKey: "created_by"});
  User.hasMany(Game, { as: "games", foreignKey: "created_by"});
  Game.belongsTo(User, { as: "updated_by_user", foreignKey: "updated_by"});
  User.hasMany(Game, { as: "updated_by_games", foreignKey: "updated_by"});
  LookupSubjectStudy.belongsTo(User, { as: "created_by_user", foreignKey: "created_by"});
  User.hasMany(LookupSubjectStudy, { as: "lookup_subject_studies", foreignKey: "created_by"});
  LookupSubjectStudy.belongsTo(User, { as: "updated_by_user", foreignKey: "updated_by"});
  User.hasMany(LookupSubjectStudy, { as: "updated_by_lookup_subject_studies", foreignKey: "updated_by"});
  Subject.belongsTo(User, { as: "created_by_user", foreignKey: "created_by"});
  User.hasMany(Subject, { as: "subjects", foreignKey: "created_by"});
  Subject.belongsTo(User, { as: "updated_by_user", foreignKey: "updated_by"});
  User.hasMany(Subject, { as: "updated_by_subjects", foreignKey: "updated_by"});
  SubjectCategory.belongsTo(User, { as: "created_by_user", foreignKey: "created_by"});
  User.hasMany(SubjectCategory, { as: "subject_categories", foreignKey: "created_by"});
  SubjectCategory.belongsTo(User, { as: "updated_by_user", foreignKey: "updated_by"});
  User.hasMany(SubjectCategory, { as: "updated_by_subject_categories", foreignKey: "updated_by"});
  UserRole.belongsTo(User, { as: "user", foreignKey: "user_id"});
  User.hasMany(UserRole, { as: "user_roles", foreignKey: "user_id"});

  return {
    Clination,
    EmoCueType,
    EmoFeedbackType,
    FamiliarityFeedbackType,
    FamiliarityFeedbackTypeQuestionOption,
    FamiliarityFeedbackTypeQuestion,
    Game,
    GameBlock,
    GameRound,
    LookupSubjectStudy,
    Role,
    Study,
    Subject,
    SubjectCategory,
    SubjectGameRoundTrial,
    SubjectGameRound,
    SubjectGameRoundsFeedbackQuestion,
    User,
    UserRole,
  };
}
module.exports = initModels;
module.exports.initModels = initModels;
module.exports.default = initModels;

export default initModels