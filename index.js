require('dotenv').config()

const urljoin = require('urljoin')
const huejay = require('huejay')
const request = require('request-promise-native')

const config = {
  hueKey: process.env.HUE_API_KEY,
  serverUrl: process.env.SERVER_URL,
  serverApiKey: process.env.SERVER_API_KEY
}

// TODO: I have to find out how to the the displayName for the sensor
const sensorMapping = {
  '00:17:88:01:02:02:0cGS:25-02-0402': 'bathroom',
  '00:17:88:01:03:28:a1:dd-02-0402': 'bedroom'
}

// Unfortunatelly, the temperature sensor inside the HUE motion sensor is not accurate,
// I had to figure the offset and in my case in's 2 degrees
const temperatureOffset = 2.0

const isTemperatureSensor = sensor => sensor.type === 'ZLLTemperature'
const toRequestModel = sensor => ({
  id: sensor.uniqueId,
  name: sensor.name,
  room: sensorMapping[sensor.uniqueId] || '<unknown>',
  temperature: sensor.state.temperature,
  adjustedTemperature: (sensor.state.temperature + temperatureOffset),
  lastUpdated: sensor.state.attributes.attributes.lastupdated,
  type: sensor.type
})

async function measureAndTrack () {
  const bridges = await huejay.discover()
  if (bridges.length === 0) throw new Error('No Hue bridges found.')

  const client = new huejay.Client({
    host: bridges[0].ip,
    username: config.hueKey
  })

  const sensors = await client.sensors.getAll()

  const sensorData = sensors
    .filter(isTemperatureSensor)
    .map(toRequestModel)

  await Promise.all(sensorData.map(data => request({
    uri: urljoin(config.serverUrl, 'api', 'update'),
    method: 'POST',
    body: data,
    json: true,
    headers: {
      authorization: `Bearer ${config.serverApiKey}`
    }
  })))
}

measureAndTrack()
  .then(() => {
    console.log('Tracked')
  })
  .catch(err => {
    console.error(err)
    process.exit(1)
  })
