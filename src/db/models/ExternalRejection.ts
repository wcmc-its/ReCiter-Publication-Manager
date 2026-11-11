import * as Sequelize from 'sequelize';
import { DataTypes, Model, Optional } from 'sequelize';

// reciterdb `external_rejection` (ReCiterDB setup/table_external_rejection.sql, v3.6): per-person
// rejection memory. Reject and Remove write one row per key the record carries; an import or an
// add that hits a remembered key is skipped or warned (src/lib/externalDupCheck.ts
// matchRejectionMemory). Undoing the Reject/Remove deletes the record's rows.

export type RejectionKeyType = 'DOI' | 'ORCID_PUTCODE' | 'SOURCE_ID' | 'TITLE_YEAR';

export interface ExternalRejectionAttributes {
  id: number;
  uid: string;
  key_type: RejectionKeyType;
  key_value: string;
  record_id?: number | null;
  reason: 'REJECTED' | 'REMOVED';
  rejected_by?: string | null;
  rejected_at?: Date;
}

export type ExternalRejectionPk = "id";
export type ExternalRejectionId = ExternalRejection[ExternalRejectionPk];
export type ExternalRejectionOptionalAttributes = "id" | "record_id" | "rejected_by" | "rejected_at";
export type ExternalRejectionCreationAttributes = Optional<ExternalRejectionAttributes, ExternalRejectionOptionalAttributes>;

export class ExternalRejection extends Model<ExternalRejectionAttributes, ExternalRejectionCreationAttributes> implements ExternalRejectionAttributes {
  id!: number;
  uid!: string;
  key_type!: RejectionKeyType;
  key_value!: string;
  record_id?: number | null;
  reason!: 'REJECTED' | 'REMOVED';
  rejected_by?: string | null;
  rejected_at?: Date;

  static initModel(sequelize: Sequelize.Sequelize): typeof ExternalRejection {
    ExternalRejection.init({
      id: { autoIncrement: true, type: DataTypes.BIGINT, allowNull: false, primaryKey: true },
      uid: { type: DataTypes.STRING(64), allowNull: false },
      key_type: { type: DataTypes.ENUM('DOI', 'ORCID_PUTCODE', 'SOURCE_ID', 'TITLE_YEAR'), allowNull: false },
      key_value: { type: DataTypes.STRING(255), allowNull: false },
      record_id: { type: DataTypes.BIGINT, allowNull: true },
      reason: { type: DataTypes.ENUM('REJECTED', 'REMOVED'), allowNull: false },
      rejected_by: { type: DataTypes.STRING(64), allowNull: true },
      rejected_at: { type: DataTypes.DATE(3), allowNull: true },  // database default CURRENT_TIMESTAMP(3)
    }, {
      sequelize,
      modelName: 'ExternalRejection',  // pinned against `next build` minification
      tableName: 'external_rejection',
      timestamps: false,
      indexes: [
        { name: "PRIMARY", unique: true, using: "BTREE", fields: [{ name: "id" }] },
        { name: "uq_xr_uid_key", unique: true, using: "BTREE", fields: [{ name: "uid" }, { name: "key_type" }, { name: "key_value" }] },
        { name: "ix_xr_record", using: "BTREE", fields: [{ name: "record_id" }] },
      ]
    });
    return ExternalRejection;
  }
}
