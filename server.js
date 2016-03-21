'use strict'

// ----------- Node modules -----------
const bodyParser = require('body-parser')
const express = require('express')
const expressValidator = require('express-validator')
const http = require('http')
const morgan = require('morgan')
const path = require('path')
const TrackerServer = require('bittorrent-tracker').Server
const WebSocketServer = require('ws').Server

// Create our main app
const app = express()

// ----------- Checker -----------
const checker = require('./server/initializers/checker')

const miss = checker.checkConfig()
if (miss.length !== 0) {
  throw new Error('Miss some configurations keys : ' + miss)
}

// ----------- PeerTube modules -----------
const config = require('config')
const constants = require('./server/initializers/constants')
const customValidators = require('./server/helpers/customValidators')
const database = require('./server/initializers/database')
const installer = require('./server/initializers/installer')
const logger = require('./server/helpers/logger')
const poolRequests = require('./server/lib/poolRequests')
const routes = require('./server/controllers')
const utils = require('./server/helpers/utils')
const videos = require('./server/lib/videos')
const webtorrent = require('./server/lib/webtorrent')

// Get configurations
const port = config.get('listen.port')

// ----------- Database -----------
database.connect()

// ----------- Command line -----------

// ----------- App -----------

// For the logger
app.use(morgan('combined', { stream: logger.stream }))
// For body requests
app.use(bodyParser.json())
app.use(bodyParser.urlencoded({ extended: false }))
// Validate some params for the API
app.use(expressValidator({
  customValidators: customValidators
}))

// ----------- Views, routes and static files -----------

// Livereload
app.use(require('connect-livereload')({
  port: 35729
}))

// Catch sefaults
require('segfault-handler').registerHandler()

// API routes
const api_route = '/api/' + constants.API_VERSION
app.use(api_route, routes.api)

// Static files
app.use('/app', express.static(path.join(__dirname, '/client'), { maxAge: 0 }))
// 404 for static files not found
app.use('/app/*', function (req, res, next) {
  res.sendStatus(404)
})

// Client application
app.use('/*', function (req, res, next) {
  res.sendFile(path.join(__dirname, 'client/index.html'))
})

// ----------- Tracker -----------

const trackerServer = new TrackerServer({
  http: false,
  udp: false,
  ws: false,
  dht: false
})

trackerServer.on('error', function (err) {
  logger.error(err)
})

trackerServer.on('warning', function (err) {
  logger.error(err)
})

const server = http.createServer(app)
const wss = new WebSocketServer({server: server, path: '/tracker/socket'})
wss.on('connection', function (ws) {
  trackerServer.onWebSocketConnection(ws)
})

// ----------- Errors -----------

// Catch 404 and forward to error handler
app.use(function (req, res, next) {
  const err = new Error('Not Found')
  err.status = 404
  next(err)
})

app.use(function (err, req, res, next) {
  logger.error(err)
  res.sendStatus(err.status || 500)
})

installer.installApplication(function (err) {
  if (err) throw err

  // Create/activate the webtorrent module
  webtorrent.create(function () {
    function cleanForExit () {
      utils.cleanForExit(webtorrent.app)
    }

    function exitGracefullyOnSignal () {
      process.exit(-1)
    }

    process.on('exit', cleanForExit)
    process.on('SIGINT', exitGracefullyOnSignal)
    process.on('SIGTERM', exitGracefullyOnSignal)

    // ----------- Make the server listening -----------
    server.listen(port, function () {
      // Activate the pool requests
      poolRequests.activate()

      videos.seedAllExisting(function () {
        logger.info('Seeded all the videos')
        logger.info('Server listening on port %d', port)
        app.emit('ready')
      })
    })
  })
})

module.exports = app
