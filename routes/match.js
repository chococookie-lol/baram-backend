const express = require("express");
const MatchApi = require('../model/api/match_api');
const Joi = require('joi');

var router = express.Router();

const puuid_count_schema = Joi.object({
    params: Joi.object({
        puuid: Joi.string().min(78).max(78).required(),
        type: Joi.string().valid('latest','older'),
    }).unknown(true),
    query: Joi.object({ count: Joi.number().integer().min(1).max(100) }).unknown(true)
}).unknown(true);

const matchId_schema = Joi.object({
    params: Joi.object({ matchId: Joi.string().min(3).max(30).required() }).unknown(true)
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

router.post('/by-puuid/:puuid', middleware(puuid_count_schema), (req, res) => {
    let count = req.query.count ?? 20;
    let type = req.query.type ?? 'latest';
    MatchApi.fetchMatchIdsFromRiot(req.params.puuid, type, count)
    .then(
        () => res.status(201).json({}),
        err => {console.log(err);res.status(err.code).json({error: err.message})}
    )
    .catch(err => {
        console.log(err);
        console.error(JSON.stringify(err));
        res.status(500).json({message: err.message})
    });
})

router.get('/by-puuid/:puuid', middleware(puuid_count_schema), (req, res) => {
    let count = (req.query.count) ? req.query.count : 20;
    MatchApi.getMatchIds(req.params.puuid, count)
    .then(data => {
        res.status(200).json(data.map(i => i.matchId));
    }, err => {
        console.log(err);
        res.status(err.code).json({message: err.message});
    })
    .catch(err => {
        console.error(JSON.stringify(err));
        res.status(500).json({message: err.message})
    });
});

router.post('/:matchId', middleware(matchId_schema), (req, res) => {
    MatchApi.fetchMatchDataFromRiot(req.params.matchId)
    .then(
        () => res.status(201).json({}),
        err => res.status(err.code).json({message: err.message})
    )
    .catch(err => {
        console.trace();
        console.error(JSON.stringify(err));
        res.status(500).json({message: err.message})
    });
});

router.get('/:matchId', middleware(matchId_schema), (req, res) => {
    MatchApi.getMatchData(req.params.matchId) 
    .then(
        data => res.status(200).json(data),
        err => res.status(err.code).json({message: err.message})
    )
    .catch(err => {
        console.error(JSON.stringify(err));
        res.status(500).json({message: err.message})
    });
});

module.exports = router;
