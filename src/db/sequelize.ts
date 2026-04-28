import sequelize from "./db";
import { initModels } from './models/init-models';

const models = initModels(sequelize);

export default models;