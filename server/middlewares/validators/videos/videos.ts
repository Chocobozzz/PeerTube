import * as express from 'express'
import { body, header, param, query, ValidationChain } from 'express-validator'
import { getResumableUploadPath } from '@server/helpers/upload'
import { isAbleToUploadVideo } from '@server/lib/user'
import { getServerActor } from '@server/models/application/application'
import { ExpressPromiseHandler } from '@server/types/express'
import { MUserAccountId, MVideoFullLight } from '@server/types/models'
import { ServerErrorCode, UserRight, VideoPrivacy } from '../../../../shared'
import { HttpStatusCode } from '../../../../shared/core-utils/miscs/http-error-codes'
import {
  exists,
  isBooleanValid,
  isDateValid,
  isFileFieldValid,
  isIdValid,
  isUUIDValid,
  toArray,
  toBooleanOrNull,
  toIntOrNull,
  toValueOrNull
} from '../../../helpers/custom-validators/misc'
import { isBooleanBothQueryValid, isNumberArray, isStringArray } from '../../../helpers/custom-validators/search'
import {
  isScheduleVideoUpdatePrivacyValid,
  isVideoCategoryValid,
  isVideoDescriptionValid,
  isVideoFileMimeTypeValid,
  isVideoFileSizeValid,
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
import { cleanUpReqFiles } from '../../../helpers/express-utils'
import { getDurationFromVideoFile } from '../../../helpers/ffprobe-utils'
import { logger } from '../../../helpers/logger'
import { deleteFileAndCatch } from '../../../helpers/utils'
import { getVideoWithAttributes } from '../../../helpers/video'
import { CONFIG } from '../../../initializers/config'
import { CONSTRAINTS_FIELDS, OVERVIEWS } from '../../../initializers/constants'
import { isLocalVideoAccepted } from '../../../lib/moderation'
import { Hooks } from '../../../lib/plugins/hooks'
import { VideoModel } from '../../../models/video/video'
import { authenticatePromiseIfNeeded } from '../../auth'
import {
  areValidationErrors,
  checkUserCanManageVideo,
  doesVideoChannelOfAccountExist,
  doesVideoExist,
  doesVideoFileOfVideoExist,
  isValidVideoIdParam
} from '../shared'

const videosAddLegacyValidator = getCommonVideoEditAttributes().concat([
  body('videofile')
    .custom((value, { req }) => isFileFieldValid(req.files, 'videofile'))
    .withMessage('Should have a file'),
  body('name')
    .trim()
    .custom(isVideoNameValid).withMessage(
      `Should have a video name between ${CONSTRAINTS_FIELDS.VIDEOS.NAME.min} and ${CONSTRAINTS_FIELDS.VIDEOS.NAME.max} characters long`
    ),
  body('channelId')
    .customSanitizer(toIntOrNull)
    .custom(isIdValid).withMessage('Should have correct video channel id'),

  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    logger.debug('Checking videosAdd parameters', { parameters: req.body, files: req.files })

    if (areValidationErrors(req, res)) return cleanUpReqFiles(req)

    const videoFile: express.VideoUploadFile = req.files['videofile'][0]
    const user = res.locals.oauth.token.User

    if (!await commonVideoChecksPass({ req, res, user, videoFileSize: videoFile.size, files: req.files })) {
      return cleanUpReqFiles(req)
    }

    try {
      if (!videoFile.duration) await addDurationToVideo(videoFile)
    } catch (err) {
      logger.error('Invalid input file in videosAddLegacyValidator.', { err })

      res.fail({
        status: HttpStatusCode.UNPROCESSABLE_ENTITY_422,
        message: 'Video file unreadable.'
      })
      return cleanUpReqFiles(req)
    }

    if (!await isVideoAccepted(req, res, videoFile)) return cleanUpReqFiles(req)

    return next()
  }
])

/**
 * Gets called after the last PUT request
 */
