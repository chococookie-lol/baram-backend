const mysql = require('mysql');

const { DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME } = process.env;

class Sql {
  constructor() {
    this.connection = mysql.createPool({
      host: DB_HOST,
      port: DB_PORT,
      user: DB_USER,
      password: DB_PASSWORD,
      database: DB_NAME,
    });

    this.connection.getConnection(err => {
      if (err) console.log('Mysql 연결 실패', err);
      else console.log('Mysql 연결 성공');
    });
  }
  // query to db and return promise
  queryToDB(query) {
    console.log('query: ', query);
    return new Promise((resolve, reject) => {
      this.connection.getConnection((err, connect) => {
        if (err) {
          console.log(err);
          console.error(err);
          connect.release();
          return reject(err);
        }
        connect.query(query, (error, rows) => {
          if (error) reject(error);
          else resolve(rows);
        });
        connect.release();
      });
    });
  }
}

module.exports = new Sql();
