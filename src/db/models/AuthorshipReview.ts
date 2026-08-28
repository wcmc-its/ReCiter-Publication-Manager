import * as Sequelize from 'sequelize';
import { DataTypes, Model, Optional } from 'sequelize';

// Durable reciterdb table `authorship_review` (see ReCiterDB/setup/table_authorship_review.sql).
// One row per WCM-affiliated authorship not assigned to any identity, written by the
// adversarial-attribution-review producer. Column names are snake_case to match that table.
export interface AuthorshipReviewAttributes {
  id: number;
  source: 'pubmed' | 'scopus';
  pmid?: number;                 // NULL for scopus rows (no PMID)
  external_id?: string;          // numeric Scopus record ID (scopus rows)
  author_key: string;
  pub_type?: string;             // Scopus subtypeDescription (Article / Book Chapter / …)
  container_id?: string;         // book base DOI (scopus book chapters)
  author_position?: number;
  author_position_label?: string;
  wcm_author?: string;
  author_affiliation?: string;
  entrez_date?: string;
  title?: string;
  journal?: string;
  doi?: string;
  classification?: 'assigned' | 'suggested' | 'buried' | 'absent';
  top_cwid?: string;
  top_name?: string;
  top_person_type?: string;
  top_dept?: string;
  top_fg_score?: number;
  top_io_score?: number;
  top_confidence?: number;
  top_cohort_size?: number;
  top_given_match?: string;
  top_affil_match?: boolean;
  n_candidates?: number;
  single_candidate?: boolean;
  candidate_cwids_json?: string;
  authors_json?: string;
  dup_flag?: boolean;
  dup_reason?: string;
  accept_conflict?: string;
  status: 'open' | 'assigned' | 'accepted' | 'rejected' | 'dismissed' | 'snoozed';
  resolution_cwid?: string;
  reviewer?: string;
  note?: string;
  snooze_until?: string;
  resolved_at?: Date;
  first_seen?: Date;
  last_refreshed?: Date;
  last_checked?: Date;
}

export type AuthorshipReviewPk = "id";
export type AuthorshipReviewId = AuthorshipReview[AuthorshipReviewPk];
export type AuthorshipReviewOptionalAttributes = "id" | "source" | "pmid" | "external_id" | "pub_type" | "container_id" | "author_position" | "author_position_label" | "wcm_author" | "author_affiliation" | "entrez_date" | "title" | "journal" | "doi" | "classification" | "top_cwid" | "top_name" | "top_person_type" | "top_dept" | "top_fg_score" | "top_io_score" | "top_confidence" | "top_cohort_size" | "top_given_match" | "top_affil_match" | "n_candidates" | "single_candidate" | "candidate_cwids_json" | "authors_json" | "dup_flag" | "dup_reason" | "accept_conflict" | "status" | "resolution_cwid" | "reviewer" | "note" | "snooze_until" | "resolved_at" | "first_seen" | "last_refreshed" | "last_checked";
export type AuthorshipReviewCreationAttributes = Optional<AuthorshipReviewAttributes, AuthorshipReviewOptionalAttributes>;

export class AuthorshipReview extends Model<AuthorshipReviewAttributes, AuthorshipReviewCreationAttributes> implements AuthorshipReviewAttributes {
  id!: number;
  source!: 'pubmed' | 'scopus';
  pmid?: number;
  external_id?: string;
  author_key!: string;
  pub_type?: string;
  container_id?: string;
  author_position?: number;
  author_position_label?: string;
  wcm_author?: string;
  author_affiliation?: string;
  entrez_date?: string;
  title?: string;
  journal?: string;
  doi?: string;
  classification?: 'assigned' | 'suggested' | 'buried' | 'absent';
  top_cwid?: string;
  top_name?: string;
  top_person_type?: string;
  top_dept?: string;
  top_fg_score?: number;
  top_io_score?: number;
  top_confidence?: number;
  top_cohort_size?: number;
  top_given_match?: string;
  top_affil_match?: boolean;
  n_candidates?: number;
  single_candidate?: boolean;
  candidate_cwids_json?: string;
  authors_json?: string;
  dup_flag?: boolean;
  dup_reason?: string;
  accept_conflict?: string;
  status!: 'open' | 'assigned' | 'accepted' | 'rejected' | 'dismissed' | 'snoozed';
  resolution_cwid?: string;
  reviewer?: string;
  note?: string;
  snooze_until?: string;
  resolved_at?: Date;
  first_seen?: Date;
  last_refreshed?: Date;
  last_checked?: Date;

