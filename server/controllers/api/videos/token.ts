import express from 'express'
import { VideoTokensManager } from '@server/lib/video-tokens-manager'
import { VideoPrivacy, VideoToken } from '@shared/models'
import { asyncMiddleware, optionalAuthenticate, videosCustomGetValidator } from '../../../middlewares'
import shortUUID from 'short-uuid'

const tokenRouter = express.Router()

tokenRouter.post('/:id/token',
  optionalAuthenticate,
  asyncMiddleware(videosCustomGetValidator('only-video')),
  generateToken
)

// ---------------------------------------------------------------------------

export {
  tokenRouter
}

// ---------------------------------------------------------------------------

function generateToken (req: express.Request, res: express.Response) {
  const video = res.locals.onlyVideo
  let files: {
    token: shortUUID.UUID
    expires: Date
  }
  if (video.privacy === VideoPrivacy.PASSWORD_PROTECTED) {
    files = VideoTokensManager.Instance.createForPasswordprotectedVideo({ videoUUID: video.uuid })
  } else {
    files = VideoTokensManager.Instance.createForAuthUser({ videoUUID: video.uuid, user: res.locals.oauth.token.User })
  }

  return res.json({
    files
  } as VideoToken)
}
