import models from '../../src/db/sequelize'
import { findOnePerson } from './person.controller'
import { Op} from "sequelize"

export const findOrCreateAdminUsers = async (uid: string, samlEmail: string, samlFirstName: string, samlLastName: string) => {
    try {
        console.log('samlEmail*************',samlEmail);
        let whereCondition:any ='';

        if(samlEmail)
        {
            whereCondition = {email: samlEmail}
        }
        else if(uid)
        {
            whereCondition = { personIdentifier: uid}
        }
        console.log('whereCondition*************',whereCondition);
        let person:any=null;
        if(samlEmail)
             person = await findOnePerson("email",samlEmail);  
        else if(uid)
             person = await findOnePerson("personIdentifier",uid);
         
         console.log('person*****************',person);    
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
                email:samlEmail?samlEmail:((person && person.primaryEmail.toString())?person.primaryEmail.toString():null)
            }
        })

        created?console.log('User ' + uid + ' is logging in for first time so record is created in adminUsers table'): 
            console.log('User ' + uid + ' already exists in adminUsers table')
        return user.get({plain:true});
        
    } catch (e) {
        console.log(e)
    }
};

export const findAdminUser = async (attrValue: string, attrType:string) => {
    if (attrType === "email"){
        const user = await models.AdminUser.findOne({
            where: {
                email: attrValue,
            }
        })
        return user;
    }else {
        const user = await models.AdminUser.findOne({
            where: {
                personIdentifier: attrValue,
            }
        })
        return user;
    }
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