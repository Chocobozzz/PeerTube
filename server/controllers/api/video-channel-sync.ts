import { getFormattedObjects } from '@server/helpers/utils'
import { asyncMiddleware, authenticate, setDefaultPagination, setDefaultSort, videoChannelSyncsSortValidator } from '@server/middlewares'
import { VideoChannelSyncModel } from '@server/models/video/video-channel-sync'
import express from 'express'

const videoChannelSyncRouter = express.Router()

videoChannelSyncRouter.get('/:accountId',
  authenticate,
  videoChannelSyncsSortValidator,
  setDefaultSort,
  setDefaultPagination,
  // videoChannelsListValidator, //FIXME implement search in the front-end
  asyncMiddleware(listVideoChannelSyncs)
)

export { videoChannelSyncRouter }

// ---------------------------------------------------------------------------

async function listVideoChannelSyncs (req: express.Request, res: express.Response) {
  const user = res.locals.oauth.token.User
  const resultList = await VideoChannelSyncModel.listByAccountForAPI({
    accountId: user.Account.id,
    start: req.query.start,
    count: req.query.count,
    sort: req.query.sort
  })

  return res.json(getFormattedObjects(resultList.data, resultList.total))
}
