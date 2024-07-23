import { HttpStatusCode, UserRight, VideoChangeOwnershipAccept, VideoChangeOwnershipStatus, VideoState } from '@peertube/peertube-models'
import { isIdValid } from '@server/helpers/custom-validators/misc.js'
import { checkUserCanTerminateOwnershipChange } from '@server/helpers/custom-validators/video-ownership.js'
import { AccountModel } from '@server/models/account/account.js'
import { MVideoWithAllFiles } from '@server/types/models/index.js'
import express from 'express'
import { param } from 'express-validator'
import {
  areValidationErrors,
  checkUserCanManageVideo,
  checkUserQuota,
  doesChangeVideoOwnershipExist,
  doesVideoChannelOfAccountExist,
  doesVideoExist,
  isValidVideoIdParam
} from '../shared/index.js'

export const videosChangeOwnershipValidator = [
  isValidVideoIdParam('videoId'),

  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (areValidationErrors(req, res)) return
    if (!await doesVideoExist(req.params.videoId, res)) return

    // Check if the user who did the request is able to change the ownership of the video
    if (!checkUserCanManageVideo(res.locals.oauth.token.User, res.locals.videoAll, UserRight.CHANGE_VIDEO_OWNERSHIP, res)) return

    const nextOwner = await AccountModel.loadLocalByName(req.body.username)
    if (!nextOwner) {
      res.fail({ message: 'Changing video ownership to a remote account is not supported yet' })
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
    if (!await doesChangeVideoOwnershipExist(req.params.id, res)) return

    // Check if the user who did the request is able to change the ownership of the video
    if (!checkUserCanTerminateOwnershipChange(res.locals.oauth.token.User, res.locals.videoChangeOwnership, res)) return

    const videoChangeOwnership = res.locals.videoChangeOwnership

    if (videoChangeOwnership.status !== VideoChangeOwnershipStatus.WAITING) {
      res.fail({
        status: HttpStatusCode.FORBIDDEN_403,
        message: 'Ownership already accepted or refused'
      })
      return
    }

    return next()
  }
]

export const videosAcceptChangeOwnershipValidator = [
  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const body = req.body as VideoChangeOwnershipAccept
    if (!await doesVideoChannelOfAccountExist(body.channelId, res.locals.oauth.token.User, res)) return

    const videoChangeOwnership = res.locals.videoChangeOwnership

    const video = videoChangeOwnership.Video

    if (!await checkCanAccept(video, res)) return

    return next()
  }
]

// ---------------------------------------------------------------------------
// Private
// ---------------------------------------------------------------------------

async function checkCanAccept (video: MVideoWithAllFiles, res: express.Response): Promise<boolean> {
  if (video.isLive) {

    if (video.state !== VideoState.WAITING_FOR_LIVE) {
      res.fail({
        status: HttpStatusCode.BAD_REQUEST_400,
        message: 'You can accept an ownership change of a published live.'
      })

      return false
    }

    return true
  }

  const user = res.locals.oauth.token.User

  if (!await checkUserQuota(user, video.getMaxQualityBytes(), res)) return false

  return true
}
