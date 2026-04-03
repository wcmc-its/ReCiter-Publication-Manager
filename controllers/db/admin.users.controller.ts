import models from '../../src/db/sequelize'
import { findOnePerson } from './person.controller'
import { Op} from "sequelize"

const EMAIL ='email'
const PERSONIDENTIFIER  = 'personIdentifier'

export const findOrCreateAdminUsers = async (uid: string, samlEmail: string, samlFirstName: string, samlLastName: string) => {
    try {
        let whereCondition:any =samlEmail?{'email':samlEmail}:{'personIdentifier':uid} ;

        let person:any=null;
        let adminUser=null
        if(samlEmail || uid)
        {
            adminUser = await findAdminUser([EMAIL,PERSONIDENTIFIER],[samlEmail,uid]);
            if((samlEmail || uid) && adminUser)
            {
                person = await findOnePerson([EMAIL,PERSONIDENTIFIER],[samlEmail,uid]); 
            }
        
        }
        const [user, created] = await models.AdminUser.findOrCreate({

            where : whereCondition,
            defaults: {
                personIdentifier: uid,
                nameFirst: samlFirstName?samlFirstName:((person && person.firstName)?person.firstName:null),
                nameMiddle: (person && person.middleName)?person.middleName:null,
                nameLast: samlLastName?samlLastName:(person && person.lastName)?person.lastName:null,
                createTimestamp: new Date(),
                modifyTimestamp: new Date(),
                status: 1,//Start of with no access for everybody(person && person.personIdentifier)? 1:0
                email:samlEmail?samlEmail:((person && person.primaryEmail?.toString())?person.primaryEmail?.toString():null)
            }
        })

        created?console.log('User ' + uid + ' is logging in for first time so record is created in adminUsers table'): 
            console.log('User ' + uid + ' already exists in adminUsers table')
        return user.get({plain:true});
        
    } catch (e) {
        console.log(e)
    }
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
