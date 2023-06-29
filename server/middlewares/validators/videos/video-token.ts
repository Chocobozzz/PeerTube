import express from 'express'
import { VideoPrivacy } from '../../../../shared/models/videos'
import { HttpStatusCode } from '@shared/models'
import { exists } from '@server/helpers/custom-validators/misc'

const videoFileTokenValidator = [
  (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const video = res.locals.onlyVideo
    if (video.privacy !== VideoPrivacy.PASSWORD_PROTECTED && !exists(res.locals.oauth.token.User)) {
      return res.fail({
        status: HttpStatusCode.UNAUTHORIZED_401,
        message: 'Not authenticated'
      })
    }

    return next()
  }
]

// ---------------------------------------------------------------------------

export {
  videoFileTokenValidator
}
