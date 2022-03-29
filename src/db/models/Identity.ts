import * as Sequelize from 'sequelize';
import { DataTypes, Model, Optional } from 'sequelize';

export interface IdentityAttributes {
  id: number;
  cwid?: string;
  surname?: string;
  middleName?: string;
  givenName?: string;
  primaryTitle?: string;
  primaryAcademicDepartment?: string;
  primaryAcademicDivision?: string;
  primaryProgram?: string;
  fullTimeFaculty?: string;
  postdoc?: string;
  studentMDNYC?: string;
  studentMDQatar?: string;
  studentMDPhD?: string;
  studentPhDTriI?: string;
  studentPhDWeill?: string;
  partTimeFaculty?: string;
  voluntaryFaculty?: string;
  emeritusFaculty?: string;
  adjunctFaculty?: string;
  residentNYP?: string;
  fellow?: string;
  faculty?: string;
  nonFaculty?: string;
  inactiveFaculty?: string;
  alumniMD?: string;
  alumniMDPHD?: string;
  alumniPHD?: string;
  inactiveNonAlumniStudent?: string;
  startDateWCMFaculty?: number;
  endDateWCMFaculty?: number;
  startDateWCMStudent?: number;
  endDateWCMStudent?: number;
  popsProfile?: string;
  directoryProfile?: string;
  vivoProfile?: string;
  facultyRank?: string;
  primaryOrg?: string;
  notes?: string;
  createTimestamp?: Date;
  modifyTimestamp?: Date;
}

export type IdentityPk = "id";
export type IdentityId = Identity[IdentityPk];
export type IdentityOptionalAttributes = "id" | "cwid" | "surname" | "middleName" | "givenName" | "primaryTitle" | "primaryAcademicDepartment" | "primaryAcademicDivision" | "primaryProgram" | "fullTimeFaculty" | "postdoc" | "studentMDNYC" | "studentMDQatar" | "studentMDPhD" | "studentPhDTriI" | "studentPhDWeill" | "partTimeFaculty" | "voluntaryFaculty" | "emeritusFaculty" | "adjunctFaculty" | "residentNYP" | "fellow" | "faculty" | "nonFaculty" | "inactiveFaculty" | "alumniMD" | "alumniMDPHD" | "alumniPHD" | "inactiveNonAlumniStudent" | "startDateWCMFaculty" | "endDateWCMFaculty" | "startDateWCMStudent" | "endDateWCMStudent" | "popsProfile" | "directoryProfile" | "vivoProfile" | "facultyRank" | "primaryOrg" | "notes" | "createTimestamp" | "modifyTimestamp";
export type IdentityCreationAttributes = Optional<IdentityAttributes, IdentityOptionalAttributes>;

export class Identity extends Model<IdentityAttributes, IdentityCreationAttributes> implements IdentityAttributes {
  id!: number;
  cwid?: string;
  surname?: string;
  middleName?: string;
  givenName?: string;
  primaryTitle?: string;
  primaryAcademicDepartment?: string;
  primaryAcademicDivision?: string;
  primaryProgram?: string;
  fullTimeFaculty?: string;
  postdoc?: string;
  studentMDNYC?: string;
  studentMDQatar?: string;
  studentMDPhD?: string;
  studentPhDTriI?: string;
  studentPhDWeill?: string;
  partTimeFaculty?: string;
  voluntaryFaculty?: string;
  emeritusFaculty?: string;
  adjunctFaculty?: string;
  residentNYP?: string;
  fellow?: string;
  faculty?: string;
  nonFaculty?: string;
  inactiveFaculty?: string;
  alumniMD?: string;
  alumniMDPHD?: string;
  alumniPHD?: string;
  inactiveNonAlumniStudent?: string;
  startDateWCMFaculty?: number;
  endDateWCMFaculty?: number;
  startDateWCMStudent?: number;
  endDateWCMStudent?: number;
  popsProfile?: string;
  directoryProfile?: string;
  vivoProfile?: string;
  facultyRank?: string;
  primaryOrg?: string;
  notes?: string;
  createTimestamp?: Date;
  modifyTimestamp?: Date;


