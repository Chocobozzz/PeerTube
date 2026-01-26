import { arrayify, forceNumber } from '@peertube/peertube-core-utils'
import {
  HttpStatusCode,
  UserRight,
  UserRightType,
  VideoPlaylistCreate,
  VideoPlaylistPrivacy,
  VideoPlaylistType,
  VideoPlaylistUpdate
} from '@peertube/peertube-models'
import { isStringArray } from '@server/helpers/custom-validators/search.js'
import { VideoChannelModel } from '@server/models/video/video-channel.js'
import { VideoPlaylistModel } from '@server/models/video/video-playlist.js'
import { ExpressPromiseHandler } from '@server/types/express-handler.js'
import { MUserAccountId } from '@server/types/models/index.js'
import express from 'express'
import { body, param, query, ValidationChain } from 'express-validator'
import {
  isArrayOf,
  isIdOrUUIDValid,
  isIdValid,
  isUUIDValid,
  toBooleanOrNull,
  toCompleteUUID,
  toIntArray,
  toIntOrNull,
  toValueOrNull
} from '../../../helpers/custom-validators/misc.js'
import {
  isVideoPlaylistDescriptionValid,
  isVideoPlaylistNameValid,
  isVideoPlaylistPrivacyValid,
  isVideoPlaylistTimestampValid,
  isVideoPlaylistTypeValid
} from '../../../helpers/custom-validators/video-playlists.js'
import { isVideoImageValid } from '../../../helpers/custom-validators/videos.js'
import { cleanUpReqFiles } from '../../../helpers/express-utils.js'
import { CONSTRAINTS_FIELDS } from '../../../initializers/constants.js'
import { VideoPlaylistElementModel } from '../../../models/video/video-playlist-element.js'
import { MVideoPlaylistFullSummary } from '../../../types/models/video/video-playlist.js'
import { authenticateOrFail } from '../../auth.js'
import {
  areValidationErrors,
  checkCanManageAccount,
  checkCanManageChannel,
  doesChannelIdExist,
  doesVideoExist,
  doesVideoPlaylistExist,
  isValidPlaylistIdParam,
  VideoPlaylistFetchType
} from '../shared/index.js'

export const videoPlaylistsAddValidator = getCommonPlaylistEditAttributes().concat([
  body('displayName')
    .custom(isVideoPlaylistNameValid),

  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (areValidationErrors(req, res)) return cleanUpReqFiles(req)

    const body: VideoPlaylistCreate = req.body
    if (
      body.videoChannelId &&
      !await doesChannelIdExist({ id: body.videoChannelId, req, res, checkCanManage: true, checkIsLocal: true, checkIsOwner: false })
    ) {
      return cleanUpReqFiles(req)
    }

    if (
      !body.videoChannelId &&
      (body.privacy === VideoPlaylistPrivacy.PUBLIC || body.privacy === VideoPlaylistPrivacy.UNLISTED)
    ) {
      cleanUpReqFiles(req)

      return res.fail({ message: req.t('Cannot set "public" or "unlisted" a playlist that is not assigned to a channel.') })
    }

    return next()
  }
])

