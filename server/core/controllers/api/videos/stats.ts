import express from 'express'
import { LocalVideoViewerModel } from '@server/models/view/local-video-viewer.js'
import { VideoStatsOverallQuery, VideoStatsTimeserieMetric, VideoStatsTimeserieQuery } from '@peertube/peertube-models'
import {
  asyncMiddleware,
  authenticate,
  videoOverallStatsValidator,
  videoRetentionStatsValidator,
  videoTimeserieStatsValidator
} from '../../../middlewares/index.js'

const statsRouter = express.Router()

statsRouter.get('/:videoId/stats/overall',
  authenticate,
  asyncMiddleware(videoOverallStatsValidator),
  asyncMiddleware(getOverallStats)
)

statsRouter.get('/:videoId/stats/timeseries/:metric',
  authenticate,
  asyncMiddleware(videoTimeserieStatsValidator),
  asyncMiddleware(getTimeserieStats)
)

statsRouter.get('/:videoId/stats/retention',
  authenticate,
  asyncMiddleware(videoRetentionStatsValidator),
  asyncMiddleware(getRetentionStats)
)

// ---------------------------------------------------------------------------

export {
  statsRouter
}

// ---------------------------------------------------------------------------

async function getOverallStats (req: express.Request, res: express.Response) {
  const video = res.locals.videoAll
  const query = req.query as VideoStatsOverallQuery

  const stats = await LocalVideoViewerModel.getOverallStats({
    video,
    startDate: query.startDate,
    endDate: query.endDate
  })

  return res.json(stats)
}

async function getRetentionStats (req: express.Request, res: express.Response) {
  const video = res.locals.videoAll

  const stats = await LocalVideoViewerModel.getRetentionStats(video)

  return res.json(stats)
}

async function getTimeserieStats (req: express.Request, res: express.Response) {
  const video = res.locals.videoAll
  const metric = req.params.metric as VideoStatsTimeserieMetric

  const query = req.query as VideoStatsTimeserieQuery

  const stats = await LocalVideoViewerModel.getTimeserieStats({
    video,
    metric,
    startDate: query.startDate ?? video.createdAt.toISOString(),
    endDate: query.endDate ?? new Date().toISOString()
  })

  return res.json(stats)
}
