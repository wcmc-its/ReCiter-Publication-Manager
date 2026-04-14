import type { NextApiRequest, NextApiResponse } from "next";
import { Op, Sequelize } from "sequelize";
import models from "../../../src/db/sequelize";
import sequelize from "../../../src/db/db";

export const listAllPermissionsWithResources = async (
  req: NextApiRequest,
  res: NextApiResponse
) => {
  try {
    const permissions = await models.AdminPermission.findAll({
      include: [
        {
          model: models.AdminPermissionResource,
          as: "adminPermissionResources",
          attributes: [
            "id",
            "resourceType",
            "resourceKey",
            "displayOrder",
            "icon",
            "label",
            "route",
          ],
        },
      ],
      order: [
        ["category", "ASC"],
        ["permissionKey", "ASC"],
      ],
    });

    const result = permissions.map((p: any) => ({
      permissionID: p.permissionID,
      permissionKey: p.permissionKey,
      label: p.label,
      description: p.description,
      category: p.category,
      resourceCount: p.adminPermissionResources?.length || 0,
      resources: p.adminPermissionResources,
    }));

    res.json(result);
  } catch (e) {
    console.log(e);
    res.status(500).send(e);
  }
};

export const createPermission = async (
  req: NextApiRequest,
  res: NextApiResponse
) => {
  try {
    const { permissionKey, label, description, category, resources } = req.body;

    if (!permissionKey?.trim()) {
      return res
        .status(400)
        .json({ error: "Permission key is required." });
    }
    if (!label?.trim()) {
      return res.status(400).json({ error: "Label is required." });
    }
    if (!category?.trim()) {
      return res.status(400).json({ error: "Category is required." });
    }

    const result = await sequelize.transaction(async (t) => {
      const newPerm = await models.AdminPermission.create(
        {
          permissionKey: permissionKey.trim(),
          label: label.trim(),
          description: description?.trim() || null,
          category: category.trim(),
          createTimestamp: new Date(),
          modifyTimestamp: new Date(),
        },
        { transaction: t }
      );

      if (Array.isArray(resources) && resources.length > 0) {
        await models.AdminPermissionResource.bulkCreate(
          resources.map((r: any) => ({
            permissionID: newPerm.permissionID,
            resourceType: r.resourceType,
            resourceKey: r.resourceKey,
            displayOrder: r.displayOrder || 0,
            icon: r.icon || null,
            label: r.label,
            route: r.route || null,
            createTimestamp: new Date(),
          })),
          { transaction: t }
        );
      }

      return newPerm;
    });

    res.status(201).json(result);
  } catch (e: any) {
    if (e.name === "SequelizeUniqueConstraintError") {
      return res
        .status(409)
        .json({ error: "A permission with this key already exists." });
    }
    console.log(e);
    res.status(500).send(e);
  }
};

export const updatePermission = async (
  req: NextApiRequest,
  res: NextApiResponse
) => {
  try {
    const permissionId = Number(req.query.permissionId);
    const { label, description, category, resources } = req.body;

    if (!label?.trim()) {
      return res.status(400).json({ error: "Label is required." });
    }
    if (!category?.trim()) {
      return res.status(400).json({ error: "Category is required." });
    }

    await sequelize.transaction(async (t) => {
      await models.AdminPermission.update(
        {
          label: label.trim(),
          description: description?.trim() || null,
          category: category.trim(),
          modifyTimestamp: new Date(),
        },
        {
          where: { permissionID: permissionId },
          transaction: t,
        }
      );

      await models.AdminPermissionResource.destroy({
        where: { permissionID: permissionId },
        transaction: t,
      });

      if (Array.isArray(resources) && resources.length > 0) {
        await models.AdminPermissionResource.bulkCreate(
          resources.map((r: any) => ({
            permissionID: permissionId,
            resourceType: r.resourceType,
            resourceKey: r.resourceKey,
            displayOrder: r.displayOrder || 0,
            icon: r.icon || null,
            label: r.label,
            route: r.route || null,
            createTimestamp: new Date(),
          })),
          { transaction: t }
        );
      }
    });

    res.status(200).json({ success: true });
  } catch (e) {
    console.log(e);
    res.status(500).send(e);
  }
};

export const deletePermission = async (
  req: NextApiRequest,
  res: NextApiResponse
) => {
  try {
    const permissionId = Number(req.query.permissionId);
    const checkOnly = req.query.check === "true";

    const rolePermissions = await models.AdminRolePermission.findAll({
      where: { permissionID: permissionId },
      include: [
        {
          model: models.AdminRole,
          as: "role",
          attributes: ["roleID", "roleLabel"],
          include: [
            {
              model: models.AdminUsersRole,
              as: "adminUsersRoles",
              attributes: ["userID"],
            },
          ],
        },
      ],
    });

    if (rolePermissions.length > 0) {
      return res.status(409).json({
        canDelete: false,
        roles: rolePermissions.map((rp: any) => ({
          roleLabel: rp.role.roleLabel,
          userCount: rp.role.adminUsersRoles?.length || 0,
        })),
      });
    }

    if (checkOnly) {
      return res.status(200).json({ canDelete: true });
    }

    await sequelize.transaction(async (t) => {
      await models.AdminPermissionResource.destroy({
        where: { permissionID: permissionId },
        transaction: t,
      });

      await models.AdminPermission.destroy({
        where: { permissionID: permissionId },
        transaction: t,
      });
    });

    res.status(200).json({ success: true });
  } catch (e) {
    console.log(e);
    res.status(500).send(e);
  }
};

export const getDistinctCategories = async (
  req: NextApiRequest,
  res: NextApiResponse
) => {
  try {
    const categories = await models.AdminPermission.findAll({
      attributes: [
        [Sequelize.fn("DISTINCT", Sequelize.col("category")), "category"],
      ],
      order: [["category", "ASC"]],
      raw: true,
    });

    res.json(categories.map((c: any) => c.category));
  } catch (e) {
    console.log(e);
    res.status(500).send(e);
  }
};
