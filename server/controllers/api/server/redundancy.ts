import * as express from 'express'
import { UserRight } from '../../../../shared/models/users'
import {
  asyncMiddleware,
  authenticate,
  ensureUserHasRight,
  paginationValidator,
  setDefaultPagination,
  setDefaultVideoRedundanciesSort,
  videoRedundanciesSortValidator
} from '../../../middlewares'
import {
  listVideoRedundanciesValidator,
  updateServerRedundancyValidator,
  addVideoRedundancyValidator,
  removeVideoRedundancyValidator
} from '../../../middlewares/validators/redundancy'
import { removeRedundanciesOfServer, removeVideoRedundancy } from '../../../lib/redundancy'
import { logger } from '../../../helpers/logger'
import { VideoRedundancyModel } from '@server/models/redundancy/video-redundancy'
import { JobQueue } from '@server/lib/job-queue'

const serverRedundancyRouter = express.Router()

serverRedundancyRouter.put('/redundancy/:host',
  authenticate,
  ensureUserHasRight(UserRight.MANAGE_SERVER_FOLLOW),
  asyncMiddleware(updateServerRedundancyValidator),
  asyncMiddleware(updateRedundancy)
)

serverRedundancyRouter.get('/redundancy/videos',
  authenticate,
  ensureUserHasRight(UserRight.MANAGE_VIDEOS_REDUNDANCIES),
  listVideoRedundanciesValidator,
  paginationValidator,
  videoRedundanciesSortValidator,
  setDefaultVideoRedundanciesSort,
  setDefaultPagination,
  asyncMiddleware(listVideoRedundancies)
)

serverRedundancyRouter.post('/redundancy/videos',
  authenticate,
  ensureUserHasRight(UserRight.MANAGE_VIDEOS_REDUNDANCIES),
  addVideoRedundancyValidator,
  asyncMiddleware(addVideoRedundancy)
)

serverRedundancyRouter.delete('/redundancy/videos/:redundancyId',
  authenticate,
  ensureUserHasRight(UserRight.MANAGE_VIDEOS_REDUNDANCIES),
  removeVideoRedundancyValidator,
  asyncMiddleware(removeVideoRedundancyController)
)

// ---------------------------------------------------------------------------

export {
  serverRedundancyRouter
}

// ---------------------------------------------------------------------------

async function listVideoRedundancies (req: express.Request, res: express.Response) {
  const resultList = await VideoRedundancyModel.listForApi({
    start: req.query.start,
    count: req.query.count,
    sort: req.query.sort,
    target: req.query.target,
    strategy: req.query.strategy
  })

  const result = {
    total: resultList.total,
    data: resultList.data.map(r => VideoRedundancyModel.toFormattedJSONStatic(r))
  }

  return res.json(result)
}

async function addVideoRedundancy (req: express.Request, res: express.Response) {
  const payload = {
    videoId: res.locals.onlyVideo.id
  }

  await JobQueue.Instance.createJobWithPromise({
    type: 'video-redundancy',
    payload
  })

  return res.sendStatus(204)
}

async function removeVideoRedundancyController (req: express.Request, res: express.Response) {
  await removeVideoRedundancy(res.locals.videoRedundancy)

  return res.sendStatus(204)
}

async function updateRedundancy (req: express.Request, res: express.Response) {
  const server = res.locals.server

  server.redundancyAllowed = req.body.redundancyAllowed

  await server.save()

  // Async, could be long
  removeRedundanciesOfServer(server.id)
    .catch(err => logger.error('Cannot remove redundancy of %s.', server.host, { err }))

  return res.sendStatus(204)
}
