import * as express from 'express'
import { param } from 'express-validator'
import { isIdValid } from '@server/helpers/custom-validators/misc'
import { checkUserCanTerminateOwnershipChange } from '@server/helpers/custom-validators/video-ownership'
import { logger } from '@server/helpers/logger'
import { isAbleToUploadVideo } from '@server/lib/user'
import { AccountModel } from '@server/models/account/account'
import { MVideoWithAllFiles } from '@server/types/models'
import { HttpStatusCode } from '@shared/core-utils'
import { ServerErrorCode, UserRight, VideoChangeOwnershipAccept, VideoChangeOwnershipStatus, VideoState } from '@shared/models'
import {
  areValidationErrors,
  checkUserCanManageVideo,
  doesChangeVideoOwnershipExist,
  doesVideoChannelOfAccountExist,
  doesVideoExist,
  isValidVideoIdParam
} from '../shared'

const videosChangeOwnershipValidator = [
  isValidVideoIdParam('videoId'),

  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    logger.debug('Checking changeOwnership parameters', { parameters: req.params })

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

const videosTerminateChangeOwnershipValidator = [
  param('id')
    .custom(isIdValid).withMessage('Should have a valid id'),

  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    logger.debug('Checking changeOwnership parameters', { parameters: req.params })

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

const videosAcceptChangeOwnershipValidator = [
  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const body = req.body as VideoChangeOwnershipAccept
    if (!await doesVideoChannelOfAccountExist(body.channelId, res.locals.oauth.token.User, res)) return

    const videoChangeOwnership = res.locals.videoChangeOwnership

    const video = videoChangeOwnership.Video

    if (!await checkCanAccept(video, res)) return

    return next()
  }
]

export {
  videosChangeOwnershipValidator,
  videosTerminateChangeOwnershipValidator,
  videosAcceptChangeOwnershipValidator
}

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

  if (!await isAbleToUploadVideo(user.id, video.getMaxQualityFile().size)) {
    res.fail({
      status: HttpStatusCode.PAYLOAD_TOO_LARGE_413,
      message: 'The user video quota is exceeded with this video.',
      type: ServerErrorCode.QUOTA_REACHED
    })

    return false
  }

  return true
}
