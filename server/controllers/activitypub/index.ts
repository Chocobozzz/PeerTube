import * as express from 'express'

import { badRequest } from '../../helpers'
import { inboxRouter } from './inbox'
import { activityPubClientRouter } from './client'

const activityPubRouter = express.Router()

activityPubRouter.use('/', inboxRouter)
activityPubRouter.use('/', activityPubClientRouter)
activityPubRouter.use('/*', badRequest)

// ---------------------------------------------------------------------------

export {
  activityPubRouter
}
