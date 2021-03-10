const EvohomeClient = require('@svrooij/evohome/lib').EvohomeClient
const username = ''
const password = ''
const evohomeClient = new EvohomeClient(username, password)

function requestData() 
{
  evohomeClient.getLocationsWithAutoLogin(5).then(locations => {
    //console.log(locations)
    console.log(locations[0].devices[1].name, locations[0].devices[1].thermostat.indoorTemperature);
    console.log(locations[0].devices[2].name, locations[0].devices[2].thermostat.indoorTemperature);
    console.log(locations[0].devices[3].name, locations[0].devices[3].thermostat.indoorTemperature);
  }).catch(err => {
    console.log('Error occured %j', err)
  })
}

setInterval(requestData, 10 * 60 * 1000);
requestData();