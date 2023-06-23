import express, { UploadFiles } from 'express'
import { retryTransactionWrapper } from '@server/helpers/database-utils'
import { createReqFiles } from '@server/helpers/express-utils'
import { logger, loggerTagsFactory } from '@server/helpers/logger'
import { generateRunnerJobToken } from '@server/helpers/token-generator'
import { MIMETYPES } from '@server/initializers/constants'
import { sequelizeTypescript } from '@server/initializers/database'
import { getRunnerJobHandlerClass, updateLastRunnerContact } from '@server/lib/runners'
import {
  apiRateLimiter,
  asyncMiddleware,
  authenticate,
  ensureUserHasRight,
  paginationValidator,
  runnerJobsSortValidator,
  setDefaultPagination,
  setDefaultSort
} from '@server/middlewares'
import {
  abortRunnerJobValidator,
  acceptRunnerJobValidator,
  cancelRunnerJobValidator,
  errorRunnerJobValidator,
  getRunnerFromTokenValidator,
  jobOfRunnerGetValidator,
  runnerJobGetValidator,
  successRunnerJobValidator,
  updateRunnerJobValidator
} from '@server/middlewares/validators/runners'
import { RunnerModel } from '@server/models/runner/runner'
import { RunnerJobModel } from '@server/models/runner/runner-job'
import {
  AbortRunnerJobBody,
  AcceptRunnerJobResult,
  ErrorRunnerJobBody,
  HttpStatusCode,
  ListRunnerJobsQuery,
  LiveRTMPHLSTranscodingUpdatePayload,
  RequestRunnerJobResult,
  RunnerJobState,
  RunnerJobSuccessBody,
  RunnerJobSuccessPayload,
  RunnerJobType,
  RunnerJobUpdateBody,
  RunnerJobUpdatePayload,
  ServerErrorCode,
  UserRight,
  VideoStudioTranscodingSuccess,
  VODAudioMergeTranscodingSuccess,
  VODHLSTranscodingSuccess,
  VODWebVideoTranscodingSuccess
} from '@shared/models'

const postRunnerJobSuccessVideoFiles = createReqFiles(
  [ 'payload[videoFile]', 'payload[resolutionPlaylistFile]' ],
  { ...MIMETYPES.VIDEO.MIMETYPE_EXT, ...MIMETYPES.M3U8.MIMETYPE_EXT }
)

const runnerJobUpdateVideoFiles = createReqFiles(
  [ 'payload[videoChunkFile]', 'payload[resolutionPlaylistFile]', 'payload[masterPlaylistFile]' ],
  { ...MIMETYPES.VIDEO.MIMETYPE_EXT, ...MIMETYPES.M3U8.MIMETYPE_EXT }
)

const lTags = loggerTagsFactory('api', 'runner')

const runnerJobsRouter = express.Router()

// ---------------------------------------------------------------------------
// Controllers for runners
// ---------------------------------------------------------------------------

runnerJobsRouter.post('/jobs/request',
  apiRateLimiter,
  asyncMiddleware(getRunnerFromTokenValidator),
  asyncMiddleware(requestRunnerJob)
)

runnerJobsRouter.post('/jobs/:jobUUID/accept',
  apiRateLimiter,
  asyncMiddleware(runnerJobGetValidator),
  acceptRunnerJobValidator,
  asyncMiddleware(getRunnerFromTokenValidator),
  asyncMiddleware(acceptRunnerJob)
)

runnerJobsRouter.post('/jobs/:jobUUID/abort',
  apiRateLimiter,
  asyncMiddleware(jobOfRunnerGetValidator),
  abortRunnerJobValidator,
  asyncMiddleware(abortRunnerJob)
)

runnerJobsRouter.post('/jobs/:jobUUID/update',
  runnerJobUpdateVideoFiles,
  apiRateLimiter, // Has to be after multer middleware to parse runner token
  asyncMiddleware(jobOfRunnerGetValidator),
  updateRunnerJobValidator,
  asyncMiddleware(updateRunnerJobController)
)

runnerJobsRouter.post('/jobs/:jobUUID/error',
  asyncMiddleware(jobOfRunnerGetValidator),
  errorRunnerJobValidator,
  asyncMiddleware(errorRunnerJob)
)

runnerJobsRouter.post('/jobs/:jobUUID/success',
  postRunnerJobSuccessVideoFiles,
  apiRateLimiter, // Has to be after multer middleware to parse runner token
  asyncMiddleware(jobOfRunnerGetValidator),
  successRunnerJobValidator,
  asyncMiddleware(postRunnerJobSuccess)
)

