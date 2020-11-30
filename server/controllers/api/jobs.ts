import * as express from 'express'
import { ResultList } from '../../../shared'
import { Job, JobState, JobType } from '../../../shared/models'
import { UserRight } from '../../../shared/models/users'
import { isArray } from '../../helpers/custom-validators/misc'
import { JobQueue } from '../../lib/job-queue'
import {
  asyncMiddleware,
  authenticate,
  ensureUserHasRight,
  jobsSortValidator,
  setDefaultPagination,
  setDefaultSort
} from '../../middlewares'
import {
  paginationValidator,
  videoTranscodingFileValidator
} from '../../middlewares/validators'
import { listJobsValidator } from '../../middlewares/validators/jobs'
import { getVideoFilePath } from '@server/lib/video-paths'
import { VideoTranscodingPayload } from '@shared/models'
import { VideoModel } from '../../models/video/video'

const jobsRouter = express.Router()

jobsRouter.get('/:state?',
  authenticate,
  ensureUserHasRight(UserRight.MANAGE_JOBS),
  paginationValidator,
  jobsSortValidator,
  setDefaultSort,
  setDefaultPagination,
  listJobsValidator,
  asyncMiddleware(listJobs)
)

/**
 * Get source file for a video transcoding job
 */
jobsRouter.get('/video-transcoding/:jobId',
  asyncMiddleware(videoTranscodingFileValidator),
  asyncMiddleware(downloadVideoTranscodingFile)
)

// ---------------------------------------------------------------------------

export {
  jobsRouter
}

// ---------------------------------------------------------------------------

async function listJobs (req: express.Request, res: express.Response) {
  const state = req.params.state as JobState
  const asc = req.query.sort === 'createdAt'
  const jobType = req.query.jobType

  const jobs = await JobQueue.Instance.listForApi({
    state,
    start: req.query.start,
    count: req.query.count,
    asc,
    jobType
  })
  const total = await JobQueue.Instance.count(state, jobType)

  const result: ResultList<Job> = {
    total,
    data: await Promise.all(jobs.map(j => formatJob(j, state)))
  }

  return res.json(result)
}

async function formatJob (job: any, state?: JobState): Promise<Job> {
  const error = isArray(job.stacktrace) && job.stacktrace.length !== 0
    ? job.stacktrace[0]
    : null

  return {
    id: job.id,
    state: state || await job.getState(),
    type: job.queue.name as JobType,
    data: job.data,
    progress: await job.progress(),
    priority: job.opts.priority,
    error,
    createdAt: new Date(job.timestamp),
    finishedOn: new Date(job.finishedOn),
    processedOn: new Date(job.processedOn)
  }
}

async function downloadVideoTranscodingFile (req: express.Request, res: express.Response) {
  const job = res.locals.job
  const payload = job.data as VideoTranscodingPayload

  const video = await VideoModel.loadAndPopulateAccountAndServerAndTags(payload.videoUUID)
  if (!video) return res.status(404).end()

  let videoFile = video.getMaxQualityFile()
  switch (payload.type) {
    case 'new-resolution-to-hls':
      videoFile = payload.copyCodecs
        ? video.getWebTorrentFile(payload.resolution)
        : video.getMaxQualityFile()
      break
    case 'merge-audio-to-webtorrent':
      videoFile = video.getMinQualityFile()
      break
    case 'new-resolution-to-webtorrent':
    case 'optimize-to-webtorrent':
    default:
      break
  }

  return res.download(getVideoFilePath(video, videoFile), `${video.name}${videoFile.extname}`)
}
