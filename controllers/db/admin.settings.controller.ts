import sequelize from "../../src/db/db";
import type { NextApiRequest, NextApiResponse } from 'next'
import { AdminSettings } from '../../src/db/models/AdminSettings'
import models from '../../src/db/sequelize'
import { Op, Sequelize } from "sequelize";

export const listAdminSettings = async (req: NextApiRequest, res: NextApiResponse) => {
    const adminSettings = {};
    try {
        const adminSettings = await models.AdminSettings.findAll({
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
    const adminSettings = [];
    try {
        const adminSettings = await models.AdminSettings.findAll({
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
    let payLoad = req.body.data;
    try {
        const adminSettings = await models.AdminSettings.bulkCreate(payLoad, { updateOnDuplicate: ["viewAttributes"], fields:["viewName", "viewAttributes"]})
        res.send(adminSettings);
    } catch (e) {
        console.log(e)
    }
};











