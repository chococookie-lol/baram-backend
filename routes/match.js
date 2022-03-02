const express = require("express");
const Result = require("../model/result");
const MatchApi = require('../model/api/match_api');
const Joi = require('Joi');

var router = express.Router();

const schema = Joi.object({
    params: Joi.object({ puuid: Joi.string().min(78).max(78).required() }).unknown(true),
    query: Joi.object({ count: Joi.number().integer().min(1).max(100) }).unknown(true)
}).unknown(true);

const middleware = (schema, property) => {
    return (req, res, next) => { 
        const { error } = schema.validate(req);
        const valid = error == null;
    
        if (valid) { 
            next();
        } else { 
            const { details } = error; 
            console.log(details);
            const message = details.map(i => i.message).join(','); 
            res.status(400).json({ message: message });
        } 
    }
};

router.post('/by-puuid/:puuid', middleware(schema), (req, res) => {
    let count = (req.query.count != undefined) ? req.query.count : 20;
    MatchApi.fetchMatchIdsFromRiot(req.params.puuid, count)
    .then(
        () => res.status(201).json({}),
        err => res.status(err.code).json({error: err.message})
    );
})

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
        res.status(200).json(data);
    }, err => {
        if (err == 404) {
            res.status(404).json({message: 'Data not found'});
        } else {
            res.send(new Result(500, {message: 'Internal server error', error: err}));
        }
    });
});

module.exports = router;
