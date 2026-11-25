import * as Sequelize from 'sequelize';
import { DataTypes, Model, Optional } from 'sequelize';

// reciterdb `external_record` (ReCiterDB setup/table_external_record.sql, migration v3.6): the
// system of record for every external and manual work, one row per person per source record.
// external_article stays the nightly reporting projection and is rebuilt from this table (plan
// R2). Lifecycle rules: src/lib/externalLifecycle.ts. Reads and writes: src/lib/externalStore.ts.
//
// `doi_norm` is a STORED generated column: it is declared here so reads return it, and listed in
// EXTERNAL_RECORD_GENERATED so the store never writes it (MariaDB refuses a value for it).
// `created_at` / `updated_at` are filled by the database.

export type ExternalStatus = 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'REMOVED' | 'MERGED' | 'AUTOMERGED' | 'SUPERSEDED';
export type ExternalSourceType = 'SCOPUS' | 'WOS' | 'OPENALEX' | 'CROSSREF' | 'MANUAL' | 'ORCID';
export type ExternalProvenance =
  'ORCID_SELF' | 'ORCID_CROSSREF' | 'ORCID_SCOPUS' | 'SCOPUS_AUID' | 'OPENALEX_AUTHOR' | 'MANUAL' | 'ADD_SEARCH' | 'AUTHORSHIPS';

const STATUS_VALUES = ['PENDING', 'ACCEPTED', 'REJECTED', 'REMOVED', 'MERGED', 'AUTOMERGED', 'SUPERSEDED'];

export interface ExternalRecordAttributes {
  id: number;
  uid: string;
  article_id: string;
  source_type: ExternalSourceType;
  status: ExternalStatus;
  prev_status?: ExternalStatus | null;
  status_by?: string | null;
  status_impersonated_by?: string | null;
  status_at?: Date | null;
  added_by?: string | null;
  added_at?: Date | null;
  provenance?: ExternalProvenance | null;
  method?: string | null;
  merged_into_id?: number | null;
  merged_into_pmid?: number | null;
  superseded_by_pmid?: number | null;
  pmid?: number | null;
  doi?: string | null;
  doi_norm?: string | null;
  isbn?: string | null;
  scopus_eid?: string | null;
  openalex_id?: string | null;
  orcid_put_code?: string | null;
  url?: string | null;
  title?: string | null;
  title_year_key?: string | null;
  pub_type?: string | null;
  source_pub_type?: string | null;
  type_notice?: 'erratum' | 'retraction' | null;
  peer_reviewed?: number | null;
  peer_reviewed_by_hand: number;
  role?: 'Author' | 'Editor' | 'Section editor' | 'Translator' | null;
  pub_date?: string | null;
  date_precision?: 'YEAR' | 'MONTH' | 'DAY' | null;
  container_title?: string | null;
  publisher?: string | null;
  volume?: string | null;
  issue?: string | null;
  pages?: string | null;
  fields_json?: string | null;   // JSON text; MariaDB JSON is LONGTEXT, so it is (de)serialized by the store
  authors_json?: string | null;  // JSON text: [{given, surname}] in byline order
  target_author_index?: number | null;
  author_count?: number | null;
  byline?: string | null;
  raw_record?: string | null;
  sync_origin: 'DYNAMO' | 'PM';
  pm_touched: number;
  created_at?: Date;
  updated_at?: Date;
}

export type ExternalRecordPk = "id";
export type ExternalRecordId = ExternalRecord[ExternalRecordPk];
export type ExternalRecordOptionalAttributes = Exclude<keyof ExternalRecordAttributes, "uid" | "article_id" | "source_type">;
export type ExternalRecordCreationAttributes = Optional<ExternalRecordAttributes, ExternalRecordOptionalAttributes>;

// Columns the database computes; never part of an INSERT or UPDATE.
export const EXTERNAL_RECORD_GENERATED = ['id', 'doi_norm', 'created_at', 'updated_at'] as const;

export class ExternalRecord extends Model<ExternalRecordAttributes, ExternalRecordCreationAttributes> implements ExternalRecordAttributes {
  id!: number;
  uid!: string;
  article_id!: string;
  source_type!: ExternalSourceType;
  status!: ExternalStatus;
  prev_status?: ExternalStatus | null;
  status_by?: string | null;
  status_impersonated_by?: string | null;
  status_at?: Date | null;
  added_by?: string | null;
  added_at?: Date | null;
  provenance?: ExternalProvenance | null;
  method?: string | null;
  merged_into_id?: number | null;
  merged_into_pmid?: number | null;
  superseded_by_pmid?: number | null;
  pmid?: number | null;
  doi?: string | null;
  doi_norm?: string | null;
  isbn?: string | null;
  scopus_eid?: string | null;
  openalex_id?: string | null;
  orcid_put_code?: string | null;
  url?: string | null;
  title?: string | null;
  title_year_key?: string | null;
  pub_type?: string | null;
  source_pub_type?: string | null;
  type_notice?: 'erratum' | 'retraction' | null;
  peer_reviewed?: number | null;
  peer_reviewed_by_hand!: number;
  role?: 'Author' | 'Editor' | 'Section editor' | 'Translator' | null;
  pub_date?: string | null;
  date_precision?: 'YEAR' | 'MONTH' | 'DAY' | null;
  container_title?: string | null;
  publisher?: string | null;
  volume?: string | null;
  issue?: string | null;
  pages?: string | null;
  fields_json?: string | null;
  authors_json?: string | null;
  target_author_index?: number | null;
  author_count?: number | null;
  byline?: string | null;
  raw_record?: string | null;
  sync_origin!: 'DYNAMO' | 'PM';
  pm_touched!: number;
  created_at?: Date;
  updated_at?: Date;

