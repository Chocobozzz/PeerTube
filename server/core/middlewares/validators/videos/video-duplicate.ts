import { UserRight } from '@peertube/peertube-models'
import { isVideoNameValid } from '@server/helpers/custom-validators/videos.js'
import { CONSTRAINTS_FIELDS } from '@server/initializers/constants.js'
import express from 'express'
import { body } from 'express-validator'
import { areValidationErrors, checkCanManageVideo, checkUserQuota, doesVideoExist, isValidVideoIdParam } from '../shared/index.js'
import { checkVideoCanBeDuplicated, checkVideoFileCanBeEdited } from './shared/index.js'

export const videoDuplicateValidator = [
  isValidVideoIdParam('id'),

  body('name')
    .optional()
    .trim()
    .custom(isVideoNameValid).withMessage(
      `Should have a video name between ${CONSTRAINTS_FIELDS.VIDEOS.NAME.min} and ${CONSTRAINTS_FIELDS.VIDEOS.NAME.max} characters long`
    ),

  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (areValidationErrors(req, res)) return
    if (!await doesVideoExist(req.params.id, res)) return

    const video = res.locals.videoFull

    const user = res.locals.oauth.token.User
    if (!await checkCanManageVideo({ user, video, right: UserRight.UPDATE_ANY_VIDEO, req, res, checkIsLocal: true, checkIsOwner: false })) {
      return
    }

    if (!checkVideoFileCanBeEdited(video, req, res)) return
    if (!checkVideoCanBeDuplicated({ video, user, req, res })) return

    const channelUser = { id: video.VideoChannel.Account.userId }
    if (await checkUserQuota({ channelUser, uploadSize: video.getMaxQualityBytes(), req, res }) === false) return

    return next()
  }
]
