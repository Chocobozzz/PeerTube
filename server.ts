import { isTestInstance } from './server/helpers/core-utils'

if (isTestInstance()) {
  require('source-map-support').install()
}

// ----------- Node modules -----------
import * as bodyParser from 'body-parser'
import * as express from 'express'
// FIXME: cannot import express-validator
const expressValidator = require('express-validator')
import * as http from 'http'
import * as morgan from 'morgan'
import * as path from 'path'
import * as bittorrentTracker from 'bittorrent-tracker'
import * as cors from 'cors'
import { Server as WebSocketServer } from 'ws'

const TrackerServer = bittorrentTracker.Server

process.title = 'peertube'

// Create our main app
const app = express()

// ----------- Database -----------
// Do not use barels because we don't want to load all modules here (we need to initialize database first)
import { logger } from './server/helpers/logger'
import { API_VERSION, CONFIG } from './server/initializers/constants'
// Initialize database and models
import { database as db } from './server/initializers/database'
db.init(false, onDatabaseInitDone)

// ----------- Checker -----------
import { checkMissedConfig, checkFFmpeg, checkConfig } from './server/initializers/checker'

const missed = checkMissedConfig()
if (missed.length !== 0) {
  throw new Error('Miss some configurations keys : ' + missed)
}
checkFFmpeg(function (err) {
  if (err) {
    throw err
  }
})

const errorMessage = checkConfig()
if (errorMessage !== null) {
  throw new Error(errorMessage)
}

// ----------- PeerTube modules -----------
import { migrate, installApplication } from './server/initializers'
import { JobScheduler, activateSchedulers } from './server/lib'
import * as customValidators from './server/helpers/custom-validators'
import { apiRouter, clientsRouter, staticRouter } from './server/controllers'

// ----------- Command line -----------

// ----------- App -----------

// Enable cors for develop
if (isTestInstance()) {
  app.use(cors({
    origin: 'http://localhost:3000',
    credentials: true
  }))
}

// For the logger
app.use(morgan('combined', {
  stream: { write: logger.info }
}))
// For body requests
app.use(bodyParser.json({ limit: '500kb' }))
app.use(bodyParser.urlencoded({ extended: false }))
// Validate some params for the API
app.use(expressValidator({
  customValidators: customValidators
}))

// ----------- Views, routes and static files -----------

// API
const apiRoute = '/api/' + API_VERSION
app.use(apiRoute, apiRouter)

// Client files
app.use('/', clientsRouter)

// Static files
app.use('/', staticRouter)

// Always serve index client page (the client is a single page application, let it handle routing)
app.use('/*', function (req, res, next) {
  res.sendFile(path.join(__dirname, '../client/dist/index.html'))
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
const wss = new WebSocketServer({ server: server, path: '/tracker/socket' })
wss.on('connection', function (ws) {
  trackerServer.onWebSocketConnection(ws)
})

// ----------- Errors -----------

// Catch 404 and forward to error handler
app.use(function (req, res, next) {
  const err = new Error('Not Found')
  err['status'] = 404
  next(err)
})

app.use(function (err, req, res, next) {
  logger.error(err)
  res.sendStatus(err.status || 500)
})

// ----------- Run -----------

function onDatabaseInitDone () {
  const port = CONFIG.LISTEN.PORT
    // Run the migration scripts if needed
  migrate(function (err) {
    if (err) throw err

    installApplication(function (err) {
      if (err) throw err

      // ----------- Make the server listening -----------
      server.listen(port, function () {
        // Activate the communication with friends
        activateSchedulers()

        // Activate job scheduler
        JobScheduler.Instance.activate()

        logger.info('Server listening on port %d', port)
        logger.info('Webserver: %s', CONFIG.WEBSERVER.URL)
      })
    })
  })
}
