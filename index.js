const EvohomeClient = require('@svrooij/evohome/lib').EvohomeClient
const express = require('express')
var evohomeClient = null;
var interval = null;

var username = '';
var password = '';

const fs = require('fs');

try {
  let rawdata = fs.readFileSync('public/data.json');
  var data = JSON.parse(rawdata);
}
catch (e)
{
  var data = [];
}




const app = express()
const port = process.env.PORT || 5000;

app.use(express.static('public'));

app.get('/login', (req, res) => {
  

  username = req.query.username;
  password = req.query.password;

  login()
  .then(function(result)
  {
    res.send(JSON.stringify(result));
  });
})

app.listen(port, () => {
  console.log(`Example app listening at http://localhost:${port}`)
})



function requestData() 
{
  return evohomeClient.getLocationsWithAutoLogin(2147483647).then(locations => {
    //console.log(locations)
    console.log(locations[0].devices[1].name, locations[0].devices[1].thermostat.indoorTemperature);
    console.log(locations[0].devices[2].name, locations[0].devices[2].thermostat.indoorTemperature);
    console.log(locations[0].devices[3].name, locations[0].devices[3].thermostat.indoorTemperature);
    var result = {cellar: locations[0].devices[1].thermostat.indoorTemperature,
            ground: locations[0].devices[2].thermostat.indoorTemperature,
            first: locations[0].devices[3].thermostat.indoorTemperature,
            timestamp: Date.now()};

    data.push(result);
    fs.writeFileSync('public/data.json', JSON.stringify(data));

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
    interval = setInterval(requestData, 1 * 60 * 1000);
    return requestData();
}

