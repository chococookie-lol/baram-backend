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

async function getMatchIds(puuid, after, count) {
    let dbResult = await db_conn.queryToDB(`SELECT matchId FROM Play WHERE puuid=${db_conn.connection.escape(puuid)}${after ? `AND gameEndTimeStamp<${after}` : ''} ORDER BY gameEndTimestamp DESC LIMIT ${count};`);

    console.log(dbResult.length + ' records selected');

    if (dbResult.length == 0)
        throw new InternalCodeError(404, 'Matches not found');

    return dbResult;
}

//fetch match ids from riot api server
const max_matches = 500;
const batch_size = 100;
async function fetchMatchIdsFromRiot(puuid, after, count) {
    // only support matches after [June 16th, 2021]

    // 처음 로드할 경우 : {count}개만
    // 업데이트일 경우 : 최신~db상 가장 최근 match 까지
    let latest = await db_conn.queryToDB(`SELECT gameEndTimeStamp FROM Play WHERE puuid=${db_conn.connection.escape(puuid)} ORDER BY gameEndTimestamp DESC LIMIT 1;`);
    if(!after && latest.length == 1) {
        //update
        let promises = [];
        for(let c=0; c<max_matches; c+=batch_size){
            const startTime = Math.floor(latest[0].gameEndTimeStamp / 1000);
            let fetchedData = await fetch(`https://asia.api.riotgames.com/lol/match/v5/matches/by-puuid/${puuid}/ids?api_key=${api_key}&queue=450&start=${c}&count=${batch_size}&startTime=${startTime}`)
                .then(res => res.json());

            if (fetchedData.status != undefined) {
                console.error(JSON.stringify(fetchedData));
                throw new InternalCodeError(403, fetchedData.status.message);
            }

            fetchedData.map((matchId) => {
                promises.push(fetchMatchData(matchId, puuid));
            });

            if(fetchedData.length < 100)
                break;
        }
        Promise.all(promises);
    } else {
        //load more or first load
        let fetchedData = await fetch(`https://asia.api.riotgames.com/lol/match/v5/matches/by-puuid/${puuid}/ids?count=${count}&api_key=${api_key}&queue=450${after ? `&endTime=${Math.floor(after / 1000)}` : ''}`)
            .then(res => res.json());

        if (fetchedData.status != undefined) {
            console.error(JSON.stringify(data));
            throw new InternalCodeError(403, fetchedData.status.message);
        }

        const promises = fetchedData.map((matchId) => {
            return fetchMatchData(matchId, puuid);
        });

        const dbResult = await Promise.all(promises);
        console.log(dbResult);
    }
}

//checks if match exists in db, if not, fetch from riot
async function fetchMatchData(matchId, puuid) {
    let promises = [];

    //check
    let mdata = await db_conn.queryToDB(`SELECT * FROM Matches WHERE matchId=${db_conn.connection.escape(matchId)};`);
    let gameEndTimestamp;

    if (mdata.length == 0) {
        //fetch
        mdata = await fetch(`https://asia.api.riotgames.com/lol/match/v5/matches/${matchId}?api_key=${api_key}`)
            .then(res => res.json());
        //fetch error
        if (mdata.status)
            throw new InternalCodeError(403, mdata.status.message);

        gameEndTimestamp = mdata.info.gameEndTimestamp;

        //add match to db
        promises.push(db_conn.queryToDB(`REPLACE INTO Matches (matchId,` +
            match_field_names.map(k => {
                return k
            }).join()
            + `) VALUES('${matchId}',` +
            match_field_names.map(k => {
                return `'${mdata.info[k]}'`
            }).join() +
            ');')
        );
    } else {
        gameEndTimestamp = mdata[0].gameEndTimestamp;
    }

    // let promises = fetchedData.metadata.participants.map(puuid => {
    //     db_conn.queryToDB(`REPLACE INTO Play (puuid, matchId, gameEndTimestamp) VALUES('${puuid}', '${matchId}', ${gameEndTimestamp});`);
    // })

    // 전에는 match의 모든 participant에 대한 play를 저장했으나, 이렇게 할 경우 각 플레이어별 match 리스트 관리가 어렵기 때문에 변경

    promises.push(db_conn.queryToDB(`REPLACE INTO Play (puuid, matchId, gameEndTimestamp) VALUES('${puuid}', '${matchId}', ${gameEndTimestamp});`))

    await Promise.all(promises);
    return matchId;
}

module.exports = { fetchMatchIdsFromRiot, getMatchIds, getMatchData };