const videosAddResumableValidator = [
  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const user = res.locals.oauth.token.User

    const body: express.CustomUploadXFile<express.UploadXFileMetadata> = req.body
    const file = { ...body, duration: undefined, path: getResumableUploadPath(body.id), filename: body.metadata.filename }

    const cleanup = () => deleteFileAndCatch(file.path)

    if (!await doesVideoChannelOfAccountExist(file.metadata.channelId, user, res)) return cleanup()

    try {
      if (!file.duration) await addDurationToVideo(file)
    } catch (err) {
      logger.error('Invalid input file in videosAddResumableValidator.', { err })

      res.fail({
        status: HttpStatusCode.UNPROCESSABLE_ENTITY_422,
        message: 'Video file unreadable.'
      })
      return cleanup()
    }

    if (!await isVideoAccepted(req, res, file)) return cleanup()

    res.locals.videoFileResumable = file

    return next()
  }
]

/**
 * File is created in POST initialisation, and its body is saved as a 'metadata' field is saved by uploadx for later use.
 * see https://github.com/kukhariev/node-uploadx/blob/dc9fb4a8ac5a6f481902588e93062f591ec6ef03/packages/core/src/handlers/uploadx.ts
 *
 * Uploadx doesn't use next() until the upload completes, so this middleware has to be placed before uploadx
 * see https://github.com/kukhariev/node-uploadx/blob/dc9fb4a8ac5a6f481902588e93062f591ec6ef03/packages/core/src/handlers/base-handler.ts
 *
 */
const videosAddResumableInitValidator = getCommonVideoEditAttributes().concat([
  body('filename')
    .isString()
    .exists()
    .withMessage('Should have a valid filename'),
  body('name')
    .trim()
    .custom(isVideoNameValid).withMessage(
      `Should have a video name between ${CONSTRAINTS_FIELDS.VIDEOS.NAME.min} and ${CONSTRAINTS_FIELDS.VIDEOS.NAME.max} characters long`
    ),
  body('channelId')
    .customSanitizer(toIntOrNull)
    .custom(isIdValid).withMessage('Should have correct video channel id'),

  header('x-upload-content-length')
    .isNumeric()
    .exists()
    .withMessage('Should specify the file length'),
  header('x-upload-content-type')
    .isString()
    .exists()
    .withMessage('Should specify the file mimetype'),

  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const videoFileMetadata = {
      mimetype: req.headers['x-upload-content-type'] as string,
      size: +req.headers['x-upload-content-length'],
      originalname: req.body.name
    }

    const user = res.locals.oauth.token.User
    const cleanup = () => cleanUpReqFiles(req)

    logger.debug('Checking videosAddResumableInitValidator parameters and headers', {
      parameters: req.body,
      headers: req.headers,
      files: req.files
    })

    if (areValidationErrors(req, res)) return cleanup()

    const files = { videofile: [ videoFileMetadata ] }
    if (!await commonVideoChecksPass({ req, res, user, videoFileSize: videoFileMetadata.size, files })) return cleanup()

    // multer required unsetting the Content-Type, now we can set it for node-uploadx
    req.headers['content-type'] = 'application/json; charset=utf-8'
    // place previewfile in metadata so that uploadx saves it in .META
    if (req.files['previewfile']) req.body.previewfile = req.files['previewfile']

    return next()
  }
])

