import { Application, Request, Response } from 'express'
import { Meter, metrics } from '@opentelemetry/api'
import { PrometheusExporter } from '@opentelemetry/exporter-prometheus'
import { MeterProvider } from '@opentelemetry/sdk-metrics'
import { logger } from '@server/helpers/logger'
import { CONFIG } from '@server/initializers/config'
import { MVideoImmutable } from '@server/types/models'
import { PlaybackMetricCreate } from '@shared/models'
import {
  BittorrentTrackerObserversBuilder,
  JobQueueObserversBuilder,
  LivesObserversBuilder,
  NodeJSObserversBuilder,
  PlaybackMetrics,
  StatsObserversBuilder,
  ViewersObserversBuilder
} from './metric-helpers'

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
      ]
    })

    provider.addMetricReader(new PrometheusExporter({
      host: CONFIG.OPEN_TELEMETRY.METRICS.PROMETHEUS_EXPORTER.HOSTNAME,
      port: CONFIG.OPEN_TELEMETRY.METRICS.PROMETHEUS_EXPORTER.PORT
    }))

    metrics.setGlobalMeterProvider(provider)

    this.meter = metrics.getMeter('default')

    this.buildRequestObserver()

    this.playbackMetrics = new PlaybackMetrics(this.meter)
    this.playbackMetrics.buildCounters()

    const nodeJSObserversBuilder = new NodeJSObserversBuilder(this.meter)
    nodeJSObserversBuilder.buildObservers()

    const jobQueueObserversBuilder = new JobQueueObserversBuilder(this.meter)
    jobQueueObserversBuilder.buildObservers()

    const statsObserversBuilder = new StatsObserversBuilder(this.meter)
    statsObserversBuilder.buildObservers()

    const livesObserversBuilder = new LivesObserversBuilder(this.meter)
    livesObserversBuilder.buildObservers()

    const viewersObserversBuilder = new ViewersObserversBuilder(this.meter)
    viewersObserversBuilder.buildObservers()

    const bittorrentTrackerObserversBuilder = new BittorrentTrackerObserversBuilder(this.meter, options.trackerServer)
    bittorrentTrackerObserversBuilder.buildObservers()
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
        path: this.buildRequestPath(req.originalUrl),
        method: req.method,
        statusCode: res.statusCode + ''
      })
    }
  }

  private buildRequestPath (path: string) {
    return path.split('?')[0]
  }

  static get Instance () {
    return this.instance || (this.instance = new this())
  }
}

export {
  OpenTelemetryMetrics
}
