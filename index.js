const EvohomeClient = require('@svrooij/evohome/lib').EvohomeClient
const express = require('express')
var evohomeClient = null;

var username = ''
var password = ''

const app = express()
const port = 8080;

app.get('/', (req, res) => {
  res.send('Hello World!')
})

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
  return evohomeClient.getLocationsWithAutoLogin(5).then(locations => {
    //console.log(locations)
    console.log(locations[0].devices[1].name, locations[0].devices[1].thermostat.indoorTemperature);
    console.log(locations[0].devices[2].name, locations[0].devices[2].thermostat.indoorTemperature);
    console.log(locations[0].devices[3].name, locations[0].devices[3].thermostat.indoorTemperature);
    return {cellar: locations[0].devices[1].thermostat.indoorTemperature,
            ground: locations[0].devices[2].thermostat.indoorTemperature,
            first: locations[0].devices[3].thermostat.indoorTemperature};
  }).catch(err => {
    console.log('Error occured %j', err)
  })
}

function login()
{
    evohomeClient = new EvohomeClient(username, password)
    setInterval(requestData, 10 * 60 * 1000);
    return requestData();
}

