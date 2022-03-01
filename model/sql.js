const mysql = require('mysql');

const {DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME} = process.env;

class Sql{
    constructor() {
        this.connection = mysql.createConnection({
            host: DB_HOST,
            port: DB_PORT,
            user: DB_USER,
            password: DB_PASSWORD,
            database: DB_NAME 
        })

        this.connection.connect(err => {
            if (err) console.log("Mysql 연결 실패", err);
            else console.log("Mysql 연결 성공");
        })
    }
    // query to db and return promise
    queryToDB(query) {
        console.log('query: ', query);
        return new Promise((resolve, reject) => {
            this.connection.query(query, (error, rows, fields) => {
                if (error) reject(error);
                else resolve(rows);
            });
        });
    }
}

module.exports = new Sql();
