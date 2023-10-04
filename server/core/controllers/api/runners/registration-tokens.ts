import express from 'express'
import { logger, loggerTagsFactory } from '@server/helpers/logger.js'
import { generateRunnerRegistrationToken } from '@server/helpers/token-generator.js'
import {
  apiRateLimiter,
  asyncMiddleware,
  authenticate,
  ensureUserHasRight,
  paginationValidator,
  runnerRegistrationTokensSortValidator,
  setDefaultPagination,
  setDefaultSort
} from '@server/middlewares/index.js'
import { deleteRegistrationTokenValidator } from '@server/middlewares/validators/runners/index.js'
import { RunnerRegistrationTokenModel } from '@server/models/runner/runner-registration-token.js'
import { HttpStatusCode, ListRunnerRegistrationTokensQuery, UserRight } from '@peertube/peertube-models'

const lTags = loggerTagsFactory('api', 'runner')

const runnerRegistrationTokensRouter = express.Router()

runnerRegistrationTokensRouter.post('/registration-tokens/generate',
  apiRateLimiter,
  authenticate,
  ensureUserHasRight(UserRight.MANAGE_RUNNERS),
  asyncMiddleware(generateRegistrationToken)
)

runnerRegistrationTokensRouter.delete('/registration-tokens/:id',
  apiRateLimiter,
  authenticate,
  ensureUserHasRight(UserRight.MANAGE_RUNNERS),
  asyncMiddleware(deleteRegistrationTokenValidator),
  asyncMiddleware(deleteRegistrationToken)
)

runnerRegistrationTokensRouter.get('/registration-tokens',
  apiRateLimiter,
  authenticate,
  ensureUserHasRight(UserRight.MANAGE_RUNNERS),
  paginationValidator,
  runnerRegistrationTokensSortValidator,
  setDefaultSort,
  setDefaultPagination,
  asyncMiddleware(listRegistrationTokens)
)

// ---------------------------------------------------------------------------

export {
  runnerRegistrationTokensRouter
}

// ---------------------------------------------------------------------------

async function generateRegistrationToken (req: express.Request, res: express.Response) {
  logger.info('Generating new runner registration token.', lTags())

  const registrationToken = new RunnerRegistrationTokenModel({
    registrationToken: generateRunnerRegistrationToken()
  })

  await registrationToken.save()

  return res.sendStatus(HttpStatusCode.NO_CONTENT_204)
}

async function deleteRegistrationToken (req: express.Request, res: express.Response) {
  logger.info('Removing runner registration token.', lTags())

  const runnerRegistrationToken = res.locals.runnerRegistrationToken

  await runnerRegistrationToken.destroy()

  return res.sendStatus(HttpStatusCode.NO_CONTENT_204)
}

async function listRegistrationTokens (req: express.Request, res: express.Response) {
  const query: ListRunnerRegistrationTokensQuery = req.query

  const resultList = await RunnerRegistrationTokenModel.listForApi({
    start: query.start,
    count: query.count,
    sort: query.sort
  })

  return res.json({
    total: resultList.total,
    data: resultList.data.map(d => d.toFormattedJSON())
  })
}
