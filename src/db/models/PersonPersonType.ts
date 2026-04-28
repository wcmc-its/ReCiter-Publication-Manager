import * as Sequelize from 'sequelize';
import { DataTypes, Model, Optional } from 'sequelize';

export interface PersonPersonTypeAttributes {
  id: number;
  personIdentifier?: string;
  personType?: string;
}

export type PersonPersonTypePk = "id";
export type PersonPersonTypeId = PersonPersonType[PersonPersonTypePk];
export type PersonPersonTypeOptionalAttributes = "id" | "personIdentifier" | "personType";
export type PersonPersonTypeCreationAttributes = Optional<PersonPersonTypeAttributes, PersonPersonTypeOptionalAttributes>;

export class PersonPersonType extends Model<PersonPersonTypeAttributes, PersonPersonTypeCreationAttributes> implements PersonPersonTypeAttributes {
  id!: number;
  personIdentifier?: string;
  personType?: string;


  static initModel(sequelize: Sequelize.Sequelize): typeof PersonPersonType {
    PersonPersonType.init({
    id: {
      autoIncrement: true,
      type: DataTypes.INTEGER,
      allowNull: false,
      primaryKey: true
    },
    personIdentifier: {
      type: DataTypes.STRING(128),
      allowNull: true
    },
    personType: {
      type: DataTypes.STRING(128),
      allowNull: true
    }
  }, {
    sequelize,
    tableName: 'person_person_type',
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
        name: "idx_personIdentifier",
        using: "BTREE",
        fields: [
          { name: "personIdentifier" },
        ]
      },
      {
        name: "idx_personType",
        using: "BTREE",
        fields: [
          { name: "personType" },
        ]
      },
    ]
  });
  return PersonPersonType;
  }
}
