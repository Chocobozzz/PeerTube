import express from 'express'
import { body } from 'express-validator'
import { HttpStatusCode, UserRight } from '@peertube/peertube-models'
import { areValidationErrors, checkCanManageVideo, doesVideoExist, isValidVideoIdParam } from '../shared/index.js'
import { areVideoChaptersValid } from '@server/helpers/custom-validators/video-chapters.js'

export const updateVideoChaptersValidator = [
  isValidVideoIdParam('videoId'),

  body('chapters')
    .custom(areVideoChaptersValid)
    .withMessage('Chapters must have a valid title and timecode, and each timecode must be unique'),

  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (areValidationErrors(req, res)) return
    if (!await doesVideoExist(req.params.videoId, res)) return

    if (res.locals.videoAll.isLive) {
      return res.fail({
        status: HttpStatusCode.BAD_REQUEST_400,
        message: 'You cannot add chapters to a live video'
      })
    }

    // Check if the user who did the request is able to update video chapters (same right as updating the video)
    const user = res.locals.oauth.token.User
    if (
      !await checkCanManageVideo({
        user,
        video: res.locals.videoAll,
        right: UserRight.UPDATE_ANY_VIDEO,
        req,
        res,
        checkIsLocal: true,
        checkIsOwner: false
      })
    ) return

    return next()
  }
]