const videosUpdateValidator = getCommonVideoEditAttributes().concat([
  isValidVideoIdParam('id'),

  body('name')
    .optional()
    .trim()
    .custom(isVideoNameValid).withMessage(
      `Should have a video name between ${CONSTRAINTS_FIELDS.VIDEOS.NAME.min} and ${CONSTRAINTS_FIELDS.VIDEOS.NAME.max} characters long`
    ),
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

  return res.fail({
    status: HttpStatusCode.FORBIDDEN_403,
    message: 'Cannot get this video regarding follow constraints',
    type: ServerErrorCode.DOES_NOT_RESPECT_FOLLOW_CONSTRAINTS,
    data: {
      originUrl: video.url
    }
  })
}

const videosCustomGetValidator = (
  fetchType: 'for-api' | 'all' | 'only-video' | 'only-immutable-attributes',
  authenticateInQuery = false
) => {
  return [
    isValidVideoIdParam('id'),

    async (req: express.Request, res: express.Response, next: express.NextFunction) => {
      logger.debug('Checking videosGet parameters', { parameters: req.params })

      if (areValidationErrors(req, res)) return
      if (!await doesVideoExist(req.params.id, res, fetchType)) return

      // Controllers does not need to check video rights
      if (fetchType === 'only-immutable-attributes') return next()

      const video = getVideoWithAttributes(res) as MVideoFullLight

      // Video private or blacklisted
      if (video.requiresAuth()) {
        await authenticatePromiseIfNeeded(req, res, authenticateInQuery)

        const user = res.locals.oauth ? res.locals.oauth.token.User : null

        // Only the owner or a user that have blocklist rights can see the video
        if (!user || !user.canGetVideo(video)) {
          return res.fail({
            status: HttpStatusCode.FORBIDDEN_403,
            message: 'Cannot get this private/internal or blocklisted video'
          })
        }

        return next()
      }

      // Video is public, anyone can access it
      if (video.privacy === VideoPrivacy.PUBLIC) return next()

      // Video is unlisted, check we used the uuid to fetch it
      if (video.privacy === VideoPrivacy.UNLISTED) {
        if (isUUIDValid(req.params.id)) return next()

        // Don't leak this unlisted video
        return res.fail({
          status: HttpStatusCode.NOT_FOUND_404,
          message: 'Video not found'
        })
      }
    }
  ]
}

const videosGetValidator = videosCustomGetValidator('all')
const videosDownloadValidator = videosCustomGetValidator('all', true)

const videoFileMetadataGetValidator = getCommonVideoEditAttributes().concat([
  isValidVideoIdParam('id'),

  param('videoFileId')
    .custom(isIdValid).not().isEmpty().withMessage('Should have a valid videoFileId'),

  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    logger.debug('Checking videoFileMetadataGet parameters', { parameters: req.params })

    if (areValidationErrors(req, res)) return
    if (!await doesVideoFileOfVideoExist(+req.params.videoFileId, req.params.id, res)) return

    return next()
  }
])

const videosRemoveValidator = [
  isValidVideoIdParam('id'),

  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    logger.debug('Checking videosRemove parameters', { parameters: req.params })

    if (areValidationErrors(req, res)) return
    if (!await doesVideoExist(req.params.id, res)) return

    // Check if the user who did the request is able to delete the video
    if (!checkUserCanManageVideo(res.locals.oauth.token.User, res.locals.videoAll, UserRight.REMOVE_ANY_VIDEO, res)) return

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
      .custom(isVideoTagsValid)
      .withMessage(
        `Should have an array of up to ${CONSTRAINTS_FIELDS.VIDEOS.TAGS.max} tags between ` +
        `${CONSTRAINTS_FIELDS.VIDEOS.TAG.min} and ${CONSTRAINTS_FIELDS.VIDEOS.TAG.max} characters each`
      ),
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
      .custom(isDateValid).withMessage('Should have a schedule update date that conforms to ISO 8601'),
    body('scheduleUpdate.privacy')
      .optional()
      .customSanitizer(toIntOrNull)
      .custom(isScheduleVideoUpdatePrivacyValid).withMessage('Should have correct schedule update privacy')
  ] as (ValidationChain | ExpressPromiseHandler)[]
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
    .custom(isBooleanBothQueryValid).withMessage('Should have a valid NSFW attribute'),
  query('isLive')
    .optional()
    .customSanitizer(toBooleanOrNull)
    .custom(isBooleanValid).withMessage('Should have a valid live boolean'),
  query('filter')
    .optional()
    .custom(isVideoFilterValid).withMessage('Should have a valid filter attribute'),
  query('skipCount')
    .optional()
    .customSanitizer(toBooleanOrNull)
    .custom(isBooleanValid).withMessage('Should have a valid skip count boolean'),
  query('search')
    .optional()
    .custom(exists).withMessage('Should have a valid search'),

  (req: express.Request, res: express.Response, next: express.NextFunction) => {
    logger.debug('Checking commons video filters query', { parameters: req.query })

    if (areValidationErrors(req, res)) return

    const user = res.locals.oauth ? res.locals.oauth.token.User : undefined
    if (
      (req.query.filter === 'all-local' || req.query.filter === 'all') &&
      (!user || user.hasRight(UserRight.SEE_ALL_VIDEOS) === false)
    ) {
      res.fail({
        status: HttpStatusCode.UNAUTHORIZED_401,
        message: 'You are not allowed to see all local videos.'
      })
      return
    }

    return next()
  }
]

