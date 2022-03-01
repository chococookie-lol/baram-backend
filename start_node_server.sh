#!/bin/bash 

nohup node ./app.js >> ./logs/npm.log 2>> ./logs/error.log &
