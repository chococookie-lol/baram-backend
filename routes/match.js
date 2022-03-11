const express = require("express");
const MatchApi = require('../model/api/match_api');
const Joi = require('joi');
const bodyParser = require('body-parser');

var router = express.Router();

const puuid_count_schema = Joi.object({
    params: Joi.object({
        puuid: Joi.string().min(78).max(78).required(),
    }).unknown(true),
    query: Joi.object({
        count: Joi.number().integer().min(1).max(100),
        after: Joi.number().integer().min(0).max(10000000000000),
    }).unknown(true),
}).unknown(true);

const matchId_schema = Joi.object({
    params: Joi.object({ matchId: Joi.string().min(3).max(30).required() }).unknown(true)
}).unknown(true);

const middleware = (schema, property) => {
    return (req, res, next) => {
        const { error } = schema.validate(req);

        if (!error) {
            next();
        } else {
            const { details } = error;
            console.log(details);
            const message = details.map(i => i.message).join(',');
            res.status(400).json({ message: message });
        }
    }
};

// /matches/by-puuid/{puuid}
// fetch match data from riot api
router.post('/by-puuid/:puuid', middleware(puuid_count_schema), (req, res) => {
    let count = req.query.count ?? 10;
    let after = req.query.after;
    MatchApi.fetchMatchIdsFromRiot(req.params.puuid, after, count)
        .then(
            () => res.status(201).json({}),
            err => { console.log(err); res.status(err.code).json({ error: err.message }) }
        )
        .catch(err => {
            console.log(err);
            console.error(JSON.stringify(err));
            res.status(500).json({ message: err.message })
        });
})

// /matches/by-puuid/{puuid}
// get match data from db
router.get('/by-puuid/:puuid', middleware(puuid_count_schema), (req, res) => {
    let count = req.query.count ?? 20;
    let after = req.query.after;
    MatchApi.getMatchIds(req.params.puuid, after, count)
        .then(data => {
            res.status(200).json(data.map(i => i.matchId));
        }, err => {
            console.log(err);
            res.status(err.code).json({ message: err.message });
        })
        .catch(err => {
            console.error(JSON.stringify(err));
            res.status(500).json({ message: err.message })
        });
});

// /matches/{matchId}
router.post('/:matchId', middleware(matchId_schema), (req, res) => {
    MatchApi.fetchMatchData(req.params.matchId, undefined)
        .then(
            () => res.status(201).json({}),
            err => res.status(err.code ?? 500).json({ message: err.message })
        )
        .catch(err => {
            console.trace();
            console.error(JSON.stringify(err));
            res.status(500).json({ message: err.message })
        });
});

router.get('/:matchId', middleware(matchId_schema), (req, res) => {
    MatchApi.getMatchData(req.params.matchId)
        .then(
            data => res.status(200).json(data),
            err => res.status(err.code).json({ message: err.message })
        )
        .catch(err => {
            console.error(JSON.stringify(err));
            res.status(500).json({ message: err.message })
        });
});

module.exports = router;
