import * as express from 'express'
import { body, param, query, ValidationChain } from 'express-validator'
import { UserRight, VideoChangeOwnershipStatus, VideoPrivacy } from '../../../../shared'
import {
  isBooleanValid,
  isDateValid,
  isIdOrUUIDValid,
  isIdValid,
  isUUIDValid,
  toArray,
  toBooleanOrNull,
  toIntOrNull,
  toValueOrNull
} from '../../../helpers/custom-validators/misc'
import {
  isScheduleVideoUpdatePrivacyValid,
  isVideoCategoryValid,
  isVideoDescriptionValid,
  isVideoFile,
  isVideoFilterValid,
  isVideoImage,
  isVideoLanguageValid,
  isVideoLicenceValid,
  isVideoNameValid,
  isVideoOriginallyPublishedAtValid,
  isVideoPrivacyValid,
  isVideoSupportValid,
  isVideoTagsValid
} from '../../../helpers/custom-validators/videos'
import { getDurationFromVideoFile } from '../../../helpers/ffmpeg-utils'
import { logger } from '../../../helpers/logger'
import { CONSTRAINTS_FIELDS, OVERVIEWS } from '../../../initializers/constants'
import { authenticatePromiseIfNeeded } from '../../oauth'
import { areValidationErrors } from '../utils'
import { cleanUpReqFiles } from '../../../helpers/express-utils'
import { VideoModel } from '../../../models/video/video'
import { checkUserCanTerminateOwnershipChange, doesChangeVideoOwnershipExist } from '../../../helpers/custom-validators/video-ownership'
import { VideoChangeOwnershipAccept } from '../../../../shared/models/videos/video-change-ownership-accept.model'
import { AccountModel } from '../../../models/account/account'
import { isNSFWQueryValid, isNumberArray, isStringArray } from '../../../helpers/custom-validators/search'
import { CONFIG } from '../../../initializers/config'
import { isLocalVideoAccepted } from '../../../lib/moderation'
import { Hooks } from '../../../lib/plugins/hooks'
import {
  checkUserCanManageVideo,
  doesVideoChannelOfAccountExist,
  doesVideoExist,
  doesVideoFileOfVideoExist
} from '../../../helpers/middlewares'
import { MVideoFullLight } from '@server/types/models'
import { getVideoWithAttributes } from '../../../helpers/video'
import { getServerActor } from '@server/models/application/application'

const videosAddValidator = getCommonVideoEditAttributes().concat([
  body('videofile')
    .custom((value, { req }) => isVideoFile(req.files)).withMessage(
      'This file is not supported or too large. Please, make sure it is of the following type: ' +
      CONSTRAINTS_FIELDS.VIDEOS.EXTNAME.join(', ')
    ),
  body('name').custom(isVideoNameValid).withMessage('Should have a valid name'),
  body('channelId')
    .customSanitizer(toIntOrNull)
    .custom(isIdValid).withMessage('Should have correct video channel id'),

  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    logger.debug('Checking videosAdd parameters', { parameters: req.body, files: req.files })

    if (areValidationErrors(req, res)) return cleanUpReqFiles(req)
    if (areErrorsInScheduleUpdate(req, res)) return cleanUpReqFiles(req)

    const videoFile: Express.Multer.File & { duration?: number } = req.files['videofile'][0]
    const user = res.locals.oauth.token.User

    if (!await doesVideoChannelOfAccountExist(req.body.channelId, user, res)) return cleanUpReqFiles(req)

    if (await user.isAbleToUploadVideo(videoFile) === false) {
      res.status(403)
         .json({ error: 'The user video quota is exceeded with this video.' })

      return cleanUpReqFiles(req)
    }

    let duration: number

    try {
      duration = await getDurationFromVideoFile(videoFile.path)
    } catch (err) {
      logger.error('Invalid input file in videosAddValidator.', { err })
      res.status(400)
         .json({ error: 'Invalid input file.' })

      return cleanUpReqFiles(req)
    }

    videoFile.duration = duration

    if (!await isVideoAccepted(req, res, videoFile)) return cleanUpReqFiles(req)

    return next()
  }
])

