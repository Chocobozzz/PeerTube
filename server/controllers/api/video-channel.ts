import * as express from 'express'
import { getFormattedObjects } from '../../helpers/utils'
import {
  asyncMiddleware,
  paginationValidator,
  setDefaultPagination,
  setDefaultSort,
  videoChannelsSortValidator
} from '../../middlewares'
import { VideoChannelModel } from '../../models/video/video-channel'

const videoChannelRouter = express.Router()

videoChannelRouter.get('/',
  paginationValidator,
  videoChannelsSortValidator,
  setDefaultSort,
  setDefaultPagination,
  asyncMiddleware(listVideoChannels)
)

// ---------------------------------------------------------------------------

export {
  videoChannelRouter
}

// ---------------------------------------------------------------------------

async function listVideoChannels (req: express.Request, res: express.Response, next: express.NextFunction) {
  const resultList = await VideoChannelModel.listForApi(req.query.start, req.query.count, req.query.sort)

  return res.json(getFormattedObjects(resultList.data, resultList.total))
}
