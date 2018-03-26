// FIXME: https://github.com/nodejs/node/pull/16853
require('tls').DEFAULT_ECDH_CURVE = 'auto'

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

// Do not use barrels because we don't want to load all modules here (we need to initialize database first)
import { logger } from './server/helpers/logger'
import { ACCEPT_HEADERS, API_VERSION, CONFIG, STATIC_PATHS } from './server/initializers/constants'

const missed = checkMissedConfig()
if (missed.length !== 0) {
  logger.error('Your configuration files miss keys: ' + missed)
  process.exit(-1)
}

checkFFmpeg(CONFIG)
  .catch(err => {
    logger.error('Error in ffmpeg check.', { err })
    process.exit(-1)
  })

const errorMessage = checkConfig()
if (errorMessage !== null) {
  throw new Error(errorMessage)
}

// ----------- Database -----------

// Initialize database and models
import { initDatabaseModels } from './server/initializers/database'
import { migrate } from './server/initializers/migrator'
migrate()
  .then(() => initDatabaseModels(false))
  .then(() => onDatabaseInitDone())

// ----------- PeerTube modules -----------
import { installApplication } from './server/initializers'
import { Emailer } from './server/lib/emailer'
import { JobQueue } from './server/lib/job-queue'
import { VideosPreviewCache } from './server/lib/cache'
import { apiRouter, clientsRouter, staticRouter, servicesRouter, webfingerRouter, activityPubRouter } from './server/controllers'
import { Redis } from './server/lib/redis'
import { BadActorFollowScheduler } from './server/lib/schedulers/bad-actor-follow-scheduler'
import { RemoveOldJobsScheduler } from './server/lib/schedulers/remove-old-jobs-scheduler'

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
  stream: { write: logger.info.bind(logger) }
}))
// For body requests
app.use(bodyParser.urlencoded({ extended: false }))
app.use(bodyParser.json({
  type: [ 'application/json', 'application/*+json' ],
  limit: '500kb'
}))

// ----------- Tracker -----------

const trackerServer = new TrackerServer({
  http: false,
  udp: false,
  ws: false,
  dht: false
})

trackerServer.on('error', function (err) {
  logger.error('Error in websocket tracker.', err)
})

trackerServer.on('warning', function (err) {
  logger.error('Warning in websocket tracker.', err)
})

const server = http.createServer(app)
const wss = new WebSocketServer({ server: server, path: '/tracker/socket' })
wss.on('connection', function (ws) {
  trackerServer.onWebSocketConnection(ws)
})

const onHttpRequest = trackerServer.onHttpRequest.bind(trackerServer)
app.get('/tracker/announce', (req, res) => onHttpRequest(req, res, { action: 'announce' }))
app.get('/tracker/scrape', (req, res) => onHttpRequest(req, res, { action: 'scrape' }))

// ----------- Views, routes and static files -----------

// API
const apiRoute = '/api/' + API_VERSION
app.use(apiRoute, apiRouter)

// Services (oembed...)
app.use('/services', servicesRouter)

app.use('/', webfingerRouter)
app.use('/', activityPubRouter)

// Client files
app.use('/', clientsRouter)

// Static files
app.use('/', staticRouter)

// Always serve index client page (the client is a single page application, let it handle routing)
app.use('/*', function (req, res) {
  if (req.accepts(ACCEPT_HEADERS) === 'html') {
    return res.sendFile(path.join(__dirname, '../client/dist/index.html'))
  }

  return res.status(404).end()
})

// ----------- Errors -----------

// Catch 404 and forward to error handler
app.use(function (req, res, next) {
  const err = new Error('Not Found')
  err['status'] = 404
  next(err)
})

app.use(function (err, req, res, next) {
  let error = 'Unknown error.'
  if (err) {
    error = err.stack || err.message || err
  }

  logger.error('Error in controller.', { error })
  return res.status(err.status || 500).end()
})

// ----------- Run -----------

function onDatabaseInitDone () {
  const port = CONFIG.LISTEN.PORT

  installApplication()
    .then(() => {
      // ----------- Make the server listening -----------
      server.listen(port, () => {
        // Emailer initialization and then job queue initialization
        Emailer.Instance.init()
        Emailer.Instance.checkConnectionOrDie()
          .then(() => JobQueue.Instance.init())

        // Caches initializations
        VideosPreviewCache.Instance.init(CONFIG.CACHE.PREVIEWS.SIZE)

        // Enable Schedulers
        BadActorFollowScheduler.Instance.enable()
        RemoveOldJobsScheduler.Instance.enable()

        // Redis initialization
        Redis.Instance.init()

        logger.info('Server listening on port %d', port)
        logger.info('Web server: %s', CONFIG.WEBSERVER.URL)
      })
    })
}
