import models from '../../src/db/sequelize'
import { findOnePerson } from './person.controller'

export const findOrCreateAdminUsers = async (uid: string) => {
    try {
        const person = await findOnePerson(uid)
        const [user, created] = await models.AdminUser.findOrCreate({
            where: {
                personIdentifier: uid,
            },
            defaults: {
                personIdentifier: uid,
                nameFirst: (person && person.firstName)?person.firstName:null,
                nameMiddle: (person && person.middleName)?person.middleName:null,
                nameLast: (person && person.lastName)?person.lastName:null,
                createTimestamp: new Date(),
                status: 0//Start of with no access for everybody(person && person.personIdentifier)? 1:0
            }
        })

        created?console.log('User ' + uid + ' is logging in for first time so record is created in adminUsers table'): 
            console.log('User ' + uid + ' already exists in adminUsers table')
        
        console.log(user.toJSON())
        return user

    } catch (e) {
        console.log(e)
    }
};

export const findOrCreateSamlUser = async (cwid: string, email: string) => {
    try {
        // Attempt to find a matching person record for personIdentifier
        let personIdentifier = cwid || null;
        let matchedPerson = null;

        if (cwid) {
            // Try matching by CWID in person table
            matchedPerson = await findOnePerson(cwid);
            if (matchedPerson && matchedPerson.personIdentifier) {
                personIdentifier = matchedPerson.personIdentifier;
            }
        }

        const identifier = personIdentifier || cwid || email;
        if (!identifier) {
            console.log('[AUTH] ERROR: Cannot create user -- no cwid or email available');
            return null;
        }

        const [user, created] = await models.AdminUser.findOrCreate({
            where: {
                personIdentifier: identifier,
            },
            defaults: {
                personIdentifier: identifier,
                email: email || null,
                nameFirst: (matchedPerson && matchedPerson.firstName) ? matchedPerson.firstName : null,
                nameMiddle: (matchedPerson && matchedPerson.middleName) ? matchedPerson.middleName : null,
                nameLast: (matchedPerson && matchedPerson.lastName) ? matchedPerson.lastName : null,
                createTimestamp: new Date(),
                status: 1  // Active -- baseline access (canReport + canSearch) via capability model
            }
        });

        if (created) {
            console.log('[AUTH] WARN AUTO-CREATE: admin_users record created for', identifier);
        }

        return user;
    } catch (e) {
        console.log('[AUTH] ERROR: findOrCreateSamlUser failed:', e);
        return null;
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
}