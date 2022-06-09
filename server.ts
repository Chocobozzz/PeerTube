import { registerTSPaths } from './server/helpers/register-ts-paths'
registerTSPaths()

import { isTestInstance } from './server/helpers/core-utils'
if (isTestInstance()) {
  require('source-map-support').install()
}

// ----------- Node modules -----------
import * as express from 'express'
import * as morgan from 'morgan'
import * as cors from 'cors'
import * as cookieParser from 'cookie-parser'
import * as helmet from 'helmet'
import * as useragent from 'useragent'
import * as anonymize from 'ip-anonymize'
import { program as cli } from 'commander'

process.title = 'peertube'

// Create our main app
const app = express().disable("x-powered-by")

// ----------- Core checker -----------
import { checkMissedConfig, checkFFmpeg, checkNodeVersion } from './server/initializers/checker-before-init'

// Do not use barrels because we don't want to load all modules here (we need to initialize database first)
import { CONFIG } from './server/initializers/config'
import { API_VERSION, FILES_CACHE, WEBSERVER, loadLanguages } from './server/initializers/constants'
import { logger } from './server/helpers/logger'

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

checkNodeVersion()

import { checkConfig, checkActivityPubUrls, checkFFmpegVersion } from './server/initializers/checker-after-init'

const errorMessage = checkConfig()
if (errorMessage !== null) {
  throw new Error(errorMessage)
}

// Trust our proxy (IP forwarding...)
app.set('trust proxy', CONFIG.TRUST_PROXY)

// Security middleware
import { baseCSP } from './server/middlewares/csp'

if (CONFIG.CSP.ENABLED) {
  app.use(baseCSP)
}

if (CONFIG.SECURITY.FRAMEGUARD.ENABLED) {
  app.use(helmet.frameguard({
    action: 'deny' // we only allow it for /videos/embed, see server/controllers/client.ts
  }))
}

// ----------- Database -----------

// Initialize database and models
import { initDatabaseModels, checkDatabaseConnectionOrDie } from './server/initializers/database'
checkDatabaseConnectionOrDie()

import { migrate } from './server/initializers/migrator'
migrate()
  .then(() => initDatabaseModels(false))
  .then(() => startApplication())
  .catch(err => {
    logger.error('Cannot start application.', { err })
    process.exit(-1)
  })

// ----------- Initialize -----------
loadLanguages()

// ----------- PeerTube modules -----------
import { installApplication } from './server/initializers/installer'
import { Emailer } from './server/lib/emailer'
import { JobQueue } from './server/lib/job-queue'
import { VideosPreviewCache, VideosCaptionCache } from './server/lib/files-cache'
import {
  activityPubRouter,
  apiRouter,
  clientsRouter,
  feedsRouter,
  staticRouter,
  lazyStaticRouter,
  servicesRouter,
  liveRouter,
  pluginsRouter,
  webfingerRouter,
  trackerRouter,
  createWebsocketTrackerServer,
  botsRouter,
  downloadRouter
} from './server/controllers'
import { advertiseDoNotTrack } from './server/middlewares/dnt'
import { apiFailMiddleware } from './server/middlewares/error'
import { Redis } from './server/lib/redis'
import { ActorFollowScheduler } from './server/lib/schedulers/actor-follow-scheduler'
import { RemoveOldViewsScheduler } from './server/lib/schedulers/remove-old-views-scheduler'
import { RemoveOldJobsScheduler } from './server/lib/schedulers/remove-old-jobs-scheduler'
import { UpdateVideosScheduler } from './server/lib/schedulers/update-videos-scheduler'
import { YoutubeDlUpdateScheduler } from './server/lib/schedulers/youtube-dl-update-scheduler'
import { VideosRedundancyScheduler } from './server/lib/schedulers/videos-redundancy-scheduler'
import { RemoveOldHistoryScheduler } from './server/lib/schedulers/remove-old-history-scheduler'
import { AutoFollowIndexInstances } from './server/lib/schedulers/auto-follow-index-instances'
import { RemoveDanglingResumableUploadsScheduler } from './server/lib/schedulers/remove-dangling-resumable-uploads-scheduler'
import { isHTTPSignatureDigestValid } from './server/helpers/peertube-crypto'
import { PeerTubeSocket } from './server/lib/peertube-socket'
import { updateStreamingPlaylistsInfohashesIfNeeded } from './server/lib/hls'
import { PluginsCheckScheduler } from './server/lib/schedulers/plugins-check-scheduler'
import { PeerTubeVersionCheckScheduler } from './server/lib/schedulers/peertube-version-check-scheduler'
import { Hooks } from './server/lib/plugins/hooks'
import { PluginManager } from './server/lib/plugins/plugin-manager'
import { LiveManager } from './server/lib/live'
import { HttpStatusCode } from './shared/core-utils/miscs/http-error-codes'
import { VideosTorrentCache } from '@server/lib/files-cache/videos-torrent-cache'
import { ServerConfigManager } from '@server/lib/server-config-manager'

// ----------- Command line -----------

cli
  .option('--no-client', 'Start PeerTube without client interface')
  .option('--no-plugins', 'Start PeerTube without plugins/themes enabled')
  .parse(process.argv)

// ----------- App -----------

// Enable CORS for develop
if (isTestInstance()) {
  app.use(cors({
    origin: '*',
    exposedHeaders: 'Retry-After',
    credentials: true
  }))
}

