import { HttpStatusCode, UserRight } from '@peertube/peertube-models'
import {
  auditLog,
  buildServerRedundancyAuditEntity,
  buildVideoRedundancyAuditEntity,
  getAuditActorFromRes
} from '@server/lib/audit-log/index.js'
import { JobQueue } from '@server/lib/job-queue/index.js'
import { VideoRedundancyModel } from '@server/models/redundancy/video-redundancy.js'
import express from 'express'
import { createLogger } from '../../../helpers/logger.js'
import { removeRedundanciesOfServer, removeVideoRedundancy } from '../../../lib/redundancy.js'
import {
  asyncMiddleware,
  authenticate,
  ensureUserHasRight,
  paginationValidator,
  setDefaultPagination,
  setDefaultVideoRedundanciesSort,
  videoRedundanciesSortValidator
} from '../../../middlewares/index.js'
import {
  addVideoRedundancyValidator,
  listVideoRedundanciesValidator,
  removeVideoRedundancyValidator,
  updateServerRedundancyValidator
} from '../../../middlewares/validators/redundancy.js'

const logger = createLogger()

const serverRedundancyRouter = express.Router()

serverRedundancyRouter.put(
  '/redundancy/:host',
  authenticate,
  ensureUserHasRight(UserRight.MANAGE_SERVER_FOLLOW),
  asyncMiddleware(updateServerRedundancyValidator),
  asyncMiddleware(updateRedundancy)
)

serverRedundancyRouter.get(
  '/redundancy/videos',
  authenticate,
  ensureUserHasRight(UserRight.MANAGE_VIDEOS_REDUNDANCIES),
  listVideoRedundanciesValidator,
  paginationValidator,
  videoRedundanciesSortValidator,
  setDefaultVideoRedundanciesSort,
  setDefaultPagination,
  asyncMiddleware(listVideoRedundancies)
)

serverRedundancyRouter.post(
  '/redundancy/videos',
  authenticate,
  ensureUserHasRight(UserRight.MANAGE_VIDEOS_REDUNDANCIES),
  addVideoRedundancyValidator,
  asyncMiddleware(addVideoRedundancy)
)

serverRedundancyRouter.delete(
  '/redundancy/videos/:redundancyId',
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
    videoId: res.locals.videoWithBlacklist.id
  }

  await JobQueue.Instance.createJob({
    type: 'video-redundancy',
    payload
  })

  auditLog.create(
    getAuditActorFromRes(res),
    () => buildVideoRedundancyAuditEntity({ video: res.locals.videoWithBlacklist, redundancy: null })
  )

  return res.status(HttpStatusCode.NO_CONTENT_204).end()
}

async function removeVideoRedundancyController (req: express.Request, res: express.Response) {
  const redundancy = res.locals.videoRedundancy

  await removeVideoRedundancy(redundancy)

  auditLog.delete(getAuditActorFromRes(res), () => buildVideoRedundancyAuditEntity({ video: redundancy.getVideo(), redundancy }))

  return res.status(HttpStatusCode.NO_CONTENT_204).end()
}

async function updateRedundancy (req: express.Request, res: express.Response) {
  const server = res.locals.server
  const oldServerAuditEntity = auditLog.snapshot(() => buildServerRedundancyAuditEntity(server))

  server.redundancyAllowed = req.body.redundancyAllowed

  await server.save()

  auditLog.update(getAuditActorFromRes(res), () => buildServerRedundancyAuditEntity(server), oldServerAuditEntity)

  if (server.redundancyAllowed !== true) {
    // Async, could be long
    removeRedundanciesOfServer(server.id)
      .catch(err => logger.error('Cannot remove redundancy of %s.', server.host, { err }))
  }

  return res.status(HttpStatusCode.NO_CONTENT_204).end()
}
