const api_key = require('./api_key');

const fetch = require("node-fetch");
const db_conn = require("../db/db");
const InternalCodeError = require("../internal_code_error");
const e = require('express');

// get summoner data from db
function getSummoner(name) {
    return db_conn.queryToDB(`SELECT * FROM Summoner WHERE name='${name}';`)
        .then(rows => {
            if (rows.length == 1) {
                return rows[0];
            } else {
                throw new InternalCodeError(404, 'Summoner not found');
            }
        }, err => { throw new InternalCodeError(403, err.message) });
}

// fetch summoner data from riot api server
function fetchSummonerFromRiot(name) {
    return fetch(`https://kr.api.riotgames.com/lol/summoner/v4/summoners/by-name/${name}?api_key=${api_key}`)
        .then(res => res.json())
        .then(data => {
            // 404 from Riot api
            if (data.status != undefined)
                throw new InternalCodeError(403, data.status.message);

            // parse data
            const accountId = data.accountId;
            const profileIconId = data.profileIconId;
            const revisionDate = data.revisionDate;
            const data_name = data.name;
            const id = data.id;
            const puuid = data.puuid
            const summonerLevel = data.summonerLevel;

            // replace data by primary key puuid
            let sql = `REPLACE INTO Summoner (accountId, profileIconId, revisionDate, name, id, puuid, summonerLevel, recentUpdate) VALUES('${accountId}', ${profileIconId}, ${revisionDate}, '${data_name}', '${id}', '${puuid}', ${summonerLevel}, ${Date.now()});`
            return db_conn.queryToDB(sql);
        })
        .then(rows => {
            console.log('1 record replaced');
            return rows;
        })
        .catch(err => {
            console.error(new Date() + ' : ' + JSON.stringify(err));
            console.trace();
            if (err.code == undefined)
                throw new InternalCodeError(403, 'DB error');
            else
                throw err;
        })
}

module.exports = { getSummoner, fetchSummonerFromRiot };
