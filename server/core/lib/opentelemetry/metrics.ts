import { Meter, metrics } from '@opentelemetry/api'
import { PrometheusExporter } from '@opentelemetry/exporter-prometheus'
import { MeterProvider } from '@opentelemetry/sdk-metrics'
import { PlaybackMetricCreate } from '@peertube/peertube-models'
import { createLogger } from '@server/helpers/logger.js'
import { CONFIG } from '@server/initializers/config.js'
import { MVideoImmutable } from '@server/types/models/index.js'
import { Application, Request, Response } from 'express'
import {
  BittorrentTrackerObserversBuilder,
  JobQueueObserversBuilder,
  LivesObserversBuilder,
  NodeJSObserversBuilder,
  PlaybackMetrics,
  RunnerJobQueueObserversBuilder,
  RunnerObserversBuilder,
  StatsObserversBuilder,
  ViewersObserversBuilder
} from './metric-helpers/index.js'
import { WorkerThreadsObserversBuilder } from './metric-helpers/worker-threads-observers.js'

const logger = createLogger()

class OpenTelemetryMetrics {
  private static instance: OpenTelemetryMetrics

  private meter: Meter

  private onRequestDuration: (req: Request, res: Response) => void

  private playbackMetrics: PlaybackMetrics

  private constructor () {}

  init (app: Application) {
    if (CONFIG.OPEN_TELEMETRY.METRICS.ENABLED !== true) return

    app.use((req, res, next) => {
      res.once('finish', () => {
        if (!this.onRequestDuration) return

        this.onRequestDuration(req as Request, res as Response)
      })

      next()
    })
  }

  registerMetrics (options: { trackerServer: any }) {
    if (CONFIG.OPEN_TELEMETRY.METRICS.ENABLED !== true) return

    logger.info('Registering Open Telemetry metrics')

    const provider = new MeterProvider({
      views: [
        ...NodeJSObserversBuilder.getViews()
      ],
      readers: [
        new PrometheusExporter({
          host: CONFIG.OPEN_TELEMETRY.METRICS.PROMETHEUS_EXPORTER.HOSTNAME,
          port: CONFIG.OPEN_TELEMETRY.METRICS.PROMETHEUS_EXPORTER.PORT
        })
      ]
    })

    metrics.setGlobalMeterProvider(provider)

    this.meter = metrics.getMeter('default')

    if (CONFIG.OPEN_TELEMETRY.METRICS.HTTP_REQUEST_DURATION.ENABLED === true) {
      this.buildRequestObserver()
    }

    this.playbackMetrics = new PlaybackMetrics(this.meter)
    this.playbackMetrics.buildCounters()

    new NodeJSObserversBuilder(this.meter).buildObservers()
    new JobQueueObserversBuilder(this.meter).buildObservers()
    new RunnerJobQueueObserversBuilder(this.meter).buildObservers()
    new RunnerObserversBuilder(this.meter).buildObservers()
    new StatsObserversBuilder(this.meter).buildObservers()
    new LivesObserversBuilder(this.meter).buildObservers()
    new ViewersObserversBuilder(this.meter).buildObservers()
    new WorkerThreadsObserversBuilder(this.meter).buildObservers()
    new BittorrentTrackerObserversBuilder(this.meter, options.trackerServer).buildObservers()
  }

  observePlaybackMetric (video: MVideoImmutable, metrics: PlaybackMetricCreate) {
    this.playbackMetrics.observe(video, metrics)
  }

  private buildRequestObserver () {
    const requestDuration = this.meter.createHistogram('http_request_duration_ms', {
      unit: 'milliseconds',
      description: 'Duration of HTTP requests in ms'
    })

    this.onRequestDuration = (req: Request, res: Response) => {
      const duration = Date.now() - res.locals.requestStart

      requestDuration.record(duration, {
        path: this.buildRequestPath(req),
        method: req.method,
        statusCode: res.statusCode + ''
      })
    }
  }

  private buildRequestPath (req: Request) {
    const path = req.originalUrl.split('?')[0]

    // API routes
    if (path.startsWith('/api/') && req.route?.path) {
      return req.baseUrl.replace(/\/(\d+|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})(?=\/|$)/g, '/:id') +
        String(req.route.path)
    }

    // Other paths (client pages, static files, ActivityPub, feeds...) don't give us a usable route template:
    // static files are served by middlewares that don't set `req.route`, and routers mounted with parameters
    // put the actual values (not the `:param` pattern) in `req.baseUrl`.
    // Using the raw path would create one metric series per video/file, so keep the first segment only. For example:
    //   * /w/9c9de5e8-0a1b-4c2d-8e3f-123456789abc -> /w/*
    //   * /static/streaming-playlists/hls/<uuid>/<uuid>-720.mp4 -> /static/*
    //   * /videos/watch/<uuid>/comments (ActivityPub) -> /videos/*
    const firstSegment = path.split('/')[1]

    return firstSegment
      ? `/${firstSegment}/*`
      : '/'
  }

  static get Instance () {
    return this.instance || (this.instance = new this())
  }
}

export {
  OpenTelemetryMetrics
}
