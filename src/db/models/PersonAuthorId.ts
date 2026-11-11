import * as Sequelize from 'sequelize';
import { DataTypes, Model, Optional } from 'sequelize';

// reciterdb.person_author_id (ReCiterDB setup/table_person_author_id_import_harvest_v3.8.sql):
// each person's Scopus Author IDs and OpenAlex author ids. Written nightly by ReCiterDB's
// update/authorIdSuggestions.py and by the Manage Profile "Author profiles" card
// (/api/db/author-ids/[uid]). Absent on a reciterdb the v3.8 DDL has not reached yet; the
// controller treats that as "feature unavailable", never as an error.
export interface PersonAuthorIdAttributes {
  id: number;
  uid: string;
  id_type: 'SCOPUS_AUID' | 'OPENALEX_AUTHOR';
  id_value: string;
  status: 'SUGGESTED' | 'CONFIRMED' | 'REJECTED';
  method: 'PUB_VOTE' | 'ORCID_LOOKUP' | 'AUTO' | 'CURATOR';
  votes: number;
  resolvable: number;
  share?: string | number | null;
  evidence_json?: string | object | null;
  conflict_uid?: string | null;
  decided_by?: string | null;
  decided_at?: Date | null;
  note?: string | null;
  first_seen: Date;
  last_seen: Date;
}

export type PersonAuthorIdPk = "id";
export type PersonAuthorIdId = PersonAuthorId[PersonAuthorIdPk];
export type PersonAuthorIdOptionalAttributes = "id" | "status" | "votes" | "resolvable" | "share" | "evidence_json" | "conflict_uid" | "decided_by" | "decided_at" | "note";
export type PersonAuthorIdCreationAttributes = Optional<PersonAuthorIdAttributes, PersonAuthorIdOptionalAttributes>;

export class PersonAuthorId extends Model<PersonAuthorIdAttributes, PersonAuthorIdCreationAttributes> implements PersonAuthorIdAttributes {
  id!: number;
  uid!: string;
  id_type!: 'SCOPUS_AUID' | 'OPENALEX_AUTHOR';
  id_value!: string;
  status!: 'SUGGESTED' | 'CONFIRMED' | 'REJECTED';
  method!: 'PUB_VOTE' | 'ORCID_LOOKUP' | 'AUTO' | 'CURATOR';
  votes!: number;
  resolvable!: number;
  share?: string | number | null;
  evidence_json?: string | object | null;
  conflict_uid?: string | null;
  decided_by?: string | null;
  decided_at?: Date | null;
  note?: string | null;
  first_seen!: Date;
  last_seen!: Date;

  static initModel(sequelize: Sequelize.Sequelize): typeof PersonAuthorId {
    PersonAuthorId.init({
      id: { autoIncrement: true, type: DataTypes.BIGINT, allowNull: false, primaryKey: true },
      uid: { type: DataTypes.STRING(64), allowNull: false },
      id_type: { type: DataTypes.ENUM('SCOPUS_AUID', 'OPENALEX_AUTHOR'), allowNull: false },
      id_value: { type: DataTypes.STRING(32), allowNull: false },
      status: { type: DataTypes.ENUM('SUGGESTED', 'CONFIRMED', 'REJECTED'), allowNull: false, defaultValue: 'SUGGESTED' },
      method: { type: DataTypes.ENUM('PUB_VOTE', 'ORCID_LOOKUP', 'AUTO', 'CURATOR'), allowNull: false },
      votes: { type: DataTypes.SMALLINT, allowNull: false, defaultValue: 0 },
      resolvable: { type: DataTypes.SMALLINT, allowNull: false, defaultValue: 0 },
      share: { type: DataTypes.DECIMAL(4, 3), allowNull: true },
      // JSON in the DDL. Typed as TEXT so a MariaDB JSON (LONGTEXT alias) and a MySQL JSON
      // column read the same way; parseEvidence() in src/utils/authorIds.ts handles both.
      evidence_json: { type: DataTypes.TEXT, allowNull: true },
      conflict_uid: { type: DataTypes.STRING(64), allowNull: true },
      decided_by: { type: DataTypes.STRING(64), allowNull: true },
      decided_at: { type: DataTypes.DATE, allowNull: true },
      note: { type: DataTypes.STRING(500), allowNull: true },
      first_seen: { type: DataTypes.DATE, allowNull: false },
      last_seen: { type: DataTypes.DATE, allowNull: false },
    }, {
      sequelize,
      // Pin the model name: without it `next build` minifies the class name and the alias
      // becomes `n` (memory pm-sequelize-modelname-minification).
      modelName: 'PersonAuthorId',
      tableName: 'person_author_id',
      timestamps: false,
      indexes: [
        { name: "PRIMARY", unique: true, using: "BTREE", fields: [{ name: "id" }] },
        { name: "uq_person_author_id", unique: true, using: "BTREE", fields: [{ name: "uid" }, { name: "id_type" }, { name: "id_value" }] },
        { name: "idx_person_author_id_value", using: "BTREE", fields: [{ name: "id_type" }, { name: "id_value" }] },
        { name: "idx_person_author_id_status", using: "BTREE", fields: [{ name: "status" }] },
      ]
    });
    return PersonAuthorId;
  }
}
