const api_key = require('./api_key');

const fetch = require("node-fetch");
const db_conn = require("../db/db");
const InternalCodeError = require('../internal_code_error');

function getMatchData(matchId) {
    return new Promise((resolve, reject) => {
        db_conn.queryToDB(`SELECT * FROM Matches WHERE matchId=${db_conn.connection.escape(matchId)};`)
        .then(rows => {
            if (rows.length == 0) {
                reject(404);
                return;
            } else if (rows.length == 1) {
                resolve(rows[0]);
            } else {
                reject();
            }
        }, reject);
    });
}

function fetchMatchDataFromRiot(matchId) {
    return new Promise((resolve, reject) => {
        fetch(`https://asia.api.riotgames.com/lol/match/v5/matches/${matchId}?api_key=${api_key}`)
        .then(res => res.json())
        .then(data => {
            // 404 from Riot api
            if (data.status != undefined) {
                reject(data);
                return;
            }
            return data.info;
        })
        .then(data => {
            const gameCreation = data.gameCreation;
            const gameDuration = data.gameDuration;
            const gameEndTimestamp = data.gameEndTimestamp;
            const gameId = data.gameId;
            const gameMode = data.gameMode;
            const gameName = data.gameName;
            const gameStartTimestamp = data.gameStartTimestamp;
            const gameType = data.gameType;
            const gameVersion = data.gameVersion;
            const mapId = data.mapId;
            const platformId = data.platformId;
            const queueId = data.queueId;
            const tournamentCode = data.tournamentCode;

            db_conn.queryToDB(`SELECT matchId FROM Matches WHERE matchId='${matchId}';`)
            .then(rows => {
                if (rows.length == 1) {
                    reject('Data already exists');
                    return;
                }
                const sql = `INSERT INTO Matches(matchId, gameCreation, gameDuration, gameEndTimestamp, gameId, gameMode, gameName, gameStartTimestamp, gameType, gameVersion, mapId, platformId, queueId, tournamentCode) 
                VALUES('${matchId}', ${gameCreation}, ${gameDuration}, ${gameEndTimestamp}, ${gameId}, '${gameMode}', '${gameName}', ${gameStartTimestamp}, '${gameType}', '${gameVersion}', ${mapId}, '${platformId}', ${queueId}, '${tournamentCode}');`;

                db_conn.queryToDB(sql)
                .then(rows => {
                    resolve(rows);
                }, console.error);
            })
        })
    });
}

function getMatchIds(puuid, count) {
    return new Promise((resolve, reject) => {
        db_conn.queryToDB(`SELECT matchId FROM Play WHERE puuid=${db_conn.connection.escape(puuid)} ORDER BY gameEndTimestamp DESC LIMIT ${count};`)
        .then(rows => {
            console.log(rows.length + ' records selected');
            if (rows.length == 0) {
                reject(new InternalCodeError(404, 'Matches not found'));
                return;
            }
            resolve(rows);
        }, reject);
    });
}

// fetch match ids from riot api server
function fetchMatchIdsFromRiot(puuid, count) {
    return new Promise((resolve, reject) => {
        fetch(`https://asia.api.riotgames.com/lol/match/v5/matches/by-puuid/${puuid}/ids?count=${count}&api_key=${api_key}`)
        .then(res => res.json()) 
        .then(data => {
            if (data.status != undefined) {
                console.error(new Date() + ' : ' + JSON.stringify(data));
                reject(new InternalCodeError(403, data.status.message));
                return;
            }

            for (let matchId of data) {
                fetch(`https://asia.api.riotgames.com/lol/match/v5/matches/${matchId}?api_key=${api_key}`)
                .then(res => res.json())
                .then(data => {
                    // 404 from Riot api
                    if (data.status != undefined) {
                        console.error(new Date() + ' : ' + JSON.stringify(data));
                        reject(new InternalCodeError(403, data.status.message));
                        return;
                    }

                    const gameEndTimestamp = data.info.gameEndTimestamp;
                    
                    // only ARAM
                    if (data.info.gameMode != "ARAM") 
                        return;

                    db_conn.queryToDB(`REPLACE INTO Play (puuid, matchId, gameEndTimestamp) VALUES('${puuid}', '${matchId}', ${gameEndTimestamp});`)
                    .then(console.log('1 record replaced'),
                    err => reject(new InternalCodeError(403, 'DB error')));
                })
            }

            resolve();
        })
    })
}

module.exports = {fetchMatchIdsFromRiot, getMatchIds, fetchMatchDataFromRiot, getMatchData};
