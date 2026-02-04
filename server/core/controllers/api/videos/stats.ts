import {
  VideoDownloadStatsTimeserieMetric,
  VideoStatsOverallQuery,
  VideoStatsTimeserie,
  VideoStatsTimeserieMetric,
  VideoStatsTimeserieQuery,
  VideoStatsUserAgentQuery
} from '@peertube/peertube-models'
import { LocalVideoViewerModel } from '@server/models/view/local-video-viewer.js'
import express from 'express'
import {
  asyncMiddleware,
  authenticate,
  videoOverallOrUserAgentStatsValidator,
  videoRetentionStatsValidator,
  videoTimeseriesStatsValidator
} from '../../../middlewares/index.js'
import { MVideo } from '@server/types/models/index.js'
import { VideoDownloadModel } from '@server/models/download/video-download.js'

const statsRouter = express.Router()

statsRouter.get(
  '/:videoId/stats/overall',
  authenticate,
  asyncMiddleware(videoOverallOrUserAgentStatsValidator),
  asyncMiddleware(getOverallStats)
)

statsRouter.get(
  '/:videoId/stats/timeseries/:metric',
  authenticate,
  asyncMiddleware(videoTimeseriesStatsValidator),
  asyncMiddleware(getTimeseriesStats)
)

statsRouter.get(
  '/:videoId/stats/retention',
  authenticate,
  asyncMiddleware(videoRetentionStatsValidator),
  asyncMiddleware(getRetentionStats)
)

statsRouter.get(
  '/:videoId/stats/user-agent',
  authenticate,
  asyncMiddleware(videoOverallOrUserAgentStatsValidator),
  asyncMiddleware(getUserAgentStats)
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

async function getUserAgentStats (req: express.Request, res: express.Response) {
  const video = res.locals.videoAll
  const query = req.query as VideoStatsUserAgentQuery

  const stats = await LocalVideoViewerModel.getUserAgentStats({
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

async function getTimeseriesStats (req: express.Request, res: express.Response) {
	const video = res.locals.videoAll
	const metric = req.params.metric as VideoStatsTimeserieMetric|VideoDownloadStatsTimeserieMetric

	let handler: (options: {
		video: MVideo
		metric: VideoStatsTimeserieMetric|VideoDownloadStatsTimeserieMetric
		startDate: string
		endDate: string
	}) => Promise < VideoStatsTimeserie >

	switch (metric) {
		case "downloads":
			handler = VideoDownloadModel.getTimeserieStats;
			break;
		default:
			handler = LocalVideoViewerModel.getTimeserieStats;
	}

	const query = req.query as VideoStatsTimeserieQuery;

	const stats = await handler({
		video,
		metric,
		startDate: query.startDate ?? video.createdAt.toISOString(),
		endDate: query.endDate ?? new Date().toISOString(),
	});

  return res.json(stats)
}
