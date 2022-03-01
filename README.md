# BARAM API

## SUMMONER

### /summoner/{summoner-name}

* Summary

    Get summoner data from database

* Response

    status - Response Number

    data - SummonerDTO

* SummonerDTO

    accountId 

    profileIconId

    name

    id

    puuid

    summonerLevel

* Response Errors

    404 - Data not found

    500 - Internal server error

---

### /summoner/{summoner-name}/fetch

* Summary

    Fetch new data from Riot Server

* Response

    status - Response Number

    data - Database Information

* Response Errors

    500 - Internal server error


## MATCHES

### /matches/by-puuid/{puuid}/ids

* Summary

    Get match ids by puuid from database

* Response

    status - Response Number

    data - [{puuid, matchId, gameEndTimestamp}]

* Response Errors

    500 - Internal server error

---

### /matches/by-puuid/{puuid}/fetch

* Summary

    Fetch new data from Riot Server

* Response

    status - Response Number

    data - message

* Response Errors

    500 - Internal server error
