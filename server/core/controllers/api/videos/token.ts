import { VideoToken } from '@peertube/peertube-models'
import { getAuthUser } from '@server/helpers/express-utils.js'
import { VideoTokensManager } from '@server/lib/video-tokens-manager.js'
import express from 'express'
import { asyncMiddleware, optionalAuthenticate, videoFileTokenValidator, videoGetValidatorFactory } from '../../../middlewares/index.js'

const tokenRouter = express.Router()

tokenRouter.post(
  '/:id/token',
  optionalAuthenticate,
  asyncMiddleware(videoGetValidatorFactory('with-blacklist')),
  videoFileTokenValidator,
  generateToken
)

// ---------------------------------------------------------------------------

export {
  tokenRouter
}

// ---------------------------------------------------------------------------

function generateToken (req: express.Request, res: express.Response) {
  const video = res.locals.videoWithBlacklist

  return res.json(
    {
      files: VideoTokensManager.Instance.create({ videoUUID: video.uuid, user: getAuthUser(res) })
    } satisfies VideoToken
  )
}
