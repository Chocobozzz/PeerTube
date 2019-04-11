import * as express from 'express'
import { serverFollowsRouter } from './follows'
import { statsRouter } from './stats'
import { serverRedundancyRouter } from './redundancy'
import { serverBlocklistRouter } from './server-blocklist'
import { contactRouter } from './contact'
import { logsRouter } from './logs'
import { debugRouter } from './debug'

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
