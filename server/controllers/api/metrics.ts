import express from 'express'
import { CONFIG } from '@server/initializers/config'
import { OpenTelemetryMetrics } from '@server/lib/opentelemetry/metrics'
import { HttpStatusCode, PlaybackMetricCreate } from '@shared/models'
import { addPlaybackMetricValidator, apiRateLimiter, asyncMiddleware } from '../../middlewares'

const metricsRouter = express.Router()

metricsRouter.use(apiRateLimiter)

metricsRouter.post('/playback',
  asyncMiddleware(addPlaybackMetricValidator),
  addPlaybackMetric
)

// ---------------------------------------------------------------------------

export {
  metricsRouter
}

// ---------------------------------------------------------------------------

function addPlaybackMetric (req: express.Request, res: express.Response) {
  if (!CONFIG.OPEN_TELEMETRY.METRICS.ENABLED) {
    return res.sendStatus(HttpStatusCode.FORBIDDEN_403)
  }

  const body: PlaybackMetricCreate = req.body

  OpenTelemetryMetrics.Instance.observePlaybackMetric(res.locals.onlyImmutableVideo, body)

  return res.sendStatus(HttpStatusCode.NO_CONTENT_204)
}
