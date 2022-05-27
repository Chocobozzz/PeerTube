import { getVideoWithAttributes } from '@server/helpers/video'
import { MVideoFullLight } from '@server/types/models'
import { HttpStatusCode, UserRight, VideoPrivacy } from '@shared/models'
import express from 'express'
import { logger } from '../../../helpers/logger'
import {
  areValidationErrors,
  doesVideoExist,
  isValidVideoIdParam
} from '../shared'

const videoSourceGetValidator = [
  isValidVideoIdParam('id'),

  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    logger.debug('Checking videoSourceGet parameters', { parameters: req.params })

    if (areValidationErrors(req, res)) return
    if (!await doesVideoExist(req.params.id, res, 'for-api')) return

    const user = res.locals.oauth ? res.locals.oauth.token.User : null
    const video = getVideoWithAttributes(res) as MVideoFullLight

    if (user?.hasRight(UserRight.UPDATE_ANY_VIDEO) === true || video.VideoChannel?.Account.userId === user?.id) {
      return next()
    }

    if (video.privacy === VideoPrivacy.PUBLIC || video.privacy === VideoPrivacy.UNLISTED) {
      res.fail({
        status: HttpStatusCode.FORBIDDEN_403,
        message: 'Refused get video sources'
      })
    }

    return res.fail({
      status: HttpStatusCode.NOT_FOUND_404,
      message: 'Video not found'
    })
  }
]

export {
  videoSourceGetValidator
}
