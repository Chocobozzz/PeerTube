import express from 'express'
import { body, header, param, query, ValidationChain } from 'express-validator'
import { isTestInstance } from '@server/helpers/core-utils'
import { getResumableUploadPath } from '@server/helpers/upload'
import { Redis } from '@server/lib/redis'
import { getServerActor } from '@server/models/application/application'
import { ExpressPromiseHandler } from '@server/types/express-handler'
import { MUserAccountId, MVideoFullLight } from '@server/types/models'
import { arrayify, getAllPrivacies } from '@shared/core-utils'
import { HttpStatusCode, ServerErrorCode, UserRight, VideoInclude } from '@shared/models'
import {
  exists,
  isBooleanValid,
  isDateValid,
  isFileValid,
  isIdValid,
  toBooleanOrNull,
  toIntOrNull,
  toValueOrNull
} from '../../../helpers/custom-validators/misc'
import { isBooleanBothQueryValid, isNumberArray, isStringArray } from '../../../helpers/custom-validators/search'
import {
  areVideoTagsValid,
  isScheduleVideoUpdatePrivacyValid,
  isVideoCategoryValid,
  isVideoDescriptionValid,
  isVideoFileMimeTypeValid,
  isVideoFileSizeValid,
  isVideoFilterValid,
  isVideoImageValid,
  isVideoIncludeValid,
  isVideoLanguageValid,
  isVideoLicenceValid,
  isVideoNameValid,
  isVideoOriginallyPublishedAtValid,
  isVideoPrivacyValid,
  isVideoSupportValid
} from '../../../helpers/custom-validators/videos'
import { cleanUpReqFiles } from '../../../helpers/express-utils'
import { getVideoStreamDuration } from '../../../helpers/ffmpeg'
import { logger } from '../../../helpers/logger'
import { deleteFileAndCatch } from '../../../helpers/utils'
import { getVideoWithAttributes } from '../../../helpers/video'
import { CONFIG } from '../../../initializers/config'
import { CONSTRAINTS_FIELDS, OVERVIEWS } from '../../../initializers/constants'
import { isLocalVideoAccepted } from '../../../lib/moderation'
import { Hooks } from '../../../lib/plugins/hooks'
import { VideoModel } from '../../../models/video/video'
import {
  areValidationErrors,
  checkCanSeeVideo,
  checkUserCanManageVideo,
  checkUserQuota,
  doesVideoChannelOfAccountExist,
  doesVideoExist,
  doesVideoFileOfVideoExist,
  isValidVideoIdParam
} from '../shared'

const videosAddLegacyValidator = getCommonVideoEditAttributes().concat([
  body('videofile')
    .custom((_, { req }) => isFileValid({ files: req.files, field: 'videofile', mimeTypeRegex: null, maxSize: null }))
    .withMessage('Should have a file'),
  body('name')
    .trim()
    .custom(isVideoNameValid).withMessage(
      `Should have a video name between ${CONSTRAINTS_FIELDS.VIDEOS.NAME.min} and ${CONSTRAINTS_FIELDS.VIDEOS.NAME.max} characters long`
    ),
  body('channelId')
    .customSanitizer(toIntOrNull)
    .custom(isIdValid),

  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
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
    const file = { ...body, duration: undefined, path: getResumableUploadPath(body.name), filename: body.metadata.filename }
    const cleanup = () => deleteFileAndCatch(file.path)

    const uploadId = req.query.upload_id
    const sessionExists = await Redis.Instance.doesUploadSessionExist(uploadId)

    if (sessionExists) {
      const sessionResponse = await Redis.Instance.getUploadSession(uploadId)

      if (!sessionResponse) {
        res.setHeader('Retry-After', 300) // ask to retry after 5 min, knowing the upload_id is kept for up to 15 min after completion

        return res.fail({
          status: HttpStatusCode.SERVICE_UNAVAILABLE_503,
          message: 'The upload is already being processed'
        })
      }

      if (isTestInstance()) {
        res.setHeader('x-resumable-upload-cached', 'true')
      }

      return res.json(sessionResponse)
    }

    await Redis.Instance.setUploadSession(uploadId)

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

    res.locals.videoFileResumable = { ...file, originalname: file.filename }

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
    .exists(),
  body('name')
    .trim()
    .custom(isVideoNameValid).withMessage(
      `Should have a video name between ${CONSTRAINTS_FIELDS.VIDEOS.NAME.min} and ${CONSTRAINTS_FIELDS.VIDEOS.NAME.max} characters long`
    ),
  body('channelId')
    .customSanitizer(toIntOrNull)
    .custom(isIdValid),

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
      originalname: req.body.filename
    }

    const user = res.locals.oauth.token.User
    const cleanup = () => cleanUpReqFiles(req)

    logger.debug('Checking videosAddResumableInitValidator parameters and headers', {
      parameters: req.body,
      headers: req.headers,
      files: req.files
    })

    if (areValidationErrors(req, res, { omitLog: true })) return cleanup()

    const files = { videofile: [ videoFileMetadata ] }
    if (!await commonVideoChecksPass({ req, res, user, videoFileSize: videoFileMetadata.size, files })) return cleanup()

    // multer required unsetting the Content-Type, now we can set it for node-uploadx
    req.headers['content-type'] = 'application/json; charset=utf-8'
    // place previewfile in metadata so that uploadx saves it in .META
    if (req.files?.['previewfile']) req.body.previewfile = req.files['previewfile']

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
    .custom(isIdValid),

  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
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
      if (areValidationErrors(req, res)) return
      if (!await doesVideoExist(req.params.id, res, fetchType)) return

      // Controllers does not need to check video rights
      if (fetchType === 'only-immutable-attributes') return next()

      const video = getVideoWithAttributes(res) as MVideoFullLight

      if (!await checkCanSeeVideo({ req, res, video, paramId: req.params.id, authenticateInQuery })) return

      return next()
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
    if (areValidationErrors(req, res)) return
    if (!await doesVideoFileOfVideoExist(+req.params.videoFileId, req.params.id, res)) return

    return next()
  }
])

