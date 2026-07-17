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
            ],
        },
    })
}
