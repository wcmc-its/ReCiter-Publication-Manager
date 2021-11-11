const SequelizeAuto = require("sequelize-auto");

const args = process.argv.slice(2);
let tables = [];
args.forEach((arg) => {
    tables.push(arg);
});

const db = process.env.RECITER_DB_NAME || "";
const userName = process.env.RECITER_DB_USERNAME || "";
const password = process.env.RECITER_DB_PASSWORD || "";

const auto = new SequelizeAuto(db, userName, password, {
    host: process.env.RECITER_DB_HOST,
    dialect: "mysql",
    directory: "./src/db/models", // where to write files
    port: 3306,
    caseModel: "p", // convert snake_case column names to camelCase field names: user_id -> userId
    caseFile: "p",
    singularize: true, // convert plural table names to singular model names
    tables: tables.length > 0 ? tables : null, // use all tables, if omitted,
    lang: 'ts'
});

auto.run().then((data) => {
    console.log(data.tables); // table and field list       // text of generated models
});