export const videoPlaylistsUpdateValidator = getCommonPlaylistEditAttributes().concat([
  isValidPlaylistIdParam('playlistId'),

  body('displayName')
    .optional()
    .custom(isVideoPlaylistNameValid),

  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (areValidationErrors(req, res)) return cleanUpReqFiles(req)

    if (!await doesVideoPlaylistExist({ id: req.params.playlistId, req, res, fetchType: 'all' })) return cleanUpReqFiles(req)

    const videoPlaylist = getPlaylist(res)

    if (
      !await checkCanManagePlaylist({
        user: res.locals.oauth.token.User,
        videoPlaylist,
        right: UserRight.REMOVE_ANY_VIDEO_PLAYLIST,
        req,
        res
      })
    ) {
      return cleanUpReqFiles(req)
    }

    const body: VideoPlaylistUpdate = req.body

    const newPrivacy = body.privacy || videoPlaylist.privacy
    if (
      newPrivacy === VideoPlaylistPrivacy.PUBLIC &&
      (
        (!videoPlaylist.videoChannelId && !body.videoChannelId) ||
        body.videoChannelId === null
      )
    ) {
      cleanUpReqFiles(req)

      return res.fail({ message: req.t('Cannot set "public" a playlist that is not assigned to a channel.') })
    }

    if (videoPlaylist.type === VideoPlaylistType.WATCH_LATER) {
      cleanUpReqFiles(req)

      return res.fail({ message: req.t('Cannot update a watch later playlist.') })
    }

    if (
      body.videoChannelId &&
      !await doesChannelIdExist({ id: body.videoChannelId, req, res, checkCanManage: true, checkIsLocal: true, checkIsOwner: false })
    ) {
      return cleanUpReqFiles(req)
    }

    if (res.locals.videoChannel && res.locals.videoChannel.accountId !== videoPlaylist.ownerAccountId) {
      res.fail({
        status: HttpStatusCode.BAD_REQUEST_400,
        message: req.t('The channel must be owned by the same account as the playlist')
      })

      return cleanUpReqFiles(req)
    }

    return next()
  }
])

export const videoPlaylistsDeleteValidator = [
  isValidPlaylistIdParam('playlistId'),

  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (areValidationErrors(req, res)) return

    if (!await doesVideoPlaylistExist({ id: req.params.playlistId, req, res })) return

    const videoPlaylist = getPlaylist(res)
    if (videoPlaylist.type === VideoPlaylistType.WATCH_LATER) {
      return res.fail({ message: req.t('Cannot delete a watch later playlist.') })
    }

    if (
      !await checkCanManagePlaylist({
        user: res.locals.oauth.token.User,
        videoPlaylist,
        right: UserRight.REMOVE_ANY_VIDEO_PLAYLIST,
        req,
        res
      })
    ) {
      return
    }

    return next()
  }
]

export const videoPlaylistsGetValidator = (fetchType: VideoPlaylistFetchType) => {
  return [
    isValidPlaylistIdParam('playlistId'),

    async (req: express.Request, res: express.Response, next: express.NextFunction) => {
      if (areValidationErrors(req, res)) return

      if (!await doesVideoPlaylistExist({ id: req.params.playlistId, req, res, fetchType })) return

      const videoPlaylist = res.locals.videoPlaylistFull || res.locals.videoPlaylistSummary

      // Playlist is unlisted, check we used the uuid to fetch it
      if (videoPlaylist.privacy === VideoPlaylistPrivacy.UNLISTED) {
        if (isUUIDValid(req.params.playlistId)) return next()

        return res.fail({
          status: HttpStatusCode.NOT_FOUND_404,
          message: req.t('Playlist not found')
        })
      }

      if (videoPlaylist.privacy === VideoPlaylistPrivacy.PRIVATE) {
        if (!await authenticateOrFail({ req, res })) return

        if (
          !await checkCanManagePlaylist({
            user: res.locals.oauth.token.User,
            videoPlaylist,
            right: UserRight.UPDATE_ANY_VIDEO_PLAYLIST,
            req,
            res
          })
        ) {
          return
        }
      }

      return next()
    }
  ]
}

export const videoPlaylistsSearchValidator = [
  query('search')
    .optional()
    .not().isEmpty(),

  (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (areValidationErrors(req, res)) return

    return next()
  }
]

export const videoPlaylistsAccountValidator = [
  query('includeCollaborations')
    .optional()
    .customSanitizer(toBooleanOrNull),

  query('channelNameOneOf')
    .optional()
    .customSanitizer(arrayify)
    .custom(isStringArray).withMessage('Should have a valid channelNameOneOf array'),

  (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (areValidationErrors(req, res)) return

    return next()
  }
]

