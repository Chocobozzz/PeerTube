import * as express from 'express'
import { serverFollowsRouter } from './follows'

const serverRouter = express.Router()

serverRouter.use('/', serverFollowsRouter)

// ---------------------------------------------------------------------------

export {
  serverRouter
}