  static initModel(sequelize: Sequelize.Sequelize): typeof AuthorshipReview {
    AuthorshipReview.init({
      id: { autoIncrement: true, type: DataTypes.BIGINT, allowNull: false, primaryKey: true },
      source: { type: DataTypes.ENUM('pubmed', 'scopus'), allowNull: false, defaultValue: 'pubmed' },
      pmid: { type: DataTypes.BIGINT, allowNull: true },
      external_id: { type: DataTypes.STRING(96), allowNull: true },
      author_key: { type: DataTypes.STRING(160), allowNull: false },
      pub_type: { type: DataTypes.STRING(40), allowNull: true },
      container_id: { type: DataTypes.STRING(96), allowNull: true },
      author_position: { type: DataTypes.INTEGER, allowNull: true },
      author_position_label: { type: DataTypes.STRING(8), allowNull: true },
      wcm_author: { type: DataTypes.STRING(255), allowNull: true },
      author_affiliation: { type: DataTypes.TEXT, allowNull: true },
      entrez_date: { type: DataTypes.DATEONLY, allowNull: true },
      title: { type: DataTypes.TEXT, allowNull: true },
      journal: { type: DataTypes.STRING(512), allowNull: true },
      doi: { type: DataTypes.STRING(255), allowNull: true },
      classification: { type: DataTypes.ENUM('assigned', 'suggested', 'buried', 'absent'), allowNull: true },
      top_cwid: { type: DataTypes.STRING(32), allowNull: true },
      top_name: { type: DataTypes.STRING(255), allowNull: true },
      top_person_type: { type: DataTypes.STRING(64), allowNull: true },
      top_dept: { type: DataTypes.STRING(255), allowNull: true },
      top_fg_score: { type: DataTypes.FLOAT, allowNull: true },
      top_io_score: { type: DataTypes.FLOAT, allowNull: true },
      top_confidence: { type: DataTypes.FLOAT, allowNull: true },
      top_cohort_size: { type: DataTypes.INTEGER, allowNull: true },
      top_given_match: { type: DataTypes.STRING(16), allowNull: true },
      top_affil_match: { type: DataTypes.BOOLEAN, allowNull: true },
      n_candidates: { type: DataTypes.INTEGER, allowNull: true },
      single_candidate: { type: DataTypes.BOOLEAN, allowNull: true },
      candidate_cwids_json: { type: DataTypes.TEXT({ length: 'long' }), allowNull: true },
      authors_json: { type: DataTypes.TEXT({ length: 'long' }), allowNull: true },
      dup_flag: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      dup_reason: { type: DataTypes.STRING(255), allowNull: true },
      // Set when an Accept came back 409 from ExternalArticleDupCheck (fuzzy title+year
      // WARNING). Distinct from dup_flag/dup_reason, which are the AAR producer's exact-DOI
      // precheck: different mechanism, different provenance, and the producer refreshes those.
      accept_conflict: { type: DataTypes.STRING(500), allowNull: true },
      status: { type: DataTypes.ENUM('open', 'assigned', 'accepted', 'rejected', 'dismissed', 'snoozed'), allowNull: false, defaultValue: 'open' },
      resolution_cwid: { type: DataTypes.STRING(32), allowNull: true },
      reviewer: { type: DataTypes.STRING(64), allowNull: true },
      note: { type: DataTypes.TEXT, allowNull: true },
      snooze_until: { type: DataTypes.DATEONLY, allowNull: true },
      resolved_at: { type: DataTypes.DATE, allowNull: true },
      first_seen: { type: DataTypes.DATE, allowNull: true },
      last_refreshed: { type: DataTypes.DATE, allowNull: true },
      last_checked: { type: DataTypes.DATE, allowNull: true }
    }, {
      sequelize,
      tableName: 'authorship_review',
      timestamps: false,
      indexes: [
        { name: "PRIMARY", unique: true, using: "BTREE", fields: [{ name: "id" }] },
        { name: "uq_author_key", unique: true, using: "BTREE", fields: [{ name: "author_key" }] },
        { name: "ix_source", using: "BTREE", fields: [{ name: "source" }] },
        { name: "ix_pmid", using: "BTREE", fields: [{ name: "pmid" }] },
        { name: "ix_classification", using: "BTREE", fields: [{ name: "classification" }] },
        { name: "ix_status", using: "BTREE", fields: [{ name: "status" }] },
        { name: "ix_single_candidate", using: "BTREE", fields: [{ name: "single_candidate" }] },
        { name: "ix_top_io_score", using: "BTREE", fields: [{ name: "top_io_score" }] },
        { name: "ix_entrez_date", using: "BTREE", fields: [{ name: "entrez_date" }] },
        { name: "ix_top_cwid", using: "BTREE", fields: [{ name: "top_cwid" }] },
      ]
    });
    return AuthorshipReview;
  }
}
