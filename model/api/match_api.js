const api_key = require('./api_key');

const fetch = require("node-fetch");
const db_conn = require("../db/db");
const InternalCodeError = require('../internal_code_error');

async function getMatchData(matchId) {
    let dbResult = await db_conn.queryToDB(`SELECT * FROM Matches WHERE matchId=${db_conn.connection.escape(matchId)};`);

    if (dbResult.length == 0) 
        throw new InternalCodeError(404, 'Match not found');
    else if (dbResult.length == 1)
        return dbResult[0];
    else {
        console.error(JSON.stringify(dbResult));
        throw new InternalCodeError(409, 'DB data conflict');
    }
}

async function fetchMatchDataFromRiot(matchId) {
    let fetchedData = await fetch(`https://asia.api.riotgames.com/lol/match/v5/matches/${matchId}?api_key=${api_key}`).then(res => res.json());

    if (fetchedData.status != undefined)
        throw new InternalCodeError(401, `Match id[${matchId}]: not found`);

    fetchedData = fetchedData.info;

    const gameCreation = fetchedData.gameCreation;
    const gameDuration = fetchedData.gameDuration;
    const gameEndTimestamp = fetchedData.gameEndTimestamp;
    const gameId = fetchedData.gameId;
    const gameMode = fetchedData.gameMode;
    const gameName = fetchedData.gameName;
    const gameStartTimestamp = fetchedData.gameStartTimestamp;
    const gameType = fetchedData.gameType;
    const gameVersion = fetchedData.gameVersion;
    const mapId = fetchedData.mapId;
    const platformId = fetchedData.platformId;
    const queueId = fetchedData.queueId;

    let searchMatch = await db_conn.queryToDB(`SELECT matchId FROM Matches WHERE matchId='${matchId}';`);

    if (searchMatch.length == 1) 
        throw new InternalCodeError(409, 'Data already exists');
    
    const sql = `INSERT INTO Matches(matchId, gameCreation, gameDuration, gameEndTimestamp, gameId, gameMode, gameName, gameStartTimestamp, gameType, gameVersion, mapId, platformId, queueId, tournamentCode) 
    VALUES('${matchId}', ${gameCreation}, ${gameDuration}, ${gameEndTimestamp}, ${gameId}, '${gameMode}', '${gameName}', ${gameStartTimestamp}, '${gameType}', '${gameVersion}', ${mapId}, '${platformId}', ${queueId}, '${tournamentCode}');`;
    
    return db_conn.queryToDB(sql);
}

async function getMatchIds(puuid, count) {
    let dbResult = await db_conn.queryToDB(`SELECT matchId FROM Play WHERE puuid=${db_conn.connection.escape(puuid)} ORDER BY gameEndTimestamp DESC LIMIT ${count};`);

    console.log(rows.length + ' records selected');

    if (dbResult.length == 0)
        throw new InternalCodeError(404, 'Matches not found');

    return dbResult;
}

// fetch match ids from riot api server
async function fetchMatchIdsFromRiot(puuid, count) {
    let fetchedData = await fetch(`https://asia.api.riotgames.com/lol/match/v5/matches/by-puuid/${puuid}/ids?count=${count}&api_key=${api_key}`)
        .then(res => res.json());
    
    if (fetchedData.status != undefined) {
        console.error(JSON.stringify(data));
        throw new InternalCodeError(403, data.status.message);
    }

    const promises = fetchedData.map((matchId) => {
        return fetchOnlyARAM(matchId, puuid);
    });

    const dbResult = await Promise.all(promises);

    console.log(dbResult);
}

async function fetchOnlyARAM(matchId, puuid) {
    let fetchedData = await fetch(`https://asia.api.riotgames.com/lol/match/v5/matches/${matchId}?api_key=${api_key}`)
        .then(res => res.json());

    if (fetchedData.status != undefined) 
        throw new InternalCodeError(403, fetchedData.status.message);

    const gameEndTimestamp = fetchedData.info.gameEndTimestamp;
                
    // only ARAM
    if (fetchedData.info.gameMode != "ARAM") 
        return {gameMode: fetchedData.info.gameMode};

    await db_conn.queryToDB(`REPLACE INTO Play (puuid, matchId, gameEndTimestamp) VALUES('${puuid}', '${matchId}', ${gameEndTimestamp});`)

    console.log('1 record replaced');

    return {gameMode: fetchedData.info.gameMode};
}

module.exports = {fetchMatchIdsFromRiot, getMatchIds, fetchMatchDataFromRiot, getMatchData};
