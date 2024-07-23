import { FileStorage, RunnerJobState, VideoFileStream } from '@peertube/peertube-models'
import { logger, loggerTagsFactory } from '@server/helpers/logger.js'
import { proxifyHLS, proxifyWebVideoFile } from '@server/lib/object-storage/index.js'
import { VideoPathManager } from '@server/lib/video-path-manager.js'
import { getStudioTaskFilePath } from '@server/lib/video-studio.js'
import { apiRateLimiter, asyncMiddleware } from '@server/middlewares/index.js'
import { jobOfRunnerGetValidatorFactory } from '@server/middlewares/validators/runners/index.js'
import {
  runnerJobGetVideoStudioTaskFileValidator,
  runnerJobGetVideoTranscodingFileValidator
} from '@server/middlewares/validators/runners/job-files.js'
import { MVideoFileStreamingPlaylistVideo, MVideoFileVideo, MVideoFullLight } from '@server/types/models/index.js'
import express from 'express'

const lTags = loggerTagsFactory('api', 'runner')

const runnerJobFilesRouter = express.Router()

runnerJobFilesRouter.post('/jobs/:jobUUID/files/videos/:videoId/max-quality/audio',
  apiRateLimiter,
  asyncMiddleware(jobOfRunnerGetValidatorFactory([ RunnerJobState.PROCESSING ])),
  asyncMiddleware(runnerJobGetVideoTranscodingFileValidator),
  asyncMiddleware(getMaxQualitySeparatedAudioFile)
)

runnerJobFilesRouter.post('/jobs/:jobUUID/files/videos/:videoId/max-quality',
  apiRateLimiter,
  asyncMiddleware(jobOfRunnerGetValidatorFactory([ RunnerJobState.PROCESSING ])),
  asyncMiddleware(runnerJobGetVideoTranscodingFileValidator),
  asyncMiddleware(getMaxQualityVideoFile)
)

runnerJobFilesRouter.post('/jobs/:jobUUID/files/videos/:videoId/previews/max-quality',
  apiRateLimiter,
  asyncMiddleware(jobOfRunnerGetValidatorFactory([ RunnerJobState.PROCESSING ])),
  asyncMiddleware(runnerJobGetVideoTranscodingFileValidator),
  getMaxQualityVideoPreview
)

runnerJobFilesRouter.post('/jobs/:jobUUID/files/videos/:videoId/studio/task-files/:filename',
  apiRateLimiter,
  asyncMiddleware(jobOfRunnerGetValidatorFactory([ RunnerJobState.PROCESSING ])),
  asyncMiddleware(runnerJobGetVideoTranscodingFileValidator),
  runnerJobGetVideoStudioTaskFileValidator,
  getVideoStudioTaskFile
)

// ---------------------------------------------------------------------------

export {
  runnerJobFilesRouter
}

// ---------------------------------------------------------------------------

async function getMaxQualitySeparatedAudioFile (req: express.Request, res: express.Response) {
  const runnerJob = res.locals.runnerJob
  const runner = runnerJob.Runner
  const video = res.locals.videoAll

  logger.info(
    'Get max quality separated audio file of video %s of job %s for runner %s', video.uuid, runnerJob.uuid, runner.name,
    lTags(runner.name, runnerJob.id, runnerJob.type)
  )

  const file = video.getMaxQualityFile(VideoFileStream.AUDIO) || video.getMaxQualityFile(VideoFileStream.VIDEO)

  return serveVideoFile({ video, file, req, res })
}

async function getMaxQualityVideoFile (req: express.Request, res: express.Response) {
  const runnerJob = res.locals.runnerJob
  const runner = runnerJob.Runner
  const video = res.locals.videoAll

  logger.info(
    'Get max quality file of video %s of job %s for runner %s', video.uuid, runnerJob.uuid, runner.name,
    lTags(runner.name, runnerJob.id, runnerJob.type)
  )

  const file = video.getMaxQualityFile(VideoFileStream.VIDEO) || video.getMaxQualityFile(VideoFileStream.AUDIO)

  return serveVideoFile({ video, file, req, res })
}

async function serveVideoFile (options: {
  video: MVideoFullLight
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
        playlist: video.getHLSPlaylist(),
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

function getMaxQualityVideoPreview (req: express.Request, res: express.Response) {
  const runnerJob = res.locals.runnerJob
  const runner = runnerJob.Runner
  const video = res.locals.videoAll

  logger.info(
    'Get max quality preview file of video %s of job %s for runner %s', video.uuid, runnerJob.uuid, runner.name,
    lTags(runner.name, runnerJob.id, runnerJob.type)
  )

  const file = video.getPreview()

  return res.sendFile(file.getPath())
}

function getVideoStudioTaskFile (req: express.Request, res: express.Response) {
  const runnerJob = res.locals.runnerJob
  const runner = runnerJob.Runner
  const video = res.locals.videoAll
  const filename = req.params.filename

  logger.info(
    'Get video studio task file %s of video %s of job %s for runner %s', filename, video.uuid, runnerJob.uuid, runner.name,
    lTags(runner.name, runnerJob.id, runnerJob.type)
  )

  return res.sendFile(getStudioTaskFilePath(filename))
}
