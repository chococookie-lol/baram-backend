const api_key = require('./api_key');

const fetch = require("node-fetch");
const db_conn = require("../sql");
const InternalCodeError = require("../internal_code_error");

// get summoner data from db
function getSummoner(name) {
    return new Promise((resolve, reject) => {
        db_conn.queryToDB(`SELECT * FROM Summoner WHERE name=${name};`)
        .then(rows => {
            if (rows.length == 1) {
                resolve(rows[0]);
            } else {
                reject(new InternalCodeError(404, 'Summoner not found'));
            }
        }, reject);
    });
}

// fetch summoner data from riot api server
function fetchSummonerFromRiot(name) {
    return new Promise((resolve, reject) => {
        fetch(`https://kr.api.riotgames.com/lol/summoner/v4/summoners/by-name/${name}?api_key=${api_key}`)
        .then(res => res.json())
        .then(data => {
            // 404 from Riot api
            if (data.status != undefined) {
                console.error(new Date() + ' : ' + JSON.stringify(data));
                reject(new InternalCodeError(403, data.status.message));
                return;
            }

            // parse data
            const accountId = data.accountId;
            const profileIconId = data.profileIconId;
            const revisionDate = data.revisionDate;
            const data_name = data.name;
            const id = data.id;
            const puuid = data.puuid;
            const summonerLevel = data.summonerLevel;

            // replace data by primary key puuid
            let sql = `REPLACE INTO Summoner (accountId, profileIconId, revisionDate, name, id, puuid, summonerLevel) VALUES('${accountId}', ${profileIconId}, ${revisionDate}, '${data_name}', '${id}', '${puuid}', ${summonerLevel});`
            db_conn.queryToDB(sql)
            .then(rows => {
                console.log('1 record replaced');
                resolve(rows);
            }, err => {
                console.error(new Date() + ' : ' + JSON.stringify(err));
                reject(new InternalCodeError(403, 'DB error'));
            });
        })
    })
}

module.exports = {getSummoner, fetchSummonerFromRiot};
