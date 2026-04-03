import { ChangeOwnershipAccept, ChangeOwnershipState, HttpStatusCode, UserRight, VideoState } from '@peertube/peertube-models'
import { exists, isIdValid } from '@server/helpers/custom-validators/misc.js'
import { CONFIG } from '@server/initializers/config.js'
import { CHANGE_OWNERSHIP_STATES } from '@server/initializers/constants.js'
import { AccountModel } from '@server/models/account/account.js'
import { ChangeOwnershipModel } from '@server/models/video/change-ownership.js'
import { VideoModel } from '@server/models/video/video.js'
import express from 'express'
import { param, query } from 'express-validator'
import {
  areValidationErrors,
  checkCanManageAccount,
  checkCanManageVideo,
  checkUserQuota,
  doesChangeOwnershipExist,
  doesChannelIdExist,
  doesVideoExist,
  isValidVideoIdParam
} from '../shared/index.js'

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

    const nextOwner = await AccountModel.loadLocalByName(req.body.username)
    if (!nextOwner) {
      res.fail({
        message: req.t('{username} does not exist on {instanceName}', { username: req.body.username, instanceName: CONFIG.INSTANCE.NAME })
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

    res.locals.changeOwnershipNextOwner = nextOwner
    return next()
  }
]

export const acceptOrRejectChangeOwnershipValidator = [
  param('id')
    .custom(isIdValid),

  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (areValidationErrors(req, res)) return
    if (!await doesChangeOwnershipExist(req.params.id, req, res)) return

    // Check if the user who did the request is able to change the ownership of the video
    const user = res.locals.oauth.token.User
    const videoChangeOwnership = res.locals.changeOwnership

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

export const acceptVideoChangeOwnershipValidator = [
  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const body = req.body as ChangeOwnershipAccept
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

      if (!await checkUserQuota({ channelUser, videoFileSize: video.getMaxQualityBytes(), req, res })) return
    }

    return next()
  }
]

export const listVideoOwnershipChangesValidator = [
  isValidVideoIdParam('videoId'),

  query('state')
    .optional()
    .custom(value => exists(value) && CHANGE_OWNERSHIP_STATES[value] !== undefined),

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

export const deleteChangeOwnershipValidator = [
  param('id')
    .custom(isIdValid),

  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (areValidationErrors(req, res)) return
    if (!await doesChangeOwnershipExist(req.params.id, req, res)) return

    const videoChangeOwnership = res.locals.changeOwnership

    if (videoChangeOwnership.state !== ChangeOwnershipState.PENDING) {
      res.fail({
        status: HttpStatusCode.BAD_REQUEST_400,
        message: req.t('Ownership already accepted or refused')
      })
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
