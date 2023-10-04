import express from 'express'
import { body, header } from 'express-validator'
import { getResumableUploadPath } from '@server/helpers/upload.js'
import { getVideoWithAttributes } from '@server/helpers/video.js'
import { CONFIG } from '@server/initializers/config.js'
import { uploadx } from '@server/lib/uploadx.js'
import { VideoSourceModel } from '@server/models/video/video-source.js'
import { MVideoFullLight } from '@server/types/models/index.js'
import { HttpStatusCode, UserRight } from '@peertube/peertube-models'
import { Metadata as UploadXMetadata } from '@uploadx/core'
import { logger } from '../../../helpers/logger.js'
import { areValidationErrors, checkUserCanManageVideo, doesVideoExist, isValidVideoIdParam } from '../shared/index.js'
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
    const body: express.CustomUploadXFile<UploadXMetadata> = req.body
    const file = { ...body, duration: undefined, path: getResumableUploadPath(body.name), filename: body.metadata.filename }
    const cleanup = () => uploadx.storage.delete(file).catch(err => logger.error('Cannot delete the file %s', file.name, { err }))

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
  body('filename')
    .exists(),

  header('x-upload-content-length')
    .isNumeric()
    .exists()
    .withMessage('Should specify the file length'),
  header('x-upload-content-type')
    .isString()
    .exists()
    .withMessage('Should specify the file mimetype'),

  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const user = res.locals.oauth.token.User

    logger.debug('Checking updateVideoFileResumableInitValidator parameters and headers', {
      parameters: req.body,
      headers: req.headers
    })

    if (areValidationErrors(req, res, { omitLog: true })) return

    if (!await checkCanUpdateVideoFile({ req, res })) return

    const videoFileMetadata = {
      mimetype: req.headers['x-upload-content-type'] as string,
      size: +req.headers['x-upload-content-length'],
      originalname: req.body.filename
    }

    const files = { videofile: [ videoFileMetadata ] }
    if (await commonVideoFileChecks({ res, user, videoFileSize: videoFileMetadata.size, files }) === false) return

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
