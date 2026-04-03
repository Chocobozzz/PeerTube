import {
  ChangeOwnershipState,
  ChangeOwnershipStateType,
  ChangeVideoOwnershipAccept,
  HttpStatusCode,
  UserRight,
  VideoState
} from '@peertube/peertube-models'
import { exists, isIdValid } from '@server/helpers/custom-validators/misc.js'
import { getAuthUser } from '@server/helpers/express-utils.js'
import { CONFIG } from '@server/initializers/config.js'
import { CHANGE_OWNERSHIP_STATES } from '@server/initializers/constants.js'
import { AccountModel } from '@server/models/account/account.js'
import { ChangeOwnershipModel } from '@server/models/video/change-ownership.js'
import { VideoChannelModel } from '@server/models/video/video-channel.js'
import { VideoModel } from '@server/models/video/video.js'
import express from 'express'
import { param, query } from 'express-validator'
import {
  areValidationErrors,
  checkCanManageAccount,
  checkCanManageChannel,
  checkCanManageVideo,
  checkUserQuota,
  doesChangeOwnershipExist,
  doesChannelHandleExist,
  doesChannelIdExist,
  doesVideoExist,
  isValidVideoIdParam
} from '../shared/index.js'

// ---------------------------------------------------------------------------
// Common validators for video and channel ownership change
// ---------------------------------------------------------------------------

export const acceptOrRejectChangeOwnershipValidatorFactory = (type: 'video' | 'channel') => {
  return [
    param('id')
      .custom(isIdValid),

    async (req: express.Request, res: express.Response, next: express.NextFunction) => {
      if (areValidationErrors(req, res)) return
      if (!await doesChangeOwnershipExist(req.params.id, req, res)) return

      // Check if the user who did the request is able to change the ownership of the video
      const user = res.locals.oauth.token.User
      const videoChangeOwnership = res.locals.changeOwnership

      if (type === 'video' && !videoChangeOwnership.Video) {
        res.fail({ message: req.t('The ownership change request is not linked to a video') })
        return
      }

      if (type === 'channel' && !videoChangeOwnership.VideoChannel) {
        res.fail({ message: req.t('The ownership change request is not linked to a channel') })
        return
      }

      if (!checkCanManageAccount({ user, account: videoChangeOwnership.NextOwner, req, res: null, specialRight: UserRight.MANAGE_USERS })) {
        res.fail({
          status: HttpStatusCode.FORBIDDEN_403,
          message: req.t('Cannot terminate an ownership change of another user')
        })
        return
      }

      const changeOwnership = res.locals.changeOwnership

      if (changeOwnership.state !== ChangeOwnershipState.PENDING) {
        res.fail({
          status: HttpStatusCode.BAD_REQUEST_400,
          message: req.t('Ownership change request already accepted or refused')
        })
        return
      }

      return next()
    }
  ]
}

// ---------------------------------------------------------------------------
// Ownership change for videos
// ---------------------------------------------------------------------------

export const changeVideoOwnershipValidator = [
  isValidVideoIdParam('videoId'),

  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (areValidationErrors(req, res)) return
    if (!await doesVideoExist(req.params.videoId, res, 'with-rights')) return

    // Check if the user who did the request is able to change the ownership of the video
    if (
      !await checkCanManageVideo({
        user: res.locals.oauth.token.User,
        video: res.locals.videoWithRights,
        right: UserRight.CHANGE_VIDEO_OWNERSHIP,
        checkIsOwner: false,
        checkIsLocal: true,
        req,
        res
      })
    ) return

    if (!await checkNextOwner({ username: req.body.username, req, res })) return

    const nextOwner = res.locals.changeOwnershipNextOwner
    if (nextOwner.id === res.locals.videoWithRights.VideoChannel.accountId) {
      res.fail({
        status: HttpStatusCode.BAD_REQUEST_400,
        message: req.t('The new owner is already the owner of this video')
      })
      return
    }

    const existing = await ChangeOwnershipModel.loadPendingByVideo(res.locals.videoWithRights.id)
    if (existing) {
      res.fail({
        status: HttpStatusCode.BAD_REQUEST_400,
        message: req.t('There is already a pending ownership change request for this video')
      })
      return
    }

    return next()
  }
]

export const acceptVideoChangeOwnershipValidator = [
  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const body = req.body as ChangeVideoOwnershipAccept
    if (!await doesChannelIdExist({ id: body.channelId, req, res, checkCanManage: true, checkIsLocal: true, checkIsOwner: true })) return

    const videoChangeOwnership = res.locals.changeOwnership

    const video = await VideoModel.loadWithFiles(videoChangeOwnership.Video.id)

    if (video.isLive) {
      if (video.state !== VideoState.WAITING_FOR_LIVE) {
        res.fail({
          status: HttpStatusCode.BAD_REQUEST_400,
          message: req.t('You cannot accept an ownership change of a published live.')
        })

        return
      }
    } else {
      const channelUser = res.locals.oauth.token.User

      if (!await checkUserQuota({ channelUser, uploadSize: video.getMaxQualityBytes(), req, res })) return
    }

    return next()
  }
]

