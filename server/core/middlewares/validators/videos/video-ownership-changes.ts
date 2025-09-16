import { HttpStatusCode, UserRight, VideoChangeOwnershipAccept, VideoChangeOwnershipStatus, VideoState } from '@peertube/peertube-models'
import { isIdValid } from '@server/helpers/custom-validators/misc.js'
import { CONFIG } from '@server/initializers/config.js'
import { AccountModel } from '@server/models/account/account.js'
import { MUserAccountId, MVideoChangeOwnershipFull, MVideoWithAllFiles } from '@server/types/models/index.js'
import express from 'express'
import { param } from 'express-validator'
import {
  areValidationErrors,
  checkCanManageAccount,
  checkCanManageVideo,
  checkUserQuota,
  doesChangeVideoOwnershipExist,
  doesChannelIdExist,
  doesVideoExist,
  isValidVideoIdParam
} from '../shared/index.js'

export const videosChangeOwnershipValidator = [
  isValidVideoIdParam('videoId'),

  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (areValidationErrors(req, res)) return
    if (!await doesVideoExist(req.params.videoId, res)) return

    // Check if the user who did the request is able to change the ownership of the video
    if (
      !await checkCanManageVideo({
        user: res.locals.oauth.token.User,
        video: res.locals.videoAll,
        right: UserRight.CHANGE_VIDEO_OWNERSHIP,
        checkIsOwner: true,
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

    res.locals.nextOwner = nextOwner
    return next()
  }
]

export const videosTerminateChangeOwnershipValidator = [
  param('id')
    .custom(isIdValid),

  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (areValidationErrors(req, res)) return
    if (!await doesChangeVideoOwnershipExist(req.params.id, req, res)) return

    // Check if the user who did the request is able to change the ownership of the video
    if (
      !checkCanTerminateOwnershipChange({
        user: res.locals.oauth.token.User,
        videoChangeOwnership: res.locals.videoChangeOwnership,
        req,
        res
      })
    ) return

    const videoChangeOwnership = res.locals.videoChangeOwnership

    if (videoChangeOwnership.status !== VideoChangeOwnershipStatus.WAITING) {
      res.fail({
        status: HttpStatusCode.BAD_REQUEST_400,
        message: req.t('Ownership already accepted or refused')
      })
      return
    }

    return next()
  }
]

export const videosAcceptChangeOwnershipValidator = [
  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const body = req.body as VideoChangeOwnershipAccept
    if (!await doesChannelIdExist({ id: body.channelId, req, res, checkCanManage: true, checkIsLocal: true, checkIsOwner: true })) return

    const videoChangeOwnership = res.locals.videoChangeOwnership

    const video = videoChangeOwnership.Video

    if (!await checkCanAccept(video, req, res)) return

    return next()
  }
]

// ---------------------------------------------------------------------------
// Private
// ---------------------------------------------------------------------------

async function checkCanAccept (video: MVideoWithAllFiles, req: express.Request, res: express.Response): Promise<boolean> {
  if (video.isLive) {
    if (video.state !== VideoState.WAITING_FOR_LIVE) {
      res.fail({
        status: HttpStatusCode.BAD_REQUEST_400,
        message: req.t('You can accept an ownership change of a published live.')
      })

      return false
    }

    return true
  }

  const user = res.locals.oauth.token.User

  if (!await checkUserQuota({ user, videoFileSize: video.getMaxQualityBytes(), req, res })) return false

  return true
}

function checkCanTerminateOwnershipChange (options: {
  user: MUserAccountId
  videoChangeOwnership: MVideoChangeOwnershipFull
  req: express.Request
  res: express.Response
}) {
  const { user, videoChangeOwnership, req, res } = options

  if (!checkCanManageAccount({ user, account: videoChangeOwnership.NextOwner, req, res: null, specialRight: UserRight.MANAGE_USERS })) {
    res.fail({
      status: HttpStatusCode.FORBIDDEN_403,
      message: req.t('Cannot terminate an ownership change of another user')
    })

    return false
  }

  return true
}
