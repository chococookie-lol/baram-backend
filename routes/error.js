const express = require("express");
const Result = require("../model/result");

var router = express.Router();

router.get('*', (req, res) => {
    res.status(404).json({message: 'Not Found'});
});

module.exports = router;