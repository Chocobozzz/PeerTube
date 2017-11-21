import * as express from 'express'
import { activityPubClientRouter } from './client'
import { inboxRouter } from './inbox'
import { outboxRouter } from './outbox'

const activityPubRouter = express.Router()

activityPubRouter.use('/', inboxRouter)
activityPubRouter.use('/', outboxRouter)
activityPubRouter.use('/', activityPubClientRouter)

// ---------------------------------------------------------------------------

export {
  activityPubRouter
}
