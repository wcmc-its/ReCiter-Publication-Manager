import type { NextApiRequest, NextApiResponse } from 'next'
import models from '../../src/db/sequelize'

export const listAdminSettings = async (req: NextApiRequest, res: NextApiResponse) => {
    let adminSettings = {};
    try {
         adminSettings = await models.AdminSettings.findAll({
            attributes: ["viewName","viewAttributes","viewLabel"
            //[Sequelize.fn("JSON_ARRAYAGG", Sequelize.col('AdminSettings.viewAttributes')),"viewAttributes"]
        ],
        group: `viewName`
        });
        res.send(adminSettings);
    } catch (e) {
        console.log(e)
    }
  
};
export const fetchUpdatedAdminSettings = async () => {
    let adminSettings = [];
    try {
         adminSettings = await models.AdminSettings.findAll({
            attributes: ["viewName","viewAttributes"
            //[Sequelize.fn("JSON_ARRAYAGG", Sequelize.col('AdminSettings.viewAttributes')),"viewAttributes"]
        ],
        group: `viewName`
        });
        return JSON.stringify(adminSettings);
    } catch (e) {
        console.log(e)
    }
  
};

export const updateAdminSettings = async (req: NextApiRequest, res: NextApiResponse) => {
    const { data: payload } = req.body ;
    try {
        const adminSettings = await models.AdminSettings.bulkCreate(payload, { updateOnDuplicate: ["viewAttributes"], fields:["viewName", "viewAttributes"]})
        res.send(adminSettings);
    } catch (e) {
        console.log(e)
    }
};











