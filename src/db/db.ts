import { Sequelize } from 'sequelize-typescript'

const sequelize = new Sequelize({
    database: process.env.RECITER_DB_NAME,
    username: process.env.RECITER_DB_USERNAME,
    password: process.env.RECITER_DB_PASSWORD,
    dialect: 'mysql',
    host: process.env.RECITER_DB_HOST,
    port: 3306,
    pool: {
        max: 20,
        min: 0,
        acquire: 30000,
        idle: 10000
    },
    models: [__dirname + './models']
})