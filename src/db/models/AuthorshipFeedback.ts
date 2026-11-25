import * as Sequelize from 'sequelize';
import { DataTypes, Model, Optional } from 'sequelize';

// reciterdb `authorship_feedback` (ReCiterDB setup/table_authorship_feedback_v3.20.sql): one problem
// report from /authorships. PM writes the report and its snapshots once; status, claimed_*,
// duplicate_of, diagnosis, resolution_ref and handled_at belong to the diagnosing skill.
//
// Pass logging: false on every call. Sequelize errors carry the bound values, so a caught error
// here must never be logged whole (see src/lib/authorshipFeedback.ts errorInfo).

export interface AuthorshipFeedbackAttributes {
  id: number;
  client_uuid: string;
  created_at: Date;
  reported_by: string;
  viewing_as?: string | null;
  host: string;
  review_id?: number | null;
  author_key?: string | null;
  source?: string | null;
  pmid?: number | null;
  external_id?: string | null;
  trigger_place: string;
  category: string;
  about_cwids?: string | null;
  expected?: string | null;
  typed_ref?: string | null;
  comment: string;
  snapshot_version: number;
  client_build?: string | null;
  server_build?: string | null;
  client_snapshot: string;
  server_snapshot?: string | null;
  snapshot_state: 'pending' | 'complete' | 'partial';
  status: 'new' | 'diagnosing' | 'needs_info' | 'awaiting_approval' | 'pr_open' | 'fixed' | 'not_a_bug' | 'duplicate';
  claimed_by?: string | null;
  claimed_at?: Date | null;
  duplicate_of?: number | null;
  diagnosis?: string | null;
  resolution_ref?: string | null;
  handled_at?: Date | null;
}

export type AuthorshipFeedbackPk = "id";
export type AuthorshipFeedbackId = AuthorshipFeedback[AuthorshipFeedbackPk];
export type AuthorshipFeedbackOptionalAttributes = "id" | "viewing_as" | "review_id" | "author_key" | "source" | "pmid" | "external_id" | "about_cwids" | "expected" | "typed_ref" | "client_build" | "server_build" | "server_snapshot" | "snapshot_state" | "status" | "claimed_by" | "claimed_at" | "duplicate_of" | "diagnosis" | "resolution_ref" | "handled_at";
export type AuthorshipFeedbackCreationAttributes = Optional<AuthorshipFeedbackAttributes, AuthorshipFeedbackOptionalAttributes>;

export class AuthorshipFeedback extends Model<AuthorshipFeedbackAttributes, AuthorshipFeedbackCreationAttributes> implements AuthorshipFeedbackAttributes {
  id!: number;
  client_uuid!: string;
  created_at!: Date;
  reported_by!: string;
  viewing_as?: string | null;
  host!: string;
  review_id?: number | null;
  author_key?: string | null;
  source?: string | null;
  pmid?: number | null;
  external_id?: string | null;
  trigger_place!: string;
  category!: string;
  about_cwids?: string | null;
  expected?: string | null;
  typed_ref?: string | null;
  comment!: string;
  snapshot_version!: number;
  client_build?: string | null;
  server_build?: string | null;
  client_snapshot!: string;
  server_snapshot?: string | null;
  snapshot_state!: 'pending' | 'complete' | 'partial';
  status!: 'new' | 'diagnosing' | 'needs_info' | 'awaiting_approval' | 'pr_open' | 'fixed' | 'not_a_bug' | 'duplicate';
  claimed_by?: string | null;
  claimed_at?: Date | null;
  duplicate_of?: number | null;
  diagnosis?: string | null;
  resolution_ref?: string | null;
  handled_at?: Date | null;

  static initModel(sequelize: Sequelize.Sequelize): typeof AuthorshipFeedback {
    AuthorshipFeedback.init({
      id: { autoIncrement: true, type: DataTypes.BIGINT, allowNull: false, primaryKey: true },
      client_uuid: { type: DataTypes.CHAR(36), allowNull: false },
      created_at: { type: DataTypes.DATE(3), allowNull: false },
      reported_by: { type: DataTypes.STRING(64), allowNull: false },
      viewing_as: { type: DataTypes.STRING(64), allowNull: true },
      host: { type: DataTypes.STRING(128), allowNull: false },
      review_id: { type: DataTypes.BIGINT, allowNull: true },
      author_key: { type: DataTypes.STRING(160), allowNull: true },
      source: { type: DataTypes.STRING(16), allowNull: true },
      pmid: { type: DataTypes.BIGINT, allowNull: true },
      external_id: { type: DataTypes.STRING(96), allowNull: true },
      trigger_place: { type: DataTypes.STRING(32), allowNull: false },
      category: { type: DataTypes.STRING(32), allowNull: false },
      about_cwids: { type: DataTypes.TEXT({ length: 'long' }), allowNull: true },  // MariaDB JSON: written and read as text
      expected: { type: DataTypes.STRING(255), allowNull: true },
      typed_ref: { type: DataTypes.STRING(255), allowNull: true },
      comment: { type: DataTypes.TEXT, allowNull: false },
      snapshot_version: { type: DataTypes.SMALLINT, allowNull: false },
      client_build: { type: DataTypes.STRING(64), allowNull: true },
      server_build: { type: DataTypes.STRING(64), allowNull: true },
      client_snapshot: { type: DataTypes.TEXT({ length: 'long' }), allowNull: false },
      server_snapshot: { type: DataTypes.TEXT({ length: 'long' }), allowNull: true },
      snapshot_state: { type: DataTypes.ENUM('pending', 'complete', 'partial'), allowNull: false, defaultValue: 'pending' },
      status: { type: DataTypes.ENUM('new', 'diagnosing', 'needs_info', 'awaiting_approval', 'pr_open', 'fixed', 'not_a_bug', 'duplicate'), allowNull: false, defaultValue: 'new' },
      claimed_by: { type: DataTypes.STRING(64), allowNull: true },
      claimed_at: { type: DataTypes.DATE(3), allowNull: true },
      duplicate_of: { type: DataTypes.BIGINT, allowNull: true },
      diagnosis: { type: DataTypes.TEXT, allowNull: true },
      resolution_ref: { type: DataTypes.STRING(255), allowNull: true },
      handled_at: { type: DataTypes.DATE(3), allowNull: true },
    }, {
      sequelize,
      modelName: 'AuthorshipFeedback',  // pinned against `next build` minification
      tableName: 'authorship_feedback',
      timestamps: false,
      indexes: [
        { name: "PRIMARY", unique: true, using: "BTREE", fields: [{ name: "id" }] },
        { name: "uq_client_uuid", unique: true, using: "BTREE", fields: [{ name: "client_uuid" }] },
        { name: "ix_review", using: "BTREE", fields: [{ name: "review_id" }] },
        { name: "ix_author_key", using: "BTREE", fields: [{ name: "author_key" }] },
        { name: "ix_status", using: "BTREE", fields: [{ name: "status" }, { name: "created_at" }] },
      ]
    });
    return AuthorshipFeedback;
  }
}
