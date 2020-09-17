import * as express from 'express'
import { mapToJSON } from '@server/helpers/core-utils'
import { LiveManager } from '@server/lib/live-manager'

const liveRouter = express.Router()

liveRouter.use('/segments-sha256/:videoUUID',
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
    return res.sendStatus(404)
  }

  return res.json(mapToJSON(result))
}
