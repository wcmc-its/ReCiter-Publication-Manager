import { response } from "express";
import type { NextApiRequest, NextApiResponse } from "next";
//import { Op, Sequelize, where,Transaction } from "sequelize";
import { Op, Sequelize } from "sequelize";
import models from "../../../src/db/sequelize";
import sequelize from "../../../src/db/db";

export const listAllUsers = async (
  req: NextApiRequest,
  res: NextApiResponse
) => {
  try {
    let users = {};
    const {
      limit,
      offset,
      searchTextInput,
      roleFilter
    } = req.body;
    if (req.body.limit != undefined && req.body.offset != undefined) {
      const where = {};

      if (searchTextInput) {
        where[Op.and] = where[Op.and] || [];
        where[Op.and].push({
          [Op.or]: [{
            '$nameFirst$': {
              [Op.like]: `%${searchTextInput}%`
            }
          }, {
            '$nameMiddle$': {
              [Op.like]: `%${searchTextInput}%`
            }
          }, {
            '$nameLast$': {
              [Op.like]: `%${searchTextInput}%`
            }
          }]
        });
      }

      // Build includes with role, department, and person type data
      const roleInclude: any = {
        model: models.AdminUsersRole,
        as: 'adminUsersRoles',
        required: !!roleFilter,
        attributes: ['roleID'],
        include: [{
          model: models.AdminRole,
          as: 'role',
          attributes: ['roleLabel'],
          where: roleFilter ? { roleLabel: roleFilter } : undefined,
        }],
      };

      const includes = [
        roleInclude,
        {
          model: models.AdminUsersDepartment,
          as: 'adminUsersDepartments',
          required: false,
          attributes: ['departmentID'],
          include: [{
            model: models.AdminDepartment,
            as: 'department',
            attributes: ['departmentLabel'],
          }],
        },
        {
          model: models.AdminUsersPersonType,
          as: 'adminUsersPersonTypes',
          required: false,
          attributes: ['personType'],
        },
      ];

      const queryOptions: any = {
        offset: offset,
        include: includes,
        distinct: true,
      };

      if (Object.keys(where).length > 0) {
        queryOptions.where = where;
      }

      // Only apply limit when no search text (preserves existing behavior)
      if (!searchTextInput) {
        queryOptions.limit = limit;
      }

      const { count, rows } = await models.AdminUser.findAndCountAll(queryOptions);
      users['usersData'] = rows;
      users['totalUsersCount'] = count;
    }
    res.send(users);
  } catch (e) {
    console.log(e);
    res.status(500).send(e);
  }
};

export const listAllAdminRoles = async (
  req: NextApiRequest,
  res: NextApiResponse
) => {
  try {
    const availableRoles = await models.AdminRole.findAll();
    res.send(availableRoles);
  } catch (e) {
    console.log(e);
    res.status(500).send(e);
  }
}


export const listAllAdminDepartments = async (
  req: NextApiRequest,
  res: NextApiResponse
) => {
  try {
    const availableDepartments = await models.AdminDepartment.findAll();
    res.send(availableDepartments);
  } catch (e) {
    console.log(e);
    res.status(500).send(e);
  }
}

