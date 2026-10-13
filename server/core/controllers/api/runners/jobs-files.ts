import {
  FileStorage,
  hasVideoStudioTaskFile,
  HttpStatusCode,
  RunnerJobState,
  RunnerJobVideoStudioTranscodingPrivatePayload,
  VideoFileStream
} from '@peertube/peertube-models'
import { pipelineToResponse } from '@server/helpers/express-utils.js'
import { createLogger } from '@server/helpers/logger.js'
import { buildLocalCommonFileReadStream } from '@server/lib/object-storage/common-files.js'
import { proxifyHLS, proxifyWebVideoFile } from '@server/lib/object-storage/index.js'
import { getStagingObjectReadStream } from '@server/lib/object-storage/staging.js'
import { VideoPathManager } from '@server/lib/video-path-manager.js'
import { getStudioTaskFilePath } from '@server/lib/video-studio.js'
import { apiRateLimiter, asyncMiddleware } from '@server/middlewares/index.js'
import { jobOfRunnerGetValidatorFactory } from '@server/middlewares/validators/runners/index.js'
import {
  runnerJobGetVideoStudioTaskFileValidator,
  runnerJobGetVideoTranscodingFileValidator
} from '@server/middlewares/validators/runners/job-files.js'
import { MVideoFileStreamingPlaylistVideo, MVideoFileVideo, MVideoFull } from '@server/types/models/index.js'
import express from 'express'
import { basename, extname } from 'path'

const logger = createLogger('api', 'runner')

const runnerJobFilesRouter = express.Router()

runnerJobFilesRouter.post(
  '/jobs/:jobUUID/files/videos/:videoId/max-quality/audio',
  apiRateLimiter,
  asyncMiddleware(jobOfRunnerGetValidatorFactory([ RunnerJobState.PROCESSING ])),
  asyncMiddleware(runnerJobGetVideoTranscodingFileValidator),
  asyncMiddleware(getMaxQualityAudioFile)
)

runnerJobFilesRouter.post(
  '/jobs/:jobUUID/files/videos/:videoId/max-quality',
  apiRateLimiter,
  asyncMiddleware(jobOfRunnerGetValidatorFactory([ RunnerJobState.PROCESSING ])),
  asyncMiddleware(runnerJobGetVideoTranscodingFileValidator),
  asyncMiddleware(getMaxQualityVideoFile)
)

runnerJobFilesRouter.post(
  [ '/jobs/:jobUUID/files/videos/:videoId/thumbnails/max-quality', '/jobs/:jobUUID/files/videos/:videoId/previews/max-quality' ],
  apiRateLimiter,
  asyncMiddleware(jobOfRunnerGetValidatorFactory([ RunnerJobState.PROCESSING ])),
  asyncMiddleware(runnerJobGetVideoTranscodingFileValidator),
  asyncMiddleware(getMaxQualityVideoThumbnail)
)

// Studio task files are staged in object storage, or stored in the persistent temporary directory
runnerJobFilesRouter.post(
  '/jobs/:jobUUID/files/videos/:videoId/studio/task-files/:filename',
  apiRateLimiter,
  asyncMiddleware(jobOfRunnerGetValidatorFactory([ RunnerJobState.PROCESSING ])),
  asyncMiddleware(runnerJobGetVideoTranscodingFileValidator),
  runnerJobGetVideoStudioTaskFileValidator,
  asyncMiddleware(getVideoStudioTaskFile)
)

// ---------------------------------------------------------------------------

export {
  runnerJobFilesRouter
}

// ---------------------------------------------------------------------------

async function getMaxQualityAudioFile (req: express.Request, res: express.Response) {
  const runnerJob = res.locals.runnerJob
  const runner = runnerJob.Runner
  const video = res.locals.videoFull

  return logger.withContext([ runner.name, runnerJob.id, runnerJob.type ], () => {
    logger.info('Get max quality separated audio file of video %s of job %s for runner %s', video.uuid, runnerJob.uuid, runner.name)

    const file = video.getMaxQualityFile(VideoFileStream.AUDIO) || video.getMaxQualityFile(VideoFileStream.VIDEO)

    return serveVideoFile({ video, file, req, res })
  })
}

