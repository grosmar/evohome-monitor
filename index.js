const winston = require('winston');
const DailyRotateFile = require('winston-daily-rotate-file');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp({
      format: "DD-MM-YYYY-hh-MM"
    }),
    winston.format.printf((info) => {
      return `${info.timestamp} ${info.level} ${info.message}`;
    })),
  defaultMeta: { service: 'user-service' },
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.timestamp({
          format: "DD-MM-YYYY hh:MM:ss"
        }),
        winston.format.printf((info) => {
          return `${info.timestamp} ${info.level} ${info.message}`;
        })),
      timestamp: true
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
          format: "DD-MM-YYYY hh:mm:ss"
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

var evohomeClient = null;
var interval = null;

var username = '';
var password = '';

var currentDay = new Date();
var currentDayData = [];
var currentDayId = null;

const fs = require('fs');

function getCurrentDay()
{
  return new Promise((resolve, reject) =>
  {
    if (currentDayId == null )
    {
      var start = new Date();
      start.setHours(0,0,0,0);

      db.Thermostat.findOne({
        order: [['createdAt', 'DESC']], 
        limit: 1,
        where: {
          createdAt: {
            [Op.lt]: new Date(),
            [Op.gt]: start
          }
        }
      })
      .then(data => {
        if ( data == null )
        {
          logger.info("create new day");
          createCurrentDay()
          .then((currentDayId) => 
          {
            resolve(currentDayId);
          })
          .catch((e) =>
          {
            reject(e);
          });
        }
        else
        {
          currentDayData = JSON.parse(data.data);
          currentDayId = data.id;
          logger.info("found last day", currentDayId);
          
          resolve(currentDayId);
        }  
      });
    }
    else 
    {
      if (new Date().getDate() != currentDay.getDate())
      {
        return createCurrentDay()
        .then((currentDayId) =>
        {
          resolve(currentDayId);
        })
        .catch((e) =>
        {
          reject(e);
        });
      }
      else
      {
        return resolve(currentDayId);
      }
    }
  });
}

function createCurrentDay()
{
  currentDayData = [];
  currentDay = new Date();
  db.Thermostat.create({data:JSON.stringify(currentDayData)})
  .then((data) =>
  {
    currentDayId = data.id;
    logger.info(currentDayId);
    return currentDayId;
  })
  .catch((e) =>
  {
    logger.info(e);
    return e;
  });
}

function requestData() 
{
  logger.info("requestData", currentDayId);
  return getCurrentDay()
  .then((currentDayId) =>
  {
    return evohomeClient.getLocationsWithAutoLogin(1)
    .then(locations => {
      var result = {timestamp: new Date().getTime(), values:[]};
  
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
  
      return db.Thermostat.update({data:JSON.stringify(currentDayData)}, {where: {id: currentDayId}})
    });
  })
}

function iterate()
{
  requestData()
  .then( () =>
  {
  })
  .catch( (e) =>
  {
    logger.error("request error");
    logger.error(e);
  });
}

function login()
{
    evohomeClient = new EvohomeClient(username, password)
    if (interval) 
    {
      clearInterval(interval);
    }
    interval = setInterval(iterate, 1 * 60 * 1000);
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
  logger.info(`Example app listening at http://localhost:${port}`)
})