const videosUpdateValidator = getCommonVideoEditAttributes().concat([
  param('id').custom(isIdOrUUIDValid).not().isEmpty().withMessage('Should have a valid id'),
  body('name')
    .optional()
    .custom(isVideoNameValid).withMessage('Should have a valid name'),
  body('channelId')
    .optional()
    .customSanitizer(toIntOrNull)
    .custom(isIdValid).withMessage('Should have correct video channel id'),

  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    logger.debug('Checking videosUpdate parameters', { parameters: req.body })

    if (areValidationErrors(req, res)) return cleanUpReqFiles(req)
    if (areErrorsInScheduleUpdate(req, res)) return cleanUpReqFiles(req)
    if (!await doesVideoExist(req.params.id, res)) return cleanUpReqFiles(req)

    // Check if the user who did the request is able to update the video
    const user = res.locals.oauth.token.User
    if (!checkUserCanManageVideo(user, res.locals.videoAll, UserRight.UPDATE_ANY_VIDEO, res)) return cleanUpReqFiles(req)

    if (req.body.channelId && !await doesVideoChannelOfAccountExist(req.body.channelId, user, res)) return cleanUpReqFiles(req)

    return next()
  }
])

async function checkVideoFollowConstraints (req: express.Request, res: express.Response, next: express.NextFunction) {
  const video = getVideoWithAttributes(res)

  // Anybody can watch local videos
  if (video.isOwned() === true) return next()

  // Logged user
  if (res.locals.oauth) {
    // Users can search or watch remote videos
    if (CONFIG.SEARCH.REMOTE_URI.USERS === true) return next()
  }

  // Anybody can search or watch remote videos
  if (CONFIG.SEARCH.REMOTE_URI.ANONYMOUS === true) return next()

  // Check our instance follows an actor that shared this video
  const serverActor = await getServerActor()
  if (await VideoModel.checkVideoHasInstanceFollow(video.id, serverActor.id) === true) return next()

  return res.status(403)
            .json({
              error: 'Cannot get this video regarding follow constraints.'
            })
}

const videosCustomGetValidator = (
  fetchType: 'all' | 'only-video' | 'only-video-with-rights' | 'only-immutable-attributes',
  authenticateInQuery = false
) => {
  return [
    param('id').custom(isIdOrUUIDValid).not().isEmpty().withMessage('Should have a valid id'),

    async (req: express.Request, res: express.Response, next: express.NextFunction) => {
      logger.debug('Checking videosGet parameters', { parameters: req.params })

      if (areValidationErrors(req, res)) return
      if (!await doesVideoExist(req.params.id, res, fetchType)) return

      // Controllers does not need to check video rights
      if (fetchType === 'only-immutable-attributes') return next()

      const video = getVideoWithAttributes(res)
      const videoAll = video as MVideoFullLight

      // Video private or blacklisted
      if (videoAll.requiresAuth()) {
        await authenticatePromiseIfNeeded(req, res, authenticateInQuery)

        const user = res.locals.oauth ? res.locals.oauth.token.User : null

        // Only the owner or a user that have blacklist rights can see the video
        if (!user || !user.canGetVideo(videoAll)) {
          return res.status(403)
                    .json({ error: 'Cannot get this private/internal or blacklisted video.' })
        }

        return next()
      }

      // Video is public, anyone can access it
      if (video.privacy === VideoPrivacy.PUBLIC) return next()

      // Video is unlisted, check we used the uuid to fetch it
      if (video.privacy === VideoPrivacy.UNLISTED) {
        if (isUUIDValid(req.params.id)) return next()

        // Don't leak this unlisted video
        return res.status(404).end()
      }
    }
  ]
}

const videosGetValidator = videosCustomGetValidator('all')
const videosDownloadValidator = videosCustomGetValidator('all', true)

const videoFileMetadataGetValidator = getCommonVideoEditAttributes().concat([
  param('id').custom(isIdOrUUIDValid).not().isEmpty().withMessage('Should have a valid id'),
  param('videoFileId').custom(isIdValid).not().isEmpty().withMessage('Should have a valid videoFileId'),

  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    logger.debug('Checking videoFileMetadataGet parameters', { parameters: req.params })

    if (areValidationErrors(req, res)) return
    if (!await doesVideoFileOfVideoExist(+req.params.videoFileId, req.params.id, res)) return

    return next()
  }
])

const videosRemoveValidator = [
  param('id').custom(isIdOrUUIDValid).not().isEmpty().withMessage('Should have a valid id'),

  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    logger.debug('Checking videosRemove parameters', { parameters: req.params })

    if (areValidationErrors(req, res)) return
    if (!await doesVideoExist(req.params.id, res)) return

    // Check if the user who did the request is able to delete the video
    if (!checkUserCanManageVideo(res.locals.oauth.token.User, res.locals.videoAll, UserRight.REMOVE_ANY_VIDEO, res)) return

    return next()
  }
]

