import express from 'express'
import { logger, loggerTagsFactory } from '@server/helpers/logger'
import { proxifyHLS, proxifyWebTorrentFile } from '@server/lib/object-storage'
import { VideoPathManager } from '@server/lib/video-path-manager'
import { getStudioTaskFilePath } from '@server/lib/video-studio'
import { apiRateLimiter, asyncMiddleware } from '@server/middlewares'
import { jobOfRunnerGetValidator } from '@server/middlewares/validators/runners'
import {
  runnerJobGetVideoStudioTaskFileValidator,
  runnerJobGetVideoTranscodingFileValidator
} from '@server/middlewares/validators/runners/job-files'
import { VideoStorage } from '@shared/models'

const lTags = loggerTagsFactory('api', 'runner')

const runnerJobFilesRouter = express.Router()

runnerJobFilesRouter.post('/jobs/:jobUUID/files/videos/:videoId/max-quality',
  apiRateLimiter,
  asyncMiddleware(jobOfRunnerGetValidator),
  asyncMiddleware(runnerJobGetVideoTranscodingFileValidator),
  asyncMiddleware(getMaxQualityVideoFile)
)

runnerJobFilesRouter.post('/jobs/:jobUUID/files/videos/:videoId/previews/max-quality',
  apiRateLimiter,
  asyncMiddleware(jobOfRunnerGetValidator),
  asyncMiddleware(runnerJobGetVideoTranscodingFileValidator),
  getMaxQualityVideoPreview
)

runnerJobFilesRouter.post('/jobs/:jobUUID/files/videos/:videoId/studio/task-files/:filename',
  apiRateLimiter,
  asyncMiddleware(jobOfRunnerGetValidator),
  asyncMiddleware(runnerJobGetVideoTranscodingFileValidator),
  runnerJobGetVideoStudioTaskFileValidator,
  getVideoStudioTaskFile
)

// ---------------------------------------------------------------------------

export {
  runnerJobFilesRouter
}

// ---------------------------------------------------------------------------

async function getMaxQualityVideoFile (req: express.Request, res: express.Response) {
  const runnerJob = res.locals.runnerJob
  const runner = runnerJob.Runner
  const video = res.locals.videoAll

  logger.info(
    'Get max quality file of video %s of job %s for runner %s', video.uuid, runnerJob.uuid, runner.name,
    lTags(runner.name, runnerJob.id, runnerJob.type)
  )

  const file = video.getMaxQualityFile()

  if (file.storage === VideoStorage.OBJECT_STORAGE) {
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
    return proxifyWebTorrentFile({
      req,
      res,
      filename: file.filename
    })
  }

  return VideoPathManager.Instance.makeAvailableVideoFile(file, videoPath => {
    return res.sendFile(videoPath)
  })
}

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
