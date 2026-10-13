import { HttpStatusCode, UserRight } from '@peertube/peertube-models'
import { createLogger } from '@server/helpers/logger.js'
import { CONFIG } from '@server/initializers/config.js'
import { Redis } from '@server/lib/redis/index.js'
import { buildVideoUploadXFile, makeUploadXFileAvailableForHookIfNeeded, safeUploadXCleanup, videoUploadx } from '@server/lib/uploadx.js'
import { VideoSourceModel } from '@server/models/video/video-source.js'
import { Metadata as UploadXMetadata } from '@uploadx/core'
import express from 'express'
import { param } from 'express-validator'
import { checkUploadSessionCanStart } from '../resumable-upload.js'
import {
  areValidationErrors,
  checkCanAccessVideoSourceFile,
  checkCanManageVideo,
  doesVideoExist,
  isValidVideoIdParam
} from '../shared/index.js'
import { addDurationToVideoFileIfNeeded, checkVideoFileCanBeEdited, commonVideoFileChecks, isVideoFileAccepted } from './shared/index.js'

const logger = createLogger()

export const videoSourceGetLatestValidator = [
  isValidVideoIdParam('id'),

  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (areValidationErrors(req, res)) return
    if (!await doesVideoExist(req.params.id, res, 'with-rights')) return

    const video = res.locals.videoWithRights

    const user = res.locals.oauth.token.User
    if (!await checkCanManageVideo({ user, video, right: UserRight.UPDATE_ANY_VIDEO, req, res, checkIsLocal: true, checkIsOwner: false })) {
      return
    }

    res.locals.videoSource = await VideoSourceModel.loadLatest(video.id)

    if (!res.locals.videoSource) {
      return res.fail({
        status: HttpStatusCode.NOT_FOUND_404,
        message: req.t('Video source not found')
      })
    }

    return next()
  }
]

export const replaceVideoSourceResumableValidator = [
  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (!await checkUploadSessionCanStart(req, res)) return

    const file = await buildVideoUploadXFile(req.body as express.CustomUploadXFile<UploadXMetadata>)
    const cleanup = () => {
      safeUploadXCleanup(file, videoUploadx)

      Redis.Instance.deleteUploadSession(req.query.upload_id)
        .catch(err => logger.error('Cannot delete upload session', { err }))
    }

    if (!await checkCanUpdateVideoFile({ req, res })) {
      return cleanup()
    }

    try {
      await makeUploadXFileAvailableForHookIfNeeded(file, 'filter:api.video.update-file.accept.result')
    } catch (err) {
      cleanup()
      throw err
    }

    if (!await addDurationToVideoFileIfNeeded({ uploadFile: file, res, middlewareName: 'updateVideoFileResumableValidator' })) {
      return cleanup()
    }

    if (
      !await isVideoFileAccepted({
        req,
        res,
        uploadFile: file,
        videoBody: file.metadata,
        hook: 'filter:api.video.update-file.accept.result'
      })
    ) {
      return cleanup()
    }

    res.locals.updateVideoFileResumable = { ...file, originalname: file.filename }

    return next()
  }
]

export const replaceVideoSourceResumableInitValidator = [
  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (!await checkCanUpdateVideoFile({ req, res })) return

    const fileMetadata = res.locals.uploadVideoFileResumableMetadata
    const files = { videofile: [ fileMetadata ] }
    const channelUser = { id: res.locals.videoFull.VideoChannel.Account.userId }

    if (await commonVideoFileChecks({ req, res, channelUser, videoFileSize: fileMetadata.size, files }) === false) return

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
        message: req.t('Original video file not found')
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
      message: req.t('Updating the file of an existing video is not allowed on this instance')
    })
    return false
  }

  if (!await doesVideoExist(req.params.id, res)) return false

  const user = res.locals.oauth.token.User
  const video = res.locals.videoFull

  if (!await checkCanManageVideo({ user, video, right: UserRight.UPDATE_ANY_VIDEO, req, res, checkIsLocal: true, checkIsOwner: false })) {
    return false
  }

  if (!checkVideoFileCanBeEdited(video, req, res)) return false

  return true
}
