import { response } from "express";
import type { NextApiRequest, NextApiResponse } from "next";
//import { Op, Sequelize, where,Transaction } from "sequelize";
import { Op, Sequelize } from "sequelize";
import models from "../../../src/db/sequelize";
import sequelize from "../../../src/db/db";
models.AdminUser.hasMany(models.AdminUsersDepartment, {as:'AdminUserDept', constraints: false,foreignKey:"userID" });
models.AdminUser.hasOne(models.Person, {as:'person', constraints: false,foreignKey:"personIdentifier" });
models.AdminUser.hasMany(models.AdminDepartment, {as:'AdminDepartment', constraints: false,foreignKey:"departmentID" });

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
  const { cwid, email, firstName, lastName, middleName, division, title, selectedRoleIds, departmentIds, isEditUserId } = req.body;

  try {
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