const videosChangeOwnershipValidator = [
  param('videoId').custom(isIdOrUUIDValid).not().isEmpty().withMessage('Should have a valid id'),

  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    logger.debug('Checking changeOwnership parameters', { parameters: req.params })

    if (areValidationErrors(req, res)) return
    if (!await doesVideoExist(req.params.videoId, res)) return

    // Check if the user who did the request is able to change the ownership of the video
    if (!checkUserCanManageVideo(res.locals.oauth.token.User, res.locals.videoAll, UserRight.CHANGE_VIDEO_OWNERSHIP, res)) return

    const nextOwner = await AccountModel.loadLocalByName(req.body.username)
    if (!nextOwner) {
      res.status(400)
        .json({ error: 'Changing video ownership to a remote account is not supported yet' })

      return
    }
    res.locals.nextOwner = nextOwner

    return next()
  }
]

const videosTerminateChangeOwnershipValidator = [
  param('id').custom(isIdOrUUIDValid).not().isEmpty().withMessage('Should have a valid id'),

  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    logger.debug('Checking changeOwnership parameters', { parameters: req.params })

    if (areValidationErrors(req, res)) return
    if (!await doesChangeVideoOwnershipExist(req.params.id, res)) return

    // Check if the user who did the request is able to change the ownership of the video
    if (!checkUserCanTerminateOwnershipChange(res.locals.oauth.token.User, res.locals.videoChangeOwnership, res)) return

    const videoChangeOwnership = res.locals.videoChangeOwnership

    if (videoChangeOwnership.status !== VideoChangeOwnershipStatus.WAITING) {
      res.status(403)
         .json({ error: 'Ownership already accepted or refused' })
      return
    }

    return next()
  }
]

const videosAcceptChangeOwnershipValidator = [
  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const body = req.body as VideoChangeOwnershipAccept
    if (!await doesVideoChannelOfAccountExist(body.channelId, res.locals.oauth.token.User, res)) return

    const user = res.locals.oauth.token.User
    const videoChangeOwnership = res.locals.videoChangeOwnership
    const isAble = await user.isAbleToUploadVideo(videoChangeOwnership.Video.getMaxQualityFile())
    if (isAble === false) {
      res.status(403)
        .json({ error: 'The user video quota is exceeded with this video.' })

      return
    }

    return next()
  }
]

const videosOverviewValidator = [
  query('page')
    .optional()
    .isInt({ min: 1, max: OVERVIEWS.VIDEOS.SAMPLES_COUNT })
    .withMessage('Should have a valid pagination'),

  (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (areValidationErrors(req, res)) return

    return next()
  }
]

function getCommonVideoEditAttributes () {
  return [
    body('thumbnailfile')
      .custom((value, { req }) => isVideoImage(req.files, 'thumbnailfile')).withMessage(
        'This thumbnail file is not supported or too large. Please, make sure it is of the following type: ' +
        CONSTRAINTS_FIELDS.VIDEOS.IMAGE.EXTNAME.join(', ')
      ),
    body('previewfile')
      .custom((value, { req }) => isVideoImage(req.files, 'previewfile')).withMessage(
        'This preview file is not supported or too large. Please, make sure it is of the following type: ' +
        CONSTRAINTS_FIELDS.VIDEOS.IMAGE.EXTNAME.join(', ')
      ),

    body('category')
      .optional()
      .customSanitizer(toIntOrNull)
      .custom(isVideoCategoryValid).withMessage('Should have a valid category'),
    body('licence')
      .optional()
      .customSanitizer(toIntOrNull)
      .custom(isVideoLicenceValid).withMessage('Should have a valid licence'),
    body('language')
      .optional()
      .customSanitizer(toValueOrNull)
      .custom(isVideoLanguageValid).withMessage('Should have a valid language'),
    body('nsfw')
      .optional()
      .customSanitizer(toBooleanOrNull)
      .custom(isBooleanValid).withMessage('Should have a valid NSFW attribute'),
    body('waitTranscoding')
      .optional()
      .customSanitizer(toBooleanOrNull)
      .custom(isBooleanValid).withMessage('Should have a valid wait transcoding attribute'),
    body('privacy')
      .optional()
      .customSanitizer(toValueOrNull)
      .custom(isVideoPrivacyValid).withMessage('Should have correct video privacy'),
    body('description')
      .optional()
      .customSanitizer(toValueOrNull)
      .custom(isVideoDescriptionValid).withMessage('Should have a valid description'),
    body('support')
      .optional()
      .customSanitizer(toValueOrNull)
      .custom(isVideoSupportValid).withMessage('Should have a valid support text'),
    body('tags')
      .optional()
      .customSanitizer(toValueOrNull)
      .custom(isVideoTagsValid).withMessage('Should have correct tags'),
    body('commentsEnabled')
      .optional()
      .customSanitizer(toBooleanOrNull)
      .custom(isBooleanValid).withMessage('Should have comments enabled boolean'),
    body('downloadEnabled')
      .optional()
      .customSanitizer(toBooleanOrNull)
      .custom(isBooleanValid).withMessage('Should have downloading enabled boolean'),
    body('originallyPublishedAt')
      .optional()
      .customSanitizer(toValueOrNull)
      .custom(isVideoOriginallyPublishedAtValid).withMessage('Should have a valid original publication date'),
    body('scheduleUpdate')
      .optional()
      .customSanitizer(toValueOrNull),
    body('scheduleUpdate.updateAt')
      .optional()
      .custom(isDateValid).withMessage('Should have a valid schedule update date'),
    body('scheduleUpdate.privacy')
      .optional()
      .customSanitizer(toIntOrNull)
      .custom(isScheduleVideoUpdatePrivacyValid).withMessage('Should have correct schedule update privacy')
  ] as (ValidationChain | express.Handler)[]
}

