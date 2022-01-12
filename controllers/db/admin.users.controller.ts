import models from '../../src/db/sequelize'
import { findOnePerson } from './person.controller'

export const findOrCreateAdminUsers = async (uid: string) => {
    try {
        //const person = await findOnePerson(uid)
        const [user, created] = await models.AdminUser.findOrCreate({
            where: {
                personIdentifier: uid,
                status: 1
            },
            defaults: {
                personIdentifier: uid,
                //nameFirst: person.firstName,
                //nameMiddle: person.middleName,
                //nameLast: person.lastName,
                createTimestamp: new Date()
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