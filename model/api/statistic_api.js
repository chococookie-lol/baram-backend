const db_conn = require('../db/db');
const InternalCodeError = require('../internal_code_error');

const statistic_field_names = [
  'puuid',
  'totalGameCount',
  'totalGameWinCount',
  'totalBlueTeamCount',
  'totalBlueTeamWinCount',
  'mostShortPlayTime',
  'mostLongPlayTime',
  'maxDamageToChampions',
  'minDamageToChampions',
  'maxPlayChampionId1',
  'maxPlayChampionId2',
  'maxPlayChampionId3',
  'maxPlayChampionCount1',
  'maxPlayChampionCount2',
  'maxPlayChampionCount3',
];

async function updateUserStatistic(puuid) {
  const promises = [];
  const field_data = {};

  for (field_name of statistic_field_names) {
    field_data[field_name] = undefined;
  }

  field_data.puuid = puuid;

  promises.push(
    getTotalGameCount(puuid).then(result => {
      field_data.totalGameCount = result;
    }),
  );

  promises.push(
    getTotalGameWinCount(puuid).then(result => {
      field_data.totalGameWinCount = result;
    }),
  );

  promises.push(
    getBlueTeamCount(puuid).then(result => {
      field_data.totalBlueTeamCount = result;
    }),
  );

  promises.push(
    getBlueTeamWinCount(puuid).then(result => {
      field_data.totalBlueTeamWinCount = result;
    }),
  );

  promises.push(
    getMostShortPlayTime(puuid).then(result => {
      field_data.mostShortPlayTime = result;
    }),
  );

  promises.push(
    getMostLongPlayTime(puuid).then(result => {
      field_data.mostLongPlayTime = result;
    }),
  );

  promises.push(
    getMaxDamage(puuid).then(result => {
      field_data.maxDamageToChampions = result;
    }),
  );

  promises.push(
    getMinDamage(puuid).then(result => {
      field_data.minDamageToChampions = result;
    }),
  );

  promises.push(
    getMostPlayChampion3(puuid).then(result => {
      field_data.maxPlayChampionId1 = result[0][0];
      field_data.maxPlayChampionId2 = result[1][0];
      field_data.maxPlayChampionId3 = result[2][0];

      field_data.maxPlayChampionCount1 = result[0][1];
      field_data.maxPlayChampionCount2 = result[1][1];
      field_data.maxPlayChampionCount3 = result[2][1];
    }),
  );

  await Promise.all(promises);
  console.log(field_data);

  await db_conn.queryToDB(
    `REPLACE INTO Statistic (` +
      statistic_field_names
        .map(k => {
          return k;
        })
        .join() +
      `) VALUES(` +
      statistic_field_names
        .map(k => {
          return `${db_conn.connection.escape(field_data[k])}`;
        })
        .join() +
      `);`,
  );
}

async function getTotalGameCount(puuid) {
  const sql = `select count(*) as gameCount from Summoner natural join Play natural join Participant inner join Team 
	on Participant.matchId = Team.matchId and Participant.teamId = Team.teamId 
	where puuid=${db_conn.connection.escape(puuid)};`;

  const dbResult = await db_conn.queryToDB(sql);
  if (dbResult.length === 0) {
    throw new InternalCodeError(404, 'Total game count not fount');
  }

  return dbResult[0]['gameCount'];
}

async function getTotalGameWinCount(puuid) {
  const sql = `select count(*) as gameCount from Summoner natural join Play natural join Participant inner join Team 
	on Participant.matchId = Team.matchId and Participant.teamId = Team.teamId 
	where puuid=${db_conn.connection.escape(puuid)} and Team.win = 1;`;

  const dbResult = await db_conn.queryToDB(sql);
  if (dbResult.length === 0) {
    throw new InternalCodeError(404, 'Total game count not fount');
  }

  return dbResult[0]['gameCount'];
}

async function getBlueTeamCount(puuid) {
  const sql = `select count(*) as blueTeamCount from Summoner natural join Play natural join Participant inner join Team 
	on Participant.matchId = Team.matchId and Participant.teamId = Team.teamId 
	where puuid=${db_conn.connection.escape(puuid)} and Team.teamId = 100;`;

  const dbResult = await db_conn.queryToDB(sql);
  if (dbResult.length === 0) {
    throw new InternalCodeError(404, 'Total blue team count not fount');
  }

  return dbResult[0]['blueTeamCount'];
}

async function getBlueTeamWinCount(puuid) {
  const sql = `select count(*) as blueTeamWinCount from Summoner natural join Play natural join Participant inner join Team 
	on Participant.matchId = Team.matchId and Participant.teamId = Team.teamId 
	where puuid=${db_conn.connection.escape(puuid)} and Team.teamId = 100 and Team.win = 1;`;

  const dbResult = await db_conn.queryToDB(sql);
  if (dbResult.length === 0) {
    throw new InternalCodeError(404, 'Total blue team win count not fount');
  }

  return dbResult[0]['blueTeamWinCount'];
}

async function getMostShortPlayTime(puuid) {
  const sql = `select min(Matches.gameDuration) as shortPlayTime from Summoner natural join Play natural join Matches
	where puuid=${db_conn.connection.escape(puuid)};`;

  const dbResult = await db_conn.queryToDB(sql);
  if (dbResult.length === 0) {
    throw new InternalCodeError(404, 'Total short play time not fount');
  }

  return dbResult[0]['shortPlayTime'];
}

async function getMostLongPlayTime(puuid) {
  const sql = `select max(Matches.gameDuration) as longPlayTime from Summoner natural join Play natural join Matches
	where puuid=${db_conn.connection.escape(puuid)};`;

  const dbResult = await db_conn.queryToDB(sql);
  if (dbResult.length === 0) {
    throw new InternalCodeError(404, 'Total long play time not fount');
  }

  return dbResult[0]['longPlayTime'];
}

async function getMaxDamage(puuid) {
  const sql = `select max(Participant.totalDamageDealtToChampions) as maxDamage from Summoner natural join Play natural join Participant
	where puuid=${db_conn.connection.escape(puuid)};`;

  const dbResult = await db_conn.queryToDB(sql);
  if (dbResult.length === 0) {
    throw new InternalCodeError(404, 'Max damage not fount');
  }

  return dbResult[0]['maxDamage'];
}

async function getMinDamage(puuid) {
  const sql = `select min(Participant.totalDamageDealtToChampions) as minDamage from Summoner natural join Play natural join Participant
	where puuid=${db_conn.connection.escape(puuid)};`;

  const dbResult = await db_conn.queryToDB(sql);
  if (dbResult.length === 0) {
    throw new InternalCodeError(404, 'Min damage not fount');
  }

  return dbResult[0]['minDamage'];
}

async function getMostPlayChampion3(puuid) {
  const sql = `select Participant.championId as championId, count(Participant.championId) as championCount from Summoner natural join Play natural join Participant 
	where puuid=${db_conn.connection.escape(puuid)} group by Participant.championId order by championCount DESC LIMIT 3;`;

  const dbResult = await db_conn.queryToDB(sql);
  if (dbResult.length === 0) {
    throw new InternalCodeError(404, 'Most play not fount');
  }

  const ret = [];

  for (row of dbResult) {
    ret.push([row['championId'], row['championCount']]);
  }

  return ret;
}

module.exports = { updateUserStatistic };
