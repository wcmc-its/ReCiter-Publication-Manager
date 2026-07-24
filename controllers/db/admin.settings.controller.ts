import type { NextApiRequest, NextApiResponse } from 'next'
import { querySettingsGrouped, upsertSettings, queryOneSetting } from '../../repositories/db/admin.settings.repository'

export const listAdminSettings = async (req: NextApiRequest, res: NextApiResponse) => {
    let adminSettings = {};
    try {
        adminSettings = await querySettingsGrouped(['viewName', 'viewAttributes', 'viewLabel']);
        res.send(adminSettings);
    } catch (e) {
        console.log(e)
    }
};

export const fetchUpdatedAdminSettings = async () => {
    let adminSettings = [];
    try {
        adminSettings = await querySettingsGrouped(['viewName', 'viewAttributes']);
        return JSON.stringify(adminSettings);
    } catch (e) {
        console.log(e)
    }
};

export const updateAdminSettings = async (req: NextApiRequest, res: NextApiResponse) => {
    const { data: payload } = req.body;
    try {
        const adminSettings = await upsertSettings(payload)
        res.send(adminSettings);
    } catch (e) {
        console.log(e)
    }
};

export const findOneAdminSettings = async (viewName: string) => {
    try {
        const adminSettings = await queryOneSetting(viewName);
        return adminSettings
    } catch (e) {
        console.log(e)
    }
};
