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

process.title = 'peertube'

// Create our main app
const app = express()

// ----------- Database -----------
const constants = require('./server/initializers/constants')
const logger = require('./server/helpers/logger')
// Initialize database and models
const db = require('./server/initializers/database')
db.init(onDatabaseInitDone)

// ----------- Checker -----------
const checker = require('./server/initializers/checker')

const missed = checker.checkMissedConfig()
if (missed.length !== 0) {
  throw new Error('Miss some configurations keys : ' + missed)
}

const errorMessage = checker.checkConfig()
if (errorMessage !== null) {
  throw new Error(errorMessage)
}

// ----------- PeerTube modules -----------
const customValidators = require('./server/helpers/custom-validators')
const friends = require('./server/lib/friends')
const installer = require('./server/initializers/installer')
const migrator = require('./server/initializers/migrator')
const jobScheduler = require('./server/lib/jobs/job-scheduler')
const routes = require('./server/controllers')

// ----------- Command line -----------

// ----------- App -----------

// For the logger
app.use(morgan('combined', { stream: logger.stream }))
// For body requests
app.use(bodyParser.json({ limit: '500kb' }))
app.use(bodyParser.urlencoded({ extended: false }))
// Validate some params for the API
app.use(expressValidator({
  customValidators: Object.assign(
    {},
    customValidators.misc,
    customValidators.pods,
    customValidators.users,
    customValidators.videos,
    customValidators.remote.videos
  )
}))

// ----------- Views, routes and static files -----------

// API
const apiRoute = '/api/' + constants.API_VERSION
app.use(apiRoute, routes.api)

// Client files
app.use('/', routes.client)

// Static files
app.use('/', routes.static)

// Always serve index client page (the client is a single page application, let it handle routing)
app.use('/*', function (req, res, next) {
  res.sendFile(path.join(__dirname, './client/dist/index.html'))
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

// ----------- Run -----------

function onDatabaseInitDone () {
  const port = constants.CONFIG.LISTEN.PORT
    // Run the migration scripts if needed
  migrator.migrate(function (err) {
    if (err) throw err

    installer.installApplication(function (err) {
      if (err) throw err

      // ----------- Make the server listening -----------
      server.listen(port, function () {
        // Activate the communication with friends
        friends.activate()

        // Activate job scheduler
        jobScheduler.activate()

        logger.info('Server listening on port %d', port)
        logger.info('Webserver: %s', constants.CONFIG.WEBSERVER.URL)

        app.emit('ready')
      })
    })
  })
}

module.exports = app
