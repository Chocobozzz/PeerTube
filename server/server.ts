import { registerOpentelemetryTracing } from '@server/lib/opentelemetry/tracing.js'
await registerOpentelemetryTracing()

process.title = 'peertube'

// ----------- Core checker -----------
import { checkMissedConfig, checkFFmpeg, checkNodeVersion } from './core/initializers/checker-before-init.js'

// Do not use barrels because we don't want to load all modules here (we need to initialize database first)
import { CONFIG } from './core/initializers/config.js'
import { API_VERSION, WEBSERVER, loadLanguages } from './core/initializers/constants.js'
import { logger } from './core/helpers/logger.js'

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

import { checkConfig, checkActivityPubUrls, checkFFmpegVersion } from './core/initializers/checker-after-init.js'

try {
  checkConfig()
} catch (err) {
  logger.error('Config error.', { err })
  process.exit(-1)
}

// ----------- Database -----------

// Initialize database and models
import { initDatabaseModels, checkDatabaseConnectionOrDie, sequelizeTypescript } from './core/initializers/database.js'
checkDatabaseConnectionOrDie()

import { migrate } from './core/initializers/migrator.js'
migrate()
  .then(() => initDatabaseModels(false))
  .then(() => startApplication())
  .catch(err => {
    logger.error('Cannot start application.', { err })
    process.exit(-1)
  })

// ----------- Initialize -----------
loadLanguages()
  .catch(err => logger.error('Cannot load languages', { err }))

// Express configuration
import express from 'express'
import morgan, { token } from 'morgan'
import cors from 'cors'
import cookieParser from 'cookie-parser'
import { frameguard } from 'helmet'
import { parse } from 'useragent'
import anonymize from 'ip-anonymize'
import { program as cli } from 'commander'

const app = express().disable('x-powered-by')

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
import { baseCSP } from './core/middlewares/csp.js'

if (CONFIG.CSP.ENABLED) {
  app.use(baseCSP)
}

if (CONFIG.SECURITY.FRAMEGUARD.ENABLED) {
  app.use(frameguard({
    action: 'deny' // we only allow it for /videos/embed, see server/controllers/client.ts
  }))
}

// ----------- PeerTube modules -----------
import { installApplication } from './core/initializers/installer.js'
import { Emailer } from './core/lib/emailer.js'
import { JobQueue } from './core/lib/job-queue/index.js'
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
  sitemapRouter,
  downloadRouter
} from './core/controllers/index.js'
import { advertiseDoNotTrack } from './core/middlewares/dnt.js'
import { apiFailMiddleware } from './core/middlewares/error.js'
import { Redis } from './core/lib/redis.js'
import { ActorFollowScheduler } from './core/lib/schedulers/actor-follow-scheduler.js'
import { RemoveOldViewsScheduler } from './core/lib/schedulers/remove-old-views-scheduler.js'
import { UpdateVideosScheduler } from './core/lib/schedulers/update-videos-scheduler.js'
import { YoutubeDlUpdateScheduler } from './core/lib/schedulers/youtube-dl-update-scheduler.js'
import { VideosRedundancyScheduler } from './core/lib/schedulers/videos-redundancy-scheduler.js'
import { RemoveOldHistoryScheduler } from './core/lib/schedulers/remove-old-history-scheduler.js'
import { AutoFollowIndexInstances } from './core/lib/schedulers/auto-follow-index-instances.js'
import { RemoveDanglingResumableUploadsScheduler } from './core/lib/schedulers/remove-dangling-resumable-uploads-scheduler.js'
import { VideoViewsBufferScheduler } from './core/lib/schedulers/video-views-buffer-scheduler.js'
import { GeoIPUpdateScheduler } from './core/lib/schedulers/geo-ip-update-scheduler.js'
import { RunnerJobWatchDogScheduler } from './core/lib/schedulers/runner-job-watch-dog-scheduler.js'
import { isHTTPSignatureDigestValid } from './core/helpers/peertube-crypto.js'
import { PeerTubeSocket } from './core/lib/peertube-socket.js'
import { updateStreamingPlaylistsInfohashesIfNeeded } from './core/lib/hls.js'
import { PluginsCheckScheduler } from './core/lib/schedulers/plugins-check-scheduler.js'
import { PeerTubeVersionCheckScheduler } from './core/lib/schedulers/peertube-version-check-scheduler.js'
import { Hooks } from './core/lib/plugins/hooks.js'
import { PluginManager } from './core/lib/plugins/plugin-manager.js'
import { LiveManager } from './core/lib/live/index.js'
import { HttpStatusCode } from '@peertube/peertube-models'
import { ServerConfigManager } from '@server/lib/server-config-manager.js'
import { VideoViewsManager } from '@server/lib/views/video-views-manager.js'
import { isTestOrDevInstance } from '@peertube/peertube-node-utils'
import { OpenTelemetryMetrics } from '@server/lib/opentelemetry/metrics.js'
import { ApplicationModel } from '@server/models/application/application.js'
import { VideoChannelSyncLatestScheduler } from '@server/lib/schedulers/video-channel-sync-latest-scheduler.js'
import { RemoveExpiredUserExportsScheduler } from '@server/lib/schedulers/remove-expired-user-exports-scheduler.js'

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

// HTTP logging
if (CONFIG.LOG.LOG_HTTP_REQUESTS) {
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
}

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

    if (req.originalUrl.startsWith('/plugins/')) {
      req.rawBody = buf
    }
  }
}))

// W3C DNT Tracking Status
app.use(advertiseDoNotTrack)

// ----------- Open Telemetry -----------

OpenTelemetryMetrics.Instance.init(app)

// ----------- Views, routes and static files -----------

app.use('/api/' + API_VERSION, apiRouter)

// Services (oembed...)
app.use('/services', servicesRouter)

if (CONFIG.FEDERATION.ENABLED) {
  app.use('/', activityPubRouter)
}

app.use('/', feedsRouter)
app.use('/', trackerRouter)
app.use('/', sitemapRouter)

// Static files
app.use('/', staticRouter)
app.use('/', wellKnownRouter)
app.use('/', miscRouter)
app.use('/', downloadRouter)
app.use('/', lazyStaticRouter)
app.use('/', objectStorageProxyRouter)

// Cookies for plugins and HTML
app.use(cookieParser())

// Plugins & themes
app.use('/', pluginsRouter)

// Client files, last valid routes!
const cliOptions = cli.opts<{ client: boolean, plugins: boolean }>()
if (cliOptions.client) app.use('/', clientsRouter)

// ----------- Errors -----------

// Catch unmatched routes
app.use((_req, res: express.Response) => {
  res.status(HttpStatusCode.NOT_FOUND_404).end()
})

// Catch thrown errors
app.use((err, req, res: express.Response, _next) => {
  // Handling Sequelize error traces
  const sql = err?.parent ? err.parent.sql : undefined

  // Help us to debug SequelizeConnectionAcquireTimeoutError errors
  const activeRequests = err?.name === 'SequelizeConnectionAcquireTimeoutError' && typeof (process as any)._getActiveRequests !== 'function'
    ? (process as any)._getActiveRequests()
    : undefined

  logger.error('Error in controller.', { err, sql, activeRequests, url: req.originalUrl })

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
  RemoveExpiredUserExportsScheduler.Instance.enable()

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
    sequelizeTypescript.close()
      .catch(err => logger.error('Cannot close database connection.', { err }))

    JobQueue.Instance.terminate()
      .catch(err => logger.error('Cannot terminate job queue.', { err }))
  })

  process.on('SIGINT', () => process.exit(0))
}
