import * as express from 'express'
import { serverFollowsRouter } from './follows'
import { statsRouter } from './stats'
import { serverRedundancyRouter } from './redundancy'

const serverRouter = express.Router()

serverRouter.use('/', serverFollowsRouter)
serverRouter.use('/', serverRedundancyRouter)
serverRouter.use('/', statsRouter)

// ---------------------------------------------------------------------------

export {
  serverRouter
}
