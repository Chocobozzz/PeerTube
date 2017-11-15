import * as express from 'express'
import { activityPubClientRouter } from './client'
import { inboxRouter } from './inbox'

const activityPubRouter = express.Router()

activityPubRouter.use('/', inboxRouter)
activityPubRouter.use('/', activityPubClientRouter)

// ---------------------------------------------------------------------------

export {
  activityPubRouter
}
