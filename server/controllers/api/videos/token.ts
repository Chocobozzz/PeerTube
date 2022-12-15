import express from 'express'
import { VideoTokensManager } from '@server/lib/video-tokens-manager'
import { VideoToken } from '@shared/models'
import { asyncMiddleware, authenticate, videosCustomGetValidator } from '../../../middlewares'

const tokenRouter = express.Router()

tokenRouter.post('/:id/token',
  authenticate,
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

  const { token, expires } = VideoTokensManager.Instance.create(video.uuid)

  return res.json({
    files: {
      token,
      expires
    }
  } as VideoToken)
}
