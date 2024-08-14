import express from 'express'
import { activityPubClientRouter } from './client.js'
import { inboxRouter } from './inbox.js'
import { outboxRouter } from './outbox.js'

const activityPubRouter = express.Router()

activityPubRouter.use('/', inboxRouter)
activityPubRouter.use('/', outboxRouter)
activityPubRouter.use('/', activityPubClientRouter)

// ---------------------------------------------------------------------------

export {
  activityPubRouter
}
