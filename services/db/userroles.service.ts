import { queryUserPermissions } from '../../repositories/db/userroles.repository';

export const findUserPermissions = async (attrTypes: string[], attrValues: string[]) => {

    if (!Array.isArray(attrTypes) || !Array.isArray(attrValues)) {
        throw new Error('Both attrTypes and attrValues must be arrays');
    }

    if (attrTypes.length !== attrValues.length) {
        throw new Error('attrTypes and attrValues must be the same length');
    }

    const allowedFields = ['email', 'personIdentifier'];
    const replacements: Record<string, any> = {};

    attrTypes.forEach((field, index) => {
        const value = attrValues[index] ?? '';
        if (!allowedFields.includes(field)) return;

        if (field === 'personIdentifier') {
            replacements.personIdentifier = value;
        }

        if (field === 'email') {
            replacements.email = value;
        }
    });

    const userRolesList = await queryUserPermissions(replacements);
    return JSON.stringify(userRolesList);

};
