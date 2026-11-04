import { VideoCreateResult, VideoDuplicate } from '@peertube/peertube-models'
import { uuidToShort } from '@peertube/peertube-node-utils'
import { guessLanguageFromReq, t } from '@server/helpers/i18n.js'
import { createVideoDuplicate } from '@server/lib/video-duplicate/index.js'
import { buildNameFromVideoName } from '@server/lib/video.js'
import express from 'express'
import { asyncMiddleware, authenticate, openapiOperationDoc, videoDuplicateValidator } from '../../../middlewares/index.js'

const duplicateRouter = express.Router()

duplicateRouter.post(
  '/:id/duplicate',
  openapiOperationDoc({ operationId: 'duplicateVideo' }),
  authenticate,
  asyncMiddleware(videoDuplicateValidator),
  asyncMiddleware(duplicateVideo)
)

// ---------------------------------------------------------------------------

export {
  duplicateRouter
}

// ---------------------------------------------------------------------------

async function duplicateVideo (req: express.Request, res: express.Response) {
  const body = req.body as VideoDuplicate
  const sourceVideo = res.locals.videoFull

  const language = guessLanguageFromReq(req, res)

  const video = await createVideoDuplicate({
    sourceVideo,
    user: res.locals.oauth.token.User,
    name: body.name || buildNameFromVideoName(sourceVideo.name, videoName => t('{videoName} (Copy)', language, { videoName })),
    req,
    res
  })

  return res.json({
    video: {
      id: video.id,
      uuid: video.uuid,
      shortUUID: uuidToShort(video.uuid)
    } satisfies VideoCreateResult
  })
}