// ---------------------------------------------------------------------------
// Controllers for admins
// ---------------------------------------------------------------------------

runnerJobsRouter.post('/jobs/:jobUUID/cancel',
  authenticate,
  ensureUserHasRight(UserRight.MANAGE_RUNNERS),
  asyncMiddleware(runnerJobGetValidator),
  cancelRunnerJobValidator,
  asyncMiddleware(cancelRunnerJob)
)

runnerJobsRouter.get('/jobs',
  authenticate,
  ensureUserHasRight(UserRight.MANAGE_RUNNERS),
  paginationValidator,
  runnerJobsSortValidator,
  setDefaultSort,
  setDefaultPagination,
  asyncMiddleware(listRunnerJobs)
)

// ---------------------------------------------------------------------------

export {
  runnerJobsRouter
}

// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Controllers for runners
// ---------------------------------------------------------------------------

async function requestRunnerJob (req: express.Request, res: express.Response) {
  const runner = res.locals.runner
  const availableJobs = await RunnerJobModel.listAvailableJobs()

  logger.debug('Runner %s requests for a job.', runner.name, { availableJobs, ...lTags(runner.name) })

  const result: RequestRunnerJobResult = {
    availableJobs: availableJobs.map(j => ({
      uuid: j.uuid,
      type: j.type,
      payload: j.payload
    }))
  }

  updateLastRunnerContact(req, runner)

  return res.json(result)
}

async function acceptRunnerJob (req: express.Request, res: express.Response) {
  const runner = res.locals.runner
  const runnerJob = res.locals.runnerJob

  const newRunnerJob = await retryTransactionWrapper(() => {
    return sequelizeTypescript.transaction(async transaction => {
      await runnerJob.reload({ transaction })

      if (runnerJob.state !== RunnerJobState.PENDING) {
        res.fail({
          type: ServerErrorCode.RUNNER_JOB_NOT_IN_PENDING_STATE,
          message: 'This job is not in pending state anymore',
          status: HttpStatusCode.CONFLICT_409
        })

        return undefined
      }

      runnerJob.state = RunnerJobState.PROCESSING
      runnerJob.processingJobToken = generateRunnerJobToken()
      runnerJob.startedAt = new Date()
      runnerJob.runnerId = runner.id

      return runnerJob.save({ transaction })
    })
  })
  if (!newRunnerJob) return

  newRunnerJob.Runner = runner as RunnerModel

  const result: AcceptRunnerJobResult = {
    job: {
      ...newRunnerJob.toFormattedJSON(),

      jobToken: newRunnerJob.processingJobToken
    }
  }

  updateLastRunnerContact(req, runner)

  logger.info(
    'Remote runner %s has accepted job %s (%s)', runner.name, runnerJob.uuid, runnerJob.type,
    lTags(runner.name, runnerJob.uuid, runnerJob.type)
  )

  return res.json(result)
}

async function abortRunnerJob (req: express.Request, res: express.Response) {
  const runnerJob = res.locals.runnerJob
  const runner = runnerJob.Runner
  const body: AbortRunnerJobBody = req.body

  logger.info(
    'Remote runner %s is aborting job %s (%s)', runner.name, runnerJob.uuid, runnerJob.type,
    { reason: body.reason, ...lTags(runner.name, runnerJob.uuid, runnerJob.type) }
  )

  const RunnerJobHandler = getRunnerJobHandlerClass(runnerJob)
  await new RunnerJobHandler().abort({ runnerJob })

  updateLastRunnerContact(req, runnerJob.Runner)

  return res.sendStatus(HttpStatusCode.NO_CONTENT_204)
}

async function errorRunnerJob (req: express.Request, res: express.Response) {
  const runnerJob = res.locals.runnerJob
  const runner = runnerJob.Runner
  const body: ErrorRunnerJobBody = req.body

  runnerJob.failures += 1

  logger.error(
    'Remote runner %s had an error with job %s (%s)', runner.name, runnerJob.uuid, runnerJob.type,
    { errorMessage: body.message, totalFailures: runnerJob.failures, ...lTags(runner.name, runnerJob.uuid, runnerJob.type) }
  )

  const RunnerJobHandler = getRunnerJobHandlerClass(runnerJob)
  await new RunnerJobHandler().error({ runnerJob, message: body.message })

  updateLastRunnerContact(req, runnerJob.Runner)

  return res.sendStatus(HttpStatusCode.NO_CONTENT_204)
}

// ---------------------------------------------------------------------------

