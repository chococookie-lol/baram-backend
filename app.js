require('dotenv').config();

var express = require('express');
var path = require('path');

var indexRouter = require('./routes/index');
var summonerRouter = require('./routes/summoner');
var matchesRouter = require('./routes/match');
var errorRouter = require('./routes/error');
var cors = require('cors');

require('console-stamp')(console, '[yyyy-mm-dd HH:MM:ss]');

process.on('uncaughtException', function (e) {
    console.log(e.stack || e);
    process.exit(1);
});

var app = express();

app.use(cors({origin: 'http://baram.ga',credentials: true}));

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.use('/', indexRouter);
app.use('/summoners', summonerRouter);
app.use('/matches', matchesRouter);

app.use('*', errorRouter);


app.listen(3001, () => console.log("server online"));