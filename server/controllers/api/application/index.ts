import * as express from 'express'
import { applicationFollowsRouter } from './follows'

const applicationRouter = express.Router()

applicationRouter.use('/', applicationFollowsRouter)

// ---------------------------------------------------------------------------

export {
  applicationRouter
}
