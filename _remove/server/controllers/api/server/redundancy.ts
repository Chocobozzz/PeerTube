import express from 'express'
import { JobQueue } from '@server/lib/job-queue'
import { VideoRedundancyModel } from '@server/models/redundancy/video-redundancy'
import { HttpStatusCode } from '../../../../shared/models/http/http-error-codes'
import { UserRight } from '../../../../shared/models/users'
import { logger } from '../../../helpers/logger'
import { removeRedundanciesOfServer, removeVideoRedundancy } from '../../../lib/redundancy'
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
  addVideoRedundancyValidator,
  listVideoRedundanciesValidator,
  removeVideoRedundancyValidator,
  updateServerRedundancyValidator
} from '../../../middlewares/validators/redundancy'

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

  return res.status(HttpStatusCode.NO_CONTENT_204).end()
}

async function removeVideoRedundancyController (req: express.Request, res: express.Response) {
  await removeVideoRedundancy(res.locals.videoRedundancy)

  return res.status(HttpStatusCode.NO_CONTENT_204).end()
}

async function updateRedundancy (req: express.Request, res: express.Response) {
  const server = res.locals.server

  server.redundancyAllowed = req.body.redundancyAllowed

  await server.save()

  if (server.redundancyAllowed !== true) {
    // Async, could be long
    removeRedundanciesOfServer(server.id)
      .catch(err => logger.error('Cannot remove redundancy of %s.', server.host, { err }))
  }

  return res.status(HttpStatusCode.NO_CONTENT_204).end()
}
