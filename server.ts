import { isTestInstance } from './server/helpers/core-utils'

if (isTestInstance()) {
  require('source-map-support').install()
}

// ----------- Node modules -----------
import * as bodyParser from 'body-parser'
import * as express from 'express'
import * as http from 'http'
import * as morgan from 'morgan'
import * as path from 'path'
import * as bitTorrentTracker from 'bittorrent-tracker'
import * as cors from 'cors'
import { Server as WebSocketServer } from 'ws'

const TrackerServer = bitTorrentTracker.Server

process.title = 'peertube'

// Create our main app
const app = express()

// ----------- Core checker -----------
import { checkMissedConfig, checkFFmpeg, checkConfig } from './server/initializers/checker'

const missed = checkMissedConfig()
if (missed.length !== 0) {
  throw new Error('Your configuration files miss keys: ' + missed)
}

import { API_VERSION, CONFIG, STATIC_PATHS } from './server/initializers/constants'
checkFFmpeg(CONFIG)

const errorMessage = checkConfig()
if (errorMessage !== null) {
  throw new Error(errorMessage)
}

// ----------- Database -----------
// Do not use barrels because we don't want to load all modules here (we need to initialize database first)
import { logger } from './server/helpers/logger'
// Initialize database and models
import { database as db } from './server/initializers/database'
db.init(false).then(() => onDatabaseInitDone())

// ----------- PeerTube modules -----------
import { migrate, installApplication } from './server/initializers'
import { JobScheduler, activateSchedulers, VideosPreviewCache } from './server/lib'
import { apiRouter, clientsRouter, staticRouter } from './server/controllers'

// ----------- Command line -----------

// ----------- App -----------

// Enable CORS for develop
if (isTestInstance()) {
  app.use((req, res, next) => {
    // These routes have already cors
    if (
      req.path.indexOf(STATIC_PATHS.TORRENTS) === -1 &&
      req.path.indexOf(STATIC_PATHS.WEBSEED) === -1
    ) {
      return (cors({
        origin: 'http://localhost:3000',
        credentials: true
      }))(req, res, next)
    }

    return next()
  })
}

// For the logger
app.use(morgan('combined', {
  stream: { write: logger.info }
}))
// For body requests
app.use(bodyParser.json({ limit: '500kb' }))
app.use(bodyParser.urlencoded({ extended: false }))

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
  migrate()
    .then(() => {
      return installApplication()
    })
    .then(() => {
      // ----------- Make the server listening -----------
      server.listen(port, function () {
        // Activate the communication with friends
        activateSchedulers()

        // Activate job scheduler
        JobScheduler.Instance.activate()

        VideosPreviewCache.Instance.init(CONFIG.CACHE.PREVIEWS.SIZE)

        logger.info('Server listening on port %d', port)
        logger.info('Web server: %s', CONFIG.WEBSERVER.URL)
      })
    })
}
