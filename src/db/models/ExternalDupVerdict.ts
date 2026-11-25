import * as Sequelize from 'sequelize';
import { DataTypes, Model, Optional } from 'sequelize';

// reciterdb `external_dup_verdict` (ReCiterDB setup/table_external_dup_verdict.sql, v3.6):
// "Different papers" verdicts, per person and pair. Keys are `PMID:<n>` or `EXT:<article_id>`,
// stored as an ordered pair in BINARY (code-point) order, which a CHECK constraint enforces:
// build pairs with orderedPair() in src/lib/externalDupCheck.ts, never a collation-aware sort.
// scope_cwid NULL = global (Authorships); a cwid = that curator only (Curate).
// `scope_key` is a STORED generated column (COALESCE(scope_cwid, '')) for the unique key: read-only.

export interface ExternalDupVerdictAttributes {
  id: number;
  uid: string;
  key_a: string;
  key_b: string;
  verdict: 'DIFFERENT';
  scope_cwid?: string | null;
  scope_key?: string;
  decided_by?: string | null;
  decided_at?: Date;
}

export type ExternalDupVerdictPk = "id";
export type ExternalDupVerdictId = ExternalDupVerdict[ExternalDupVerdictPk];
export type ExternalDupVerdictOptionalAttributes = "id" | "verdict" | "scope_cwid" | "scope_key" | "decided_by" | "decided_at";
export type ExternalDupVerdictCreationAttributes = Optional<ExternalDupVerdictAttributes, ExternalDupVerdictOptionalAttributes>;

export class ExternalDupVerdict extends Model<ExternalDupVerdictAttributes, ExternalDupVerdictCreationAttributes> implements ExternalDupVerdictAttributes {
  id!: number;
  uid!: string;
  key_a!: string;
  key_b!: string;
  verdict!: 'DIFFERENT';
  scope_cwid?: string | null;
  scope_key?: string;
  decided_by?: string | null;
  decided_at?: Date;

  static initModel(sequelize: Sequelize.Sequelize): typeof ExternalDupVerdict {
    ExternalDupVerdict.init({
      id: { autoIncrement: true, type: DataTypes.BIGINT, allowNull: false, primaryKey: true },
      uid: { type: DataTypes.STRING(64), allowNull: false },
      key_a: { type: DataTypes.STRING(112), allowNull: false },
      key_b: { type: DataTypes.STRING(112), allowNull: false },
      verdict: { type: DataTypes.ENUM('DIFFERENT'), allowNull: false, defaultValue: 'DIFFERENT' },
      scope_cwid: { type: DataTypes.STRING(64), allowNull: true },
      scope_key: { type: DataTypes.STRING(64), allowNull: true },  // generated (STORED); read-only
      decided_by: { type: DataTypes.STRING(64), allowNull: true },
      decided_at: { type: DataTypes.DATE(3), allowNull: true },  // database default CURRENT_TIMESTAMP(3)
    }, {
      sequelize,
      modelName: 'ExternalDupVerdict',  // pinned against `next build` minification
      tableName: 'external_dup_verdict',
      timestamps: false,
      indexes: [
        { name: "PRIMARY", unique: true, using: "BTREE", fields: [{ name: "id" }] },
        { name: "uq_edv_pair_scope", unique: true, using: "BTREE", fields: [{ name: "uid" }, { name: "key_a" }, { name: "key_b" }, { name: "scope_key" }] },
      ]
    });
    return ExternalDupVerdict;
  }
}
