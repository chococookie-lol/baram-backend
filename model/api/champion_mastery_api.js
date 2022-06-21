const api_key = require('./api_key');
const fetch = require('node-fetch');
const db_conn = require('../db/db');
const InternalCodeError = require('../internal_code_error');

function getChampionMastery(name) {
  return db_conn
    .queryToDB(`select M.* from Mastery as M left join Summoner as S on M.summonerId = S.id where S.name='${name}'`)
    .then(rows => {
      if (rows.length > 0) {
        return JSON.parse(JSON.stringify(rows));
      } else {
        throw new InternalCodeError(404, 'DB data not found');
      }
    })
    .catch(err => {
      console.error(new Date() + ' : ' + JSON.stringify(err));
      console.trace();
      if (err.code == undefined) throw new InternalCodeError(403, 'DB error');
      else throw err;
    });
}

function fetchChampionMastery(summonerId) {
  return fetch(`https://kr.api.riotgames.com/lol/champion-mastery/v4/champion-masteries/by-summoner/${summonerId}?api_key=${api_key}`)
    .then(res => res.json())
    .then(data => {
      if (data.status != undefined) throw new InternalCodeError(403, data.status.message);

      const top3 = data.slice(0, 3);
      const promises = [];

      for (let i = 0; i < top3.length; i++) {
        const championId = top3[i].championId;
        const championLevel = top3[i].championLevel;
        const championPoints = top3[i].championPoints;
        const lastPlayTime = top3[i].lastPlayTime;
        const championPointsSinceLastLevel = top3[i].championPointsSinceLastLevel;
        const championPointsUntilNextLevel = top3[i].championPointsUntilNextLevel;
        const chestGranted = top3[i].chestGranted;
        const tokensEarned = top3[i].tokensEarned;
        const summonerId = top3[i].summonerId;

        let sql = `REPLACE INTO Mastery (championId, championLevel, championPoints, lastPlayTime, championPointsSinceLastLevel, championPointsUntilNextLevel, chestGranted, tokensEarned, summonerId) 
        VALUES (${championId}, ${championLevel}, ${championPoints}, ${lastPlayTime}, ${championPointsSinceLastLevel}, ${championPointsUntilNextLevel}, ${chestGranted}, ${tokensEarned}, '${summonerId}');`;
        promises.push(db_conn.queryToDB(sql));
      }

      return Promise.all(promises);
    })
    .catch(err => {
      console.error(new Date() + ' : ' + JSON.stringify(err));
      console.trace();
      if (err.code == undefined) throw new InternalCodeError(403, 'DB error');
      else throw err;
    });
}

module.exports = { getChampionMastery, fetchChampionMastery };