export const videoPlaylistsAddVideoValidator = [
  isValidPlaylistIdParam('playlistId'),

  body('videoId')
    .customSanitizer(toCompleteUUID)
    .custom(isIdOrUUIDValid).withMessage('Should have a valid video id/uuid/short uuid'),
  body('startTimestamp')
    .optional()
    .custom(isVideoPlaylistTimestampValid),
  body('stopTimestamp')
    .optional()
    .custom(isVideoPlaylistTimestampValid),

  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (areValidationErrors(req, res)) return

    if (!await doesVideoPlaylistExist({ id: req.params.playlistId, req, res, fetchType: 'all' })) return
    if (!await doesVideoExist(req.body.videoId, res, 'only-video-and-blacklist')) return

    const videoPlaylist = getPlaylist(res)

    if (
      !await checkCanManagePlaylist({
        user: res.locals.oauth.token.User,
        videoPlaylist,
        right: UserRight.UPDATE_ANY_VIDEO_PLAYLIST,
        req,
        res
      })
    ) {
      return
    }

    return next()
  }
]

export const videoPlaylistsUpdateOrRemoveVideoValidator = [
  isValidPlaylistIdParam('playlistId'),

  param('playlistElementId')
    .customSanitizer(toCompleteUUID)
    .custom(isIdValid).withMessage('Should have an element id/uuid/short uuid'),

  body('startTimestamp')
    .optional()
    .custom(isVideoPlaylistTimestampValid),
  body('stopTimestamp')
    .optional()
    .custom(isVideoPlaylistTimestampValid),

  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (areValidationErrors(req, res)) return

    if (!await doesVideoPlaylistExist({ id: req.params.playlistId, req, res, fetchType: 'all' })) return

    const videoPlaylist = getPlaylist(res)

    const videoPlaylistElement = await VideoPlaylistElementModel.loadById(req.params.playlistElementId)
    if (!videoPlaylistElement) {
      res.fail({
        status: HttpStatusCode.NOT_FOUND_404,
        message: req.t('Video playlist element not found')
      })
      return
    }
    res.locals.videoPlaylistElement = videoPlaylistElement

    if (
      !await checkCanManagePlaylist({
        user: res.locals.oauth.token.User,
        videoPlaylist,
        right: UserRight.UPDATE_ANY_VIDEO_PLAYLIST,
        req,
        res
      })
    ) return

    return next()
  }
]

export const videoPlaylistElementAPGetValidator = [
  isValidPlaylistIdParam('playlistId'),
  param('playlistElementId')
    .custom(isIdValid),

  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (areValidationErrors(req, res)) return

    const playlistElementId = forceNumber(req.params.playlistElementId)
    const playlistId = req.params.playlistId

    const videoPlaylistElement = await VideoPlaylistElementModel.loadByPlaylistAndElementIdForAP(playlistId, playlistElementId)
    if (!videoPlaylistElement) {
      res.fail({
        status: HttpStatusCode.NOT_FOUND_404,
        message: req.t('Video playlist element not found')
      })
      return
    }

    if (videoPlaylistElement.VideoPlaylist.privacy === VideoPlaylistPrivacy.PRIVATE) {
      return res.fail({
        status: HttpStatusCode.FORBIDDEN_403,
        message: req.t('Cannot get this private video playlist.')
      })
    }

    res.locals.videoPlaylistElementAP = videoPlaylistElement

    return next()
  }
]

export const videoPlaylistsReorderInChannelValidator = [
  body('startPosition')
    .isInt({ min: 1 }),
  body('insertAfterPosition')
    .isInt({ min: 0 }),
  body('reorderLength')
    .optional()
    .isInt({ min: 1 }),

  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (areValidationErrors(req, res)) return

    const nextPosition = await VideoPlaylistModel.getNextPositionOf({ videoChannelId: res.locals.videoChannel.id })
    const startPosition: number = req.body.startPosition
    const insertAfterPosition: number = req.body.insertAfterPosition
    const reorderLength: number = req.body.reorderLength

    if (startPosition >= nextPosition || insertAfterPosition >= nextPosition) {
      res.fail({
        message: req.t('Start position or insert after position exceed the channel limits (max: {max})', { max: nextPosition - 1 })
      })
      return
    }

    if (reorderLength && reorderLength + startPosition > nextPosition) {
      res.fail({
        message: req.t(
          'Reorder length with this start position exceeds the channel limits (max: {max})',
          { max: nextPosition - startPosition }
        )
      })
      return
    }

    return next()
  }
]

