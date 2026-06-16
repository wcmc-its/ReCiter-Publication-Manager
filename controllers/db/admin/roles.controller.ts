import type { NextApiRequest, NextApiResponse } from "next";
import { Op, Sequelize } from "sequelize";
import models from "../../../src/db/sequelize";
import sequelize from "../../../src/db/db";

export const listAllRolesWithPermissions = async (
  req: NextApiRequest,
  res: NextApiResponse
) => {
  try {
    const roles = await models.AdminRole.findAll({
      include: [
        {
          model: models.AdminRolePermission,
          as: "adminRolePermissions",
          include: [
            {
              model: models.AdminPermission,
              as: "permission",
              attributes: ["permissionID", "permissionKey", "label"],
            },
          ],
        },
        {
          model: models.AdminUsersRole,
          as: "adminUsersRoles",
          attributes: ["userID"],
        },
      ],
      order: [["roleLabel", "ASC"]],
    });

    const result = roles.map((role: any) => ({
      roleID: role.roleID,
      roleLabel: role.roleLabel,
      permissions: (role.adminRolePermissions || []).map((rp: any) => ({
        permissionID: rp.permission?.permissionID,
        permissionKey: rp.permission?.permissionKey,
        label: rp.permission?.label,
      })),
      userCount: (role.adminUsersRoles || []).length,
    }));

    res.json(result);
  } catch (e) {
    console.log(e);
    res.status(500).send(e);
  }
};

export const createRole = async (
  req: NextApiRequest,
  res: NextApiResponse
) => {
  try {
    const { roleLabel, permissionIDs } = req.body;

    if (!roleLabel || !roleLabel.trim()) {
      return res.status(400).json({ error: "Role name is required." });
    }

    const result = await sequelize.transaction(async (t) => {
      const newRole = await models.AdminRole.create(
        {
          roleLabel: roleLabel.trim(),
          createTimestamp: new Date(),
          modifyTimestamp: new Date(),
        },
        { transaction: t }
      );

      if (Array.isArray(permissionIDs) && permissionIDs.length > 0) {
        await models.AdminRolePermission.bulkCreate(
          permissionIDs.map((pid: number) => ({
            roleID: newRole.roleID,
            permissionID: pid,
            createTimestamp: new Date(),
          })),
          { transaction: t }
        );
      }

      return newRole;
    });

    res.status(201).json(result);
  } catch (e) {
    console.log(e);
    res.status(500).send(e);
  }
};

export const updateRole = async (
  req: NextApiRequest,
  res: NextApiResponse
) => {
  try {
    const roleId = Number(req.query.roleId);
    const { roleLabel, permissionIDs } = req.body;

    if (!roleLabel || !roleLabel.trim()) {
      return res.status(400).json({ error: "Role name is required." });
    }

    await sequelize.transaction(async (t) => {
      await models.AdminRolePermission.destroy({
        where: { roleID: roleId },
        transaction: t,
      });

      if (Array.isArray(permissionIDs) && permissionIDs.length > 0) {
        await models.AdminRolePermission.bulkCreate(
          permissionIDs.map((pid: number) => ({
            roleID: roleId,
            permissionID: pid,
            createTimestamp: new Date(),
          })),
          { transaction: t }
        );
      }

      await models.AdminRole.update(
        {
          roleLabel: roleLabel.trim(),
          modifyTimestamp: new Date(),
        },
        {
          where: { roleID: roleId },
          transaction: t,
        }
      );
    });

    res.status(200).json({ success: true });
  } catch (e) {
    console.log(e);
    res.status(500).send(e);
  }
};

export const deleteRole = async (
  req: NextApiRequest,
  res: NextApiResponse
) => {
  try {
    const roleId = Number(req.query.roleId);
    const checkOnly = req.query.check === "true";

    const userAssignments = await models.AdminUsersRole.findAll({
      where: { roleID: roleId },
      include: [
        {
          model: models.AdminUser,
          as: "user",
          attributes: ["nameFirst", "nameLast"],
        },
      ],
    });

    if (userAssignments.length > 0) {
      return res.status(409).json({
        canDelete: false,
        userCount: userAssignments.length,
        users: userAssignments.map((ua: any) => ({
          name: `${ua.user?.nameFirst || ""} ${ua.user?.nameLast || ""}`.trim(),
        })),
      });
    }

    if (checkOnly) {
      return res.status(200).json({ canDelete: true });
    }

    await sequelize.transaction(async (t) => {
      await models.AdminRolePermission.destroy({
        where: { roleID: roleId },
        transaction: t,
      });

      await models.AdminRole.destroy({
        where: { roleID: roleId },
        transaction: t,
      });
    });

    res.status(200).json({ success: true });
  } catch (e) {
    console.log(e);
    res.status(500).send(e);
  }
};
