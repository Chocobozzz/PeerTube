import * as express from 'express'
import 'express-validator'
import { body, param, query, ValidationChain } from 'express-validator/check'
import { UserRight, VideoChangeOwnershipStatus, VideoPrivacy } from '../../../../shared'
import {
  isBooleanValid,
  isDateValid,
  isIdOrUUIDValid,
  isIdValid,
  isUUIDValid,
  toArray,
  toIntOrNull,
  toValueOrNull
} from '../../../helpers/custom-validators/misc'
import {
  checkUserCanManageVideo,
  isScheduleVideoUpdatePrivacyValid,
  isVideoCategoryValid,
  isVideoArticleidValid,
  isVideoChannelOfAccountExist,
  isVideoDescriptionValid,
  isVideoExist,
  isVideoFile,
  isVideoFilterValid,
  isVideoImage,
  isVideoLanguageValid,
  isVideoLicenceValid,
  isVideoNameValid,
  isVideoPrivacyValid,
  isVideoRatingTypeValid,
  isVideoSupportValid,
  isVideoTagsValid,
  isVideoAutorsValid
} from '../../../helpers/custom-validators/videos'
import { getDurationFromVideoFile } from '../../../helpers/ffmpeg-utils'
import { logger } from '../../../helpers/logger'
import { CONSTRAINTS_FIELDS } from '../../../initializers'
import { VideoShareModel } from '../../../models/video/video-share'
import { authenticate } from '../../oauth'
import { areValidationErrors } from '../utils'
import { cleanUpReqFiles } from '../../../helpers/express-utils'
import { VideoModel } from '../../../models/video/video'
import { UserModel } from '../../../models/account/user'
import { checkUserCanTerminateOwnershipChange, doesChangeVideoOwnershipExist } from '../../../helpers/custom-validators/video-ownership'
import { VideoChangeOwnershipAccept } from '../../../../shared/models/videos/video-change-ownership-accept.model'
import { VideoChangeOwnershipModel } from '../../../models/video/video-change-ownership'
import { AccountModel } from '../../../models/account/account'
import { VideoFetchType } from '../../../helpers/video'
import { isNSFWQueryValid, isNumberArray, isStringArray } from '../../../helpers/custom-validators/search'

const videosAddValidator = getCommonVideoAttributes().concat([
  body('videofile')
    .custom((value, { req }) => isVideoFile(req.files)).withMessage(
      'This file is not supported or too large. Please, make sure it is of the following type: '
      + CONSTRAINTS_FIELDS.VIDEOS.EXTNAME.join(', ')
    ),
  body('name').custom(isVideoNameValid).withMessage('Should have a valid name'),
  body('articleid').custom(isVideoArticleidValid).withMessage('Should have a valid Aticleid'),
  body('channelId')
    .toInt()
    .custom(isIdValid).withMessage('Should have correct video channel id'),

  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    logger.debug('Checking videosAdd parameters', { parameters: req.body, files: req.files })

    if (areValidationErrors(req, res)) return cleanUpReqFiles(req)
    if (areErrorsInScheduleUpdate(req, res)) return cleanUpReqFiles(req)

    const videoFile: Express.Multer.File = req.files['videofile'][0]
    const user = res.locals.oauth.token.User

    if (!await isVideoChannelOfAccountExist(req.body.channelId, user, res)) return cleanUpReqFiles(req)

    const isAble = await user.isAbleToUploadVideo(videoFile)
    if (isAble === false) {
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

    videoFile['duration'] = duration

    return next()
  }
])