const videosRemoveValidator = [
  isValidVideoIdParam('id'),

  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
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
    .isInt({ min: 1, max: OVERVIEWS.VIDEOS.SAMPLES_COUNT }),

  (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (areValidationErrors(req, res)) return

    return next()
  }
]

function getCommonVideoEditAttributes () {
  return [
    body('thumbnailfile')
      .custom((value, { req }) => isVideoImageValid(req.files, 'thumbnailfile')).withMessage(
        'This thumbnail file is not supported or too large. Please, make sure it is of the following type: ' +
        CONSTRAINTS_FIELDS.VIDEOS.IMAGE.EXTNAME.join(', ')
      ),
    body('previewfile')
      .custom((value, { req }) => isVideoImageValid(req.files, 'previewfile')).withMessage(
        'This preview file is not supported or too large. Please, make sure it is of the following type: ' +
        CONSTRAINTS_FIELDS.VIDEOS.IMAGE.EXTNAME.join(', ')
      ),

    body('category')
      .optional()
      .customSanitizer(toIntOrNull)
      .custom(isVideoCategoryValid),
    body('licence')
      .optional()
      .customSanitizer(toIntOrNull)
      .custom(isVideoLicenceValid),
    body('language')
      .optional()
      .customSanitizer(toValueOrNull)
      .custom(isVideoLanguageValid),
    body('nsfw')
      .optional()
      .customSanitizer(toBooleanOrNull)
      .custom(isBooleanValid).withMessage('Should have a valid nsfw boolean'),
    body('waitTranscoding')
      .optional()
      .customSanitizer(toBooleanOrNull)
      .custom(isBooleanValid).withMessage('Should have a valid waitTranscoding boolean'),
    body('privacy')
      .optional()
      .customSanitizer(toValueOrNull)
      .custom(isVideoPrivacyValid),
    body('description')
      .optional()
      .customSanitizer(toValueOrNull)
      .custom(isVideoDescriptionValid),
    body('support')
      .optional()
      .customSanitizer(toValueOrNull)
      .custom(isVideoSupportValid),
    body('tags')
      .optional()
      .customSanitizer(toValueOrNull)
      .custom(areVideoTagsValid)
      .withMessage(
        `Should have an array of up to ${CONSTRAINTS_FIELDS.VIDEOS.TAGS.max} tags between ` +
        `${CONSTRAINTS_FIELDS.VIDEOS.TAG.min} and ${CONSTRAINTS_FIELDS.VIDEOS.TAG.max} characters each`
      ),
    body('commentsEnabled')
      .optional()
      .customSanitizer(toBooleanOrNull)
      .custom(isBooleanValid).withMessage('Should have commentsEnabled boolean'),
    body('downloadEnabled')
      .optional()
      .customSanitizer(toBooleanOrNull)
      .custom(isBooleanValid).withMessage('Should have downloadEnabled boolean'),
    body('originallyPublishedAt')
      .optional()
      .customSanitizer(toValueOrNull)
      .custom(isVideoOriginallyPublishedAtValid),
    body('scheduleUpdate')
      .optional()
      .customSanitizer(toValueOrNull),
    body('scheduleUpdate.updateAt')
      .optional()
      .custom(isDateValid).withMessage('Should have a schedule update date that conforms to ISO 8601'),
    body('scheduleUpdate.privacy')
      .optional()
      .customSanitizer(toIntOrNull)
      .custom(isScheduleVideoUpdatePrivacyValid)
  ] as (ValidationChain | ExpressPromiseHandler)[]
}

