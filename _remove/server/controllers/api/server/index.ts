import express from 'express'
import { contactRouter } from './contact'
import { debugRouter } from './debug'
import { serverFollowsRouter } from './follows'
import { logsRouter } from './logs'
import { serverRedundancyRouter } from './redundancy'
import { serverBlocklistRouter } from './server-blocklist'
import { statsRouter } from './stats'

const serverRouter = express.Router()

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