export const videoPlaylistsReorderVideosValidator = [
  isValidPlaylistIdParam('playlistId'),

  body('startPosition')
    .isInt({ min: 1 }),
  body('insertAfterPosition')
    .isInt({ min: 0 }),
  body('reorderLength')
    .optional()
    .isInt({ min: 1 }),

  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (areValidationErrors(req, res)) return

    if (!await doesVideoPlaylistExist({ id: req.params.playlistId, req, res, fetchType: 'all' })) return

    const videoPlaylist = getPlaylist(res)
    if (
      !await checkCanManagePlaylist({
        user: res.locals.oauth.token.User,
        videoPlaylist,
        right: UserRight.UPDATE_ANY_VIDEO_PLAYLIST,
        req,
        res
      })
    ) return

    const nextPosition = await VideoPlaylistElementModel.getNextPositionOf(videoPlaylist.id)
    const startPosition: number = req.body.startPosition
    const insertAfterPosition: number = req.body.insertAfterPosition
    const reorderLength: number = req.body.reorderLength

    if (startPosition >= nextPosition || insertAfterPosition >= nextPosition) {
      res.fail({
        message: req.t('Start position or insert after position exceed the playlist limits (max: {max})', { max: nextPosition - 1 })
      })
      return
    }

    if (reorderLength && reorderLength + startPosition > nextPosition) {
      res.fail({
        message: req.t('Reorder length with this start position exceeds the playlist limits (max: {max})', {
          max: nextPosition - startPosition
        })
      })
      return
    }

    return next()
  }
]

export const commonVideoPlaylistFiltersValidator = [
  query('playlistType')
    .optional()
    .custom(isVideoPlaylistTypeValid),

  (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (areValidationErrors(req, res)) return

    return next()
  }
]

export const doVideosInPlaylistExistValidator = [
  query('videoIds')
    .customSanitizer(toIntArray)
    .custom(v => isArrayOf(v, isIdValid)).withMessage('Should have a valid video ids array'),

  (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (areValidationErrors(req, res)) return

    return next()
  }
]

// ---------------------------------------------------------------------------
// Private
// ---------------------------------------------------------------------------

function getCommonPlaylistEditAttributes () {
  return [
    body('thumbnailfile')
      .custom((value, { req }) => isVideoImageValid(req.files, 'thumbnailfile'))
      .withMessage(
        'This thumbnail file is not supported or too large. Please, make sure it is of the following type: ' +
          CONSTRAINTS_FIELDS.VIDEO_PLAYLISTS.IMAGE.EXTNAME.join(', ')
      ),

    body('description')
      .optional()
      .customSanitizer(toValueOrNull)
      .custom(isVideoPlaylistDescriptionValid),
    body('privacy')
      .optional()
      .customSanitizer(toIntOrNull)
      .custom(isVideoPlaylistPrivacyValid),
    body('videoChannelId')
      .optional()
      .customSanitizer(toIntOrNull)
  ] as (ValidationChain | ExpressPromiseHandler)[]
}

async function checkCanManagePlaylist (options: {
  user: MUserAccountId
  videoPlaylist: MVideoPlaylistFullSummary
  right: UserRightType
  req: express.Request
  res: express.Response
}) {
  const { user, videoPlaylist, right, res, req } = options

  if (videoPlaylist.isLocal() === false) {
    res.fail({
      status: HttpStatusCode.FORBIDDEN_403,
      message: req.t('Cannot manage video playlist of another server.')
    })
    return false
  }

  if (checkCanManageAccount({ user, account: videoPlaylist.OwnerAccount, specialRight: right, req, res: null })) return true

  if (videoPlaylist.videoChannelId) {
    const channel = await VideoChannelModel.loadAndPopulateAccount(videoPlaylist.videoChannelId)

    if (
      await checkCanManageChannel({
        channel,
        user,
        req,
        res: null,
        checkCanManage: true,
        checkIsOwner: false,
        specialRight: right
      })
    ) {
      return true
    }
  }

  res.fail({
    status: HttpStatusCode.FORBIDDEN_403,
    message: req.t('Cannot manage video playlist of another user')
  })

  return false
}

function getPlaylist (res: express.Response) {
  return res.locals.videoPlaylistFull || res.locals.videoPlaylistSummary
}
