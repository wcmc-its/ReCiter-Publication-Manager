import sequelize from "../../src/db/db";
import type { NextApiRequest, NextApiResponse } from 'next'
import { AdminSettings } from '../../src/db/models/AdminSettings'
import models from '../../src/db/sequelize'

export const listAdminSettings = async (req: NextApiRequest, res: NextApiResponse) => {
    const adminSettings = {};
    try {
        const adminSettings = await models.AdminSettings.findAll({
            attributes: ["viewName", "viewAttributes",]
        });
        res.send(adminSettings);
    } catch (e) {
        console.log(e)
    }
  
};











