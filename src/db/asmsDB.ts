import { Sequelize } from "sequelize"

export const sequelizeASMS = new Sequelize(
    process.env.ASMS_DB_NAME || "",
    process.env.ASMS_DB_USERNAME || "",
    process.env.ASMS_DB_PASSWORD,
    {
        dialect: 'mssql',
        host: process.env.ASMS_DB_HOST,
        port: 1433,
        pool: {
            max: 20,
            min: 0,
            acquire: 30000,
            idle: 10000
        },
        //logging: false
})

export default sequelizeASMS