  static initModel(sequelize: Sequelize.Sequelize): typeof Identity {
    Identity.init({
    id: {
      autoIncrement: true,
      type: DataTypes.INTEGER,
      allowNull: false,
      primaryKey: true
    },
    cwid: {
      type: DataTypes.STRING(128),
      allowNull: true
    },
    surname: {
      type: DataTypes.STRING(128),
      allowNull: true
    },
    middleName: {
      type: DataTypes.STRING(128),
      allowNull: true
    },
    givenName: {
      type: DataTypes.STRING(128),
      allowNull: true
    },
    primaryTitle: {
      type: DataTypes.STRING(128),
      allowNull: true
    },
    primaryAcademicDepartment: {
      type: DataTypes.STRING(128),
      allowNull: true
    },
    primaryAcademicDivision: {
      type: DataTypes.STRING(128),
      allowNull: true
    },
    primaryProgram: {
      type: DataTypes.STRING(128),
      allowNull: true
    },
    fullTimeFaculty: {
      type: DataTypes.STRING(128),
      allowNull: true
    },
    postdoc: {
      type: DataTypes.STRING(11),
      allowNull: true
    },
    studentMDNYC: {
      type: DataTypes.STRING(12),
      allowNull: true
    },
    studentMDQatar: {
      type: DataTypes.STRING(12),
      allowNull: true
    },
    studentMDPhD: {
      type: DataTypes.STRING(12),
      allowNull: true
    },
    studentPhDTriI: {
      type: DataTypes.STRING(12),
      allowNull: true
    },
    studentPhDWeill: {
      type: DataTypes.STRING(12),
      allowNull: true
    },
    partTimeFaculty: {
      type: DataTypes.STRING(11),
      allowNull: true
    },
    voluntaryFaculty: {
      type: DataTypes.STRING(11),
      allowNull: true
    },
    emeritusFaculty: {
      type: DataTypes.STRING(11),
      allowNull: true
    },
    adjunctFaculty: {
      type: DataTypes.STRING(11),
      allowNull: true
    },
    residentNYP: {
      type: DataTypes.STRING(11),
      allowNull: true
    },
    fellow: {
      type: DataTypes.STRING(11),
      allowNull: true
    },
    faculty: {
      type: DataTypes.STRING(11),
      allowNull: true
    },
    nonFaculty: {
      type: DataTypes.STRING(11),
      allowNull: true
    },
    inactiveFaculty: {
      type: DataTypes.STRING(11),
      allowNull: true
    },
    alumniMD: {
      type: DataTypes.STRING(11),
      allowNull: true
    },
    alumniMDPHD: {
      type: DataTypes.STRING(11),
      allowNull: true
    },
    alumniPHD: {
      type: DataTypes.STRING(11),
      allowNull: true
    },
    inactiveNonAlumniStudent: {
      type: DataTypes.STRING(128),
      allowNull: true
    },
    startDateWCMFaculty: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    endDateWCMFaculty: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    startDateWCMStudent: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    endDateWCMStudent: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    popsProfile: {
      type: DataTypes.STRING(128),
      allowNull: true
    },
    directoryProfile: {
      type: DataTypes.STRING(128),
      allowNull: true
    },
    vivoProfile: {
      type: DataTypes.STRING(128),
      allowNull: true
    },
    facultyRank: {
      type: DataTypes.STRING(128),
      allowNull: true
    },
    primaryOrg: {
      type: DataTypes.STRING(128),
      allowNull: true
    },
    notes: {
      type: DataTypes.STRING(128),
      allowNull: true
    },
    createTimestamp: {
      type: DataTypes.DATE,
      allowNull: true,
      defaultValue: Sequelize.Sequelize.fn('current_timestamp')
    },
    modifyTimestamp: {
      type: DataTypes.DATE,
      allowNull: true,
      defaultValue: Sequelize.Sequelize.fn('current_timestamp')
    }
  }, {
    sequelize,
    tableName: 'identity',
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
        name: "dfsdfsdf",
        using: "BTREE",
        fields: [
          { name: "cwid" },
        ]
      },
    ]
  });
  return Identity;
  }
}