const videosUpdateValidator = getCommonVideoAttributes().concat([
  param('id').custom(isIdOrUUIDValid).not().isEmpty().withMessage('Should have a valid id'),
  body('name')
    .optional()
    .custom(isVideoNameValid).withMessage('Should have a valid name'),
  body('channelId')
    .optional()
    .toInt()
    .custom(isIdValid).withMessage('Should have correct video channel id'),

  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    logger.debug('Checking videosUpdate parameters', { parameters: req.body })

    if (areValidationErrors(req, res)) return cleanUpReqFiles(req)
    if (areErrorsInScheduleUpdate(req, res)) return cleanUpReqFiles(req)
    if (!await isVideoExist(req.params.id, res)) return cleanUpReqFiles(req)

    const video = res.locals.video

    // Check if the user who did the request is able to update the video
    const user = res.locals.oauth.token.User
    if (!checkUserCanManageVideo(user, res.locals.video, UserRight.UPDATE_ANY_VIDEO, res)) return cleanUpReqFiles(req)

    if (video.privacy !== VideoPrivacy.PRIVATE && req.body.privacy === VideoPrivacy.PRIVATE) {
      cleanUpReqFiles(req)
      return res.status(409)
        .json({ error: 'Cannot set "private" a video that was not private.' })
    }

    if (req.body.channelId && !await isVideoChannelOfAccountExist(req.body.channelId, user, res)) return cleanUpReqFiles(req)

    return next()
  }
])

const videosCustomGetValidator = (fetchType: VideoFetchType) => {
  return [
    param('id').custom(isIdOrUUIDValid).not().isEmpty().withMessage('Should have a valid id'),

    async (req: express.Request, res: express.Response, next: express.NextFunction) => {
      logger.debug('Checking videosGet parameters', { parameters: req.params })

      if (areValidationErrors(req, res)) return
      if (!await isVideoExist(req.params.id, res, fetchType)) return

      const video: VideoModel = res.locals.video

      // Video private or blacklisted
      if (video.privacy === VideoPrivacy.PRIVATE || video.VideoBlacklist) {
        return authenticate(req, res, () => {
          const user: UserModel = res.locals.oauth.token.User

          // Only the owner or a user that have blacklist rights can see the video
          if (video.VideoChannel.Account.userId !== user.id && !user.hasRight(UserRight.MANAGE_VIDEO_BLACKLIST)) {
            return res.status(403)
                      .json({ error: 'Cannot get this private or blacklisted video.' })
          }

          return next()
        })
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

const videosRemoveValidator = [
  param('id').custom(isIdOrUUIDValid).not().isEmpty().withMessage('Should have a valid id'),

  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    logger.debug('Checking videosRemove parameters', { parameters: req.params })

    if (areValidationErrors(req, res)) return
    if (!await isVideoExist(req.params.id, res)) return

    // Check if the user who did the request is able to delete the video
    if (!checkUserCanManageVideo(res.locals.oauth.token.User, res.locals.video, UserRight.REMOVE_ANY_VIDEO, res)) return

    return next()
  }
]

const videoRateValidator = [
  param('id').custom(isIdOrUUIDValid).not().isEmpty().withMessage('Should have a valid id'),
  body('rating').custom(isVideoRatingTypeValid).withMessage('Should have a valid rate type'),

  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    logger.debug('Checking videoRate parameters', { parameters: req.body })

    if (areValidationErrors(req, res)) return
    if (!await isVideoExist(req.params.id, res)) return

    return next()
  }
]

const videosShareValidator = [
  param('id').custom(isIdOrUUIDValid).not().isEmpty().withMessage('Should have a valid id'),
  param('accountId').custom(isIdValid).not().isEmpty().withMessage('Should have a valid account id'),

  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    logger.debug('Checking videoShare parameters', { parameters: req.params })

    if (areValidationErrors(req, res)) return
    if (!await isVideoExist(req.params.id, res)) return

    const share = await VideoShareModel.load(req.params.accountId, res.locals.video.id, undefined)
    if (!share) {
      return res.status(404)
        .end()
    }

    res.locals.videoShare = share
    return next()
  }
]

const videosChangeOwnershipValidator = [
  param('videoId').custom(isIdOrUUIDValid).not().isEmpty().withMessage('Should have a valid id'),

  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    logger.debug('Checking changeOwnership parameters', { parameters: req.params })

    if (areValidationErrors(req, res)) return
    if (!await isVideoExist(req.params.videoId, res)) return

    // Check if the user who did the request is able to change the ownership of the video
    if (!checkUserCanManageVideo(res.locals.oauth.token.User, res.locals.video, UserRight.CHANGE_VIDEO_OWNERSHIP, res)) return

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

    return next()
  },
  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const videoChangeOwnership = res.locals.videoChangeOwnership as VideoChangeOwnershipModel

    if (videoChangeOwnership.status === VideoChangeOwnershipStatus.WAITING) {
      return next()
    } else {
      res.status(403)
        .json({ error: 'Ownership already accepted or refused' })

      return
    }
  }
]

