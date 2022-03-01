const express = require("express");
const Result = require("../model/result");

var router = express.Router();

router.get('*', (req, res) => {
    res.send(new Result(404, 'error'));
});

module.exports = router;