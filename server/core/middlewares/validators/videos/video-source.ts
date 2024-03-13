import { HttpStatusCode, UserRight } from '@peertube/peertube-models'
import { getVideoWithAttributes } from '@server/helpers/video.js'
import { CONFIG } from '@server/initializers/config.js'
import { buildUploadXFile, safeUploadXCleanup } from '@server/lib/uploadx.js'
import { VideoSourceModel } from '@server/models/video/video-source.js'
import { MVideoFullLight } from '@server/types/models/index.js'
import { Metadata as UploadXMetadata } from '@uploadx/core'
import express from 'express'
import { param } from 'express-validator'
import {
  areValidationErrors,
  checkCanAccessVideoSourceFile,
  checkUserCanManageVideo,
  doesVideoExist,
  isValidVideoIdParam
} from '../shared/index.js'
import { addDurationToVideoFileIfNeeded, checkVideoFileCanBeEdited, commonVideoFileChecks, isVideoFileAccepted } from './shared/index.js'

export const videoSourceGetLatestValidator = [
  isValidVideoIdParam('id'),

  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (areValidationErrors(req, res)) return
    if (!await doesVideoExist(req.params.id, res, 'all')) return

    const video = getVideoWithAttributes(res) as MVideoFullLight

    const user = res.locals.oauth.token.User
    if (!checkUserCanManageVideo(user, video, UserRight.UPDATE_ANY_VIDEO, res)) return

    res.locals.videoSource = await VideoSourceModel.loadLatest(video.id)

    if (!res.locals.videoSource) {
      return res.fail({
        status: HttpStatusCode.NOT_FOUND_404,
        message: 'Video source not found'
      })
    }

    return next()
  }
]

export const replaceVideoSourceResumableValidator = [
  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const file = buildUploadXFile(req.body as express.CustomUploadXFile<UploadXMetadata>)
    const cleanup = () => safeUploadXCleanup(file)

    if (!await checkCanUpdateVideoFile({ req, res })) {
      return cleanup()
    }

    if (!await addDurationToVideoFileIfNeeded({ videoFile: file, res, middlewareName: 'updateVideoFileResumableValidator' })) {
      return cleanup()
    }

    if (!await isVideoFileAccepted({ req, res, videoFile: file, hook: 'filter:api.video.update-file.accept.result' })) {
      return cleanup()
    }

    res.locals.updateVideoFileResumable = { ...file, originalname: file.filename }

    return next()
  }
]

export const replaceVideoSourceResumableInitValidator = [
  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const user = res.locals.oauth.token.User

    if (!await checkCanUpdateVideoFile({ req, res })) return

    const fileMetadata = res.locals.uploadVideoFileResumableMetadata
    const files = { videofile: [ fileMetadata ] }
    if (await commonVideoFileChecks({ res, user, videoFileSize: fileMetadata.size, files }) === false) return

    return next()
  }
]

export const originalVideoFileDownloadValidator = [
  param('filename').exists(),

  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (areValidationErrors(req, res)) return

    const videoSource = await VideoSourceModel.loadByKeptOriginalFilename(req.params.filename)
    if (!videoSource) {
      return res.fail({
        status: HttpStatusCode.NOT_FOUND_404,
        message: 'Original video file not found'
      })
    }

    if (!await checkCanAccessVideoSourceFile({ req, res, videoId: videoSource.videoId })) return

    res.locals.videoSource = videoSource

    return next()
  }
]

// ---------------------------------------------------------------------------
// Private
// ---------------------------------------------------------------------------

async function checkCanUpdateVideoFile (options: {
  req: express.Request
  res: express.Response
}) {
  const { req, res } = options

  if (!CONFIG.VIDEO_FILE.UPDATE.ENABLED) {
    res.fail({
      status: HttpStatusCode.FORBIDDEN_403,
      message: 'Updating the file of an existing video is not allowed on this instance'
    })
    return false
  }

  if (!await doesVideoExist(req.params.id, res)) return false

  const user = res.locals.oauth.token.User
  const video = res.locals.videoAll

  if (!checkUserCanManageVideo(user, video, UserRight.UPDATE_ANY_VIDEO, res)) return false

  if (!checkVideoFileCanBeEdited(video, res)) return false

  return true
}
