import * as express from 'express'
import { serverFollowsRouter } from './follows'
import { statsRouter } from './stats'
import { serverRedundancyRouter } from './redundancy'
import { serverBlocklistRouter } from './server-blocklist'
import { contactRouter } from './contact'

const serverRouter = express.Router()

serverRouter.use('/', serverFollowsRouter)
serverRouter.use('/', serverRedundancyRouter)
serverRouter.use('/', statsRouter)
serverRouter.use('/', serverBlocklistRouter)
serverRouter.use('/', contactRouter)

// ---------------------------------------------------------------------------

export {
  serverRouter
}
