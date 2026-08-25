import { response } from "express";
import type { NextApiRequest, NextApiResponse } from "next";
//import { Op, Sequelize, where,Transaction } from "sequelize";
import { Op, Sequelize } from "sequelize";
import models from "../../../src/db/sequelize";
import sequelize from "../../../src/db/db";
models.AdminUser.hasMany(models.AdminUsersDepartment, {as:'AdminUserDept', constraints: false,foreignKey:"userID" });
models.AdminUser.hasOne(models.Person, {as:'person', constraints: false,foreignKey:"personIdentifier" });
models.AdminUser.hasMany(models.AdminDepartment, {as:'AdminDepartment', constraints: false,foreignKey:"departmentID" });

/**
 * Resolve a set of admin_users.userID values to display names, for the curation
 * Audit History (FeedbackLog.curatedBy). Returns a { userID: name } map; ids that
 * are missing/invalid (e.g. 0 = unknown) are simply absent from the map.
 */
export const findAdminUserNamesByIds = async (ids: number[]): Promise<{ [id: number]: string }> => {
  const map: { [id: number]: string } = {};
  const valid = (ids || []).filter((id) => Number.isInteger(id) && id > 0);
  if (valid.length === 0) {
    return map;
  }
  try {
    const users: any[] = await models.AdminUser.findAll({
      where: { userID: { [Op.in]: valid } },
      attributes: ['userID', 'nameFirst', 'nameLast'],
      raw: true,
    });
    users.forEach((u) => {
      const name = [u.nameFirst, u.nameLast].filter(Boolean).join(' ').trim();
      map[u.userID] = name || String(u.userID);
    });
  } catch (e) {
    console.log('findAdminUserNamesByIds error', e);
  }
  return map;
};

