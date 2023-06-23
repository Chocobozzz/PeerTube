import express from 'express'
import { VideoTokensManager } from '@server/lib/video-tokens-manager'
import { VideoPrivacy, VideoToken } from '@shared/models'
import { asyncMiddleware, optionalAuthenticate, videoFileTokenValidator, videosCustomGetValidator } from '../../../middlewares'

const tokenRouter = express.Router()

tokenRouter.post('/:id/token',
  optionalAuthenticate,
  asyncMiddleware(videosCustomGetValidator('only-video')),
  videoFileTokenValidator,
  generateToken
)

// ---------------------------------------------------------------------------

export {
  tokenRouter
}

// ---------------------------------------------------------------------------

function generateToken (req: express.Request, res: express.Response) {
  const video = res.locals.onlyVideo

  const files = video.privacy === VideoPrivacy.PASSWORD_PROTECTED
    ? VideoTokensManager.Instance.createForPasswordProtectedVideo({ videoUUID: video.uuid })
    : VideoTokensManager.Instance.createForAuthUser({ videoUUID: video.uuid, user: res.locals.oauth.token.User })

  return res.json({
    files
  } as VideoToken)
}
