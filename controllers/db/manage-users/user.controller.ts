import type { NextApiRequest, NextApiResponse } from "next";
import { Op, Sequelize } from "sequelize";
import models from "../../../src/db/sequelize";

export const listAllUsers = async (
  req: NextApiRequest,
  res: NextApiResponse
) => {
  try {
    const users = await models.AdminUser.findAll();
    res.send(users);
  } catch (e) {
    console.log(e);
    res.status(500).send(e);
  }
}