import * as Sequelize from 'sequelize';
import { DataTypes, Model, Optional } from 'sequelize';
import type { ExternalStatus } from './ExternalRecord';

// reciterdb `external_record_event` (ReCiterDB setup/table_external_record_event.sql, v3.6):
// the append-only history of external_record. One row per add, import, transition, edit, merge
// or unmerge. Written only by src/lib/externalStore.ts, never updated or deleted.

export type ExternalEventAction = 'ADD' | 'IMPORT' | 'TRANSITION' | 'EDIT' | 'MERGE' | 'UNMERGE';

const STATUS_VALUES = ['PENDING', 'ACCEPTED', 'REJECTED', 'REMOVED', 'MERGED', 'AUTOMERGED', 'SUPERSEDED'];

export interface ExternalRecordEventAttributes {
  id: number;
  record_id: number;
  uid: string;
  action: ExternalEventAction;
  from_status?: ExternalStatus | null;
  to_status?: ExternalStatus | null;
  actor?: string | null;
  impersonated_by?: string | null;
  at?: Date;
  note?: string | null;
  diff_json?: string | null;  // JSON text: {field: [before, after]} for EDIT
}

export type ExternalRecordEventPk = "id";
export type ExternalRecordEventId = ExternalRecordEvent[ExternalRecordEventPk];
export type ExternalRecordEventOptionalAttributes = "id" | "from_status" | "to_status" | "actor" | "impersonated_by" | "at" | "note" | "diff_json";
export type ExternalRecordEventCreationAttributes = Optional<ExternalRecordEventAttributes, ExternalRecordEventOptionalAttributes>;

export class ExternalRecordEvent extends Model<ExternalRecordEventAttributes, ExternalRecordEventCreationAttributes> implements ExternalRecordEventAttributes {
  id!: number;
  record_id!: number;
  uid!: string;
  action!: ExternalEventAction;
  from_status?: ExternalStatus | null;
  to_status?: ExternalStatus | null;
  actor?: string | null;
  impersonated_by?: string | null;
  at?: Date;
  note?: string | null;
  diff_json?: string | null;

  static initModel(sequelize: Sequelize.Sequelize): typeof ExternalRecordEvent {
    ExternalRecordEvent.init({
      id: { autoIncrement: true, type: DataTypes.BIGINT, allowNull: false, primaryKey: true },
      record_id: { type: DataTypes.BIGINT, allowNull: false },
      uid: { type: DataTypes.STRING(64), allowNull: false },
      action: { type: DataTypes.ENUM('ADD', 'IMPORT', 'TRANSITION', 'EDIT', 'MERGE', 'UNMERGE'), allowNull: false },
      from_status: { type: DataTypes.ENUM(...STATUS_VALUES), allowNull: true },
      to_status: { type: DataTypes.ENUM(...STATUS_VALUES), allowNull: true },
      actor: { type: DataTypes.STRING(64), allowNull: true },
      impersonated_by: { type: DataTypes.STRING(64), allowNull: true },
      at: { type: DataTypes.DATE(3), allowNull: true },  // database default CURRENT_TIMESTAMP(3)
      note: { type: DataTypes.TEXT, allowNull: true },
      diff_json: { type: DataTypes.TEXT('long'), allowNull: true },
    }, {
      sequelize,
      modelName: 'ExternalRecordEvent',  // pinned against `next build` minification
      tableName: 'external_record_event',
      timestamps: false,
      indexes: [
        { name: "PRIMARY", unique: true, using: "BTREE", fields: [{ name: "id" }] },
        { name: "ix_ere_record_at", using: "BTREE", fields: [{ name: "record_id" }, { name: "at" }] },
        { name: "ix_ere_uid_at", using: "BTREE", fields: [{ name: "uid" }, { name: "at" }] },
      ]
    });
    return ExternalRecordEvent;
  }
}