// ---------------------------------------------------------------------------

export {
  videosAddLegacyValidator,
  videosAddResumableValidator,
  videosAddResumableInitValidator,

  videosUpdateValidator,
  videosGetValidator,
  videoFileMetadataGetValidator,
  videosDownloadValidator,
  checkVideoFollowConstraints,
  videosCustomGetValidator,
  videosRemoveValidator,

  getCommonVideoEditAttributes,

  commonVideosFiltersValidator,

  videosOverviewValidator
}

// ---------------------------------------------------------------------------

function areErrorsInScheduleUpdate (req: express.Request, res: express.Response) {
  if (req.body.scheduleUpdate) {
    if (!req.body.scheduleUpdate.updateAt) {
      logger.warn('Invalid parameters: scheduleUpdate.updateAt is mandatory.')

      res.fail({ message: 'Schedule update at is mandatory.' })
      return true
    }
  }

  return false
}

async function commonVideoChecksPass (parameters: {
  req: express.Request
  res: express.Response
  user: MUserAccountId
  videoFileSize: number
  files: express.UploadFilesForCheck
}): Promise<boolean> {
  const { req, res, user, videoFileSize, files } = parameters

  if (areErrorsInScheduleUpdate(req, res)) return false

  if (!await doesVideoChannelOfAccountExist(req.body.channelId, user, res)) return false

  if (!isVideoFileMimeTypeValid(files)) {
    res.fail({
      status: HttpStatusCode.UNSUPPORTED_MEDIA_TYPE_415,
      message: 'This file is not supported. Please, make sure it is of the following type: ' +
               CONSTRAINTS_FIELDS.VIDEOS.EXTNAME.join(', ')
    })
    return false
  }

  if (!isVideoFileSizeValid(videoFileSize.toString())) {
    res.fail({
      status: HttpStatusCode.PAYLOAD_TOO_LARGE_413,
      message: 'This file is too large. It exceeds the maximum file size authorized.',
      type: ServerErrorCode.MAX_FILE_SIZE_REACHED
    })
    return false
  }

  if (await isAbleToUploadVideo(user.id, videoFileSize) === false) {
    res.fail({
      status: HttpStatusCode.PAYLOAD_TOO_LARGE_413,
      message: 'The user video quota is exceeded with this video.',
      type: ServerErrorCode.QUOTA_REACHED
    })
    return false
  }

  return true
}

export async function isVideoAccepted (
  req: express.Request,
  res: express.Response,
  videoFile: express.VideoUploadFile
) {
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
    res.fail({
      status: HttpStatusCode.FORBIDDEN_403,
      message: acceptedResult.errorMessage || 'Refused local video'
    })
    return false
  }

  return true
}

async function addDurationToVideo (videoFile: { path: string, duration?: number }) {
  const duration: number = await getDurationFromVideoFile(videoFile.path)

  if (isNaN(duration)) throw new Error(`Couldn't get video duration`)

  videoFile.duration = duration
}