// For the logger
morgan.token('remote-addr', (req: express.Request) => {
  if (CONFIG.LOG.ANONYMIZE_IP === true || req.get('DNT') === '1') {
    return anonymize(req.ip, 16, 16)
  }

  return req.ip
})
morgan.token('user-agent', (req: express.Request) => {
  if (req.get('DNT') === '1') {
    return useragent.parse(req.get('user-agent')).family
  }

  return req.get('user-agent')
})
app.use(morgan('combined', {
  stream: {
    write: (str: string) => logger.info(str.trim(), { tags: [ 'http' ] })
  },
  skip: req => CONFIG.LOG.LOG_PING_REQUESTS === false && req.originalUrl === '/api/v1/ping'
}))

// Add .fail() helper to response
app.use(apiFailMiddleware)

// For body requests
app.use(express.urlencoded({ extended: false }))
app.use(express.json({
  type: [ 'application/json', 'application/*+json' ],
  limit: '500kb',
  verify: (req: express.Request, res: express.Response, buf: Buffer) => {
    const valid = isHTTPSignatureDigestValid(buf, req)

    if (valid !== true) {
      res.fail({
        status: HttpStatusCode.FORBIDDEN_403,
        message: 'Invalid digest'
      })
    }
  }
}))

// Cookies
app.use(cookieParser())

// W3C DNT Tracking Status
app.use(advertiseDoNotTrack)

// ----------- Views, routes and static files -----------

// API
const apiRoute = '/api/' + API_VERSION
app.use(apiRoute, apiRouter)

// Services (oembed...)
app.use('/services', servicesRouter)

// Live streaming
app.use('/live', liveRouter)

// Plugins & themes
app.use('/', pluginsRouter)

app.use('/', activityPubRouter)
app.use('/', feedsRouter)
app.use('/', webfingerRouter)
app.use('/', trackerRouter)
app.use('/', botsRouter)

// Static files
app.use('/', staticRouter)
app.use('/', downloadRouter)
app.use('/', lazyStaticRouter)

// Client files, last valid routes!
const cliOptions = cli.opts()
if (cliOptions.client) app.use('/', clientsRouter)

// ----------- Errors -----------

// Catch unmatched routes
app.use((req, res: express.Response) => {
  res.status(HttpStatusCode.NOT_FOUND_404).end()
})

// Catch thrown errors
app.use((err, req, res: express.Response, next) => {
  // Format error to be logged
  let error = 'Unknown error.'
  if (err) {
    error = err.stack || err.message || err
  }
  // Handling Sequelize error traces
  const sql = err.parent ? err.parent.sql : undefined
  logger.error('Error in controller.', { err: error, sql })

  return res.fail({
    status: err.status || HttpStatusCode.INTERNAL_SERVER_ERROR_500,
    message: err.message,
    type: err.name
  })
})

const server = createWebsocketTrackerServer(app)

// ----------- Run -----------

async function startApplication () {
  const port = CONFIG.LISTEN.PORT
  const hostname = CONFIG.LISTEN.HOSTNAME

  await installApplication()

  // Check activity pub urls are valid
  checkActivityPubUrls()
    .catch(err => {
      logger.error('Error in ActivityPub URLs checker.', { err })
      process.exit(-1)
    })

  checkFFmpegVersion()
    .catch(err => logger.error('Cannot check ffmpeg version', { err }))

  // Email initialization
  Emailer.Instance.init()

  await Promise.all([
    Emailer.Instance.checkConnection(),
    JobQueue.Instance.init(),
    ServerConfigManager.Instance.init()
  ])

  // Caches initializations
  VideosPreviewCache.Instance.init(CONFIG.CACHE.PREVIEWS.SIZE, FILES_CACHE.PREVIEWS.MAX_AGE)
  VideosCaptionCache.Instance.init(CONFIG.CACHE.VIDEO_CAPTIONS.SIZE, FILES_CACHE.VIDEO_CAPTIONS.MAX_AGE)
  VideosTorrentCache.Instance.init(CONFIG.CACHE.TORRENTS.SIZE, FILES_CACHE.TORRENTS.MAX_AGE)

  // Enable Schedulers
  ActorFollowScheduler.Instance.enable()
  RemoveOldJobsScheduler.Instance.enable()
  UpdateVideosScheduler.Instance.enable()
  YoutubeDlUpdateScheduler.Instance.enable()
  VideosRedundancyScheduler.Instance.enable()
  RemoveOldHistoryScheduler.Instance.enable()
  RemoveOldViewsScheduler.Instance.enable()
  PluginsCheckScheduler.Instance.enable()
  PeerTubeVersionCheckScheduler.Instance.enable()
  AutoFollowIndexInstances.Instance.enable()
  RemoveDanglingResumableUploadsScheduler.Instance.enable()

  // Redis initialization
  Redis.Instance.init()

  PeerTubeSocket.Instance.init(server)

  updateStreamingPlaylistsInfohashesIfNeeded()
    .catch(err => logger.error('Cannot update streaming playlist infohashes.', { err }))

  if (cliOptions.plugins) await PluginManager.Instance.registerPluginsAndThemes()

  LiveManager.Instance.init()
  if (CONFIG.LIVE.ENABLED) LiveManager.Instance.run()

  // Make server listening
  server.listen(port, hostname, () => {
    logger.info('HTTP server listening on %s:%d', hostname, port)
    logger.info('Web server: %s', WEBSERVER.URL)

    Hooks.runAction('action:application.listening')
  })

  process.on('exit', () => {
    JobQueue.Instance.terminate()
  })

  process.on('SIGINT', () => process.exit(0))
}
