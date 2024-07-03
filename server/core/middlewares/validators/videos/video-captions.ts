import { HttpStatusCode, ServerErrorCode, UserRight, VideoCaptionGenerate } from '@peertube/peertube-models'
import { isBooleanValid, toBooleanOrNull } from '@server/helpers/custom-validators/misc.js'
import { CONFIG } from '@server/initializers/config.js'
import { VideoCaptionModel } from '@server/models/video/video-caption.js'
import { VideoJobInfoModel } from '@server/models/video/video-job-info.js'
import express from 'express'
import { body, param } from 'express-validator'
import { isVideoCaptionFile, isVideoCaptionLanguageValid } from '../../../helpers/custom-validators/video-captions.js'
import { cleanUpReqFiles } from '../../../helpers/express-utils.js'
import { CONSTRAINTS_FIELDS, MIMETYPES } from '../../../initializers/constants.js'
import {
  areValidationErrors,
  checkCanSeeVideo,
  checkUserCanManageVideo,
  doesVideoCaptionExist,
  doesVideoExist,
  isValidVideoIdParam,
  isValidVideoPasswordHeader
} from '../shared/index.js'
import { checkVideoCanBeTranscribedOrTranscripted } from './shared/video-validators.js'

export const addVideoCaptionValidator = [
  isValidVideoIdParam('videoId'),

  param('captionLanguage')
    .custom(isVideoCaptionLanguageValid).not().isEmpty(),

  body('captionfile')
    .custom((_, { req }) => isVideoCaptionFile(req.files, 'captionfile'))
    .withMessage(
      'This caption file is not supported or too large. ' +
      `Please, make sure it is under ${CONSTRAINTS_FIELDS.VIDEO_CAPTIONS.CAPTION_FILE.FILE_SIZE.max} bytes ` +
      'and one of the following mimetypes: ' +
      Object.keys(MIMETYPES.VIDEO_CAPTIONS.MIMETYPE_EXT).map(key => `${key} (${MIMETYPES.VIDEO_CAPTIONS.MIMETYPE_EXT[key]})`).join(', ')
    ),

  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (areValidationErrors(req, res)) return cleanUpReqFiles(req)
    if (!await doesVideoExist(req.params.videoId, res)) return cleanUpReqFiles(req)

    // Check if the user who did the request is able to update the video
    const user = res.locals.oauth.token.User
    if (!checkUserCanManageVideo(user, res.locals.videoAll, UserRight.UPDATE_ANY_VIDEO, res)) return cleanUpReqFiles(req)

    return next()
  }
]

export const generateVideoCaptionValidator = [
  isValidVideoIdParam('videoId'),

  body('forceTranscription')
    .optional()
    .customSanitizer(toBooleanOrNull)
    .custom(isBooleanValid),

  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (areValidationErrors(req, res)) return

    if (CONFIG.VIDEO_TRANSCRIPTION.ENABLED !== true) {
      return res.fail({
        status: HttpStatusCode.BAD_REQUEST_400,
        message: 'Video transcription is disabled on this instance'
      })
    }

    if (!await doesVideoExist(req.params.videoId, res)) return

    const video = res.locals.videoAll

    if (!checkVideoCanBeTranscribedOrTranscripted(video, res)) return

    // Check if the user who did the request is able to update the video
    const user = res.locals.oauth.token.User
    if (!checkUserCanManageVideo(user, video, UserRight.UPDATE_ANY_VIDEO, res)) return

    // Check the video has not already a caption
    const captions = await VideoCaptionModel.listVideoCaptions(video.id)
    if (captions.length !== 0) {
      return res.fail({
        status: HttpStatusCode.BAD_REQUEST_400,
        type: ServerErrorCode.VIDEO_ALREADY_HAS_CAPTIONS,
        message: 'This video already has captions'
      })
    }

    // Bypass "video is already transcribed" check
    const body = req.body as VideoCaptionGenerate
    if (body.forceTranscription === true) {
      if (user.hasRight(UserRight.UPDATE_ANY_VIDEO) !== true) {
        return res.fail({
          status: HttpStatusCode.FORBIDDEN_403,
          message: 'Only admins can force transcription'
        })
      }

      return next()
    }

    const info = await VideoJobInfoModel.load(video.id)
    if (info && info.pendingTranscription > 0) {
      return res.fail({
        status: HttpStatusCode.CONFLICT_409,
        type: ServerErrorCode.VIDEO_ALREADY_BEING_TRANSCRIBED,
        message: 'This video is already being transcribed'
      })
    }

    return next()
  }
]

export const deleteVideoCaptionValidator = [
  isValidVideoIdParam('videoId'),

  param('captionLanguage')
    .custom(isVideoCaptionLanguageValid).not().isEmpty().withMessage('Should have a valid caption language'),

  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (areValidationErrors(req, res)) return
    if (!await doesVideoExist(req.params.videoId, res)) return
    if (!await doesVideoCaptionExist(res.locals.videoAll, req.params.captionLanguage, res)) return

    // Check if the user who did the request is able to update the video
    const user = res.locals.oauth.token.User
    if (!checkUserCanManageVideo(user, res.locals.videoAll, UserRight.UPDATE_ANY_VIDEO, res)) return

    return next()
  }
]

export const listVideoCaptionsValidator = [
  isValidVideoIdParam('videoId'),

  isValidVideoPasswordHeader(),

  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (areValidationErrors(req, res)) return
    if (!await doesVideoExist(req.params.videoId, res, 'only-video-and-blacklist')) return

    const video = res.locals.onlyVideo
    if (!await checkCanSeeVideo({ req, res, video, paramId: req.params.videoId })) return

    return next()
  }
]
