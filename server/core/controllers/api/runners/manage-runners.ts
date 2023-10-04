import express from 'express'
import { HttpStatusCode, ListRunnersQuery, RegisterRunnerBody, UserRight } from '@peertube/peertube-models'
import { logger, loggerTagsFactory } from '@server/helpers/logger.js'
import { generateRunnerToken } from '@server/helpers/token-generator.js'
import {
  apiRateLimiter,
  asyncMiddleware,
  authenticate,
  ensureUserHasRight,
  paginationValidator,
  runnersSortValidator,
  setDefaultPagination,
  setDefaultSort
} from '@server/middlewares/index.js'
import {
  deleteRunnerValidator,
  getRunnerFromTokenValidator,
  registerRunnerValidator
} from '@server/middlewares/validators/runners/index.js'
import { RunnerModel } from '@server/models/runner/runner.js'

const lTags = loggerTagsFactory('api', 'runner')

const manageRunnersRouter = express.Router()

manageRunnersRouter.post('/register',
  apiRateLimiter,
  asyncMiddleware(registerRunnerValidator),
  asyncMiddleware(registerRunner)
)
manageRunnersRouter.post('/unregister',
  apiRateLimiter,
  asyncMiddleware(getRunnerFromTokenValidator),
  asyncMiddleware(unregisterRunner)
)

manageRunnersRouter.delete('/:runnerId',
  apiRateLimiter,
  authenticate,
  ensureUserHasRight(UserRight.MANAGE_RUNNERS),
  asyncMiddleware(deleteRunnerValidator),
  asyncMiddleware(deleteRunner)
)

manageRunnersRouter.get('/',
  apiRateLimiter,
  authenticate,
  ensureUserHasRight(UserRight.MANAGE_RUNNERS),
  paginationValidator,
  runnersSortValidator,
  setDefaultSort,
  setDefaultPagination,
  asyncMiddleware(listRunners)
)

// ---------------------------------------------------------------------------

export {
  manageRunnersRouter
}

// ---------------------------------------------------------------------------

async function registerRunner (req: express.Request, res: express.Response) {
  const body: RegisterRunnerBody = req.body

  const runnerToken = generateRunnerToken()

  const runner = new RunnerModel({
    runnerToken,
    name: body.name,
    description: body.description,
    lastContact: new Date(),
    ip: req.ip,
    runnerRegistrationTokenId: res.locals.runnerRegistrationToken.id
  })

  await runner.save()

  logger.info('Registered new runner %s', runner.name, { ...lTags(runner.name) })

  return res.json({ id: runner.id, runnerToken })
}
async function unregisterRunner (req: express.Request, res: express.Response) {
  const runner = res.locals.runner
  await runner.destroy()

  logger.info('Unregistered runner %s', runner.name, { ...lTags(runner.name) })

  return res.sendStatus(HttpStatusCode.NO_CONTENT_204)
}

async function deleteRunner (req: express.Request, res: express.Response) {
  const runner = res.locals.runner

  await runner.destroy()

  logger.info('Deleted runner %s', runner.name, { ...lTags(runner.name) })

  return res.sendStatus(HttpStatusCode.NO_CONTENT_204)
}

async function listRunners (req: express.Request, res: express.Response) {
  const query: ListRunnersQuery = req.query

  const resultList = await RunnerModel.listForApi({
    start: query.start,
    count: query.count,
    sort: query.sort
  })

  return res.json({
    total: resultList.total,
    data: resultList.data.map(d => d.toFormattedJSON())
  })
}
