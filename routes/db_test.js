const express = require('express');
const result = require('../model/result');
const db_conn = require('../model/sql');

var router = express.Router();

router.get('/', (req, res) => {
    db_conn.connection.query('SELECT * from test', (error, rows, fields) => {
        if (error) throw error;
        res.send(rows);
    })
})

module.exports = router;