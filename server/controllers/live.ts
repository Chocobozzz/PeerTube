import * as cors from 'cors'
import * as express from 'express'
import { mapToJSON } from '@server/helpers/core-utils'
import { LiveSegmentShaStore } from '@server/lib/live'
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

  const result = LiveSegmentShaStore.Instance.getSegmentsSha256(videoUUID)

  if (!result) {
    return res.status(HttpStatusCode.NOT_FOUND_404).end()
  }

  return res.json(mapToJSON(result))
}