export const createOrUpdateAdminUser = async (
  req: NextApiRequest,
  res: NextApiResponse
) => {
  const { cwid, email, firstName, lastName, middleName, division, title, selectedRoleIds, departmentIds, isEditUserId, personTypeLabels } = req.body;

  try {
    // Server-side validation: Curator_All + Curator_Scoped mutual exclusion
    if (selectedRoleIds && selectedRoleIds.length > 0) {
      const roleRecords = await Promise.all(selectedRoleIds.map(async (id: number) => {
        const role = await models.AdminRole.findByPk(id);
        return role?.roleLabel;
      }));
      if (roleRecords.includes('Curator_All') && roleRecords.includes('Curator_Scoped')) {
        return res.status(400).json({ error: 'Curator All and Curator Scoped cannot be combined' });
      }
    }
    if (isEditUserId) {
      //Update admin user Payload
      let updateUserPayload = {
        'nameFirst': firstName,
        'nameMiddle': middleName,
        'nameLast': lastName,
        'modifyTimestamp': new Date()
      }
      

      // find user in AdminUser
      const findUserID = await models.AdminUser.findOne({ where: { userID: isEditUserId } });
      if (findUserID.userID) {
        
        const result = await sequelize.transaction(async (t) => {
              // delete AdminUsersRole for edit user
              const adminuserRolesUpdatedResp = await models.AdminUsersRole.destroy(
                {
                  where: { userID: isEditUserId },
                  // returning : true
                  transaction: t
                });

              // delete AdminUsersDepartments for edit user
              const adminUserDepartmentsDelete = models.AdminUsersDepartment.destroy(
                {
                  where: { userID: isEditUserId },
                  // returning : true
                  transaction: t
                })
              
              let rolesData = [];
              let departmentData = [];

              departmentIds?.map((id) => {
                let assigneDepartments = {
                  'userID': isEditUserId,
                  'departmentID': id,
                  'createTimestamp': new Date()
                }
                departmentData.push(assigneDepartments)
              })

              selectedRoleIds?.map((id) => {
                let assignRolePayload = {
                  'userID': isEditUserId,
                  'roleID': id,
                  'createTimestamp': new Date()
                }
                rolesData.push(assignRolePayload)
              })

              const departmentsAssigned = await models.AdminUsersDepartment.bulkCreate(departmentData,{ transaction: t });

              const isRoleAssigned = await models.AdminUsersRole.bulkCreate(rolesData,{ transaction: t });

              // Delete existing person type scope
              await models.AdminUsersPersonType.destroy({
                where: { userID: isEditUserId },
                transaction: t,
              });

              // Save new person type scope (only if Curator_Scoped)
              if (personTypeLabels && personTypeLabels.length > 0) {
                const personTypeData = personTypeLabels.map((pt: string) => ({
                  userID: isEditUserId,
                  personType: pt,
                  createTimestamp: new Date(),
                }));
                await models.AdminUsersPersonType.bulkCreate(personTypeData, { transaction: t });
              }

              // Update AdminUser
              const adminUserUpdatedResp = await models.AdminUser.update(updateUserPayload,
                {
                  where: { userID: isEditUserId },
                  // returning : true
                  transaction: t
                });

              res.send(adminUserUpdatedResp)
      });  
      } else {
        res.send(findUserID)
      }
    } 
    else {

      //Create admin user Payload
      let createUserPayload = {
        'personIdentifier': cwid,
        'nameFirst': firstName,
        'nameMiddle': middleName,
        'nameLast': lastName,
        'email': email,
        'status': 1,  // Hardcoded 1 to make user active bydefault
        'createTimestamp': new Date()
      }

      
          const result = await sequelize.transaction(async (t) => {
                  const isAdminUserCreated = await models.AdminUser.create(createUserPayload,{ transaction: t })
                  //throw new Error('Unable to create User');
                  if (isAdminUserCreated.userID) {
                    let rolesData = [];
                    let departmentData = [];
                    departmentIds?.map((id) => {
                      let assigneDepartments = {
                        'userID': isAdminUserCreated.userID,
                        'departmentID': id,
                        'createTimestamp': new Date()
                      }
                      departmentData.push(assigneDepartments)
                    })
                    selectedRoleIds?.map((id) => {
                      let assignRolePayload = {
                        'userID': isAdminUserCreated.userID,
                        'roleID': id,
                        'createTimestamp': new Date()
                      }
                      rolesData.push(assignRolePayload)
                    })

                    const departmentsAssigned = await models.AdminUsersDepartment.bulkCreate(departmentData,{ transaction: t });

                    const isRoleAssigned = await models.AdminUsersRole.bulkCreate(rolesData,{ transaction: t });

                    // Save person type scope (only if Curator_Scoped)
                    if (personTypeLabels && personTypeLabels.length > 0) {
                      const personTypeData = personTypeLabels.map((pt: string) => ({
                        userID: isAdminUserCreated.userID,
                        personType: pt,
                        createTimestamp: new Date(),
                      }));
                      await models.AdminUsersPersonType.bulkCreate(personTypeData, { transaction: t });
                    }

                    res.send(isRoleAssigned)
                }
            });
    }
  } catch (e) {
    console.log(e);
    res.status(500).send(e);
  }
}

export const fetchUserDetailsByUserId = async (
  req: NextApiRequest,
  res: NextApiResponse
) => {
  try {
    const UserDetails = await models.AdminUser.findAll({
      where: { userID: req.body },
      attributes: ["userID", "personIdentifier", "nameFirst", "nameMiddle", "nameLast", "email", "status"],
      include: [{
        model: models.AdminUsersDepartment,
        attributes: ["id", "userID", "departmentID"],
        as: "adminUsersDepartments",
        required: false,
      },
      {
        model: models.AdminUsersRole,
        attributes: ["id", "userID", "roleID"],
        as: "adminUsersRoles",
        required: false,
      }
      ]
    })
    res.send(UserDetails)
  } catch (e) {
    console.log(e)
  }
}

export const fetchUserPersonTypes = async (
  req: NextApiRequest,
  res: NextApiResponse
) => {
  try {
    const userId = req.query.userId as string;
    const personTypes = await models.AdminUsersPersonType.findAll({
      where: { userID: userId },
      attributes: ['personType'],
    });
    res.send(personTypes);
  } catch (e) {
    console.log(e);
    res.status(500).send(e);
  }
}