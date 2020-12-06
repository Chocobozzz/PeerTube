import * as cors from 'cors'
import * as express from 'express'
import { mapToJSON } from '@server/helpers/core-utils'
import { LiveManager } from '@server/lib/live-manager'
import { HttpStatusCode } from '@shared/core-utils/miscs/http-error-codes'

const liveRouter = express.Router()

liveRouter.use('/segments-sha256/:videoUUID',
  cors(),
  getSegmentsSha256
)

// ---------------------------------------------------------------------------

export {
  liveRouter
}

// ---------------------------------------------------------------------------

function getSegmentsSha256 (req: express.Request, res: express.Response) {
  const videoUUID = req.params.videoUUID

  const result = LiveManager.Instance.getSegmentsSha256(videoUUID)

  if (!result) {
    return res.sendStatus(HttpStatusCode.NOT_FOUND_404)
  }

  return res.json(mapToJSON(result))
}