export const listAllUsers = async (
  req: NextApiRequest,
  res: NextApiResponse
) => {
  try {
    let users = {};
    const {
      limit,
      offset,
      searchTextInput
    } = req.body;
    if (req.body.limit != undefined && req.body.offset != undefined) {

     
      if (searchTextInput) {
        const where = {}
        const whereForPerson = {}
        whereForPerson[Op.and] =[];
        where[Op.and] = []

        whereForPerson[Op.and].push({
          // [Op.or]:[
          //   {
          //     '$primaryOrganizationalUnit$': {
          //       [Op.like]: `%${searchTextInput}%`
          //     }
          //   }
          // ]
        })
        
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
          },{
            '$AdminUser.personIdentifier$': {
              [Op.like]: `%${searchTextInput}%`
            }
          },{
            '$departmentLabel$': {
              [Op.like]: `%${searchTextInput}%`
            }
          },{
            '$email$': {
              [Op.like]: `%${searchTextInput}%`
            }
          },{
            '$primaryOrganizationalUnit$': {
              [Op.like]: `%${searchTextInput}%`
            }
          }]
        }) 
        const {
          count,
          rows
        } = await models.AdminUser.findAndCountAll({

          // new code 
          attributes:['userID','personIdentifier', 'email', "nameFirst", "nameMiddle", "nameLast", ],
          include: [
            {
              model: models.Person,
              as: "person",
              required: false,
              on: {
                col: Sequelize.where(Sequelize.col('AdminUser.personIdentifier'), "=", Sequelize.col('person.personIdentifier'))
              },
              attributes: ['primaryOrganizationalUnit'],
              where: whereForPerson,
            },
            {
              model: models.AdminUsersDepartment,
              as: "AdminUserDept",
              required: false,
              on: {
                col: Sequelize.where(Sequelize.col('AdminUser.userID'), "=", Sequelize.col('AdminUserDept.userID'))
              },
              attributes: [[Sequelize.fn("GROUP_CONCAT", Sequelize.col('AdminDepartment.departmentLabel')),"departmentLabel",],'userID'],
            },
            {
              model: models.AdminDepartment,
              as: "AdminDepartment",
              required: false,
              on: {
                col: Sequelize.where(Sequelize.col('AdminUserDept.departmentID'), "=", Sequelize.col('AdminDepartment.departmentID'))
              },
              where: where,
              attributes: ["departmentLabel"]
            },
          ],
          where: where,
          group: ['AdminUser.userID'],
          order: [["nameFirst","ASC"],["nameLast","ASC"]],
          subQuery: false,
          offset: req.body.offset,
          limit: req.body.limit,

        });
        users['usersData'] = rows;
        users['totalUsersCount'] = count;
      } else {
        const {
          count,
          rows
        } = await models.AdminUser.findAndCountAll({
          attributes:['userID','personIdentifier', 'email', "nameFirst", "nameMiddle", "nameLast", ],
          include: [
            {
              model: models.Person,
              as: "person",
              required: true,
              on: {
                col: Sequelize.where(Sequelize.col('AdminUser.personIdentifier'), "=", Sequelize.col('person.personIdentifier'))
              },
              attributes: ['primaryOrganizationalUnit'],
            },
            {
              model: models.AdminUsersDepartment,
              as: "AdminUserDept",
              required: false,
              on: {
                col: Sequelize.where(Sequelize.col('AdminUser.userID'), "=", Sequelize.col('AdminUserDept.userID'))
              },
              attributes: [[Sequelize.fn("GROUP_CONCAT", Sequelize.col('AdminDepartment.departmentLabel')),"departmentLabel",],'userID'],
            },
            {
              model: models.AdminDepartment,
              as: "AdminDepartment",
              required: false,
              on: {
                col: Sequelize.where(Sequelize.col('AdminUserDept.departmentID'), "=", Sequelize.col('AdminDepartment.departmentID'))
              },
              attributes: ["departmentLabel"]
            },
          ],
          group: ['AdminUser.userID'],
          subQuery: false,
          order: [["nameFirst","ASC"],["nameLast","ASC"]],
          offset: req.body.offset,
          limit: req.body.limit,
        });
        users['usersData'] = rows;
        users['totalUsersCount'] = count.length;
      }
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
  const { cwid, email, firstName, lastName, middleName, division, title, selectedRoleIds, departmentIds, isEditUserId, scopePersonTypes, scopeOrgUnits } = req.body;
  // Curator_Scoped's personType/orgUnit scope (admin_users.scope_person_types/scope_org_units,
  // see PM#849). Empty/absent clears scope -- matches the JSON DEFAULT NULL columns and the
  // full-replace pattern already used for roles/departments below.
  // Array.isArray, not just truthiness -- a client-sent string also has .length, and would
  // otherwise get persisted verbatim into the JSON column, then read back as a string instead
  // of an array everywhere downstream that assumes one (canCurate/isPersonInScope).
  const scopeFields = {
    scope_person_types: Array.isArray(scopePersonTypes) && scopePersonTypes.length > 0 ? scopePersonTypes : null,
    scope_org_units: Array.isArray(scopeOrgUnits) && scopeOrgUnits.length > 0 ? scopeOrgUnits : null,
  };

  try {
    // A saved scope with no Curator_Scoped role is inert -- canCurate's scoped branch checks
    // the scope itself now, but the admin roster/role columns should still reflect reality.
    // Looked up dynamically by roleLabel, never hardcoded, since roleID is environment data.
    let effectiveRoleIds: any[] = Array.isArray(selectedRoleIds) ? [...selectedRoleIds] : [];
    if (scopeFields.scope_person_types || scopeFields.scope_org_units) {
      const curatorScopedRole: any = await models.AdminRole.findOne({ where: { roleLabel: 'Curator_Scoped' }, raw: true });
      if (curatorScopedRole?.roleID != null && !effectiveRoleIds.includes(curatorScopedRole.roleID)) {
        effectiveRoleIds.push(curatorScopedRole.roleID);
      }
    }

    if (isEditUserId) {
      //Update admin user Payload
      let updateUserPayload = {
        'nameFirst': firstName,
        'nameMiddle': middleName,
        'nameLast': lastName,
        'modifyTimestamp': new Date(),
        ...scopeFields
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

              effectiveRoleIds?.map((id) => {
                let assignRolePayload = {
                  'userID': isEditUserId,
                  'roleID': id,
                  'createTimestamp': new Date()
                }
                rolesData.push(assignRolePayload)
              })

              const departmentsAssigned = await models.AdminUsersDepartment.bulkCreate(departmentData,{ transaction: t });

              const isRoleAssigned = await models.AdminUsersRole.bulkCreate(rolesData,{ transaction: t });

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
        'createTimestamp': new Date(),
        ...scopeFields
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
                    effectiveRoleIds?.map((id) => {
                      let assignRolePayload = {
                        'userID': isAdminUserCreated.userID,
                        'roleID': id,
                        'createTimestamp': new Date()
                      }
                      rolesData.push(assignRolePayload)
                    })

                    const departmentsAssigned = await models.AdminUsersDepartment.bulkCreate(departmentData,{ transaction: t });

                    const isRoleAssigned = await models.AdminUsersRole.bulkCreate(rolesData,{ transaction: t });
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
      attributes: ["userID", "personIdentifier", "nameFirst", "nameMiddle", "nameLast", "email", "status", "scope_person_types", "scope_org_units"],
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