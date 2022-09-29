import express from 'express'
import { OpenTelemetryMetrics } from '@server/lib/opentelemetry/metrics'
import { HttpStatusCode, PlaybackMetricCreate } from '@shared/models'
import { addPlaybackMetricValidator, asyncMiddleware } from '../../middlewares'

const metricsRouter = express.Router()

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
  const body: PlaybackMetricCreate = req.body

  OpenTelemetryMetrics.Instance.observePlaybackMetric(res.locals.onlyImmutableVideo, body)

  return res.sendStatus(HttpStatusCode.NO_CONTENT_204)
}
