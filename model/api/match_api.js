const api_key = require('./api_key');

const fetch = require('node-fetch');
const db_conn = require('../db/db');
const InternalCodeError = require('../internal_code_error');

const match_field_names = [
  'gameCreation',
  'gameDuration',
  'gameEndTimestamp',
  'gameId',
  'gameMode',
  'gameName',
  'gameStartTimestamp',
  'gameType',
  'gameVersion',
  'mapId',
  'platformId',
  'queueId',
  'tournamentCode',
];

const participant_field_names = [
  'matchId',
  'puuid',
  'participantNumber',
  'goldEarned',
  'totalMinionsKilled',
  'kills',
  'deaths',
  'assists',
  'kda',
  'killParticipation',
  'championId',
  'championName',
  'champLevel',
  'totalDamageDealtToChampions',
  'summoner1Id',
  'summoner2Id',
  'item0',
  'item1',
  'item2',
  'item3',
  'item4',
  'item5',
  'item6',
  'summonerName',
  'teamId',
];

const team_field_names = ['matchId', 'teamId', 'win', 'totalKill', 'totalDeath', 'totalAssist', 'gameEndedInSurrender', 'gameEndedInEarlySurrender'];

const perk_field_names = ['matchId', 'puuid', 'defense', 'flex', 'offense', 'primaryStyle', 'primary1', 'primary2', 'primary3', 'primary4', 'subStyle', 'sub1', 'sub2'];

async function getMatchData(matchId) {
  let dbResult = await db_conn.queryToDB(`SELECT * FROM Matches WHERE matchId=${db_conn.connection.escape(matchId)};`);

  if (dbResult.length == 0) throw new InternalCodeError(404, 'Match not found');
  else if (dbResult.length == 1) {
    let pdata = [];
    let participants = await db_conn.queryToDB(`SELECT * FROM Participant WHERE matchId=${db_conn.connection.escape(matchId)} ORDER BY participantNumber;`);

    if (participants.length === 0) {
      throw new InternalCodeError(404, `Participant not found (matchId: ${matchId})`);
    }

    for (let i = 0; i < 10; i++) {
      let perk = await db_conn.queryToDB(`SELECT * FROM Perk WHERE matchId=${db_conn.connection.escape(matchId)} AND puuid='${participants[i].puuid}';`);
      if (perk.length === 0) {
        throw new InternalCodeError(404, `Perk not found (matchId: ${matchId})`);
      }
      delete perk[0].matchId;
      delete perk[0].puuid;
      participants[i].perk = perk[0];

      delete participants[i].matchId;
      delete participants[i].participantNumber;
    }
    pdata = participants;

    const ret = dbResult[0];
    ret['participants'] = pdata;

    await db_conn.queryToDB(`SELECT * FROM Team WHERE matchId=${db_conn.connection.escape(matchId)} ORDER BY teamId;`).then(rows => {
      if (rows.length === 0 || rows.length === 1) {
        throw new InternalCodeError(404, `Team not found (matchId: ${matchId})`);
      }
      ret['teams'] = rows;
    });

    return ret;
  } else {
    console.error(JSON.stringify(dbResult));
    throw new InternalCodeError(409, 'DB data conflict');
  }
}

async function getMatchIds(puuid, after, count) {
  let dbResult = await db_conn.queryToDB(
    `SELECT matchId FROM Play WHERE puuid=${db_conn.connection.escape(puuid)}${after ? `AND gameEndTimeStamp<${after}` : ''} ORDER BY gameEndTimestamp DESC LIMIT ${count};`,
  );

  console.log(dbResult.length + ' records selected');

  if (dbResult.length == 0) throw new InternalCodeError(404, 'Matches not found');

  return dbResult;
}