const jobUpdateBuilders: {
  [id in RunnerJobType]?: (payload: RunnerJobUpdatePayload, files?: UploadFiles) => RunnerJobUpdatePayload
} = {
  'live-rtmp-hls-transcoding': (payload: LiveRTMPHLSTranscodingUpdatePayload, files) => {
    return {
      ...payload,

      masterPlaylistFile: files['payload[masterPlaylistFile]']?.[0].path,
      resolutionPlaylistFile: files['payload[resolutionPlaylistFile]']?.[0].path,
      videoChunkFile: files['payload[videoChunkFile]']?.[0].path
    }
  }
}

async function updateRunnerJobController (req: express.Request, res: express.Response) {
  const runnerJob = res.locals.runnerJob
  const runner = runnerJob.Runner
  const body: RunnerJobUpdateBody = req.body

  const payloadBuilder = jobUpdateBuilders[runnerJob.type]
  const updatePayload = payloadBuilder
    ? payloadBuilder(body.payload, req.files as UploadFiles)
    : undefined

  logger.debug(
    'Remote runner %s is updating job %s (%s)', runnerJob.Runner.name, runnerJob.uuid, runnerJob.type,
    { body, updatePayload, ...lTags(runner.name, runnerJob.uuid, runnerJob.type) }
  )

  const RunnerJobHandler = getRunnerJobHandlerClass(runnerJob)
  await new RunnerJobHandler().update({
    runnerJob,
    progress: req.body.progress,
    updatePayload
  })

  updateLastRunnerContact(req, runnerJob.Runner)

  return res.sendStatus(HttpStatusCode.NO_CONTENT_204)
}

// ---------------------------------------------------------------------------

const jobSuccessPayloadBuilders: {
  [id in RunnerJobType]: (payload: RunnerJobSuccessPayload, files?: UploadFiles) => RunnerJobSuccessPayload
} = {
  'vod-web-video-transcoding': (payload: VODWebVideoTranscodingSuccess, files) => {
    return {
      ...payload,

      videoFile: files['payload[videoFile]'][0].path
    }
  },

  'vod-hls-transcoding': (payload: VODHLSTranscodingSuccess, files) => {
    return {
      ...payload,

      videoFile: files['payload[videoFile]'][0].path,
      resolutionPlaylistFile: files['payload[resolutionPlaylistFile]'][0].path
    }
  },

  'vod-audio-merge-transcoding': (payload: VODAudioMergeTranscodingSuccess, files) => {
    return {
      ...payload,

      videoFile: files['payload[videoFile]'][0].path
    }
  },

  'video-studio-transcoding': (payload: VideoStudioTranscodingSuccess, files) => {
    return {
      ...payload,

      videoFile: files['payload[videoFile]'][0].path
    }
  },

  'live-rtmp-hls-transcoding': () => ({})
}

async function postRunnerJobSuccess (req: express.Request, res: express.Response) {
  const runnerJob = res.locals.runnerJob
  const runner = runnerJob.Runner
  const body: RunnerJobSuccessBody = req.body

  const resultPayload = jobSuccessPayloadBuilders[runnerJob.type](body.payload, req.files as UploadFiles)

  logger.info(
    'Remote runner %s is sending success result for job %s (%s)', runnerJob.Runner.name, runnerJob.uuid, runnerJob.type,
    { resultPayload, ...lTags(runner.name, runnerJob.uuid, runnerJob.type) }
  )

  const RunnerJobHandler = getRunnerJobHandlerClass(runnerJob)
  await new RunnerJobHandler().complete({ runnerJob, resultPayload })

  updateLastRunnerContact(req, runnerJob.Runner)

  return res.sendStatus(HttpStatusCode.NO_CONTENT_204)
}

// ---------------------------------------------------------------------------
// Controllers for admins
// ---------------------------------------------------------------------------

async function cancelRunnerJob (req: express.Request, res: express.Response) {
  const runnerJob = res.locals.runnerJob

  logger.info('Cancelling job %s (%s)', runnerJob.uuid, runnerJob.type, lTags(runnerJob.uuid, runnerJob.type))

  const RunnerJobHandler = getRunnerJobHandlerClass(runnerJob)
  await new RunnerJobHandler().cancel({ runnerJob })

  return res.sendStatus(HttpStatusCode.NO_CONTENT_204)
}

async function listRunnerJobs (req: express.Request, res: express.Response) {
  const query: ListRunnerJobsQuery = req.query

  const resultList = await RunnerJobModel.listForApi({
    start: query.start,
    count: query.count,
    sort: query.sort,
    search: query.search
  })

  return res.json({
    total: resultList.total,
    data: resultList.data.map(d => d.toFormattedAdminJSON())
  })
}