const videosAcceptChangeOwnershipValidator = [
  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const body = req.body as VideoChangeOwnershipAccept
    if (!await isVideoChannelOfAccountExist(body.channelId, res.locals.oauth.token.User, res)) return

    const user = res.locals.oauth.token.User
    const videoChangeOwnership = res.locals.videoChangeOwnership as VideoChangeOwnershipModel
    const isAble = await user.isAbleToUploadVideo(videoChangeOwnership.Video.getOriginalFile())
    if (isAble === false) {
      res.status(403)
        .json({ error: 'The user video quota is exceeded with this video.' })

      return
    }

    return next()
  }
]

function getCommonVideoAttributes () {
  return [
    body('thumbnailfile')
      .custom((value, { req }) => isVideoImage(req.files, 'thumbnailfile')).withMessage(
      'This thumbnail file is not supported or too large. Please, make sure it is of the following type: '
      + CONSTRAINTS_FIELDS.VIDEOS.IMAGE.EXTNAME.join(', ')
    ),
    body('previewfile')
      .custom((value, { req }) => isVideoImage(req.files, 'previewfile')).withMessage(
      'This preview file is not supported or too large. Please, make sure it is of the following type: '
      + CONSTRAINTS_FIELDS.VIDEOS.IMAGE.EXTNAME.join(', ')
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
      .toBoolean()
      .custom(isBooleanValid).withMessage('Should have a valid NSFW attribute'),
    body('waitTranscoding')
      .optional()
      .toBoolean()
      .custom(isBooleanValid).withMessage('Should have a valid wait transcoding attribute'),
    body('privacy')
      .optional()
      .toInt()
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
    body('autors')
      .optional()
      .customSanitizer(toValueOrNull)
      .custom(isVideoAutorsValid).withMessage('Should have correct autors'),
    body('commentsEnabled')
      .optional()
      .toBoolean()
      .custom(isBooleanValid).withMessage('Should have comments enabled boolean'),

    body('scheduleUpdate')
      .optional()
      .customSanitizer(toValueOrNull),
    body('scheduleUpdate.updateAt')
      .optional()
      .custom(isDateValid).withMessage('Should have a valid schedule update date'),
    body('scheduleUpdate.privacy')
      .optional()
      .toInt()
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
  query('autorsOneOf')
    .optional()
    .customSanitizer(toArray)
    .custom(isStringArray).withMessage('Should have a valid one of autors array'),
  query('autorsAllOf')
    .optional()
    .customSanitizer(toArray)
    .custom(isStringArray).withMessage('Should have a valid all of autors array'),
  query('nsfw')
    .optional()
    .custom(isNSFWQueryValid).withMessage('Should have a valid NSFW attribute'),
  query('filter')
    .optional()
    .custom(isVideoFilterValid).withMessage('Should have a valid filter attribute'),

  (req: express.Request, res: express.Response, next: express.NextFunction) => {
    logger.debug('Checking commons video filters query', { parameters: req.query })

    if (areValidationErrors(req, res)) return

    const user: UserModel = res.locals.oauth ? res.locals.oauth.token.User : undefined
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
  videosCustomGetValidator,
  videosRemoveValidator,
  videosShareValidator,

  videoRateValidator,

  videosChangeOwnershipValidator,
  videosTerminateChangeOwnershipValidator,
  videosAcceptChangeOwnershipValidator,

  getCommonVideoAttributes,

  commonVideosFiltersValidator
}

// ---------------------------------------------------------------------------

function areErrorsInScheduleUpdate (req: express.Request, res: express.Response) {
  if (req.body.scheduleUpdate) {
    if (!req.body.scheduleUpdate.updateAt) {
      res.status(400)
         .json({ error: 'Schedule update at is mandatory.' })

      return true
    }
  }

  return false
}
