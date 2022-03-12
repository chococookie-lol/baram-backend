const api_key = require('./api_key');

const fetch = require("node-fetch");
const db_conn = require("../db/db");
const InternalCodeError = require('../internal_code_error');

const match_field_names = ['gameCreation', 'gameDuration',
    'gameEndTimestamp', 'gameId', 'gameMode', 'gameName', 'gameStartTimestamp',
    'gameType', 'gameVersion', 'mapId', 'platformId', 'queueId', 'tournamentCode'];

const participant_field_names = ['matchId', 'puuid', 'participantNumber', 'goldEarned',
    'totalMinionsKilled', 'kills', 'deaths', 'assists', 'kda', 'killParticipation', 'championId',
    'championName', 'champLevel', 'totalDamageDealtToChampions', 'summoner1Id', 'summoner2Id',
    'item0', 'item1', 'item2', 'item3', 'item4', 'item5', 'item6', 'summonerName', 'teamId'];

const team_field_names = ['matchId', 'teamId', 'win', 'totalKill', 'totalDeath', 'totalAssist', 'gameEndedInSurrender', 'gameEndedInEarlySurrender'];

async function getMatchData(matchId) {
    let dbResult = await db_conn.queryToDB(`SELECT * FROM Matches WHERE matchId=${db_conn.connection.escape(matchId)};`);

    if (dbResult.length == 0)
        throw new InternalCodeError(404, 'Match not found');
    else if (dbResult.length == 1) {
        let pdata = [];
        await db_conn.queryToDB(`SELECT * FROM Participant WHERE matchId=${db_conn.connection.escape(matchId)} ORDER BY participantNumber;`)
            .then((rows) => {
                if (rows.length === 0) {
                    throw new InternalCodeError(404, `Participant not found (matchId: ${matchId}, participantNumber: ${i}`);
                }
                for (let i = 0; i < 10; i++) {
                    delete rows[i].matchId;
                    delete rows[i].participantNumber;
                }
                pdata = rows;
                return;
            });

        const ret = dbResult[0];
        ret['participants'] = pdata;

        await db_conn.queryToDB(`SELECT * FROM Team WHERE matchId=${db_conn.connection.escape(matchId)} ORDER BY teamId;`)
            .then((rows) => {
                if (rows.length === 0 || rows.length === 1) {
                    throw new InternalCodeError(404, `Team not found (matchId: ${matchId})`);
                }
                ret['team'] = rows;
            })

        return ret;
    }
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
    if (!after && latest.length == 1) {
        //update
        let promises = [];
        for (let c = 0; c < max_matches; c += batch_size) {
            const startTime = Math.floor(latest[0].gameEndTimeStamp / 1000);
            let fetchedData = await fetch(`https://asia.api.riotgames.com/lol/match/v5/matches/by-puuid/${puuid}/ids?api_key=${api_key}&queue=450&start=${c}&count=${batch_size}&startTime=${startTime}`)
                .then(res => res.json());

            if (fetchedData.status != undefined) {
                console.error(JSON.stringify(fetchedData));
                throw new InternalCodeError(403, fetchedData.status.message);
            }

            fetchedData.map((matchId) => {
                // console.log('fetchMatchData(' + matchId + ');');
                promises.push(fetchMatchData(matchId, puuid));
            });

            if (fetchedData.length < 100)
                break;
        }
        await Promise.all(promises);
    } else {
        //load more or first load
        let fetchedData = await fetch(`https://asia.api.riotgames.com/lol/match/v5/matches/by-puuid/${puuid}/ids?count=${count}&api_key=${api_key}&queue=450${after ? `&endTime=${Math.floor(after / 1000)}` : ''}`)
            .then(res => res.json());

        if (fetchedData.status != undefined) {
            console.error(JSON.stringify(data));
            throw new InternalCodeError(403, fetchedData.status.message);
        }

        const promises = fetchedData.map((matchId) => {
            // console.log('fetchMatchData(' + matchId + ');');
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
                if (typeof mdata.info[k] == 'string') {
                    return `'${mdata.info[k]}'`
                } else {
                    return `${mdata.info[k]}`
                }
            }).join() +
            ');')
        );

        let team100KDA = [0, 0, 0];
        let team200KDA = [0, 0, 0];
        let team100Win = false;

        // 두 팀 모두 같은값인지 확인 안됨
        // 나중에 확인 후 수정
        let gameEndedInEarlySurrender = false;
        let gameEndedInSurrender = false;

        // add participants data to db
        for (let i = 0; i < 10; i++) {
            let pdata = mdata.info.participants[i];

            if (pdata.teamId == 100) {
                team100KDA[0] += pdata.kills;
                team100KDA[1] += pdata.deaths;
                team100KDA[2] += pdata.assists;
            } else {
                team200KDA[0] += pdata.kills;
                team200KDA[1] += pdata.deaths;
                team200KDA[2] += pdata.assists;
            }

            if (i == 0) {
                team100Win = pdata.win;

                // 수정예정
                gameEndedInSurrender = pdata.gameEndedInSurrender;
                gameEndedInEarlySurrender = pdata.gameEndedInEarlySurrender;
            }

            promises.push(db_conn.queryToDB(`REPLACE INTO Participant (` +
                participant_field_names.join()
                + `) VALUES (`
                + `'${matchId}',`
                + `'${pdata.puuid}',`
                + `${i},`
                + `${pdata.goldEarned},`
                + `${pdata.totalMinionsKilled},`
                + `${pdata.kills},`
                + `${pdata.deaths},`
                + `${pdata.assists},`
                + `${pdata.challenges.kda},`
                + `${pdata.challenges.killParticipation},`
                + `${pdata.championId},`
                + `'${pdata.championName}',`
                + `${pdata.champLevel},`
                + `${pdata.totalDamageDealtToChampions},`
                + `${pdata.summoner1Id},`
                + `${pdata.summoner2Id},`
                + `${pdata.item0},`
                + `${pdata.item1},`
                + `${pdata.item2},`
                + `${pdata.item3},`
                + `${pdata.item4},`
                + `${pdata.item5},`
                + `${pdata.item6},`
                + `'${pdata.summonerName}',`
                + `${pdata.teamId}`
                + `);`
            ))
        }

        promises.push(db_conn.queryToDB(`REPLACE INTO Team (` +
            team_field_names.join()
            + `) VALUES (`
            + `'${matchId}',`
            + `${100},`
            + `${team100Win},`
            + `${team100KDA[0]},`
            + `${team100KDA[1]},`
            + `${team100KDA[2]},`
            + `${gameEndedInSurrender},`
            + `${gameEndedInEarlySurrender}`
            + `);`
        ))

        promises.push(db_conn.queryToDB(`REPLACE INTO Team (` +
            team_field_names.join()
            + `) VALUES (`
            + `'${matchId}',`
            + `${200},`
            + `${!team100Win},`
            + `${team200KDA[0]},`
            + `${team200KDA[1]},`
            + `${team200KDA[2]},`
            + `${gameEndedInSurrender},`
            + `${gameEndedInEarlySurrender}`
            + `);`
        ))
    } else {
        gameEndTimestamp = mdata[0].gameEndTimestamp;
    }

    // let promises = fetchedData.metadata.participants.map(puuid => {
    //     db_conn.queryToDB(`REPLACE INTO Play (puuid, matchId, gameEndTimestamp) VALUES('${puuid}', '${matchId}', ${gameEndTimestamp});`);
    // })

    // 전에는 match의 모든 participant에 대한 play를 저장했으나, 이렇게 할 경우 각 플레이어별 match 리스트 관리가 어렵기 때문에 변경

    if (puuid !== undefined) {
        promises.push(db_conn.queryToDB(`REPLACE INTO Play (puuid, matchId, gameEndTimestamp) VALUES('${puuid}', '${matchId}', ${gameEndTimestamp});`))
    }

    await Promise.all(promises);
    return matchId;
}

module.exports = { fetchMatchIdsFromRiot, getMatchIds, getMatchData, fetchMatchData };