export const listVideoOwnershipChangesValidator = [
  isValidVideoIdParam('videoId'),

  query('state')
    .optional()
    .custom(isOwnershipChangeStateValid),

  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (areValidationErrors(req, res)) return
    if (!await doesVideoExist(req.params.videoId, res, 'with-rights')) return

    // Check if the user who did the request is able to manage the video
    if (
      !await checkCanManageVideo({
        user: res.locals.oauth.token.User,
        video: res.locals.videoWithRights,
        right: UserRight.CHANGE_VIDEO_OWNERSHIP,
        checkIsOwner: false,
        checkIsLocal: true,
        req,
        res
      })
    ) return

    return next()
  }
]

export const deleteChangeVideoOwnershipValidator = [
  param('id')
    .custom(isIdValid),

  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (areValidationErrors(req, res)) return
    if (!await doesChangeOwnershipExist(req.params.id, req, res)) return

    const videoChangeOwnership = res.locals.changeOwnership

    if (videoChangeOwnership.state !== ChangeOwnershipState.PENDING) {
      res.fail({
        status: HttpStatusCode.BAD_REQUEST_400,
        message: req.t('Ownership request already accepted or refused')
      })
      return
    }

    if (!videoChangeOwnership.Video) {
      res.fail({ message: req.t('The ownership change request is not linked to a video') })
      return
    }

    const video = await VideoModel.loadWithRights(videoChangeOwnership.Video.id)

    if (
      !await checkCanManageVideo({
        user: res.locals.oauth.token.User,
        video,
        right: UserRight.CHANGE_VIDEO_OWNERSHIP,
        checkIsOwner: false,
        checkIsLocal: true,
        req,
        res
      })
    ) return

    return next()
  }
]

// ---------------------------------------------------------------------------
// Ownership change for channels
// ---------------------------------------------------------------------------

export const changeChannelOwnershipValidator = [
  param('handle').exists(),

  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (areValidationErrors(req, res)) return
    if (
      !await doesChannelHandleExist({ handle: req.params.handle, checkCanManage: true, checkIsLocal: true, checkIsOwner: true, req, res })
    ) return

    if (!await checkNextOwner({ username: req.body.username, req, res })) return

    const nextOwner = res.locals.changeOwnershipNextOwner
    if (nextOwner.id === res.locals.videoChannel.accountId) {
      res.fail({
        status: HttpStatusCode.BAD_REQUEST_400,
        message: req.t('The new owner is already the owner of this channel')
      })
      return
    }

    const existing = await ChangeOwnershipModel.loadPendingByChannel(res.locals.videoChannel.id)
    if (existing) {
      res.fail({
        status: HttpStatusCode.BAD_REQUEST_400,
        message: req.t('There is already a pending ownership change request for this channel')
      })
      return
    }

    return next()
  }
]

export const listChannelOwnershipChangesValidator = [
  param('handle').exists(),

  query('state')
    .optional()
    .custom(isOwnershipChangeStateValid),

  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (areValidationErrors(req, res)) return
    if (
      !await doesChannelHandleExist({ handle: req.params.handle, checkCanManage: true, checkIsLocal: true, checkIsOwner: false, req, res })
    ) return

    return next()
  }
]

export const acceptChannelChangeOwnershipValidator = [
  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const videoChangeOwnership = res.locals.changeOwnership

    const count = await VideoChannelModel.countByAccount(videoChangeOwnership.Initiator.id)

    if (count <= 1) {
      res.fail({
        status: HttpStatusCode.CONFLICT_409,
        message: req.t('Cannot accept to transfer the last channel of this user')
      })
      return
    }

    const channelQuota = await VideoChannelModel.getChannelQuota(videoChangeOwnership.VideoChannel.id)
    if (!await checkUserQuota({ channelUser: getAuthUser(res), uploadSize: channelQuota, req, res })) return

    return next()
  }
]

export const deleteChangeChannelOwnershipValidator = [
  param('id').custom(isIdValid),

  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (areValidationErrors(req, res)) return
    if (!await doesChangeOwnershipExist(req.params.id, req, res)) return

    const videoChangeOwnership = res.locals.changeOwnership

    if (videoChangeOwnership.state !== ChangeOwnershipState.PENDING) {
      res.fail({
        status: HttpStatusCode.BAD_REQUEST_400,
        message: req.t('Ownership request already accepted or refused')
      })
      return
    }

    if (!videoChangeOwnership.VideoChannel) {
      res.fail({ message: req.t('The ownership change request is not linked to a channel') })
      return
    }

    const channel = await VideoChannelModel.loadAndPopulateAccount(videoChangeOwnership.VideoChannel.id)

    if (
      !await checkCanManageChannel({
        channel,
        user: getAuthUser(res),
        req,
        res,
        checkCanManage: true,
        checkIsOwner: true
      })
    ) return false

    return next()
  }
]

// ---------------------------------------------------------------------------
// Common helpers
// ---------------------------------------------------------------------------

async function checkNextOwner (options: {
  username: string
  req: express.Request
  res: express.Response
}) {
  const { username, req, res } = options

  const nextOwner = await AccountModel.loadLocalByName(username)
  if (!nextOwner) {
    res.fail({
      message: req.t('{username} does not exist on {instanceName}', { username: username, instanceName: CONFIG.INSTANCE.NAME })
    })
    return false
  }

  res.locals.changeOwnershipNextOwner = nextOwner

  return true
}

function isOwnershipChangeStateValid (value: any): value is ChangeOwnershipStateType {
  return exists(value) && CHANGE_OWNERSHIP_STATES[value] !== undefined
}
