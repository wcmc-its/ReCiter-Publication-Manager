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
            // The dev RDS (db.t4g.micro) allows 30 connections, and a local `next dev` at 20 has
            // exhausted it (ER_CON_COUNT_ERROR). Set RECITER_DB_POOL_MAX=10 in .env.local; prod
            // leaves it unset.
            max: Number(process.env.RECITER_DB_POOL_MAX) || 20,
            min: 0,
            acquire: 30000,
            idle: 10000
        },
        //logging: false
})

export default sequelize