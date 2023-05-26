import express from 'express'
import { runnerJobsRouter } from './jobs'
import { runnerJobFilesRouter } from './jobs-files'
import { manageRunnersRouter } from './manage-runners'
import { runnerRegistrationTokensRouter } from './registration-tokens'

const runnersRouter = express.Router()

runnersRouter.use('/', manageRunnersRouter)
runnersRouter.use('/', runnerJobsRouter)
runnersRouter.use('/', runnerJobFilesRouter)
runnersRouter.use('/', runnerRegistrationTokensRouter)

// ---------------------------------------------------------------------------

export {
  runnersRouter
}
