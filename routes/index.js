const express = require("express");
const Result = require("../model/result");

var router = express.Router();

router.get('/', (req, res) => {
    res.send(new Result(200, {message: 'server available'}));
});

module.exports = router;