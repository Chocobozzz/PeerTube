import express from 'express'
import { activityPubClientRouter } from './client.js'
import { inboxRouter } from './inbox.js'
import { outboxRouter } from './outbox.js'

const activityPubRouter = express.Router()

activityPubRouter.use('/', inboxRouter)
activityPubRouter.use('/', outboxRouter)
activityPubRouter.use('/', activityPubClientRouter)

// ---------------------------------------------------------------------------

/**
 * The ActivityPub documents of the platform are read-only and cached in Redis, so every process can serve them
 *
 * The inbox stays on the primary: processing an incoming activity deduplicates views and downloads in memory
 */
const secondaryActivityPubRouter = express.Router()

secondaryActivityPubRouter.use('/', outboxRouter)
secondaryActivityPubRouter.use('/', activityPubClientRouter)

// ---------------------------------------------------------------------------

export {
  activityPubRouter,
  secondaryActivityPubRouter
}
