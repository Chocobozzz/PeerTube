import * as express from 'express'
import { serverFollowsRouter } from './follows'
import { statsRouter } from './stats'

const serverRouter = express.Router()

serverRouter.use('/', serverFollowsRouter)
serverRouter.use('/', statsRouter)

// ---------------------------------------------------------------------------

export {
  serverRouter
}
