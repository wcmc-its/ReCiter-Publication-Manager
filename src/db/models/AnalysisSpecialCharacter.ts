import * as Sequelize from 'sequelize';
import { DataTypes, Model, Optional } from 'sequelize';

export interface AnalysisSpecialCharacterAttributes {
  id: number;
  specialCharacter?: string;
  RTFescape?: string;
  characterName?: string;
}

export type AnalysisSpecialCharacterPk = "id";
export type AnalysisSpecialCharacterId = AnalysisSpecialCharacter[AnalysisSpecialCharacterPk];
export type AnalysisSpecialCharacterOptionalAttributes = "id" | "specialCharacter" | "RTFescape" | "characterName";
export type AnalysisSpecialCharacterCreationAttributes = Optional<AnalysisSpecialCharacterAttributes, AnalysisSpecialCharacterOptionalAttributes>;

export class AnalysisSpecialCharacter extends Model<AnalysisSpecialCharacterAttributes, AnalysisSpecialCharacterCreationAttributes> implements AnalysisSpecialCharacterAttributes {
  id!: number;
  specialCharacter?: string;
  RTFescape?: string;
  characterName?: string;


  static initModel(sequelize: Sequelize.Sequelize): typeof AnalysisSpecialCharacter {
    AnalysisSpecialCharacter.init({
    id: {
      autoIncrement: true,
      type: DataTypes.INTEGER,
      allowNull: false,
      primaryKey: true
    },
    specialCharacter: {
      type: DataTypes.STRING(3),
      allowNull: true
    },
    RTFescape: {
      type: DataTypes.STRING(10),
      allowNull: true
    },
    characterName: {
      type: DataTypes.STRING(128),
      allowNull: true
    }
  }, {
    sequelize,
    tableName: 'analysis_special_characters',
    timestamps: false,
    indexes: [
      {
        name: "PRIMARY",
        unique: true,
        using: "BTREE",
        fields: [
          { name: "id" },
        ]
      },
      {
        name: "idx_character",
        using: "BTREE",
        fields: [
          { name: "specialCharacter" },
        ]
      },
    ]
  });
  return AnalysisSpecialCharacter;
  }
}
