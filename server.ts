// ----------- Node modules -----------
import { registerOpentelemetryTracing } from './server/lib/opentelemetry/tracing'
registerOpentelemetryTracing()

import express from 'express'
import morgan, { token } from 'morgan'
import cors from 'cors'
import cookieParser from 'cookie-parser'
import { frameguard } from 'helmet'
import { parse } from 'useragent'
import anonymize from 'ip-anonymize'
import { program as cli } from 'commander'

process.title = 'peertube'

// Create our main app
const app = express().disable('x-powered-by')

// ----------- Core checker -----------
import { checkMissedConfig, checkFFmpeg, checkNodeVersion } from './server/initializers/checker-before-init'

// Do not use barrels because we don't want to load all modules here (we need to initialize database first)
import { CONFIG } from './server/initializers/config'
import { API_VERSION, WEBSERVER, loadLanguages } from './server/initializers/constants'
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

try {
  checkNodeVersion()
} catch (err) {
  logger.error('Error in NodeJS check.', { err })
  process.exit(-1)
}

import { checkConfig, checkActivityPubUrls, checkFFmpegVersion } from './server/initializers/checker-after-init'

try {
  checkConfig()
} catch (err) {
  logger.error('Config error.', { err })
  process.exit(-1)
}

// Trust our proxy (IP forwarding...)
app.set('trust proxy', CONFIG.TRUST_PROXY)

app.use((_req, res, next) => {
  // OpenTelemetry
  res.locals.requestStart = Date.now()

  if (CONFIG.SECURITY.POWERED_BY_HEADER.ENABLED === true) {
    res.setHeader('x-powered-by', 'PeerTube')
  }

  return next()
})

// Security middleware
import { baseCSP } from './server/middlewares/csp'

if (CONFIG.CSP.ENABLED) {
  app.use(baseCSP)
}

