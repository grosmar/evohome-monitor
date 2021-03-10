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



const app = express()
const port = process.env.PORT || 5000;

app.use(express.static('public'));

var start = new Date();
start.setHours(0,0,0,0);

db.Thermostat.findOne({
  order: [['createdAt', 'DESC']], 
  limit: 1,
  createdAt: {
    [Op.lt]: new Date(),
    [Op.gt]: start
  }
})
.then(data => {
  if ( data == null )
  {
    console.log("create new day");
    createCurrentDay();
  }
  else
  {
    currentDayData = JSON.parse(data.data);
    currentDayId = data.id;
    console.log("found last day", currentDayId);
  }  
});

function createCurrentDay()
{
  currentDayData = [];
  currentDay = new Date();
  db.Thermostat.create({data:JSON.stringify(currentDayData)})
  .then((data) =>
  {
    currentDayId = data.id;
    console.log(currentDayId);
  })
  .catch((e) =>
  {
    console.log(e);
  });
}

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
  });
})

app.listen(port, () => {
  console.log(`Example app listening at http://localhost:${port}`)
})



function requestData() 
{
  var now = new Date();
  if (now.getDate() != currentDay.getDate())
  {
    createCurrentDay();
  }

  return evohomeClient.getLocationsWithAutoLogin(2147483).then(locations => {
    //console.log(locations);
    console.log(locations[0].devices[1].name, locations[0].devices[1].thermostat.indoorTemperature);
    console.log(locations[0].devices[2].name, locations[0].devices[2].thermostat.indoorTemperature);
    console.log(locations[0].devices[3].name, locations[0].devices[3].thermostat.indoorTemperature);

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

    currentDayData.push(result);

    return db.Thermostat.update({data:JSON.stringify(currentDayData)}, {where: {id: currentDayId}})
  });
}

function login()
{
    evohomeClient = new EvohomeClient(username, password)
    if (interval) 
    {
      clearInterval(interval);
    }
    interval = setInterval(requestData, 10 * 60 * 1000);
    return requestData();
}

