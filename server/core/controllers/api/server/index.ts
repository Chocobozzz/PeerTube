import express from 'express'
import { apiRateLimiter } from '@server/middlewares/index.js'
import { contactRouter } from './contact.js'
import { debugRouter } from './debug.js'
import { serverFollowsRouter } from './follows.js'
import { logsRouter } from './logs.js'
import { serverRedundancyRouter } from './redundancy.js'
import { serverBlocklistRouter } from './server-blocklist.js'
import { statsRouter } from './stats.js'

const serverRouter = express.Router()

serverRouter.use(apiRateLimiter)

serverRouter.use('/', serverFollowsRouter)
serverRouter.use('/', serverRedundancyRouter)
serverRouter.use('/', statsRouter)
serverRouter.use('/', serverBlocklistRouter)
serverRouter.use('/', contactRouter)
serverRouter.use('/', logsRouter)
serverRouter.use('/', debugRouter)

// ---------------------------------------------------------------------------

export {
  serverRouter
}