const commonVideosFiltersValidator = [
  query('categoryOneOf')
    .optional()
    .customSanitizer(toArray)
    .custom(isNumberArray).withMessage('Should have a valid one of category array'),
  query('licenceOneOf')
    .optional()
    .customSanitizer(toArray)
    .custom(isNumberArray).withMessage('Should have a valid one of licence array'),
  query('languageOneOf')
    .optional()
    .customSanitizer(toArray)
    .custom(isStringArray).withMessage('Should have a valid one of language array'),
  query('tagsOneOf')
    .optional()
    .customSanitizer(toArray)
    .custom(isStringArray).withMessage('Should have a valid one of tags array'),
  query('tagsAllOf')
    .optional()
    .customSanitizer(toArray)
    .custom(isStringArray).withMessage('Should have a valid all of tags array'),
  query('nsfw')
    .optional()
    .custom(isNSFWQueryValid).withMessage('Should have a valid NSFW attribute'),
  query('filter')
    .optional()
    .custom(isVideoFilterValid).withMessage('Should have a valid filter attribute'),
  query('skipCount')
    .optional()
    .customSanitizer(toBooleanOrNull)
    .custom(isBooleanValid).withMessage('Should have a valid skip count boolean'),

  (req: express.Request, res: express.Response, next: express.NextFunction) => {
    logger.debug('Checking commons video filters query', { parameters: req.query })

    if (areValidationErrors(req, res)) return

    const user = res.locals.oauth ? res.locals.oauth.token.User : undefined
    if (req.query.filter === 'all-local' && (!user || user.hasRight(UserRight.SEE_ALL_VIDEOS) === false)) {
      res.status(401)
         .json({ error: 'You are not allowed to see all local videos.' })

      return
    }

    return next()
  }
]

// ---------------------------------------------------------------------------

export {
  videosAddValidator,
  videosUpdateValidator,
  videosGetValidator,
  videoFileMetadataGetValidator,
  videosDownloadValidator,
  checkVideoFollowConstraints,
  videosCustomGetValidator,
  videosRemoveValidator,

  videosChangeOwnershipValidator,
  videosTerminateChangeOwnershipValidator,
  videosAcceptChangeOwnershipValidator,

  getCommonVideoEditAttributes,

  commonVideosFiltersValidator,

  videosOverviewValidator
}

// ---------------------------------------------------------------------------

function areErrorsInScheduleUpdate (req: express.Request, res: express.Response) {
  if (req.body.scheduleUpdate) {
    if (!req.body.scheduleUpdate.updateAt) {
      logger.warn('Invalid parameters: scheduleUpdate.updateAt is mandatory.')

      res.status(400)
         .json({ error: 'Schedule update at is mandatory.' })

      return true
    }
  }

  return false
}

async function isVideoAccepted (req: express.Request, res: express.Response, videoFile: Express.Multer.File & { duration?: number }) {
  // Check we accept this video
  const acceptParameters = {
    videoBody: req.body,
    videoFile,
    user: res.locals.oauth.token.User
  }
  const acceptedResult = await Hooks.wrapFun(
    isLocalVideoAccepted,
    acceptParameters,
    'filter:api.video.upload.accept.result'
  )

  if (!acceptedResult || acceptedResult.accepted !== true) {
    logger.info('Refused local video.', { acceptedResult, acceptParameters })
    res.status(403)
       .json({ error: acceptedResult.errorMessage || 'Refused local video' })

    return false
  }

  return true
}