  static initModel(sequelize: Sequelize.Sequelize): typeof ExternalRecord {
    ExternalRecord.init({
      id: { autoIncrement: true, type: DataTypes.BIGINT, allowNull: false, primaryKey: true },
      uid: { type: DataTypes.STRING(64), allowNull: false },
      article_id: { type: DataTypes.STRING(96), allowNull: false },
      source_type: { type: DataTypes.ENUM('SCOPUS', 'WOS', 'OPENALEX', 'CROSSREF', 'MANUAL', 'ORCID'), allowNull: false },
      status: { type: DataTypes.ENUM(...STATUS_VALUES), allowNull: false, defaultValue: 'PENDING' },
      prev_status: { type: DataTypes.ENUM(...STATUS_VALUES), allowNull: true },
      status_by: { type: DataTypes.STRING(64), allowNull: true },
      status_impersonated_by: { type: DataTypes.STRING(64), allowNull: true },
      status_at: { type: DataTypes.DATE(3), allowNull: true },
      added_by: { type: DataTypes.STRING(64), allowNull: true },
      added_at: { type: DataTypes.DATE(3), allowNull: true },
      provenance: {
        type: DataTypes.ENUM('ORCID_SELF', 'ORCID_CROSSREF', 'ORCID_SCOPUS', 'SCOPUS_AUID', 'OPENALEX_AUTHOR', 'MANUAL', 'ADD_SEARCH', 'AUTHORSHIPS'),
        allowNull: true,
      },
      method: { type: DataTypes.STRING(64), allowNull: true },
      merged_into_id: { type: DataTypes.BIGINT, allowNull: true },
      merged_into_pmid: { type: DataTypes.BIGINT, allowNull: true },
      superseded_by_pmid: { type: DataTypes.BIGINT, allowNull: true },
      pmid: { type: DataTypes.BIGINT, allowNull: true },
      doi: { type: DataTypes.STRING(255), allowNull: true },
      doi_norm: { type: DataTypes.STRING(255), allowNull: true },  // generated (STORED); read-only
      isbn: { type: DataTypes.STRING(128), allowNull: true },
      scopus_eid: { type: DataTypes.STRING(64), allowNull: true },
      openalex_id: { type: DataTypes.STRING(64), allowNull: true },
      orcid_put_code: { type: DataTypes.STRING(32), allowNull: true },
      url: { type: DataTypes.STRING(1024), allowNull: true },
      title: { type: DataTypes.TEXT, allowNull: true },
      title_year_key: { type: DataTypes.CHAR(40), allowNull: true },
      pub_type: { type: DataTypes.STRING(40), allowNull: true },
      source_pub_type: { type: DataTypes.STRING(64), allowNull: true },
      type_notice: { type: DataTypes.ENUM('erratum', 'retraction'), allowNull: true },
      peer_reviewed: { type: DataTypes.TINYINT, allowNull: true },
      peer_reviewed_by_hand: { type: DataTypes.TINYINT, allowNull: false, defaultValue: 0 },
      role: { type: DataTypes.ENUM('Author', 'Editor', 'Section editor', 'Translator'), allowNull: true },
      pub_date: { type: DataTypes.STRING(32), allowNull: true },
      date_precision: { type: DataTypes.ENUM('YEAR', 'MONTH', 'DAY'), allowNull: true },
      container_title: { type: DataTypes.STRING(512), allowNull: true },
      publisher: { type: DataTypes.STRING(255), allowNull: true },
      volume: { type: DataTypes.STRING(64), allowNull: true },
      issue: { type: DataTypes.STRING(64), allowNull: true },
      pages: { type: DataTypes.STRING(64), allowNull: true },
      fields_json: { type: DataTypes.TEXT('long'), allowNull: true },
      authors_json: { type: DataTypes.TEXT('long'), allowNull: true },
      target_author_index: { type: DataTypes.SMALLINT, allowNull: true },
      author_count: { type: DataTypes.SMALLINT, allowNull: true },
      byline: { type: DataTypes.STRING(1000), allowNull: true },
      raw_record: { type: DataTypes.TEXT('long'), allowNull: true },
      sync_origin: { type: DataTypes.ENUM('DYNAMO', 'PM'), allowNull: false, defaultValue: 'PM' },
      pm_touched: { type: DataTypes.TINYINT, allowNull: false, defaultValue: 0 },
      created_at: { type: DataTypes.DATE(3), allowNull: true },  // database default
      updated_at: { type: DataTypes.DATE(3), allowNull: true },  // database default + ON UPDATE
    }, {
      sequelize,
      // Pinned: `next build` minifies the class name, and an unpinned alias breaks any
      // hand-written col("ExternalRecord.x") in production (see AuthorshipReview.ts).
      modelName: 'ExternalRecord',
      tableName: 'external_record',
      timestamps: false,
      indexes: [
        { name: "PRIMARY", unique: true, using: "BTREE", fields: [{ name: "id" }] },
        { name: "uq_er_uid_article", unique: true, using: "BTREE", fields: [{ name: "uid" }, { name: "article_id" }] },
        { name: "ix_er_uid_status", using: "BTREE", fields: [{ name: "uid" }, { name: "status" }] },
        { name: "ix_er_doi_norm", using: "BTREE", fields: [{ name: "doi_norm" }] },
        { name: "ix_er_uid_title_year", using: "BTREE", fields: [{ name: "uid" }, { name: "title_year_key" }] },
        { name: "ix_er_pmid", using: "BTREE", fields: [{ name: "pmid" }] },
      ]
    });
    return ExternalRecord;
  }
}
