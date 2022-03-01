require('dotenv').config();

var express = require('express');
var path = require('path');

var indexRouter = require('./routes/index');
var summonerRouter = require('./routes/summoner');
var matchesRouter = require('./routes/match');
var errorRouter = require('./routes/error');
var cors = require('cors');

// test
var db_testRouter = require('./routes/db_test');

var app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.use('/', indexRouter);
app.use('/summoners', summonerRouter);
app.use('/matches', matchesRouter);

// test
app.use('/db_test', db_testRouter);

app.use('*', errorRouter);

app.use(cors('http://baram.ga'));

app.listen(3001, () => console.log("server online"));