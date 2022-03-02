const express = require("express");

var router = express.Router();

router.get('*', (req, res) => {
    res.status(404).json({message: 'Not Found'});
});

module.exports = router;