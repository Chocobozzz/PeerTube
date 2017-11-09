import * as express from 'express'

import { badRequest } from '../../helpers'
import { inboxRouter } from './inbox'

const remoteRouter = express.Router()

remoteRouter.use('/inbox', inboxRouter)
remoteRouter.use('/*', badRequest)

// ---------------------------------------------------------------------------

export {
  remoteRouter
}
