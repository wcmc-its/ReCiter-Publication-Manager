import { Sequelize } from "sequelize"

const sequelize = new Sequelize(
    process.env.RECITER_DB_NAME || "",
    process.env.RECITER_DB_USERNAME || "",
    process.env.RECITER_DB_PASSWORD,
    {
        dialect: 'mysql',
        host: process.env.RECITER_DB_HOST,
        port: Number(process.env.RECITER_DB_PORT) || 3306,
        pool: {
            max: 20,
            min: 0,
            acquire: 30000,
            idle: 10000
        },
        //logging: false
})

export default sequelize