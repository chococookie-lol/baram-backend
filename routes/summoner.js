const express = require("express");
const SummonerApi = require('../model/api/summoner_api');
const MatchApi = require('../model/api/match_api');
const mysql = require('mysql');
const Joi = require('joi'); 

var router = express.Router();

const name_schema = Joi.object().keys({ 
    name: Joi.string().min(3).required()
});

const middleware = (schema, property) => {
    return (req, res, next) => { 
        const { error } = schema.validate(req.params);
        const valid = error == null;
    
        if (valid) { 
            //sql escape is done in middleware
            //req.params.name = mysql.escape(req.params.name);
            next();
        } else { 
            const { details } = error; 
            console.log(details);
            const message = details.map(i => i.message).join(','); 
            res.status(400).json({ message: message });
        } 
    }
};

// /summoners/{name}
router.get('/:name', middleware(name_schema), (req, res) => {
    SummonerApi.getSummoner(req.params.name)
    .then(data => {
        res.status(200).json(data);
    }, err => res.status(err.code).json({error: err.message}));
});

// /summoners/{name}
router.post('/:name', middleware(name_schema), (req, res) => {
    console.log('fetch start');
    SummonerApi.fetchSummonerFromRiot(req.params.name)
    .then(
        data => res.status(200).json(),
        err => res.status(err.code).json({message: err.message}));
});

router.get('/:name/matches', middleware(name_schema), (req, res) => {
    SummonerApi.getSummoner(req.params.name)
    .then(data => {
        let count = (req.query.count != undefined) ? req.query.count : 20;
        return MatchApi.getMatchIds(data.puuid, count);
    })
    .then(data => {
        res.status(200).json(data.map(i => i.matchId));
    }, err => {
        res.status(err.code).json({message: err.message});
    })
    .catch(err => res.status(500).json({message: err.message}));
});

module.exports = router;