//fetch match ids from riot api server
const max_matches = 500;
const batch_size = 100;
async function fetchMatchIdsFromRiot(puuid, after, count) {
  // only support matches after [June 16th, 2021]

  // ?????? ????????? ?????? : {count}??????
  // ??????????????? ?????? : ??????~db??? ?????? ?????? match ??????
  let latest = await db_conn.queryToDB(`SELECT gameEndTimeStamp FROM Play WHERE puuid=${db_conn.connection.escape(puuid)} ORDER BY gameEndTimestamp DESC LIMIT 1;`);
  if (!after && latest.length == 1) {
    //update
    let promises = [];
    for (let c = 0; c < max_matches; c += batch_size) {
      const startTime = Math.floor(latest[0].gameEndTimeStamp / 1000);
      let fetchedData = await fetch(
        `https://asia.api.riotgames.com/lol/match/v5/matches/by-puuid/${puuid}/ids?api_key=${api_key}&queue=450&start=${c}&count=${batch_size}&startTime=${startTime}`,
      ).then(res => res.json());

      if (fetchedData.status != undefined) {
        console.error(JSON.stringify(fetchedData));
        throw new InternalCodeError(403, fetchedData.status.message);
      }

      fetchedData.map(matchId => {
        // console.log('fetchMatchData(' + matchId + ');');
        promises.push(fetchMatchData(matchId, puuid));
      });

      if (fetchedData.length < 100) break;
    }
    await Promise.all(promises);
  } else {
    //load more or first load
    let fetchedData = await fetch(
      `https://asia.api.riotgames.com/lol/match/v5/matches/by-puuid/${puuid}/ids?count=${count}&api_key=${api_key}&queue=450${after ? `&endTime=${Math.floor(after / 1000)}` : ''}`,
    ).then(res => res.json());

    if (fetchedData.status != undefined) {
      throw new InternalCodeError(403, fetchedData.status.message);
    }

    const promises = fetchedData.map(matchId => {
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
    mdata = await fetch(`https://asia.api.riotgames.com/lol/match/v5/matches/${matchId}?api_key=${api_key}`).then(res => res.json());
    //fetch error
    if (mdata.status) throw new InternalCodeError(403, mdata.status.message);

    gameEndTimestamp = mdata.info.gameEndTimestamp;

    //add match to db
    promises.push(
      db_conn.queryToDB(
        `REPLACE INTO Matches (matchId,` +
          match_field_names
            .map(k => {
              return k;
            })
            .join() +
          `) VALUES('${matchId}',` +
          match_field_names
            .map(k => {
              if (typeof mdata.info[k] == 'string') {
                return `'${mdata.info[k]}'`;
              } else {
                return `${mdata.info[k]}`;
              }
            })
            .join() +
          ');',
      ),
    );

    let teamData = {
      100: {
        KDA: [0, 0, 0],
        win: false,
      },
      200: {
        KDA: [0, 0, 0],
        win: false,
      },
    };

    // ??? ??? ?????? ??????????????? ?????? ??????
    // ????????? ?????? ??? ??????
    let gameEndedInEarlySurrender = false;
    let gameEndedInSurrender = false;

    // calculate team data
    for (let i = 0; i < 10; i++) {
      let pdata = mdata.info.participants[i];

      teamData[pdata.teamId].KDA[0] += pdata.kills;
      teamData[pdata.teamId].KDA[1] += pdata.deaths;
      teamData[pdata.teamId].KDA[2] += pdata.assists;

      if (i == 0) {
        teamData[100].win = pdata.win;
        teamData[200].win = !pdata.win;

        // ????????????
        gameEndedInSurrender = pdata.gameEndedInSurrender;
        gameEndedInEarlySurrender = pdata.gameEndedInEarlySurrender;
      }
    }

    // add participants data to db
    for (let i = 0; i < 10; i++) {
      let pdata = mdata.info.participants[i];
      const killParticipation = (pdata.kills + pdata.assists) / teamData[pdata.teamId].KDA[0];
      const kda = (pdata.kills + pdata.assists) / pdata.deaths;

      promises.push(
        db_conn.queryToDB(
          `REPLACE INTO Participant (` +
            participant_field_names.join() +
            `) VALUES (` +
            `'${matchId}',` +
            `'${pdata.puuid}',` +
            `${i},` +
            `${pdata.goldEarned},` +
            `${pdata.totalMinionsKilled},` +
            `${pdata.kills},` +
            `${pdata.deaths},` +
            `${pdata.assists},` +
            `${kda},` +
            `${killParticipation},` +
            `${pdata.championId},` +
            `'${pdata.championName}',` +
            `${pdata.champLevel},` +
            `${pdata.totalDamageDealtToChampions},` +
            `${pdata.summoner1Id},` +
            `${pdata.summoner2Id},` +
            `${pdata.item0},` +
            `${pdata.item1},` +
            `${pdata.item2},` +
            `${pdata.item3},` +
            `${pdata.item4},` +
            `${pdata.item5},` +
            `${pdata.item6},` +
            `'${pdata.summonerName}',` +
            `${pdata.teamId}` +
            `);`,
        ),
      );

      // perks

      let perks = pdata.perks;
      let statPerks = perks.statPerks;
      let primaryPerks = perks.styles[0];
      let subPerks = perks.styles[1];

      promises.push(
        db_conn.queryToDB(
          `REPLACE INTO Perk (` +
            perk_field_names.join() +
            `) VALUES (` +
            `'${matchId}',` +
            `'${pdata.puuid}',` +
            `${statPerks.defense},` +
            `${statPerks.flex},` +
            `${statPerks.offense},` +
            `${primaryPerks.style},` +
            `${primaryPerks.selections[0].perk},` +
            `${primaryPerks.selections[1].perk},` +
            `${primaryPerks.selections[2].perk},` +
            `${primaryPerks.selections[3].perk},` +
            `${subPerks.style},` +
            `${subPerks.selections[0].perk},` +
            `${subPerks.selections[1].perk}` +
            `);`,
        ),
      );
    }

    for (key in teamData) {
      promises.push(
        db_conn.queryToDB(
          `REPLACE INTO Team (` +
            team_field_names.join() +
            `) VALUES (` +
            `'${matchId}',` +
            `${Number(key)},` +
            `${teamData[key].win},` +
            `${teamData[key].KDA[0]},` +
            `${teamData[key].KDA[1]},` +
            `${teamData[key].KDA[2]},` +
            `${gameEndedInSurrender},` +
            `${gameEndedInEarlySurrender}` +
            `);`,
        ),
      );
    }
  } else {
    gameEndTimestamp = mdata[0].gameEndTimestamp;
  }

  // let promises = fetchedData.metadata.participants.map(puuid => {
  //     db_conn.queryToDB(`REPLACE INTO Play (puuid, matchId, gameEndTimestamp) VALUES('${puuid}', '${matchId}', ${gameEndTimestamp});`);
  // })

  // ????????? match??? ?????? participant??? ?????? play??? ???????????????, ????????? ??? ?????? ??? ??????????????? match ????????? ????????? ????????? ????????? ??????

  if (puuid !== undefined) {
    promises.push(db_conn.queryToDB(`REPLACE INTO Play (puuid, matchId, gameEndTimestamp) VALUES('${puuid}', '${matchId}', ${gameEndTimestamp});`));
  }

  await Promise.all(promises);
  return matchId;
}

module.exports = { fetchMatchIdsFromRiot, getMatchIds, getMatchData, fetchMatchData };
