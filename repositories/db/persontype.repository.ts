import models from '../../src/db/sequelize'
import { Sequelize, Op } from 'sequelize'

// Distinct, non-empty person types, ascending. The data access for findAllPersonTypes; kept apart
// from the controller so the query lives in one place and the controller stays request/response only.
export function queryDistinctPersonTypes() {
    return models.PersonPersonType.findAll({
        order: [['personType', 'ASC']],
        attributes: [
            [Sequelize.fn('DISTINCT', Sequelize.col('personType')), 'personType'],
        ],
        where: {
            [Op.and]: [
                { personType: { [Op.ne]: '' } },
                { personType: { [Op.ne]: null } },
                // Cornell Ithaca people carry cornell-* types via DynamoDB Identity but are never
                // retrieved or scored, so they have no person rows, and every filter that consumes
                // this list joins person; the options would be dead. Prefix match on purpose:
                // affiliate-cornell is a WCM type and must stay.
                { personType: { [Op.notLike]: 'cornell-%' } },
            ],
        },
    })
}