if (CONFIG.SECURITY.FRAMEGUARD.ENABLED) {
  app.use(frameguard({
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
import {
  activityPubRouter,
  apiRouter,
  miscRouter,
  clientsRouter,
  feedsRouter,
  staticRouter,
  wellKnownRouter,
  lazyStaticRouter,
  servicesRouter,
  objectStorageProxyRouter,
  pluginsRouter,
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
import { VideoViewsBufferScheduler } from './server/lib/schedulers/video-views-buffer-scheduler'
import { GeoIPUpdateScheduler } from './server/lib/schedulers/geo-ip-update-scheduler'
import { RunnerJobWatchDogScheduler } from './server/lib/schedulers/runner-job-watch-dog-scheduler'
import { isHTTPSignatureDigestValid } from './server/helpers/peertube-crypto'
import { PeerTubeSocket } from './server/lib/peertube-socket'
import { updateStreamingPlaylistsInfohashesIfNeeded } from './server/lib/hls'
import { PluginsCheckScheduler } from './server/lib/schedulers/plugins-check-scheduler'
import { PeerTubeVersionCheckScheduler } from './server/lib/schedulers/peertube-version-check-scheduler'
import { Hooks } from './server/lib/plugins/hooks'
import { PluginManager } from './server/lib/plugins/plugin-manager'
import { LiveManager } from './server/lib/live'
import { HttpStatusCode } from './shared/models/http/http-error-codes'
import { ServerConfigManager } from '@server/lib/server-config-manager'
import { VideoViewsManager } from '@server/lib/views/video-views-manager'
import { isTestOrDevInstance } from './server/helpers/core-utils'
import { OpenTelemetryMetrics } from '@server/lib/opentelemetry/metrics'
import { ApplicationModel } from '@server/models/application/application'
import { VideoChannelSyncLatestScheduler } from '@server/lib/schedulers/video-channel-sync-latest-scheduler'

// ----------- Command line -----------

cli
  .option('--no-client', 'Start PeerTube without client interface')
  .option('--no-plugins', 'Start PeerTube without plugins/themes enabled')
  .option('--benchmark-startup', 'Automatically stop server when initialized')
  .parse(process.argv)

// ----------- App -----------

// Enable CORS for develop
if (isTestOrDevInstance()) {
  app.use(cors({
    origin: '*',
    exposedHeaders: 'Retry-After',
    credentials: true
  }))
}

// For the logger
token('remote-addr', (req: express.Request) => {
  if (CONFIG.LOG.ANONYMIZE_IP === true || req.get('DNT') === '1') {
    return anonymize(req.ip, 16, 16)
  }

  return req.ip
})
token('user-agent', (req: express.Request) => {
  if (req.get('DNT') === '1') {
    return parse(req.get('user-agent')).family
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

// ----------- Open Telemetry -----------

OpenTelemetryMetrics.Instance.init(app)

// ----------- Views, routes and static files -----------

// API
const apiRoute = '/api/' + API_VERSION
app.use(apiRoute, apiRouter)

// Services (oembed...)
app.use('/services', servicesRouter)

// Plugins & themes
app.use('/', pluginsRouter)

app.use('/', activityPubRouter)
app.use('/', feedsRouter)
app.use('/', trackerRouter)
app.use('/', botsRouter)

// Static files
app.use('/', staticRouter)
app.use('/', wellKnownRouter)
app.use('/', miscRouter)
app.use('/', downloadRouter)
app.use('/', lazyStaticRouter)
app.use('/', objectStorageProxyRouter)

// Client files, last valid routes!
const cliOptions = cli.opts<{ client: boolean, plugins: boolean }>()
if (cliOptions.client) app.use('/', clientsRouter)

// ----------- Errors -----------

// Catch unmatched routes
app.use((_req, res: express.Response) => {
  res.status(HttpStatusCode.NOT_FOUND_404).end()
})

// Catch thrown errors
app.use((err, _req, res: express.Response, _next) => {
  // Format error to be logged
  let error = 'Unknown error.'
  if (err) {
    error = err.stack || err.message || err
  }

  // Handling Sequelize error traces
  const sql = err?.parent ? err.parent.sql : undefined

  // Help us to debug SequelizeConnectionAcquireTimeoutError errors
  const activeRequests = err?.name === 'SequelizeConnectionAcquireTimeoutError' && typeof (process as any)._getActiveRequests !== 'function'
    ? (process as any)._getActiveRequests()
    : undefined

  logger.error('Error in controller.', { err: error, sql, activeRequests })

  return res.fail({
    status: err.status || HttpStatusCode.INTERNAL_SERVER_ERROR_500,
    message: err.message,
    type: err.name
  })
})

const { server, trackerServer } = createWebsocketTrackerServer(app)

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

  Redis.Instance.init()
  Emailer.Instance.init()

  await Promise.all([
    Emailer.Instance.checkConnection(),
    JobQueue.Instance.init(),
    ServerConfigManager.Instance.init()
  ])

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
  VideoChannelSyncLatestScheduler.Instance.enable()
  VideoViewsBufferScheduler.Instance.enable()
  GeoIPUpdateScheduler.Instance.enable()
  RunnerJobWatchDogScheduler.Instance.enable()

  OpenTelemetryMetrics.Instance.registerMetrics({ trackerServer })

  PluginManager.Instance.init(server)
  // Before PeerTubeSocket init
  PluginManager.Instance.registerWebSocketRouter()

  PeerTubeSocket.Instance.init(server)
  VideoViewsManager.Instance.init()

  updateStreamingPlaylistsInfohashesIfNeeded()
    .catch(err => logger.error('Cannot update streaming playlist infohashes.', { err }))

  LiveManager.Instance.init()
  if (CONFIG.LIVE.ENABLED) await LiveManager.Instance.run()

  // Make server listening
  server.listen(port, hostname, async () => {
    if (cliOptions.plugins) {
      try {
        await PluginManager.Instance.rebuildNativePluginsIfNeeded()

        await PluginManager.Instance.registerPluginsAndThemes()
      } catch (err) {
        logger.error('Cannot register plugins and themes.', { err })
      }
    }

    ApplicationModel.updateNodeVersions()
      .catch(err => logger.error('Cannot update node versions.', { err }))

    JobQueue.Instance.start()
      .catch(err => {
        logger.error('Cannot start job queue.', { err })
        process.exit(-1)
      })

    logger.info('HTTP server listening on %s:%d', hostname, port)
    logger.info('Web server: %s', WEBSERVER.URL)

    Hooks.runAction('action:application.listening')

    if (cliOptions['benchmarkStartup']) process.exit(0)
  })

  process.on('exit', () => {
    JobQueue.Instance.terminate()
      .catch(err => logger.error('Cannot terminate job queue.', { err }))
  })

  process.on('SIGINT', () => process.exit(0))
}
