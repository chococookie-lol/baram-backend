const api_key = require('./api_key');

const fetch = require("node-fetch");
const db_conn = require("../db/db");
const InternalCodeError = require('../internal_code_error');

const match_field_names = ['gameCreation', 'gameDuration',
    'gameEndTimestamp', 'gameId', 'gameMode', 'gameName', 'gameStartTimestamp',
    'gameType', 'gameVersion', 'mapId', 'platformId', 'queueId', 'tournamentCode'];

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

    console.log(dbResult.length + ' records selected');

    if (dbResult.length == 0)
        throw new InternalCodeError(404, 'Matches not found');

    return dbResult;
}

/* fetch match ids from riot api server
*  type:
*   'latest' : fetch latest {count} matches
*   'older'  : fetch older {count} matches (relative to db)
*/
async function fetchMatchIdsFromRiot(puuid, type, count) {
    let endTime;
    let startTime;
    if(type == 'older'){
        //get oldest Play's gameEndTimeStamp
        const oldest = await db_conn.queryToDB(`SELECT gameEndTimeStamp FROM Play WHERE puuid=${db_conn.connection.escape(puuid)} ORDER BY gameEndTimestamp ASC LIMIT 1;`);
        
        if(oldest.length == 1){
            //data exists
            endTime = Math.floor(oldest[0].gameEndTimeStamp/1000);
        }
    }else{
        //type == 'latest'
        //get latest Play's gameEndTimeStamp
        const latest = await db_conn.queryToDB(`SELECT gameEndTimeStamp FROM Play WHERE puuid=${db_conn.connection.escape(puuid)} ORDER BY gameEndTimestamp DESC LIMIT 1;`);
        
        if(latest.length == 1){
            //data exists
            startTime = Math.floor(latest[0].gameEndTimeStamp/1000);
        }
    }

    let fetchedData = await fetch(`https://asia.api.riotgames.com/lol/match/v5/matches/by-puuid/${puuid}/ids?count=${count}&api_key=${api_key}&queue=450${endTime ? '&endTime=' + endTime : ''}${startTime ? '&startTime=' + startTime : ''}`)
        .then(res => res.json());
    
    if (fetchedData.status != undefined) {
        console.error(JSON.stringify(data));
        throw new InternalCodeError(403, fetchedData.status.message);
    }

    const promises = fetchedData.map((matchId) => {
        return fetchMatchData(matchId);
    });

    const dbResult = await Promise.all(promises);
    console.log(dbResult);
}

//checks if match exists in db, if not, fetch from riot
async function fetchMatchData(matchId) {
    //check
    let exists = await db_conn.queryToDB(`SELECT EXISTS(SELECT * FROM Matches WHERE matchId=${db_conn.connection.escape(matchId)});`);
    if(Object.values(exists[0])[0] != 0){
        return Promise.resolve('exists');
    }
    
    //fetch
    let fetchedData = await fetch(`https://asia.api.riotgames.com/lol/match/v5/matches/${matchId}?api_key=${api_key}`)
        .then(res => res.json());
    
    //fetch error
    if (fetchedData.status)
        throw new InternalCodeError(403, fetchedData.status.message);

    //add plays to db
    const gameEndTimestamp = fetchedData.info.gameEndTimestamp;

    let promises = fetchedData.metadata.participants.map(puuid => {
        db_conn.queryToDB(`REPLACE INTO Play (puuid, matchId, gameEndTimestamp) VALUES('${puuid}', '${matchId}', ${gameEndTimestamp});`);
    })

    //add match to db
    promises.push(db_conn.queryToDB(`REPLACE INTO Matches (matchId,` +
        match_field_names.map(k => {
            return k
        }).join()
        +`) VALUES('${matchId}',` +
        match_field_names.map(k => {
            return `'${fetchedData.info[k]}'`
        }).join() +
        ');')
    );

    await Promise.all(promises);    
    return matchId;
}

module.exports = {fetchMatchIdsFromRiot, getMatchIds, fetchMatchDataFromRiot, getMatchData};
