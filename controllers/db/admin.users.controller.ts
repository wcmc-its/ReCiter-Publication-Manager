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