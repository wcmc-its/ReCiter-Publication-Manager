import models from '../../src/db/sequelize'

// Data access for AdminSettings. Kept apart from the controller so the queries live in one place and
// the controller functions stay request/response + orchestration only.

// Settings grouped by view. Callers pass the attributes they need (the list view wants viewLabel too).
export function querySettingsGrouped(attributes: string[]) {
    return models.AdminSettings.findAll({ attributes, group: 'viewName' })
}

export function upsertSettings(payload: any) {
    return models.AdminSettings.bulkCreate(payload, {
        updateOnDuplicate: ['viewAttributes'],
        fields: ['viewName', 'viewAttributes'],
    })
}

export function queryOneSetting(viewName: string) {
    return models.AdminSettings.findOne({
        where: { viewName },
        attributes: ['viewName', 'viewAttributes', 'viewLabel'],
    })
}
