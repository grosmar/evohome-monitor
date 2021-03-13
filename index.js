const winston = require('winston');
const DailyRotateFile = require('winston-daily-rotate-file');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp({
      format: "YYYY-MM-DD hh:mm:ss"
    }),
    winston.format.printf((info) => {
      return `${info.timestamp} ${info.level} ${info.message}`;
    })),
  defaultMeta: { service: 'user-service' },
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
          winston.format.timestamp({
            format: "YYYY-MM-DD hh:mm:ss"
          }),
          winston.format.printf((info) => {
            return `${info.timestamp} ${info.level} ${info.message}`;
          })),
      log: function(info, callback) {
        setImmediate(() => this.emit('logged', info));

        if (this.stderrLevels[info["error"]]) {
          console.error(info.message);
      
          if (callback) {
            callback();
          }
          return;
        }
      
        console.log(info.timestamp, info.message);
      
        if (callback) {
          callback();
        }
      }
    }),
    new DailyRotateFile({
      filename: 'public/logs/error-%DATE%.log',
      level: 'error',
      datePattern: 'YYYY-MM-DD',
      zippedArchive: true,
      maxSize: '20m',
      maxFiles: '14d',
      timestamp: true,
      format: winston.format.combine(
        winston.format.timestamp({
          format: "DD-MM-YYYY hh:mm:ss"
        }),
        winston.format.printf((info) => {
          return `${info.timestamp} ${info.level} ${info.message}`;
        })),
    }),
    new DailyRotateFile({
      filename: 'public/logs/debug-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      zippedArchive: true,
      maxSize: '20m',
      maxFiles: '14d',
      timestamp: true,
      format: winston.format.combine(
        winston.format.timestamp({
          format: "YYYY-MM-DD hh:mm:ss"
        }),
        winston.format.printf((info) => {
          return `${info.timestamp} ${info.level} ` + JSON.stringify(info.message);
        }))
    })
  ],
});

logger.info("starting");

process.on('uncaughtException', (err, origin) => {
  logger.error(
    process.stderr.fd,
    `Caught exception: ${err}\n` +
    `Exception origin: ${origin}`
  );
});


const EvohomeClient = require('@svrooij/evohome/lib').EvohomeClient;
const express = require('express');
const db = require('./models/index.js');
const { Op } = require("sequelize");
const wakeDyno = require("woke-dyno");
const got = require('got');


var evohomeClient = null;
var interval = null;

var username = '';
var password = '';
var city = '';
var weatherApiKey = '';

var currentDay = new Date();
var currentDayData = [];
var currentDayId = null;

const fs = require('fs');

async function getCurrentDay()
{
  if (currentDayId == null )
  {
    var start = new Date();
    start.setHours(0,0,0,0);

    let data;
    try
    {
      data = await db.Thermostat.findOne({
        order: [['createdAt', 'DESC']], 
        limit: 1,
        where: {
          createdAt: {
            [Op.lt]: new Date(),
            [Op.gt]: start
          }
        }
      });
    }
    catch(e)
    {
      logger.error("failed to get sql data", e);
    }

    if ( data == null )
    {
      logger.info("create new day");
      return await createCurrentDay();
    }
    else
    {
      currentDayData = JSON.parse(data.data);
      currentDayId = data.id;
      logger.info("found last day", currentDayId);
      
      return currentDayId;
    }  
  }
  else 
  {
    if (new Date().getDate() != currentDay.getDate())
    {
      return await createCurrentDay();
    }
    else
    {
      return currentDayId;
    }
  }
}

async function createCurrentDay()
{
  currentDayData = [];
  currentDay = new Date();

  try
  {
    let data = await db.Thermostat.create({data:JSON.stringify(currentDayData)})
    currentDayId = data.id;
    logger.info(currentDayId);
    return currentDayId;
  }
  catch (e)
  {
    logger.error("failed to create current day", e);
    return null;
  }
}

async function requestData() 
{
  logger.info("requestData");
  console.log("requestData");
  let weather = await getWeather();
  
  let currentDayId = await getCurrentDay();
  var locations = null;
  
  try {
    locations = await evohomeClient.getLocationsWithAutoLogin(600);
  }
  catch (e)
  {
    try 
    {
      evohomeClient = new EvohomeClient(username, password);
      locations = await evohomeClient.getLocationsWithAutoLogin(600);
    }
    catch (e)
    {
      logger.error("failed to get evohome", e);
      return;
    }
  }

  var result = {timestamp: new Date().getTime(), values:[], weather: weather};

  for (var i = 0; i < locations[0].devices.length; i++)
  {
    var device = locations[0].devices[i];
    var deviceName = device.name.split(" ")[0];
    if (deviceName && deviceName.length > 0)
    {
      var row = {name: deviceName, temp: device.thermostat.indoorTemperature, target: device.thermostat.changeableValues.heatSetpoint.value};
      result.values.push(row);
    }
  }

  logger.info(result);
  currentDayData.push(result);

  try 
  {
    var saved = await db.Thermostat.update({data:JSON.stringify(currentDayData)}, {where: {id: currentDayId}})
  }
  catch (e)
  {
    logger.error("failed to save data", e);
  }

  return result;
}

async function getWeather() {
  try {
    console.log("getWeather");
		const response = await got('https://api.weatherapi.com/v1/current.json?key=' + weatherApiKey +'&q=' + city + '&aqi=no', {responseType: 'json', resolveBodyOnly: true});
    return response.current.temp_c;
	} catch (error) {
		logger.error(error.response.body);
	}

  return NaN;

}


async function iterate()
{
  try
  {
    var result = await requestData()
  }
  catch (e)
  {
    logger.error("request error");
    logger.error(e);
  }
}

async function login()
{
    evohomeClient = new EvohomeClient(username, password)
    if (interval) 
    {
      clearInterval(interval);
    }
    interval = setInterval(iterate, 10 * 60 * 1000);
    //interval = setInterval(iterate, 10 * 1000);

    return requestData();
}

const app = express()
const port = process.env.PORT || 5000;

app.use(express.static('public'));

app.get('/data', (req, res) => {
  db.Thermostat.findAll({order: [['createdAt', 'DESC']], limit: req.query.limit || 5})
  .then(data => {
    res.send(JSON.stringify(data));
  });
});

app.get('/login', (req, res) => {
  username = req.query.username;
  password = req.query.password;
  city = req.query.city;
  weatherApiKey = req.query.weatherapikey;

  login()
  .then(function(result)
  {
    res.send(JSON.stringify(result));
  })
  .catch(function(e)
  {
    res.send(JSON.stringify(e));
    logger.error(e);
  });
})

app.listen(port, () => {
  logger.info(`Example app listening at http://localhost:${port}`);
  wakeDyno("http://evohome-monitor.herokuapp.com/").start();
})