const commonVideosFiltersValidator = [
  query('categoryOneOf')
    .optional()
    .customSanitizer(arrayify)
    .custom(isNumberArray).withMessage('Should have a valid categoryOneOf array'),
  query('licenceOneOf')
    .optional()
    .customSanitizer(arrayify)
    .custom(isNumberArray).withMessage('Should have a valid licenceOneOf array'),
  query('languageOneOf')
    .optional()
    .customSanitizer(arrayify)
    .custom(isStringArray).withMessage('Should have a valid languageOneOf array'),
  query('privacyOneOf')
    .optional()
    .customSanitizer(arrayify)
    .custom(isNumberArray).withMessage('Should have a valid privacyOneOf array'),
  query('tagsOneOf')
    .optional()
    .customSanitizer(arrayify)
    .custom(isStringArray).withMessage('Should have a valid tagsOneOf array'),
  query('tagsAllOf')
    .optional()
    .customSanitizer(arrayify)
    .custom(isStringArray).withMessage('Should have a valid tagsAllOf array'),
  query('nsfw')
    .optional()
    .custom(isBooleanBothQueryValid),
  query('isLive')
    .optional()
    .customSanitizer(toBooleanOrNull)
    .custom(isBooleanValid).withMessage('Should have a valid isLive boolean'),
  query('filter')
    .optional()
    .custom(isVideoFilterValid),
  query('include')
    .optional()
    .custom(isVideoIncludeValid),
  query('isLocal')
    .optional()
    .customSanitizer(toBooleanOrNull)
    .custom(isBooleanValid).withMessage('Should have a valid isLocal boolean'),
  query('hasHLSFiles')
    .optional()
    .customSanitizer(toBooleanOrNull)
    .custom(isBooleanValid).withMessage('Should have a valid hasHLSFiles boolean'),
  query('hasWebtorrentFiles')
    .optional()
    .customSanitizer(toBooleanOrNull)
    .custom(isBooleanValid).withMessage('Should have a valid hasWebtorrentFiles boolean'),
  query('skipCount')
    .optional()
    .customSanitizer(toBooleanOrNull)
    .custom(isBooleanValid).withMessage('Should have a valid skipCount boolean'),
  query('search')
    .optional()
    .custom(exists),

  (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (areValidationErrors(req, res)) return

    // FIXME: deprecated in 4.0, to remove
    {
      if (req.query.filter === 'all-local') {
        req.query.include = VideoInclude.NOT_PUBLISHED_STATE
        req.query.isLocal = true
        req.query.privacyOneOf = getAllPrivacies()
      } else if (req.query.filter === 'all') {
        req.query.include = VideoInclude.NOT_PUBLISHED_STATE
        req.query.privacyOneOf = getAllPrivacies()
      } else if (req.query.filter === 'local') {
        req.query.isLocal = true
      }

      req.query.filter = undefined
    }

    const user = res.locals.oauth?.token.User

    if ((!user || user.hasRight(UserRight.SEE_ALL_VIDEOS) !== true)) {
      if (req.query.include || req.query.privacyOneOf) {
        return res.fail({
          status: HttpStatusCode.UNAUTHORIZED_401,
          message: 'You are not allowed to see all videos.'
        })
      }
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

  if (await checkUserQuota(user, videoFileSize, res) === false) return false

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
  const duration = await getVideoStreamDuration(videoFile.path)

  // FFmpeg may not be able to guess video duration
  // For example with m2v files: https://trac.ffmpeg.org/ticket/9726#comment:2
  if (isNaN(duration)) videoFile.duration = 0
  else videoFile.duration = duration
}
