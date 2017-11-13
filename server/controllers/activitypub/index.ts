import * as express from 'express'

import { badRequest } from '../../helpers'
import { inboxRouter } from './inbox'
import { activityPubClientRouter } from './client'

const remoteRouter = express.Router()

remoteRouter.use('/', inboxRouter)
remoteRouter.use('/', activityPubClientRouter)
remoteRouter.use('/*', badRequest)

// ---------------------------------------------------------------------------

export {
  remoteRouter
}