async function getMaxQualityVideoFile (req: express.Request, res: express.Response) {
  const runnerJob = res.locals.runnerJob
  const runner = runnerJob.Runner
  const video = res.locals.videoFull

  return logger.withContext([ runner.name, runnerJob.id, runnerJob.type ], () => {
    logger.info('Get max quality file of video %s of job %s for runner %s', video.uuid, runnerJob.uuid, runner.name)

    const file = video.getMaxQualityFile(VideoFileStream.VIDEO) || video.getMaxQualityFile(VideoFileStream.AUDIO)

    return serveVideoFile({ video, file, req, res })
  })
}

async function serveVideoFile (options: {
  video: MVideoFull
  file: MVideoFileVideo | MVideoFileStreamingPlaylistVideo
  req: express.Request
  res: express.Response
}) {
  const { video, file, req, res } = options

  if (file.storage === FileStorage.OBJECT_STORAGE) {
    if (file.isHLS()) {
      return proxifyHLS({
        req,
        res,
        filename: file.filename,
        reinjectVideoFileToken: false,
        video
      })
    }

    // Web video
    return proxifyWebVideoFile({
      req,
      res,
      filename: file.filename
    })
  }

  return VideoPathManager.Instance.makeAvailableVideoFile(file, videoPath => {
    return res.sendFile(videoPath)
  })
}

// ---------------------------------------------------------------------------

async function getMaxQualityVideoThumbnail (req: express.Request, res: express.Response) {
  const runnerJob = res.locals.runnerJob
  const runner = runnerJob.Runner
  const video = res.locals.videoFull

  return logger.withContext([ runner.name, runnerJob.id, runnerJob.type ], async () => {
    logger.info('Get max quality preview file of video %s of job %s for runner %s', video.uuid, runnerJob.uuid, runner.name)

    const thumbnail = video.getBestThumbnail('16:9')

    if (thumbnail.storage === FileStorage.OBJECT_STORAGE) {
      const stream = await buildLocalCommonFileReadStream('thumbnails', thumbnail)

      res.type(extname(thumbnail.filename))

      return pipelineToResponse({ streams: [ stream ], res, logLabel: `runner download of thumbnail ${thumbnail.filename}` })
    }

    return res.sendFile(thumbnail.getFSPath())
  })
}

function getVideoStudioTaskFile (req: express.Request, res: express.Response) {
  const runnerJob = res.locals.runnerJob
  const runner = runnerJob.Runner
  const video = res.locals.videoFull
  const filename = req.params.filename

  return logger.withContext([ runner.name, runnerJob.id, runnerJob.type ], async () => {
    logger.info('Get video studio task file %s of video %s of job %s for runner %s', filename, video.uuid, runnerJob.uuid, runner.name)

    const privatePayload = runnerJob.privatePayload as RunnerJobVideoStudioTranscodingPrivatePayload
    if (!privatePayload.taskFilesStaged) return res.sendFile(getStudioTaskFilePath(filename))

    const stagingKey = privatePayload.originalTasks
      .filter(t => hasVideoStudioTaskFile(t))
      .map(t => t.options.file)
      .find(key => basename(key) === filename)

    if (!stagingKey) {
      logger.error('Studio task file %s of job %s is not in its private payload', filename, runnerJob.uuid)

      return res.fail({
        status: HttpStatusCode.NOT_FOUND_404,
        message: 'Studio task file not found'
      })
    }

    res.type(extname(filename))

    return pipelineToResponse({
      streams: [ await getStagingObjectReadStream(stagingKey) ],
      res,
      logLabel: `runner download of studio task file ${filename}`
    })
  })
}
