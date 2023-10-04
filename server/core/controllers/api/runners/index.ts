import express from 'express'
import { runnerJobsRouter } from './jobs.js'
import { runnerJobFilesRouter } from './jobs-files.js'
import { manageRunnersRouter } from './manage-runners.js'
import { runnerRegistrationTokensRouter } from './registration-tokens.js'

const runnersRouter = express.Router()

// No api route limiter here, they are defined in child routers

runnersRouter.use('/', manageRunnersRouter)
runnersRouter.use('/', runnerJobsRouter)
runnersRouter.use('/', runnerJobFilesRouter)
runnersRouter.use('/', runnerRegistrationTokensRouter)

// ---------------------------------------------------------------------------

export {
  runnersRouter
}
