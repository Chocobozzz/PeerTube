import express from 'express'
import { HttpStatusCode, VideoPrivacy } from '@peertube/peertube-models'
import { exists } from '@server/helpers/custom-validators/misc.js'
import { getAuthUser } from '@server/helpers/express-utils.js'

export const videoFileTokenValidator = [
  (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const video = res.locals.videoWithBlacklist

    if (video.privacy !== VideoPrivacy.PASSWORD_PROTECTED && !exists(getAuthUser(res))) {
      return res.sendStatus(HttpStatusCode.UNAUTHORIZED_401)
    }

    return next()
  }
]
