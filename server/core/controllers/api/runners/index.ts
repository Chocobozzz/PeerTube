import express from 'express'
import { runnerJobFilesRouter } from './jobs-files.js'
import { registerRunnerJobSharedRoutes, runnerJobsRouter } from './jobs.js'
import { manageRunnersRouter } from './manage-runners.js'
import { runnerRegistrationTokensRouter } from './registration-tokens.js'

const runnersRouter = express.Router()

// No api route limiter here, they are defined in child routers

runnersRouter.use('/', manageRunnersRouter)
runnersRouter.use('/', runnerJobsRouter)
runnersRouter.use('/', runnerJobFilesRouter)
runnersRouter.use('/', runnerRegistrationTokensRouter)

// ---------------------------------------------------------------------------
// Router for secondary process
// ---------------------------------------------------------------------------

const secondaryRunnersRouter = express.Router()

secondaryRunnersRouter.use('/', manageRunnersRouter)
registerRunnerJobSharedRoutes(secondaryRunnersRouter)
secondaryRunnersRouter.use('/', runnerRegistrationTokensRouter)

// ---------------------------------------------------------------------------

export {
  runnersRouter,
  secondaryRunnersRouter
}
