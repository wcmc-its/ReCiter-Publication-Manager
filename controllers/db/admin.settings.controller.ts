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
        console.log('adminSettings************************',adminSettings);
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
        console.log('adminSettings************************',adminSettings);
        return JSON.stringify(adminSettings);
    } catch (e) {
        console.log(e)
    }
  
};

export const updateAdminSettings = async (req: NextApiRequest, res: NextApiResponse) => {
    let payLoad = req.body.data;
    console.log("payLoad", typeof(payLoad))
    console.log("payLoad",payLoad)

    try {
        const adminSettings = await models.AdminSettings.bulkCreate(payLoad, { updateOnDuplicate: ["viewAttributes"], fields:["viewName", "viewAttributes"]})
    //    console.log('adminSettings saved**************************',adminSettings);
        res.send(adminSettings);
    } catch (e) {
        console.log(e)
    }
};











