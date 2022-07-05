import { Application, Request, Response } from 'express'
import { Meter, metrics } from '@opentelemetry/api-metrics'
import { PrometheusExporter } from '@opentelemetry/exporter-prometheus'
import { MeterProvider } from '@opentelemetry/sdk-metrics-base'
import { logger } from '@server/helpers/logger'
import { CONFIG } from '@server/initializers/config'
import { JobQueue } from '../job-queue'
import { StatsObserverBuilder } from './metric-helpers'

class OpenTelemetryMetrics {

  private static instance: OpenTelemetryMetrics

  private meter: Meter

  private onRequestDuration: (req: Request, res: Response) => void

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

  registerMetrics () {
    if (CONFIG.OPEN_TELEMETRY.METRICS.ENABLED !== true) return

    logger.info('Registering Open Telemetry metrics')

    const provider = new MeterProvider()

    provider.addMetricReader(new PrometheusExporter({ port: CONFIG.OPEN_TELEMETRY.METRICS.PROMETHEUS_EXPORTER.PORT }))

    metrics.setGlobalMeterProvider(provider)

    this.meter = metrics.getMeter('default')

    this.buildMemoryObserver()
    this.buildRequestObserver()
    this.buildJobQueueObserver()

    const statsObserverBuilder = new StatsObserverBuilder(this.meter)
    statsObserverBuilder.buildObservers()
  }

  private buildMemoryObserver () {
    this.meter.createObservableGauge('nodejs_memory_usage_bytes', {
      description: 'Memory'
    }).addCallback(observableResult => {
      const current = process.memoryUsage()

      observableResult.observe(current.heapTotal, { memoryType: 'heapTotal' })
      observableResult.observe(current.heapUsed, { memoryType: 'heapUsed' })
      observableResult.observe(current.arrayBuffers, { memoryType: 'arrayBuffers' })
      observableResult.observe(current.external, { memoryType: 'external' })
      observableResult.observe(current.rss, { memoryType: 'rss' })
    })
  }

  private buildJobQueueObserver () {
    this.meter.createObservableGauge('peertube_job_queue_total', {
      description: 'Total jobs in the PeerTube job queue'
    }).addCallback(async observableResult => {
      const stats = await JobQueue.Instance.getStats()

      for (const { jobType, counts } of stats) {
        for (const state of Object.keys(counts)) {
          observableResult.observe(counts[state], { jobType, state })
        }
      }
    })
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
