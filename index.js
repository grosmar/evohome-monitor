const EvohomeClient = require('@svrooij/evohome/lib').EvohomeClient;
const express = require('express');
const db = require('./models/index.js');

var evohomeClient = null;
var interval = null;

var username = '';
var password = '';

const fs = require('fs');



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
  });
})

app.listen(port, () => {
  console.log(`Example app listening at http://localhost:${port}`)
})



function requestData() 
{
  return evohomeClient.getLocationsWithAutoLogin(2147483).then(locations => {
    //console.log(locations);
    console.log(locations[0].devices[1].name, locations[0].devices[1].thermostat.indoorTemperature);
    console.log(locations[0].devices[2].name, locations[0].devices[2].thermostat.indoorTemperature);
    console.log(locations[0].devices[3].name, locations[0].devices[3].thermostat.indoorTemperature);

    var result = [];

    for (var i = 0; i < locations[0].devices.length; i++)
    {
      var device = locations[0].devices[i];
      var deviceName = device.name.split(" ")[0];
      if (deviceName && deviceName.length > 0)
      {
        var row = {name: deviceName, temp: device.thermostat.indoorTemperature, target: device.thermostat.changeableValues.heatSetpoint.value};
        result.push(row);
      }
    }

    db.Thermostat.create({data:JSON.stringify(result)})
    .then((data) => {
      console.log("saved", data);
    })
    .catch((e) => {
      console.log(e);
    });


    return result;
  }).catch(err => {
    console.log('Error occured %j', err)
  })
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

