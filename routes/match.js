const express = require("express");
const Result = require("../model/result");
const MatchApi = require('../model/api/match_api');

var router = express.Router();

router.post('/by-puuid/:puuid', (req, res) => {
    let count = (req.query.count != undefined) ? req.query.count : 20;
    MatchApi.fetchMatchIdsFromRiot(req.params.puuid, count)
    .then(data => {
        res.send(new Result(200, {message: 'OK - Fetch complete'}));
    }, err => { 
        console.error(err);
        res.send(new Result(500, {message: 'Internel server error', error: err}));
    });
})

router.get('/by-puuid/:puuid/fetch', (req, res) => {
    let count = (req.query.count != undefined) ? req.query.count : 20;
    MatchApi.fetchMatchIdsFromRiot(req.params.puuid, count)
    .then(data => {
        res.send(new Result(200, {message: 'OK - Fetch complete'}));
    }, err => { 
        console.error(err);
        res.send(new Result(500, {message: 'Internel server error', error: err}));
    });
});

router.get('/by-puuid/:puuid/ids', (req, res) => {
    let count = (req.query.count != undefined) ? req.query.count : 20;
    MatchApi.getMatchIds(req.params.puuid, count)
    .then(rows => {
        if (rows.length == 0) {
            res.send(new Result(404, {message: 'Data not found'}));
        } else {
            res.send(new Result(200, rows));
        }
    }, err => {
        console.error(err);
        res.send(new Result(500, {message: 'Internel server error', error: err}));
    });
});

router.get('/:matchId/fetch', (req, res) => {
    MatchApi.fetchMatchDataFromRiot(req.params.matchId)
    .then(data => {
        res.send(new Result(200, {message: 'OK - Fetch complete'}));
    }, err => {
        console.error(err);
        res.send(new Result(500, {message: 'Internel server error - ' + err}));
    });
});

router.get('/:matchId', (req, res) => {
    MatchApi.getMatchData(req.params.matchId) 
    .then(data => {
        res.send(new Result(200, {data}));
    }, err => {
        if (err == 404) {
            res.send(new Result(404, {message: 'Data not found'}));
        } else {
            res.send(new Result(500, {message: 'Internal server error', error: err}));
        }
    });
});

module.exports = router;
