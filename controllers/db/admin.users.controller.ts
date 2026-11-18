import models from '../../src/db/sequelize'
import sequelize from '../../src/db/db'
import { findOnePerson } from './person.controller'
import { Op} from "sequelize"
import { canonicalCwid, isValidCwid } from '../../src/utils/canonicalCwid'

const EMAIL ='email'
const PERSONIDENTIFIER  = 'personIdentifier'

export const findOrCreateAdminUsers = async (rawUid: string, samlEmail: string, samlFirstName: string, samlLastName: string) => {
    try {
        // Convert the login's CWID on the way in (trim, lowercase), so a typed or IdP-supplied
        // `Abl9002` / `ggi9001 ` never creates or keys an admin_users row; token.username is
        // read back from this row. Still not an identifier after that -> no account.
        const uid = rawUid ? canonicalCwid(rawUid) : rawUid
        if (uid && !isValidCwid(uid)) {
            console.warn(`[admin_users] refusing login account for non-CWID personIdentifier ${JSON.stringify(rawUid)}`)
            return null
        }
        // One account per person. Reuse an existing row before ever inserting: the row holding
        // this CWID wins (lowest userID if duplicates already exist), else the row holding this
        // email. Only when neither key matches is a row created. The old findOrCreate keyed on
        // email alone whenever SAML supplied one, so a CWID that already had an account but a
        // different/blank email got a second admin_users row (mrj4001: userIDs 13 and 40078).
        const existing = await findExistingAdminUser(uid, samlEmail)
        if (existing) {
            console.log('User ' + uid + ' already exists in adminUsers table (userID ' + existing.userID + ')')
            return existing.get({plain:true});
        }

        let person:any=null;
        if(samlEmail || uid)
        {
            person = await findOnePerson([EMAIL,PERSONIDENTIFIER],[samlEmail,uid]);
        }
        const user = await models.AdminUser.create({
                personIdentifier: uid,
                nameFirst: samlFirstName?samlFirstName:((person && person.firstName)?person.firstName:null),
                nameMiddle: (person && person.middleName)?person.middleName:null,
                nameLast: samlLastName?samlLastName:(person && person.lastName)?person.lastName:null,
                createTimestamp: new Date(),
                modifyTimestamp: new Date(),
                status: 1,//Start of with no access for everybody(person && person.personIdentifier)? 1:0
                email:samlEmail?samlEmail:((person && person.primaryEmail?.toString())?person.primaryEmail?.toString():null)
        })

        console.log('User ' + uid + ' is logging in for first time so record is created in adminUsers table')
        return user.get({plain:true});
        
    } catch (e) {
        console.log(e)
    }
};

// The account a login should use: the CWID's row first, else the email's row. When a CWID
// has duplicate rows (MySQL's default collation also matches a stored 'Abl9002'), the row
// whose email matches the SAML email wins, then the lowest userID -- so a login always lands
// on the same row and keeps that row's scope_*, proxy_person_ids and departments.
export const findExistingAdminUser = async (uid: string | undefined, email: string | undefined) => {
    if (uid) {
        const order: any[] = email
            ? [[sequelize.literal(`(email = ${sequelize.escape(email)})`), 'DESC'], ['userID', 'ASC']]
            : [['userID', 'ASC']]
        const byCwid = await models.AdminUser.findOne({ where: { personIdentifier: uid }, order })
        if (byCwid) return byCwid
    }
    if (email) {
        const byEmail = await models.AdminUser.findOne({ where: { email }, order: [['userID', 'ASC']] })
        if (byEmail) return byEmail
    }
    return null
};

export const findAdminUser = async (attrTypes: string[], attrValues: string[]) => {
   
    if (!Array.isArray(attrTypes) || !Array.isArray(attrValues)) {
        throw new Error('Both attrTypes and attrValues must be arrays');
      }
    
      if (attrTypes.length !== attrValues.length) {
        throw new Error('attrTypes and attrValues must be the same length');
      }

      const allowedFields = ['email', 'personIdentifier'];
      const whereConditions: any[] = [];
    
      attrTypes.forEach((field, i) => {
        if (!allowedFields.includes(field)) return;
    
        const value = attrValues[i];
        if (value != null) {
          whereConditions.push({ [field]: value });
        }
      });
    
      if (whereConditions.length === 0) return null;
    
      const user = await models.AdminUser.findOne({
        where: {
          [Op.or]: whereConditions,
        },
      });
    
      return user;
    
};

export const findOrCreateAdminUserRole = async (userRolePayload:Array<JSON>) => {
    try {

        const data =  await Promise.all(userRolePayload.map(async role=>{
            let userRole = JSON.parse(JSON.stringify(role));
            let userID = userRole.userID;
            let roleID = userRole.roleID;
            let createTimestamp = userRole.createTimestamp;
            const [adminUserRole, created]  = await models.AdminUsersRole.findOrCreate({
                where: {
                     [Op.and]: [{userID: userID}, {roleID: roleID}] ,
                },
                defaults: {
                    userID: userID,
                    roleID: roleID,
                    createTimestamp: new Date()
                }

            });
          

        created?console.log('Role ' + roleID + ' is created for the Admin user with UserId '+userID): 
            console.log('User ' + userID + ' and role Id '+ roleID +'already exists in adminUsersroles table')
        return adminUserRole
        }));
        return data;
    } catch (e) {
        console.log(e)
    }
};
